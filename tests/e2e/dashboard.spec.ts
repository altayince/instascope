import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import { tools } from "../../src/lib/site";
import { syntheticConnections } from "../helpers/connection-export";

async function upload(
  page: Page,
  optional: Record<string, unknown> = {},
  dated: boolean | "followers-only" = true,
) {
  const record = (value: string, timestamp?: number) => ({
    string_list_data: [{ value, timestamp }],
  });
  const files = {
    "followers_1.json": [
      record("sample.mutual", dated ? 1577836800 : undefined),
      record("sample.fan"),
      record("sample.earliest", dated ? 1546300800 : undefined),
    ],
    "following.json": [
      record("sample.mutual", dated === true ? 1577836800 : undefined),
      record("sample.outgoing"),
    ],
    ...optional,
  };
  const zip = zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, contents]) => [
        name,
        strToU8(JSON.stringify(contents)),
      ]),
    ),
  );
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles({
      name: "synthetic-dashboard.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zip),
    });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your circle, at a glance.",
  );
}

function card(page: Page, slug: string) {
  return page.locator(`.dashboard-tool-card[href="/${slug}/"]`);
}
async function dashboard(page: Page) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/$/);
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("dashboard welcomes without data, keeps application SEO separate and links every existing tool", async ({
  page,
  request,
}) => {
  expect((await page.goto("/dashboard/"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your circle starts here.",
  );
  await expect(
    page
      .getByRole("button", { name: "Upload Instagram export", exact: true })
      .and(page.locator("button")),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Try demo", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".dashboard-metrics")).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: "Need your export? Follow the download guide",
    }),
  ).toHaveAttribute("href", "/how-to-download-instagram-followers-data/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /^noindex, (?:no)?follow$/,
  );
  if (process.env.EXPECT_INDEXABLE === "true")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, follow",
    );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://instascope.me/dashboard/",
  );
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "/dashboard/",
  );
  const links = page.locator(".dashboard-tool-card");
  await expect(links).toHaveCount(Object.keys(tools).length);
  for (const slug of Object.keys(tools)) {
    await expect(card(page, slug)).toHaveCount(1);
    expect((await request.get(`/${slug}/`)).status()).toBe(200);
  }
  await fits(page);
});

test("real upload populates counts and coverage, persists through tools and opens incoming follower dates", async ({
  page,
}) => {
  const outbound: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" ||
      !request.url().startsWith("http://127.0.0.1:3000")
    )
      outbound.push(request.url());
  });
  await page.addInitScript(() => {
    const events: unknown[] = [];
    Object.assign(window, { dashboardEvents: events });
    window.addEventListener("instascope:event", (event) =>
      events.push((event as CustomEvent).detail),
    );
  });
  await page.goto("/dashboard/");
  await upload(page);
  await expect(page.locator(".dashboard-metrics dt")).toHaveText([
    "Followers",
    "Following",
    "Mutuals",
    "Not following back",
    "Fans",
  ]);
  expect(
    await page
      .locator(".dashboard-metrics dd")
      .evaluateAll((items) =>
        items.map((item) => item.firstChild?.textContent),
      ),
  ).toEqual(["3", "2", "1", "1", "2"]);
  await expect(page.locator(".dashboard-coverage")).toContainText("2 of 3");
  await expect(page.locator(".dashboard-coverage")).toContainText(
    "1 of 2 following relationships",
  );
  await expect(card(page, "pending-follow-requests")).toContainText(
    "Not included in this export",
  );
  await expect(card(page, "unfollow-history")).toContainText(
    "Not included in this export",
  );
  await expect(card(page, "connection-privacy")).toContainText(
    "0 of 4 privacy categories",
  );
  await expect(card(page, "snapshot-comparison")).toContainText(
    "Add an older export from the same account",
  );
  await expect(card(page, "instagram-wrapped")).toContainText(
    "Recorded-date stories are available",
  );
  await fits(page);
  await card(page, "following-analyzer").click();
  await expect(
    page.getByRole("button", { name: /Following 2/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await dashboard(page);
  await expect(card(page, "followers-analyzer")).toContainText("3 followers");
  await page
    .getByRole("link", { name: "Explore follower dates", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/relationship-timeline\/\?direction=followers$/,
  );
  await expect(page.getByLabel("Relationship direction")).toHaveValue(
    "followers",
  );
  await expect(page.getByLabel("Sort accounts")).toHaveValue("oldest");
  await expect(page.locator(".accounts li").first()).toContainText(
    "@sample.earliest",
  );
  await dashboard(page);
  const events = await page.evaluate(
    () =>
      (window as unknown as { dashboardEvents: { event: string }[] })
        .dashboardEvents,
  );
  expect(
    events.filter((entry) => entry.event === "dashboard_opened"),
  ).toHaveLength(3);
  expect(events.every((entry) => Object.keys(entry).join() === "event")).toBe(
    true,
  );
  expect(outbound).toEqual([]);
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your circle starts here.",
  );
  await expect(page.locator(".dashboard-metrics")).toHaveCount(0);
  await card(page, "followers-analyzer").click();
  await expect(
    page
      .getByRole("button", { name: "Upload Instagram export", exact: true })
      .and(page.locator("button")),
  ).toBeVisible();
});

test("optional empty, included and unreadable categories stay distinct and missing dates stay unavailable", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await upload(
    page,
    {
      ...syntheticConnections,
      "pending_follow_requests.json": [],
      "blocked_profiles.json": [
        { label_values: [{ label: "Name", value: "not.an.identity" }] },
      ],
    },
    false,
  );
  await expect(card(page, "pending-follow-requests")).toContainText(
    "0 sent requests recorded",
  );
  await expect(card(page, "pending-follow-requests")).not.toContainText(
    "Not included",
  );
  await expect(card(page, "unfollow-history")).toContainText(
    "2 unfollow actions by you",
  );
  await expect(card(page, "connection-privacy")).toContainText(
    "3 of 4 privacy categories",
  );
  await expect(card(page, "connection-privacy")).toContainText(
    "1 included but could not be read",
  );
  await expect(page.locator(".dashboard-coverage")).toContainText("0 of 3");
  await expect(card(page, "instagram-wrapped")).toContainText(
    "Date stories need usable recorded following dates",
  );
  await page
    .getByRole("link", { name: "Explore follower dates", exact: true })
    .click();
  await expect(page.locator(".accounts li")).toHaveCount(3);
  await expect(page.locator(".accounts li").first()).toContainText(
    "Date unavailable",
  );
  await dashboard(page);
  await card(page, "connection-privacy").click();
  await page.getByRole("button", { name: /Blocked accounts/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Could not read this list" }),
  ).toBeVisible();
});

test("follower-only dates do not promise Wrapped date stories and saved snapshots are never selected automatically", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await upload(page, {}, "followers-only");
  await expect(page.locator(".dashboard-coverage")).toContainText("2 of 3");
  await expect(card(page, "instagram-wrapped")).toContainText(
    "Date stories need usable recorded following dates",
  );
  await card(page, "followers-analyzer").click();
  const saver = page.getByRole("region", { name: "Save a local snapshot" });
  await saver.getByLabel("Date this export represents").fill("2024-01-15");
  await saver
    .getByRole("button", { name: "Save this snapshot for next time" })
    .click();
  await expect(saver).toContainText("Saved local snapshot · 2024-01-15");
  await dashboard(page);
  await expect(card(page, "snapshot-comparison")).toContainText(
    "A saved local snapshot is available",
  );
  await expect(card(page, "snapshot-comparison")).not.toContainText(
    "Two snapshots are loaded",
  );
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await expect(
    page.getByText("Nothing is compared automatically.", { exact: false }),
  ).toBeVisible();
  await upload(page);
  await expect(card(page, "snapshot-comparison")).toContainText(
    "Confirm its date and the same account",
  );
});

test("demo dashboard preserves both fictional snapshots across tools and keeps the homepage intact", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your Instagram circle.",
  );
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await dashboard(page);
  await expect(page.locator(".demo-notice")).toContainText(
    "Demo data · Fictional example",
  );
  await expect(card(page, "followers-analyzer")).toContainText(
    "1,284 followers",
  );
  await expect(card(page, "pending-follow-requests")).toContainText(
    "3 sent requests recorded",
  );
  await expect(card(page, "unfollow-history")).toContainText(
    "2 unfollow actions by you",
  );
  await expect(card(page, "connection-privacy")).toContainText(
    "4 of 4 privacy categories",
  );
  await expect(card(page, "snapshot-comparison")).toContainText(
    "Two snapshots are loaded",
  );
  await expect(card(page, "instagram-wrapped")).toContainText(
    "Comparison stories are available",
  );
  await fits(page);
  await card(page, "snapshot-comparison").click();
  await expect(page.locator(".snapshot-status")).toContainText(
    "Current uploaded export",
  );
  await expect(page.locator(".snapshot-status")).toContainText(
    "Fictional older snapshot",
  );
  await dashboard(page);
  await expect(card(page, "snapshot-comparison")).toContainText(
    "Two snapshots are loaded",
  );
  await page.getByRole("button", { name: "Use my own export" }).click();
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(card(page, "followers-analyzer")).toContainText(
    "1,284 followers",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your circle starts here.",
  );
});
