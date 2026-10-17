import { expect, test } from "@playwright/test";
import { collectEvents } from "../helpers/analytics";

test("profile lookup controls wait for hydration so typed usernames reach the verified lookup", async ({
  page,
}) => {
  await collectEvents(page);
  let release!: () => void;
  const scripts = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scripts;
    await route.continue();
  });
  const imageUrl = "https://scontent-synthetic.cdninstagram.com/photo.png";
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=",
    "base64",
  );
  const lookups: string[] = [];
  await page.route("**/api/profile-picture?*", (route) => {
    const request = route.request();
    lookups.push(new URL(request.url()).searchParams.get("username")!);
    expect(request.headers()).not.toHaveProperty("cookie");
    expect(request.headers()).not.toHaveProperty("referer");
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "sample.account", imageUrl }),
    });
  });
  await page.route(imageUrl, (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.goto("/profile-picture-viewer/", { waitUntil: "commit" });
  const username = page.getByLabel("Instagram username or profile URL", {
    exact: true,
  });
  const submit = page.getByRole("button", {
    name: "View public photo",
    exact: true,
  });
  const sample = page.getByRole("button", {
    name: "Try with sample photo",
    exact: true,
  });
  try {
    await expect(username).toBeDisabled();
    await expect(submit).toBeDisabled();
    await expect(sample).toBeDisabled();
    expect(lookups).toEqual([]);
  } finally {
    release();
  }
  await expect(username).toBeEnabled();
  await expect(submit).toBeEnabled();
  await expect(sample).toBeEnabled();
  await expect(page.locator(".profile-viewer form")).toHaveAttribute(
    "data-profile-endpoint",
    "/api/profile-picture",
  );
  await username.fill("@Sample.Account");
  await submit.click();
  const photo = page.getByRole("img", {
    name: "Public profile photo for sample.account",
    exact: true,
  });
  await expect(photo).toBeVisible();
  await expect
    .poll(() =>
      photo.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  await expect(username).toHaveValue("@Sample.Account");
  expect(lookups).toEqual(["sample.account"]);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});
