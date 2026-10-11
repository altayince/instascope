import type { Page } from "@playwright/test";
import type { ReviewMemoryRecord } from "../../src/lib/review-memory";

export function memoryRecord(
  username: string,
  flags: Partial<ReviewMemoryRecord> = {},
): ReviewMemoryRecord {
  return {
    username,
    keep: false,
    reviewed: false,
    watch: false,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    ...flags,
  };
}
export async function seedReviewMemory(page: Page, records: unknown[]) {
  await page.evaluate(
    (values) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("instascope:review-memory", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("records", { keyPath: "username" });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("records", "readwrite");
          for (const value of values) tx.objectStore("records").put(value);
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
    records,
  );
}
export async function readReviewMemory(
  page: Page,
): Promise<ReviewMemoryRecord[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("instascope:review-memory", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("records", { keyPath: "username" });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("records", "readonly"),
            read = tx.objectStore("records").getAll();
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
