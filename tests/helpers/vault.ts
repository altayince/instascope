import type { Page } from "@playwright/test";
import type { VaultSnapshot } from "../../src/lib/snapshot-vault";

export const original = [
  "tests/fixtures/followers_1.json",
  "tests/fixtures/following.json",
];
export const newer = [
  {
    name: "followers.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        { string_list_data: [{ value: "alice" }] },
        { string_list_data: [{ value: "new.follower" }] },
      ]),
    ),
  },
  {
    name: "following.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        relationships_following: [
          { title: "alice", string_list_data: [{ value: "alice" }] },
          { title: "new.follow", string_list_data: [{ value: "new.follow" }] },
        ],
      }),
    ),
  },
];
export async function upload(
  page: Page,
  files = original as typeof original | typeof newer,
  label = "Upload Instagram export",
) {
  await page
    .getByLabel(label, { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
}
export async function savedRecords(page: Page): Promise<VaultSnapshot[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("instascope:snapshot-vault", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("snapshots", "readonly"),
            read = tx.objectStore("snapshots").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(read.result);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}
export async function seedRecords(page: Page, snapshots: unknown[]) {
  await page.evaluate(
    (records) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("instascope:snapshot-vault", 1);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("snapshots", {
            keyPath: "id",
          });
          store.createIndex("exportDate", "exportDate", { unique: true });
          request.result.createObjectStore("metadata", { keyPath: "key" });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(["snapshots", "metadata"], "readwrite");
          for (const record of records) tx.objectStore("snapshots").put(record);
          tx.objectStore("metadata").put({
            key: "legacy-v1-migrated",
            complete: true,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    snapshots,
  );
}
export async function save(page: Page, date: string) {
  const saver = page.getByRole("region", { name: "Save a local snapshot" });
  await saver.getByLabel("Date this export represents").fill(date);
  await saver
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
}
