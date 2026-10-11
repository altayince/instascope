import { describe, expect, it } from "vitest";
import {
  MAX_REVIEW_BACKUP_BYTES,
  MAX_REVIEW_MEMORY_RECORDS,
  MAX_REVIEW_NOTE_LENGTH,
  parseReviewMemoryBackup,
  serializeReviewMemoryBackup,
  updateReviewMemoryRecord,
  validateReviewMemoryBackup,
  validateReviewMemoryRecord,
  type ReviewMemoryRecord,
} from "../../src/lib/review-memory";
import {
  REVIEW_MEMORY_DATABASE,
  REVIEW_MEMORY_STORE,
  ReviewMemoryStorage,
  ReviewMemoryStorageError,
  reviewMemoryStorageMessage,
} from "../../src/lib/review-memory-storage";
import {
  parseVaultBackup,
  serializeVaultBackup,
} from "../../src/lib/snapshot-vault";
import { VAULT_DATABASE } from "../../src/lib/vault-storage";

const createdAt = "2026-10-01T12:00:00.000Z";
const updatedAt = "2026-10-11T12:00:00.000Z";
const record = (
  username = "fixture.account",
  patch: Partial<ReviewMemoryRecord> = {},
): ReviewMemoryRecord => ({
  username,
  keep: false,
  reviewed: false,
  watch: false,
  createdAt,
  updatedAt,
  ...patch,
});
const backup = (records: unknown[] = [record()]) => ({
  format: "instascope-review-memory",
  version: 1,
  records,
});

// Small injectable transactional harness, not a browser API replacement.
// Native IndexedDB persistence, tab behavior and database isolation are also
// exercised by Playwright. This lets unit tests force atomic quota failures.
function memoryFactory(initial?: Map<string, unknown>) {
  const databases = new Map<string, Map<string, unknown>>();
  if (initial) databases.set(REVIEW_MEMORY_DATABASE, new Map(initial));
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
            expect(store).toBe(REVIEW_MEMORY_STORE);
            expect(options.keyPath).toBe("username");
            databases.set(name, new Map());
          },
          close() {},
          transaction(stores: string[], mode: IDBTransactionMode) {
            expect(stores).toEqual([REVIEW_MEMORY_STORE]);
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
            const write = (value: ReviewMemoryRecord, add: boolean) =>
              enqueue(() => {
                if (value.username === failWriteFor)
                  throw new DOMException(
                    "private failure",
                    "QuotaExceededError",
                  );
                if (add && working.has(value.username))
                  throw new DOMException(
                    "private duplicate",
                    "ConstraintError",
                  );
                working.set(value.username, structuredClone(value));
                return value.username;
              });
            const store = {
              get: (username: string) =>
                enqueue(() => structuredClone(working.get(username))),
              put: (value: ReviewMemoryRecord) => write(value, false),
              add: (value: ReviewMemoryRecord) => write(value, true),
              delete: (username: string) =>
                enqueue(() => working.delete(username)),
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
    failWritesTo: (username?: string) => {
      failWriteFor = username;
    },
  };
}

describe("Review Memory model", () => {
  it("creates normalized identities with no inferred flags or note", () => {
    expect(
      updateReviewMemoryRecord(null, " @Fixture.Account ", {}, createdAt),
    ).toEqual({ ...record(), createdAt, updatedAt: createdAt });
    expect(
      updateReviewMemoryRecord(
        null,
        "https://www.instagram.com/_u/Fixture.Account/",
        {},
        createdAt,
      ).username,
    ).toBe("fixture.account");
  });

  it("changes manual flags independently, preserving creation and exact private notes", () => {
    const first = updateReviewMemoryRecord(
      null,
      "fixture.account",
      { keep: true, note: "  Fictional context\nSecond line.  " },
      createdAt,
    );
    const second = updateReviewMemoryRecord(
      first,
      "@FIXTURE.ACCOUNT",
      { reviewed: true, watch: true },
      updatedAt,
    );
    expect(second).toEqual({
      ...record(),
      keep: true,
      reviewed: true,
      watch: true,
      note: "  Fictional context\nSecond line.  ",
    });
    expect(
      updateReviewMemoryRecord(
        second,
        second.username,
        { keep: false },
        updatedAt,
      ),
    ).toEqual({ ...second, keep: false });
    const cleared = updateReviewMemoryRecord(
      second,
      second.username,
      { note: "" },
      updatedAt,
    );
    expect(cleared).not.toHaveProperty("note");
    expect(cleared.watch).toBe(true);
  });

  it("keeps timestamps monotonic if the local clock moves backwards", () => {
    expect(
      updateReviewMemoryRecord(
        record(),
        "fixture.account",
        { watch: true },
        createdAt,
      ),
    ).toEqual(record("fixture.account", { watch: true }));
    expect(
      validateReviewMemoryRecord({
        ...record(),
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-11T12:00:00Z",
      }),
    ).toEqual(record());
  });

  it("bounds notes and rejects invalid edits rather than coercing flags", () => {
    expect(
      updateReviewMemoryRecord(
        null,
        "fixture.account",
        { note: "x".repeat(MAX_REVIEW_NOTE_LENGTH) },
        createdAt,
      ).note,
    ).toHaveLength(500);
    for (const patch of [
      { note: "x".repeat(MAX_REVIEW_NOTE_LENGTH + 1) },
      { note: 1 },
      { note: undefined },
      { watch: "true" },
      { keep: 1 },
      { reviewed: null },
      { username: "other.account" },
      { updatedAt },
      null,
      [],
    ])
      expect(() =>
        updateReviewMemoryRecord(
          record(),
          "fixture.account",
          patch as never,
          updatedAt,
        ),
      ).toThrow();
    expect(() =>
      updateReviewMemoryRecord(record(), "different.account", {}, updatedAt),
    ).toThrow(/different account/);
  });

  it("validates exact persisted fields, booleans and identities", () => {
    expect(validateReviewMemoryRecord(record(" @FIXTURE.ACCOUNT "))).toEqual(
      record(),
    );
    expect(
      validateReviewMemoryRecord(record("__deleted__abcdefghijabcdefg")),
    ).toBeDefined();
    for (const value of [
      null,
      [],
      { ...record(), username: "https://example.com/fixture.account/" },
      { ...record(), username: "<script>" },
      { ...record(), username: "explore" },
      { ...record(), keep: undefined },
      { ...record(), reviewed: "false" },
      { ...record(), watch: 0 },
      { ...record(), note: {} },
      { ...record(), note: "x".repeat(501) },
      { ...record(), exportDate: "2026-10-11" },
      { ...record(), followers: [] },
    ])
      expect(() => validateReviewMemoryRecord(value)).toThrow();
  });

  it("rejects malformed and impossible timestamps and updates before creation", () => {
    for (const date of [
      "2026-02-30T12:00:00.000Z",
      "2026-02-29T12:00:00Z",
      "2026-13-01T12:00:00.000Z",
      "2026-10-01T24:00:00.000Z",
      "2026-10-01T12:60:00.000Z",
      "2026-10-01T12:00:60.000Z",
      "2026-10-01T12:00:00+01:00",
      "2026-10-01",
      "yesterday",
      1,
    ])
      expect(() =>
        validateReviewMemoryRecord({ ...record(), updatedAt: date }),
      ).toThrow();
    expect(() =>
      validateReviewMemoryRecord({
        ...record(),
        createdAt: updatedAt,
        updatedAt: createdAt,
      }),
    ).toThrow(/predate/);
    expect(
      validateReviewMemoryRecord({
        ...record(),
        createdAt: "2024-02-29T12:00:00.000Z",
      }).createdAt,
    ).toBe("2024-02-29T12:00:00.000Z");
  });
});

describe("Review Memory private backups", () => {
  it("roundtrips a strict separate format and preserves exact notes", () => {
    const records = [
      record("z.fixture", { watch: true, note: "  Fictional note\n☀  " }),
      record("a.fixture", { keep: true, reviewed: true }),
    ];
    const restored = parseReviewMemoryBackup(
      serializeReviewMemoryBackup(records),
    );
    expect(restored).toEqual(backup([records[1], records[0]]));
    expect(records[0].username).toBe("z.fixture");
    expect(
      parseReviewMemoryBackup(serializeReviewMemoryBackup([])).records,
    ).toEqual([]);
    const vault = serializeVaultBackup([
      {
        id: "fixture-snapshot",
        version: 1,
        exportDate: "2026-10-01",
        createdAt: 1,
        followers: ["fixture.account"],
        following: [],
      },
    ]);
    expect(parseVaultBackup(vault).snapshots).toHaveLength(1);
    expect(() => parseReviewMemoryBackup(vault)).toThrow(/not a Vault backup/);
    expect(() =>
      parseVaultBackup(serializeReviewMemoryBackup(records)),
    ).toThrow();
  });

  it("rejects duplicate normalized identities and unknown/malformed backup content", () => {
    expect(() => parseReviewMemoryBackup("{broken")).toThrow(/JSON/);
    for (const value of [
      {},
      [],
      { ...backup(), version: 2 },
      { ...backup(), format: "instagram" },
      { ...backup(), snapshots: [] },
      backup([record(), record(" @FIXTURE.ACCOUNT ")]),
      backup([record(), record("https://instagram.com/fixture.account/")]),
      backup([null]),
      backup(new Array(1)),
    ])
      expect(() => validateReviewMemoryBackup(value)).toThrow();
  });

  it("bounds record counts and uploaded bytes before parsing", () => {
    expect(() =>
      validateReviewMemoryBackup(
        backup(Array(MAX_REVIEW_MEMORY_RECORDS + 1).fill(record())),
      ),
    ).toThrow(/10,000/);
    expect(() =>
      parseReviewMemoryBackup(" ".repeat(MAX_REVIEW_BACKUP_BYTES + 1)),
    ).toThrow(/16 MB/);
    expect(() =>
      parseReviewMemoryBackup(
        "☀".repeat(Math.floor(MAX_REVIEW_BACKUP_BYTES / 3) + 1),
      ),
    ).toThrow(/16 MB/);
  });
});

describe("Review Memory storage", () => {
  it("creates its independent domain and persists manual changes without touching Vault", async () => {
    const memory = memoryFactory();
    const savedVault = new Map([
      [
        "fixture-snapshot",
        {
          id: "fixture-snapshot",
          followers: ["fixture.account"],
          following: [],
        },
      ],
    ]);
    memory.databases.set(VAULT_DATABASE, savedVault);
    const store = new ReviewMemoryStorage(
      () => memory.factory,
      () => updatedAt,
    );
    expect(await store.list()).toEqual({ records: [], corrupt: 0 });
    const first = await store.update(" @Fixture.Account ", { keep: true });
    expect(first).toEqual({ ...record(), keep: true, createdAt: updatedAt });
    await store.update("fixture.account", { reviewed: true, watch: true });
    await store.update("fixture.account", {
      note: "Private fictional context",
    });
    expect(await store.backup()).toEqual([
      {
        ...first,
        reviewed: true,
        watch: true,
        note: "Private fictional context",
      },
    ]);
    expect(memory.opened.every((name) => name === REVIEW_MEMORY_DATABASE)).toBe(
      true,
    );
    expect(memory.databases.get(VAULT_DATABASE)).toBe(savedVault);
    expect(savedVault.size).toBe(1);
  });

  it("deletes one record or all review records with explicit independent boundaries", async () => {
    const memory = memoryFactory(
      new Map([
        ["a.fixture", record("a.fixture")],
        ["b.fixture", record("b.fixture", { note: "Preserve until cleared" })],
      ]),
    );
    const savedVault = new Map([["saved", { id: "saved" }]]);
    memory.databases.set(VAULT_DATABASE, savedVault);
    const store = new ReviewMemoryStorage(() => memory.factory);
    expect(() => store.delete("")).toThrow(/valid Instagram username/);
    expect((await store.list()).records).toHaveLength(2);
    await store.delete(" @A.FIXTURE ");
    expect((await store.list()).records.map((value) => value.username)).toEqual(
      ["b.fixture"],
    );
    await store.delete();
    expect(await store.list()).toEqual({ records: [], corrupt: 0 });
    expect(memory.databases.get(VAULT_DATABASE)).toBe(savedVault);
    expect(savedVault.size).toBe(1);
  });

  it("imports atomically with existing local decisions and notes winning every conflict", async () => {
    const local = record("existing.fixture", {
      keep: true,
      note: "Keep my private local note",
    });
    const corrupt = { ...record("corrupt.fixture"), watch: "invalid" };
    const memory = memoryFactory(
      new Map<string, unknown>([
        [local.username, local],
        ["corrupt.fixture", corrupt],
      ]),
    );
    const store = new ReviewMemoryStorage(() => memory.factory);
    expect(
      await store.merge(
        validateReviewMemoryBackup(
          backup([
            record("existing.fixture", {
              watch: true,
              note: "Never replace local",
              updatedAt: "2026-10-12T12:00:00.000Z",
            }),
            record("new.fixture", {
              reviewed: true,
              note: "Import this fictional note",
            }),
            record("corrupt.fixture", { watch: true }),
          ]),
        ),
      ),
    ).toEqual({ added: 1, skipped: 2 });
    expect(await store.list()).toEqual({
      records: [
        local,
        record("new.fixture", {
          reviewed: true,
          note: "Import this fictional note",
        }),
      ],
      corrupt: 1,
    });
    expect(
      memory.databases.get(REVIEW_MEMORY_DATABASE)?.get("corrupt.fixture"),
    ).toEqual(corrupt);
  });

  it("reports corruption, rejects overwriting and incomplete backups, and permits explicit deletion", async () => {
    const corrupt = {
      ...record(),
      watch: "invalid",
      note: "Unreadable but not disposable",
    };
    const mismatched = record("different.fixture");
    const memory = memoryFactory(
      new Map<string, unknown>([
        ["fixture.account", corrupt],
        ["mismatched.fixture", mismatched],
        ["valid.fixture", record("valid.fixture")],
      ]),
    );
    const store = new ReviewMemoryStorage(() => memory.factory);
    expect(await store.list()).toEqual({
      records: [record("valid.fixture")],
      corrupt: 2,
    });
    await expect(
      store.update("fixture.account", { watch: true }),
    ).rejects.toThrow(/not overwritten/);
    await expect(store.backup()).rejects.toThrow(/cannot be read/);
    expect(
      memory.databases.get(REVIEW_MEMORY_DATABASE)?.get("fixture.account"),
    ).toEqual(corrupt);
    await store.delete("fixture.account");
    expect((await store.list()).corrupt).toBe(1);
    await store.delete();
    expect(await store.backup()).toEqual([]);
  });

  it("rolls back failed updates and the entire import when quota is exceeded", async () => {
    const local = record("b.fixture", { note: "Existing private note" });
    const memory = memoryFactory(new Map([[local.username, local]]));
    const store = new ReviewMemoryStorage(() => memory.factory);
    memory.failWritesTo("b.fixture");
    await expect(
      store.update("b.fixture", { note: "Must not replace" }),
    ).rejects.toThrow(/full.*not changed/);
    expect((await store.list()).records).toEqual([local]);
    memory.failWritesTo("c.fixture");
    await expect(
      store.merge(
        validateReviewMemoryBackup(
          backup([
            record("a.fixture", { watch: true }),
            record("c.fixture", { note: "Will fail" }),
          ]),
        ),
      ),
    ).rejects.toThrow(/full/);
    expect((await store.list()).records).toEqual([local]);
  });

  it("rejects invalid mutations before opening storage", () => {
    const memory = memoryFactory();
    const store = new ReviewMemoryStorage(() => memory.factory);
    expect(() => store.update("<script>", { watch: true })).toThrow();
    expect(() =>
      store.update("fixture.account", { note: "x".repeat(501) }),
    ).toThrow();
    expect(() => store.merge(backup([record(), record()]) as never)).toThrow(
      /duplicate/,
    );
    expect(memory.opened).toEqual([]);
  });

  it("fails safely for unavailable, denied or blocked IndexedDB without revealing raw errors", async () => {
    await expect(
      new ReviewMemoryStorage(() => undefined).list(),
    ).rejects.toThrow(/unavailable/);
    const denied = new ReviewMemoryStorage(() => {
      throw new DOMException("private infrastructure text", "SecurityError");
    });
    await expect(denied.list()).rejects.toThrow(/unavailable/);
    const blocked = {
      open() {
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() =>
          request.onblocked?.call(request, {} as IDBVersionChangeEvent),
        );
        return request;
      },
    } as unknown as IDBFactory;
    await expect(new ReviewMemoryStorage(() => blocked).list()).rejects.toThrow(
      /blocked by another tab/,
    );
    expect(
      reviewMemoryStorageMessage(
        new DOMException("private details", "QuotaExceededError"),
      ),
    ).toMatch(/full.*not changed/);
    expect(
      reviewMemoryStorageMessage(new Error("sensitive username or note")),
    ).not.toContain("sensitive");
    expect(
      reviewMemoryStorageMessage(new ReviewMemoryStorageError("Safe message")),
    ).toBe("Safe message");
  });
});
