import { expect, test } from "@playwright/test";

const files = [
  "tests/fixtures/followers_1.json",
  "tests/fixtures/following.json",
];
const deletedUsername = "__deleted__bcdefghijabcdefgh";

test("real account rows link both the username and profile action", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);

  const row = page.locator(".accounts li").filter({ hasText: "@alice" });
  const expected = "https://www.instagram.com/alice/";

  await expect(
    row.getByRole("link", { name: "@alice", exact: true }),
  ).toHaveAttribute("href", expected);
  await expect(
    row.getByRole("link", { name: "Open alice on Instagram" }),
  ).toHaveAttribute("href", expected);
});

test("fictional demo usernames remain non-clickable", async ({ page }) => {
  await page.goto("/followers-analyzer/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page.getByRole("searchbox").fill("demo.mutual.0001");

  const row = page
    .locator(".accounts li")
    .filter({ hasText: "@demo.mutual.0001" });

  await expect(
    row.getByText("@demo.mutual.0001", { exact: true }),
  ).toBeVisible();
  await expect(row.getByRole("link")).toHaveCount(0);
  await expect(row.locator('a[href*="instagram.com"]')).toHaveCount(0);
});

test("deleted export accounts stay visible without profile links", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      {
        name: "followers_1.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify([
            { string_list_data: [{ value: deletedUsername, timestamp: 1 }] },
            { string_list_data: [{ value: "deleted.memories", timestamp: 2 }] },
          ]),
        ),
      },
      {
        name: "following.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            relationships_following: [
              {
                title: "",
                string_list_data: [{ value: deletedUsername, timestamp: 1 }],
              },
            ],
          }),
        ),
      },
    ]);

  const deletedRow = page
    .locator(".accounts li")
    .filter({ hasText: "Deleted account" });
  await expect(deletedRow).toBeVisible();
  await expect(deletedRow.getByRole("link")).toHaveCount(0);
  await expect(deletedRow.getByText("View profile")).toHaveCount(0);
  await expect(deletedRow).not.toContainText(deletedUsername);
  await expect(deletedRow.locator(".avatar")).toHaveText("DA");
  await expect(deletedRow.locator(".avatar").locator("a")).toHaveCount(0);

  const activeRow = page
    .locator(".accounts li")
    .filter({ hasText: "@deleted.memories" });
  const expected = "https://www.instagram.com/deleted.memories/";
  await expect(
    activeRow.getByRole("link", { name: "@deleted.memories" }),
  ).toHaveAttribute("href", expected);
  await expect(
    activeRow.getByRole("link", {
      name: "Open deleted.memories on Instagram",
    }),
  ).toHaveAttribute("href", expected);
});
