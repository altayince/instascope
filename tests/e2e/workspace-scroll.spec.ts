import { expect, test, type Page } from "@playwright/test";

async function switchTab(page: Page, label: string, path: string) {
  const tabs = page.locator(".tool-tabs");
  const link = tabs.getByRole("link", { name: label, exact: true });
  await link.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => ({
    tabs: document.querySelector(".tool-tabs")!.getBoundingClientRect().top,
    heading: document
      .querySelector(".workspace-heading")!
      .getBoundingClientRect().top,
  }));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(80);
  await link.click();
  await expect(page).toHaveURL(new URL(path, page.url()).toString());
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".demo-notice")).toContainText("Fictional example");
  const after = await page.evaluate(() => ({
    tabs: document.querySelector(".tool-tabs")!.getBoundingClientRect().top,
    heading: document
      .querySelector(".workspace-heading")!
      .getBoundingClientRect().top,
  }));
  expect(Math.abs(after.tabs - before.tabs)).toBeLessThanOrEqual(4);
  expect(Math.abs(after.heading - before.heading)).toBeLessThanOrEqual(4);
}

test("workspace chrome stays visually anchored across demo routes", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/pending-follow-requests/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Pending request review" }),
  ).toContainText("3 requests in this export");
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.scrollBehavior = "auto";
    const top = document.querySelector(".tool-tabs")!.getBoundingClientRect().top;
    window.scrollTo(0, window.scrollY + top - 160);
    root.style.scrollBehavior = "";
  });

  await switchTab(page, "Relationship timeline", "/relationship-timeline/");
  await expect(
    page.getByRole("region", { name: "Relationship date timeline" }),
  ).toContainText("relationships have a recorded date");
  await expect(
    page.getByRole("group", { name: "Dated relationships by period" }),
  ).toBeVisible();

  await switchTab(page, "Connection privacy", "/connection-privacy/");
  await expect(
    page.getByRole("region", { name: "Connection privacy dashboard" }),
  ).toContainText("Not included");

  await switchTab(page, "Your unfollow history", "/unfollow-history/");
  await expect(
    page.getByRole("region", { name: "Your unfollow history" }),
  ).toContainText("2 records");

  await switchTab(page, "My Wrapped", "/instagram-wrapped/");
  await expect(page.locator(".wrapped-card")).toContainText("DEMO DATA");

  await switchTab(page, "Overview", "/followers-analyzer/");
  await expect(
    page.getByRole("region", { name: "Explore more from this export" }),
  ).toContainText("3 sent requests recorded in this export");
  await expect(
    page.getByRole("button", { name: /Followers 1,284/ }),
  ).toBeVisible();

  await switchTab(page, "Pending requests", "/pending-follow-requests/");
  await expect(
    page.getByRole("region", { name: "Pending request review" }),
  ).toContainText("3 requests in this export");
});
