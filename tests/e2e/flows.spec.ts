import { test, expect } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import { readFileSync } from "node:fs";
import { writeLargeExport } from "../helpers/large-export";
const files = [
  "tests/fixtures/followers_1.json",
  "tests/fixtures/following.json",
];

test("upload stays disabled until its browser handlers are ready", async ({
  page,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await ready;
    await route.continue();
  });
  await page.goto("/followers-analyzer/", { waitUntil: "commit" });
  const input = page.getByLabel("Upload Instagram export", { exact: true });
  try {
    await expect(input).toBeDisabled();
  } finally {
    release();
  }
  await expect(input).toBeEnabled();
  await input.setInputFiles(files);
  await expect(page.getByRole("button", { name: /Followers 3/ })).toBeVisible();
});

test("large media-rich ZIP imports locally without transferring file bytes on the main thread", async ({
  page,
}, testInfo) => {
  const path = testInfo.outputPath("large-synthetic-export.zip");
  writeLargeExport(path);
  await page.addInitScript(() => {
    File.prototype.arrayBuffer = async function () {
      throw new Error("Whole file read on the UI thread");
    };
  });
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(path);
  await expect(page.getByRole("button", { name: /Followers 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Following 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mutuals 1/ })).toBeVisible();
  expect(posts).toEqual([]);
});
test("upload ZIP, correct relationships, search, and no network upload", async ({
  page,
}) => {
  const uploads: string[] = [],
    errors: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") uploads.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const zip = zipSync({
    "connections/followers_and_following/followers_1.json": readFileSync(
      files[0],
    ),
    "connections/followers_and_following/following.json": readFileSync(
      files[1],
    ),
  });
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles({
      name: "instagram.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zip),
    });
  await expect(page.getByRole("button", { name: /Followers 3/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Following 4/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mutuals 2/ })).toBeVisible();
  await page.getByRole("button", { name: /Not following back 2/ }).click();
  await page.getByRole("searchbox").fill("ONE.WAY");
  await expect(page.getByText("@one.way", { exact: true })).toBeVisible();
  await expect(page.getByText("@old.friend", { exact: true })).toHaveCount(0);
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Cleaner preserves selection across search and exports a review list", async ({
  page,
}) => {
  await page.goto("/instagram-cleaner/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
  await page
    .getByRole("checkbox", { name: "Select one.way", exact: true })
    .check();
  await page.getByRole("searchbox").fill("old");
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await page.getByRole("searchbox").clear();
  await expect(
    page.getByRole("checkbox", { name: "Select one.way", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: /Mutuals 2/ }).click();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /One-way follows 2/ }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select one.way", exact: true }),
  ).toBeChecked();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "instascope-review-list.csv",
  );
});
test("compare older and newer snapshots without false causality", async ({
  page,
}) => {
  await page.goto("/snapshot-comparison/");
  await page
    .getByLabel("Upload newer snapshot", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
  const rows = [
    { string_list_data: [{ value: "alice" }] },
    { string_list_data: [{ value: "missing.person" }] },
  ];
  await page
    .getByLabel("Upload older snapshot", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      {
        name: "followers.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(rows)),
      },
      {
        name: "following.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"relationships_following":[]}'),
      },
    ]);
  await page.getByRole("button", { name: "Missing followers 1" }).click();
  await expect(
    page.getByText("@missing.person", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/not why or exactly when/)).toBeVisible();
});
test("Wrapped exports a real aggregate PNG and clears private data", async ({
  page,
}) => {
  await page.goto("/instagram-wrapped/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
  await expect(page.locator(".wrapped-card")).toContainText("3");
  await expect(page.locator(".wrapped-card")).not.toContainText("alice");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Wrapped" }).click();
  const saved = await event;
  expect(saved.suggestedFilename()).toBe("instascope-wrapped.png");
  const path = await saved.path();
  const png = readFileSync(path!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await expect(
    page.locator("button").filter({ hasText: "Upload Instagram export" }),
  ).toBeVisible();
});
test("malformed upload has actionable error and can recover", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles({
      name: "followers.json",
      mimeType: "application/json",
      buffer: Buffer.from("{"),
    });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "damaged or incomplete",
  );
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
  await expect(page.getByRole("button", { name: /Followers 3/ })).toBeVisible();
});
test("HTML is parsed without fetching or executing its contents", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("example.com")) external.push(request.url());
  });
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      "tests/fixtures/followers.html",
      "tests/fixtures/following.html",
    ]);
  await expect(page.getByRole("button", { name: /Followers 3/ })).toBeVisible();
  expect(external).toEqual([]);
});
test("profile viewer normalizes URLs and degrades independently", async ({
  page,
}) => {
  await page.route("**/api/profile-picture?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "service_not_configured" }),
    }),
  );
  await page.goto("/profile-picture-viewer/");
  await page
    .getByLabel("Instagram username or profile URL")
    .fill("https://www.instagram.com/ALICE/?igsh=abc");
  await page.getByRole("button", { name: "View public photo" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "not available on this deployment",
  );
  await expect(
    page.getByRole("link", { name: "Open @alice on Instagram" }),
  ).toHaveAttribute("href", "https://www.instagram.com/alice/");
});
test("rejects missing lists without a misleading dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles({
      name: "followers.json",
      mimeType: "application/json",
      buffer: Buffer.from(strToU8("[]")),
    });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Missing Following",
  );
  await expect(page.locator(".stats-grid")).toHaveCount(0);
});
test("tool navigation preserves the dataset and applies the destination filter", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
  await page
    .getByRole("navigation", { name: "Related tools" })
    .getByRole("link", { name: "Not following back" })
    .click();
  await expect(
    page.getByRole("button", { name: /Not following back 2/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("@one.way", { exact: true })).toBeVisible();
  await expect(page.getByText("@fan.only", { exact: true })).toHaveCount(0);
});
