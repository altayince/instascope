import { test, expect, type Page } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import { readFile } from "node:fs/promises";
import { upload } from "../helpers/vault";

const enabled = process.env.EXPECT_WHATSAPP === "true";
const privateName = `Private participant ${"longname".repeat(18)}`;
const source = [
  "31/12/2024, 23:58 - Messages are encrypted.",
  `31/12/2024, 23:59 - ${privateName}: PRIVATE_MESSAGE_CONTENT`,
  "01/01/2025, 00:01 - Second private label: Happy new year 😀",
  `01/01/2025, 10:00 - ${privateName}: <Media omitted>`,
  "02/01/2025, 11:00 - Second private label: https://private.invalid/secret",
  `03/01/2025, 09:00 - ${privateName}: <script>window.privateChatExecuted = true</script>`,
  "07/01/2025, 20:00 - Second private label: Last recorded line",
].join("\n");
const txt = (text = source) => ({
  name: "chat.txt",
  mimeType: "text/plain",
  buffer: Buffer.from(text),
});
async function openChat(page: Page, file = txt()) {
  await page
    .getByLabel("Export date/time format", { exact: true })
    .selectOption("dmy-24h");
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles(file);
  await expect(
    page
      .locator(".wa-stat")
      .filter({ hasText: "Exported messages" })
      .locator("strong"),
  ).toHaveText("6");
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function switchPlatform(page: Page, name: "Instagram" | "WhatsApp") {
  const selector = page.locator(".social-switcher");
  await selector.locator("summary").click();
  await selector.getByRole("link", { name: new RegExp(`^${name}`) }).click();
}

test("release build keeps WhatsApp routes and switcher invisible", async ({
  page,
  request,
}) => {
  test.skip(
    enabled,
    "Enabled preview is tested separately from release isolation.",
  );
  await page.goto("/");
  await expect(page.locator(".social-switcher")).toHaveCount(0);
  await expect(page.locator('a[href^="/whatsapp/"]')).toHaveCount(0);
  for (const route of [
    "/whatsapp/",
    "/whatsapp/chat-analyzer/",
    "/whatsapp/wrapped/",
  ])
    expect((await request.get(route)).status(), route).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "whatsapp",
  );
});

test.describe("WhatsAppScope enabled preview", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");

  test("platform switcher changes scoped theme and navigation with native accessible dismissal", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Try demo", exact: true }),
    ).toBeEnabled();
    const instagram = await page
      .locator(".platform-shell")
      .evaluate((node) =>
        getComputedStyle(node).getPropertyValue("--accent-strong"),
      );
    const selector = page.locator(".social-switcher");
    const summary = selector.locator("summary");
    await expect(summary).toHaveAccessibleName(/currently Instagram/);
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(selector).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(selector).not.toHaveAttribute("open");
    await expect(summary).toBeFocused();
    await summary.click();
    await page.locator("main h1").click();
    await expect(selector).not.toHaveAttribute("open");
    await switchPlatform(page, "WhatsApp");
    await expect(page).toHaveURL(/\/whatsapp\/$/);
    await expect(summary).toHaveAccessibleName(/currently WhatsApp/);
    await expect(selector).not.toHaveAttribute("open");
    await expect(page.locator(".platform-shell")).toHaveAttribute(
      "data-platform",
      "whatsapp",
    );
    expect(
      await page
        .locator(".platform-shell")
        .evaluate((node) =>
          getComputedStyle(node).getPropertyValue("--accent-strong"),
        ),
    ).not.toBe(instagram);
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link"),
    ).toHaveText(["Overview", "Chat Analyzer", "Wrapped"]);
    await expect(page.locator(".site-header")).not.toContainText(
      /Snapshot Vault|Followers Analyzer|Connection Privacy/,
    );
    for (const route of [
      "/whatsapp/",
      "/whatsapp/chat-analyzer/",
      "/whatsapp/wrapped/",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
      expect(await page.title()).toContain("WhatsAppScope");
      await fits(page);
    }
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
      "whatsapp",
    );
  });

  test("native platform selection opened before hydration stays open until navigation or dismissal", async ({
    page,
  }) => {
    let release!: () => void;
    const scripts = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/_next/static/**/*.js", async (route) => {
      await scripts;
      await route.continue();
    });
    await page.goto("/", { waitUntil: "commit" });
    const selector = page.locator(".social-switcher");
    try {
      await selector.locator("summary").click();
      await expect(selector).toHaveAttribute("open", "");
    } finally {
      release();
    }
    await expect(
      page.getByRole("button", { name: "Try demo", exact: true }),
    ).toBeEnabled();
    await expect(selector).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(selector).not.toHaveAttribute("open");
    await expect(selector.locator("summary")).toBeFocused();
  });

  test("chat import controls wait for their browser handlers before enabling", async ({
    page,
  }) => {
    let release!: () => void;
    const scripts = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/_next/static/**/*.js", async (route) => {
      await scripts;
      await route.continue();
    });
    await page.goto("/whatsapp/", { waitUntil: "commit" });
    const format = page.getByLabel("Export date/time format", { exact: true });
    try {
      await expect(format).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Try the fictional demo" }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Try a fictional demo" }),
      ).toBeDisabled();
    } finally {
      release();
    }
    await expect(format).toBeEnabled();
    await page.getByRole("button", { name: "Try a fictional demo" }).click();
    await expect(page).toHaveURL(/\/whatsapp\/chat-analyzer\/$/);
    await expect(
      page
        .locator(".wa-stat")
        .filter({ hasText: "Exported messages" })
        .locator("strong"),
    ).toHaveText("24");
  });

  test("TXT import yields factual metrics, preserves local state and sends no chat data", async ({
    page,
  }) => {
    const outgoing: string[] = [];
    await page.addInitScript(() => {
      Object.assign(window, { privateChatExecuted: false });
      const local: unknown[] = [];
      Object.assign(window, { waProductEvents: local });
      window.addEventListener("instascope:event", (event) =>
        local.push((event as CustomEvent).detail),
      );
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        request.method() === "POST" ||
        (url.origin !== "http://127.0.0.1:3000" && url.protocol !== "blob:")
      )
        outgoing.push(request.url());
    });
    await page.goto("/whatsapp/chat-analyzer/");
    await expect(
      page.getByRole("button", { name: "Open chat export" }),
    ).toBeDisabled();
    await openChat(page);
    for (const [label, value] of [
      ["Participants", "2"],
      ["Active dates", "5"],
      ["Calendar days covered", "8"],
    ])
      await expect(
        page.locator(".wa-stat").filter({ hasText: label }).locator("strong"),
      ).toHaveText(value);
    await expect(
      page.getByRole("heading", { name: "Messages by participant" }),
    ).toBeVisible();
    await expect(page.locator(".wa-participants")).toContainText(privateName);
    await expect(page.locator(".wa-small-facts")).toContainText("4 dates");
    await expect(page.locator(".wa-recorded-times")).toContainText(
      "2024-12-31 · 23:59",
    );
    await expect(page.locator(".wa-recorded-times")).toContainText(
      "2025-01-07 · 20:00",
    );
    for (const [label, count] of [
      ["Recognized media placeholders", "1"],
      ["HTTP(S) link occurrences", "1"],
      ["Recorded system events", "1"],
    ])
      await expect(
        page
          .locator(".wa-extra-counts > div")
          .filter({ hasText: label })
          .locator("dd"),
      ).toHaveText(count);
    await expect(page.locator("main")).toContainText(
      "without an inferred timezone",
    );
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { privateChatExecuted: boolean })
            .privateChatExecuted,
      ),
    ).toBe(false);
    await fits(page);
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Wrapped", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "WhatsApp Wrapped" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Chat Analyzer", exact: true })
      .click();
    await expect(
      page
        .locator(".wa-stat")
        .filter({ hasText: "Exported messages" })
        .locator("strong"),
    ).toHaveText("6");
    expect(outgoing).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { waProductEvents: unknown[] }).waProductEvents,
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((key) => /whatsapp|chat/i.test(key)),
      ),
    ).toEqual([]);
    await page.reload();
    await expect(page.locator(".wa-stat")).toHaveCount(0);
  });

  test("ZIP import ignores media and rejects ambiguous, damaged and unsupported input with recovery", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    const zip = {
      name: "chat.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(
        zipSync({
          "chat/chat.txt": strToU8(source),
          "media/photo.jpg": new Uint8Array(32),
        }),
      ),
    };
    await openChat(page, zip);
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles({
        name: "many.zip",
        mimeType: "application/zip",
        buffer: Buffer.from(
          zipSync({ "one.txt": strToU8(source), "two.txt": strToU8(source) }),
        ),
      });
    const error = page
      .getByRole("alert")
      .filter({ hasText: /exactly one|multiple|more than one/i });
    await expect(error).toBeVisible();
    await expect(
      page
        .locator(".wa-stat")
        .filter({ hasText: "Exported messages" })
        .locator("strong"),
    ).toHaveText("6");
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles({ ...zip, buffer: zip.buffer.subarray(0, 40) });
    await expect(page.locator(".wa-error")).toBeVisible();
    for (const file of [
      txt("13/10/26, 9:00 - Name: unsupported year"),
      txt("31/02/2025, 09:00 - Name: impossible date"),
      txt("not an export"),
    ]) {
      await page
        .getByLabel("Upload WhatsApp chat export", { exact: true })
        .setInputFiles(file);
      await expect(page.locator(".wa-error")).toBeVisible();
    }
    await openChat(page);
    await expect(page.locator(".wa-error")).toHaveCount(0);
  });

  test("Wrapped cards are anonymous, keyboard navigable and locally export true portrait PNGs", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const text: string[] = [];
      Object.assign(window, { waDrawnText: text, waShares: [] });
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (...args) {
        text.push(String(args[0]));
        return original.apply(this, args);
      };
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          (window as unknown as { waShares: string[] }).waShares.push(
            data.files?.[0].name ?? "",
          );
        },
      });
    });
    await page.goto("/whatsapp/chat-analyzer/");
    await openChat(page);
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Wrapped", exact: true })
      .click();
    const deck = page.getByRole("region", { name: "WhatsApp Wrapped" });
    const choices = deck
      .getByRole("group", { name: "Choose a Wrapped card" })
      .getByRole("button");
    await expect(choices).toHaveCount(7);
    for (let index = 0; index < (await choices.count()); index++) {
      await choices.nth(index).click();
      const action = deck.getByRole("button", { name: "Download PNG" });
      await expect(action).toBeEnabled();
      const received = page.waitForEvent("download");
      await action.click();
      const file = await received;
      const bytes = await readFile((await file.path())!);
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(bytes.readUInt32BE(16)).toBe(1080);
      expect(bytes.readUInt32BE(20)).toBe(1920);
      expect(file.suggestedFilename()).toMatch(/^whatsappscope-[a-z-]+\.png$/);
    }
    const drawn = await page.evaluate(() =>
      (window as unknown as { waDrawnText: string[] }).waDrawnText.join("\n"),
    );
    expect(drawn).not.toMatch(
      /Private participant|Second private label|PRIVATE_MESSAGE_CONTENT|private\.invalid|<script>/,
    );
    await expect(deck).not.toContainText(privateName);
    const slide = deck.getByRole("group", { name: /of \d+:/ });
    await slide.focus();
    await page.keyboard.press("Home");
    await expect(slide).toHaveAttribute("aria-label", /^1 of/);
    await page.keyboard.press("ArrowRight");
    await expect(slide).toHaveAttribute("aria-label", /^2 of/);
    await deck.getByRole("button", { name: "Share card", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { waShares: string[] }).waShares.length,
        ),
      )
      .toBe(1);
    await page.evaluate(() =>
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          throw new DOMException("Cancelled", "AbortError");
        },
      }),
    );
    await deck.getByRole("button", { name: "Share card", exact: true }).click();
    await expect(deck.getByRole("status")).toContainText("Sharing cancelled");
    await page.evaluate(() =>
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => false,
      }),
    );
    const fallbackDownload = page.waitForEvent("download");
    await deck.getByRole("button", { name: "Share card", exact: true }).click();
    expect((await fallbackDownload).suggestedFilename()).toMatch(
      /^whatsappscope-/,
    );
    await expect(deck.getByRole("status")).toContainText(
      "Your PNG was downloaded",
    );
    await fits(page);
  });

  test("a new accepted chat resets paginated participant results", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await page
      .getByLabel("Export date/time format", { exact: true })
      .selectOption("dmy-24h");
    const records = (many: boolean) =>
      Array.from(
        { length: 9 },
        (_, index) =>
          `01/01/2025, 09:00 - ${many ? `Label ${index + 1}` : "Replacement label"}: Message`,
      ).join("\n");
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles(txt(records(true)));
    const participants = page.locator(".wa-participants");
    await expect(participants.locator(".wa-participant-row")).toHaveCount(8);
    await participants
      .getByRole("button", { name: "Next participants" })
      .click();
    await expect(participants.locator(".wa-participant-row")).toHaveCount(1);
    await expect(participants).toContainText("Label 9");
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles(txt(records(false)));
    await expect(participants.locator(".wa-participant-row")).toHaveCount(1);
    await expect(participants).toContainText("Replacement label");
    await expect(
      participants.getByRole("button", { name: "Next participants" }),
    ).toHaveCount(0);
    await fits(page);
  });

  test("second-precision source clocks retain sub-minute gaps", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await page
      .getByLabel("Export date/time format", { exact: true })
      .selectOption("dmy-24h");
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles(
        txt(
          "[01/01/2025, 09:00:00] First: hello\n[01/01/2025, 09:00:30] Second: hello",
        ),
      );
    await expect(page.locator(".wa-recorded-times")).toContainText(
      "0 d 0 h 0 min 30 s",
    );
    await expect(page.locator(".wa-small-facts")).toContainText(
      "0 h 0 min 30 s",
    );
    await expect(page.locator(".wa-recorded-span")).toContainText(
      "second precision",
    );
    await fits(page);
  });

  test("long yearly and monthly charts keep all values reachable without rendering an unbounded list", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await page
      .getByLabel("Export date/time format", { exact: true })
      .selectOption("dmy-24h");
    const text = Array.from(
      { length: 26 },
      (_, index) => `01/01/${2000 + index}, 09:00 - Synthetic label: Hello`,
    ).join("\n");
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles(txt(text));
    const years = page.locator(".wa-years-panel");
    await expect(years.locator(".wa-chart-column")).toHaveCount(24);
    await years
      .getByRole("button", { name: "Next values", exact: true })
      .click();
    await expect(years.locator(".wa-chart-column")).toHaveCount(2);
    await expect(years).toContainText("2024");
    await expect(years).toContainText("2025");
    await years.getByText("Read chart values", { exact: true }).click();
    await expect(years.locator(".wa-chart-data li")).toHaveCount(2);
    const months = page.locator(".wa-months-panel");
    await expect(months.locator(".wa-chart-column")).toHaveCount(12);
    await months
      .getByRole("button", { name: "All recorded months", exact: true })
      .click();
    await expect(months.locator(".wa-chart-column")).toHaveCount(24);
    await months
      .getByRole("button", { name: "Next values", exact: true })
      .click();
    await expect(months.locator(".wa-chart-column")).toHaveCount(2);
    await months
      .getByRole("button", { name: "Latest 12 months", exact: true })
      .click();
    await expect(months.locator(".wa-chart-column")).toHaveCount(12);
    await fits(page);
  });

  test("clearing a pending replacement terminates its reader and allows a fresh chat", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const metrics = { pending: 0, terminated: 0 };
      Object.assign(window, { waWorkers: metrics });
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        held = false;
        postMessage(message: unknown) {
          if (
            message &&
            typeof message === "object" &&
            "format" in message &&
            "files" in message
          ) {
            this.held = true;
            metrics.pending++;
          } else super.postMessage(message);
        }
        terminate() {
          if (this.held) {
            metrics.pending--;
            metrics.terminated++;
            this.held = false;
          }
          super.terminate();
        }
      } as typeof Worker;
    });
    await page.goto("/whatsapp/chat-analyzer/");
    await page.getByRole("button", { name: "Try the fictional demo" }).click();
    await page
      .getByLabel("Export date/time format", { exact: true })
      .selectOption("dmy-24h");
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles(txt());
    await expect(page.locator(".wa-import-panel")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { waWorkers: { pending: number } }).waWorkers
              .pending,
        ),
      )
      .toBe(1);
    await page.getByRole("button", { name: "Clear chat", exact: true }).click();
    await expect(page.locator(".wa-stat")).toHaveCount(0);
    await expect(page.locator(".wa-import-panel")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(
      await page.evaluate(
        () => (window as unknown as { waWorkers: unknown }).waWorkers,
      ),
    ).toEqual({ pending: 0, terminated: 1 });
    await page.getByRole("button", { name: "Try the fictional demo" }).click();
    await expect(
      page
        .locator(".wa-stat")
        .filter({ hasText: "Exported messages" })
        .locator("strong"),
    ).toHaveText("24");
    await expect(page.locator(".wa-error")).toHaveCount(0);
  });

  test("fictional demo and platform switches keep Instagram and WhatsApp data independent", async ({
    page,
  }) => {
    await page.goto("/followers-analyzer/");
    await upload(page);
    await expect(page.locator(".stats-grid")).toBeVisible();
    await switchPlatform(page, "WhatsApp");
    await page.getByRole("button", { name: "Try the fictional demo" }).click();
    await expect(page.locator("main")).toContainText("Fictional");
    await expect(page.locator(".wa-stat")).not.toHaveCount(0);
    await switchPlatform(page, "Instagram");
    await expect(page.locator(".stats-grid")).toBeVisible();
    await switchPlatform(page, "WhatsApp");
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Chat Analyzer", exact: true })
      .click();
    await expect(page.locator(".wa-stat")).not.toHaveCount(0);
    await expect(
      page.getByLabel("Export date/time format", { exact: true }),
    ).toHaveValue("");
    await fits(page);
  });
});
