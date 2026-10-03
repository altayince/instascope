import { expect, test } from "@playwright/test";
import { articles } from "../../src/lib/articles";
import { publicPaths } from "../../src/lib/public-paths";

const slug = "how-to-see-when-someone-followed-you-on-instagram";
const path = `/${slug}/`;
const canonical = `https://instascope.me${path}`;
const outgoing = "/how-to-see-when-you-followed-someone-on-instagram/";

test("incoming follower guide has its own metadata, evidence, working links and responsive article layout", async ({
  page,
  request,
}) => {
  expect((await page.goto(path))?.status()).toBe(200);
  const title = `${articles[slug].title} | InstaScope`;
  await expect(page).toHaveTitle(title);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How to See When Someone Followed You on Instagram",
  );
  for (const selector of [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ]) {
    await expect(page.locator(selector)).toHaveAttribute(
      "content",
      articles[slug].description,
    );
  }
  for (const selector of [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ]) {
    await expect(page.locator(selector)).toHaveAttribute("content", title);
  }
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    canonical,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    canonical,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  expect(publicPaths.filter((item) => item === path)).toHaveLength(1);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap.split(`<loc>${canonical}</loc>`)).toHaveLength(2);
  expect(sitemap).toContain(`https://instascope.me${outgoing}`);

  const article = page.locator("main article");
  await expect(article.locator("p").first()).toContainText(
    "recorded follower date",
  );
  for (const fact of [
    "Followers means accounts following you",
    "HTML dates have no timezone",
    "Date unavailable",
    "not necessarily your first-ever follower",
    "two different recorded dates",
    "processed locally in your browser",
  ]) {
    await expect(article).toContainText(fact);
  }
  for (const href of [
    "/followers-analyzer/",
    outgoing,
    "/oldest-instagram-follows/",
    "/how-to-download-instagram-followers-data/",
  ]) {
    await expect(article.locator(`a[href="${href}"]`)).toBeVisible();
  }
  for (const href of await page
    .locator("main a")
    .evaluateAll((links) => [
      ...new Set(links.map((link) => link.getAttribute("href")!)),
    ])) {
    expect((await request.get(href)).status(), href).toBe(200);
  }
  const schema = (
    await page.locator('script[type="application/ld+json"]').allTextContents()
  ).map((text) => JSON.parse(text));
  expect(
    schema.find((item) => item["@type"] === "BreadcrumbList").itemListElement[1]
      .item,
  ).toBe(canonical);
  expect(
    schema.some((item) => ["Article", "FAQPage"].includes(item["@type"])),
  ).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page.goto(outgoing);
  await expect(page).toHaveTitle(
    "How to See When You Followed Someone on Instagram | InstaScope",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How to See When You Followed Someone on Instagram",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Find a recorded Instagram follow date in your export, sort dated current follows and understand what the timestamp cannot prove.",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `https://instascope.me${outgoing}`,
  );
  await expect(page.locator(`main article a[href="${path}"]`)).toBeVisible();
});

test("guide CTA opens Followers and its documented search and oldest-date sorting work", async ({
  page,
}) => {
  await page.goto(path);
  await page
    .getByRole("link", {
      name: "Check your recorded follower dates in Followers Analyzer",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/followers-analyzer\/$/);
  const entries = [
    { value: "sample.recent", timestamp: 1735689600 },
    { value: "sample.unknown" },
    { value: "sample.earliest", timestamp: 1577836800 },
  ];
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      {
        name: "followers_1.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify(
            entries.map((entry) => ({ string_list_data: [entry] })),
          ),
        ),
      },
      {
        name: "following.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"relationships_following":[]}'),
      },
    ]);
  await expect(
    page.getByRole("button", { name: /Followers 3/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByLabel("Sort accounts")
    .selectOption({ label: "Oldest recorded followers" });
  await expect(page.locator(".accounts li").first()).toContainText(
    "@sample.earliest",
  );
  await expect(page.locator(".accounts li").first()).toContainText(
    "Jan 1, 2020",
  );
  await expect(page.locator(".accounts li").last()).toContainText(
    "Date unavailable",
  );
  await page
    .getByRole("searchbox", { name: "Search accounts" })
    .fill("sample.recent");
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.locator(".accounts li")).toContainText("Jan 1, 2025");
});
