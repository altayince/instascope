import { expect, test } from "@playwright/test";
import { articles } from "../../src/lib/articles";
import { guideGroups, guides } from "../../src/lib/guides";

const preview = process.env.EXPECT_INDEXABLE === "false";
const report =
  "https://github.com/altayince/instascope/issues/new?template=bug_report.yml";

test("Guides hub groups unique working destinations and keeps indexing environment-specific", async ({
  page,
  request,
}) => {
  expect((await page.goto("/guides/"))?.status()).toBe(200);
  await expect(page).toHaveTitle("Guides | InstaScope");
  await expect(page.locator("main h1")).toHaveText("InstaScope guides");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://instascope.me/guides/",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://instascope.me/guides/",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    preview ? "noindex, nofollow" : "index, follow",
  );
  const sitemap = await (await request.get("/sitemap.xml")).text();
  if (preview) expect(sitemap).not.toContain("<loc>");
  else {
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
    expect(new Set(urls).size).toBe(urls.length);
    expect(
      urls.filter((url) => url === "https://instascope.me/guides/"),
    ).toHaveLength(1);
  }
  const directory = page.locator("main .guide-directory");
  for (const group of guideGroups) {
    const section = page.getByRole("region", {
      name: group.title,
      exact: true,
    });
    await expect(section.locator("h2")).toHaveText(group.title);
    await expect(section.locator("h3")).toHaveCount(group.slugs.length);
    await expect(section.locator(".guide-directory li p")).toHaveCount(
      group.slugs.length,
    );
  }
  const hrefs = await directory
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  expect(new Set(hrefs).size).toBe(hrefs.length);
  expect(hrefs.length).toBe(Object.keys(guides).length);
  for (const href of hrefs)
    expect((await request.get(href)).status(), href).toBe(200);
  const topics = page.getByRole("navigation", { name: "Guide topics" });
  const dates = topics.getByRole("link", {
    name: "Follow Dates & History",
    exact: true,
  });
  await dates.focus();
  await expect(dates).toBeFocused();
  await expect(dates).not.toHaveCSS("outline-style", "none");
  await dates.press("Enter");
  await expect(page).toHaveURL(/\/guides\/#dates$/);
  await expect(page.locator("#dates h2")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("articles render only their curated guide links and retain primary CTAs", async ({
  page,
  request,
}) => {
  const destinations = new Set<string>();
  for (const [slug, article] of Object.entries(articles)) {
    await page.goto(`/${slug}/`);
    await expect(page).toHaveTitle(`${article.title} | InstaScope`);
    await expect(page.locator("main h1")).toHaveText(article.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://instascope.me/${slug}/`,
    );
    const related = page.getByRole("navigation", {
      name: "Related guides",
      exact: true,
    });
    const hrefs = await related
      .locator("ul a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
    expect(hrefs).toEqual(article.related.map((id) => guides[id].href));
    expect(hrefs.length).toBeLessThan(Object.keys(articles).length - 1);
    expect(hrefs).not.toContain(`/${slug}/`);
    for (const href of hrefs) destinations.add(href);
    const practice = page.getByRole("navigation", {
      name: "Put this guide into practice",
    });
    expect(
      await practice
        .locator("ul a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual(article.links.map((link) => link.href));
    await expect(
      related.getByRole("link", { name: "Browse all guides by topic" }),
    ).toHaveAttribute("href", "/guides/");
  }
  for (const href of destinations)
    expect((await request.get(href)).status(), href).toBe(200);
});

test("footer offers accessible Guides and public GitHub reports without losing existing links", async ({
  page,
}) => {
  await page.goto("/guides/");
  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  for (const [name, href] of [
    ["Guides", "/guides/"],
    ["Privacy", "/privacy/"],
    ["Export guide", "/how-to-download-instagram-followers-data/"],
    ["What’s new", "/changelog/"],
  ]) {
    await expect(
      footer.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", href);
  }
  const reportLink = footer.getByRole("link", {
    name: "Report a problem on GitHub (opens in a new tab)",
    exact: true,
  });
  await expect(reportLink).toHaveAttribute("href", report);
  await expect(reportLink).toHaveAttribute("target", "_blank");
  await expect(reportLink).toHaveAttribute("rel", "noopener noreferrer");
  expect((await reportLink.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  await reportLink.focus();
  await expect(reportLink).toBeFocused();
  await expect(reportLink).not.toHaveCSS("outline-style", "none");
  // No real GitHub submission: verify the new-tab path while remaining in the app.
  await page
    .context()
    .route(report, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Synthetic issue form</h1>",
      }),
    );
  const popupPromise = page.waitForEvent("popup");
  await reportLink.press("Enter");
  const popup = await popupPromise;
  await expect(popup).toHaveURL(report);
  await expect(page).toHaveURL(/\/guides\/$/);
  await popup.close();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("crawlable viewer and Privacy copy explain local enhancement and actual build configuration", async ({
  page,
  request,
}) => {
  // Read the generated HTTP HTML: the explanation must exist without running the tool.
  const html = await (await request.get("/profile-picture-viewer/")).text();
  expect(html).toContain("Optional browser-local AI upscaling");
  expect(html).toContain("The model estimates detail.");
  expect(html).toContain(
    "No photo is uploaded to an AI service for enhancement.",
  );
  await page.goto("/profile-picture-viewer/");
  await expect(page).toHaveTitle(
    "Instagram Profile Picture Viewer — Public Photos | InstaScope",
  );
  await expect(page.locator("main h1")).toHaveText(
    "View a publicly available Instagram profile photo.",
  );
  const explainer = page.locator(".tool-explainer");
  for (const text of [
    "in your browser",
    "Faces, hair and other details can change",
    "source quality still limits",
    "not Instagram's original HD image",
    "Save upscaled PNG",
    "fullscreen",
    "circular",
    "does not ask for Instagram credentials",
    "private posts or stories",
  ])
    await expect(explainer).toContainText(text);
  await expect(page.locator(".profile-viewer form")).toHaveAttribute(
    "data-profile-endpoint",
    preview ? "" : "/api/profile-picture",
  );
  await page.goto("/privacy/");
  const privacy = page.getByRole("main");
  for (const text of [
    "ZIP, JSON and HTML",
    "does not upload",
    "follower and following usernames plus the export date",
    "both exports belong to the same Instagram account",
    "does not automatically verify account identity",
    "We do not ask for a password or session cookie",
    "Remote product analytics is not enabled",
    "Optional AI super resolution runs in a browser worker",
    "photo is not uploaded to an AI service",
    "Reports there are public",
  ])
    await expect(privacy).toContainText(text);
  if (preview)
    await expect(privacy).toContainText(
      "Public-photo lookup is not configured on this deployment.",
    );
  else {
    await expect(privacy).toContainText(
      "The username you explicitly submit is sent to a separate public-photo lookup service.",
    );
    await expect(privacy).not.toContainText(
      "Public-photo lookup is not configured on this deployment.",
    );
  }
  await page.goto("/dashboard/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    preview ? "noindex, nofollow" : "noindex, follow",
  );
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("https://instascope.me/dashboard/");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(preview ? "Disallow: /" : "Disallow: /api/");
});
