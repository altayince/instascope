import { expect, test } from "@playwright/test";
import { articles } from "../../src/lib/articles";
import { publicPaths } from "../../src/lib/public-paths";

const oldest = "/how-to-find-oldest-instagram-followers/";
const fans =
  "/how-to-see-who-follows-you-but-you-dont-follow-back-on-instagram/";
const comparison = "/instagram-follower-changes/";
const timeline = "/relationship-timeline/?direction=followers";
const guides = [
  {
    path: oldest,
    title: "How to Find Your Oldest Instagram Followers",
    cta: timeline,
    facts: [
      "Oldest recorded followers",
      "not proof that this person was your first-ever follower",
      "HTML dates preserve their recorded calendar date",
      "undated accounts at the end",
      "locally in your browser",
    ],
  },
  {
    path: fans,
    title: "How to See Who Follows You but You Don't Follow Back on Instagram",
    cta: "/followers-analyzer/",
    facts: [
      "reverse of Not Following Back",
      "Followers minus Following",
      "select the Fans category",
      "removes duplicates",
      "not live Instagram state",
    ],
  },
  {
    path: comparison,
    title: "How to compare Instagram follower changes between exports",
    cta: "/snapshot-comparison/",
    facts: [
      "One export is one snapshot",
      "Five added followers and two missing followers",
      "rename, account deletion, deactivation",
      "exactly when it happened or why",
      "does not provide live tracking",
    ],
  },
];

test("follower-intent guides keep distinct metadata, working links and deployment-specific indexing", async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const preview = process.env.EXPECT_INDEXABLE === "false";
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(preview ? "Disallow: /" : "Allow: /");
  expect(robots).toContain("Sitemap: https://instascope.me/sitemap.xml");
  for (const guide of guides) {
    const slug = guide.path.slice(1, -1);
    const canonical = `https://instascope.me${guide.path}`;
    expect((await page.goto(guide.path))?.status()).toBe(200);
    await expect(page).toHaveTitle(`${guide.title} | InstaScope`);
    await expect(page.locator("main h1")).toHaveText(guide.title);
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
      await expect(page.locator(selector)).toHaveAttribute(
        "content",
        `${guide.title} | InstaScope`,
      );
    }
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
      preview ? "noindex, nofollow" : "index, follow",
    );
    expect(publicPaths.filter((path) => path === guide.path)).toHaveLength(1);
    if (preview) expect(sitemap).not.toContain("<loc>");
    else expect(sitemap.split(`<loc>${canonical}</loc>`)).toHaveLength(2);
    const article = page.locator("main article");
    for (const fact of guide.facts) await expect(article).toContainText(fact);
    const practice = page.getByRole("navigation", {
      name: "Put this guide into practice",
    });
    await expect(practice.locator("ul a").first()).toHaveAttribute(
      "href",
      guide.cta,
    );
    for (const href of await article
      .locator("a")
      .evaluateAll((links) => [
        ...new Set(links.map((link) => link.getAttribute("href")!)),
      ])) {
      expect((await request.get(href)).status(), href).toBe(200);
    }
    const schema = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).map((text) => JSON.parse(text));
    expect(
      schema.find((item) => item["@type"] === "BreadcrumbList")
        .itemListElement[1].item,
    ).toBe(canonical);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(sitemap).not.toContain("direction=");
  expect(
    Object.hasOwn(articles, "how-to-compare-instagram-followers-over-time"),
  ).toBe(false);
  expect(
    (
      await request.get("/how-to-compare-instagram-followers-over-time/")
    ).status(),
  ).toBe(404);
});

test("related guides retain their established targeting and link reciprocally", async ({
  page,
}) => {
  for (const [path, title, destination] of [
    [
      "/oldest-instagram-follows/",
      "How to find your oldest recorded Instagram follows",
      oldest,
    ],
    [
      "/how-to-see-when-someone-followed-you-on-instagram/",
      "How to See When Someone Followed You on Instagram",
      oldest,
    ],
    [
      "/how-to-see-who-doesnt-follow-you-back-on-instagram/",
      "How to see who doesn't follow you back on Instagram",
      fans,
    ],
    [
      "/can-you-see-who-unfollowed-you-on-instagram/",
      "Can You See Who Unfollowed You on Instagram?",
      comparison,
    ],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(`${title} | InstaScope`);
    await expect(page.locator("main h1")).toHaveText(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://instascope.me${path}`,
    );
    await expect(
      page.locator(`main article a[href="${destination}"]`),
    ).toBeVisible();
  }
});

test("oldest-follower CTA opens the existing Timeline in incoming direction", async ({
  page,
}) => {
  await page.goto(oldest);
  await page
    .getByRole("link", {
      name: "Explore oldest recorded followers",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(
    /\/relationship-timeline\/\?direction=followers$/,
  );
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.getByLabel("Relationship direction")).toHaveValue(
    "followers",
  );
  await expect(page.getByLabel("Sort accounts")).toHaveValue("oldest");
  await expect(page.locator(".accounts li").first()).toContainText("demo.");
});

test("Fans guide reaches the existing incoming category without reversing the relationship", async ({
  page,
}) => {
  await page.goto(fans);
  await page
    .getByRole("link", {
      name: "Open Followers Analyzer and select Fans",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      {
        name: "followers_1.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify(
            ["sample.fan", "sample.mutual", "sample.fan"].map((value) => ({
              string_list_data: [{ value }],
            })),
          ),
        ),
      },
      {
        name: "following.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            relationships_following: ["sample.mutual", "sample.outgoing"].map(
              (value) => ({ string_list_data: [{ value }] }),
            ),
          }),
        ),
      },
    ]);
  await page.getByRole("button", { name: /Fans 1/ }).click();
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.locator(".accounts li")).toContainText("@sample.fan");
  await page.getByRole("button", { name: /Not Following Back 1/i }).click();
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.locator(".accounts li")).toContainText("@sample.outgoing");
});
