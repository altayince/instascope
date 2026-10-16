import { expect, test, type Page } from "@playwright/test";
import { MAX_CHAT_VAULT_BACKUP_BYTES } from "../../src/lib/whatsapp/chat-vault";
import {
  savedRecords as instagramRecords,
  seedRecords as seedInstagramRecords,
} from "../helpers/vault";

const enabled = process.env.EXPECT_WHATSAPP === "true";
const database = "instascope:whatsapp-chat-vault";
const store = "snapshots";
const firstLabel = "SYNTHETIC_PRIVATE_PARTICIPANT_A";
const secondLabel = "SYNTHETIC_PRIVATE_PARTICIPANT_B";
const forbidden =
  /SYNTHETIC_PRIVATE|synthetic-private\.invalid|private-photo\.jpg|491234567890|participant-\d|chat-source\.txt/;
const syntheticChat = [
  "01/01/2024, 09:00 - Messages are encrypted.",
  `01/01/2024, 09:01 - ${firstLabel}: SYNTHETIC_PRIVATE_MESSAGE`,
  `02/01/2024, 10:00 - ${secondLabel}: https://synthetic-private.invalid/private-photo.jpg`,
  `03/01/2024, 11:00 - ${firstLabel}: <Media omitted>`,
  `01/01/2025, 12:00 - ${firstLabel}: [Anruf]`,
  `01/01/2025, 12:01 - ${secondLabel}: A fictional reply 😀`,
  `02/01/2025, 13:00 - ${firstLabel}: SYNTHETIC_PRIVATE_FINAL +491234567890`,
].join("\n");

type Backup = {
  format: string;
  version: number;
  snapshots: Record<string, unknown>[];
};

const rows = (page: Page) =>
  page.getByRole("article", { name: "Saved chat snapshot", exact: true });
const input = (page: Page) =>
  page.getByLabel("Import Chat Vault backup", { exact: true });
const saveButton = (page: Page) =>
  page.getByRole("button", { name: "Save to Chat Vault", exact: true });
const importDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Import Chat Vault backup?", exact: true });
const file = (raw: string | Backup) => ({
  name: "whatsapp-chat-vault-v1.json",
  mimeType: "application/json",
  buffer: Buffer.from(typeof raw === "string" ? raw : JSON.stringify(raw)),
});

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

async function acceptChat(page: Page) {
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles({
      name: "chat-source.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(syntheticChat),
    });
  await page
    .getByLabel("Export date/time format", { exact: true })
    .selectOption("dmy-24h");
  await page
    .getByRole("button", { name: "Confirm format and open chat" })
    .click();
  await expect(saveButton(page)).toBeEnabled();
}

async function saveCurrent(page: Page) {
  const count = (await records(page)).length;
  await saveButton(page).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to Chat Vault" }),
  ).toBeVisible();
  await expect.poll(async () => (await records(page)).length).toBe(count + 1);
}

async function openVault(page: Page) {
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Chat Vault", exact: true })
    .click();
  await expect(page).toHaveURL(/\/whatsapp\/chat-vault\/$/);
  await expect(
    page.getByRole("heading", { name: "Chat Vault", exact: true }),
  ).toBeVisible();
}

async function records(page: Page): Promise<Record<string, unknown>[]> {
  const values = await page.evaluate<
    Record<string, unknown>[],
    { database: string; store: string }
  >(
    ({ database, store }) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore(store, { keyPath: "id" });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            transaction = db.transaction(store, "readonly"),
            read = transaction.objectStore(store).getAll();
          transaction.oncomplete = () => {
            db.close();
            resolve(read.result);
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
    { database, store },
  );
  return values.sort(
    (left, right) =>
      Number(right.createdAt) - Number(left.createdAt) ||
      String(left.id).localeCompare(String(right.id)),
  );
}

// Native IndexedDB is used only to prepare corruption/rollback fault scenarios.
async function replaceRecords(page: Page, values: unknown[]) {
  await page.evaluate(
    ({ database, store, values }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            transaction = db.transaction(store, "readwrite"),
            target = transaction.objectStore(store);
          target.clear();
          for (const value of values) target.put(value);
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
    { database, store, values },
  );
}

async function downloadBackup(page: Page): Promise<Backup> {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Chat Vault backup", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("whatsapp-chat-vault-v1.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  expect(raw).not.toMatch(forbidden);
  return JSON.parse(raw) as Backup;
}

async function savedChat(page: Page) {
  await page.goto("/whatsapp/chat-analyzer/");
  await acceptChat(page);
  await saveCurrent(page);
  await openVault(page);
  await expect(rows(page)).toHaveCount(1);
}

test("production release does not expose Chat Vault", async ({ request }) => {
  test.skip(enabled, "The explicit dev build is tested separately.");
  expect((await request.get("/whatsapp/chat-vault/")).status()).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "whatsapp",
  );
});

test.describe("WhatsAppScope aggregate-only Chat Vault", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");

  test("only an explicit save persists full-source aggregates, independently of Analyzer filters and reload", async ({
    page,
  }) => {
    const outgoing: string[] = [];
    const allRequests: string[] = [];
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      allRequests.push(`${request.url()} ${request.postData() ?? ""}`);
      const url = new URL(request.url());
      if (url.origin !== "http://127.0.0.1:3000" && url.protocol !== "blob:")
        externalRequests.push(request.url());
      if (!["GET", "HEAD"].includes(request.method()))
        outgoing.push(`${request.url()} ${request.postData() ?? ""}`);
    });
    await page.goto("/whatsapp/chat-vault/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await expect(
      page.getByText("No saved chat snapshots yet", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Chat Analyzer", exact: true })
      .click();
    await acceptChat(page);
    expect(await records(page)).toEqual([]);
    const filters = page.getByRole("region", { name: "Analysis filters" });
    await filters
      .getByRole("combobox", { name: "Date filter", exact: true })
      .selectOption("year");
    await filters
      .getByRole("combobox", { name: "Year", exact: true })
      .selectOption("2025");
    await filters
      .getByRole("combobox", { name: "Participant", exact: true })
      .selectOption({ label: firstLabel });
    await expect(
      page
        .getByRole("region", { name: "Filtered chat overview" })
        .locator(".wa-stat")
        .filter({ has: page.getByText("Exported messages", { exact: true }) })
        .locator("strong"),
    ).toHaveText("2");
    expect(await records(page)).toEqual([]);
    await saveCurrent(page);
    const stored = await records(page);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      version: 1,
      definitionsVersion: 1,
      scope: "full-export",
      coverage: { fromDate: "2024-01-01", toDate: "2025-01-02" },
      totals: {
        messages: 6,
        participants: 2,
        systemEvents: 1,
        links: 1,
        mediaMessages: 1,
      },
    });
    expect(JSON.stringify(stored)).not.toMatch(forbidden);
    await openVault(page);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(/6 messages/);
    await expect(rows(page).first()).toContainText(/2024|2025/);
    await expect(page.locator("main")).toContainText(/aggregate analysis/i);
    await expect(page.locator("main")).toContainText(
      /message text is not stored/i,
    );
    await expect(page.locator("main")).toContainText(
      /participant identity is not stored/i,
    );
    await expect(page.locator("main")).toContainText(
      /clearing.*(?:browser|site).*data/i,
    );
    await fits(page);
    await page.screenshot({
      path: test.info().outputPath("chat-vault.png"),
      fullPage: true,
    });
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Chat Analyzer", exact: true })
      .click();
    await page.getByRole("button", { name: "Clear chat", exact: true }).click();
    await openVault(page);
    expect(await records(page)).toEqual(stored);
    await page.reload();
    await expect(rows(page)).toHaveCount(1);
    await expect(saveButton(page)).toHaveCount(0);
    expect(await records(page)).toEqual(stored);
    expect(outgoing.join("\n")).not.toMatch(forbidden);
    expect(allRequests.join("\n")).not.toMatch(forbidden);
    expect(externalRequests).toEqual([]);
    expect(outgoing).toEqual([]);
    await fits(page);
  });

  test("fictional demo stays ephemeral and cannot be saved to Chat Vault", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await page.getByRole("button", { name: "Try the fictional demo" }).click();
    await expect(saveButton(page)).toBeDisabled();
    await openVault(page);
    await expect(saveButton(page)).toBeDisabled();
    await expect(page.locator("main")).toContainText(
      /demo.*not.*saved|fictional.*not.*saved/i,
    );
    expect(await records(page)).toEqual([]);
    await expect(
      page.getByText("No saved chat snapshots yet", { exact: true }),
    ).toBeVisible();
    await fits(page);
  });

  test("delete confirmation supports cancellation and Escape, and never clears the loaded chat", async ({
    page,
  }) => {
    await savedChat(page);
    const before = await records(page);
    const remove = rows(page).getByRole("button", {
      name: "Delete snapshot",
      exact: true,
    });
    await remove.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(remove).toBeFocused();
    expect(await records(page)).toEqual(before);
    await remove.click();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await records(page)).toEqual(before);
    await remove.click();
    await dialog
      .getByRole("button", { name: "Delete snapshot", exact: true })
      .click();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByRole("main")).toBeFocused();
    expect(await records(page)).toEqual([]);
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Chat Analyzer", exact: true })
      .click();
    await expect(page.locator(".wa-current-chat")).toContainText("6 messages");
  });

  test("local backup import previews without mutation, merges only after confirmation, and skips existing IDs", async ({
    page,
  }) => {
    await savedChat(page);
    const first = await downloadBackup(page);
    expect(first.format).toBe("whatsapp-chat-vault");
    expect(first.version).toBe(1);
    expect(first.snapshots).toEqual(await records(page));
    await saveCurrent(page);
    await expect(rows(page)).toHaveCount(2);
    const complete = await records(page);
    const onlyNew = complete.find(
      (record) => record.id !== first.snapshots[0].id,
    )!;
    await replaceRecords(page, [onlyNew]);
    await page.reload();
    await expect(rows(page)).toHaveCount(1);
    await input(page).setInputFiles(file(first));
    await expect(importDialog(page)).toBeVisible();
    await expect(importDialog(page)).toContainText(/1 new/);
    expect(await records(page)).toEqual([onlyNew]);
    await importDialog(page)
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    expect(await records(page)).toEqual([onlyNew]);
    await input(page).setInputFiles(file(first));
    await importDialog(page)
      .getByRole("button", { name: "Confirm import", exact: true })
      .click();
    await expect(importDialog(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(2);
    expect(await records(page)).toEqual(complete);
    const duplicateWithDifferentSaveTime = {
      ...first,
      snapshots: first.snapshots.map((snapshot) => ({
        ...snapshot,
        createdAt: Number(snapshot.createdAt) + 1000,
      })),
    };
    await input(page).setInputFiles(file(duplicateWithDifferentSaveTime));
    await expect(importDialog(page)).toContainText(/0 new/);
    await expect(importDialog(page)).toContainText(/1.*(?:existing|skipped)/);
    await importDialog(page)
      .getByRole("button", { name: "Confirm import", exact: true })
      .click();
    await expect(importDialog(page)).toHaveCount(0);
    expect(await records(page)).toEqual(complete);
    await fits(page);
  });

  test("malformed, wrong-version and unsafe backup fields never alter saved records", async ({
    page,
  }) => {
    await savedChat(page);
    const backup = await downloadBackup(page);
    const before = await records(page);
    const variants: (string | Backup)[] = [
      "{broken JSON",
      { ...backup, version: 999 },
      {
        ...backup,
        snapshots: [{ ...backup.snapshots[0], messages: [syntheticChat] }],
      },
      {
        ...backup,
        snapshots: [{ ...backup.snapshots[0], participants: [firstLabel] }],
      },
      JSON.stringify({ ...backup, rawExport: syntheticChat }),
      JSON.stringify({
        ...backup,
        snapshots: [backup.snapshots[0], { version: 999 }],
      }),
      " ".repeat(MAX_CHAT_VAULT_BACKUP_BYTES + 1),
    ];
    for (const invalid of variants) {
      await input(page).setInputFiles(file(invalid));
      await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(input(page)).toHaveValue("");
      await expect(importDialog(page)).toHaveCount(0);
      expect(await records(page)).toEqual(before);
    }
  });

  test("backup checking announces work and invalid input can recover to an explicit restore", async ({
    page,
  }) => {
    await savedChat(page);
    const backup = await downloadBackup(page);
    await replaceRecords(page, []);
    await page.reload();
    await expect(rows(page)).toHaveCount(0);
    await expect(input(page)).toBeEnabled();
    await page.evaluate(() => {
      const text = File.prototype.text;
      File.prototype.text = function () {
        return new Promise<string>((resolve, reject) => {
          Object.assign(window, {
            releaseChatVaultRead: () => {
              File.prototype.text = text;
              text.call(this).then(resolve, reject);
            },
          });
        });
      };
    });
    await input(page).setInputFiles(file("{broken JSON"));
    const checking = page.getByRole("status").filter({
      hasText: "Checking the local backup. Nothing is imported yet.",
    });
    await expect(checking).toBeVisible();
    await expect(input(page)).toBeDisabled();
    await expect(importDialog(page)).toHaveCount(0);
    expect(await records(page)).toEqual([]);
    await page.evaluate(() =>
      (
        window as unknown as { releaseChatVaultRead: () => void }
      ).releaseChatVaultRead(),
    );
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(checking).toHaveCount(0);
    await expect(input(page)).toBeEnabled();
    await expect(input(page)).toHaveValue("");
    expect(await records(page)).toEqual([]);
    await input(page).setInputFiles(file(backup));
    await expect(importDialog(page)).toContainText(/1 new/);
    expect(await records(page)).toEqual([]);
    await importDialog(page)
      .getByRole("button", { name: "Confirm import", exact: true })
      .click();
    await expect(importDialog(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);
    expect(await records(page)).toEqual(backup.snapshots);
    await fits(page);
  });

  test("an aborted multi-record import preserves every existing snapshot atomically", async ({
    page,
  }) => {
    await savedChat(page);
    const before = await records(page);
    await saveCurrent(page);
    await saveCurrent(page);
    await expect(rows(page)).toHaveCount(3);
    const backup = await downloadBackup(page);
    await replaceRecords(page, before);
    await page.reload();
    await input(page).setInputFiles(file(backup));
    await expect(importDialog(page)).toContainText(/2 new/);
    await page.evaluate(() => {
      const add = IDBObjectStore.prototype.add;
      Object.assign(window, { originalChatVaultAdd: add });
      let writes = 0;
      IDBObjectStore.prototype.add = function (...args) {
        const request = add.apply(this, args);
        if (this.name === "snapshots" && ++writes === 2)
          this.transaction.abort();
        return request;
      };
    });
    await importDialog(page)
      .getByRole("button", { name: "Confirm import", exact: true })
      .click();
    await expect(importDialog(page).getByRole("alert")).toContainText(
      /storage is unavailable/i,
    );
    expect(await records(page)).toEqual(before);
    await page.evaluate(() => {
      IDBObjectStore.prototype.add = (
        window as unknown as {
          originalChatVaultAdd: typeof IDBObjectStore.prototype.add;
        }
      ).originalChatVaultAdd;
    });
    await importDialog(page)
      .getByRole("button", { name: "Confirm import", exact: true })
      .click();
    await expect(importDialog(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(3);
    expect(await records(page)).toEqual(backup.snapshots);
  });

  test("unavailable browser storage does not prevent chat analysis", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const factory = window.indexedDB;
      Object.assign(window, { chatVaultStorageDenied: true });
      Object.defineProperty(window, "indexedDB", {
        get() {
          if (
            (window as unknown as { chatVaultStorageDenied: boolean })
              .chatVaultStorageDenied
          )
            throw new DOMException(
              "Synthetic blocked storage",
              "SecurityError",
            );
          return factory;
        },
      });
    });
    await page.goto("/whatsapp/chat-analyzer/");
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles({
        name: "chat.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(syntheticChat),
      });
    await page
      .getByLabel("Export date/time format", { exact: true })
      .selectOption("dmy-24h");
    await page
      .getByRole("button", { name: "Confirm format and open chat" })
      .click();
    await expect(page.locator(".wa-current-chat")).toContainText("6 messages");
    await saveButton(page).click();
    await expect(
      page
        .getByRole("region", { name: "Save chat snapshot" })
        .getByRole("alert"),
    ).toContainText(/storage is unavailable/i);
    await openVault(page);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      /storage is unavailable/i,
    );
    await expect(input(page)).toBeDisabled();
    await page.evaluate(() => {
      Object.assign(window, { chatVaultStorageDenied: false });
    });
    await page.getByRole("button", { name: "Retry local storage" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(input(page)).toBeEnabled();
    expect(await records(page)).toEqual([]);
    await saveCurrent(page);
    await expect(rows(page)).toHaveCount(1);
    expect(await records(page)).toHaveLength(1);
    await fits(page);
  });

  test("corrupted records remain untouched, block incomplete backups, and do not affect Instagram storage", async ({
    page,
  }) => {
    await savedChat(page);
    const valid = await records(page);
    const instagram = {
      id: "synthetic-instagram-vault",
      version: 1,
      exportDate: "2026-01-01",
      createdAt: 1,
      followers: ["synthetic.follower"],
      following: ["synthetic.following"],
    };
    await seedInstagramRecords(page, [instagram]);
    const corrupt = { id: "corrupted-chat-snapshot", version: 999 };
    await replaceRecords(page, [...valid, corrupt]);
    await page.reload();
    await expect(rows(page)).toHaveCount(1);
    await expect(
      page.getByRole("status").filter({ hasText: "1 unreadable" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Export Chat Vault backup",
        exact: true,
      }),
    ).toBeDisabled();
    expect(await records(page)).toHaveLength(2);
    expect(await instagramRecords(page)).toEqual([instagram]);
    await page
      .getByRole("button", { name: "Remove unreadable entries", exact: true })
      .click();
    const recovery = page.getByRole("dialog", {
      name: "Remove unreadable entries?",
    });
    await recovery.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await records(page)).toHaveLength(2);
    await page
      .getByRole("button", { name: "Remove unreadable entries", exact: true })
      .click();
    await recovery
      .getByRole("button", { name: "Remove entries", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "1 unreadable" }),
    ).toHaveCount(0);
    expect(await records(page)).toEqual(valid);
    expect((await downloadBackup(page)).snapshots).toEqual(valid);
    expect(await instagramRecords(page)).toEqual([instagram]);
    await fits(page);
  });
});
