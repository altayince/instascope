import {
  SNAPSHOT_KEY,
  readSavedSnapshot,
  type SavedSnapshot,
} from "./snapshot-storage";
import {
  MAX_BACKUP_SNAPSHOTS,
  MAX_BACKUP_USERNAMES,
  newestSnapshots,
  validateVaultBackup,
  validateVaultSnapshot,
  vaultSummary,
  type VaultBackup,
  type VaultSnapshot,
  type VaultSummary,
} from "./snapshot-vault";

export const VAULT_DATABASE = "instascope:snapshot-vault";
export const VAULT_STORE = "snapshots";
const META = "metadata";
const MIGRATION = "legacy-v1-migrated";
type LegacyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export class VaultStorageError extends Error {}
export class DuplicateSnapshotError extends VaultStorageError {
  constructor(public snapshot: VaultSummary) {
    super(
      "A snapshot already exists for this export date. Choose Replace or Cancel.",
    );
  }
}
export function vaultStorageMessage(error: unknown) {
  if (error instanceof VaultStorageError) return error.message;
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "Browser storage is full. No older snapshots were removed. Delete snapshots in the Vault or free site storage, then try again.";
  return "Browser storage is unavailable. You can still analyze this export, but Snapshot Vault cannot save it. Check browser/site storage settings and try again.";
}
type TransactionScope<T> = {
  transaction: IDBTransaction;
  result: (value: T) => void;
  fail: (error: unknown) => void;
  read: <V>(request: IDBRequest<V>, success: (value: V) => void) => void;
};

export class SnapshotVaultStorage {
  constructor(
    private factory: () => IDBFactory | undefined = () => globalThis.indexedDB,
    private legacy: () => LegacyStorage = () => globalThis.localStorage,
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
            new VaultStorageError(
              "Browser storage did not respond. Close other InstaScope tabs and try again.",
            ),
          ),
        10000,
      );
      try {
        const factory = this.factory();
        if (!factory) throw new Error("IndexedDB unavailable");
        const request = factory.open(VAULT_DATABASE, 1);
        request.onblocked = () =>
          fail(
            new VaultStorageError(
              "Snapshot Vault storage is blocked by another tab. Close other InstaScope tabs and reload.",
            ),
          );
        request.onerror = () => fail(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(VAULT_STORE)) {
            const store = db.createObjectStore(VAULT_STORE, { keyPath: "id" });
            store.createIndex("exportDate", "exportDate", { unique: true });
          }
          if (!db.objectStoreNames.contains(META))
            db.createObjectStore(META, { keyPath: "key" });
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
    stores: string[],
    mode: IDBTransactionMode,
    action: (scope: TransactionScope<T>) => void,
  ): Promise<T> {
    const db = await this.open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(stores, mode);
        let value: T, failure: unknown;
        const timer = setTimeout(() => {
          failure = new VaultStorageError(
            "Browser storage did not respond. The operation was cancelled; try again.",
          );
          transaction.abort();
        }, 15000);
        transaction.oncomplete = () => {
          clearTimeout(timer);
          resolve(value);
        };
        transaction.onabort = () => {
          clearTimeout(timer);
          reject(
            failure ??
              transaction.error ??
              new Error("Storage operation aborted"),
          );
        };
        transaction.onerror = (event) => {
          failure ??= (event.target as IDBRequest).error ?? transaction.error;
        };
        const fail = (error: unknown) => {
          failure = error;
          transaction.abort();
        };
        try {
          action({
            transaction,
            result: (result) => {
              value = result;
            },
            fail,
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
    } finally {
      db.close();
    }
  }
  async initialize(): Promise<string> {
    let legacy: SavedSnapshot | null;
    try {
      legacy = readSavedSnapshot(this.legacy());
    } catch {
      // LocalStorage failure must not disable an otherwise functioning IDB.
      await this.list();
      return "Snapshot Vault is available, but the older saved copy could not be checked. It was not removed. Check site storage settings and reload to retry migration.";
    }
    await this.run<void>(
      [VAULT_STORE, META],
      "readwrite",
      ({ transaction, read, result }) => {
        const meta = transaction.objectStore(META),
          store = transaction.objectStore(VAULT_STORE);
        read(meta.get(MIGRATION), (marker) => {
          if (marker) {
            result();
            return;
          }
          const mark = () => {
            meta.put({ key: MIGRATION, complete: true });
            result();
          };
          if (!legacy) {
            mark();
            return;
          }
          read(store.index("exportDate").get(legacy.exportDate), (existing) => {
            if (!existing)
              store.add(
                validateVaultSnapshot({
                  version: 1,
                  exportDate: legacy.exportDate,
                  followers: legacy.followers,
                  following: legacy.following,
                  id: `legacy-v1-${legacy.exportDate}`,
                  createdAt: Date.now(),
                }),
              );
            mark();
          });
        });
      },
    );
    return "";
  }
  list() {
    return this.run<{ snapshots: VaultSummary[]; corrupt: number }>(
      [VAULT_STORE],
      "readonly",
      ({ transaction, read, result }) => {
        const snapshots: VaultSummary[] = [];
        let corrupt = 0;
        const request = transaction.objectStore(VAULT_STORE).openCursor();
        read(request, (cursor) => {
          if (!cursor) {
            result({ snapshots: newestSnapshots(snapshots), corrupt });
            return;
          }
          try {
            const snapshot = validateVaultSnapshot(cursor.value);
            if (snapshot.id !== cursor.primaryKey)
              throw new Error("Mismatched stored identity");
            snapshots.push(vaultSummary(snapshot));
          } catch {
            corrupt++;
          }
          cursor.continue();
        });
      },
    );
  }
  get(id: string) {
    return this.run<VaultSnapshot>(
      [VAULT_STORE],
      "readonly",
      ({ transaction, read, result }) => {
        read(transaction.objectStore(VAULT_STORE).get(id), (value) => {
          if (!value)
            throw new VaultStorageError(
              "This saved snapshot is no longer available. Refresh the Vault and choose another.",
            );
          try {
            const snapshot = validateVaultSnapshot(value);
            if (snapshot.id !== id)
              throw new Error("Mismatched stored identity");
            result(snapshot);
          } catch {
            throw new VaultStorageError(
              "This saved snapshot cannot be read. It was not used for comparison.",
            );
          }
        });
      },
    );
  }
  save(
    value: VaultSnapshot,
    replacement?: Pick<VaultSummary, "id" | "createdAt">,
  ) {
    const candidate = validateVaultSnapshot(value);
    return this.run<VaultSnapshot>(
      [VAULT_STORE],
      "readwrite",
      ({ transaction, read, result }) => {
        const store = transaction.objectStore(VAULT_STORE);
        read(
          store.index("exportDate").get(candidate.exportDate),
          (existing) => {
            if (existing) {
              const previous = validateVaultSnapshot(existing);
              if (!replacement)
                throw new DuplicateSnapshotError(vaultSummary(previous));
              if (
                replacement.id !== previous.id ||
                replacement.createdAt !== previous.createdAt
              )
                throw new VaultStorageError(
                  "The saved snapshot changed in another tab. Refresh and confirm replacement again.",
                );
              const next = {
                ...candidate,
                id: previous.id,
                createdAt: Math.max(
                  candidate.createdAt,
                  previous.createdAt + 1,
                ),
              };
              store.put(next);
              result(next);
            } else {
              if (replacement)
                throw new VaultStorageError(
                  "The snapshot selected for replacement was deleted. Refresh and save again.",
                );
              store.add(candidate);
              result(candidate);
            }
          },
        );
      },
    );
  }
  async delete(id?: string): Promise<string> {
    const date = await this.run<string | undefined>(
      [VAULT_STORE, META],
      "readwrite",
      ({ transaction, read, result }) => {
        const store = transaction.objectStore(VAULT_STORE);
        // Retain the migration marker even after clear, preventing resurrection.
        transaction.objectStore(META).put({ key: MIGRATION, complete: true });
        if (!id) {
          store.clear();
          result(undefined);
          return;
        }
        read(store.get(id), (value) => {
          store.delete(id);
          result(value?.exportDate);
        });
      },
    );
    try {
      const storage = this.legacy();
      if (!id || readSavedSnapshot(storage)?.exportDate === date)
        storage.removeItem(SNAPSHOT_KEY);
      return "";
    } catch {
      return "Vault deletion completed, but the legacy saved copy could not be removed. Clear this site's browser storage to remove that copy too.";
    }
  }
  async backup() {
    return this.run<VaultSnapshot[]>(
      [VAULT_STORE],
      "readonly",
      ({ transaction, read, result }) => {
        const snapshots: VaultSnapshot[] = [];
        let usernames = 0;
        const request = transaction.objectStore(VAULT_STORE).openCursor();
        read(request, (cursor) => {
          if (!cursor) {
            result(newestSnapshots(snapshots));
            return;
          }
          let snapshot: VaultSnapshot;
          try {
            snapshot = validateVaultSnapshot(cursor.value);
            if (snapshot.id !== cursor.primaryKey)
              throw new Error("Mismatched stored identity");
          } catch {
            cursor.continue();
            return;
          }
          usernames += snapshot.followers.length + snapshot.following.length;
          if (
            snapshots.length >= MAX_BACKUP_SNAPSHOTS ||
            usernames > MAX_BACKUP_USERNAMES
          )
            throw new VaultStorageError(
              "This Vault is too large for a single V1 backup. Your saved snapshots have not been changed.",
            );
          snapshots.push(snapshot);
          cursor.continue();
        });
      },
    );
  }
  merge(value: VaultBackup) {
    const backup = validateVaultBackup(value);
    return this.run<{ added: number; skipped: number }>(
      [VAULT_STORE],
      "readwrite",
      ({ transaction, read, result }) => {
        const store = transaction.objectStore(VAULT_STORE);
        const counts = { added: 0, skipped: 0 };
        result(counts);
        for (const snapshot of backup.snapshots) {
          read(
            store.index("exportDate").get(snapshot.exportDate),
            (existing) => {
              if (existing) {
                counts.skipped++;
                return;
              }
              read(store.get(snapshot.id), (collision) => {
                if (collision)
                  throw new VaultStorageError(
                    "A backup snapshot ID conflicts with a different saved date. Nothing was imported.",
                  );
                store.add(snapshot);
                counts.added++;
              });
            },
          );
        }
      },
    );
  }
}
