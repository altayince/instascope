import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedRecords, upload } from "../helpers/vault";
import { memoryRecord, seedReviewMemory } from "../helpers/review-memory";
import { isSafeAnalyticsRequest } from "../helpers/analytics";

test.use({ timezoneId: "America/Los_Angeles" });

const header = "username,profile_url,recorded_date";
const deleted = "__deleted__bcdefghijabcdefgh";
const day = (index: number) => Date.UTC(2025, 0, 3 + index, 0, 15) / 1000;
const record = (value: string, timestamp?: number) => ({
  string_list_data: [
    { value, ...(timestamp === undefined ? {} : { timestamp }) },
  ],
});
const json = (name: string, value: unknown) => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(value)),
});
async function downloadCsv(
  button: Locator,
  filename = "instascope-accounts.csv",
) {
  const pending = button.page().waitForEvent("download");
  await button.click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe(filename);
  return readFileSync((await file.path())!, "utf8");
}
const downloadButton = (view: Locator, count: number) =>
  view.getByRole("button", {
    name: `Download CSV (${count.toLocaleString("en-US")})`,
    exact: true,
  });

test("CSV includes every filtered account across pages, in the active sort order, locally", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && !isSafeAnalyticsRequest(request))
      posts.push(request.url());
  });
  const matching = Array.from({ length: 62 }, (_, index) =>
    record(`sample.match.${String(index).padStart(3, "0")}`, day(index)),
  );
  await page.goto("/followers-analyzer/");
  await upload(page, [
    json("followers.json", [...matching, record("sample.excluded", day(90))]),
    json("following.json", []),
  ]);
  const list = page.locator(".account-list");
  await list.getByRole("searchbox").fill("@SAMPLE.MATCH.");
  await list.getByLabel("Sort accounts").selectOption("newest");
  await expect(list.locator(".accounts li")).toHaveCount(50);
  await expect(list).toContainText("Page 1 of 2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const csv = await downloadCsv(downloadButton(list, 62));
  const rows = csv.split("\n");
  expect(rows[0]).toBe(header);
  expect(rows).toHaveLength(63);
  expect(rows.slice(1).map((row) => row.split(",")[0])).toEqual(
    matching.map((entry) => entry.string_list_data[0].value).reverse(),
  );
  expect(rows[1]).toBe(
    "sample.match.061,https://www.instagram.com/sample.match.061/,2025-03-05",
  );
  expect(rows.at(-1)).toBe(
    "sample.match.000,https://www.instagram.com/sample.match.000/,2025-01-03",
  );
  expect(csv).not.toContain("sample.excluded");
  await list.getByRole("button", { name: "Next", exact: true }).click();
  await expect(list.locator(".accounts li")).toHaveCount(12);
  expect(await downloadCsv(downloadButton(list, 62))).toBe(csv);
  await list.getByRole("searchbox").fill("no.match");
  await expect(downloadButton(list, 0)).toBeDisabled();
  expect(posts).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("JSON CSV keeps recorded dates truthful, missing dates blank, and deleted profiles unlinked", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page, [
    json("followers.json", [
      record("sample.known", day(0)),
      record("sample.unknown"),
      record(deleted),
    ]),
    json("following.json", []),
  ]);
  const csv = await downloadCsv(
    downloadButton(page.locator(".account-list"), 3),
  );
  expect(csv.split("\n").slice(1).sort()).toEqual(
    [
      "sample.known,https://www.instagram.com/sample.known/,2025-01-03",
      "sample.unknown,https://www.instagram.com/sample.unknown/,",
      `${deleted},,`,
    ].sort(),
  );
  expect(csv).not.toMatch(
    /parsedAt|importDate|snapshotDate|watch|note|reviewed/,
  );
});

test("HTML CSV preserves the supplied calendar date without asserting a timezone or seconds", async ({
  page,
}) => {
  const html = `<html><body><main class="_a706"><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><div class="_a6-p"><div><div><a href="https://www.instagram.com/sample.html/">sample.html</a></div><div>Jan 03, 2025 1:15 am</div></div></div></div><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><div class="_a6-p"><div><div><a href="https://www.instagram.com/sample.unknown/">sample.unknown</a></div></div></div></div></main></body></html>`;
  await page.goto("/followers-analyzer/");
  await upload(page, [
    {
      name: "followers_1.html",
      mimeType: "text/html",
      buffer: Buffer.from(html),
    },
    json("following.json", []),
  ]);
  const csv = await downloadCsv(
    downloadButton(page.locator(".account-list"), 2),
  );
  expect(csv).toBe(
    [
      header,
      "sample.html,https://www.instagram.com/sample.html/,2025-01-03",
      "sample.unknown,https://www.instagram.com/sample.unknown/,",
    ].join("\n"),
  );
  expect(csv).not.toContain("T01:15");
  expect(csv).not.toContain("Z");
});

test("fictional CSV has a demo filename and no external profile URLs", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const list = page.locator(".account-list");
  await list.getByRole("searchbox").fill("demo.mutual.0001");
  const csv = await downloadCsv(
    downloadButton(list, 1),
    "instascope-demo-accounts.csv",
  );
  expect(csv.split("\n")[0]).toBe(header);
  expect(csv.split("\n")[1]).toMatch(
    /^demo\.mutual\.0001,,(?:\d{4}-\d{2}-\d{2})?$/,
  );
  expect(csv).not.toMatch(/https?:\/\//);
});

test("Cleaner retains its exact selected CSV behavior alongside filtered CSV downloads", async ({
  page,
}) => {
  await page.goto("/instagram-cleaner/");
  await seedReviewMemory(page, [
    memoryRecord("sample.first", {
      watch: true,
      keep: true,
      note: "synthetic private note",
    }),
  ]);
  await page.reload();
  await upload(page, [
    json("followers.json", []),
    json("following.json", [
      record("sample.first", day(0)),
      record("sample.second"),
      record(deleted),
    ]),
  ]);
  const list = page.locator(".account-list");
  await list
    .getByRole("checkbox", { name: "Select sample.first", exact: true })
    .check();
  await list.getByRole("searchbox").fill("second");
  await list
    .getByRole("checkbox", { name: "Select sample.second", exact: true })
    .check();
  expect(await downloadCsv(downloadButton(list, 1))).toBe(
    `${header}\nsample.second,https://www.instagram.com/sample.second/,`,
  );
  const selected = await downloadCsv(
    list.getByRole("button", { name: "Export selected CSV", exact: true }),
    "instascope-review-list.csv",
  );
  expect(selected).toBe(
    "username,profile_url\nsample.first,https://www.instagram.com/sample.first/\nsample.second,https://www.instagram.com/sample.second/",
  );
  await list.getByRole("searchbox").clear();
  await list
    .getByRole("checkbox", { name: "Selected only", exact: true })
    .check();
  const filtered = await downloadCsv(downloadButton(list, 2));
  expect(filtered.split("\n")).toHaveLength(3);
  expect(filtered).not.toContain(deleted);
  expect(filtered).not.toMatch(/watch|keep|note|private|reviewed/);
});

test("Timeline CSV follows the selected direction, period and search", async ({
  page,
}) => {
  await page.goto("/relationship-timeline/?direction=followers");
  await upload(page, [
    json("followers.json", [
      record("sample.january", day(0)),
      record("sample.march", day(61)),
      record("sample.unknown"),
    ]),
    json("following.json", [record("sample.following", day(0))]),
  ]);
  await page.getByLabel("Group dates by").selectOption("month");
  await page
    .getByRole("button", {
      name: "2025-01: 1 dated relationships",
      exact: true,
    })
    .click();
  const list = page.locator(".account-list");
  expect(await downloadCsv(downloadButton(list, 1))).toBe(
    `${header}\nsample.january,https://www.instagram.com/sample.january/,2025-01-03`,
  );
  await page
    .getByRole("button", { name: "Date unavailable (1)", exact: true })
    .click();
  expect(await downloadCsv(downloadButton(list, 1))).toBe(
    `${header}\nsample.unknown,https://www.instagram.com/sample.unknown/,`,
  );
  await page.getByLabel("Relationship direction").selectOption("following");
  expect(await downloadCsv(downloadButton(list, 1))).toBe(
    `${header}\nsample.following,https://www.instagram.com/sample.following/,2025-01-03`,
  );
});

test("request CSV honors its upstream age filter", async ({ page }) => {
  await page.goto("/pending-follow-requests/");
  await upload(page, [
    json("followers.json", []),
    json("following.json", []),
    json("pending_follow_requests.json", [
      record("sample.dated", day(0)),
      record("sample.undated"),
    ]),
  ]);
  await page.getByLabel("Request age", { exact: true }).selectOption("unknown");
  expect(
    await downloadCsv(downloadButton(page.locator(".account-list"), 1)),
  ).toBe(
    `${header}\nsample.undated,https://www.instagram.com/sample.undated/,`,
  );
});

test("snapshot comparison CSV exports the active change set without inventing relationship dates", async ({
  page,
}) => {
  await page.goto("/snapshot-comparison/");
  await upload(
    page,
    [
      json("followers.json", [record("sample.new")]),
      json("following.json", []),
    ],
    "Upload newer snapshot",
  );
  await upload(
    page,
    [
      json("followers.json", [record("sample.old")]),
      json("following.json", []),
    ],
    "Upload older snapshot",
  );
  const results = page.getByRole("region", {
    name: "Snapshot comparison results",
    exact: true,
  });
  expect(await downloadCsv(downloadButton(results, 1))).toBe(
    `${header}\nsample.new,https://www.instagram.com/sample.new/,`,
  );
  await results
    .getByRole("button", { name: "Missing followers 1", exact: true })
    .click();
  expect(await downloadCsv(downloadButton(results, 1))).toBe(
    `${header}\nsample.old,https://www.instagram.com/sample.old/,`,
  );
});

test("Watch CSV includes the complete result list without local review metadata", async ({
  page,
}) => {
  const names = Array.from(
    { length: 58 },
    (_, index) => `sample.watch.${String(index).padStart(3, "0")}`,
  );
  await page.goto("/dashboard/");
  await seedReviewMemory(
    page,
    names.map((username) =>
      memoryRecord(username, { watch: true, note: "private synthetic note" }),
    ),
  );
  await page.reload();
  await upload(page, [
    json("followers.json", [record(names[0], day(0))]),
    json("following.json", []),
  ]);
  const watch = page.getByRole("region", { name: "Watch Circle", exact: true });
  await expect(watch).toContainText("58 watched accounts");
  await watch.locator(".watch-observations summary").click();
  await expect(watch.locator(".watch-observations li")).toHaveCount(50);
  const csv = await downloadCsv(downloadButton(watch, 58));
  expect(csv.split("\n")).toHaveLength(59);
  expect(csv.split("\n").slice(1)).toEqual(
    names.map((name) => `${name},https://www.instagram.com/${name}/,`),
  );
  expect(csv).not.toMatch(/private|note|createdAt|currentState|previousState/);
});

test("Pulse CSV includes every saved username matching the group and search, with unavailable dates blank", async ({
  page,
}) => {
  const matching = Array.from(
    { length: 61 },
    (_, index) => `sample.match.${String(index).padStart(3, "0")}`,
  );
  const names = [...matching, "sample.excluded"];
  await page.goto("/snapshot-vault/");
  await seedRecords(
    page,
    ["2025-01-15", "2025-07-15"].map((exportDate, index) => ({
      id: `csv-pulse-${index}`,
      version: 1,
      createdAt: 1,
      exportDate,
      followers: names,
      following: names,
    })),
  );
  await page.reload();
  const pulse = page.getByRole("region", { name: "Circle Pulse", exact: true });
  await pulse.getByLabel("Search saved usernames").fill("sample.match.");
  await expect(pulse.locator(".pulse-accounts li")).toHaveCount(25);
  const csv = await downloadCsv(downloadButton(pulse, 61));
  expect(csv.split("\n")).toHaveLength(62);
  expect(csv.split("\n").slice(1)).toEqual(
    matching.map((name) => `${name},https://www.instagram.com/${name}/,`),
  );
  expect(csv).not.toContain("sample.excluded");
  expect(csv).not.toMatch(
    /2025-|observedSnapshots|stableState|reappeared|stateChanges/,
  );
  await pulse
    .getByRole("button", { name: "Retention details", exact: true })
    .click();
  await pulse.getByLabel("Account group").selectOption("followers-missing");
  await expect(downloadButton(pulse, 0)).toBeDisabled();
});
