import { expect, test } from "@playwright/test";
import { articles } from "../../src/lib/articles";
import { publicPaths } from "../../src/lib/public-paths";

const guides = [
  {
    slug: "how-to-see-who-you-requested-to-follow-on-instagram",
    title: "How to See Who You Requested to Follow on Instagram | InstaScope",
    links: [
      "/instagram-sent-follow-requests/",
      "/pending-follow-requests/",
      "/how-to-download-instagram-followers-data/",
    ],
    facts: [
      "pending at that time",
      "does not check the account's live status",
      "optional sent follow requests category",
    ],
  },
  {
    slug: "how-to-see-when-you-followed-someone-on-instagram",
    title: "How to See When You Followed Someone on Instagram | InstaScope",
    links: [
      "/oldest-instagram-follows/",
      "/relationship-timeline/",
      "/how-to-download-instagram-followers-data/",
    ],
    facts: [
      "date remains unknown",
      "without interruption",
      "not the creation date",
    ],
  },
  {
    slug: "can-you-see-who-unfollowed-you-on-instagram",
    title: "Can You See Who Unfollowed You on Instagram? | InstaScope",
    links: [
      "/instagram-follower-changes/",
      "/instagram-unfollowers-without-password/",
      "/snapshot-comparison/",
      "/not-following-back/",
    ],
    facts: [
      "it does not show who unfollowed you",
      "missing between snapshots",
      "does not continuously monitor",
    ],
  },
] as const;

test("three informational guides render with distinct evidence and valid topic links", async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const seenTitles = new Set<string>();
  const seenDescriptions = new Set<string>();

  for (const guide of guides) {
    const path = `/${guide.slug}/`;
    const canonical = `https://instascope.me${path}`;

    expect(Object.hasOwn(articles, guide.slug)).toBe(true);
    expect(publicPaths.filter((candidate) => candidate === path)).toHaveLength(
      1,
    );
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page).toHaveTitle(guide.title);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description?.length).toBeGreaterThan(50);
    expect(seenTitles.has(guide.title)).toBe(false);
    expect(seenDescriptions.has(description!)).toBe(false);
    seenTitles.add(guide.title);
    seenDescriptions.add(description!);
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
    expect(sitemap).toContain(`<loc>${canonical}</loc>`);

    const article = page.locator("main article");
    for (const fact of guide.facts) await expect(article).toContainText(fact);
    for (const href of guide.links) {
      await expect(article.locator(`a[href="${href}"]`).first()).toBeVisible();
      expect((await request.get(href)).status(), href).toBe(200);
    }
  }
});

test("existing guides link back to the matching question pages", async ({
  page,
}) => {
  for (const [source, destination] of [
    [
      "/instagram-sent-follow-requests/",
      "/how-to-see-who-you-requested-to-follow-on-instagram/",
    ],
    [
      "/oldest-instagram-follows/",
      "/how-to-see-when-you-followed-someone-on-instagram/",
    ],
    [
      "/instagram-follower-changes/",
      "/can-you-see-who-unfollowed-you-on-instagram/",
    ],
  ] as const) {
    await page.goto(source);
    await expect(
      page.locator(`main article a[href="${destination}"]`),
    ).toBeVisible();
  }
});
