import { expect, test } from "@playwright/test";

const pages = [
  {
    path: "/pending-follow-requests/",
    title: "See Instagram Follow Requests You Sent | InstaScope",
    heading: "Review the Instagram follow requests you sent.",
    sections: [
      "Find sent requests recorded in your export",
      "Include the optional sent requests category",
      "Review privately, without an Instagram password",
    ],
    related: ["InstaCleaner", "Relationship timeline"],
    guidance:
      "Those two relationship lists alone cannot supply pending request records.",
  },
  {
    path: "/relationship-timeline/",
    title: "Instagram Following History & Follow Dates | InstaScope",
    heading: "Explore your recorded Instagram follow dates.",
    sections: [
      "See your oldest and newest recorded follows",
      "A timeline of records, not historical totals",
      "Get useful dates from your own export",
    ],
    related: ["Compare snapshots", "InstaCleaner", "Following analyzer"],
    guidance: "Some records may lack a usable date",
  },
  {
    path: "/unfollow-history/",
    title: "Accounts You Recently Unfollowed on Instagram | InstaScope",
    heading: "Review accounts you unfollowed on Instagram.",
    sections: [
      "Review accounts you chose to unfollow",
      "What to include in the download",
      "A private record for manual review",
    ],
    related: ["InstaCleaner", "Compare snapshots"],
    guidance:
      "Followers and Following alone do not contain your unfollow action history.",
  },
  {
    path: "/snapshot-comparison/",
    title: "Compare Instagram Followers Between Exports | InstaScope",
    heading: "Compare your Instagram followers between exports.",
    sections: [
      "Two exports, a clear account of changes",
      "Missing from a snapshot is a precise statement",
      "Counts and changes answer different questions",
      "Compare privately and choose what to review",
    ],
    related: ["Relationship timeline", "InstaCleaner"],
    guidance: "Both archives are analyzed locally in your browser",
  },
] as const;

for (const entry of pages) {
  test(`${entry.path} gives accurate guidance and focused links`, async ({
    page,
    request,
  }) => {
    expect((await page.goto(entry.path))?.status()).toBe(200);
    await expect(page).toHaveTitle(entry.title);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      entry.heading,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /export/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://instascope.me${entry.path}`,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index, follow",
    );
    for (const section of entry.sections) {
      await expect(page.getByRole("heading", { name: section })).toBeVisible();
    }
    await expect(page.locator(".tool-explainer")).toContainText(entry.guidance);
    await expect(
      page
        .locator(".tool-explainer")
        .getByRole("link", { name: "Get your Instagram export" }),
    ).toHaveAttribute("href", "/how-to-download-instagram-followers-data/");
    const links = page
      .getByRole("navigation", { name: "Related tools" })
      .getByRole("link");
    await expect(links).toHaveCount(entry.related.length);
    for (const [index, name] of entry.related.entries()) {
      await expect(links.nth(index)).toHaveText(name);
      const href = await links.nth(index).getAttribute("href");
      expect((await request.get(href!)).status()).toBe(200);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
