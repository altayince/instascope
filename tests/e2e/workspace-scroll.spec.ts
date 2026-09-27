import { expect, test } from "@playwright/test";

test("workspace tabs preserve scroll and fictional data across routes", async ({
  page,
}) => {
  await page.goto("/pending-follow-requests/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Pending request review" }),
  ).toContainText("3 requests in this export");

  const tabs = page.locator(".tool-tabs");
  await tabs.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(80);

  await tabs.getByRole("link", { name: "Relationship timeline" }).click();
  await expect(page).toHaveURL(/\/relationship-timeline\/$/);
  await expect(
    page.getByRole("region", { name: "Relationship date timeline" }),
  ).toContainText("relationships have a recorded date");
  await expect(
    page.getByRole("group", { name: "Dated relationships by period" }),
  ).toBeVisible();
  await expect(page.locator(".demo-notice")).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(80);
  await expect(tabs).toBeInViewport({ ratio: 0.1 });

  await tabs.getByRole("link", { name: "Connection privacy" }).click();
  await expect(page).toHaveURL(/\/connection-privacy\/$/);
  await expect(
    page.getByRole("region", { name: "Connection privacy dashboard" }),
  ).toContainText("Not included");
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(80);

  await tabs.getByRole("link", { name: "Your unfollow history" }).click();
  await expect(page).toHaveURL(/\/unfollow-history\/$/);
  await expect(
    page.getByRole("region", { name: "Your unfollow history" }),
  ).toContainText("2 records");
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(80);
  await expect(tabs).toBeInViewport({ ratio: 0.1 });
});
