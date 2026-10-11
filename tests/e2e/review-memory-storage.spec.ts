import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  memoryRecord,
  readReviewMemory,
  seedReviewMemory,
} from "../helpers/review-memory";
import { savedRecords, seedRecords, upload } from "../helpers/vault";

const history = [
  {
    id: "memory-preserved-vault",
    version: 1,
    exportDate: "2026-01-01",
    createdAt: 1,
    followers: ["alice"],
    following: ["alice"],
  },
];
const local = memoryRecord("alice", {
  keep: true,
  watch: true,
  note: "  Private synthetic reminder.  ",
});
const manager = (page: Page) =>
  page.getByRole("region", { name: "Private Review Memory", exact: true });
const backupFile = (records: ReturnType<typeof memoryRecord>[]) => ({
  name: "review-memory.json",
  mimeType: "application/json",
  buffer: Buffer.from(
    JSON.stringify({ format: "instascope-review-memory", version: 1, records }),
  ),
});
async function confirmImport(page: Page) {
  await manager(page)
    .getByRole("button", { name: "Import Review Memory", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm Review Memory import" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function clearMemory(page: Page) {
  await manager(page)
    .getByRole("button", { name: "Clear all Review Memory", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const clear = dialog.getByRole("button", {
    name: "Delete all Review Memory",
  });
  await expect(clear).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await clear.click();
  await expect(dialog).toHaveCount(0);
}
async function vaultMetadata(page: Page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("instascope:snapshot-vault", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("metadata", "readonly"),
            read = tx.objectStore("metadata").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve({
              version: db.version,
              stores: [...db.objectStoreNames],
              records: read.result,
            });
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}

test("new Review Memory domain preserves Vault V1, private backup round-trips and newer conflicts keep local notes", async ({
  page,
}, testInfo) => {
  await page.goto("/snapshot-vault/");
  await seedRecords(page, history);
  const before = await vaultMetadata(page);
  await seedReviewMemory(page, [local]);
  await page.reload();
  await expect(manager(page)).toContainText("1 readable account record");
  const downloadPromise = page.waitForEvent("download");
  await manager(page)
    .getByRole("button", { name: "Export Review Memory backup" })
    .click();
  const download = await downloadPromise;
  await download.saveAs(
    testInfo.outputPath("synthetic-review-memory-backup.json"),
  );
  const backup = JSON.parse(
    await readFile(
      testInfo.outputPath("synthetic-review-memory-backup.json"),
      "utf8",
    ),
  );
  expect(backup).toEqual({
    format: "instascope-review-memory",
    version: 1,
    records: [local],
  });
  await clearMemory(page);
  expect(await readReviewMemory(page)).toEqual([]);
  expect(await savedRecords(page)).toEqual(history);
  await manager(page)
    .getByLabel("Import Review Memory backup", { exact: true })
    .setInputFiles(backupFile(backup.records));
  await expect(
    page.getByRole("region", { name: "Review Memory import preview" }),
  ).toContainText("Nothing has been imported yet");
  expect(await readReviewMemory(page)).toEqual([]);
  await confirmImport(page);
  expect(await readReviewMemory(page)).toEqual([local]);
  const conflict = {
    ...local,
    note: "Newer backup must not erase local note",
    updatedAt: "2027-01-01T12:00:00.000Z",
  };
  const added = memoryRecord("bob", {
    reviewed: true,
    note: "Second private synthetic note",
  });
  await manager(page)
    .getByLabel("Import Review Memory backup", { exact: true })
    .setInputFiles(backupFile([conflict, added]));
  await expect(
    page.getByRole("region", { name: "Review Memory import preview" }),
  ).toContainText("1 match readable local records");
  await confirmImport(page);
  await expect(manager(page)).toContainText(
    "1 Review Memory records imported locally · 1 existing local records kept",
  );
  expect(await readReviewMemory(page)).toEqual([local, added]);
  expect(await savedRecords(page)).toEqual(history);
  expect(await vaultMetadata(page)).toEqual(before);
  await page.reload();
  expect(await readReviewMemory(page)).toEqual([local, added]);
});

test("active export clear, future import and snapshot deletion keep review memory; global clear keeps active data", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await seedReviewMemory(page, [local]);
  await seedRecords(page, history);
  await page.reload();
  await upload(page);
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  expect(await readReviewMemory(page)).toEqual([local]);
  await upload(page);
  await page
    .getByRole("region", { name: "Snapshot Vault", exact: true })
    .getByRole("link", { name: "Open Vault", exact: true })
    .click();
  await page
    .locator(".vault-row")
    .getByRole("button", { name: "Delete 1 Jan 2026", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete snapshot", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await savedRecords(page)).toEqual([]);
  expect(await readReviewMemory(page)).toEqual([local]);
  await clearMemory(page);
  expect(await readReviewMemory(page)).toEqual([]);
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await expect(
    page
      .locator(".dashboard-metrics")
      .getByText("Followers", { exact: true })
      .locator("..")
      .locator("dd"),
  ).toHaveText(/^3\s*Accounts that follow you$/);
});

test("invalid or Vault-format Review Memory backups never write records and existing Vault V1 import still works", async ({
  page,
}) => {
  await page.goto("/snapshot-vault/");
  await seedReviewMemory(page, [local]);
  await page.reload();
  const vaultBackup = {
    format: "instascope-snapshot-vault",
    version: 1,
    snapshots: history,
  };
  const wrong = {
    name: "vault-v1.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(vaultBackup)),
  };
  await manager(page)
    .getByLabel("Import Review Memory backup", { exact: true })
    .setInputFiles(wrong);
  await expect(manager(page).getByRole("alert")).toBeVisible();
  expect(await readReviewMemory(page)).toEqual([local]);
  await manager(page)
    .getByLabel("Import Review Memory backup", { exact: true })
    .setInputFiles({
      ...wrong,
      name: "malformed.json",
      buffer: Buffer.from('{"version":'),
    });
  await expect(manager(page).getByRole("alert")).toBeVisible();
  expect(await readReviewMemory(page)).toEqual([local]);
  await page
    .getByLabel("Import Vault backup", { exact: true })
    .setInputFiles(wrong);
  await expect(
    page.getByLabel("Backup import preview", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import snapshots", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await savedRecords(page)).toEqual(history);
  expect(await readReviewMemory(page)).toEqual([local]);
});

test("corrupt memory is disclosed, not exported or overwritten; explicit account repair retains good records", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  const corrupt = {
    ...memoryRecord("bob"),
    keep: "not-a-boolean",
    note: "Unusable synthetic record",
  };
  await seedReviewMemory(page, [local, corrupt]);
  await page.reload();
  await upload(page);
  await page
    .getByRole("region", { name: "Snapshot Vault", exact: true })
    .getByRole("link", { name: "Open Vault", exact: true })
    .click();
  await expect(manager(page)).toContainText(
    "1 unreadable Review Memory record was skipped",
  );
  await expect(
    manager(page).getByRole("button", { name: "Export Review Memory backup" }),
  ).toBeDisabled();
  await manager(page)
    .getByLabel("Import Review Memory backup", { exact: true })
    .setInputFiles(
      backupFile([
        memoryRecord("bob", { note: "Do not overwrite corrupt local data" }),
      ]),
    );
  await confirmImport(page);
  expect(await readReviewMemory(page)).toEqual([local, corrupt]);
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await page.getByRole("link", { name: "Followers Analyzer" }).last().click();
  await page
    .locator(".accounts")
    .getByRole("button", {
      name: "Inspect relationship with @bob",
      exact: true,
    })
    .click();
  const memory = page
    .getByRole("dialog")
    .getByRole("region", { name: "Review memory", exact: true });
  await memory
    .getByRole("button", { name: "Clear account memory", exact: true })
    .click();
  await memory
    .getByRole("button", { name: "Clear this account’s memory", exact: true })
    .click();
  await expect(memory).not.toContainText("unreadable");
  expect(await readReviewMemory(page)).toEqual([local]);
});

test("quota write abort leaves flags/notes unchanged and reports actionable safe error", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await seedReviewMemory(page, [local]);
  await page.reload();
  await upload(page);
  await page
    .locator(".accounts")
    .getByRole("button", {
      name: "Inspect relationship with @alice",
      exact: true,
    })
    .click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.transaction.db.name === "instascope:review-memory")
        throw new DOMException("Synthetic quota limit", "QuotaExceededError");
      return original.apply(this, args as Parameters<typeof original>);
    };
  });
  const memory = page
    .getByRole("dialog")
    .getByRole("region", { name: "Review memory", exact: true });
  await memory.getByRole("button", { name: "Reviewed", exact: true }).click();
  await expect(memory.getByRole("alert")).toContainText(
    "Browser storage is full",
  );
  await expect(
    memory.getByRole("button", { name: "Reviewed", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(await readReviewMemory(page)).toEqual([local]);
});

test("quota failure during multi-record import rolls back every addition and preserves local notes and Vault", async ({
  page,
}) => {
  await page.goto("/snapshot-vault/");
  await seedReviewMemory(page, [local]);
  await seedRecords(page, history);
  await page.reload();
  const before = await vaultMetadata(page);
  await manager(page)
    .getByLabel("Import Review Memory backup", { exact: true })
    .setInputFiles(
      backupFile([
        memoryRecord("bob", { reviewed: true }),
        memoryRecord("charlie", { watch: true }),
      ]),
    );
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (
        this.transaction.db.name === "instascope:review-memory" &&
        (args[0] as { username?: string }).username === "charlie"
      )
        throw new DOMException("Synthetic quota limit", "QuotaExceededError");
      return original.apply(this, args as Parameters<typeof original>);
    };
  });
  await manager(page)
    .getByRole("button", { name: "Import Review Memory", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Confirm Review Memory import" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Browser storage is full",
  );
  expect(await readReviewMemory(page)).toEqual([local]);
  expect(await savedRecords(page)).toEqual(history);
  expect(await vaultMetadata(page)).toEqual(before);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  expect(await readReviewMemory(page)).toEqual([local]);
  expect(await savedRecords(page)).toEqual(history);
});

test("unavailable local storage degrades real memory safely while fictional memory stays usable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", { get: () => undefined }),
  );
  await page.goto("/snapshot-vault/");
  await expect(manager(page).getByRole("alert")).toContainText(
    "Browser storage is unavailable",
  );
  await expect(manager(page)).not.toContainText("0 readable account records");
  await expect(
    manager(page).getByRole("button", { name: "Clear all Review Memory" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const watch = page.getByRole("region", { name: "Watch Circle", exact: true });
  await expect(watch).toContainText("3 watched accounts");
  await expect(watch).toContainText("2 observed state changes");
  await watch.getByText("Review watched accounts", { exact: true }).click();
  await watch
    .getByRole("button", { name: "@demo.mutual.0100", exact: true })
    .click();
  const memory = page
    .getByRole("dialog")
    .getByRole("region", { name: "Review memory", exact: true });
  await memory.getByRole("button", { name: "Reviewed", exact: true }).click();
  await expect(
    memory.getByRole("button", { name: "Reviewed", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(memory).toContainText("Demo data · Fictional review memory");
});
