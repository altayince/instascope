import { expect, test } from "@playwright/test";
import { articles } from "../../src/lib/articles";
import { publicPaths } from "../../src/lib/public-paths";

const path = "/how-to-view-instagram-profiles-without-an-account/";
const canonical = `https://instascope.me${path}`;

test("guide explains conditional anonymous access and protects private content", async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();

  expect(
    Object.hasOwn(
      articles,
      "how-to-view-instagram-profiles-without-an-account",
    ),
  ).toBe(true);
  expect(publicPaths.filter((candidate) => candidate === path)).toHaveLength(1);
  expect((await page.goto(path))?.status()).toBe(200);
  await expect(page).toHaveTitle(
    "How to View Instagram Profiles Without an Account | InstaScope",
  );
  const description = await page
    .locator('meta[name="description"]')
    .getAttribute("content");
  expect(description).toBe(
    "Learn what you can see on Instagram without an account or login, what private profiles hide, and how to view an available Instagram profile picture in full size.",
  );
  const otherDescriptions = Object.entries(articles)
    .filter(
      ([slug]) => slug !== "how-to-view-instagram-profiles-without-an-account",
    )
    .map(([, article]) => article.description);
  expect(otherDescriptions).not.toContain(description);
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
  await expect(article).toContainText("anonymous access is not guaranteed");
  await expect(article).toContainText(
    "Private posts, private stories, follower-only reels",
  );
  await expect(article).toContainText(
    "If Instagram makes the account's profile image publicly available",
  );
  await expect(article).toContainText(
    "Profile-picture availability is conditional",
  );
  const viewerLink = article.getByRole("link", {
    name: "View an available Instagram profile picture",
    exact: true,
  });
  await expect(viewerLink).toHaveAttribute("href", "/profile-picture-viewer/");

  for (const href of await article
    .locator('a[href^="/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")!))) {
    expect((await request.get(href)).status(), href).toBe(200);
  }
});

test("profile picture explainer links back without changing the lookup", async ({
  page,
}) => {
  await page.goto("/profile-picture-viewer/");
  const explainer = page.locator(".tool-explainer");
  await expect(
    explainer.getByRole("link", {
      name: "Learn what you can view on Instagram without an account",
      exact: true,
    }),
  ).toHaveAttribute("href", path);
  await expect(
    page.getByLabel("Instagram username or profile URL"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View public photo", exact: true }),
  ).toBeVisible();
});
