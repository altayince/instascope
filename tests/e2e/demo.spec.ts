import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("fictional demo supports exploration, Cleaner, comparison and a labeled PNG without an archive", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" || !r.url().startsWith("http://127.0.0.1:3000"))
      external.push(r.url());
  });
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.assign(window, { drawnTexts: texts });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof original>
    ) {
      texts.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.goto("/followers-analyzer/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".demo-notice")).toContainText("Fictional example");
  await expect(
    page.getByRole("button", { name: /Followers 1,284/ }),
  ).toBeVisible();
  await expect(page.locator(".accounts li")).toHaveCount(50);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 26", { exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("demo.mutual.0001");
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.locator('.accounts a[href*="instagram.com"]')).toHaveCount(
    0,
  );
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "InstaCleaner", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Not following back 190/ }),
  ).toBeVisible();
  await page.locator(".accounts input[type=checkbox]").first().check();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots", exact: true })
    .click();
  await expect(page.getByText(/Follower change: \+15/)).toBeVisible();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped", exact: true })
    .click();
  await expect(page.locator(".wrapped-card")).toContainText("DEMO DATA");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Wrapped" }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe("instascope-demo-wrapped.png");
  const png = readFileSync((await download.path())!);
  expect(png.readUInt32BE(16)).toBe(1080);
  const drawn = await page.evaluate(
    () => (window as unknown as { drawnTexts: string[] }).drawnTexts,
  );
  expect(drawn).toContain("DEMO DATA - FICTIONAL EXAMPLE");
  await page
    .getByRole("button", { name: "Use my own export", exact: true })
    .click();
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      "tests/fixtures/followers_1.json",
      "tests/fixtures/following.json",
    ]);
  await expect(page.locator(".wrapped-card")).toBeVisible();
  await expect(page.locator(".wrapped-card")).not.toContainText("DEMO");
  await expect(page.locator(".demo-notice")).toHaveCount(0);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots", exact: true })
    .click();
  await expect(page.locator(".snapshot-status")).not.toContainText("Fictional");
  await expect(
    page.getByLabel("Upload older snapshot", { exact: true }),
  ).toBeAttached();
  expect(external).toEqual([]);
});
