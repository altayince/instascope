import { describe, expect, it } from "vitest";
import { account } from "../../src/lib/instagram/normalize";
import type { Dataset } from "../../src/lib/instagram/types";
import { compareSnapshots } from "../../src/lib/analysis/relationships";
import { restoreSavedSnapshot } from "../../src/lib/snapshot-storage";
import {
  compareVaultSnapshots,
  createVaultSnapshot,
  formatSnapshotDate,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_SNAPSHOTS,
  newestSnapshots,
  parseVaultBackup,
  previewVaultImport,
  serializeVaultBackup,
  validateVaultBackup,
  validateVaultSnapshot,
  vaultComparisonError,
  vaultSummary,
  type VaultSnapshot,
} from "../../src/lib/snapshot-vault";
import {
  SnapshotVaultStorage,
  VaultStorageError,
  vaultStorageMessage,
} from "../../src/lib/vault-storage";

const older: VaultSnapshot = {
  id: "old",
  version: 1,
  exportDate: "2026-07-01",
  createdAt: 1,
  followers: ["alpha", "lost"],
  following: ["alpha", "removed"],
};
const newer: VaultSnapshot = {
  id: "new",
  version: 1,
  exportDate: "2026-10-08",
  createdAt: 2,
  followers: ["beta", "alpha", "gained"],
  following: ["beta", "added"],
};
const backup = (snapshots: unknown[] = [older, newer]) => ({
  format: "instascope-snapshot-vault",
  version: 1,
  snapshots,
});
describe("Snapshot Vault V1", () => {
  it("stores only permitted fields, normalizes and deterministically deduplicates", () => {
    const dataset: Dataset = {
      followers: [
        account("alpha", 1700000000)!,
        account("Alpha")!,
        account("beta")!,
      ],
      following: [account("alpha", 1700000000)!],
      connections: {
        pendingRequests: {
          status: "available",
          accounts: [account("private.request")!],
        },
      } as Dataset["connections"],
      metadata: { parsedAt: 99, sourceFormat: "html", warnings: ["private"] },
    };
    const result = createVaultSnapshot(dataset, "2026-10-08", "stable-id", 500);
    expect(result).toEqual({
      id: "stable-id",
      version: 1,
      exportDate: "2026-10-08",
      createdAt: 500,
      followers: ["alpha", "beta"],
      following: ["alpha"],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /timestamp|href|private|sourceFormat/,
    );
    expect(() =>
      createVaultSnapshot(
        { ...dataset, metadata: { ...dataset.metadata, demo: true } },
        "2026-10-08",
      ),
    ).toThrow(/Fictional demo/);
    expect(() => createVaultSnapshot(dataset, "2026-02-30")).toThrow(
      /valid date/,
    );
  });
  it("normalizes backup usernames without executing or accepting arbitrary content", () => {
    expect(
      validateVaultSnapshot({
        ...older,
        followers: [" @ALPHA ", "alpha", "Beta"],
      }).followers,
    ).toEqual(["alpha", "beta"]);
    for (const value of [
      null,
      [],
      { ...older, version: 2 },
      { ...older, exportDate: "2026-02-30" },
      { ...older, createdAt: Infinity },
      { ...older, createdAt: Number.MAX_SAFE_INTEGER },
      { ...older, id: "<script>" },
      { ...older, followers: ["https://instagram.com/alpha"] },
      { ...older, followers: ["<script>alert(1)</script>"] },
      { ...older, connections: {} },
      { ...older, timestamp: 1 },
    ])
      expect(() => validateVaultSnapshot(value)).toThrow();
  });
  it("summarizes without retaining usernames and sorts by export date without mutating input", () => {
    const input = [older, newer];
    expect(newestSnapshots(input).map((s) => s.id)).toEqual(["new", "old"]);
    expect(input[0]).toBe(older);
    expect(vaultSummary(older)).toEqual({
      id: "old",
      exportDate: "2026-07-01",
      createdAt: 1,
      followersCount: 2,
      followingCount: 2,
    });
    expect(formatSnapshotDate("2026-10-08")).toBe("8 Oct 2026");
  });
  it("rejects same snapshot, reversed/equal dates and missing same-account confirmation in underlying logic", () => {
    expect(
      vaultComparisonError(vaultSummary(older), vaultSummary(newer), false),
    ).toMatch(/Confirm/);
    expect(() => compareVaultSnapshots(older, newer, false)).toThrow(/Confirm/);
    expect(() => compareVaultSnapshots(older, older, true)).toThrow(
      /different/,
    );
    expect(() => compareVaultSnapshots(newer, older, true)).toThrow(/earlier/);
    expect(() =>
      compareVaultSnapshots(
        older,
        { ...newer, exportDate: older.exportDate },
        true,
      ),
    ).toThrow(/earlier/);
    expect(() =>
      compareVaultSnapshots(
        { ...older, exportDate: "2026-02-30" },
        newer,
        true,
      ),
    ).toThrow();
  });
  it("reuses the existing comparison engine with all six directions and deltas", () => {
    const result = compareVaultSnapshots(older, newer, true);
    expect(result).toEqual(
      compareSnapshots(
        restoreSavedSnapshot(validateVaultSnapshot(older)),
        restoreSavedSnapshot(validateVaultSnapshot(newer)),
      ),
    );
    expect(result.newFollowers.map((s) => s.username)).toEqual([
      "beta",
      "gained",
    ]);
    expect(result.lostFollowers.map((s) => s.username)).toEqual(["lost"]);
    expect(result.newFollowing.map((s) => s.username)).toEqual([
      "added",
      "beta",
    ]);
    expect(result.removedFollowing.map((s) => s.username)).toEqual([
      "alpha",
      "removed",
    ]);
    expect(result.newMutuals.map((s) => s.username)).toEqual(["beta"]);
    expect(result.lostMutuals.map((s) => s.username)).toEqual(["alpha"]);
    expect([result.followerDelta, result.followingDelta]).toEqual([1, 0]);
  });
  it("roundtrips the strict backup format and previews existing dates without replacing them", () => {
    const result = parseVaultBackup(serializeVaultBackup([older, newer]));
    expect(result.snapshots.map((s) => s.id)).toEqual(["new", "old"]);
    expect(
      previewVaultImport(result, [
        vaultSummary({ ...older, id: "different-local-id", followers: [] }),
      ]),
    ).toEqual({ added: [validateVaultSnapshot(newer)], skipped: 1 });
    expect(parseVaultBackup(serializeVaultBackup([])).snapshots).toEqual([]);
  });
  it("rejects malformed, wrong-version, ambiguous, unknown-field and oversized backups", () => {
    expect(() => parseVaultBackup("{broken")).toThrow(/JSON/);
    for (const value of [
      {},
      [],
      { ...backup(), version: 2 },
      { ...backup(), format: "instagram" },
      { ...backup(), private: [] },
      backup([older, older]),
      backup([older, { ...newer, id: older.id }]),
      backup([older, { ...newer, exportDate: older.exportDate }]),
      backup([null]),
    ])
      expect(() => validateVaultBackup(value)).toThrow();
    expect(() =>
      validateVaultBackup(backup(Array(MAX_BACKUP_SNAPSHOTS + 1).fill(older))),
    ).toThrow(/too many snapshots/);
    expect(() => parseVaultBackup(" ".repeat(MAX_BACKUP_BYTES + 1))).toThrow(
      /32 MB/,
    );
  });
  it("fails safely when IndexedDB or storage access is unavailable", async () => {
    const store = new SnapshotVaultStorage(
      () => undefined,
      () => {
        throw new DOMException("private details", "SecurityError");
      },
    );
    await expect(store.list()).rejects.toThrow(/unavailable/);
    await expect(store.initialize()).rejects.toThrow(/unavailable/);
    expect(
      vaultStorageMessage(new DOMException("private", "QuotaExceededError")),
    ).toMatch(/full.*No older snapshots were removed/);
    expect(
      vaultStorageMessage(new Error("sensitive internal text")),
    ).not.toContain("sensitive");
    expect(
      vaultStorageMessage(new VaultStorageError("Safe user message")),
    ).toBe("Safe user message");
  });
  it("reports a blocked database open without waiting indefinitely", async () => {
    const factory = {
      open() {
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() =>
          request.onblocked?.call(request, {} as IDBVersionChangeEvent),
        );
        return request;
      },
    } as unknown as IDBFactory;
    await expect(
      new SnapshotVaultStorage(() => factory).list(),
    ).rejects.toThrow(/blocked by another tab/);
  });
});
