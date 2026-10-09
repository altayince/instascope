import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { zipSync } from "fflate";
import { savedRecords, seedRecords, upload } from "../helpers/vault";

const snapshot = (date: string, followers: string[], following: string[]) => ({
  id: `context-${date}`,
  version: 1,
  exportDate: date,
  createdAt: 1,
  followers,
  following,
});
const history = [
  snapshot(
    "2025-01-15",
    ["sample.changing", "sample.incoming", "sample.stable"],
    ["sample.changing", "sample.stable"],
  ),
  snapshot(
    "2025-04-15",
    ["sample.changing", "sample.incoming", "sample.stable"],
    ["sample.changing", "sample.incoming", "sample.stable"],
  ),
  snapshot(
    "2025-07-15",
    ["sample.incoming", "sample.stable"],
    ["sample.changing", "sample.incoming", "sample.stable"],
  ),
  snapshot(
    "2025-10-15",
    ["sample.incoming", "sample.stable"],
    ["sample.incoming", "sample.stable"],
  ),
];
const account = (value: string, timestamp?: number) => ({
  string_list_data: [
    { value, ...(timestamp === undefined ? {} : { timestamp }) },
  ],
});
const dated = (day: number, hour = 0) => Date.UTC(2021, 0, day, hour) / 1000;
const exports = [
  {
    name: "followers.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        account("sample.they", dated(1)),
        account("sample.they2", dated(2)),
        account("sample.you", dated(7)),
        account("sample.same", dated(3, 23)),
        account("sample.unknown"),
        account("sample.fan", dated(4)),
        account("SAMPLE.THEY", dated(8)), // duplicate cannot replace the earliest recorded date
      ]),
    ),
  },
  {
    name: "following.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        relationships_following: [
          account("sample.they", dated(7)),
          account("sample.they2", dated(9)),
          account("sample.you", dated(1)),
          account("sample.same", dated(3, 1)),
          account("sample.unknown", dated(2)),
          account("sample.oneway", dated(4)),
        ],
      }),
    ),
  },
];
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function search(page: Page, username: string) {
  const view = page.getByRole("region", {
    name: "Account relationship history",
    exact: true,
  });
  await view.getByLabel("Search account history").fill(username);
  await view
    .getByRole("button", { name: "Search history", exact: true })
    .click();
  return view;
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("real Vault history is chronological, observation-based, cached and read-only", async ({
  page,
}) => {
  await page.goto("/snapshot-vault/");
  await seedRecords(page, [
    ...[...history].reverse(),
    { ...snapshot("2025-08-01", [], []), followers: ["invalid name"] },
  ]);
  await page.reload();
  await expect(page.locator(".vault-row")).toHaveCount(4);
  const before = await savedRecords(page);
  await page.evaluate(() => {
    Object.assign(window, { historyWrites: 0, historyReads: 0 });
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (names, mode, options) {
      const stats = window as unknown as {
        historyWrites: number;
        historyReads: number;
      };
      if (mode === "readwrite") stats.historyWrites++;
      if (
        (typeof names === "string" ? [names] : [...names]).includes(
          "snapshots",
        ) &&
        mode === "readonly"
      )
        stats.historyReads++;
      return transaction.call(this, names, mode, options);
    };
  });
  const view = await search(page, "https://www.instagram.com/SAMPLE.CHANGING/");
  await expect(
    view.getByRole("heading", { name: "@sample.changing", exact: true }),
  ).toBeVisible();
  await expect(view.locator("tbody tr")).toHaveText([
    "15 Jan 2025Mutual",
    "15 Apr 2025Mutual",
    "15 Jul 2025You follow",
    "15 Oct 2025Absent",
  ]);
  await expect(view.locator(".history-transitions li")).toHaveCount(2);
  await expect(view).toContainText(
    "Observed between 15 Apr 2025 and 15 Jul 2025",
  );
  await expect(view).toContainText(
    "Not present in Followers by this snapshot.",
  );
  await expect(view).toContainText(
    "Not present in Following by this snapshot.",
  );
  await expect(view).not.toContainText("1 Aug 2025");
  await expect(view).not.toContainText("Unfollowed on");
  await search(page, "sample.incoming");
  await expect(view).toContainText("Now also present in Following.");
  await search(page, "sample.stable");
  await expect(view).toContainText("No state change observed");
  await search(page, "sample.");
  await view
    .getByRole("button", { name: "@sample.changing", exact: true })
    .click();
  await expect(view.locator("tbody tr")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => (window as unknown as { historyReads: number }).historyReads,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () => (window as unknown as { historyWrites: number }).historyWrites,
    ),
  ).toBe(0);
  expect(await savedRecords(page)).toEqual(before);
  await fits(page);
});

test("one readable snapshot explains limited history without inventing missing points", async ({
  page,
}) => {
  await page.goto("/snapshot-vault/");
  await seedRecords(page, [
    snapshot("2025-01-15", ["sample.only"], []),
    { ...snapshot("2025-04-15", [], []), version: 99 },
  ]);
  await page.reload();
  const view = await search(page, "sample.only");
  await expect(view.locator("tbody tr")).toHaveCount(1);
  await expect(view).toContainText("At least two saved snapshots are needed");
  await expect(view).toContainText("Follows you");
  await fits(page);
});

test("fictional history shows changing, incoming and stable accounts without touching real Vault", async ({
  page,
}) => {
  await page.goto("/snapshot-vault/");
  await seedRecords(page, [
    snapshot("2026-01-15", ["sample.real"], ["sample.real"]),
  ]);
  await page.reload();
  const before = await savedRecords(page);
  await page
    .getByRole("button", { name: "Try Vault demo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/snapshot-vault\/\?demo=true$/);
  await expect(page.getByText(/Demo data · Fictional history/)).toBeVisible();
  const view = await search(page, "demo.oneway.0001");
  await expect(view.locator("tbody tr")).toHaveText([
    "15 Jan 2025Mutual",
    "15 Apr 2025Mutual",
    "15 Jul 2025You follow",
    "15 Oct 2025Absent",
  ]);
  await search(page, "demo.fan.0001");
  await expect(view.locator("tbody tr").first()).toContainText("Follows you");
  await expect(view).toContainText("Now also present in Following");
  await search(page, "demo.mutual.0100");
  await expect(view).toContainText("No state change observed");
  await expect(view.locator('a[href*="instagram.com"]')).toHaveCount(0);
  await expect(page.getByText(/Demo data · Fictional history/)).toBeVisible();
  await fits(page);
  await page.getByRole("button", { name: "Exit demo", exact: true }).click();
  await expect(page.locator(".vault-row")).toHaveCount(1);
  expect(await savedRecords(page)).toEqual(before);
});

test("a username present in only one of several readable snapshots has limited history", async ({
  page,
}) => {
  await page.goto("/snapshot-vault/");
  await seedRecords(page, [
    snapshot("2025-01-15", ["sample.only"], []),
    snapshot("2025-04-15", [], []),
  ]);
  await page.reload();
  const view = await search(page, "sample.only");
  await expect(view.locator("tbody tr")).toHaveCount(2);
  await expect(view).toContainText(
    "This username appears in only one saved snapshot; its history is limited.",
  );
  await expect(view.locator("tbody tr").last()).toContainText("Absent");
  await fits(page);
});

test("current mutual origins retains both dates, filters accessibly and excludes unknown from percent", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page, exports);
  await page
    .getByRole("button", { name: "Explore who followed first", exact: true })
    .click();
  const view = page.getByRole("region", {
    name: "Mutual Origins",
    exact: true,
  });
  await expect(view).toContainText("Among 4 mutuals with usable dates, 50%");
  for (const [label, count] of [
    ["They followed first", 2],
    ["You followed first", 1],
    ["Same recorded day", 1],
    ["Date unavailable", 1],
  ] as const) {
    const filter = view.getByRole("button", {
      name: `${label} ${count}`,
      exact: true,
    });
    await filter.focus();
    await filter.press("Enter");
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect(view.locator(".accounts li")).toHaveCount(count);
    await expect(view.locator(".accounts li").first()).toContainText(
      `Recorded first: ${label}`,
    );
  }
  await view
    .getByRole("button", { name: "They followed first 2", exact: true })
    .click();
  const row = view
    .locator(".accounts li")
    .filter({ hasText: "@sample.they" })
    .first();
  await expect(row).toContainText("Follower date: Jan 1, 2021");
  await expect(row).toContainText("Following date: Jan 7, 2021");
  await expect(
    row.getByRole("link", { name: "@sample.they", exact: true }),
  ).toHaveAttribute("href", "https://www.instagram.com/sample.they/");
  await expect(view).toContainText("may reflect refollows");
  await fits(page);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Followers 6/ })).toBeVisible();
});

test("HTML mutual origins compares recorded days, never timezone-less hours", async ({
  page,
}) => {
  const html = (following: boolean) =>
    `<!doctype html><html><body><main class="_a706">${[
      [
        "sample.same",
        following ? "Jan 03, 2021 1:00 am" : "Jan 03, 2021 11:00 pm",
      ],
      [
        "sample.earlier",
        following ? "Jan 07, 2021 12:00 am" : "Jan 01, 2021 12:00 pm",
      ],
      ["sample.missing", following ? "Jan 01, 2021 2:05 pm" : "malformed date"],
    ]
      .map(
        ([name, date]) =>
          `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">${following ? `<h2 class="_a6-h">${name}</h2>` : ""}<div class="_a6-p"><div><div><a href="https://www.instagram.com/${name}/">${name}</a></div><div>${date}</div></div></div></div>`,
      )
      .join("")}</main></body></html>`;
  const zip = zipSync({
    "connections/followers_and_following/followers_1.html": Buffer.from(
      html(false),
    ),
    "connections/followers_and_following/following.html": Buffer.from(
      html(true),
    ),
  });
  await page.goto("/following-analyzer/");
  await upload(page, [
    {
      name: "synthetic-context.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zip),
    },
  ]);
  await page
    .getByRole("button", { name: "Explore who followed first", exact: true })
    .click();
  const view = page.getByRole("region", {
    name: "Mutual Origins",
    exact: true,
  });
  await expect(view).toContainText("Among 2 mutuals with usable dates, 50%");
  await view
    .getByRole("button", { name: "Same recorded day 1", exact: true })
    .click();
  await expect(view.locator(".accounts li")).toContainText("@sample.same");
  await expect(view.locator(".accounts li")).toContainText(
    "Follower date: Jan 3, 2021",
  );
  await expect(view.locator(".accounts li")).toContainText(
    "Following date: Jan 3, 2021",
  );
  await expect(view).toContainText("HTML dates have no timezone");
  await expect(view.locator(".accounts li")).not.toContainText("hours");
  await fits(page);
});

test("saved context is opt-in with a real export date and same-account confirmation across lists", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/followers-analyzer/");
  await seedRecords(page, [
    snapshot("2025-01-15", ["sample.oneway"], ["sample.oneway", "sample.fan"]),
    snapshot("2026-01-15", ["sample.you"], ["sample.you"]),
  ]);
  await page.reload();
  await upload(page, exports);
  const before = await savedRecords(page);
  for (const [category, accountName, text] of [
    [
      "Not following back 1",
      "sample.oneway",
      "Previously mutual in saved history",
    ],
    ["Fans 1", "sample.fan", "You followed this account in saved history"],
  ]) {
    await page
      .getByRole("button", { name: new RegExp(`^${category}`) })
      .click();
    const details = page.locator(".saved-history-context");
    if ((await details.getAttribute("open")) === null)
      await details.locator("summary").click();
    const button = details.getByRole("button", {
      name: "Show saved history context",
      exact: true,
    });
    await expect(button).toBeDisabled();
    await details.getByLabel("Active export date").fill("2025-07-15");
    await expect(button).toBeDisabled();
    await details.getByRole("checkbox").check();
    await button.click();
    await expect(details).toContainText(
      "1 earlier readable snapshots reviewed",
    );
    await expect(
      page.locator(".accounts li").filter({ hasText: `@${accountName}` }),
    ).toContainText(text);
    await details.getByRole("checkbox").uncheck();
    await expect(page.locator(".accounts")).not.toContainText(text);
  }
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "InstaCleaner", exact: true })
    .click();
  await page.locator(".saved-history-context summary").click();
  await page
    .locator(".saved-history-context")
    .getByLabel("Active export date")
    .fill("2025-07-15");
  await page.locator(".saved-history-context").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Show saved history context", exact: true })
    .click();
  await expect(
    page.locator(".accounts li").filter({ hasText: "@sample.oneway" }),
  ).toContainText("Previously mutual in saved history");
  await page
    .locator(".saved-history-context")
    .getByLabel("Active export date")
    .fill("2025-01-15");
  await expect(page.locator(".accounts")).not.toContainText(
    "Previously mutual in saved history",
  );
  await page
    .getByRole("button", { name: "Show saved history context", exact: true })
    .click();
  await expect(page.locator(".saved-history-context")).toContainText(
    "0 earlier readable snapshots reviewed",
  );
  expect(await savedRecords(page)).toEqual(before);
  await fits(page);
});

test("demo origins covers every category and the aggregate Wrapped PNG excludes private identities", async ({
  page,
}) => {
  test.setTimeout(60000);
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:3000")
      external.push(request.url());
  });
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.assign(window, { originDrawnTexts: texts });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof original>
    ) {
      texts.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.goto("/followers-analyzer/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore who followed first", exact: true })
    .click();
  const view = page.getByRole("region", {
    name: "Mutual Origins",
    exact: true,
  });
  await expect(view).toContainText("Among 719 mutuals with usable dates");
  for (const label of [
    "They followed first",
    "You followed first",
    "Same recorded day",
    "Date unavailable",
  ]) {
    const filter = view.getByRole("button", {
      name: new RegExp(`^${label} [1-9][0-9]*$`),
    });
    await filter.click();
    await expect(view.locator(".accounts li").first()).toContainText("@demo.");
    await expect(view.locator('a[href*="instagram.com"]')).toHaveCount(0);
  }
  await fits(page);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Wrapped stories" })
    .getByRole("button", { name: "Recorded first", exact: true })
    .click();
  const card = page.locator(".wrapped-card");
  await expect(card).toContainText("of dated mutuals");
  await expect(card).toContainText("Refollows");
  await expect(card).not.toContainText("demo.");
  await expect(card).not.toContainText("blocked");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download my Wrapped", exact: true })
    .click();
  const download = await downloadPromise;
  const png = sharp(await readFile((await download.path())!));
  expect(await png.metadata()).toMatchObject({ width: 1080, height: 1920 });
  const drawn = await page.evaluate(() =>
    (window as unknown as { originDrawnTexts: string[] }).originDrawnTexts.join(
      " ",
    ),
  );
  expect(drawn).toContain("dated mutuals");
  expect(drawn).not.toMatch(
    /demo\.|blocked|restricted|close friends|story hidden/i,
  );
  expect(external).toEqual([]);
  await fits(page);
});

test("history and current origin remain separate and real identity needs confirmation", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await seedRecords(page, [
    snapshot("2025-01-15", ["sample.they"], ["sample.they"]),
  ]);
  await page.reload();
  await upload(page, exports);
  await page.getByRole("link", { name: "Open Vault", exact: true }).click();
  const view = await search(page, "sample.they");
  const origin = view.getByRole("complementary", {
    name: "Current export origin",
  });
  await expect(origin).not.toContainText("Recorded first:");
  await origin.getByRole("checkbox").check();
  await expect(origin).toContainText("Recorded first: They followed first");
  await expect(origin).toContainText(
    "Vault does not store relationship dates or past origins",
  );
  await expect(view.locator("tbody tr")).toHaveCount(1);
  const saved = await savedRecords(page);
  expect(Object.keys(saved[0]).sort()).toEqual([
    "createdAt",
    "exportDate",
    "followers",
    "following",
    "id",
    "version",
  ]);
  await fits(page);
});

test("demo optional context uses only fictional history and remains non-clickable", async ({
  page,
}) => {
  await page.goto("/not-following-back/");
  await seedRecords(page, [
    snapshot("2024-01-15", ["sample.real"], ["sample.real"]),
  ]);
  await page.reload();
  const before = await savedRecords(page);
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const row = page
    .locator(".accounts li")
    .filter({ hasText: "@demo.oneway.0001" });
  await expect(row).not.toContainText("Previously mutual");
  await page.locator(".saved-history-context summary").click();
  const details = page.locator(".saved-history-context");
  await details.getByLabel("Active export date").fill("2026-01-15");
  await details.getByRole("checkbox").check();
  await details
    .getByRole("button", { name: "Show saved history context", exact: true })
    .click();
  await expect(details).toContainText("4 earlier readable snapshots reviewed");
  await expect(row).toContainText("Previously mutual in saved history");
  await expect(page.locator('.accounts a[href*="instagram.com"]')).toHaveCount(
    0,
  );
  expect(await savedRecords(page)).toEqual(before);
  await fits(page);
});
