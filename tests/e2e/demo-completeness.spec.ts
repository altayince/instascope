import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { savedRecords, seedRecords, upload } from "../helpers/vault";

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function vaultMetadata(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open("instascope:snapshot-vault", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("metadata", "readonly");
          const rows = tx.objectStore("metadata").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(rows.result);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}

test("Vault demo compares any pair in memory, disables storage actions and restores real history untouched", async ({
  page,
  request,
}) => {
  await page.goto("/dashboard/");
  const real = {
    id: "synthetic-real",
    version: 1,
    exportDate: "2026-08-01",
    createdAt: 1,
    followers: ["sample.real"],
    following: ["sample.real"],
  };
  await seedRecords(page, [real]);
  // Simulate previously saved history before loading the provider's summaries.
  await page.reload();
  await upload(page);
  await page.getByRole("link", { name: "Open Vault", exact: true }).click();
  await expect(page.locator(".vault-row")).toHaveCount(1);
  const before = await savedRecords(page);
  const metadata = await vaultMetadata(page);
  await page.evaluate(() => {
    const writes: string[] = [];
    Object.assign(window, { demoVaultWrites: writes });
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (names, mode, options) {
      if (mode === "readwrite") writes.push(this.name);
      return transaction.call(this, names, mode, options);
    };
  });
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Try Vault demo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/snapshot-vault\/\?demo=true$/);
  await expect(
    page.getByText(
      "Demo data · Fictional history. Your real saved snapshots are unchanged.",
    ),
  ).toBeVisible();
  await expect(page.locator(".vault-row")).toHaveCount(4);
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toHaveCount(0);
  await expect(page.locator(".vault-list")).not.toContainText("2026");
  await expect(page.locator(".vault-history tbody tr")).toHaveCount(4);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://instascope.me/snapshot-vault/",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("snapshot-vault");
  expect(sitemap).not.toContain("demo=true");
  for (const name of [
    "Export Vault backup",
    "Import Vault backup",
    "Delete all saved snapshots",
  ])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  for (const button of await page
    .locator(".vault-row")
    .getByRole("button", { name: /^Delete / })
    .all())
    await expect(button).toBeDisabled();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const dates = ["2025-01-15", "2025-04-15", "2025-07-15", "2025-10-15"];
  for (let i = 0; i < dates.length; i++) {
    for (let j = i + 1; j < dates.length; j++) {
      await page
        .getByLabel("Older snapshot", { exact: true })
        .selectOption(`demo-vault-${dates[i]}`);
      await page
        .getByLabel("Newer snapshot", { exact: true })
        .selectOption(`demo-vault-${dates[j]}`);
      const compare = page.getByRole("button", {
        name: "Compare saved snapshots",
        exact: true,
      });
      await expect(compare).toBeDisabled();
      await page
        .getByRole("checkbox", {
          name: "These fictional snapshots represent the same example account.",
        })
        .check();
      await compare.click();
      const results = page.getByRole("region", {
        name: "Snapshot comparison results",
      });
      await expect(results).toContainText(/Follower change: \+/);
      await expect(results.locator(".accounts li").first()).toContainText(
        "@demo.",
      );
      await expect(results.locator('a[href*="instagram.com"]')).toHaveCount(0);
      await fits(page);
    }
  }
  expect(await savedRecords(page)).toEqual(before);
  expect(await vaultMetadata(page)).toEqual(metadata);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { demoVaultWrites: string[] }).demoVaultWrites,
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Exit demo", exact: true }).click();
  await expect(page).toHaveURL(/\/snapshot-vault\/$/);
  await expect(page.locator(".vault-row")).toHaveCount(1);
  await expect(page.locator(".vault-row")).toContainText("1 Aug 2026");
  await expect(
    page.getByRole("region", { name: "Snapshot comparison results" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export Vault backup", exact: true }),
  ).toBeEnabled();
  expect(await savedRecords(page)).toEqual(before);
  expect(await vaultMetadata(page)).toEqual(metadata);
});

test("Vault fictional history works even when real local storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  await page.goto("/snapshot-vault/");
  await page
    .getByRole("button", { name: "Try Vault demo", exact: true })
    .click();
  await expect(page.locator(".vault-row")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Compare 15 Oct 2025", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "These fictional snapshots represent the same example account.",
    })
    .check();
  await page
    .getByRole("button", { name: "Compare saved snapshots", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Snapshot comparison results" }),
  ).toContainText("Follower change: +58");
  await fits(page);
});

test("local viewer sample uses actual controls and native AI output without lookup or external requests", async ({
  page,
  browserName,
}, testInfo) => {
  test.setTimeout(180000);
  const forbidden: string[] = [],
    models: string[] = [],
    events: string[] = [];
  await page.addInitScript(() => {
    Object.assign(window, { sampleEvents: [] });
    window.addEventListener("instascope:event", (e) =>
      (window as unknown as { sampleEvents: string[] }).sampleEvents.push(
        (e as CustomEvent).detail.event,
      ),
    );
  });
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (
      url.pathname.startsWith("/api/profile-picture") ||
      (url.protocol.startsWith("http") &&
        url.origin !== "http://127.0.0.1:3000")
    )
      forbidden.push(r.url());
    if (url.pathname.includes("/profile-ai/")) models.push(r.url());
  });
  await page.goto("/profile-picture-viewer/");
  await page
    .getByRole("button", { name: "Try with sample photo", exact: true })
    .click();
  await expect(
    page.getByText("Sample image · No Instagram lookup performed."),
  ).toBeVisible();
  const photo = page.locator(".photo-preview img");
  await expect(photo).toHaveAttribute("src", "/demo/profile-sample.png");
  await expect(page.getByText("Original sample · 150 × 150")).toBeVisible();
  await expect(
    page.locator('.profile-viewer a[href*="instagram.com"]'),
  ).toHaveCount(0);
  expect(models).toEqual([]);
  await page.getByLabel("Zoom", { exact: true }).fill("2");
  await expect(photo).toHaveCSS("transform", "matrix(2, 0, 0, 2, 0, 0)");
  await page.getByLabel("Circular preview", { exact: true }).check();
  await expect(page.locator(".photo-preview")).toHaveClass(/circle/);
  const fullscreenSupported = await page.evaluate(
    () => !!document.fullscreenEnabled,
  );
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  if (fullscreenSupported) {
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await expect(photo).toHaveCSS("object-fit", "contain");
    await expect(photo).toHaveCSS("transform", "none");
    await page.evaluate(() => document.exitFullscreen());
  } else {
    await expect(
      page.locator(".profile-viewer").getByRole("alert"),
    ).toContainText("Fullscreen is not available");
  }
  await page
    .getByRole("button", { name: "AI upscale 4×", exact: true })
    .click();
  await expect(page.getByText("AI-upscaled · 600 × 600")).toBeVisible({
    timeout: 150000,
  });
  expect(models.some((url) => url.endsWith(".onnx"))).toBe(true);
  expect(models.some((url) => url.endsWith(".wasm"))).toBe(true);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Save upscaled PNG", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("instascope-sample-ai-600x600.png");
  const output = await readFile((await download.path())!);
  const meta = await sharp(output).metadata();
  expect([meta.width, meta.height]).toEqual([600, 600]);
  await testInfo.attach(`${browserName}-sample-upscaled.png`, {
    body: output,
    contentType: "image/png",
  });
  await testInfo.attach("sample-viewer", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await expect(photo).toHaveAttribute("src", "/demo/profile-sample.png");
  await page
    .getByRole("button", { name: "AI upscale 4×", exact: true })
    .click();
  await expect(photo).toHaveAttribute("src", /^blob:/);
  await fits(page);
  await page.getByRole("button", { name: "Exit sample", exact: true }).click();
  await expect(photo).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Try with sample photo", exact: true }),
  ).toBeVisible();
  events.push(
    ...(await page.evaluate(
      () => (window as unknown as { sampleEvents: string[] }).sampleEvents,
    )),
  );
  expect(events.filter((event) => event.startsWith("profile_"))).toEqual([]);
  expect(forbidden).toEqual([]);
});

test("Dashboard and every export tool keep meaningful fictional data, missing dates, sorting and safe account rows", async ({
  page,
}) => {
  test.setTimeout(60000);
  // This audit tests data/navigation, not scroll animation. Respect the site's
  // reduced-motion path so WebKit can reliably tap the off-screen header.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".demo-notice")).toContainText("Fictional example");
  await expect(page.locator(".dashboard-coverage")).toContainText(
    "1,244 of 1,284",
  );
  await expect(page.locator(".dashboard-coverage")).toContainText("903 of 932");
  await expect(
    page.locator('.dashboard-tool-card[href="/profile-picture-viewer/"]'),
  ).toContainText("local sample photo");
  await fits(page);
  await page.getByRole("link", { name: "Try Vault demo", exact: true }).click();
  await expect(page.locator(".vault-row")).toHaveCount(4);
  await page
    .getByRole("link", { name: "Back to Dashboard", exact: true })
    .click();
  const surfaces = [
    ["followers-analyzer", ".accounts li", "@demo."],
    ["following-analyzer", ".accounts li", "@demo."],
    ["not-following-back", ".accounts li", "@demo.oneway."],
    ["pending-follow-requests", ".accounts li", "@demo.request."],
    ["connection-privacy", ".accounts li", "@demo.closefriend."],
    ["unfollow-history", ".accounts li", "@demo.unfollow."],
    ["relationship-timeline", ".timeline-chart", "2016"],
    ["instagram-cleaner", ".accounts li", "@demo."],
    ["snapshot-comparison", ".snapshot-status", "Fictional"],
    ["instagram-wrapped", ".wrapped-card", "DEMO DATA"],
  ];
  for (const [slug, selector, text] of surfaces) {
    await page.locator(`.dashboard-tool-card[href="/${slug}/"]`).click();
    await expect(page.locator(".demo-notice")).toContainText(
      "Fictional example",
    );
    await expect(page.locator(selector).first()).toContainText(text);
    await expect(
      page.locator('.accounts a[href*="instagram.com"]'),
    ).toHaveCount(0);
    if (slug === "followers-analyzer" || slug === "following-analyzer") {
      const search = page.getByRole("searchbox", { name: "Search accounts" });
      await search.fill("demo.mutual.0032");
      await expect(page.locator(".accounts li")).toContainText(
        "Date unavailable",
      );
      await search.fill("demo.mutual.");
      const sort = page.getByLabel("Sort accounts", { exact: true });
      await sort.selectOption("oldest");
      const first = await page.locator(".accounts li").first().innerText();
      expect(first).toContain("@demo.mutual.0001");
      await sort.selectOption("newest");
      expect(await page.locator(".accounts li").first().innerText()).not.toBe(
        first,
      );
      await sort.selectOption("oldest");
      expect(await page.locator(".accounts li").first().innerText()).toBe(
        first,
      );
    }
    if (slug === "relationship-timeline") {
      await expect(
        page.getByRole("region", { name: "Relationship date timeline" }),
      ).toContainText("29 dates unavailable");
      await page
        .getByRole("button", { name: "Date unavailable (29)", exact: true })
        .click();
      await expect(page.locator(".accounts li").first()).toContainText(
        "Date unavailable",
      );
      await page
        .getByLabel("Relationship direction", { exact: true })
        .selectOption("followers");
      await expect(
        page.getByRole("region", { name: "Relationship date timeline" }),
      ).toContainText("40 dates unavailable");
    }
    await fits(page);
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Dashboard", exact: true })
      .click();
  }
  await page
    .locator('.dashboard-tool-card[href="/profile-picture-viewer/"]')
    .click();
  await page
    .getByRole("button", { name: "Try with sample photo", exact: true })
    .click();
  await expect(page.getByText("Original sample · 150 × 150")).toBeVisible();
  await fits(page);
});
