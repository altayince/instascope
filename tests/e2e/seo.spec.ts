import { test, expect } from "@playwright/test";
import { publicPaths } from "../../src/lib/public-paths";

test("indexable public pages have unique metadata, truthful structured data and a canonical sitemap", async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => match[1],
  );
  // The production build is tested in CI; an unconfigured local build may be noindex.
  await page.goto("/");
  const indexable = (
    await page.locator('meta[name="robots"]').getAttribute("content")
  )?.startsWith("index,");
  if (!indexable) {
    expect(urls).toEqual([]);
    expect(await (await request.get("/robots.txt")).text()).toContain(
      "Disallow: /",
    );
    return;
  }
  expect(urls).toEqual(
    publicPaths.map((path) => `https://instascope.me${path}`),
  );
  expect(new Set(urls).size).toBe(urls.length);
  const titles = new Set<string>(),
    descriptions = new Set<string>();
  for (const url of urls) {
    expect(url).toMatch(/^https:\/\/instascope\.me\/(?:[a-z-]+\/)?$/);
    const path = new URL(url).pathname;
    expect((await page.goto(path))?.status()).toBe(200);
    const title = await page.title();
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(title.length).toBeGreaterThan(10);
    expect(description!.length).toBeGreaterThan(35);
    expect(titles.has(title), title).toBe(false);
    expect(descriptions.has(description!), description!).toBe(false);
    titles.add(title);
    descriptions.add(description!);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      url,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      url,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://instascope.me/opengraph-image.png",
    );
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute("content", description!);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index, follow",
    );
    const data = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(data.length).toBeGreaterThan(0);
    const parsed = data.map((text) => JSON.parse(text));
    expect(data.join(" ")).not.toMatch(
      /aggregateRating|reviewCount|workers\.dev|localhost/,
    );
    if (path !== "/") {
      const breadcrumb = parsed.find(
        (item) => item["@type"] === "BreadcrumbList",
      );
      expect(breadcrumb.itemListElement[1].item).toBe(url);
      await expect(
        page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
      ).toBeVisible();
    }
  }
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Sitemap: https://instascope.me/sitemap.xml");
});
