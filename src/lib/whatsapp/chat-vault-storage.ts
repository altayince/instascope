import {
  LocalIndexedDatabase,
  type LocalTransactionScope,
} from "../local-indexeddb";
import {
  ChatVaultValidationError,
  MAX_CHAT_VAULT_SNAPSHOTS,
  newestChatVaultSnapshots,
  validateChatVaultBackup,
  validateChatVaultSnapshot,
  type ChatVaultBackup,
  type ChatVaultSnapshot,
} from "./chat-vault";

// Separate domain/database: clearing Instagram snapshots or a loaded chat must
// never remove these aggregates, and Instagram migrations never read them.
export const CHAT_VAULT_DATABASE = "instascope:whatsapp-chat-vault";
export const CHAT_VAULT_STORE = "snapshots";

export class ChatVaultStorageError extends Error {}

export function chatVaultStorageMessage(error: unknown): string {
  if (error instanceof ChatVaultValidationError) return error.message;
  if (error instanceof ChatVaultStorageError) return error.message;
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "Browser storage is full. Chat Vault was not changed. Delete unwanted snapshots or free site storage, then try again.";
  return "Browser storage is unavailable. Chat Vault could not be loaded or saved. You can still analyze this chat. Check browser/site storage settings and try again.";
}

function snapshot(value: unknown, key?: IDBValidKey): ChatVaultSnapshot {
  const record = validateChatVaultSnapshot(value);
  if (!record || (key !== undefined && record.id !== key))
    throw new ChatVaultStorageError(
      "A saved Chat Vault record cannot be read. It was not overwritten. Delete unreadable records explicitly before making a complete backup.",
    );
  return record;
}

function backup(value: unknown): ChatVaultBackup {
  const parsed = validateChatVaultBackup(value);
  if (!parsed)
    throw new ChatVaultStorageError(
      "Choose a valid WhatsAppScope Chat Vault V1 backup. Nothing was imported.",
    );
  return parsed;
}

function capacityError(): ChatVaultStorageError {
  return new ChatVaultStorageError(
    `Chat Vault can keep at most ${MAX_CHAT_VAULT_SNAPSHOTS} snapshots, including unreadable records. Delete unwanted snapshots before saving or importing more. Nothing was changed.`,
  );
}

export class ChatVaultStorage {
  private database: LocalIndexedDatabase;

  constructor(
    factory: () => IDBFactory | undefined = () => globalThis.indexedDB,
  ) {
    this.database = new LocalIndexedDatabase({
      name: CHAT_VAULT_DATABASE,
      version: 1,
      factory,
      error: (message) => new ChatVaultStorageError(message),
      blockedMessage:
        "Chat Vault storage is blocked by another tab. Close other InstaScope tabs and reload.",
      upgrade: (db) => {
        if (!db.objectStoreNames.contains(CHAT_VAULT_STORE))
          db.createObjectStore(CHAT_VAULT_STORE, { keyPath: "id" });
      },
    });
  }

  private async run<T>(
    mode: IDBTransactionMode,
    action: (scope: LocalTransactionScope<T>) => void,
  ): Promise<T> {
    try {
      return await this.database.run([CHAT_VAULT_STORE], mode, action);
    } catch (error) {
      throw new ChatVaultStorageError(chatVaultStorageMessage(error));
    }
  }

  list(): Promise<{ snapshots: ChatVaultSnapshot[]; corrupt: number }> {
    return this.readRecords(false);
  }

  private readRecords(forBackup: boolean) {
    return this.run<{ snapshots: ChatVaultSnapshot[]; corrupt: number }>(
      "readonly",
      ({ transaction, read, result }) => {
        const records: ChatVaultSnapshot[] = [];
        let corrupt = 0;
        read(
          transaction.objectStore(CHAT_VAULT_STORE).openCursor(),
          (cursor) => {
            if (!cursor) {
              if (
                forBackup &&
                !validateChatVaultBackup({
                  format: "whatsapp-chat-vault",
                  version: 1,
                  snapshots: records,
                })
              )
                throw capacityError();
              result({ snapshots: newestChatVaultSnapshots(records), corrupt });
              return;
            }
            try {
              records.push(snapshot(cursor.value, cursor.primaryKey));
            } catch (error) {
              if (forBackup) throw error;
              corrupt++;
            }
            cursor.continue();
          },
        );
      },
    );
  }

  save(value: ChatVaultSnapshot): Promise<ChatVaultSnapshot> {
    const candidate = snapshot(value);
    return this.run("readwrite", ({ transaction, read, result }) => {
      const store = transaction.objectStore(CHAT_VAULT_STORE);
      read(store.get(candidate.id), (existing) => {
        if (existing !== undefined)
          throw new ChatVaultStorageError(
            "This Chat Vault snapshot ID is already saved. The existing record was kept.",
          );
        read(store.count(), (count) => {
          if (count >= MAX_CHAT_VAULT_SNAPSHOTS) throw capacityError();
          store.add(candidate);
          result(candidate);
        });
      });
    });
  }

  delete(id: string): Promise<void> {
    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        id,
      )
    )
      throw new ChatVaultStorageError(
        "Choose a valid saved Chat Vault snapshot.",
      );
    return this.run("readwrite", ({ transaction, result }) => {
      transaction.objectStore(CHAT_VAULT_STORE).delete(id);
      result(undefined);
    });
  }

  deleteUnreadable(): Promise<number> {
    return this.run("readwrite", ({ transaction, read, result }) => {
      let removed = 0;
      read(transaction.objectStore(CHAT_VAULT_STORE).openCursor(), (cursor) => {
        if (!cursor) {
          result(removed);
          return;
        }
        try {
          snapshot(cursor.value, cursor.primaryKey);
        } catch {
          cursor.delete();
          removed++;
        }
        cursor.continue();
      });
    });
  }

  async backup(): Promise<ChatVaultSnapshot[]> {
    return (await this.readRecords(true)).snapshots;
  }

  preview(value: ChatVaultBackup): Promise<{ added: number; skipped: number }> {
    const incoming = backup(value);
    return this.run("readonly", ({ transaction, read, result }) => {
      const store = transaction.objectStore(CHAT_VAULT_STORE);
      const counts = { added: 0, skipped: 0 };
      result(counts);
      for (const record of incoming.snapshots)
        read(store.getKey(record.id), (key) => {
          if (key !== undefined) counts.skipped++;
          else counts.added++;
        });
    });
  }

  merge(value: ChatVaultBackup): Promise<{ added: number; skipped: number }> {
    // Validate all records before opening the one atomic write transaction.
    const incoming = backup(value);
    return this.run("readwrite", ({ transaction, read, result }) => {
      const store = transaction.objectStore(CHAT_VAULT_STORE);
      const counts = { added: 0, skipped: 0 };
      result(counts);
      read(store.count(), (existingCount) => {
        for (const record of incoming.snapshots)
          read(store.getKey(record.id), (key) => {
            if (key !== undefined) {
              counts.skipped++;
              return;
            }
            if (existingCount + counts.added >= MAX_CHAT_VAULT_SNAPSHOTS)
              throw capacityError();
            store.add(record);
            counts.added++;
          });
      });
    });
  }
}
