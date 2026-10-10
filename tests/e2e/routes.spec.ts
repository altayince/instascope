import { test, expect } from "@playwright/test";
import { primaryTools } from "../../src/lib/site";
import { publicPaths } from "../../src/lib/public-paths";
import { articles } from "../../src/lib/articles";
import { productSections } from "../../src/lib/navigation";

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

test("product sections expose every existing tool and identify the active section", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(
    navigation.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveAttribute("href", "/dashboard/");
  await expect(
    navigation.getByRole("link", { name: "Wrapped", exact: true }),
  ).toHaveAttribute("href", "/instagram-wrapped/");
  const discovered = new Set<string>(["instagram-wrapped"]);
  for (const section of productSections.filter(
    (section) => section.id !== "wrapped",
  )) {
    const menu = navigation.locator(`details[data-section="${section.id}"]`);
    await menu.locator("summary").click();
    await expect(menu).toHaveAttribute("open");
    for (const destination of section.links) {
      const link = menu.getByRole("link", {
        name: destination.label,
        exact: true,
      });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", destination.href);
      if (destination.tool) discovered.add(destination.tool);
    }
    expect(
      await menu.evaluate((element) => {
        const box = element
          .querySelector(".tool-menu-links")!
          .getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth;
      }),
    ).toBe(true);
  }
  expect([...discovered].sort()).toEqual([...primaryTools].sort());
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const circle = navigation.locator('details[data-section="circle"]');
  await circle.locator("summary").click();
  await circle
    .getByRole("link", { name: "Following analyzer", exact: true })
    .click();
  await expect(page).toHaveURL(/following-analyzer\/$/);
  await expect(navigation.locator("details[open]")).toHaveCount(0);
  await expect(circle).toHaveAttribute("data-active", "true");
  await circle.locator("summary").click();
  await expect(
    circle.getByRole("link", { name: "Following analyzer", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("product menus close after sibling navigation, outside clicks and Escape", async ({
  page,
}) => {
  await page.goto("/");
  const menu = page.locator('.tool-menu[data-section="more"]');
  const summary = menu.locator("summary");
  const header = page.getByRole("navigation", { name: "Main navigation" });

  await summary.click();
  await expect(menu).toHaveAttribute("open");
  await header.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/$/);
  await expect(menu).not.toHaveAttribute("open");

  await summary.click();
  await expect(menu).toHaveAttribute("open");
  const home = page.getByRole("link", { name: "InstaScope home", exact: true });
  await home.focus();
  await home.press("Enter");
  await expect(page).toHaveURL(new URL("/", page.url()).toString());
  await expect(menu).not.toHaveAttribute("open");

  await summary.click();
  await expect(menu).toHaveAttribute("open");
  await menu.locator(".tool-menu-links").click({ position: { x: 4, y: 4 } });
  await expect(menu).toHaveAttribute("open");
  await page.mouse.click(4, 200);
  await expect(menu).not.toHaveAttribute("open");

  await summary.click();
  await expect(menu).toHaveAttribute("open");
  const guide = menu.getByRole("link", { name: "Guides", exact: true });
  await guide.focus();
  await guide.press("Escape");
  await expect(menu).not.toHaveAttribute("open");
  await expect(summary).toBeFocused();
  await summary.click();
  const history = header.locator('.tool-menu[data-section="history"]');
  await history.locator("summary").click();
  await expect(menu).not.toHaveAttribute("open");
  await expect(history).toHaveAttribute("open");
  await history
    .getByRole("link", { name: "Pending requests", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pending-follow-requests\/$/);
  await expect(history).not.toHaveAttribute("open");
  await expect(history).toHaveAttribute("data-active", "true");
});
