import { expect, test, type Page } from "@playwright/test";
import {
  trafficSources,
  webdriverHints,
} from "../../src/lib/analytics-context";
import { isSafeAnalyticsRequest } from "../helpers/analytics";

type Envelope = { event: string; source: string; webdriver: string };
type Diagnostics = Window & {
  trafficDiagnostics: unknown[];
  trafficStorageWrites: string[];
};

async function observe(
  page: Page,
  webdriver: boolean | null = true,
  dnt = "0",
) {
  const envelopes: Envelope[] = [];
  await page.addInitScript(
    ({ webdriver, dnt }) => {
      Object.defineProperty(navigator, "webdriver", {
        configurable: true,
        value: webdriver,
      });
      Object.defineProperty(navigator, "doNotTrack", {
        configurable: true,
        value: dnt,
      });
      Object.assign(window, {
        trafficDiagnostics: [],
        trafficStorageWrites: [],
      });
      window.addEventListener("instascope:event", (event) => {
        (window as unknown as Diagnostics).trafficDiagnostics.push(
          (event as CustomEvent).detail,
        );
      });
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        (window as unknown as Diagnostics).trafficStorageWrites.push(key);
        return setItem.call(this, key, value);
      };
    },
    { webdriver, dnt },
  );
  await page.route("**/api/events", async (route) => {
    expect(isSafeAnalyticsRequest(route.request())).toBe(true);
    const envelope = route.request().postDataJSON() as Envelope;
    expect(trafficSources).toContain(envelope.source);
    expect(webdriverHints).toContain(envelope.webdriver);
    envelopes.push(envelope);
    await route.fulfill({
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  });
  return envelopes;
}

async function diagnosticEntries(page: Page) {
  return page.evaluate(() =>
    (window as unknown as Diagnostics).trafficDiagnostics.filter(
      (entry) =>
        (entry as { event: string }).event === "document_entry_observed",
    ),
  );
}

async function configured(page: Page) {
  const response = await page.request.get("/privacy/");
  const html = await response.text();
  const enabled = /data-analytics-endpoint="\/api\/events"/.test(html);
  if (process.env.EXPECT_INDEXABLE === "true") expect(enabled).toBe(true);
  return enabled;
}

const cases = [
  [
    "google",
    "https://news.google.de/search?q=SYNTHETIC_PRIVATE_QUERY#private-fragment",
  ],
  ["bing", "https://www.bing.com/search?q=SYNTHETIC_PRIVATE_QUERY"],
  ["search_other", "https://duckduckgo.com/?q=SYNTHETIC_PRIVATE_QUERY"],
  [
    "external",
    "https://synthetic-referrer.invalid/private/path?q=SYNTHETIC_PRIVATE_QUERY",
  ],
  ["same_site", "https://instascope.me/private/path?q=SYNTHETIC_PRIVATE_QUERY"],
  ["none", ""],
] as const;

for (const [source, referrer] of cases) {
  test(`document entry reduces a ${source} referrer locally without transmitting URLs`, async ({
    page,
    context,
  }) => {
    const envelopes = await observe(page);
    const enabled = await configured(page);
    await page.goto(
      "/how-to-see-when-someone-followed-you-on-instagram/",
      referrer ? { referer: referrer } : {},
    );
    await expect(page.locator("main h1")).toBeVisible();
    await expect
      .poll(() => diagnosticEntries(page))
      .toEqual([{ event: "document_entry_observed" }]);
    if (enabled) {
      await expect
        .poll(() =>
          envelopes.filter((item) => item.event === "document_entry_observed"),
        )
        .toEqual([
          { event: "document_entry_observed", source, webdriver: "yes" },
        ]);
    } else expect(envelopes).toEqual([]);
    expect(JSON.stringify(envelopes)).not.toMatch(
      /SYNTHETIC_PRIVATE_QUERY|synthetic-referrer|private-fragment|https:|\/private/,
    );
    expect(await context.cookies()).toEqual([]);
    expect(
      await page.evaluate(
        () => (window as unknown as Diagnostics).trafficStorageWrites,
      ),
    ).toEqual([]);
  });
}

for (const [value, hint] of [
  [true, "yes"],
  [false, "no"],
  [null, "unknown"],
] as const) {
  test(`webdriver ${hint} stays a bounded hint and diagnostics contain event names only`, async ({
    page,
  }) => {
    const envelopes = await observe(page, value);
    const enabled = await configured(page);
    await page.goto("/dashboard/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => diagnosticEntries(page)).toHaveLength(1);
    if (enabled)
      await expect
        .poll(() =>
          envelopes.filter((item) => item.event === "document_entry_observed"),
        )
        .toEqual([
          { event: "document_entry_observed", source: "none", webdriver: hint },
        ]);
    else expect(envelopes).toEqual([]);
    const diagnostics = await page.evaluate(
      () => (window as unknown as Diagnostics).trafficDiagnostics,
    );
    expect(diagnostics.length).toBeGreaterThan(0);
    for (const item of diagnostics)
      expect(Object.keys(item as object)).toEqual(["event"]);
  });
}

test("the original document context survives SPA navigation and reload observes a new document", async ({
  page,
  context,
}) => {
  const envelopes = await observe(page);
  const enabled = await configured(page);
  await page.goto("/", {
    referer: "https://www.google.co.uk/search?q=SYNTHETIC_PRIVATE_QUERY",
  });
  await expect.poll(() => diagnosticEntries(page)).toHaveLength(1);
  if (enabled)
    await expect
      .poll(() =>
        envelopes.filter((item) => item.event === "document_entry_observed"),
      )
      .toHaveLength(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://synthetic-changed.invalid/secret",
    });
    Object.defineProperty(navigator, "webdriver", {
      configurable: true,
      value: false,
    });
  });
  await page
    .getByRole("navigation", { name: "Footer navigation" })
    .getByRole("link", { name: "Privacy", exact: true })
    .click();
  await expect(page).toHaveURL(/\/privacy\/$/);
  await expect.poll(() => diagnosticEntries(page)).toHaveLength(1);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/$/);
  await expect
    .poll(
      async () =>
        (
          await page.evaluate(
            () => (window as unknown as Diagnostics).trafficDiagnostics,
          )
        ).filter(
          (entry) => (entry as { event: string }).event === "dashboard_opened",
        ).length,
    )
    .toBe(1);
  if (enabled) {
    await expect
      .poll(() => envelopes.some((item) => item.event === "dashboard_opened"))
      .toBe(true);
    expect(
      envelopes.every(
        (item) => item.source === "google" && item.webdriver === "yes",
      ),
    ).toBe(true);
    expect(
      envelopes.filter((item) => item.event === "document_entry_observed"),
    ).toHaveLength(1);
  }
  await page.reload();
  await expect.poll(() => diagnosticEntries(page)).toHaveLength(1);
  if (enabled)
    await expect
      .poll(() =>
        envelopes.filter((item) => item.event === "document_entry_observed"),
      )
      .toHaveLength(2);
  else expect(envelopes).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as Diagnostics).trafficStorageWrites,
    ),
  ).toEqual([]);
});

for (const dnt of ["1", "yes"]) {
  test(`DNT ${dnt} suppresses document entries and product events without blocking navigation`, async ({
    page,
  }) => {
    const envelopes = await observe(page, true, dnt);
    await page.goto("/", {
      referer: "https://www.google.com/search?q=SYNTHETIC_PRIVATE_QUERY",
    });
    await expect
      .poll(() => diagnosticEntries(page))
      .toEqual([{ event: "document_entry_observed" }]);
    await page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: "Privacy", exact: true })
      .click();
    await expect(page).toHaveURL(/\/privacy\/$/);
    expect(envelopes).toEqual([]);
    expect(
      await page.evaluate(
        () => (window as unknown as Diagnostics).trafficStorageWrites,
      ),
    ).toEqual([]);
  });
}

test("unexpected referrer access becomes unknown and never blocks the public page", async ({
  page,
}) => {
  const envelopes = await observe(page);
  const enabled = await configured(page);
  await page.addInitScript(() =>
    Object.defineProperty(document, "referrer", {
      configurable: true,
      get() {
        throw new Error("Synthetic unavailable referrer");
      },
    }),
  );
  await page.goto("/privacy/");
  await expect(page.locator("main h1")).toBeVisible();
  await expect.poll(() => diagnosticEntries(page)).toHaveLength(1);
  if (enabled)
    await expect
      .poll(() =>
        envelopes.filter((item) => item.event === "document_entry_observed"),
      )
      .toEqual([
        {
          event: "document_entry_observed",
          source: "unknown",
          webdriver: "yes",
        },
      ]);
  else expect(envelopes).toEqual([]);
});
