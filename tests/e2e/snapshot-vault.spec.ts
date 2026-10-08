import { expect, test, type Page } from "@playwright/test";
import {
  original,
  newer,
  upload,
  save,
  savedRecords,
  seedRecords,
} from "../helpers/vault";
import type { VaultSnapshot } from "../../src/lib/snapshot-vault";
import { SNAPSHOT_KEY } from "../../src/lib/snapshot-storage";

const first: VaultSnapshot = {
  id: "first",
  version: 1,
  exportDate: "2026-07-01",
  createdAt: 1,
  followers: ["alpha", "lost"],
  following: ["alpha", "removed"],
};
const second: VaultSnapshot = {
  id: "second",
  version: 1,
  exportDate: "2026-08-01",
  createdAt: 2,
  followers: ["alpha", "beta", "gained"],
  following: ["beta", "added"],
};
const third: VaultSnapshot = {
  ...second,
  id: "third",
  exportDate: "2026-10-08",
  createdAt: 3,
  followers: ["alpha", "beta", "gained", "extra"],
};
function backupFile(snapshots: unknown[] = [first, second]) {
  return {
    name: "instascope-snapshot-vault.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "instascope-snapshot-vault",
        version: 1,
        snapshots,
      }),
    ),
  };
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function populated(
  page: Page,
  records: unknown[] = [first, second, third],
) {
  await page.goto("/snapshot-vault/");
  await expect(
    page.getByText("No snapshots saved yet.", { exact: true }),
  ).toBeVisible();
  await seedRecords(page, records);
  await page.reload();
  await expect(page.locator(".vault-row")).toHaveCount(records.length);
}

test("Vault is a private application route and leaves public SEO unchanged", async ({
  page,
  request,
}) => {
  expect((await page.goto("/snapshot-vault/"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Snapshot Vault",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://instascope.me/snapshot-vault/",
  );
  const preview = process.env.NEXT_PUBLIC_PREVIEW === "true";
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    preview ? "noindex, nofollow" : "noindex, follow",
  );
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "snapshot-vault",
  );
  await expect(
    page.getByText("No snapshots saved yet.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export Vault backup" }),
  ).toBeDisabled();
  await fits(page);
});

test("real snapshots persist separately, dates sort correctly, trends show only saved totals, demo cannot save", async ({
  page,
}, testInfo) => {
  await page.goto("/dashboard/");
  await upload(page);
  await save(page, "2026-10-08");
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toContainText("Snapshot saved locally · 8 Oct 2026");
  await save(page, "2026-07-01");
  await page
    .getByRole("region", { name: "Snapshot Vault" })
    .getByRole("link", { name: "Open Vault" })
    .click();
  await expect(page.locator(".vault-row h3")).toHaveText([
    "8 Oct 2026",
    "1 Jul 2026",
  ]);
  await expect(page.locator(".vault-row").first()).toContainText(
    "3 followers · 4 following",
  );
  await expect(page.locator(".vault-history tbody tr th")).toHaveText([
    "1 Jul 2026",
    "8 Oct 2026",
  ]);
  await expect(page.locator(".vault-trend circle")).toHaveCount(4);
  await expect(
    page.getByText(
      "Each point is a saved export snapshot, not continuous monitoring.",
    ),
  ).toBeVisible();
  const records = await savedRecords(page);
  expect(records).toHaveLength(2);
  expect(JSON.stringify(records)).not.toMatch(
    /timestamp|href|connections|warnings|sourceFormat/,
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SNAPSHOT_KEY),
  ).toBeNull();
  await fits(page);
  await page.screenshot({
    path: testInfo.outputPath("vault-history.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".vault-row")).toHaveCount(2);
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await expect(
    page.getByRole("region", { name: "Snapshot Vault" }),
  ).toContainText("2 saved snapshots");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toHaveCount(0);
  await page
    .getByRole("region", { name: "Snapshot Vault" })
    .getByRole("link", { name: "Open Vault" })
    .click();
  await expect(page.getByText(/Demo data · Fictional example/)).toBeVisible();
  expect(await savedRecords(page)).toHaveLength(2);
});

test("any two saved exports require distinct dates, chronological order and same-account confirmation", async ({
  page,
}, testInfo) => {
  await populated(page);
  const older = page.getByLabel("Older snapshot", { exact: true }),
    newerSelect = page.getByLabel("Newer snapshot", { exact: true });
  const confirmation = page.getByRole("checkbox", {
    name: "These exports are from the same Instagram account.",
  });
  const compare = page.getByRole("button", {
    name: "Compare saved snapshots",
    exact: true,
  });
  await older.selectOption("first");
  await newerSelect.selectOption("second");
  await expect(compare).toBeDisabled();
  await confirmation.check();
  await newerSelect.selectOption("first");
  await expect(confirmation).not.toBeChecked();
  await confirmation.check();
  await compare.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "two different",
  );
  await older.selectOption("third");
  await newerSelect.selectOption("first");
  await confirmation.check();
  await compare.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "earlier",
  );
  await older.selectOption("first");
  await newerSelect.selectOption("second");
  await confirmation.check();
  await compare.click();
  const results = page.getByRole("region", {
    name: "Snapshot comparison results",
  });
  await expect(results).toContainText(
    "Follower change: +1 · Following change: +0",
  );
  for (const [label, names] of [
    ["Added followers 2", ["beta", "gained"]],
    ["Missing followers 1", ["lost"]],
    ["Newly followed 2", ["added", "beta"]],
    ["No longer following 2", ["alpha", "removed"]],
    ["New mutuals 1", ["beta"]],
    ["No longer mutual 1", ["alpha"]],
  ] as const) {
    await results.getByRole("button", { name: label, exact: true }).click();
    for (const name of names)
      await expect(results.locator(".accounts")).toContainText(name);
  }
  await expect(results).toContainText(
    "Renames, deactivations and differences in exports",
  );
  await fits(page);
  await page.screenshot({
    path: testInfo.outputPath("vault-comparison.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Compare 8 Oct 2026", exact: true })
    .click();
  await expect(older).toHaveValue("second");
  await expect(newerSelect).toHaveValue("third");
  await expect(compare).toBeDisabled();
});

test("same-date replacement requires confirmation and a failed transaction preserves the old record", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await upload(page);
  await save(page, "2026-10-08");
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toContainText("Snapshot saved locally");
  const before = await savedRecords(page);
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await upload(page, newer);
  await save(page, "2026-10-08");
  const dialog = page.getByRole("dialog", { name: "Replace snapshot?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await savedRecords(page)).toEqual(before);
  await save(page, "2026-10-08");
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = put.apply(this, args);
      if (this.name === "snapshots") this.transaction.abort();
      return request;
    };
  });
  await dialog
    .getByRole("button", { name: "Replace snapshot", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Browser storage is unavailable",
  );
  expect(await savedRecords(page)).toEqual(before);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await upload(page, newer);
  await save(page, "2026-10-08");
  await dialog
    .getByRole("button", { name: "Replace snapshot", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const after = await savedRecords(page);
  expect(after).toHaveLength(1);
  expect(after[0].id).toBe(before[0].id);
  expect(after[0].createdAt).toBeGreaterThan(before[0].createdAt);
  expect(after[0].followers).toEqual(["alice", "new.follower"]);
});

test("current uploaded export can use any saved older date without saving the current export", async ({
  page,
}) => {
  await populated(page, [first, second]);
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await upload(page, newer);
  await page
    .locator('.dashboard-tool-card[href="/snapshot-comparison/"]')
    .click();
  const choice = page.getByRole("region", {
    name: "Compare with saved snapshot",
  });
  await choice.getByLabel("Older saved snapshot").selectOption("first");
  await choice.getByLabel("Date of current export").fill("2026-10-08");
  await expect(
    choice.getByRole("button", { name: "Compare with saved snapshot" }),
  ).toBeDisabled();
  await choice.getByRole("checkbox").check();
  await choice
    .getByRole("button", { name: "Compare with saved snapshot" })
    .click();
  await expect(page.locator(".snapshot-status")).toContainText("2026-07-01");
  expect(await savedRecords(page)).toHaveLength(2);
  await page
    .getByRole("button", { name: "Choose another older snapshot" })
    .click();
  await choice.getByLabel("Older saved snapshot").selectOption("second");
  await choice.getByLabel("Date of current export").fill("2026-10-08");
  await choice.getByRole("checkbox").check();
  await choice
    .getByRole("button", { name: "Compare with saved snapshot" })
    .click();
  await expect(page.locator(".snapshot-status")).toContainText("2026-08-01");
  await page
    .getByRole("button", { name: "Choose another older snapshot" })
    .click();
  await upload(page, original, "Upload older snapshot");
  await expect(page.locator(".snapshot-status")).toContainText(
    "Manually uploaded older snapshot",
  );
  await expect(
    page.getByRole("region", { name: "Snapshot comparison results" }),
  ).toBeVisible();
});

test("delete dialogs support Escape/keyboard, strong clear-all and keep active export intact", async ({
  page,
}) => {
  await populated(page, [first, second]);
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await upload(page);
  await page
    .getByRole("region", { name: "Snapshot Vault" })
    .getByRole("link", { name: "Open Vault" })
    .click();
  const deleteOne = page.getByRole("button", {
    name: "Delete 1 Jul 2026",
    exact: true,
  });
  await deleteOne.click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(deleteOne).toBeFocused();
  expect(await savedRecords(page)).toHaveLength(2);
  await page.keyboard.press("Enter");
  await dialog
    .getByRole("button", { name: "Delete snapshot", exact: true })
    .click();
  await expect(page.locator(".vault-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Delete all saved snapshots", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Delete all snapshots", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog
    .getByRole("button", { name: "Delete all snapshots", exact: true })
    .click();
  await expect(
    page.getByText("No snapshots saved yet.", { exact: true }),
  ).toBeVisible();
  expect(await savedRecords(page)).toEqual([]);
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await expect(page.locator(".dashboard-metrics")).toContainText("3");
  await expect(
    page.getByRole("button", { name: "Clear active data & start over" }),
  ).toBeVisible();
});

test("backup export is private, import previews without writing, duplicates keep existing data", async ({
  page,
}) => {
  await populated(page, [first]);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Vault backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("instascope-snapshot-vault.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(exported).toEqual({
    format: "instascope-snapshot-vault",
    version: 1,
    snapshots: [first],
  });
  const importInput = page.getByLabel("Import Vault backup");
  await importInput.setInputFiles(
    backupFile([
      { ...first, id: "other-id", followers: ["do.not.replace"] },
      { ...second, followers: ["@BETA", "beta", "alpha"] },
    ]),
  );
  const preview = page.getByLabel("Backup import preview");
  await expect(preview).toContainText(
    "1 new snapshot · 1 existing date skipped",
  );
  expect(await savedRecords(page)).toEqual([first]);
  await preview
    .getByRole("button", { name: "Import snapshots", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Merge this Vault backup?" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await savedRecords(page)).toEqual([first]);
  await preview
    .getByRole("button", { name: "Import snapshots", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.locator(".vault-row")).toHaveCount(2);
  const records = await savedRecords(page);
  expect(records.find((s) => s.id === "first")).toEqual(first);
  expect(records.find((s) => s.id === "second")!.followers).toEqual([
    "alpha",
    "beta",
  ]);
  await importInput.setInputFiles(backupFile([first, second]));
  await expect(
    preview.getByRole("button", { name: "Import snapshots", exact: true }),
  ).toBeDisabled();
  await expect(preview).toContainText(
    "0 new snapshots · 2 existing dates skipped",
  );
});

test("invalid, wrong-version and oversized backups are rejected before any storage writes", async ({
  page,
}) => {
  await populated(page, [first]);
  const input = page.getByLabel("Import Vault backup");
  for (const raw of [
    "not JSON",
    JSON.stringify({
      format: "instascope-snapshot-vault",
      version: 2,
      snapshots: [],
    }),
    JSON.stringify({
      format: "instascope-snapshot-vault",
      version: 1,
      snapshots: [{ ...second, followers: ["<script>alert(1)</script>"] }],
    }),
  ]) {
    await input.setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(raw),
    });
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    expect(await savedRecords(page)).toEqual([first]);
    await expect(page.getByLabel("Backup import preview")).toHaveCount(0);
  }
  await input.setInputFiles({
    name: "oversized.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(32 * 1024 * 1024 + 1, " "),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "32 MB or smaller",
  );
  expect(await savedRecords(page)).toEqual([first]);
});

test("failed multi-record import rolls back new writes and preserves every existing snapshot", async ({
  page,
}) => {
  await populated(page, [first]);
  await page
    .getByLabel("Import Vault backup")
    .setInputFiles(backupFile([second, third]));
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    let writes = 0;
    IDBObjectStore.prototype.add = function (...args) {
      const request = add.apply(this, args);
      if (this.name === "snapshots" && ++writes === 2) this.transaction.abort();
      return request;
    };
  });
  await page
    .getByRole("button", { name: "Import snapshots", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "storage is unavailable",
  );
  expect(await savedRecords(page)).toEqual([first]);
});

test("ID collisions abort imports without replacing a different saved date", async ({
  page,
}) => {
  await populated(page, [first]);
  await page
    .getByLabel("Import Vault backup")
    .setInputFiles(backupFile([second, { ...third, id: first.id }]));
  await page
    .getByRole("button", { name: "Import snapshots", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Nothing was imported",
  );
  expect(await savedRecords(page)).toEqual([first]);
});

test("legacy snapshot migrates once, retains rollback copy and deletion cannot resurrect it", async ({
  page,
}) => {
  const legacy = {
    version: 1,
    exportDate: first.exportDate,
    followers: first.followers,
    following: first.following,
  };
  await page.addInitScript(
    ({ key, raw }) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem("seeded", "true");
      }
    },
    { key: SNAPSHOT_KEY, raw: JSON.stringify(legacy) },
  );
  await page.goto("/snapshot-vault/");
  await expect(page.locator(".vault-row")).toHaveCount(1);
  const records = await savedRecords(page);
  expect(records[0].id).toBe("legacy-v1-2026-07-01");
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      SNAPSHOT_KEY,
    ),
  ).toEqual(legacy);
  await page.reload();
  expect(await savedRecords(page)).toEqual(records);
  await page
    .getByRole("button", { name: "Delete 1 Jul 2026", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete snapshot", exact: true })
    .click();
  await expect(
    page.getByText("No snapshots saved yet.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SNAPSHOT_KEY),
  ).toBeNull();
  // Simulate an old deployment restoring its copy: the marker still prevents resurrection.
  await page.evaluate(
    ({ key, legacy }) => localStorage.setItem(key, JSON.stringify(legacy)),
    { key: SNAPSHOT_KEY, legacy },
  );
  await page.reload();
  await expect(
    page.getByText("No snapshots saved yet.", { exact: true }),
  ).toBeVisible();
  expect(await savedRecords(page)).toEqual([]);
});

test("malformed legacy and corrupt IDB records do not break the valid history", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "{broken"),
    SNAPSHOT_KEY,
  );
  await page.goto("/snapshot-vault/");
  await expect(
    page.getByText("No snapshots saved yet.", { exact: true }),
  ).toBeVisible();
  await seedRecords(page, [first, { ...second, version: 9 }]);
  await page.reload();
  await expect(page.locator(".vault-row")).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "1 unreadable saved record",
  );
  expect(await savedRecords(page)).toHaveLength(2);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Vault backup" }).click();
  const stream = await (await downloadPromise).createReadStream(),
    chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).snapshots).toEqual([
    first,
  ]);
  await page
    .getByRole("button", { name: "Delete all saved snapshots", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Type DELETE to confirm")
    .fill("DELETE");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete all snapshots", exact: true })
    .click();
  await expect(
    page.getByText("No snapshots saved yet.", { exact: true }),
  ).toBeVisible();
  expect(await savedRecords(page)).toEqual([]);
});

test("quota exhaustion never deletes older history and failed deletion retains the record", async ({
  page,
}) => {
  await populated(page, [first]);
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await upload(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.add = function () {
      throw new DOMException("Synthetic quota", "QuotaExceededError");
    };
  });
  await save(page, "2026-10-08");
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toContainText("Browser storage is full");
  expect(await savedRecords(page)).toEqual([first]);
  await page
    .getByRole("region", { name: "Snapshot Vault" })
    .getByRole("link", { name: "Open Vault" })
    .click();
  await page.evaluate(() => {
    IDBObjectStore.prototype.delete = function () {
      throw new DOMException("Synthetic failure", "UnknownError");
    };
  });
  await page
    .getByRole("button", { name: "Delete 1 Jul 2026", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete snapshot", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "storage is unavailable",
  );
  expect(await savedRecords(page)).toEqual([first]);
});

test("unavailable IndexedDB does not prevent real export analysis or manual comparison", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("Synthetic blocked storage", "SecurityError");
      },
    }),
  );
  await page.goto("/dashboard/");
  await upload(page);
  await expect(page.locator(".dashboard-metrics")).toContainText("3");
  await expect(
    page
      .getByRole("region", { name: "Save a local snapshot" })
      .getByRole("button", { name: "Save snapshot", exact: true }),
  ).toBeDisabled();
  await page
    .locator('.dashboard-tool-card[href="/snapshot-comparison/"]')
    .click();
  await upload(page, newer, "Upload older snapshot");
  await expect(
    page.getByRole("region", { name: "Snapshot comparison results" }),
  ).toBeVisible();
});

test("blocked legacy access leaves IndexedDB usable and clearly reports the migration limitation", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (name === key)
        throw new DOMException("Synthetic legacy restriction", "SecurityError");
      return get.call(this, name);
    };
  }, SNAPSHOT_KEY);
  await page.goto("/dashboard/");
  await upload(page);
  await save(page, "2026-10-08");
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toContainText("Snapshot saved locally");
  await page
    .getByRole("region", { name: "Snapshot Vault" })
    .getByRole("link", { name: "Open Vault" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "older saved copy could not be checked" }),
  ).toBeVisible();
  await expect(page.locator(".vault-row")).toHaveCount(1);
  expect(await savedRecords(page)).toHaveLength(1);
});

test("migration quota failure keeps the legacy copy, permits deletion, and retries without a false marker", async ({
  page,
}) => {
  const legacy = {
    version: 1,
    exportDate: first.exportDate,
    followers: first.followers,
    following: first.following,
  };
  await page.addInitScript(
    ({ key, legacy }) => {
      if (sessionStorage.getItem("migration-failure-seeded")) return;
      sessionStorage.setItem("migration-failure-seeded", "true");
      localStorage.setItem(key, JSON.stringify(legacy));
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) {
        if (this.name === "snapshots")
          throw new DOMException("Synthetic quota", "QuotaExceededError");
        return add.apply(this, args);
      };
    },
    { key: SNAPSHOT_KEY, legacy },
  );
  await page.goto("/snapshot-vault/");
  await expect(
    page.getByText("No snapshots saved yet.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "could not be migrated" }),
  ).toContainText("Browser storage is full");
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      SNAPSHOT_KEY,
    ),
  ).toEqual(legacy);
  expect(await savedRecords(page)).toEqual([]);
  await page.reload();
  await expect(page.locator(".vault-row")).toHaveCount(1);
  expect((await savedRecords(page))[0].followers).toEqual(first.followers);
});

test("a changed selected snapshot invalidates the previous result and same-account confirmation", async ({
  page,
}) => {
  await populated(page, [first, second]);
  await page
    .getByLabel("Older snapshot", { exact: true })
    .selectOption("first");
  await page
    .getByLabel("Newer snapshot", { exact: true })
    .selectOption("second");
  const confirmation = page.getByRole("checkbox", {
    name: "These exports are from the same Instagram account.",
  });
  const compare = page.getByRole("button", {
    name: "Compare saved snapshots",
    exact: true,
  });
  await confirmation.check();
  await compare.click();
  await expect(
    page.getByRole("region", { name: "Snapshot comparison results" }),
  ).toBeVisible();
  await seedRecords(page, [
    { ...second, createdAt: 500, followers: ["changed.account"] },
  ]);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(compare).toBeDisabled();
  await expect(confirmation).not.toBeChecked();
  await expect(
    page.getByRole("region", { name: "Snapshot comparison results" }),
  ).toHaveCount(0);
});
