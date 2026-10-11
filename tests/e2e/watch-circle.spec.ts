import { expect, test, type Page } from "@playwright/test";
import { seedRecords, savedRecords, upload } from "../helpers/vault";
import {
  memoryRecord,
  readReviewMemory,
  seedReviewMemory,
} from "../helpers/review-memory";

const usernames = [
  "sample.stable",
  "sample.oneway",
  "sample.incoming",
  "sample.new",
  "sample.gone",
];
const memory = usernames
  .map((username) => memoryRecord(username, { watch: true }))
  .sort((left, right) => left.username.localeCompare(right.username));
const current = [
  {
    name: "followers.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(
        ["sample.stable", "sample.incoming", "sample.new"].map((value) => ({
          string_list_data: [{ value }],
        })),
      ),
    ),
  },
  {
    name: "following.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(
        ["sample.stable", "sample.oneway", "sample.incoming", "sample.new"].map(
          (value) => ({ string_list_data: [{ value }] }),
        ),
      ),
    ),
  },
];
const previous = {
  id: "watch-old",
  version: 1,
  exportDate: "2025-01-15",
  createdAt: 1,
  followers: [
    "sample.stable",
    "sample.oneway",
    "sample.incoming",
    "sample.gone",
  ],
  following: ["sample.stable", "sample.oneway"],
};
const region = (page: Page) =>
  page.getByRole("region", { name: "Watch Circle", exact: true });
async function setup(page: Page, records: unknown[] = [previous]) {
  await page.goto("/dashboard/");
  await seedRecords(page, records);
  await seedReviewMemory(page, memory);
  await page.reload();
  await upload(page, current);
  await expect(region(page)).toContainText("5 watched accounts");
}
async function load(page: Page, date = "2025-02-15") {
  const watch = region(page);
  const options = watch.locator(".watch-comparison-controls");
  if ((await options.getAttribute("open")) === null)
    await options.locator("summary").click();
  await watch
    .getByLabel("Active export date for Watch Circle", { exact: true })
    .fill(date);
  await watch.getByRole("checkbox").check();
  await watch
    .getByRole("button", { name: "Load Watch comparison", exact: true })
    .click();
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

test("Watch Circle uses confirmed dated observations, includes absent identities and never infers causes", async ({
  page,
}) => {
  test.setTimeout(60000);
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(request.url() + (request.postData() ?? "")),
  );
  await setup(page);
  const watch = region(page);
  await expect(watch).toContainText("saved-history comparison not loaded");
  await expect(watch.locator(".watch-change-label")).toHaveCount(0);
  await watch.locator(".watch-comparison-controls summary").click();
  const compare = watch.getByRole("button", {
    name: "Load Watch comparison",
    exact: true,
  });
  await expect(compare).toBeDisabled();
  await watch
    .getByLabel("Active export date for Watch Circle", { exact: true })
    .fill("2025-02-15");
  await expect(compare).toBeDisabled();
  await watch.getByRole("checkbox").check();
  await compare.click();
  await expect(watch).toContainText(
    "4 observed state changes in the loaded comparison context",
  );
  await expect(watch).toContainText(
    "Latest earlier readable saved snapshot: 15 Jan 2025",
  );
  await watch.locator(".watch-observations summary").click();
  const row = (name: string) =>
    watch.locator(".watch-observations li").filter({ hasText: `@${name}` });
  await expect(row("sample.stable")).toContainText("Same observed state");
  await expect(row("sample.oneway").locator("dd")).toHaveText([
    "Mutual",
    "You follow",
  ]);
  await expect(row("sample.incoming").locator("dd")).toHaveText([
    "Follows you",
    "Mutual",
  ]);
  await expect(row("sample.new").locator("dd")).toHaveText([
    "Absent",
    "Mutual",
  ]);
  await expect(row("sample.gone").locator("dd")).toHaveText([
    "Follows you",
    "Absent",
  ]);
  await expect(watch).not.toContainText("unfollowed you");
  await row("sample.gone")
    .getByRole("button", { name: "@sample.gone", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "@sample.gone" });
  await expect(panel).toContainText(
    "Not present in this export’s Followers or Following",
  );
  await expect(
    panel
      .getByRole("region", { name: "Review memory", exact: true })
      .getByRole("button", { name: "Watch", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await fits(page);
  expect(await readReviewMemory(page)).toEqual(memory);
  expect(requests.join("\n")).not.toMatch(
    /sample\.(stable|oneway|incoming|new|gone)/,
  );
});

test("changing and restoring dates, confirmation or Vault revision cannot resurrect a loaded Watch comparison", async ({
  page,
}) => {
  test.setTimeout(60000);
  await setup(page);
  const watch = region(page);
  await load(page);
  await expect(watch).toContainText("4 observed state changes");
  const date = watch.getByLabel("Active export date for Watch Circle", {
    exact: true,
  });
  await date.fill("2025-02-16");
  await expect(watch).toContainText("saved-history comparison not loaded");
  await date.fill("2025-02-15");
  await expect(watch).not.toContainText("4 observed state changes");
  await watch
    .getByRole("button", { name: "Load Watch comparison", exact: true })
    .click();
  await expect(watch).toContainText("4 observed state changes");
  await watch.getByRole("checkbox").uncheck();
  await watch.getByRole("checkbox").check();
  await expect(watch).toContainText("saved-history comparison not loaded");
  await watch
    .getByRole("button", { name: "Load Watch comparison", exact: true })
    .click();
  await expect(watch).toContainText("4 observed state changes");
  await seedRecords(page, [{ ...previous, createdAt: 2, followers: [] }]);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(watch).toContainText("saved-history comparison not loaded");
  await seedRecords(page, [previous]);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(watch).not.toContainText("4 observed state changes");
  await load(page);
  await expect(watch).toContainText("4 observed state changes");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("instascope:snapshot-vault", 1);
        request.onsuccess = () => {
          const db = request.result,
            transaction = db.transaction("snapshots", "readwrite");
          transaction.objectStore("snapshots").clear();
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(watch).toContainText("saved-history comparison not loaded");
  await expect(watch).not.toContainText("4 observed state changes");
  expect(await readReviewMemory(page)).toEqual(memory);
  await fits(page);
});

test("equal/future or unreadable Watch history cannot become an absent comparison; latest readable earlier point is explicit", async ({
  page,
}) => {
  test.setTimeout(60000);
  const corrupt = {
    ...previous,
    id: "watch-corrupt",
    exportDate: "2025-01-25",
    followers: ["invalid username"],
  };
  await setup(page, [
    previous,
    corrupt,
    {
      ...previous,
      id: "watch-future",
      exportDate: "2025-03-15",
      followers: [],
      following: [],
    },
  ]);
  const watch = region(page);
  await load(page, "2025-01-15");
  await expect(watch).toContainText(
    "No earlier readable saved snapshot is available",
  );
  await expect(watch.locator(".watch-change-label")).toHaveCount(0);
  await load(page, "2025-02-15");
  await expect(watch).toContainText("4 observed state changes");
  await expect(watch).toContainText("Unreadable saved records were skipped");
  await expect(watch).toContainText(
    "Latest earlier readable saved snapshot: 15 Jan 2025",
  );
  await fits(page);
});

test("fictional Watch Circle demonstrates two changes without altering real Review Memory or Vault", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await seedRecords(page, [previous]);
  await seedReviewMemory(page, memory);
  await page.reload();
  const beforeMemory = await readReviewMemory(page),
    beforeVault = await savedRecords(page);
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const watch = region(page);
  await expect(watch).toContainText("Demo data · Fictional review memory");
  await expect(watch).toContainText("3 watched accounts");
  await expect(watch).toContainText("2 observed state changes");
  await expect(watch).toContainText("separate teaching fixture");
  await watch.locator(".watch-observations summary").click();
  await expect(watch.locator(".watch-observations li")).toHaveCount(3);
  await expect(
    watch
      .locator(".watch-observations li")
      .filter({ hasText: "@demo.mutual.0100" }),
  ).toContainText("Same observed state");
  await expect(watch.locator('a[href*="instagram.com"]')).toHaveCount(0);
  await watch
    .getByRole("button", { name: "@demo.oneway.0001", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "@demo.oneway.0001" });
  await expect(panel.locator('a[href*="instagram.com"]')).toHaveCount(0);
  await expect(panel).toContainText("Demo data · Fictional review memory");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Use my own export", exact: true })
    .click();
  await upload(page, current);
  await expect(region(page)).toContainText("5 watched accounts");
  await expect(region(page)).toContainText(
    "saved-history comparison not loaded",
  );
  expect(await readReviewMemory(page)).toEqual(beforeMemory);
  expect(await savedRecords(page)).toEqual(beforeVault);
  await fits(page);
});

test("large Watch lists render fifty rows at a time while comparison counts include every watched account", async ({
  page,
}) => {
  test.setTimeout(60000);
  const names = Array.from(
    { length: 120 },
    (_, index) => `sample.watch.${String(index + 1).padStart(4, "0")}`,
  );
  await page.goto("/dashboard/");
  await seedRecords(page, [{ ...previous, followers: names, following: [] }]);
  await seedReviewMemory(
    page,
    names.map((name) => memoryRecord(name, { watch: true })),
  );
  await page.reload();
  await upload(page, current);
  const watch = region(page);
  await expect(watch).toContainText("120 watched accounts");
  await load(page);
  await expect(watch).toContainText("120 observed state changes");
  await watch.locator(".watch-observations summary").click();
  const rows = watch.locator(".watch-observations li");
  const more = watch.getByRole("button", {
    name: "Show more watched accounts",
    exact: true,
  });
  await expect(rows).toHaveCount(50);
  await expect(watch).toContainText("Showing 50 of 120 watched accounts.");
  await more.click();
  await expect(rows).toHaveCount(100);
  await more.click();
  await expect(rows).toHaveCount(120);
  await expect(more).toHaveCount(0);
  await expect(watch).toContainText("120 observed state changes");
  await fits(page);
});
