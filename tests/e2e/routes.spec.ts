import { test, expect } from "@playwright/test";
import { tools } from "../../src/lib/site";

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
  const paths = [
    "/",
    ...Object.keys(tools).map((tool) => `/${tool}/`),
    "/privacy/",
    "/how-to-download-instagram-followers-data/",
    "/changelog/",
  ];
  for (const path of paths) {
    expect((await page.goto(path))?.status(), path).toBe(200);
    await expect(page.locator("main h1")).toHaveCount(1);
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
