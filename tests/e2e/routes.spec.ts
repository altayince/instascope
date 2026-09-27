import { test, expect } from "@playwright/test";
import { primaryTools, tools } from "../../src/lib/site";
import { publicPaths } from "../../src/lib/public-paths";
import { articles } from "../../src/lib/articles";

test("export guides link to valid tools and preserve a working demo journey", async ({
  page,
  request,
}) => {
  const destinations = new Set<string>();
  for (const slug of Object.keys(articles)) {
    await page.goto(`/${slug}/`);
    for (const href of await page
      .locator('main a[href^="/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")!)))
      destinations.add(href);
  }
  for (const href of destinations)
    expect((await request.get(href)).status(), href).toBe(200);
  await page.goto("/how-to-see-who-doesnt-follow-you-back-on-instagram/");
  await page
    .getByRole("link", { name: "Find one-way follows", exact: true })
    .click();
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".demo-notice")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Not following back 190/ }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("public routes render one heading, load assets and fit mobile screens", async ({
  page,
  request,
}) => {
  const errors: string[] = [],
    failed: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  const paths = publicPaths;
  for (const path of paths) {
    expect((await page.goto(path))?.status(), path).toBe(200);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://instascope.me${path}`,
    );
    await expect(page.locator("body")).not.toContainText("\u2197");
    await expect(page.locator(".site-header")).not.toContainText(/\bbeta\b/i);
    expect(
      await page
        .locator("a")
        .evaluateAll((links) =>
          links.some((link) => /[→↗➜➔]/u.test(link.textContent ?? "")),
        ),
      path,
    ).toBe(false);
    await expect(
      page.getByRole("link", { name: "InstaScope home" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
  }
  for (const path of [
    "/robots.txt",
    "/sitemap.xml",
    "/icon.svg",
    "/opengraph-image.png",
  ])
    expect((await request.get(path)).status(), path).toBe(200);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test("all primary tools are discoverable and the menu closes after navigation", async ({
  page,
}) => {
  await page.goto("/");
  for (const [name, href] of [
    ["Requests", "/pending-follow-requests/"],
    ["Timeline", "/relationship-timeline/"],
    ["Your unfollows", "/unfollow-history/"],
  ])
    await expect(
      page.locator(".site-header nav").getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", href);
  const navCenters = await page.locator(".site-header nav").evaluate((nav) =>
    Array.from(nav.children, (child) => {
      const rect = (
        child.matches("details") ? child.querySelector("summary")! : child
      ).getBoundingClientRect();
      return rect.top + rect.height / 2;
    }),
  );
  expect(Math.max(...navCenters) - Math.min(...navCenters)).toBeLessThan(4);
  await page.locator(".tool-menu summary").click();
  for (const slug of primaryTools)
    await expect(
      page
        .locator(".tool-menu")
        .getByRole("link", { name: tools[slug].name, exact: true }),
    ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".tool-menu")
    .getByRole("link", { name: "Following analyzer", exact: true })
    .click();
  await expect(page).toHaveURL(/following-analyzer\/$/);
  await expect(page.locator(".tool-menu")).not.toHaveAttribute("open");
});

test("All tools closes after sibling navigation, outside clicks and Escape", async ({
  page,
}) => {
  await page.goto("/");
  const menu = page.locator(".tool-menu");
  const summary = menu.locator("summary");
  const header = page.getByRole("navigation", { name: "Main navigation" });

  await summary.click();
  await expect(menu).toHaveAttribute("open");
  await header.getByRole("link", { name: "Requests", exact: true }).click();
  await expect(page).toHaveURL(/\/pending-follow-requests\/$/);
  await expect(menu).not.toHaveAttribute("open");

  await summary.click();
  await expect(menu).toHaveAttribute("open");
  const timeline = header.getByRole("link", { name: "Timeline", exact: true });
  await timeline.focus();
  await timeline.press("Enter");
  await expect(page).toHaveURL(/\/relationship-timeline\/$/);
  await expect(menu).not.toHaveAttribute("open");

  await summary.click();
  await expect(menu).toHaveAttribute("open");
  await menu.locator(".tool-menu-links").click({ position: { x: 4, y: 4 } });
  await expect(menu).toHaveAttribute("open");
  await page.mouse.click(5, 200);
  await expect(page).toHaveURL(/\/relationship-timeline\/$/);
  await expect(menu).not.toHaveAttribute("open");

  await summary.click();
  await expect(menu).toHaveAttribute("open");
  await summary.press("Escape");
  await expect(menu).not.toHaveAttribute("open");
  await expect(summary).toBeFocused();
});
