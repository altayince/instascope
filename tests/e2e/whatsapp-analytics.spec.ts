import { expect, test, type Page } from "@playwright/test";
import type { ProductEvent } from "../../src/lib/analytics-events";
import type { TrafficContext } from "../../src/lib/analytics-context";
import {
  collectEvents,
  eventCount,
  isSafeAnalyticsRequest,
  productEvents,
} from "../helpers/analytics";

type Envelope = TrafficContext & { event: ProductEvent };

async function observe(page: Page, dnt = "0") {
  const delivered = await collectEvents(page, 204, dnt);
  const envelopes: Envelope[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      configurable: true,
      value: true,
    });
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname !== "/api/events") return;
    expect(isSafeAnalyticsRequest(request)).toBe(true);
    envelopes.push(request.postDataJSON() as Envelope);
  });
  return { delivered, envelopes };
}

async function endpointEnabled(page: Page) {
  const response = await page.request.get("/privacy/");
  const enabled = /data-analytics-endpoint="\/api\/events"/.test(
    await response.text(),
  );
  if (process.env.EXPECT_INDEXABLE === "true") expect(enabled).toBe(true);
  return enabled;
}

async function switchPlatform(page: Page, name: "Instagram" | "WhatsApp") {
  const selector = page.locator(".social-switcher");
  await selector.locator("summary").click();
  await selector.getByRole("link", { name: new RegExp(`^${name}`) }).click();
}

const messages = (page: Page) =>
  page
    .locator(".wa-stat")
    .filter({ has: page.getByText("Exported messages", { exact: true }) })
    .locator("strong");

async function useChatAndBothPlatforms(page: Page) {
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles({
      name: "SYNTHETIC_PRIVATE_FILENAME.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        [
          "14/06/2026, 09:00 - SYNTHETIC_PRIVATE_PARTICIPANT_A: SYNTHETIC_PRIVATE_BODY",
          "15/06/2026, 10:00 - SYNTHETIC_PRIVATE_PARTICIPANT_B: https://synthetic-private.invalid/secret",
        ].join("\n"),
      ),
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
  await expect(messages(page)).toHaveText("2");
  await expect
    .poll(() => productEvents(page))
    .toEqual(["document_entry_observed"]);

  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Wrapped", exact: true })
    .click();
  const wrapped = page.getByRole("region", {
    name: "WhatsApp Wrapped",
    exact: true,
  });
  await expect(
    wrapped.getByRole("button", { name: "Download PNG" }),
  ).toBeEnabled();
  expect(await productEvents(page)).toEqual(["document_entry_observed"]);

  await switchPlatform(page, "Instagram");
  await expect(page).toHaveURL(new URL("/", page.url()).href);
  await expect(
    page.getByRole("button", { name: "Try demo", exact: true }).first(),
  ).toBeEnabled();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/$/);
  await expect.poll(() => eventCount(page, "dashboard_opened")).toBe(1);

  await switchPlatform(page, "WhatsApp");
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Chat Analyzer", exact: true })
    .click();
  await expect(page).toHaveURL(/\/whatsapp\/chat-analyzer\/$/);
  await expect(messages(page)).toHaveText("2");
  expect(await eventCount(page, "document_entry_observed")).toBe(1);
}

for (const [source, referrer] of [
  [
    "google",
    "https://www.google.de/search?q=SYNTHETIC_PRIVATE_QUERY#private-fragment",
  ],
  ["none", ""],
] as const) {
  test(`shared initializer observes one ${source} entry across WhatsApp and Instagram`, async ({
    page,
    context,
  }) => {
    const { delivered, envelopes } = await observe(page);
    const enabled = await endpointEnabled(page);
    await page.goto(
      "/whatsapp/chat-analyzer/",
      referrer ? { referer: referrer } : {},
    );
    await expect(
      page.getByLabel("Upload WhatsApp chat export", { exact: true }),
    ).toBeEnabled();
    await expect
      .poll(() => eventCount(page, "document_entry_observed"))
      .toBe(1);
    const originalDocument = await page.evaluateHandle(() => document);
    // Later product events must retain the original document entry context.
    await page.evaluate(() => {
      Object.defineProperty(document, "referrer", {
        configurable: true,
        value: "https://synthetic-changed.invalid/private",
      });
      Object.defineProperty(navigator, "webdriver", {
        configurable: true,
        value: false,
      });
    });

    await useChatAndBothPlatforms(page);
    expect(
      await page.evaluate(
        (original) => original === document,
        originalDocument,
      ),
    ).toBe(true);
    if (enabled) {
      await expect
        .poll(() => delivered.includes("dashboard_opened"))
        .toBe(true);
      expect(
        envelopes.filter((item) => item.event === "document_entry_observed"),
      ).toEqual([
        { event: "document_entry_observed", source, webdriver: "yes" },
      ]);
      expect(
        envelopes.every(
          (item) => item.source === source && item.webdriver === "yes",
        ),
      ).toBe(true);
    } else expect(envelopes).toEqual([]);
    expect(JSON.stringify(envelopes)).not.toMatch(
      /SYNTHETIC_PRIVATE|synthetic-private|synthetic-changed|https:|participant|filename|message|count/i,
    );
    expect(await context.cookies()).toEqual([]);

    await originalDocument.dispose();
    await page.reload();
    await expect(
      page.getByLabel("Upload WhatsApp chat export", { exact: true }),
    ).toBeEnabled();
    await expect
      .poll(() => eventCount(page, "document_entry_observed"))
      .toBe(1);
    if (enabled)
      await expect
        .poll(
          () =>
            envelopes.filter((item) => item.event === "document_entry_observed")
              .length,
        )
        .toBe(2);
    else expect(envelopes).toEqual([]);
  });
}

for (const dnt of ["1", "yes"]) {
  test(`DNT ${dnt} suppresses shared analytics across WhatsApp import and platform navigation`, async ({
    page,
  }) => {
    const { delivered, envelopes } = await observe(page, dnt);
    await page.goto("/whatsapp/chat-analyzer/", {
      referer: "https://www.google.com/search?q=SYNTHETIC_PRIVATE_QUERY",
    });
    await expect(
      page.getByLabel("Upload WhatsApp chat export", { exact: true }),
    ).toBeEnabled();
    const originalDocument = await page.evaluateHandle(() => document);
    await useChatAndBothPlatforms(page);
    expect(
      await page.evaluate(
        (original) => original === document,
        originalDocument,
      ),
    ).toBe(true);
    expect(delivered).toEqual([]);
    expect(envelopes).toEqual([]);
    await originalDocument.dispose();
  });
}
