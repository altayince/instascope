import { test, expect, type Page } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import { readFile } from "node:fs/promises";
import { upload } from "../helpers/vault";
import { isSafeDocumentEntryRequest } from "../helpers/analytics";

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
  await confirmChat(page, file);
  await expect(
    page
      .locator(".wa-stat")
      .filter({ hasText: "Exported messages" })
      .locator("strong"),
  ).toHaveText("6");
}
async function confirmChat(page: Page, file = txt(), format = "dmy-24h") {
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles(file);
  await expect(
    page.getByRole("region", { name: "Detected export format" }),
  ).toBeVisible();
  await page
    .getByLabel("Export date/time format", { exact: true })
    .selectOption(format);
  await page
    .getByRole("button", { name: "Confirm format and open chat" })
    .click();
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
async function sharedControls(page: Page) {
  return page.evaluate(() => {
    return Object.fromEntries(
      ["body", ".site-header", ".header-note", ".primary"].map((selector) => {
        const style = getComputedStyle(document.querySelector(selector)!);
        return [
          selector,
          {
            color: style.color,
            background: style.backgroundColor,
            border: style.border,
            fontFamily: style.fontFamily,
            boxShadow: style.boxShadow,
          },
        ];
      }),
    );
  });
}

test("production release exposes WhatsApp without indexing it or changing Instagram indexing", async ({
  page,
  request,
}) => {
  test.skip(enabled, "The preview build has its own global indexing boundary.");
  expect((await page.goto("/"))?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  await expect(
    page.getByRole("button", { name: "Try demo", exact: true }),
  ).toBeEnabled();
  await switchPlatform(page, "WhatsApp");
  await expect(page).toHaveURL(/\/whatsapp\/$/);
  await expect(page.locator(".social-switcher summary")).toHaveAccessibleName(
    /currently WhatsApp/,
  );
  for (const route of [
    "/whatsapp/",
    "/whatsapp/chat-analyzer/",
    "/whatsapp/wrapped/",
    "/whatsapp/chat-vault/",
  ]) {
    expect((await page.goto(route))?.status(), route).toBe(200);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await expect(
      page.getByLabel(
        route === "/whatsapp/chat-vault/"
          ? "Import Chat Vault backup"
          : "Upload WhatsApp chat export",
        { exact: true },
      ),
    ).toBeEnabled();
    expect((await page.reload())?.status(), `${route} refresh`).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await fits(page);
  }
  await expect(
    page.getByLabel("Import Chat Vault backup", { exact: true }),
  ).toBeEnabled();
  await switchPlatform(page, "Instagram");
  await expect(page).toHaveURL(new URL("/", page.url()).href);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  expect((await request.get("/followers-analyzer/")).status()).toBe(200);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "whatsapp",
  );
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/^Allow: \/$/m);
  expect(robots).toMatch(/^Disallow: \/api\/$/m);
  expect(robots).not.toMatch(/^Disallow: \/$/m);
  expect(robots).not.toMatch(/^Disallow: \/whatsapp(?:\/|$)/m);
});

test.describe("WhatsAppScope enabled preview", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");

  test("platform switcher preserves the shared dark palette and changes navigation with native accessible dismissal", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Try demo", exact: true }),
    ).toBeEnabled();
    const instagram = await sharedControls(page);
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
    await expect(page.locator(".site-header")).toHaveAttribute(
      "data-platform",
      "whatsapp",
    );
    await expect(page.locator(".wa-hero")).toBeVisible();
    expect(await sharedControls(page)).toEqual(instagram);
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link"),
    ).toHaveText(["Overview", "Chat Analyzer", "Wrapped", "Chat Vault"]);
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
      expect(await page.title()).toContain("InstaScope");
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
    const documentEntries: string[] = [];
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
      const documentEntry = isSafeDocumentEntryRequest(request);
      if (documentEntry) documentEntries.push(request.postData()!);
      if (
        (!["GET", "HEAD"].includes(request.method()) && !documentEntry) ||
        (url.origin !== "http://127.0.0.1:3000" && url.protocol !== "blob:")
      )
        outgoing.push(request.url());
    });
    await page.goto("/whatsapp/chat-analyzer/");
    await expect(
      page.getByRole("button", { name: "Open chat export" }),
    ).toBeEnabled();
    await openChat(page);
    for (const [label, value] of [
      ["Participants", "2"],
      ["Active dates", "5"],
      ["Calendar days covered", "8"],
      ["Recognized media messages", "1"],
      ["Link occurrences", "1"],
    ])
      await expect(
        page
          .locator(".wa-stat")
          .filter({ has: page.getByText(label, { exact: true }) })
          .locator("strong"),
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
    await expect(
      page
        .locator(".wa-extra-counts > div")
        .filter({ hasText: "Recorded system events" })
        .locator("dd"),
    ).toHaveText("1");
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
    expect(documentEntries.length).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { waProductEvents: unknown[] }).waProductEvents,
      ),
    ).toEqual([{ event: "document_entry_observed" }]);
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
      txt("13/10/6, 9:00 - Synthetic: unsupported year width"),
      txt("31/02/2025, 09:00 - Name: impossible date"),
      txt("not an export"),
    ]) {
      await page
        .getByLabel("Upload WhatsApp chat export", { exact: true })
        .setInputFiles(file);
      const detection = page.getByRole("region", {
        name: "Detected export format",
      });
      await expect(
        detection.getByText("Unsupported", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Confirm format and open chat" }),
      ).toBeDisabled();
      await expect(
        page
          .locator(".wa-stat")
          .filter({ hasText: "Exported messages" })
          .locator("strong"),
      ).toHaveText("6");
    }
    await openChat(page);
    await expect(page.locator(".wa-error")).toHaveCount(0);
  });

  test("ambiguous YY input requires a new deliberate format choice and cancellation preserves the loaded chat", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await page.getByRole("button", { name: "Try the fictional demo" }).click();
    const messageTotal = page
      .locator(".wa-stat")
      .filter({ hasText: "Exported messages" })
      .locator("strong");
    await expect(messageTotal).toHaveText("24");
    const file = txt(
      "[6/7/26, 9:45 AM] Synthetic A: Hello\n[6/8/26, 9:46 AM] Synthetic B: Hello",
    );
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles(file);
    const detection = page.getByRole("region", {
      name: "Detected export format",
    });
    await expect(
      detection.getByText("Needs user selection", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Export date/time format", { exact: true }),
    ).toHaveValue("");
    const confirm = page.getByRole("button", {
      name: "Confirm format and open chat",
    });
    await expect(confirm).toBeDisabled();
    await expect(messageTotal).toHaveText("24");
    await page
      .getByLabel("Export date/time format", { exact: true })
      .selectOption("mdy-12h");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(messageTotal).toHaveText("2");
    await expect(page.locator(".wa-recorded-times")).toContainText(
      "2026-06-07",
    );
    await expect(page.locator(".wa-recorded-times")).toContainText(
      "2026-06-08",
    );
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles(file);
    await expect(
      detection.getByText("Needs user selection", { exact: true }),
    ).toBeVisible();
    await expect(confirm).toBeDisabled();
    await page
      .getByRole("button", { name: "Cancel import", exact: true })
      .click();
    await expect(detection).toHaveCount(0);
    await expect(messageTotal).toHaveText("2");
    await fits(page);
  });

  test("supported iOS YY evidence waits for confirmation and Doctor reports only aggregate source coverage", async ({
    page,
  }) => {
    const evidence = [
      "SYNTHETIC_PRIVATE_PREAMBLE",
      "[3/14/26, 12:00:01 AM] SYNTHETIC_PRIVATE_LABEL: SYNTHETIC_PRIVATE_BODY",
      "A fictional continuation line.",
      "[3/14/26, 12:05 PM] Synthetic B: https://synthetic-private.invalid/secret",
      "[3/15/26, 1:02:03 PM] SYNTHETIC_PRIVATE_LABEL: A fictional final line.",
    ].join("\n");
    await page.goto("/whatsapp/chat-analyzer/");
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles({
        ...txt(evidence),
        name: "synthetic-private-filename.txt",
      });
    const detection = page.getByRole("region", {
      name: "Detected export format",
    });
    await expect(
      detection.getByText("Supported", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Export date/time format", { exact: true }),
    ).toHaveValue("mdy-12h");
    await expect(page.locator(".wa-stat")).toHaveCount(0);
    await expect(detection).not.toContainText(
      /SYNTHETIC_PRIVATE|synthetic-private|secret/,
    );
    await page
      .getByRole("button", { name: "Confirm format and open chat" })
      .click();
    await expect(
      page
        .locator(".wa-stat")
        .filter({ hasText: "Exported messages" })
        .locator("strong"),
    ).toHaveText("3");
    const doctor = page.getByRole("region", { name: "Chat Export Doctor" });
    await expect(doctor).toBeVisible();
    await expect(doctor.locator(".wa-doctor-disclosure")).not.toHaveAttribute(
      "open",
    );
    await expect(
      doctor.getByText("Partially supported", { exact: true }),
    ).toBeVisible();
    await expect(doctor.locator(".wa-doctor-warning")).toContainText(
      "1 untimestamped preamble lines were skipped",
    );
    await expect(doctor.locator(".wa-doctor-warning")).toBeVisible();
    await doctor.locator("summary").click();
    await expect(
      doctor.getByText("Timestamp wrapper", { exact: true }),
    ).toBeVisible();
    await expect(doctor).toContainText(/iOS|bracket/i);
    await expect(doctor).toContainText(/2-digit|two-digit|2 digit/i);
    await expect(doctor).toContainText(/mixed|second/i);
    await expect(doctor).not.toContainText(
      /SYNTHETIC_PRIVATE|synthetic-private|secret/,
    );
    await expect(page.locator(".wa-recorded-times")).toContainText(
      "2026-03-14",
    );
    await expect(page.locator("main")).not.toContainText(
      "SYNTHETIC_PRIVATE_PREAMBLE",
    );
    await fits(page);
  });

  test("a synthetic localized iOS ZIP accepts Markdown companions and reports bounded factual event coverage", async ({
    page,
  }) => {
    const records = await readFile(
      "tests/fixtures/whatsapp/ios-de-markers.txt",
      "utf8",
    );
    const archive = {
      name: "synthetic-private-archive.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(
        zipSync({
          "synthetic-private-chat.txt": strToU8(records),
          "chat.md": strToU8(
            "SYNTHETIC_PRIVATE_COMPANION_BODY https://example.invalid/private-companion",
          ),
          "synthetic-private-image.jpg": new Uint8Array(32),
        }),
      ),
    };
    await page.goto("/whatsapp/chat-analyzer/");
    await confirmChat(page, archive, "mdy-12h");
    await expect(
      page
        .locator(".wa-stat")
        .filter({ hasText: "Exported messages" })
        .locator("strong"),
    ).toHaveText("9");
    const doctor = page.getByRole("region", { name: "Chat Export Doctor" });
    await expect(doctor).toBeVisible();
    await expect(doctor.locator(".wa-doctor-disclosure")).not.toHaveAttribute(
      "open",
    );
    await expect(
      doctor.getByText("Partially supported", { exact: true }),
    ).toBeVisible();
    await expect(doctor.locator(".wa-doctor-warning")).toBeVisible();
    await expect(doctor.locator(".wa-doctor-warning")).toContainText(
      "1 unclassified marker-like records",
    );
    await doctor.locator("summary").click();
    await expect(doctor.locator(".wa-doctor-coverage")).toBeVisible();
    await expect(doctor.locator(".wa-doctor-details")).toBeVisible();
    await expect(doctor.locator(".wa-doctor-limitations")).toBeVisible();
    await expect(
      doctor
        .locator(".wa-doctor-coverage > div")
        .filter({ hasText: "Ignored non-TXT ZIP files" })
        .locator("dd"),
    ).toHaveText("2");
    await expect(
      doctor.getByText("Partially supported", { exact: true }),
    ).toBeVisible();
    await expect(
      doctor
        .locator(".wa-doctor-coverage > div")
        .filter({ hasText: "Unclassified marker-like records" })
        .locator("dd"),
    ).toHaveText("1");
    for (const label of [
      "Image omitted",
      "Video omitted",
      "Voice / audio omitted",
      "Sticker omitted",
      "GIF omitted",
      "Document omitted",
      "Deleted-message marker",
      "Call marker",
      "Location-share marker",
    ])
      await expect(doctor.locator(".wa-doctor-details")).toContainText(label);
    await expect(doctor.locator(".wa-doctor-details")).toContainText("German");
    await expect(doctor).not.toContainText(
      /Synthetic A|Synthetic B|synthetic-private|SYNTHETIC_PRIVATE|example\.invalid|chat\.md|\[Anruf\]|synthetic-document|maps\.google\.com|q=0/,
    );
    await expect(
      page
        .locator(".wa-stat")
        .filter({ hasText: "Recognized media messages" })
        .locator("strong"),
    ).toHaveText("6");
    await expect(
      page
        .locator(".wa-extra-counts > div")
        .filter({ hasText: "Recorded system events" })
        .locator("dd"),
    ).toHaveText("1");
    await expect(
      page
        .locator(".wa-stat")
        .filter({ hasText: "Link occurrences" })
        .locator("strong"),
    ).toHaveText("0");
    await fits(page);
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
    await expect(deck).toBeVisible();
    const choices = deck
      .getByRole("group", { name: "Choose a Wrapped card" })
      .getByRole("button");
    expect(await choices.count()).toBeGreaterThanOrEqual(2);
    expect(await choices.count()).toBeLessThanOrEqual(12);
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
      expect(file.suggestedFilename()).toMatch(
        /^instascope-whatsapp-[a-z0-9-]+\.png$/,
      );
    }
    const drawn = await page.evaluate(() =>
      (window as unknown as { waDrawnText: string[] }).waDrawnText.join("\n"),
    );
    expect(drawn).not.toMatch(
      /Private participant|Second private label|PRIVATE_MESSAGE_CONTENT|private\.invalid|<script>/,
    );
    await expect(deck).not.toContainText(privateName);
    const slide = deck.getByRole("group", { name: /of \d+:/ });
    const shareButton = deck.getByRole("button", {
      name: "Share card",
      exact: true,
    });
    async function shareCard() {
      // Keyboard slide navigation can leave WebKit smooth-scrolling. Position
      // the action before a real pointer click instead of racing that scroll.
      await shareButton.evaluate((button) =>
        button.scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await expect(shareButton).toBeInViewport();
      await expect(shareButton).toBeEnabled();
      await shareButton.click();
    }
    await slide.focus();
    await page.keyboard.press("Home");
    await expect(slide).toHaveAttribute("aria-label", /^1 of/);
    await page.keyboard.press("ArrowRight");
    await expect(slide).toHaveAttribute("aria-label", /^2 of/);
    await shareCard();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { waShares: string[] }).waShares.length,
        ),
      )
      .toBe(1);
    // Wait for completion before changing the mock for the next interaction.
    await expect(deck.getByRole("status")).toHaveText(
      "Your card was handed to your device's share menu.",
    );
    await expect(
      deck.getByRole("button", { name: "Share card", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() =>
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          throw new DOMException("Cancelled", "AbortError");
        },
      }),
    );
    await shareCard();
    await expect(deck.getByRole("status")).toContainText("Sharing cancelled");
    await page.evaluate(() =>
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => false,
      }),
    );
    const fallbackDownload = page.waitForEvent("download");
    await shareCard();
    expect((await fallbackDownload).suggestedFilename()).toMatch(
      /^instascope-whatsapp-/,
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
    const records = (many: boolean) =>
      Array.from(
        { length: 9 },
        (_, index) =>
          `01/01/2025, 09:00 - ${many ? `Label ${index + 1}` : "Replacement label"}: Message`,
      ).join("\n");
    await confirmChat(page, txt(records(true)));
    const participants = page.locator(".wa-participants");
    await expect(participants.locator(".wa-participant-row")).toHaveCount(8);
    await participants
      .getByRole("button", { name: "Next participants" })
      .click();
    await expect(participants.locator(".wa-participant-row")).toHaveCount(1);
    await expect(participants).toContainText("Label 9");
    await confirmChat(page, txt(records(false)));
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
    await confirmChat(
      page,
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
    const text = Array.from(
      { length: 26 },
      (_, index) => `01/01/${2000 + index}, 09:00 - Synthetic label: Hello`,
    ).join("\n");
    await confirmChat(page, txt(text));
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
            ("format" in message || "operation" in message) &&
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

  test("cancelling parsing terminates a pending replacement and keeps the previous accepted dataset", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const metrics = { pending: 0, terminated: 0 };
      Object.assign(window, { waPendingParser: metrics });
      const NativeWorker = window.Worker;
      let holdNextParse = true;
      window.Worker = class extends NativeWorker {
        held = false;
        postMessage(message: unknown) {
          if (
            holdNextParse &&
            message &&
            typeof message === "object" &&
            "format" in message &&
            "files" in message
          ) {
            holdNextParse = false;
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
    await confirmChat(page);
    await expect(page.locator(".wa-import-panel")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    const total = page
      .locator(".wa-stat")
      .filter({ hasText: "Exported messages" })
      .locator("strong");
    await expect(total).toHaveText("24");
    await page
      .getByRole("button", { name: "Cancel import", exact: true })
      .click();
    await expect(page.locator(".wa-import-panel")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(total).toHaveText("24");
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { waPendingParser: unknown }).waPendingParser,
      ),
    ).toEqual({ pending: 0, terminated: 1 });
    await openChat(page);
    await expect(page.locator(".wa-error")).toHaveCount(0);
    await fits(page);
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
