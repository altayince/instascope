import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  savedRecords,
  seedRecords,
  upload,
  newer,
  original,
} from "../helpers/vault";

const deleted = "__deleted__bcdefghijabcdefgh";
const longUsername = "sample.long.username.123456789";
const record = (value: string, timestamp?: number) => ({
  string_list_data: [
    { value, ...(timestamp === undefined ? {} : { timestamp }) },
  ],
});
const file = (name: string, value: unknown) => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(value)),
});
const files = [
  file("followers_1.json", [
    record("sample.active", 1609459200),
    record("sample.unknown"),
    record(longUsername),
    record(deleted, 1609459200),
  ]),
  file("following.json", {
    relationships_following: [
      record("sample.active", 1609977600),
      record("sample.unknown"),
      record(longUsername),
      record(deleted, 1609459200),
    ],
  }),
  file("pending_follow_requests.json", {
    relationships_follow_requests_sent: [record("sample.active", 1609459200)],
  }),
  file("close_friends.json", {
    relationships_close_friends: [record("sample.active", 1609459200)],
  }),
];
const snapshot = (
  exportDate: string,
  followers: string[],
  following: string[],
) => ({
  id: `drawer-${exportDate}`,
  version: 1,
  createdAt: 1,
  exportDate,
  followers,
  following,
});
const history = [
  snapshot("2025-10-15", [], []),
  snapshot("2025-01-15", ["sample.active"], ["sample.active"]),
  snapshot("2025-07-15", ["sample.active"], []),
  { ...snapshot("2025-08-15", [], []), followers: ["invalid username"] },
];
const drawer = (page: Page) => page.getByRole("dialog");
const value = (view: Locator, label: string) =>
  view.getByText(label, { exact: true }).locator("..").locator("dd");
const opener = (page: Page, name: string) =>
  page.locator(".accounts").getByRole("button", {
    name: `Inspect relationship with ${name}`,
    exact: true,
  });
async function close(page: Page) {
  await drawer(page)
    .getByRole("button", { name: "Close relationship details" })
    .click();
  await expect(drawer(page)).toHaveCount(0);
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("account details open locally with accurate dates, contained focus, Escape and restored row focus", async ({
  page,
  isMobile,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page, files);
  const trigger = opener(page, "@sample.active");
  await trigger.focus();
  const scroll = await page.evaluate(() => scrollY);
  await page.keyboard.press("Enter");
  const panel = drawer(page);
  await expect(panel).toHaveAccessibleName("@sample.active");
  await expect(
    panel.getByRole("button", { name: "Close relationship details" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    panel.getByRole("link", { name: "Open full Relationship Timeline" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    panel.getByRole("button", { name: "Close relationship details" }),
  ).toBeFocused();
  const summary = panel.getByRole("region", {
    name: "Account summary",
    exact: true,
  });
  await expect(value(summary, "State in active export")).toHaveText("Mutual");
  await expect(value(summary, "Follower date")).toHaveText("Jan 1, 2021");
  await expect(value(summary, "Following date")).toHaveText("Jan 7, 2021");
  await expect(value(summary, "Recorded first")).toHaveText(
    "They followed you first",
  );
  await expect(
    panel.getByRole("link", { name: "Open Instagram profile" }),
  ).toHaveAttribute("href", "https://www.instagram.com/sample.active/");
  await expect(
    panel.getByRole("link", { name: "Open full Relationship Timeline" }),
  ).toHaveAttribute("href", "/relationship-timeline/#account=sample.active");
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(
      await panel.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  const bounds = await panel.boundingBox(),
    viewport = page.viewportSize()!;
  expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
  if (isMobile)
    expect(bounds!.width).toBeGreaterThanOrEqual(viewport.width - 32);
  await fits(page);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - scroll)).toBeLessThan(
    48,
  );
  await trigger.click();
  await panel.getByRole("button", { name: "History", exact: true }).click();
  await expect(panel).toContainText("No saved snapshots yet.");
  await close(page);
  await expect(trigger).toBeFocused();
  await opener(page, `@${longUsername}`).click();
  const scrollable = panel.locator(".relationship-drawer-content");
  await scrollable.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    panel.getByRole("button", { name: "Close relationship details" }),
  ).toBeVisible();
  expect(
    await scrollable.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await fits(page);
  await close(page);
});

test("saved drawer history remains confirmed, date-qualified, read-only and reset with a new export", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/followers-analyzer/");
  await seedRecords(page, history);
  await page.reload();
  await upload(page, files);
  const before = await savedRecords(page);
  await opener(page, "@sample.active").click();
  const panel = drawer(page);
  await panel.getByRole("button", { name: "History", exact: true }).click();
  await expect(panel).toContainText("confirm the same account");
  await panel.locator(".timeline-history-options summary").focus();
  await page.keyboard.press("Tab");
  await expect(
    panel.getByRole("button", { name: "Summary", exact: true }),
  ).toBeFocused();
  await panel.locator(".timeline-history-options summary").click();
  const load = panel.getByRole("button", {
    name: "Load saved history",
    exact: true,
  });
  await expect(load).toBeDisabled();
  await panel.getByRole("checkbox").check();
  await load.click();
  await expect(panel).toContainText("3 readable snapshots loaded.");
  await expect(panel.locator("tbody td")).toHaveText([
    "Mutual",
    "Follows you",
    "Absent",
  ]);
  await expect(panel).toContainText("do not establish exact change times");
  await panel.getByRole("button", { name: "Context", exact: true }).click();
  const context = panel.getByRole("region", {
    name: "Account context",
    exact: true,
  });
  await expect(context).toContainText("Sent request recorded");
  await expect(context).toContainText("Close Friends record");
  await expect(context).toContainText("Enter the active export date");
  await expect(context).not.toContainText("Previously mutual");
  await panel.getByLabel("Active export date (optional)").fill("2025-11-15");
  await expect(context).toContainText("Previously mutual in saved history");
  await panel.getByRole("checkbox").uncheck();
  await expect(context).not.toContainText("Previously mutual");
  await expect(load).toBeDisabled();
  await close(page);
  await page
    .getByRole("button", {
      name: "Clear active data & start over",
      exact: true,
    })
    .click();
  await upload(page, files);
  await opener(page, "@sample.active").click();
  await panel.locator(".timeline-history-options summary").click();
  await expect(panel.getByRole("checkbox")).not.toBeChecked();
  await expect(panel.getByLabel("Active export date (optional)")).toHaveValue(
    "",
  );
  await expect(
    value(panel, "Saved snapshots containing this username"),
  ).toHaveText("Saved history not loaded");
  expect(await savedRecords(page)).toEqual(before);
  await fits(page);
});

test("fictional drawer history and optional context stay local and isolated from real saved records", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/followers-analyzer/");
  await seedRecords(page, [
    snapshot("2024-01-15", ["sample.private.real"], ["sample.private.real"]),
  ]);
  await page.reload();
  const before = await savedRecords(page);
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page
    .getByLabel("Search accounts", { exact: true })
    .fill("demo.mutual.0001");
  await opener(page, "@demo.mutual.0001").click();
  const panel = drawer(page);
  await expect(panel).toContainText("Demo data · Fictional example");
  await expect(value(panel, "Recorded first")).toHaveText("You followed first");
  await panel.getByRole("button", { name: "History", exact: true }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(4);
  await expect(panel.locator('a[href*="instagram.com"]')).toHaveCount(0);
  await expect(panel).not.toContainText("sample.private.real");
  await expect(panel.getByRole("checkbox")).toHaveCount(0);
  await close(page);
  for (const [route, username, fact] of [
    ["pending-follow-requests", "demo.request.0001", "Sent request recorded"],
    ["connection-privacy", "demo.closefriend.0001", "Close Friends record"],
    [
      "unfollow-history",
      "demo.unfollow.0001",
      "You unfollowed this account in export history",
    ],
  ]) {
    await page.locator(`.tool-tabs a[href="/${route}/"]`).click();
    await opener(page, `@${username}`).click();
    await panel.getByRole("button", { name: "Context", exact: true }).click();
    await expect(panel.locator(".context-facts")).toContainText(fact);
    await expect(panel.locator('a[href*="instagram.com"]')).toHaveCount(0);
    await fits(page);
    await close(page);
  }
  expect(await savedRecords(page)).toEqual(before);
});

test("deleted and unknown-date accounts retain truthful local details without fabricated profile links or dates", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page, files);
  await opener(page, "Deleted account").click();
  const panel = drawer(page);
  await expect(panel).toHaveAccessibleName("Deleted account");
  await expect(panel).not.toContainText(deleted);
  await expect(panel.locator('a[href*="instagram.com"]')).toHaveCount(0);
  await expect(value(panel, "State in active export")).toHaveText("Mutual");
  await close(page);
  await opener(page, "@sample.unknown").click();
  await expect(value(panel, "Follower date")).toHaveText("Date unavailable");
  await expect(value(panel, "Following date")).toHaveText("Date unavailable");
  await expect(value(panel, "Recorded first")).toHaveText(
    "Recorded first unavailable",
  );
  const leaked: string[] = [];
  page.on("request", (request) => {
    if (
      `${request.url()} ${request.headers().referer ?? ""}`.includes(
        "sample.unknown",
      )
    )
      leaked.push(request.url());
  });
  await panel
    .getByRole("link", { name: "Open full Relationship Timeline" })
    .click();
  await expect(page).toHaveURL(
    /\/relationship-timeline\/#account=sample.unknown$/,
  );
  await expect(drawer(page)).toHaveCount(0);
  const inspector = page.getByRole("region", {
    name: "Inspect a relationship",
    exact: true,
  });
  await expect(
    inspector.getByRole("heading", { name: "@sample.unknown", exact: true }),
  ).toBeVisible();
  await expect(value(inspector, "Recorded first")).toHaveText(
    "Recorded first unavailable",
  );
  expect(leaked).toEqual([]);
});

test("a full-Timeline link on the Timeline itself updates only the local fragment and inspector", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.goto("/relationship-timeline/");
  await upload(page, files);
  page.on("request", (request) =>
    requests.push(`${request.url()} ${request.headers().referer ?? ""}`),
  );
  await opener(page, "@sample.active").click();
  await drawer(page)
    .getByRole("link", { name: "Open full Relationship Timeline" })
    .click();
  await expect(page).toHaveURL(
    /\/relationship-timeline\/#account=sample.active$/,
  );
  await expect(drawer(page)).toHaveCount(0);
  const inspector = page.getByRole("region", {
    name: "Inspect a relationship",
    exact: true,
  });
  await expect(
    inspector.getByRole("heading", { name: "@sample.active", exact: true }),
  ).toBeVisible();
  await inspector
    .getByLabel("Search relationship account")
    .fill("sample.unknown");
  await inspector
    .getByRole("button", { name: "Inspect account", exact: true })
    .click();
  await expect(
    inspector.getByRole("heading", { name: "@sample.unknown", exact: true }),
  ).toBeVisible();
  await opener(page, "@sample.active").click();
  await drawer(page)
    .getByRole("link", { name: "Open full Relationship Timeline" })
    .click();
  await expect(page).toHaveURL(
    /\/relationship-timeline\/#account=sample.active$/,
  );
  await expect(
    inspector.getByRole("heading", { name: "@sample.active", exact: true }),
  ).toBeVisible();
  await opener(page, "@sample.unknown").click();
  await drawer(page)
    .getByRole("link", { name: "Open full Relationship Timeline" })
    .click();
  await expect(
    inspector.getByRole("heading", { name: "@sample.unknown", exact: true }),
  ).toBeVisible();
  expect(
    requests.some(
      (request) =>
        request.includes("sample.active") || request.includes("sample.unknown"),
    ),
  ).toBe(false);
});

test("snapshot comparison rows keep their snapshot semantics instead of opening active-export drawers", async ({
  page,
}) => {
  await page.goto("/snapshot-comparison/");
  await upload(page, newer, "Upload newer snapshot");
  await upload(page, original, "Upload older snapshot");
  const results = page.getByRole("region", {
    name: "Snapshot comparison results",
    exact: true,
  });
  await results
    .getByRole("button", { name: "Missing followers 2", exact: true })
    .click();
  await expect(results.locator(".accounts li")).toHaveCount(2);
  await expect(results.locator(".account-open")).toHaveCount(0);
  await expect(
    results.getByRole("link", { name: "@bob", exact: true }),
  ).toHaveAttribute("href", "https://www.instagram.com/bob/");
  await expect(drawer(page)).toHaveCount(0);
});
