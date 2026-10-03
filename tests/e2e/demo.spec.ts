import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("homepage leads with relationship review and keeps every tool and demo usable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your Instagram circle.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "With context.",
  );
  await expect(page.locator(".hero-copy")).toContainText(
    "sent requests in your export",
  );
  await expect(
    page.getByRole("link", { name: "Review my Instagram" }),
  ).toHaveAttribute("href", "#tool");
  await expect(page.getByLabel("Fictional demo result preview")).toContainText(
    "1,284",
  );
  await expect(page.getByLabel("Fictional demo result preview")).toContainText(
    "25",
  );
  await expect(page.getByLabel("Fictional demo result preview")).toContainText(
    "10",
  );
  expect(
    await page
      .locator(".feature-grid a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual([
    "/followers-analyzer/",
    "/pending-follow-requests/",
    "/relationship-timeline/?direction=followers",
    "/snapshot-comparison/",
    "/instagram-cleaner/",
    "/unfollow-history/",
    "/instagram-wrapped/",
    "/not-following-back/",
    "/profile-picture-viewer/",
    "/connection-privacy/",
    "/following-analyzer/",
  ]);
  await expect(page.locator(".feature-grid")).toContainText(
    "Public profile tool",
  );
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(page.locator(".demo-notice")).toBeVisible();
  await page
    .locator(".feature-grid")
    .getByRole("link", { name: /Following analyzer/ })
    .click();
  await expect(
    page.getByRole("button", { name: /Following 932/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".demo-notice")).toBeVisible();
});

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
  const review = page.getByRole("region", {
    name: "Explore more from this export",
  });
  await expect(review).toContainText("3 sent requests recorded in this export");
  await expect(review).toContainText("2 recent unfollow actions by you");
  await review.getByRole("link", { name: /Pending requests/ }).click();
  await expect(
    page.getByRole("region", { name: "Pending request review" }),
  ).toContainText("3 requests in this export");
  const pendingDemo = page.getByRole("region", {
    name: "Pending request review",
  });
  await expect(pendingDemo.locator(".demo-profile")).toHaveCount(3);
  await expect(
    pendingDemo.locator('.accounts a[href*="instagram.com"]'),
  ).toHaveCount(0);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Your unfollow history", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Your unfollow history" }),
  ).toContainText("2 records");
  const unfollowDemo = page.getByRole("region", {
    name: "Your unfollow history",
  });
  await expect(unfollowDemo.locator(".demo-profile")).toHaveCount(2);
  await expect(
    unfollowDemo.locator('.accounts a[href*="instagram.com"]'),
  ).toHaveCount(0);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
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
    page.getByRole("button", { name: /One-way follows 190/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Pending requests 3/ }).click();
  await expect(
    page.getByRole("region", { name: "Relationship Review" }),
  ).toContainText("Sent requests recorded as pending in this export");
  await page.getByRole("button", { name: /You unfollowed 2/ }).click();
  await expect(
    page.getByRole("region", { name: "Relationship Review" }),
  ).toContainText("This does not identify people who unfollowed you");
  await page.getByRole("button", { name: /One-way follows 190/ }).click();
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
  expect(drawn).toContain("DEMO DATA · FICTIONAL EXAMPLE");
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
