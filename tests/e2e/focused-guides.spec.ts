import { expect, test } from "@playwright/test";

const guides = [
  {
    path: "/instagram-sent-follow-requests/",
    title: "How to see follow requests you sent on Instagram | InstaScope",
    primary: "/pending-follow-requests/",
    secondary: null,
    question: "/how-to-see-who-you-requested-to-follow-on-instagram/",
    extra: null,
    facts: [
      "optional sent follow requests category",
      "cannot confirm today's status",
      "does not need your Instagram password",
    ],
  },
  {
    path: "/oldest-instagram-follows/",
    title: "How to find your oldest recorded Instagram follows | InstaScope",
    primary: "/relationship-timeline/",
    secondary: "/instagram-cleaner/",
    question: "/how-to-see-when-you-followed-someone-on-instagram/",
    extra: "/how-to-find-oldest-instagram-followers/",
    facts: [
      "oldest recorded follow among accounts still in that list",
      "its date stays unknown",
      "historical follower totals",
      "followed the account continuously",
    ],
  },
  {
    path: "/instagram-follower-changes/",
    title:
      "How to compare Instagram follower changes between exports | InstaScope",
    primary: "/snapshot-comparison/",
    secondary: "/relationship-timeline/",
    question: "/can-you-see-who-unfollowed-you-on-instagram/",
    extra: "/instagram-unfollowers-without-password/",
    facts: [
      "newer file first and the older file second",
      "new and lost mutuals",
      "exactly when it happened or why",
      "processed locally in your browser",
    ],
  },
] as const;

test("three focused guides answer their intent and lead to working tools", async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const guide of guides) {
    const url = `https://instascope.me${guide.path}`;
    expect((await page.goto(guide.path))?.status()).toBe(200);
    await expect(page).toHaveTitle(guide.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /export/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      url,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index, follow",
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      url,
    );
    expect(sitemap).toContain(`<loc>${url}</loc>`);
    await expect(page.locator("main h1")).toHaveCount(1);
    for (const fact of guide.facts) {
      await expect(page.locator("main article")).toContainText(fact);
    }
    const practice = page.getByRole("navigation", {
      name: "Put this guide into practice",
    });
    const links = await practice.locator("ul a").all();
    expect(links.length).toBe(
      (guide.secondary ? 3 : 2) + (guide.extra ? 1 : 0),
    );
    await expect(links[0]).toHaveAttribute("href", guide.primary);
    if (guide.secondary) {
      await expect(links[1]).toHaveAttribute("href", guide.secondary);
    }
    await expect(
      practice.locator(`ul a[href="${guide.question}"]`),
    ).toBeVisible();
    if (guide.extra) {
      await expect(
        practice.locator(`ul a[href="${guide.extra}"]`),
      ).toBeVisible();
    }
    await expect(
      practice.getByRole("link", { name: "Get the right Instagram export" }),
    ).toHaveAttribute("href", "/how-to-download-instagram-followers-data/");
    for (const link of await practice.getByRole("link").all()) {
      expect(
        (await request.get((await link.getAttribute("href"))!)).status(),
      ).toBe(200);
    }
  }
});
