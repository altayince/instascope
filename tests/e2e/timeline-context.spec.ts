import { expect, test, type Page, type Locator } from "@playwright/test";
import { zipSync } from "fflate";
import { savedRecords, seedRecords, upload } from "../helpers/vault";

const account = (value: string, timestamp?: number) => ({
  string_list_data: [
    { value, ...(timestamp === undefined ? {} : { timestamp }) },
  ],
});
const day = (d: number) => Date.UTC(2021, 0, d) / 1000;
const file = (name: string, data: unknown) => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(data)),
});
const exports = [
  file("followers.json", [
    account("sample.they", day(1)),
    account("sample.you", day(7)),
    account("sample.same", day(3)),
    account("sample.unknown"),
    account("sample.incoming", day(4)),
  ]),
  file("following.json", {
    relationships_following: [
      account("sample.they", day(7)),
      account("sample.you", day(1)),
      account("sample.same", day(3)),
      account("sample.unknown", day(2)),
      account("sample.changing", day(4)),
      account("sample.outgoing", day(5)),
    ],
  }),
];
const snapshot = (
  exportDate: string,
  followers: string[],
  following: string[],
) => ({
  id: `timeline-${exportDate}`,
  version: 1,
  createdAt: 1,
  exportDate,
  followers,
  following,
});
const history = [
  snapshot("2025-10-15", ["sample.incoming"], ["sample.outgoing"]),
  snapshot(
    "2025-01-15",
    ["sample.changing", "sample.incoming", "saved.only"],
    ["sample.changing", "sample.outgoing"],
  ),
  snapshot(
    "2025-07-15",
    ["sample.incoming"],
    ["sample.changing", "sample.outgoing"],
  ),
  snapshot(
    "2025-04-15",
    ["sample.changing", "sample.incoming"],
    ["sample.changing", "sample.outgoing"],
  ),
  { ...snapshot("2025-08-15", [], []), followers: ["invalid name"] },
];
const inspector = (page: Page) =>
  page.getByRole("region", { name: "Inspect a relationship", exact: true });
const value = (view: Locator, label: string) =>
  view.getByText(label, { exact: true }).locator("..").locator("dd");
async function inspect(page: Page, name: string) {
  const view = inspector(page);
  await view.getByLabel("Search relationship account").fill(name);
  await view
    .getByRole("button", { name: "Inspect account", exact: true })
    .click();
  return view;
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function loadHistory(page: Page) {
  const view = inspector(page);
  await view.locator(".timeline-history-options summary").click();
  const load = view.getByRole("button", {
    name: "Load saved history",
    exact: true,
  });
  await expect(load).toBeDisabled();
  await view.getByRole("checkbox").check();
  await load.click();
  return view;
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Followers has only its date insight; Mutuals alone exposes the compact recorded-first insight", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page, exports);
  await expect(
    page.getByRole("link", { name: "Explore follower dates", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Explore who followed first", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Mutuals / }).click();
  const link = page.getByRole("link", {
    name: "Explore who followed first",
    exact: true,
  });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", "#mutual-origins");
  await expect(
    page.getByRole("link", { name: "Explore follower dates", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".workspace-insights")).toContainText("Insights");
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mutual-origins")).toBeFocused();
  await expect(
    page
      .getByRole("region", { name: "Mutual Origins", exact: true })
      .getByRole("button", { name: "All mutuals 4", exact: true }),
  ).toBeVisible();
  await fits(page);
  await page.getByRole("button", { name: /^Following / }).click();
  await expect(
    page.getByRole("link", { name: "Explore who followed first", exact: true }),
  ).toHaveCount(0);
});

test("Timeline summary searches normalized accounts and retains recorded-date controls and useful no-Vault state", async ({
  page,
}) => {
  await page.goto("/relationship-timeline/?direction=followers");
  await upload(page, exports);
  const view = inspector(page);
  await expect(value(view, "Dated followers")).toHaveText("4");
  await expect(value(view, "Dated following")).toHaveText("6");
  await expect(value(view, "Mutuals with both dates")).toHaveText("3");
  await expect(value(view, "Saved snapshots available")).toHaveText("0");
  await inspect(page, "https://www.instagram.com/SAMPLE.THEY/");
  const summary = view.getByRole("region", {
    name: "Account summary",
    exact: true,
  });
  await expect(value(summary, "State in active export")).toHaveText("Mutual");
  await expect(value(summary, "Recorded first")).toHaveText(
    "They followed you first",
  );
  await expect(value(summary, "Follower date")).toHaveText("Jan 1, 2021");
  await expect(value(summary, "Following date")).toHaveText("Jan 7, 2021");
  await inspect(page, "sample.");
  const matches = view.locator(".timeline-matches");
  await expect(matches.getByRole("button")).toHaveCount(7);
  await matches
    .getByRole("button", { name: "@sample.you", exact: true })
    .click();
  await expect(value(summary, "Recorded first")).toHaveText(
    "You followed first",
  );
  await inspect(page, "sample.unknown");
  await expect(value(summary, "Recorded first")).toHaveText(
    "Recorded first unavailable",
  );
  await expect(value(summary, "Follower date")).toHaveText("Date unavailable");
  await view.getByRole("button", { name: "Context", exact: true }).click();
  await expect(
    view
      .getByRole("region", { name: "Account context", exact: true })
      .locator(".context-facts li"),
  ).toHaveText(["Mutual in current export", "Recorded first unavailable"]);
  const savedTab = view.getByRole("button", {
    name: "Saved History",
    exact: true,
  });
  await savedTab.focus();
  await page.keyboard.press("Enter");
  await expect(savedTab).toHaveAttribute("aria-pressed", "true");
  await expect(view).toContainText("No saved snapshots yet.");
  await expect(
    view.getByRole("link", { name: "Open Snapshot Vault", exact: true }),
  ).toHaveAttribute("href", "/snapshot-vault/");
  await page.getByLabel("Relationship direction").selectOption("followers");
  await page.getByLabel("Group dates by").selectOption("month");
  await page
    .getByRole("button", { name: "Date unavailable (1)", exact: true })
    .click();
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.locator(".accounts")).toContainText("sample.unknown");
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await page.getByLabel("Search accounts").fill("incoming");
  await expect(page.locator(".accounts")).toContainText("sample.incoming");
  await fits(page);
});

test("HTML Timeline preserves both recorded calendar dates without inferring timezone-less ordering by hour", async ({
  page,
}) => {
  const html = (date: string) =>
    `<html><body><main class="_a706"><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><div class="_a6-p"><div><div><a href="https://www.instagram.com/sample.html/">sample.html</a></div><div>${date}</div></div></div></div></main></body></html>`;
  const zip = zipSync({
    "connections/followers_and_following/followers_1.html": Buffer.from(
      html("Jan 03, 2021 11:00 pm"),
    ),
    "connections/followers_and_following/following.html": Buffer.from(
      html("Jan 03, 2021 1:00 am"),
    ),
  });
  await page.goto("/relationship-timeline/");
  await upload(page, [
    {
      name: "synthetic-html.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zip),
    },
  ]);
  const view = await inspect(page, "sample.html");
  await expect(value(view, "Recorded first")).toHaveText("Same recorded day");
  await expect(value(view, "Follower date")).toHaveText("Jan 3, 2021");
  await expect(value(view, "Following date")).toHaveText("Jan 3, 2021");
  await expect(view).toContainText("HTML dates have no timezone");
  await fits(page);
});

test("Saved Timeline history is chronological and read-only, confirmed, with date-qualified previous context", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/relationship-timeline/");
  await seedRecords(page, history);
  await page.reload();
  await upload(page, exports);
  const before = await savedRecords(page),
    view = await loadHistory(page);
  await expect(view).toContainText("4 readable snapshots loaded.");
  await inspect(page, "sample.changing");
  const summary = view.getByRole("region", {
    name: "Account summary",
    exact: true,
  });
  await expect(value(summary, "State in active export")).toHaveText(
    "You follow",
  );
  await expect(
    value(summary, "Saved snapshots containing this username"),
  ).toHaveText("3 of 4 readable snapshots");
  await expect(value(summary, "Observed state changes")).toHaveText("2");
  await expect(value(summary, "First present in saved snapshot")).toHaveText(
    "15 Jan 2025",
  );
  await expect(value(summary, "Latest present in saved snapshot")).toHaveText(
    "15 Jul 2025",
  );
  await view
    .getByRole("button", { name: "Saved History", exact: true })
    .click();
  const saved = view.getByRole("region", {
    name: "Timeline saved history",
    exact: true,
  });
  await expect(saved.locator("tbody tr")).toHaveText([
    "15 Jan 2025Mutual",
    "15 Apr 2025Mutual",
    "15 Jul 2025You follow",
    "15 Oct 2025Absent",
  ]);
  await expect(saved).toContainText(
    "Not present in Followers by this snapshot.",
  );
  await expect(saved).toContainText(
    "Not present in Following by this snapshot.",
  );
  await expect(saved).not.toContainText("unfollowed on");
  await view.getByRole("button", { name: "Context", exact: true }).click();
  const context = view.getByRole("region", {
    name: "Account context",
    exact: true,
  });
  await expect(context).toContainText("Enter the active export date");
  await expect(context).not.toContainText("Previously mutual");
  await view.getByLabel("Active export date (optional)").fill("2025-07-15");
  await expect(context).toContainText("Previously mutual in saved history");
  for (const [name, text] of [
    ["sample.incoming", "Previously followed you in saved history"],
    ["sample.outgoing", "Previously you followed in saved history"],
  ]) {
    await inspect(page, name);
    await view.getByRole("button", { name: "Context", exact: true }).click();
    await expect(context).toContainText(text);
  }
  await view.getByLabel("Active export date (optional)").fill("2025-01-15");
  await expect(context).not.toContainText("Previously");
  await inspect(page, "saved.only");
  await expect(value(summary, "State in active export")).toHaveText(
    "Not present in this export’s Followers or Following",
  );
  await expect(
    value(summary, "Saved snapshots containing this username"),
  ).toHaveText("1 of 4 readable snapshots");
  await view
    .getByRole("button", { name: "Saved History", exact: true })
    .click();
  await expect(saved).toContainText(
    "This username appears in only one saved snapshot",
  );
  await view.getByRole("checkbox").uncheck();
  await view.getByRole("button", { name: "Summary", exact: true }).click();
  await expect(
    value(summary, "Saved snapshots containing this username"),
  ).toHaveText("Saved history not loaded");
  await expect(
    view.getByRole("button", { name: "Load saved history", exact: true }),
  ).toBeDisabled();
  await view.getByRole("checkbox").check();
  await expect(
    value(summary, "Saved snapshots containing this username"),
  ).toHaveText("1 of 4 readable snapshots");
  await page
    .getByRole("button", {
      name: "Clear active data & start over",
      exact: true,
    })
    .click();
  await upload(page, exports);
  await view.locator(".timeline-history-options summary").click();
  await inspect(page, "sample.changing");
  await expect(view.getByRole("checkbox")).not.toBeChecked();
  await expect(view.getByLabel("Active export date (optional)")).toHaveValue(
    "",
  );
  await expect(
    value(summary, "Saved snapshots containing this username"),
  ).toHaveText("Saved history not loaded");
  expect(await savedRecords(page)).toEqual(before);
  await fits(page);
});

test("One readable snapshot needs another observation and corrupt records never create absent rows", async ({
  page,
}) => {
  await page.goto("/relationship-timeline/");
  await seedRecords(page, [history[1], history[4]]);
  await page.reload();
  await upload(page, exports);
  const view = await loadHistory(page);
  await expect(view).toContainText("1 readable snapshots loaded.");
  await inspect(page, "sample.changing");
  await view
    .getByRole("button", { name: "Saved History", exact: true })
    .click();
  await expect(view.locator("tbody tr")).toHaveCount(1);
  await expect(view).toContainText(
    "More than one saved snapshot is needed to observe changes.",
  );
  await expect(view.locator("tbody")).not.toContainText("Absent");
});

test("Context shows all six active optional records without inventing state or missing-category facts", async ({
  page,
}) => {
  await page.goto("/relationship-timeline/");
  await upload(page, [
    ...exports,
    ...[
      ["pending_follow_requests.json", "relationships_follow_requests_sent"],
      ["recently_unfollowed_profiles.json", "relationships_unfollowed_users"],
      ["close_friends.json", "relationships_close_friends"],
      ["blocked_profiles.json", "relationships_blocked_users"],
      ["restricted_profiles.json", "relationships_restricted_users"],
      ["hide_story_from.json", "relationships_hide_stories_from"],
    ].map(([name, key]) =>
      file(name, { [key]: [account("sample.private", day(4))] }),
    ),
  ]);
  const view = await inspect(page, "SAMPLE.PRIVATE");
  await expect(value(view, "State in active export")).toHaveText(
    "Not present in this export’s Followers or Following",
  );
  await view.getByRole("button", { name: "Context", exact: true }).click();
  const context = view.getByRole("region", {
    name: "Account context",
    exact: true,
  });
  await expect(context.locator(".context-facts li")).toHaveText([
    "Sent request recorded",
    "You unfollowed this account in export history",
    "Close Friends record",
    "Blocked account record",
    "Restricted account record",
    "Story hidden from record",
  ]);
  await expect(context).toContainText("does not prove it is still pending");
  await expect(context).toContainText("not added to Wrapped or shared cards");
  await expect(context.locator(".context-facts")).not.toContainText("Absent");
  await fits(page);
  await inspect(page, "sample.incoming");
  await view.getByRole("button", { name: "Context", exact: true }).click();
  await expect(context.locator(".context-facts li")).toHaveText([
    "Follows you in current export",
  ]);
  await page
    .getByRole("button", {
      name: "Clear active data & start over",
      exact: true,
    })
    .click();
  await upload(page, exports);
  await inspect(page, "sample.changing");
  await view.getByRole("button", { name: "Context", exact: true }).click();
  await expect(context.locator(".context-facts li")).toHaveText([
    "You follow in current export",
  ]);
  await expect(context.locator(".context-facts")).not.toContainText("Blocked");
});

test("Eight fictional Timeline examples stay unlinked and isolated from real Vault history", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/relationship-timeline/");
  await seedRecords(page, [
    snapshot("2024-01-15", ["sample.private.real"], ["sample.private.real"]),
  ]);
  await page.reload();
  const before = await savedRecords(page);
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const view = inspector(page);
  await expect(page.locator(".demo-notice")).toContainText(
    "Demo data · Fictional example",
  );
  await expect(value(view, "Fictional saved snapshots")).toHaveText("4");
  const examples = view.getByLabel("Fictional example");
  await examples.selectOption("demo.mutual.0100");
  await expect(value(view, "Observed state changes")).toHaveText("0");
  for (const [name, states] of [
    ["demo.oneway.0001", ["Mutual", "Mutual", "You follow", "Absent"]],
    ["demo.fan.0001", ["Follows you", "Mutual", "Mutual", "Mutual"]],
  ] as const) {
    await examples.selectOption(name);
    await view
      .getByRole("button", { name: "Saved History", exact: true })
      .click();
    await expect(view.locator("tbody td")).toHaveText([...states]);
  }
  for (const [name, text] of [
    ["demo.mutual.0002", "They followed you first"],
    ["demo.mutual.0001", "You followed first"],
    ["demo.mutual.0003", "Same recorded day"],
    ["demo.mutual.0032", "Recorded first unavailable"],
  ]) {
    await examples.selectOption(name);
    await expect(value(view, "Recorded first")).toHaveText(text);
    await fits(page);
  }
  await examples.selectOption("demo.request.0001");
  await view.getByRole("button", { name: "Context", exact: true }).click();
  await expect(view.locator(".context-facts li")).toHaveText([
    "Sent request recorded",
  ]);
  await expect(view.locator('a[href*="instagram.com"]')).toHaveCount(0);
  await expect(view).not.toContainText("sample.private.real");
  await expect(view.getByRole("checkbox")).toHaveCount(0);
  expect(await savedRecords(page)).toEqual(before);
  await fits(page);
});
