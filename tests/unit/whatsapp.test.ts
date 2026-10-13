import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { strToU8, zipSync, Zip, ZipDeflate } from "fflate";
import { analyzeWhatsApp } from "../../src/lib/whatsapp/analysis";
import { createWhatsAppDemo } from "../../src/lib/whatsapp/demo";
import { WhatsAppImportError } from "../../src/lib/whatsapp/errors";
import { WHATSAPP_FORMATS } from "../../src/lib/whatsapp/formats";
import {
  importWhatsApp,
  type WhatsAppNamedBlob,
} from "../../src/lib/whatsapp/import";
import {
  WHATSAPP_LIMITS,
  validateWhatsAppSelection,
} from "../../src/lib/whatsapp/limits";
import {
  detectWhatsAppMedia,
  extractWhatsAppEmoji,
  extractWhatsAppLinks,
} from "../../src/lib/whatsapp/normalize";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import { whatsappCrc32 } from "../../src/lib/whatsapp/zip";

const fixture = (name: string) =>
  readFileSync(
    new URL(`../fixtures/whatsapp/${name}`, import.meta.url),
    "utf8",
  );
const text = fixture("dmy-24h.txt");
const file = (bytes: Uint8Array, name = "chat.zip") =>
  new File([Uint8Array.from(bytes)], name);
const centralOffset = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(
    bytes.length - 6,
    true,
  );
const smallZip = (level: 0 | 6 = 6) =>
  zipSync(
    {
      "nested/chat.txt": strToU8(text),
      "photo.jpg": new Uint8Array([1, 2, 3]),
    },
    { level },
  );

const withLocalExtra = (bytes: Uint8Array, extra: Uint8Array) => {
  const local = new DataView(bytes.buffer, bytes.byteOffset);
  const position = 30 + local.getUint16(26, true) + local.getUint16(28, true);
  const output = new Uint8Array(bytes.length + extra.length);
  output.set(bytes.subarray(0, position));
  output.set(extra, position);
  output.set(bytes.subarray(position), position + extra.length);
  const view = new DataView(output.buffer);
  view.setUint16(28, local.getUint16(28, true) + extra.length, true);
  view.setUint32(output.length - 6, centralOffset(bytes) + extra.length, true);
  return output;
};

const withDescriptor = (signature: boolean) => {
  const bytes = zipSync({ "chat.txt": strToU8(text) }, { level: 0 });
  const central = centralOffset(bytes),
    source = new DataView(bytes.buffer, bytes.byteOffset);
  const descriptor = new Uint8Array(signature ? 16 : 12),
    descriptorView = new DataView(descriptor.buffer),
    start = signature ? 4 : 0;
  if (signature) descriptorView.setUint32(0, 0x08074b50, true);
  descriptorView.setUint32(start, source.getUint32(central + 16, true), true);
  descriptorView.setUint32(
    start + 4,
    source.getUint32(central + 20, true),
    true,
  );
  descriptorView.setUint32(
    start + 8,
    source.getUint32(central + 24, true),
    true,
  );
  const output = new Uint8Array(bytes.length + descriptor.length);
  output.set(bytes.subarray(0, central));
  output.set(descriptor, central);
  output.set(bytes.subarray(central), central + descriptor.length);
  const view = new DataView(output.buffer),
    nextCentral = central + descriptor.length;
  view.setUint16(6, 8, true);
  view.setUint32(14, 0, true);
  view.setUint32(18, 0, true);
  view.setUint32(22, 0, true);
  view.setUint16(nextCentral + 8, 8, true);
  view.setUint32(output.length - 6, nextCentral, true);
  return { bytes: output, descriptorOffset: central };
};

describe("isolated WhatsApp parsing and normalization", () => {
  it.each(WHATSAPP_FORMATS)(
    "requires an explicit supported format: $id",
    (format) => {
      const dataset = parseWhatsApp(format.sample, format.id);
      expect(dataset.messages).toHaveLength(1);
      expect(dataset.messages[0].timestamp).toMatchObject({
        year: 2025,
        month: 3,
        day: 14,
        hour: 9,
        minute: 15,
        precision: "minute",
        local: "2025-03-14T09:15",
      });
    },
  );

  it("keeps messages, exact participant labels, continuation content and system events separate", () => {
    const dataset = parseWhatsApp(text, "dmy-24h");
    expect(dataset.messages).toHaveLength(7);
    expect(dataset.systemEvents).toHaveLength(1);
    expect(
      dataset.participants.map((participant) => participant.displayName),
    ).toEqual(["Mira", "Rowan"]);
    expect(dataset.messages[1].content).toBe(
      "Route: https://example.org/map\nMeet at the synthetic station.",
    );
    expect(dataset.metadata.warnings.map((warning) => warning.code)).toEqual([
      "wall-clock",
      "text-boundaries",
      "participant-labels",
      "media-placeholders",
    ]);
    expect(dataset).not.toHaveProperty("followers");
  });

  it("supports iOS brackets, AM/PM midnight/noon, seconds and multiline records", () => {
    const dataset = parseWhatsApp(fixture("mdy-12h-ios.txt"), "mdy-12h");
    expect(dataset.messages.map((message) => message.timestamp.local)).toEqual([
      "2025-03-14T00:00:01",
      "2025-03-14T12:05:02",
      "2025-03-15T13:02:03",
    ]);
    expect(dataset.metadata.timestampPrecision).toBe("second");
    expect(dataset.messages[1].content).toBe(
      "Noon note.\nThis is a second line.",
    );
  });

  it("accepts UTF-8 BOM, CRLF, export direction mark and narrow no-break time separators", () => {
    const dataset = parseWhatsApp(
      "\ufeff\u200e[03/14/2025, 9:15\u202fAM] Mira: Hello\r\nWorld\r\n",
      "mdy-12h",
    );
    expect(dataset.messages[0].content).toBe("Hello\nWorld");
    expect(dataset.messages[0].timestamp.local).toBe("2025-03-14T09:15");
  });

  it("preserves mixed precision, repeated records and sender-label casing", () => {
    const dataset = parseWhatsApp(
      "14/03/2025, 09:15 - Mira: Hello\n14/03/2025, 09:15 - Mira: Hello\n[14/03/2025, 09:15:07] mira: Hello",
      "dmy-24h",
    );
    expect(dataset.messages).toHaveLength(3);
    expect(dataset.participants).toHaveLength(2);
    expect(dataset.metadata.timestampPrecision).toBe("mixed");
  });

  it("keeps untrusted names and HTML as inert strings", () => {
    const dataset = parseWhatsApp(
      "14/03/2025, 09:15 - <img src=x onerror=alert(1)>: <script>alert(1)</script>",
      "dmy-24h",
    );
    expect(dataset.participants[0].displayName).toBe(
      "<img src=x onerror=alert(1)>",
    );
    expect(dataset.messages[0].content).toBe("<script>alert(1)</script>");
  });

  it("rejects an empty sender delimiter instead of counting it as a system event", () => {
    expect(() =>
      parseWhatsApp(
        "14/03/2025, 09:15 - Mira: Hello\n14/03/2025, 09:16 - : Empty label",
        "dmy-24h",
      ),
    ).toThrow(/sender label is empty/);
  });

  it.each([
    "29/02/2025, 09:15 - Mira: Hello",
    "31/04/2025, 09:15 - Mira: Hello",
    "14/03/2025, 24:00 - Mira: Hello",
    "14/03/2025, 09:60 - Mira: Hello",
    "14/03/2025, 09:15:60 - Mira: Hello",
    "00/03/2025, 09:15 - Mira: Hello",
    "14/13/2025, 09:15 - Mira: Hello",
  ])("rejects invalid calendar/clock fields: %s", (input) =>
    expect(() => parseWhatsApp(input, "dmy-24h")).toThrow(/invalid calendar/),
  );

  it("handles Gregorian leap years without local date parsing", () => {
    expect(
      parseWhatsApp("29/02/2024, 09:15 - Mira: Hello", "dmy-24h").messages[0]
        .timestamp.date,
    ).toBe("2024-02-29");
    expect(() =>
      parseWhatsApp("29/02/2100, 09:15 - Mira: Hello", "dmy-24h"),
    ).toThrow(/invalid calendar/);
  });

  it.each([
    ["14/03/25, 09:15 - Mira: Hello", "dmy-24h"],
    ["14/03/2025, 09:15 - Mira: Hello", "mdy-24h"],
    ["14.03.2025, 09:15 - Mira: Hello", "dmy-24h"],
    ["14/03/2025, 09:15 PM - Mira: Hello", "dmy-24h"],
    ["14/03/2025, 09:15 - Mira: Hello", "dmy-12h"],
    ["14/03/2025, 9:15 vorm. - Mira: Hello", "dmy-12h"],
  ] as const)(
    "does not guess mismatched date order, century, separator, clock or locale",
    (input, format) =>
      expect(() => parseWhatsApp(input, format)).toThrow(WhatsAppImportError),
  );

  it("does not silently append unsupported timestamp headers after valid messages", () => {
    expect(() =>
      parseWhatsApp(
        "14/03/2025, 09:15 - Mira: Hello\n15/03/2025, 09.15 - Rowan: Hello",
        "dmy-24h",
      ),
    ).toThrow(/unsupported or mixed/);
  });

  it("documents and follows timestamp-shaped multiline boundaries without inventing identity", () => {
    const dataset = parseWhatsApp(
      "14/03/2025, 09:15 - Mira: Pasted transcript:\n14/03/2025, 09:16 - Rowan: Hello\n14/03/2025, 09:17 - Notice without sender",
      "dmy-24h",
    );
    expect(dataset.messages).toHaveLength(2);
    expect(dataset.systemEvents).toHaveLength(1);
    expect(
      dataset.metadata.warnings.find(
        (warning) => warning.code === "text-boundaries",
      )?.message,
    ).toContain("cannot be distinguished");
  });

  it("rejects empty, arbitrary preamble, NUL and system-only exports with static errors", () => {
    expect(() => parseWhatsApp("\n", "dmy-24h")).toThrow(
      /no supported chat records/,
    );
    expect(() => parseWhatsApp("PRIVATE LABEL\n" + text, "dmy-24h")).toThrow(
      /does not start/,
    );
    expect(() => parseWhatsApp("\u0000" + text, "dmy-24h")).toThrow(/UTF-8/);
    expect(() =>
      parseWhatsApp(
        "14/03/2025, 09:15 - Messages and calls are end-to-end encrypted.",
        "dmy-24h",
      ),
    ).toThrow(/system events but no sender messages/);
    try {
      parseWhatsApp("PRIVATE LABEL", "dmy-24h");
    } catch (error) {
      expect((error as Error).message).not.toContain("PRIVATE LABEL");
    }
  });

  it("keeps media detection exact and prototype-safe", () => {
    expect(detectWhatsAppMedia("<Media omitted>")).toBe("unspecified");
    expect(detectWhatsAppMedia("\u200eimage omitted")).toBe("image");
    for (const value of [
      "We discussed <Media omitted>",
      "<Media omitted>\nCaption",
      "<attached: photo.jpg>",
      "Media omitted",
      "__proto__",
      "toString",
    ])
      expect(detectWhatsAppMedia(value)).toBeUndefined();
  });

  it("extracts explicit safe links without accessing URLs or accepting other schemes/credentials", () => {
    expect(
      extractWhatsAppLinks(
        "https://example.org/a, (http://example.org/b). https://name:secret@example.org/private javascript:alert(1) data:text/html,x www.example.org",
      ),
    ).toEqual(["https://example.org/a", "http://example.org/b"]);
    expect(
      extractWhatsAppLinks(
        "https://example.org/a_(b) https://example.org/a_(b))",
      ),
    ).toEqual(["https://example.org/a_(b)", "https://example.org/a_(b)"]);
  });

  it("counts visible supported emoji sequences once and ignores digits, text symbols and incomplete flags", () => {
    expect(extractWhatsAppEmoji("🌿👨‍👩‍👧‍👦🇩🇪👍🏽1️⃣❤️ 123 © ™ 🇩")).toEqual([
      "🌿",
      "👨‍👩‍👧‍👦",
      "🇩🇪",
      "👍🏽",
      "1️⃣",
      "❤️",
    ]);
  });

  it("marks emoji statistics unavailable when grapheme support is absent", () => {
    const original = Intl.Segmenter;
    Object.defineProperty(Intl, "Segmenter", {
      value: undefined,
      configurable: true,
    });
    try {
      const dataset = parseWhatsApp(text, "dmy-24h");
      expect(dataset.messages[0].emoji).toBeNull();
      expect(
        dataset.metadata.warnings.some(
          (warning) => warning.code === "emoji-unavailable",
        ),
      ).toBe(true);
      expect(analyzeWhatsApp(dataset).totals.emoji).toBeNull();
    } finally {
      Object.defineProperty(Intl, "Segmenter", {
        value: original,
        configurable: true,
      });
    }
  });
});

describe("factual WhatsApp activity analysis", () => {
  it("matches independent synthetic fixture totals, participant counts, periods, gaps and streaks", () => {
    const analysis = analyzeWhatsApp(parseWhatsApp(text, "dmy-24h"));
    expect(analysis.totals).toEqual({
      messages: 7,
      systemEvents: 1,
      participants: 2,
      mediaMessages: 2,
      links: 2,
      messagesWithLinks: 2,
      emoji: 5,
      messagesWithEmoji: 3,
      activeDays: 3,
    });
    expect(
      analysis.participants.map((participant) => [
        participant.displayName,
        participant.messageCount,
      ]),
    ).toEqual([
      ["Mira", 4],
      ["Rowan", 3],
    ]);
    expect(analysis.first?.local).toBe("2025-03-14T09:01");
    expect(analysis.latest?.local).toBe("2025-03-17T08:01");
    expect(analysis.observedSpanSeconds).toBe(255600);
    expect(analysis.calendarSpanDays).toBe(4);
    expect(analysis.yearly).toEqual([{ key: "2025", label: "2025", count: 7 }]);
    expect(analysis.monthly[0].count).toBe(7);
    expect(analysis.daily.map((bucket) => bucket.count)).toEqual([3, 2, 2]);
    expect(analysis.hours).toHaveLength(24);
    expect(analysis.weekdays).toHaveLength(7);
    expect(analysis.weekdays.map((bucket) => bucket.count)).toEqual([
      2, 0, 0, 0, 3, 2, 0,
    ]);
    expect(analysis.busiest.day?.key).toBe("2025-03-14");
    expect(analysis.busiest.hour?.key).toBe("08");
    expect(analysis.longestGap?.wallClockSeconds).toBe(165300);
    expect(analysis.longestGap?.from.local).toBe("2025-03-15T10:05");
    expect(analysis.longestStreak).toEqual({
      from: "2025-03-14",
      to: "2025-03-15",
      days: 2,
    });
  });

  it("sorts timestamp order for gap/statistics while preserving source records and input immutability", () => {
    const dataset = parseWhatsApp(
      "15/03/2025, 12:00 - Mira: later\n14/03/2025, 12:00 - Rowan: earlier\n14/03/2025, 12:00 - Rowan: duplicate",
      "dmy-24h",
    );
    const before = JSON.stringify(dataset);
    const analysis = analyzeWhatsApp(dataset);
    expect(analysis.first?.date).toBe("2025-03-14");
    expect(analysis.latest?.date).toBe("2025-03-15");
    expect(analysis.totals.messages).toBe(3);
    expect(analysis.longestGap?.wallClockSeconds).toBe(86400);
    expect(
      dataset.metadata.warnings.some(
        (warning) => warning.code === "out-of-order",
      ),
    ).toBe(true);
    expect(JSON.stringify(dataset)).toBe(before);
  });

  it("excludes system events from first/latest, calendar, hour and gap metrics", () => {
    const dataset = parseWhatsApp(
      "01/01/2024, 00:00 - System notice\n14/03/2025, 12:00 - Mira: One message\n01/01/2026, 00:00 - System notice",
      "dmy-24h",
    );
    const analysis = analyzeWhatsApp(dataset);
    expect(analysis.first?.date).toBe("2025-03-14");
    expect(analysis.latest?.date).toBe("2025-03-14");
    expect(analysis.observedSpanSeconds).toBe(0);
    expect(analysis.calendarSpanDays).toBe(1);
    expect(analysis.longestGap).toBeNull();
    expect(analysis.longestStreak?.days).toBe(1);
  });

  it("does not fill calendar gaps or infer missing messages around DST", () => {
    const analysis = analyzeWhatsApp(
      parseWhatsApp(
        "29/03/2025, 12:00 - Mira: one\n31/03/2025, 12:00 - Rowan: two",
        "dmy-24h",
      ),
    );
    expect(analysis.daily.map((bucket) => bucket.key)).toEqual([
      "2025-03-29",
      "2025-03-31",
    ]);
    expect(analysis.longestGap?.wallClockSeconds).toBe(172800);
    expect(analysis.longestStreak?.days).toBe(1);
  });

  it("keeps synthetic demo factual and deterministic", () => {
    const dataset = createWhatsAppDemo(),
      analysis = analyzeWhatsApp(dataset);
    expect(dataset.metadata.source).toBe("demo");
    expect(analysis.totals).toMatchObject({
      messages: 24,
      participants: 3,
      systemEvents: 1,
      mediaMessages: 4,
      links: 6,
      activeDays: 8,
    });
    expect(
      analysis.participants.map((participant) => participant.messageCount),
    ).toEqual([8, 8, 8]);
    expect(analysis.calendarSpanDays).toBe(11);
    expect(analysis.longestStreak?.days).toBe(5);
    expect(createWhatsAppDemo()).toEqual(dataset);
  });
});

describe("bounded local WhatsApp TXT/ZIP imports", () => {
  it.each([0, 6] as const)(
    "reads stored/deflated single-chat ZIPs (level %i), excluding media",
    async (level) => {
      const dataset = await importWhatsApp([file(smallZip(level))], "dmy-24h");
      expect(dataset.messages).toHaveLength(7);
      expect(dataset.metadata.source).toBe("zip");
      expect(dataset.metadata.ignoredAttachments).toBe(1);
    },
  );

  it("reads plain UTF-8 TXT and rejects malformed byte encoding", async () => {
    expect(
      (await importWhatsApp([file(strToU8(text), "chat.txt")], "dmy-24h"))
        .messages,
    ).toHaveLength(7);
    await expect(
      importWhatsApp(
        [file(new Uint8Array([0xff, 0xff]), "chat.txt")],
        "dmy-24h",
      ),
    ).rejects.toThrow(/valid UTF-8/);
  });

  it("selects exactly one TXT even with nested filenames; does not guess between chats/other text", async () => {
    const zip = zipSync({
      "a/chat.txt": strToU8(text),
      "b/readme.TXT": strToU8("Other text"),
    });
    await expect(importWhatsApp([file(zip)], "dmy-24h")).rejects.toThrow(
      /more than one TXT/,
    );
    await expect(
      importWhatsApp(
        [file(zipSync({ "photo.jpg": new Uint8Array([1]) }))],
        "dmy-24h",
      ),
    ).rejects.toThrow(/no chat TXT/);
    const duplicate = zipSync({
      "a.txt": strToU8(text),
      "b.txt": strToU8(text),
    });
    const offset = centralOffset(duplicate);
    const central = new DataView(duplicate.buffer, duplicate.byteOffset);
    const next =
      offset +
      46 +
      central.getUint16(offset + 28, true) +
      central.getUint16(offset + 30, true) +
      central.getUint16(offset + 32, true);
    duplicate[next + 46] = 97;
    await expect(importWhatsApp([file(duplicate)], "dmy-24h")).rejects.toThrow(
      /more than one TXT/,
    );
  });

  it("checks CRC against the published standard vector and detects altered plain payloads", async () => {
    expect(whatsappCrc32(strToU8("123456789"))).toBe(0xcbf43926);
    const bytes = smallZip(0),
      payload = new TextDecoder().decode(bytes).indexOf("Mira");
    bytes[payload] = 78;
    await expect(importWhatsApp([file(bytes)], "dmy-24h")).rejects.toThrow(
      /integrity/,
    );
  });

  it("rejects local/central filename or size disagreement", async () => {
    const name = smallZip();
    name[30] = 120;
    await expect(importWhatsApp([file(name)], "dmy-24h")).rejects.toThrow(
      /damaged/,
    );
    const size = smallZip();
    new DataView(size.buffer, size.byteOffset).setUint32(22, 1, true);
    await expect(importWhatsApp([file(size)], "dmy-24h")).rejects.toThrow(
      /damaged/,
    );
  });

  it("ignores a false EOCD signature within a valid ZIP comment", async () => {
    const bytes = zipSync({ "chat.txt": strToU8(text) }, { level: 0 });
    const output = new Uint8Array(bytes.length + 22);
    output.set(bytes);
    const view = new DataView(output.buffer);
    view.setUint16(bytes.length - 2, 22, true);
    view.setUint32(bytes.length, 0x06054b50, true);
    expect(
      (await importWhatsApp([file(output)], "dmy-24h")).messages,
    ).toHaveLength(7);
  });

  it.each([false, true])(
    "validates streamed ZIP descriptors with optional signature %s",
    async (signature) => {
      const { bytes } = withDescriptor(signature);
      expect(
        (await importWhatsApp([file(bytes)], "dmy-24h")).messages,
      ).toHaveLength(7);
    },
  );

  it("accepts a genuine fflate streaming ZIP and verifies its descriptor", async () => {
    const chunks: Uint8Array[] = [];
    const archive = new Zip((error, data) => {
      if (error) throw error;
      chunks.push(data);
    });
    const entry = new ZipDeflate("chat.txt");
    archive.add(entry);
    entry.push(strToU8(text), true);
    archive.end();
    const bytes = new Uint8Array(
      chunks.reduce((size, chunk) => size + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    expect(
      (await importWhatsApp([file(bytes)], "dmy-24h")).messages,
    ).toHaveLength(7);
  });

  it("rejects missing or altered streamed descriptors", async () => {
    const absent = zipSync({ "chat.txt": strToU8(text) }, { level: 0 }),
      view = new DataView(absent.buffer),
      central = centralOffset(absent);
    view.setUint16(6, 8, true);
    view.setUint32(14, 0, true);
    view.setUint32(18, 0, true);
    view.setUint32(22, 0, true);
    view.setUint16(central + 8, 8, true);
    await expect(importWhatsApp([file(absent)], "dmy-24h")).rejects.toThrow(
      /damaged/,
    );
    const altered = withDescriptor(true);
    altered.bytes[altered.descriptorOffset + 4] ^= 255;
    await expect(
      importWhatsApp([file(altered.bytes)], "dmy-24h"),
    ).rejects.toThrow(/damaged/);
  });

  it("validates local extra-field lengths and rejects local-only ZIP64", async () => {
    const bytes = zipSync({ "chat.txt": strToU8(text) }, { level: 0 });
    await expect(
      importWhatsApp(
        [file(withLocalExtra(bytes, new Uint8Array([0])))],
        "dmy-24h",
      ),
    ).rejects.toThrow(/damaged/);
    await expect(
      importWhatsApp(
        [file(withLocalExtra(bytes, new Uint8Array([2, 0, 9, 0])))],
        "dmy-24h",
      ),
    ).rejects.toThrow(/damaged/);
    await expect(
      importWhatsApp(
        [file(withLocalExtra(bytes, new Uint8Array([1, 0, 0, 0])))],
        "dmy-24h",
      ),
    ).rejects.toThrow(/ZIP64/);
    expect(
      (
        await importWhatsApp(
          [file(withLocalExtra(bytes, new Uint8Array([0x55, 0x54, 1, 0, 0])))],
          "dmy-24h",
        )
      ).messages,
    ).toHaveLength(7);
  });

  it.each(["encrypted", "ZIP64", "multipart", "method"])(
    "rejects unsupported %s ZIPs",
    async (kind) => {
      const bytes = smallZip(),
        view = new DataView(bytes.buffer, bytes.byteOffset),
        central = centralOffset(bytes);
      if (kind === "encrypted") view.setUint16(central + 8, 1, true);
      if (kind === "ZIP64") view.setUint32(central + 24, 0xffffffff, true);
      if (kind === "multipart") view.setUint16(bytes.length - 18, 1, true);
      if (kind === "method") view.setUint16(central + 10, 99, true);
      await expect(importWhatsApp([file(bytes)], "dmy-24h")).rejects.toThrow(
        /not supported/,
      );
    },
  );

  it("rejects forged expansion metadata before allocating or reading chat bytes", async () => {
    const bytes = smallZip(),
      view = new DataView(bytes.buffer, bytes.byteOffset);
    view.setUint32(
      centralOffset(bytes) + 24,
      WHATSAPP_LIMITS.textBytes + 1,
      true,
    );
    await expect(importWhatsApp([file(bytes)], "dmy-24h")).rejects.toThrow(
      /20 MB/,
    );
  });

  it("rejects expansion output beyond small forged metadata, without uncontrolled inflation", async () => {
    const bytes = zipSync({ "chat.txt": strToU8(text.repeat(100)) });
    const view = new DataView(bytes.buffer, bytes.byteOffset),
      central = centralOffset(bytes);
    view.setUint32(central + 24, 1, true);
    view.setUint32(22, 1, true);
    await expect(importWhatsApp([file(bytes)], "dmy-24h")).rejects.toThrow(
      /damaged/,
    );
  });

  it("reads only bounded slices rather than the entire media-rich ZIP", async () => {
    const bytes = zipSync(
      { "photo.jpg": new Uint8Array(200000), "chat.txt": strToU8(text) },
      { level: 0 },
    );
    let readBytes = 0;
    const blob = file(bytes);
    const guarded = {
      name: "chat.zip",
      size: blob.size,
      arrayBuffer() {
        throw new Error("Whole ZIP reads forbidden");
      },
      slice(start: number, end: number) {
        readBytes += end - start;
        return blob.slice(start, end);
      },
    } as unknown as WhatsAppNamedBlob;
    expect((await importWhatsApp([guarded], "dmy-24h")).messages).toHaveLength(
      7,
    );
    expect(readBytes).toBeLessThan(70000);
  });

  it("validates selection, type, sizes and static read errors before processing", async () => {
    expect(() => validateWhatsAppSelection([])).toThrow(/Choose one/);
    expect(() =>
      validateWhatsAppSelection([
        { name: "private.txt", size: 1 },
        { name: "private2.txt", size: 1 },
      ]),
    ).toThrow(/Choose one/);
    expect(() =>
      validateWhatsAppSelection([{ name: "private.json", size: 1 }]),
    ).toThrow(/unsupported/);
    expect(() =>
      validateWhatsAppSelection([{ name: "private.txt", size: 0 }]),
    ).toThrow(/empty/);
    expect(() =>
      validateWhatsAppSelection([
        { name: "private.txt", size: WHATSAPP_LIMITS.textBytes + 1 },
      ]),
    ).toThrow(/20 MB/);
    expect(() =>
      validateWhatsAppSelection([
        { name: "private.zip", size: WHATSAPP_LIMITS.zipBytes + 1 },
      ]),
    ).toThrow(/1 GB/);
    const broken = {
      name: "private.txt",
      size: 1,
      arrayBuffer: vi.fn().mockRejectedValue(new Error("PRIVATE DATA")),
    } as unknown as WhatsAppNamedBlob;
    await expect(importWhatsApp([broken], "dmy-24h")).rejects.toThrow(
      "This file could not be read",
    );
  });
});
