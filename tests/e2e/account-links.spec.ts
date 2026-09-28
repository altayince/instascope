import { expect, test } from "@playwright/test";

const files = [
  "tests/fixtures/followers_1.json",
  "tests/fixtures/following.json",
];

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

  await expect(row.getByText("@demo.mutual.0001", { exact: true })).toBeVisible();
  await expect(row.getByRole("link")).toHaveCount(0);
  await expect(row.locator('a[href*="instagram.com"]')).toHaveCount(0);
});
