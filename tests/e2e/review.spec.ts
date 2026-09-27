import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";

function rows(...entries: { username: string; timestamp?: number }[]) {
  return entries.map(({ username, timestamp }) => ({
    string_list_data: [
      { value: username, ...(timestamp ? { timestamp } : {}) },
    ],
  }));
}
async function upload(page: Page, includeOptional = true) {
  const parts: Record<string, Uint8Array> = {
    "followers.json": strToU8(
      JSON.stringify(rows({ username: "mutual", timestamp: 1704067200 })),
    ),
    "following.json": strToU8(
      JSON.stringify(
        rows(
          { username: "one.way", timestamp: 1672531200 },
          { username: "mutual", timestamp: 1704067200 },
          { username: "undated" },
        ),
      ),
    ),
  };
  if (includeOptional) {
    parts["connections/pending_follow_requests.json"] = strToU8(
      JSON.stringify([
        {
          timestamp: 1704067200,
          label_values: [{ label: "Username", value: "one.way" }],
        },
        {
          timestamp: 1736467200,
          label_values: [{ label: "Username", value: "request.only" }],
        },
      ]),
    );
    parts["connections/recently_unfollowed_profiles.json"] = strToU8(
      JSON.stringify([
        {
          timestamp: 1704067200,
          label_values: [{ label: "Username", value: "one.way" }],
        },
        {
          timestamp: 1736467200,
          label_values: [{ label: "Username", value: "one.way" }],
        },
        {
          timestamp: 1704067200,
          label_values: [{ label: "Username", value: "gone" }],
        },
      ]),
    );
  }
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles({
      name: "synthetic-review.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zipSync(parts)),
    });
  await expect(
    page.getByRole("region", { name: "Relationship Review" }),
  ).toBeVisible();
}

test("Relationship Review keeps one manual shortlist across signals, filters and repeated events", async ({
  page,
}) => {
  await page.goto("/instagram-cleaner/");
  await upload(page);
  const review = page.getByRole("region", { name: "Relationship Review" });
  await expect(
    review.getByRole("button", { name: /One-way follows 2/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("checkbox", { name: "Select one.way" }).check();
  await page.getByRole("searchbox").fill("undated");
  await expect(review).toContainText("1 selected");
  await review.getByRole("button", { name: /Pending requests 2/ }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select one.way" }),
  ).toBeChecked();
  await page.getByLabel("Age reference date (UTC)").fill("2025-01-15");
  await page.getByLabel("Request age", { exact: true }).selectOption("365");
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await page.getByLabel("Request age", { exact: true }).selectOption("all");
  await page.getByRole("checkbox", { name: "Select request.only" }).check();
  await review.getByRole("button", { name: /You unfollowed 2/ }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select one.way" }),
  ).toBeChecked();
  await expect(page.locator(".accounts li")).toHaveCount(2);
  await page.getByRole("checkbox", { name: "Select gone" }).check();
  await review.getByRole("button", { name: /Mutuals 1/ }).click();
  await page.getByRole("checkbox", { name: "Select mutual" }).check();
  await review.getByRole("button", { name: /Review list 4/ }).click();
  await expect(page.locator(".accounts li")).toHaveCount(4);
  await expect(page.getByText("@one.way", { exact: true })).toHaveCount(1);
  await expect(
    page.locator(".accounts li").filter({ hasText: "@one.way" }),
  ).toContainText("Sent request recorded");
  await expect(
    page.locator(".accounts li").filter({ hasText: "@one.way" }),
  ).toContainText("You unfollowed");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected CSV" }).click();
  const csv = readFileSync((await (await download).path())!, "utf8");
  expect(
    csv.split("\n").filter((line) => line.startsWith("one.way,")),
  ).toHaveLength(1);
  expect(csv.trim().split("\n")).toHaveLength(5);
  await page.getByRole("checkbox", { name: "Select request.only" }).click();
  await expect(
    review.getByRole("button", { name: /Review list 3/ }),
  ).toBeVisible();
  await expect(page.locator(".accounts li")).toHaveCount(3);
  await review
    .getByRole("button", { name: /Oldest recorded follows 2/ })
    .click();
  await expect(page.locator(".accounts li").first()).toContainText("@one.way");
  await page.getByLabel("Recorded follow year").selectOption("2023");
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await page.getByLabel("Recorded follow year").selectOption("all");
  await review
    .getByRole("button", { name: /Newest recorded follows 2/ })
    .click();
  await expect(page.locator(".accounts li").first()).toContainText("@mutual");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("basic export keeps review usable and explains absent optional lists", async ({
  page,
}) => {
  await page.goto("/instagram-cleaner/");
  await upload(page, false);
  const review = page.getByRole("region", { name: "Relationship Review" });
  await review
    .getByRole("button", { name: /Pending requests Not included/ })
    .click();
  await expect(review).toContainText("Not included in this export");
  await expect(
    review.getByRole("link", {
      name: "See which optional categories to include",
    }),
  ).toHaveAttribute("href", "/how-to-download-instagram-followers-data/");
  await review
    .getByRole("button", { name: /You unfollowed Not included/ })
    .click();
  await expect(review).toContainText("Not included in this export");
  await review.getByRole("button", { name: /One-way follows 2/ }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select one.way" }),
  ).toBeVisible();
});
