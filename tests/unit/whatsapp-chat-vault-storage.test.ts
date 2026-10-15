import { describe, expect, it } from "vitest";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import {
  ChatVaultValidationError,
  createChatVaultSnapshot,
  parseChatVaultBackup,
  serializeChatVaultBackup,
  MAX_CHAT_VAULT_SNAPSHOTS,
  type ChatVaultSnapshot,
} from "../../src/lib/whatsapp/chat-vault";
import {
  CHAT_VAULT_DATABASE,
  CHAT_VAULT_STORE,
  ChatVaultStorage,
  ChatVaultStorageError,
  chatVaultStorageMessage,
} from "../../src/lib/whatsapp/chat-vault-storage";
import { VAULT_DATABASE } from "../../src/lib/vault-storage";

const fixture = parseWhatsApp(
  [
    "01/01/2026, 09:00 - Synthetic A: private fixture body https://example.org/private",
    "01/01/2026, 09:05 - Synthetic B: Another private fixture body",
    "02/01/2026, 10:00 - Synthetic A: image omitted",
  ].join("\n"),
  "dmy-24h",
);
const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const record = (value = 1) =>
  createChatVaultSnapshot(fixture, { id: id(value), createdAt: value });
const backup = (snapshots: ChatVaultSnapshot[]) =>
  parseChatVaultBackup(serializeChatVaultBackup(snapshots));

// Small transactional harness reused from Review Memory tests. Native browser
// persistence is additionally exercised in Playwright; this forces atomic faults.
function memoryFactory(initial?: Map<string, unknown>) {
  const databases = new Map<string, Map<string, unknown>>();
  if (initial) databases.set(CHAT_VAULT_DATABASE, new Map(initial));
  const opened: string[] = [];
  let failWriteFor: string | undefined;
  const factory = {
    open(name: string, version: number) {
      opened.push(name);
      expect(version).toBe(1);
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => {
        const fresh = !databases.has(name);
        const db = {
          objectStoreNames: {
            contains: () => databases.has(name),
          },
          createObjectStore(store: string, options: IDBObjectStoreParameters) {
            expect(store).toBe(CHAT_VAULT_STORE);
            expect(options.keyPath).toBe("id");
            databases.set(name, new Map());
          },
          close() {},
          transaction(stores: string[], mode: IDBTransactionMode) {
            expect(stores).toEqual([CHAT_VAULT_STORE]);
            const working = new Map(databases.get(name));
            let pending = 0;
            let finished = false;
            const transaction = {
              abort() {
                if (finished) return;
                finished = true;
                queueMicrotask(() =>
                  transaction.onabort?.call(transaction, {} as Event),
                );
              },
            } as IDBTransaction;
            const complete = () => {
              queueMicrotask(() => {
                if (finished || pending) return;
                finished = true;
                if (mode === "readwrite") databases.set(name, working);
                transaction.oncomplete?.call(transaction, {} as Event);
              });
            };
            const enqueue = <T>(
              operation: () => T,
              request = {} as IDBRequest<T>,
            ): IDBRequest<T> => {
              pending++;
              queueMicrotask(() => {
                if (finished) return;
                try {
                  Object.assign(request, { result: operation() });
                  request.onsuccess?.call(request, {} as Event);
                } catch (error) {
                  Object.assign(request, { error });
                  transaction.onerror?.call(transaction, {
                    target: request,
                  } as unknown as Event);
                  transaction.abort();
                } finally {
                  pending--;
                  complete();
                }
              });
              return request;
            };
            const write = (value: ChatVaultSnapshot, add: boolean) =>
              enqueue(() => {
                if (value.id === failWriteFor)
                  throw new DOMException(
                    "private failure",
                    "QuotaExceededError",
                  );
                if (add && working.has(value.id))
                  throw new DOMException(
                    "private duplicate",
                    "ConstraintError",
                  );
                working.set(value.id, structuredClone(value));
                return value.id;
              });
            const store = {
              get: (id: string) =>
                enqueue(() => structuredClone(working.get(id))),
              getKey: (id: string) =>
                enqueue(() => (working.has(id) ? id : undefined)),
              count: () => enqueue(() => working.size),
              put: (value: ChatVaultSnapshot) => write(value, false),
              add: (value: ChatVaultSnapshot) => write(value, true),
              delete: (id: string) => enqueue(() => working.delete(id)),
              clear: () => enqueue(() => working.clear()),
              openCursor() {
                const entries = [...working.entries()].sort(([a], [b]) =>
                  a.localeCompare(b),
                );
                const cursorRequest =
                  {} as IDBRequest<IDBCursorWithValue | null>;
                let index = 0;
                const next = () =>
                  enqueue(() => {
                    const entry = entries[index++];
                    return entry
                      ? ({
                          primaryKey: entry[0],
                          value: structuredClone(entry[1]),
                          continue: next,
                          delete: () => enqueue(() => working.delete(entry[0])),
                        } as unknown as IDBCursorWithValue)
                      : null;
                  }, cursorRequest);
                return next();
              },
            };
            transaction.objectStore = () => store as unknown as IDBObjectStore;
            complete();
            return transaction;
          },
        } as unknown as IDBDatabase;
        Object.assign(request, { result: db });
        if (fresh)
          request.onupgradeneeded?.call(request, {} as IDBVersionChangeEvent);
        request.onsuccess?.call(request, {} as Event);
      });
      return request;
    },
  } as unknown as IDBFactory;
  return {
    factory,
    databases,
    opened,
    failWritesTo: (id?: string) => {
      failWriteFor = id;
    },
  };
}

describe("Chat Vault local storage", () => {
  it("initializes empty without autosave and stores safe snapshots in an independent database", async () => {
    const memory = memoryFactory();
    const instagram = new Map([["instagram-record", { private: "preserve" }]]);
    memory.databases.set(VAULT_DATABASE, instagram);
    const store = new ChatVaultStorage(() => memory.factory);
    expect(await store.list()).toEqual({ snapshots: [], corrupt: 0 });
    expect(await store.backup()).toEqual([]);
    expect(await store.save(record())).toEqual(record());
    expect(await store.list()).toEqual({ snapshots: [record()], corrupt: 0 });
    expect(await store.backup()).toEqual([record()]);
    expect(memory.opened.every((name) => name === CHAT_VAULT_DATABASE)).toBe(
      true,
    );
    expect(memory.databases.get(VAULT_DATABASE)).toBe(instagram);
    const serialized = JSON.stringify(await store.backup());
    expect(serialized).not.toMatch(
      /Synthetic A|Synthetic B|private fixture body|example\.org|messages"\s*:\s*\[/,
    );
  });

  it("keeps separate ids with the same coverage and rejects overwriting a saved id", async () => {
    const memory = memoryFactory();
    const store = new ChatVaultStorage(() => memory.factory);
    await store.save(record(1));
    await store.save(record(2));
    expect((await store.list()).snapshots.map((value) => value.id)).toEqual([
      id(2),
      id(1),
    ]);
    await expect(store.save({ ...record(1), createdAt: 999 })).rejects.toThrow(
      /already saved/,
    );
    expect((await store.backup()).find((value) => value.id === id(1))).toEqual(
      record(1),
    );
  });

  it("deletes one snapshot and rejects invalid delete identifiers without clearing other domains", async () => {
    const memory = memoryFactory(
      new Map([
        [id(1), record(1)],
        [id(2), record(2)],
      ]),
    );
    const store = new ChatVaultStorage(() => memory.factory);
    expect(() => store.delete("")).toThrow(/valid saved/);
    await store.delete(id(1));
    expect(await store.backup()).toEqual([record(2)]);
    await store.delete(id(1));
    expect(await store.backup()).toEqual([record(2)]);
  });

  it("validates before storage and previews without mutation before an explicit atomic merge", async () => {
    const local = record(1);
    const memory = memoryFactory(new Map([[id(1), local]]));
    const store = new ChatVaultStorage(() => memory.factory);
    const incoming = backup([{ ...record(1), createdAt: 999 }, record(2)]);
    expect(await store.preview(incoming)).toEqual({ added: 1, skipped: 1 });
    expect(await store.backup()).toEqual([local]);
    expect(await store.merge(incoming)).toEqual({ added: 1, skipped: 1 });
    expect(await store.backup()).toEqual([record(2), local]);
    expect(await store.merge(incoming)).toEqual({ added: 0, skipped: 2 });
    const opened = memory.opened.length;
    expect(() =>
      store.save({ ...record(), rawMessage: "never persist" } as never),
    ).toThrow();
    expect(() => store.merge({ ...incoming, version: 2 } as never)).toThrow();
    expect(memory.opened).toHaveLength(opened);
  });

  it("rechecks imported ids at confirmation time instead of trusting a stale preview", async () => {
    const memory = memoryFactory();
    const store = new ChatVaultStorage(() => memory.factory);
    const incoming = backup([record(1), record(2)]);
    expect(await store.preview(incoming)).toEqual({ added: 2, skipped: 0 });
    await store.save({ ...record(1), createdAt: 999 });
    expect(await store.merge(incoming)).toEqual({ added: 1, skipped: 1 });
    expect(
      (await store.backup()).find((value) => value.id === id(1))?.createdAt,
    ).toBe(999);
  });

  it("discloses corruption, preserves unreadable local ids on import, and refuses partial backups", async () => {
    const corrupt = { ...record(2), rawText: "unreadable local fixture" };
    const mismatched = record(3);
    const memory = memoryFactory(
      new Map<string, unknown>([
        [id(1), record(1)],
        [id(2), corrupt],
        [id(4), mismatched],
      ]),
    );
    const store = new ChatVaultStorage(() => memory.factory);
    expect(await store.list()).toEqual({ snapshots: [record(1)], corrupt: 2 });
    await expect(store.backup()).rejects.toThrow(/cannot be read/);
    expect(await store.preview(backup([record(2)]))).toEqual({
      added: 0,
      skipped: 1,
    });
    expect(await store.merge(backup([record(2)]))).toEqual({
      added: 0,
      skipped: 1,
    });
    expect(memory.databases.get(CHAT_VAULT_DATABASE)?.get(id(2))).toEqual(
      corrupt,
    );
    expect(await store.deleteUnreadable()).toBe(2);
    expect(await store.list()).toEqual({ snapshots: [record(1)], corrupt: 0 });
    expect(await store.backup()).toEqual([record(1)]);
  });

  it("rolls back every addition when a later import write fails", async () => {
    const local = record(1);
    const memory = memoryFactory(new Map([[id(1), local]]));
    const store = new ChatVaultStorage(() => memory.factory);
    memory.failWritesTo(id(3));
    await expect(store.merge(backup([record(2), record(3)]))).rejects.toThrow(
      /full.*not changed/,
    );
    expect(await store.backup()).toEqual([local]);
    await expect(store.save(record(3))).rejects.toThrow(/full/);
    expect(await store.backup()).toEqual([local]);
  });

  it("enforces capacity atomically including corrupt records without silent eviction", async () => {
    const initial = new Map<string, unknown>(
      Array.from({ length: MAX_CHAT_VAULT_SNAPSHOTS - 1 }, (_, index) => [
        id(index + 1),
        index ? record(index + 1) : { id: id(1), invalid: true },
      ]),
    );
    const memory = memoryFactory(initial);
    const store = new ChatVaultStorage(() => memory.factory);
    await expect(
      store.merge(backup([record(101), record(102)])),
    ).rejects.toThrow(/at most 100/);
    expect((await store.list()).snapshots).toHaveLength(
      MAX_CHAT_VAULT_SNAPSHOTS - 2,
    );
    await store.save(record(101));
    await expect(store.save(record(102))).rejects.toThrow(/at most 100/);
    expect(memory.databases.get(CHAT_VAULT_DATABASE)?.size).toBe(
      MAX_CHAT_VAULT_SNAPSHOTS,
    );
    expect((await store.list()).corrupt).toBe(1);
  });

  it("fails safely for unavailable, denied and blocked storage without exposing raw errors", async () => {
    await expect(new ChatVaultStorage(() => undefined).list()).rejects.toThrow(
      /unavailable/,
    );
    await expect(
      new ChatVaultStorage(() => {
        throw new DOMException("private environment", "SecurityError");
      }).list(),
    ).rejects.toThrow(/unavailable/);
    const factory = {
      open() {
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() =>
          request.onblocked?.call(request, {} as IDBVersionChangeEvent),
        );
        return request;
      },
    } as unknown as IDBFactory;
    await expect(new ChatVaultStorage(() => factory).list()).rejects.toThrow(
      /blocked by another tab/,
    );
    expect(
      chatVaultStorageMessage(new Error("private internal data")),
    ).not.toContain("private internal");
    expect(
      chatVaultStorageMessage(new ChatVaultStorageError("Safe message")),
    ).toBe("Safe message");
    expect(
      chatVaultStorageMessage(
        new ChatVaultValidationError(
          "Choose a valid Chat Vault V1 aggregate backup.",
        ),
      ),
    ).toBe("Choose a valid Chat Vault V1 aggregate backup.");
    expect(
      chatVaultStorageMessage(
        new DOMException("private", "QuotaExceededError"),
      ),
    ).toMatch(/full.*not changed/);
  });
});
