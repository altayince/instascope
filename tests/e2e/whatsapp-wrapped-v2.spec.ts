import { expect, test, type Locator, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const enabled = process.env.EXPECT_WHATSAPP === "true";
const wordLabel = "Include word-based insights in Wrapped";
const privateLabel = `Synthetic private sender ${"LongLabel".repeat(24)}`;
const secondLabel = "Another synthetic private sender";
const privateBody = "SYNTHETIC_BODY_MUST_STAY_LOCAL";
const forbidden =
  /Synthetic private sender|Another synthetic private sender|LongLabel|SYNTHETIC_BODY_MUST_STAY_LOCAL|synthetic-private\.invalid|secret-photo\.jpg|\+491234567890|52\.5200|13\.4050/;

// Fictional evidence only: nine dense sessions, qualifying long gaps, equal
// participant counts, three consecutive dates, media, emoji and repeated words.
function richChat(group = false) {
  const lines: string[] = [];
  for (let day = 14; day <= 16; day++) {
    for (let session = 0; session < 3; session++) {
      for (let minute = 0; minute < 6; minute++) {
        const sequence = (day - 14) * 18 + session * 6 + minute;
        const label = group
          ? `Synthetic group ${sequence % 10} ${"LongLabel".repeat(24)}`
          : (session + day + minute) % 2 === 0
            ? privateLabel
            : secondLabel;
        const text =
          sequence < 2
            ? "image omitted"
            : sequence === 2
              ? `${privateBody} https://synthetic-private.invalid/secret secret-photo.jpg +491234567890 52.5200, 13.4050`
              : "orchard orchard meadow meadow 😀";
        lines.push(
          `${day}/06/2026, ${String(session * 8).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00 - ${label}: ${text}`,
        );
      }
    }
  }
  return lines.join("\n");
}
const sparseChat = "14/06/2026, 08:00 - Synthetic sparse sender: orchard";
const soloChat = Array.from(
  { length: 5 },
  (_, index) =>
    `14/06/2026, 08:0${index} - Synthetic solo sender: orchard meadow`,
).join("\n");
const tiedGroup = Array.from(
  { length: 20 },
  (_, index) =>
    `14/06/2026, 08:${String(index).padStart(2, "0")} - Synthetic group ${index % 10} ${"LongLabel".repeat(24)}: orchard meadow`,
).join("\n");
function groupChat(participants: number) {
  return Array.from({ length: participants * 6 }, (_, index) => {
    const day = 14 + Math.floor(index / participants);
    const minute = String(index % participants).padStart(2, "0");
    const label = `Synthetic group ${index % participants} ${"LongLabel".repeat(24)}`;
    return `${day}/06/2026, 09:${minute}:00 - ${label}: orchard meadow`;
  }).join("\n");
}

type BrowserMetrics = {
  drawn: string[];
  events: unknown[];
  storageWrites: string[];
  databaseWrites: number;
  databaseOpens: number;
  parseRequests: number;
  shares: { name: string; active: boolean }[];
};
type WrappedWindow = Window & { wrappedMetrics: BrowserMetrics };

const deck = (page: Page) =>
  page.getByRole("region", { name: "WhatsApp Wrapped", exact: true });
const slide = (page: Page) => deck(page).locator(".wa-story");
const picker = (page: Page) =>
  deck(page).getByRole("group", { name: "Choose a Wrapped card", exact: true });
const choices = (page: Page) => picker(page).getByRole("button");
const status = (page: Page) => deck(page).getByTestId("wa-export-status");
const canvas = (page: Page) => deck(page).getByTestId("wa-story-canvas");
const downloadButton = (page: Page) =>
  deck(page).getByRole("button", { name: "Download PNG", exact: true });
const fullExportButton = (page: Page) =>
  deck(page).getByRole("button", { name: "Export full deck", exact: true });

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const metrics: BrowserMetrics = {
      drawn: [],
      events: [],
      storageWrites: [],
      databaseWrites: 0,
      databaseOpens: 0,
      parseRequests: 0,
      shares: [],
    };
    Object.assign(window, { wrappedMetrics: metrics });
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      metrics.drawn.push(String(args[0]));
      return originalFillText.apply(this, args);
    };
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      metrics.storageWrites.push(key);
      return originalSet.call(this, key, value);
    };
    const originalOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, version) {
      metrics.databaseOpens++;
      return version === undefined
        ? originalOpen.call(this, name)
        : originalOpen.call(this, name, version);
    };
    for (const method of ["put", "add"] as const) {
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (value, key) {
        metrics.databaseWrites++;
        return key === undefined
          ? original.call(this, value)
          : original.call(this, value, key);
      };
    }
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(
        message: unknown,
        options?: Transferable[] | StructuredSerializeOptions,
      ) {
        if (
          message &&
          typeof message === "object" &&
          "format" in message &&
          "files" in message
        )
          metrics.parseRequests++;
        if (Array.isArray(options)) super.postMessage(message, options);
        else super.postMessage(message, options);
      }
    } as typeof Worker;
    window.addEventListener("instascope:event", (event) =>
      metrics.events.push((event as CustomEvent).detail),
    );
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    });
  });
}
const metrics = (page: Page) =>
  page.evaluate(() => (window as unknown as WrappedWindow).wrappedMetrics);

async function acceptChat(page: Page, text = richChat()) {
  // Shared Instagram providers finish their empty legacy migration before
  // scoped Wrapped privacy baselines are captured in these isolated contexts.
  await page.waitForLoadState("networkidle");
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles({
      name: "synthetic-private-chat.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
  await expect(
    page.getByRole("region", { name: "Detected export format", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Export date/time format", { exact: true })
    .selectOption("dmy-24h");
  await page
    .getByRole("button", { name: "Confirm format and open chat", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Detected export format", exact: true }),
  ).toHaveCount(0);
  await expect(deck(page)).toBeVisible();
}

async function ready(page: Page) {
  await expect(downloadButton(page)).toBeEnabled();
  await expect(canvas(page)).toHaveAttribute("width", "1080");
  await expect(canvas(page)).toHaveAttribute("height", "1920");
}
function assertPng(bytes: Buffer | Uint8Array) {
  const buffer = Buffer.from(bytes);
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buffer.readUInt32BE(16)).toBe(1080);
  expect(buffer.readUInt32BE(20)).toBe(1920);
}
async function previewBytes(page: Page) {
  return Buffer.from(
    await canvas(page).evaluate(
      (element: HTMLCanvasElement) =>
        element.toDataURL("image/png").split(",")[1],
    ),
    "base64",
  );
}
async function holdNextEncoding(page: Page) {
  await page.evaluate(() => {
    Object.assign(window, { releaseWrappedEncoding: undefined });
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      HTMLCanvasElement.prototype.toBlob = original;
      original.call(
        this,
        (blob) => {
          Object.assign(window, {
            releaseWrappedEncoding: () => callback(blob),
          });
        },
        type,
        quality,
      );
    };
  });
}
async function encodingHeld(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (window as unknown as { releaseWrappedEncoding?: () => void })
            .releaseWrappedEncoding,
      ),
    )
    .toBe("function");
}
async function releaseEncoding(page: Page) {
  await page.evaluate(() =>
    (
      window as unknown as { releaseWrappedEncoding: () => void }
    ).releaseWrappedEncoding(),
  );
}
async function assertArtworkMatches(
  actual: Buffer,
  expected: Buffer,
  label?: string,
) {
  const [downloaded, preview] = await Promise.all([
    sharp(actual).ensureAlpha().raw().toBuffer(),
    sharp(expected).ensureAlpha().raw().toBuffer(),
  ]);
  expect(downloaded.equals(preview), label).toBe(true);
}
async function downloadPng(page: Page, action: Locator = downloadButton(page)) {
  const received = page.waitForEvent("download");
  await action.click();
  const result = await received;
  expect(result.suggestedFilename()).toMatch(/^whatsappscope-[a-z0-9-]+\.png$/);
  const bytes = await readFile((await result.path())!);
  assertPng(bytes);
  return bytes;
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function swipe(page: Page, dx: number, dy = 0) {
  await slide(page).dispatchEvent("touchstart", {
    touches: [{ identifier: 0, clientX: 180, clientY: 250 }],
  });
  await slide(page).dispatchEvent("touchend", {
    changedTouches: [{ identifier: 0, clientX: 180 + dx, clientY: 250 + dy }],
  });
}

test.describe("WhatsApp Wrapped V2", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");
  test.beforeEach(async ({ page }) => instrument(page));

  test("rich pair deck exposes every factual card, accessible methodology and identical portrait artwork", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page);
    await expect(choices(page)).toHaveCount(12);
    await expect(slide(page)).toHaveAttribute("data-story-mode", "pair");
    await expect(slide(page).locator(".wa-story-value > strong")).toHaveText(
      "54",
    );
    await expect(
      deck(page).getByLabel(wordLabel, { exact: true }),
    ).not.toBeChecked();
    await expect(deck(page).getByRole("status")).toHaveCount(1);
    await ready(page);
    expect(
      await page
        .getByRole("link", { name: "Skip to content", exact: true })
        .evaluate((element) => element.getBoundingClientRect().bottom),
    ).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: testInfo.outputPath("synthetic-pair-viewport.png"),
      animations: "disabled",
    });
    await page.evaluate(() =>
      window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
    );
    await page.screenshot({
      path: testInfo.outputPath("synthetic-pair-page.png"),
      fullPage: true,
      animations: "disabled",
    });
    await deck(page).screenshot({
      path: testInfo.outputPath("synthetic-pair-opening.png"),
      animations: "disabled",
    });
    const ids: string[] = [];
    const kinds = new Set<string>();
    for (let index = 0; index < 12; index++) {
      await choices(page).nth(index).click();
      await ready(page);
      const id = (await slide(page).getAttribute("data-story-id"))!;
      ids.push(id);
      kinds.add((await slide(page).getAttribute("data-story-kind"))!);
      await expect(slide(page)).toHaveAttribute(
        "aria-label",
        new RegExp(`^${index + 1} of 12:`),
      );
      await expect(deck(page).locator(".wa-deck-position")).toHaveAttribute(
        "aria-live",
        "polite",
      );
      const methodology = deck(page).locator(".wa-story-calculation");
      await expect(slide(page).locator(".wa-story-calculation")).toHaveCount(0);
      await expect(methodology.locator("summary")).toHaveText(
        "How this is calculated",
      );
      if ((await methodology.getAttribute("open")) === null) {
        await methodology.locator("summary").focus();
        await page.keyboard.press("Enter");
      }
      await expect(methodology).toHaveAttribute("open", "");
      await expect(methodology).toContainText(/Exact|Derived/);
      if (id === "sessions")
        await expect(methodology).toContainText(/greater than 30 minutes/);
      if (id === "silence-breakers")
        await expect(methodology).toContainText(/at least 6 hours/);
      if (id === "next-message")
        await expect(methodology).toContainText(/at most 5 minutes/);
      if (id === "message-patterns")
        await expect(methodology).toContainText(/inclusive rolling 10-minute/);
      await expect(slide(page).locator(".wa-story-text")).not.toBeEmpty();
      await expect(slide(page)).not.toContainText(/reply time|orchard|meadow/i);
      await expect(deck(page)).not.toContainText(forbidden);
      const bytes = await previewBytes(page);
      assertPng(bytes);
      if (id === "next-message")
        await slide(page).screenshot({
          path: testInfo.outputPath("synthetic-next-message.png"),
          animations: "disabled",
        });
      if (id === "conversation" || id === "media-emoji")
        await assertArtworkMatches(await downloadPng(page), bytes);
      await fits(page);
    }
    expect(ids).toEqual([
      "conversation",
      "participant-counts",
      "busiest-day",
      "busiest-hour",
      "active-streak",
      "sessions",
      "session-starters",
      "silence-breakers",
      "next-message",
      "message-patterns",
      "media-emoji",
      "closing",
    ]);
    expect(kinds).toEqual(
      new Set([
        "hero",
        "split",
        "timeline",
        "distribution",
        "rhythm",
        "patterns",
        "media",
        "closing",
      ]),
    );
    expect((await metrics(page)).drawn.join("\n")).not.toMatch(forbidden);
    expect((await metrics(page)).drawn.join("\n")).not.toMatch(
      /orchard|meadow/i,
    );
    await slide(page).screenshot({
      path: testInfo.outputPath("synthetic-closing.png"),
      animations: "disabled",
    });
    await slide(page).focus();
    await page.keyboard.press("Home");
    await expect(slide(page)).toHaveAttribute("aria-label", /^1 of 12:/);
    await expect(
      deck(page).getByRole("button", { name: "Previous card", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("ArrowRight");
    await expect(slide(page)).toHaveAttribute("aria-label", /^2 of 12:/);
    await page.keyboard.press("ArrowLeft");
    await expect(slide(page)).toHaveAttribute("aria-label", /^1 of 12:/);
    await swipe(page, -120);
    await expect(slide(page)).toHaveAttribute("aria-label", /^2 of 12:/);
    await swipe(page, 120);
    await expect(slide(page)).toHaveAttribute("aria-label", /^1 of 12:/);
    await swipe(page, -60, 100);
    await expect(slide(page)).toHaveAttribute("aria-label", /^1 of 12:/);
    await page.keyboard.press("End");
    await expect(slide(page)).toHaveAttribute("aria-label", /^12 of 12:/);
    await expect(
      deck(page).getByRole("button", { name: "Next card", exact: true }),
    ).toBeDisabled();
    await expect(
      deck(page).locator(".wa-deck-progress > span.is-seen"),
    ).toHaveCount(12);
  });

  test("group rankings bound the displayed participants, retain ties and fit long source labels", async ({
    page,
  }, testInfo) => {
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page, richChat(true));
    await expect(slide(page)).toHaveAttribute("data-story-mode", "group");
    await choices(page).filter({ hasText: "The contributors" }).click();
    await ready(page);
    await expect(slide(page)).toHaveAttribute("data-story-kind", "ranking");
    await expect(slide(page)).toContainText(
      "Top 4 shown; 6 additional labels not displayed.",
    );
    await expect(slide(page)).not.toContainText(/Synthetic group|LongLabel/);
    const aliases =
      (await slide(page).textContent())!.match(/Participant \d+/g) ?? [];
    expect(new Set(aliases).size).toBeLessThanOrEqual(4);
    expect(new Set(aliases).size).toBeGreaterThanOrEqual(3);
    await assertArtworkMatches(
      await downloadPng(page),
      await previewBytes(page),
    );
    await fits(page);
    await slide(page).screenshot({
      path: testInfo.outputPath("synthetic-group-ranking.png"),
      animations: "disabled",
    });
    await acceptChat(page, tiedGroup);
    await choices(page).filter({ hasText: "The contributors" }).click();
    await ready(page);
    await expect(slide(page)).toContainText(/tie|tied|share the lead/i);
    await expect(slide(page)).not.toContainText(/winner/i);
    await fits(page);
  });

  test("3, 8 and 24-label groups preserve anonymous ties, disclose timing truncation and export matching PNGs and a group deck", async ({
    page,
  }) => {
    await page.goto("/whatsapp/wrapped/");
    const groupPreviews = new Map<string, Buffer>();
    for (const participants of [3, 8, 24]) {
      await acceptChat(page, groupChat(participants));
      const count = participants * 6;
      await expect(slide(page)).toHaveAttribute("data-story-mode", "group");
      await choices(page).filter({ hasText: "The contributors" }).click();
      await ready(page);
      await expect(slide(page)).toContainText(
        `${participants} participants tie for the highest exported message count.`,
      );
      await expect(
        slide(page)
          .locator(".wa-story-facts > div")
          .filter({ hasText: "participant labels in the export" })
          .locator("strong"),
      ).toHaveText(String(participants));
      await expect(slide(page).locator(".wa-story-text > ul > li")).toHaveCount(
        Math.min(4, participants),
      );
      if (participants > 4) {
        await expect(slide(page)).toContainText(
          `Top 4 shown; ${participants - 4} additional labels not displayed. ${count} messages in total.`,
        );
      }
      await assertArtworkMatches(
        await downloadPng(page),
        await previewBytes(page),
      );
      if (participants === 24)
        groupPreviews.set("participant-counts", await previewBytes(page));
      await choices(page).filter({ hasText: "Next-message rhythm" }).click();
      await ready(page);
      await expect(slide(page)).toHaveAttribute("data-story-kind", "rhythm");
      if (participants > 4) {
        const remainder = `4 of ${participants} qualifying labels shown; ${participants - 4} not displayed.`;
        await expect(slide(page)).toContainText(remainder);
        expect((await metrics(page)).drawn.join(" ")).toContain(remainder);
      }
      await assertArtworkMatches(
        await downloadPng(page),
        await previewBytes(page),
      );
      if (participants === 24)
        groupPreviews.set("next-message", await previewBytes(page));
      await expect(slide(page)).not.toContainText(
        /Synthetic group|LongLabel|winner|reply time|response time/i,
      );
      await fits(page);
    }
    const cards = await choices(page).count();
    const received = page.waitForEvent("download");
    await fullExportButton(page).click();
    const result = await received;
    expect(result.suggestedFilename()).toBe("whatsappscope-wrapped-deck.zip");
    const entries = unzipSync(await readFile((await result.path())!));
    expect(Object.keys(entries)).toHaveLength(cards);
    for (const [name, bytes] of Object.entries(entries)) {
      assertPng(bytes);
      const preview = groupPreviews.get(name.slice(3, -4));
      if (preview)
        await assertArtworkMatches(Buffer.from(bytes), preview, name);
    }
    await expect(fullExportButton(page)).toBeEnabled();
    expect((await metrics(page)).drawn.join(" ")).not.toMatch(
      /Synthetic group|LongLabel|orchard|meadow/i,
    );
  });

  test("sparse and one-participant exports skip unsupported comparisons without inventing evidence", async ({
    page,
  }) => {
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page, sparseChat);
    await expect(choices(page)).toHaveCount(2);
    await expect(slide(page)).toHaveAttribute("data-story-mode", "solo");
    await expect(slide(page).locator(".wa-story-value > strong")).toHaveText(
      "1",
    );
    await expect(choices(page)).toHaveText([
      /The conversation/,
      /Your Wrapped/,
    ]);
    await ready(page);
    assertPng(await downloadPng(page));
    await acceptChat(page, soloChat);
    expect(await choices(page).count()).toBeLessThan(10);
    await expect(picker(page)).not.toContainText(
      /contributors|Started recorded sessions|Silence breakers|Next-message rhythm/,
    );
    await expect(slide(page)).not.toContainText(
      /Participant 2|winner|reply time/i,
    );
    await fits(page);
  });

  test("individual PNG readiness does not wait for Blob callbacks and rapid card changes keep the current PNG", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.assign(window, { individualWrappedBlobCalls: 0 });
      // Deliberately never invoke a callback. Individual preparation must not
      // enter this boundary at all; the separate ZIP encoder is not used here.
      HTMLCanvasElement.prototype.toBlob = function () {
        const probe = window as unknown as {
          individualWrappedBlobCalls: number;
        };
        probe.individualWrappedBlobCalls++;
      };
    });
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page);
    await expect(canvas(page)).toHaveAttribute("width", "1080");
    await expect(canvas(page)).toHaveAttribute("height", "1920");
    await expect(canvas(page)).toBeVisible();
    await ready(page);

    async function downloadCurrent(id: string) {
      await expect(slide(page)).toHaveAttribute("data-story-id", id);
      await ready(page);
      const expected = await previewBytes(page);
      assertPng(expected);
      const received = page.waitForEvent("download");
      await downloadButton(page).click();
      const downloaded = await received;
      expect(downloaded.suggestedFilename()).toBe(`whatsappscope-${id}.png`);
      const actual = await readFile((await downloaded.path())!);
      assertPng(actual);
      await assertArtworkMatches(actual, expected);
      expect(
        await page.evaluate(
          () =>
            (
              window as unknown as {
                individualWrappedBlobCalls: number;
              }
            ).individualWrappedBlobCalls,
        ),
      ).toBe(0);
      return actual;
    }

    const opening = await downloadCurrent("conversation");
    // Native clicks in one browser task leave earlier prepared state present
    // while multiple selected-card updates are requested. Only the final card
    // may supply the downloadable File; no sleeps or encoding callbacks help it.
    await picker(page).evaluate((element) => {
      const buttons = element.querySelectorAll<HTMLButtonElement>("button");
      buttons[1].click();
      buttons[2].click();
      buttons[3].click();
    });
    const hour = await downloadCurrent("busiest-hour");
    expect(hour.equals(opening)).toBe(false);
    await picker(page).evaluate((element) => {
      const buttons = element.querySelectorAll<HTMLButtonElement>("button");
      buttons[0].click();
      buttons[2].click();
      buttons[1].click();
    });
    const participants = await downloadCurrent("participant-counts");
    expect(participants.equals(opening)).toBe(false);
    expect(participants.equals(hour)).toBe(false);
    await expect(slide(page)).not.toContainText(forbidden);
    expect((await metrics(page)).drawn.join("\n")).not.toMatch(forbidden);
    expect((await metrics(page)).drawn.join("\n")).not.toMatch(
      /orchard|meadow/i,
    );
    await fits(page);
  });

  test("full deck exports one local ZIP with every portrait PNG, progress and locked duplicate actions", async ({
    page,
  }) => {
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page);
    await ready(page);
    const previews = new Map<string, Buffer>();
    for (let index = 0; index < (await choices(page).count()); index++) {
      await choices(page).nth(index).click();
      await ready(page);
      previews.set(
        `${String(index + 1).padStart(2, "0")}-${await slide(page).getAttribute("data-story-id")}.png`,
        await previewBytes(page),
      );
    }
    await choices(page).first().click();
    await ready(page);
    const before = await metrics(page);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    const downloads: string[] = [];
    page.on("download", (download) =>
      downloads.push(download.suggestedFilename()),
    );
    await page.evaluate(() => {
      const progress: string[] = [];
      Object.assign(window, { wrappedProgress: progress });
      const element = document.querySelector(
        '[data-testid="wa-export-status"]',
      )!;
      new MutationObserver(() =>
        progress.push(element.textContent ?? ""),
      ).observe(element, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    // Holding one card prevents fast encoding from racing the lock checks.
    await holdNextEncoding(page);
    const received = page.waitForEvent("download");
    await fullExportButton(page).click();
    await expect(status(page)).toHaveAttribute("data-deck-total", "12");
    await expect(status(page)).toHaveAttribute("data-deck-progress", "0");
    await expect(fullExportButton(page)).toBeDisabled();
    await expect(downloadButton(page)).toBeDisabled();
    await expect(
      deck(page).getByLabel(wordLabel, { exact: true }),
    ).toBeDisabled();
    await expect(choices(page).first()).toBeDisabled();
    // Native disabled controls must ignore attempts to start duplicate work.
    await fullExportButton(page).evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await encodingHeld(page);
    await releaseEncoding(page);
    const result = await received;
    expect(result.suggestedFilename()).toBe("whatsappscope-wrapped-deck.zip");
    const entries = unzipSync(await readFile((await result.path())!));
    expect(Object.keys(entries)).toHaveLength(12);
    expect(
      Object.keys(entries).every((name) =>
        /^\d{2}-[a-z0-9-]+\.png$/.test(name),
      ),
    ).toBe(true);
    for (const [name, bytes] of Object.entries(entries)) {
      assertPng(bytes);
      expect(previews.has(name)).toBe(true);
      await assertArtworkMatches(Buffer.from(bytes), previews.get(name)!, name);
    }
    await expect(fullExportButton(page)).toBeEnabled();
    await expect(status(page)).toContainText(
      /12.*PNG|12.*cards|deck.*download/i,
    );
    const progress = await page.evaluate(
      () =>
        (window as unknown as { wrappedProgress: string[] }).wrappedProgress,
    );
    expect(
      progress.some((text) => /Preparing deck: \d+ \/ 12 cards/.test(text)),
    ).toBe(true);
    expect(downloads).toEqual(["whatsappscope-wrapped-deck.zip"]);
    expect(requests).toEqual([]);
    const after = await metrics(page);
    expect(after.parseRequests).toBe(before.parseRequests);
    expect(after.storageWrites).toEqual(before.storageWrites);
    expect(after.databaseOpens).toBe(before.databaseOpens);
    expect(after.databaseWrites).toBe(before.databaseWrites);
    expect(before.events).toEqual([{ event: "document_entry_observed" }]);
    expect(after.events).toEqual(before.events);
    expect(after.drawn.join("\n")).not.toMatch(forbidden);
    expect(after.drawn.join("\n")).not.toMatch(/orchard|meadow/i);
    expect(page.url()).toBe("http://127.0.0.1:3000/whatsapp/wrapped/");
  });

  test("local PNG download failures are actionable and both download and unsupported-share paths can retry", async ({
    page,
  }) => {
    const errors: string[] = [];
    const downloads: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("download", (result) => downloads.push(result.suggestedFilename()));
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page, sparseChat);
    await ready(page);
    const expected = await previewBytes(page);
    const actions = [
      downloadButton(page),
      deck(page).getByRole("button", { name: "Share card", exact: true }),
    ];
    for (const [index, action] of actions.entries()) {
      await page.evaluate(() => {
        const create = URL.createObjectURL;
        Object.assign(window, {
          restoreWrappedDownload: () => {
            URL.createObjectURL = create;
          },
        });
        URL.createObjectURL = () => {
          throw new DOMException(
            "SYNTHETIC_DOWNLOAD_FAILURE_MUST_NOT_BE_SHOWN",
            "SecurityError",
          );
        };
      });
      await action.click();
      await expect(status(page)).toContainText("PNG download could not start");
      await expect(status(page)).toContainText("Your card is still ready");
      await expect(status(page)).not.toContainText(
        /downloaded|SYNTHETIC_DOWNLOAD_FAILURE/,
      );
      await ready(page);
      await expect(fullExportButton(page)).toBeEnabled();
      await expect(choices(page).first()).toBeEnabled();
      expect(downloads).toHaveLength(index);
      await page.evaluate(() =>
        (
          window as unknown as { restoreWrappedDownload: () => void }
        ).restoreWrappedDownload(),
      );
      const actual = await downloadPng(page, action);
      assertPng(actual);
      await assertArtworkMatches(actual, expected);
      await expect(status(page)).toContainText(/downloaded/);
    }
    expect(downloads).toEqual([
      "whatsappscope-conversation.png",
      "whatsappscope-conversation.png",
    ]);
    expect(errors).toEqual([]);
    await fits(page);
  });

  test("a failed deck encoder releases controls for individual PNGs and a successful ZIP retry", async ({
    page,
  }) => {
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page, sparseChat);
    await ready(page);
    const expected = await previewBytes(page);
    await page.evaluate(() => {
      const encode = HTMLCanvasElement.prototype.toBlob;
      Object.assign(window, {
        restoreWrappedDeckEncoder: () => {
          HTMLCanvasElement.prototype.toBlob = encode;
        },
      });
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        callback(null);
      };
    });
    await fullExportButton(page).click();
    await expect(status(page)).toContainText(
      "Full-deck export could not finish. Try downloading individual PNG cards.",
    );
    await expect(status(page)).not.toHaveAttribute("data-deck-progress");
    await expect(fullExportButton(page)).toBeEnabled();
    await expect(choices(page).first()).toBeEnabled();
    await ready(page);
    await assertArtworkMatches(await downloadPng(page), expected);
    await page.evaluate(() =>
      (
        window as unknown as { restoreWrappedDeckEncoder: () => void }
      ).restoreWrappedDeckEncoder(),
    );
    const received = page.waitForEvent("download");
    await fullExportButton(page).click();
    const result = await received;
    expect(result.suggestedFilename()).toBe("whatsappscope-wrapped-deck.zip");
    const entries = unzipSync(await readFile((await result.path())!));
    expect(Object.keys(entries)).toEqual([
      "01-conversation.png",
      "02-closing.png",
    ]);
    for (const bytes of Object.values(entries)) assertPng(bytes);
    await expect(fullExportButton(page)).toBeEnabled();
    await expect(status(page)).toContainText("2 portrait PNGs in one ZIP");
    await fits(page);
  });

  test("native share receives an already prepared PNG during user activation and cancellation keeps it ready", async ({
    page,
  }) => {
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page);
    await ready(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: (data: ShareData) => {
          (window as unknown as WrappedWindow).wrappedMetrics.shares.push({
            name: data.files?.[0]?.name ?? "",
            active: navigator.userActivation.isActive,
          });
          return new Promise<void>((resolve, reject) =>
            Object.assign(window, {
              cancelWrappedShare: () =>
                reject(new DOMException("Cancelled", "AbortError")),
              finishWrappedShare: resolve,
            }),
          );
        },
      });
    });
    await deck(page)
      .getByRole("button", { name: "Share card", exact: true })
      .click();
    await expect.poll(async () => (await metrics(page)).shares.length).toBe(1);
    expect((await metrics(page)).shares[0]).toMatchObject({ active: true });
    expect((await metrics(page)).shares[0].name).toMatch(
      /^whatsappscope-[a-z0-9-]+\.png$/,
    );
    await expect(fullExportButton(page)).toBeDisabled();
    await expect(choices(page).first()).toBeDisabled();
    await page.evaluate(() =>
      (
        window as unknown as { cancelWrappedShare: () => void }
      ).cancelWrappedShare(),
    );
    await expect(status(page)).toContainText("Sharing cancelled");
    await ready(page);
    await page.evaluate(() =>
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => false,
      }),
    );
    const expected = await previewBytes(page);
    await assertArtworkMatches(
      await downloadPng(
        page,
        deck(page).getByRole("button", { name: "Share card", exact: true }),
      ),
      expected,
    );
    await expect(status(page)).toContainText("Your PNG was downloaded");
  });

  test("fictional demo exports visibly labelled anonymous PNGs and a generic local deck ZIP", async ({
    page,
  }) => {
    await page.goto("/whatsapp/wrapped/");
    await page.waitForLoadState("networkidle");
    const before = await metrics(page);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page
      .getByRole("button", { name: "Try the fictional demo", exact: true })
      .click();
    await ready(page);
    await expect(slide(page)).toContainText("Fictional demo data");
    await expect(
      deck(page).getByLabel(wordLabel, { exact: true }),
    ).not.toBeChecked();
    await expect(picker(page)).not.toContainText(/word/i);
    const receivedPng = page.waitForEvent("download");
    await downloadButton(page).click();
    const png = await receivedPng;
    expect(png.suggestedFilename()).toBe("whatsappscope-demo-conversation.png");
    await assertArtworkMatches(
      await readFile((await png.path())!),
      await previewBytes(page),
    );
    const count = await choices(page).count();
    expect(count).toBeGreaterThanOrEqual(10);
    expect(count).toBeLessThanOrEqual(12);
    const receivedZip = page.waitForEvent("download");
    await fullExportButton(page).click();
    const zip = await receivedZip;
    expect(zip.suggestedFilename()).toBe("whatsappscope-demo-deck.zip");
    const entries = unzipSync(await readFile((await zip.path())!));
    expect(Object.keys(entries)).toHaveLength(count);
    for (const bytes of Object.values(entries)) assertPng(bytes);
    const after = await metrics(page);
    expect(after.drawn.join("\n")).toMatch(/fictional demo data/i);
    expect(after.drawn.join("\n")).not.toMatch(
      /Mira|Rowan|Jules|example\.org|winter project/i,
    );
    expect(after.parseRequests).toBe(before.parseRequests);
    expect(after.storageWrites).toEqual(before.storageWrites);
    expect(after.databaseOpens).toBe(before.databaseOpens);
    expect(after.databaseWrites).toBe(before.databaseWrites);
    expect(before.events).toEqual([{ event: "document_entry_observed" }]);
    expect(after.events).toEqual(before.events);
    expect(requests).toEqual([]);
    await fits(page);
  });

  test("clearing the source during deck export cancels stale downloads before a new accepted chat", async ({
    page,
  }) => {
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page);
    await ready(page);
    const downloads: string[] = [];
    page.on("download", (item) => downloads.push(item.suggestedFilename()));
    // Resolve an old encoder only after its source was revoked and replaced.
    await holdNextEncoding(page);
    await fullExportButton(page).click();
    await encodingHeld(page);
    await page.getByRole("button", { name: "Clear chat", exact: true }).click();
    await expect(deck(page)).toHaveCount(0);
    await acceptChat(page, sparseChat);
    await ready(page);
    await expect(slide(page).locator(".wa-story-value > strong")).toHaveText(
      "1",
    );
    const drawnBeforeRelease = (await metrics(page)).drawn.length;
    await releaseEncoding(page);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect((await metrics(page)).drawn).toHaveLength(drawnBeforeRelease);
    expect(downloads).toEqual([]);
    await assertArtworkMatches(
      await downloadPng(page),
      await previewBytes(page),
    );
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/\.png$/);
  });

  test("word insights enter artwork only after opt-in and revocation or accepted replacement clears prepared words", async ({
    page,
  }) => {
    await page.goto("/whatsapp/wrapped/");
    await acceptChat(page);
    await ready(page);
    const checkbox = deck(page).getByLabel(wordLabel, { exact: true });
    const before = await metrics(page);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await expect(checkbox).not.toBeChecked();
    await expect(picker(page)).not.toContainText(/word/i);
    expect((await metrics(page)).drawn.join("\n")).not.toMatch(
      /orchard|meadow/i,
    );
    await checkbox.check();
    await expect(deck(page)).toContainText(/generated locally|locally/i);
    await expect(deck(page)).toContainText(/message text/i);
    await expect(deck(page)).toContainText(/PNG.*words|words.*PNG/i);
    const wordChoice = choices(page).filter({ hasText: /word/i });
    await expect(wordChoice).toHaveCount(1);
    expect(await choices(page).count()).toBeLessThanOrEqual(12);
    await wordChoice.click();
    await ready(page);
    await expect(slide(page)).toHaveAttribute("data-story-kind", "word");
    await expect(slide(page)).toContainText(/orchard|meadow/i);
    expect((await metrics(page)).drawn.join("\n")).toMatch(/orchard|meadow/i);
    await assertArtworkMatches(
      await downloadPng(page),
      await previewBytes(page),
    );
    const methodology = deck(page).locator(".wa-story-calculation");
    await methodology.locator("summary").click();
    await expect(methodology).toContainText(/Unicode|stopword/);
    await page.evaluate(() => {
      (window as unknown as WrappedWindow).wrappedMetrics.drawn = [];
    });
    await checkbox.uncheck();
    await ready(page);
    await expect(picker(page)).not.toContainText(/word/i);
    await expect(slide(page)).not.toContainText(/orchard|meadow/i);
    await assertArtworkMatches(
      await downloadPng(page),
      await previewBytes(page),
    );
    expect((await metrics(page)).drawn.join("\n")).not.toMatch(
      /orchard|meadow/i,
    );
    const after = await metrics(page);
    expect(after.parseRequests).toBe(before.parseRequests);
    expect(after.storageWrites).toEqual(before.storageWrites);
    expect(after.databaseOpens).toBe(before.databaseOpens);
    expect(after.databaseWrites).toBe(before.databaseWrites);
    expect(before.events).toEqual([{ event: "document_entry_observed" }]);
    expect(after.events).toEqual(before.events);
    expect(requests).toEqual([]);
    await checkbox.check();
    await wordChoice.click();
    await ready(page);
    await acceptChat(page, sparseChat);
    await expect(checkbox).not.toBeChecked();
    await expect(choices(page)).toHaveCount(2);
    await expect(slide(page)).not.toContainText(/orchard|meadow/i);
    await ready(page);
    await assertArtworkMatches(
      await downloadPng(page),
      await previewBytes(page),
    );
    await page.reload();
    await expect(deck(page)).toHaveCount(0);
  });

  for (const failure of ["context", "encoding"] as const) {
    test(`canvas ${failure} failure retains readable accessible source facts and reports export limits`, async ({
      page,
    }) => {
      await page.goto("/whatsapp/wrapped/");
      await acceptChat(page);
      await ready(page);
      await page.evaluate((failure) => {
        if (failure === "context")
          HTMLCanvasElement.prototype.getContext = (() =>
            null) as typeof HTMLCanvasElement.prototype.getContext;
        else
          HTMLCanvasElement.prototype.toDataURL = () => {
            throw new DOMException(
              "Synthetic PNG encoding failure",
              "SecurityError",
            );
          };
      }, failure);
      await choices(page).nth(1).click();
      await expect(status(page)).toContainText(/unavailable|could not|cannot/i);
      await expect(slide(page).locator(".wa-story-text")).not.toBeEmpty();
      if (failure === "context")
        await expect(slide(page).locator(".wa-story-text")).toBeVisible();
      await expect(slide(page)).toContainText("Participant 1");
      await expect(downloadButton(page)).toBeDisabled();
      await expect(page.locator(".wa-current-chat")).toContainText(
        "54 messages",
      );
      await expect(slide(page)).not.toContainText(forbidden);
      await fits(page);
    });
  }
});
