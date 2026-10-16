import { unzipSync } from "fflate";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createWhatsAppDeckArchive,
  MAX_CARD_PNG_BYTES,
  MAX_DECK_CARDS,
  MAX_DECK_PNG_BYTES,
} from "../../src/lib/whatsapp/deck-export";
import type { WhatsAppStory } from "../../src/lib/whatsapp/story-types";

let portraitPng: Uint8Array<ArrayBuffer>;
beforeAll(async () => {
  portraitPng = new Uint8Array(
    await sharp({
      create: { width: 1080, height: 1920, channels: 4, background: "#173f35" },
    })
      .png()
      .toBuffer(),
  );
});

function story(id = "opening"): WhatsAppStory {
  return {
    id,
    name: "PRIVATE_SOURCE_NAME",
    label: "A fictional card",
    title: "A fictional chapter.",
    lead: "Synthetic aggregate counts.",
    value: "12",
    valueLabel: "messages",
    facts: [],
    note: "Generated locally.",
    theme: "forest",
    motif: "rings",
    mode: "pair",
    calculation: {
      classification: "Exact",
      definition: "Synthetic counts.",
      threshold: null,
      limitations: "Fictional data.",
    },
    kind: "hero",
    data: {
      activeDates: 2,
      calendarSpanDays: 3,
      firstDate: "1 Jan 2025",
      lastDate: "3 Jan 2025",
    },
  };
}

function pngBlob(bytes: Uint8Array = portraitPng, type = "image/png") {
  return new Blob([new Uint8Array(bytes)], { type });
}

const fixtureDeck = () => [
  story("opening"),
  story("message-counts"),
  story("closing"),
];

describe("browser-local WhatsApp full-deck archive", () => {
  it("renders sequentially, reports ordered progress, and archives real portrait PNGs in story order", async () => {
    const deck = fixtureDeck();
    let releaseFirst!: (image: Blob) => void;
    const first = new Promise<Blob>((resolve) => {
      releaseFirst = resolve;
    });
    const events: string[] = [];
    const render = vi.fn((item: WhatsAppStory) => {
      events.push(`render:${item.id}`);
      return render.mock.calls.length === 1
        ? first
        : Promise.resolve(pngBlob());
    });
    const progress = vi.fn((completed: number, total: number) => {
      events.push(`progress:${completed}/${total}`);
    });
    const pending = createWhatsAppDeckArchive(deck, render, {
      onProgress: progress,
    });
    expect(render).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls).toEqual([[0, 3]]);
    releaseFirst(pngBlob());
    const result = await pending;
    expect(render.mock.calls.map(([item]) => item.id)).toEqual(
      deck.map((item) => item.id),
    );
    expect(progress.mock.calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(events).toEqual([
      "progress:0/3",
      "render:opening",
      "progress:1/3",
      "render:message-counts",
      "progress:2/3",
      "render:closing",
      "progress:3/3",
    ]);
    expect(result.filename).toBe("instascope-whatsapp-wrapped-deck.zip");
    expect(result.blob.type).toBe("application/zip");
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const files = unzipSync(bytes);
    expect(Object.keys(files)).toEqual([
      "01-opening.png",
      "02-message-counts.png",
      "03-closing.png",
    ]);
    for (const image of Object.values(files)) {
      expect(image).toEqual(portraitPng);
      const decoded = await sharp(image)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(decoded.info).toMatchObject({
        width: 1080,
        height: 1920,
        channels: 4,
      });
      expect([...decoded.data.subarray(0, 4)]).toEqual([23, 63, 53, 255]);
    }
    expect(Buffer.from(bytes).toString("latin1")).not.toContain(
      "PRIVATE_SOURCE_NAME",
    );
  });

  it("uses generic demo filenames and deterministic archive metadata", async () => {
    const render = async () => pngBlob();
    const first = await createWhatsAppDeckArchive(fixtureDeck(), render, {
      demo: true,
    });
    const second = await createWhatsAppDeckArchive(fixtureDeck(), render, {
      demo: true,
    });
    expect(first.filename).toBe("instascope-whatsapp-demo-deck.zip");
    expect(await first.blob.arrayBuffer()).toEqual(
      await second.blob.arrayBuffer(),
    );
  });

  it("supports the complete twelve-card bound with two-digit ordered names", async () => {
    const ids = [
      "opening",
      "split",
      "dates",
      "hours",
      "streak",
      "sessions",
      "starters",
      "silence",
      "rhythm",
      "patterns",
      "media",
      "closing",
    ];
    expect(ids).toHaveLength(MAX_DECK_CARDS);
    const result = await createWhatsAppDeckArchive(
      ids.map((id) => story(id)),
      async () => pngBlob(),
    );
    expect(
      Object.keys(unzipSync(new Uint8Array(await result.blob.arrayBuffer()))),
    ).toEqual(
      ids.map((id, index) => `${String(index + 1).padStart(2, "0")}-${id}.png`),
    );
  });

  it.each([0, MAX_DECK_CARDS + 1])(
    "rejects a %i-card deck before any rendering",
    async (count) => {
      const render = vi.fn(async () => pngBlob());
      await expect(
        createWhatsAppDeckArchive(
          Array.from({ length: count }, () => story()),
          render,
        ),
      ).rejects.toThrow("This deck cannot be exported");
      expect(render).not.toHaveBeenCalled();
    },
  );

  it.each([
    "",
    "../source",
    "Source",
    "source.png",
    "private/name",
    "participant_1",
    "card1",
    "two--hyphens",
    "a".repeat(49),
  ])("rejects unsafe or invalid story ID %j before rendering", async (id) => {
    const render = vi.fn(async () => pngBlob());
    await expect(
      createWhatsAppDeckArchive([story(id)], render),
    ).rejects.toThrow("This deck cannot be exported");
    expect(render).not.toHaveBeenCalled();
  });

  it("rejects duplicate story IDs before rendering", async () => {
    const render = vi.fn(async () => pngBlob());
    await expect(
      createWhatsAppDeckArchive([story("same"), story("same")], render),
    ).rejects.toThrow("This deck cannot be exported");
    expect(render).not.toHaveBeenCalled();
  });

  it.each([undefined, false])(
    "requires an explicit word-export choice when includeWords is %s",
    async (includeWords) => {
      const word: WhatsAppStory = {
        ...story("words"),
        kind: "word",
        data: { words: [{ word: "fictional", count: 3 }], eligibleWords: 20 },
      };
      const render = vi.fn(async () => pngBlob());
      await expect(
        createWhatsAppDeckArchive([story(), word], render, { includeWords }),
      ).rejects.toThrow("explicit choice");
      expect(render).not.toHaveBeenCalled();
    },
  );

  it("exports a word card only after the explicit current-session choice", async () => {
    const word: WhatsAppStory = {
      ...story("words"),
      kind: "word",
      data: { words: [{ word: "fictional", count: 3 }], eligibleWords: 20 },
    };
    const render = vi.fn(async () => pngBlob());
    const result = await createWhatsAppDeckArchive([word], render, {
      includeWords: true,
    });
    expect(render).toHaveBeenCalledExactlyOnceWith(word);
    expect(
      Object.keys(unzipSync(new Uint8Array(await result.blob.arrayBuffer()))),
    ).toEqual(["01-words.png"]);
  });

  it.each(["image/jpeg", "application/octet-stream", ""])(
    'rejects MIME type "%s" and renders no following cards',
    async (mime) => {
      const render = vi.fn(async () => pngBlob(portraitPng, mime));
      await expect(
        createWhatsAppDeckArchive(fixtureDeck(), render),
      ).rejects.toThrow("Download individual cards instead");
      expect(render).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["empty", "signature", "truncated", "header-length", "header-type"])(
    "rejects an invalid PNG %s",
    async (problem) => {
      const bytes =
        problem === "empty" ? new Uint8Array() : new Uint8Array(portraitPng);
      if (problem === "signature") bytes[0] = 0;
      if (problem === "header-length") bytes[11] = 12;
      if (problem === "header-type") bytes[12] = 0;
      const render = vi.fn(async () =>
        pngBlob(problem === "truncated" ? bytes.slice(0, 32) : bytes),
      );
      await expect(
        createWhatsAppDeckArchive(fixtureDeck(), render),
      ).rejects.toThrow("A card image could not be prepared");
      expect(render).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [1920, 1080],
    [1080, 1919],
    [1079, 1920],
  ])("rejects actual PNG dimensions %i × %i", async (width, height) => {
    const wrongSize = await sharp({
      create: { width, height, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(
      createWhatsAppDeckArchive([story()], async () => pngBlob(wrongSize)),
    ).rejects.toThrow("A card image could not be prepared");
  });

  it("rejects a PNG above the per-card byte bound before reading its body", async () => {
    const image = pngBlob(new Uint8Array(MAX_CARD_PNG_BYTES + 1));
    const read = vi.spyOn(image, "arrayBuffer");
    const render = vi.fn(async () => image);
    await expect(
      createWhatsAppDeckArchive(fixtureDeck(), render),
    ).rejects.toThrow("This deck is too large");
    expect(read).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("rejects cumulative PNG bytes above the deck bound and stops before the next card", async () => {
    const padded = new Uint8Array(MAX_CARD_PNG_BYTES);
    padded.set(portraitPng);
    const image = pngBlob(padded);
    const read = vi.spyOn(image, "arrayBuffer");
    const render = vi.fn(async () => image);
    const ids = ["one", "two", "three", "four", "five", "six"];
    expect(MAX_DECK_PNG_BYTES).toBe(MAX_CARD_PNG_BYTES * 4);
    await expect(
      createWhatsAppDeckArchive(
        ids.map((id) => story(id)),
        render,
      ),
    ).rejects.toThrow("This deck is too large");
    expect(read).toHaveBeenCalledTimes(4);
    expect(render).toHaveBeenCalledTimes(5);
  });

  it("does no rendering or progress work when cancelled before export", async () => {
    const controller = new AbortController();
    controller.abort();
    const render = vi.fn(async () => pngBlob());
    const onProgress = vi.fn();
    await expect(
      createWhatsAppDeckArchive(fixtureDeck(), render, {
        signal: controller.signal,
        onProgress,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(render).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("discards a render completed after cancellation and never renders another card", async () => {
    const controller = new AbortController();
    let release!: (image: Blob) => void;
    const render = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          release = resolve;
        }),
    );
    const onProgress = vi.fn();
    const pending = createWhatsAppDeckArchive(fixtureDeck(), render, {
      signal: controller.signal,
      onProgress,
    });
    expect(render).toHaveBeenCalledTimes(1);
    controller.abort();
    release(pngBlob());
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(render).toHaveBeenCalledTimes(1);
    expect(onProgress.mock.calls).toEqual([[0, 3]]);
  });

  it("checks cancellation after reading PNG bytes and before the next render", async () => {
    const controller = new AbortController();
    const image = pngBlob();
    const read = image.arrayBuffer.bind(image);
    vi.spyOn(image, "arrayBuffer").mockImplementation(async () => {
      controller.abort();
      return read();
    });
    const render = vi.fn(async () => image);
    const onProgress = vi.fn();
    await expect(
      createWhatsAppDeckArchive(fixtureDeck(), render, {
        signal: controller.signal,
        onProgress,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(render).toHaveBeenCalledTimes(1);
    expect(onProgress.mock.calls).toEqual([[0, 3]]);
  });

  it.each([1, 3])(
    "checks cancellation from progress after card %i before returning an archive",
    async (cancelAt) => {
      const controller = new AbortController();
      const render = vi.fn(async () => pngBlob());
      await expect(
        createWhatsAppDeckArchive(fixtureDeck(), render, {
          signal: controller.signal,
          onProgress: (completed) => {
            if (completed === cancelAt) controller.abort();
          },
        }),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(render).toHaveBeenCalledTimes(cancelAt);
    },
  );

  it("stops on a renderer failure without rendering later cards", async () => {
    const render = vi.fn(async () => {
      throw new Error("Synthetic renderer failure");
    });
    const onProgress = vi.fn();
    await expect(
      createWhatsAppDeckArchive(fixtureDeck(), render, { onProgress }),
    ).rejects.toThrow("Synthetic renderer failure");
    expect(render).toHaveBeenCalledTimes(1);
    expect(onProgress.mock.calls).toEqual([[0, 3]]);
  });
});
