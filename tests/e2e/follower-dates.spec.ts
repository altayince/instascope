import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { zipSync } from "fflate";

test("Followers renders valid dates and labels unusable source dates", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      {
        name: "followers.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify([
            {
              string_list_data: [
                { value: "dated.follower", timestamp: 1609459200 },
              ],
            },
            { string_list_data: [{ value: "undated.follower" }] },
            {
              string_list_data: [
                {
                  value: "malformed.follower",
                  timestamp: "not-a-timestamp",
                },
              ],
            },
          ]),
        ),
      },
      {
        name: "following.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"relationships_following":[]}'),
      },
    ]);

  await expect(page.getByRole("button", { name: /Followers 3/ })).toBeVisible();

  const dated = page.locator(".accounts li").filter({
    hasText: "@dated.follower",
  });
  const undated = page.locator(".accounts li").filter({
    hasText: "@undated.follower",
  });
  const malformed = page.locator(".accounts li").filter({
    hasText: "@malformed.follower",
  });

  await expect(dated).toContainText("Jan 1, 2021");
  await expect(dated).not.toContainText("Date unavailable");
  await expect(undated).toContainText("Date unavailable");
  await expect(malformed).toContainText("Date unavailable");
});

test("HTML ZIP shows recorded dates for Followers and Following", async ({
  page,
}) => {
  const zip = zipSync({
    "connections/followers_and_following/followers_1.html": readFileSync(
      "tests/fixtures/followers-dated.html",
    ),
    "connections/followers_and_following/following.html": readFileSync(
      "tests/fixtures/following-dated.html",
    ),
  });
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles({
      name: "synthetic-html-export.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zip),
    });

  await expect(page.getByRole("button", { name: /Followers 6/ })).toBeVisible();
  const follower = page.locator(".accounts li").filter({
    hasText: "@dated.follower",
  });
  await expect(follower).toContainText("Sep 7, 2026");
  await expect(follower).not.toContainText("Date unavailable");

  await page.getByRole("button", { name: /Following 1/ }).click();
  const following = page.locator(".accounts li").filter({
    hasText: "@dated.following",
  });
  await expect(following).toContainText("Oct 8, 2025");
  await expect(following).not.toContainText("Date unavailable");
});
