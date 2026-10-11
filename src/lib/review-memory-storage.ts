import {
  MAX_REVIEW_MEMORY_RECORDS,
  updateReviewMemoryRecord,
  validateReviewMemoryBackup,
  validateReviewMemoryRecord,
  type ReviewMemoryBackup,
  type ReviewMemoryPatch,
  type ReviewMemoryRecord,
} from "./review-memory";

// A separate database keeps Review Memory independent of Vault V1 schemas,
// legacy snapshot migration, snapshot deletion and active-export state.
export const REVIEW_MEMORY_DATABASE = "instascope:review-memory";
export const REVIEW_MEMORY_STORE = "records";

export class ReviewMemoryStorageError extends Error {}

export function reviewMemoryStorageMessage(error: unknown): string {
  if (error instanceof ReviewMemoryStorageError) return error.message;
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "Browser storage is full. Review Memory was not changed. Free site storage or clear unwanted Review Memory, then try again.";
  return "Browser storage is unavailable. Review Memory could not be loaded or saved. You can still analyze this export. Check browser/site storage settings and try again.";
}

type TransactionScope<T> = {
  transaction: IDBTransaction;
  result: (value: T) => void;
  read: <V>(request: IDBRequest<V>, success: (value: V) => void) => void;
};

function storedRecord(value: unknown, key: IDBValidKey): ReviewMemoryRecord {
  try {
    const record = validateReviewMemoryRecord(value);
    if (record.username !== key) throw new Error("Mismatched stored identity");
    return record;
  } catch {
    throw new ReviewMemoryStorageError(
      "Some Review Memory cannot be read. It was not overwritten. Clear the affected record or all Review Memory explicitly before trying again.",
    );
  }
}

export class ReviewMemoryStorage {
  constructor(
    private factory: () => IDBFactory | undefined = () => globalThis.indexedDB,
    private now: () => string = () => new Date().toISOString(),
  ) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let abandoned = false;
      const fail = (error: unknown) => {
        abandoned = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(
        () =>
          fail(
            new ReviewMemoryStorageError(
              "Browser storage did not respond. Close other InstaScope tabs and try again.",
            ),
          ),
        10000,
      );
      try {
        const factory = this.factory();
        if (!factory)
          throw new ReviewMemoryStorageError(reviewMemoryStorageMessage(null));
        const request = factory.open(REVIEW_MEMORY_DATABASE, 1);
        request.onblocked = () =>
          fail(
            new ReviewMemoryStorageError(
              "Review Memory storage is blocked by another tab. Close other InstaScope tabs and reload.",
            ),
          );
        request.onerror = () => fail(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(REVIEW_MEMORY_STORE))
            db.createObjectStore(REVIEW_MEMORY_STORE, { keyPath: "username" });
        };
        request.onsuccess = () => {
          clearTimeout(timer);
          const db = request.result;
          db.onversionchange = () => db.close();
          if (abandoned) db.close();
          else resolve(db);
        };
      } catch (error) {
        fail(error);
      }
    });
  }

  private async run<T>(
    mode: IDBTransactionMode,
    action: (scope: TransactionScope<T>) => void,
  ): Promise<T> {
    let db: IDBDatabase | undefined;
    try {
      db = await this.open();
      return await new Promise<T>((resolve, reject) => {
        const transaction = db!.transaction([REVIEW_MEMORY_STORE], mode);
        let value: T;
        let failure: unknown;
        const fail = (error: unknown) => {
          failure = error;
          transaction.abort();
        };
        const timer = setTimeout(
          () =>
            fail(
              new ReviewMemoryStorageError(
                "Browser storage did not respond. Review Memory was not changed. Try again.",
              ),
            ),
          15000,
        );
        transaction.oncomplete = () => {
          clearTimeout(timer);
          resolve(value);
        };
        transaction.onabort = () => {
          clearTimeout(timer);
          reject(failure ?? transaction.error);
        };
        transaction.onerror = (event) => {
          failure ??= (event.target as IDBRequest).error ?? transaction.error;
        };
        try {
          action({
            transaction,
            result: (result) => {
              value = result;
            },
            read: (request, success) => {
              request.onsuccess = () => {
                try {
                  success(request.result);
                } catch (error) {
                  fail(error);
                }
              };
            },
          });
        } catch (error) {
          fail(error);
        }
      });
    } catch (error) {
      throw new ReviewMemoryStorageError(reviewMemoryStorageMessage(error));
    } finally {
      db?.close();
    }
  }

  list(): Promise<{ records: ReviewMemoryRecord[]; corrupt: number }> {
    return this.run("readonly", ({ transaction, read, result }) => {
      const records: ReviewMemoryRecord[] = [];
      let corrupt = 0;
      read(
        transaction.objectStore(REVIEW_MEMORY_STORE).openCursor(),
        (cursor) => {
          if (!cursor) {
            result({ records, corrupt });
            return;
          }
          try {
            records.push(storedRecord(cursor.value, cursor.primaryKey));
          } catch {
            corrupt++;
          }
          cursor.continue();
        },
      );
    });
  }

  update(
    username: string,
    patch: ReviewMemoryPatch,
  ): Promise<ReviewMemoryRecord> {
    // Reject invalid input before opening a storage transaction.
    const candidate = updateReviewMemoryRecord(
      null,
      username,
      patch,
      this.now(),
    );
    return this.run("readwrite", ({ transaction, read, result }) => {
      const store = transaction.objectStore(REVIEW_MEMORY_STORE);
      read(store.get(candidate.username), (value) => {
        const previous =
          value === undefined ? null : storedRecord(value, candidate.username);
        const next = updateReviewMemoryRecord(
          previous,
          candidate.username,
          patch,
          candidate.updatedAt,
        );
        store.put(next);
        result(next);
      });
    });
  }

  delete(username?: string): Promise<void> {
    // Only an omitted argument clears all. An invalid/empty username must not.
    const identity =
      username === undefined
        ? undefined
        : updateReviewMemoryRecord(null, username, {}, this.now()).username;
    return this.run("readwrite", ({ transaction, result }) => {
      const store = transaction.objectStore(REVIEW_MEMORY_STORE);
      if (identity === undefined) store.clear();
      else store.delete(identity);
      result(undefined);
    });
  }

  backup(): Promise<ReviewMemoryRecord[]> {
    return this.run("readonly", ({ transaction, read, result }) => {
      const records: ReviewMemoryRecord[] = [];
      read(
        transaction.objectStore(REVIEW_MEMORY_STORE).openCursor(),
        (cursor) => {
          if (!cursor) {
            // Never quietly drop unreadable notes from a durable-data backup.
            try {
              result(
                validateReviewMemoryBackup({
                  format: "instascope-review-memory",
                  version: 1,
                  records,
                }).records,
              );
            } catch {
              throw new ReviewMemoryStorageError(
                "Review Memory exceeds the V1 backup limits. Your saved records were not changed.",
              );
            }
            return;
          }
          if (records.length >= MAX_REVIEW_MEMORY_RECORDS)
            throw new ReviewMemoryStorageError(
              "Review Memory is too large for a single V1 backup. Your saved records were not changed.",
            );
          records.push(storedRecord(cursor.value, cursor.primaryKey));
          cursor.continue();
        },
      );
    });
  }

  merge(
    value: ReviewMemoryBackup,
  ): Promise<{ added: number; skipped: number }> {
    const backup = validateReviewMemoryBackup(value);
    return this.run("readwrite", ({ transaction, read, result }) => {
      const store = transaction.objectStore(REVIEW_MEMORY_STORE);
      const counts = { added: 0, skipped: 0 };
      result(counts);
      for (const record of backup.records)
        read(store.get(record.username), (existing) => {
          // Existing local data wins, including unreadable records. Nothing in
          // an imported file may silently replace a local note or repair it.
          if (existing !== undefined) {
            counts.skipped++;
            return;
          }
          store.add(record);
          counts.added++;
        });
    });
  }
}
