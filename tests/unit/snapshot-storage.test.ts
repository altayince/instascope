import { describe, expect, it } from "vitest";
import { account } from "../../src/lib/instagram/normalize";
import type { Dataset } from "../../src/lib/instagram/types";
import { compareSnapshots } from "../../src/lib/analysis/relationships";
import {
  SNAPSHOT_KEY,
  createSavedSnapshot,
  deleteSavedSnapshot,
  readSavedSnapshot,
  restoreSavedSnapshot,
  validExportDate,
  writeSavedSnapshot,
} from "../../src/lib/snapshot-storage";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}
const dataset: Dataset = {
  followers: [account("alice", 1704067200)!, account("bob")!],
  following: [account("alice", 1704067200)!, account("private.follow")!],
  connections: {
    pendingRequests: {
      status: "available",
      accounts: [account("private.request")!],
    },
  } as Dataset["connections"],
  metadata: {
    parsedAt: Date.now(),
    sourceFormat: "zip",
    warnings: ["private warning"],
  },
};

describe("browser-local relationship snapshots", () => {
  it("stores only usernames and an owner-entered export date", () => {
    const storage = memoryStorage();
    const saved = writeSavedSnapshot(storage, dataset, "2025-01-15");
    expect(saved).toEqual({
      version: 1,
      exportDate: "2025-01-15",
      followers: ["alice", "bob"],
      following: ["alice", "private.follow"],
    });
    const raw = storage.getItem(SNAPSHOT_KEY)!;
    expect(raw).not.toMatch(
      /private\.request|private warning|1704067200|href|zip/,
    );
    expect(readSavedSnapshot(storage)).toEqual(saved);
  });

  it("restores only the lists needed for comparison and supports deletion", () => {
    const storage = memoryStorage();
    const saved = writeSavedSnapshot(storage, dataset, "2025-01-15");
    const restored = restoreSavedSnapshot(saved);
    expect(restored.connections).toBeUndefined();
    expect(restored.following[0].timestamp).toBeUndefined();
    expect(restored.metadata.snapshotLabel).toContain("2025-01-15");
    const newer: Dataset = {
      ...dataset,
      followers: [account("alice")!, account("new")!],
      following: [account("alice")!],
    };
    expect(compareSnapshots(restored, newer).lostFollowers).toEqual([
      account("bob")!,
    ]);
    deleteSavedSnapshot(storage);
    expect(readSavedSnapshot(storage)).toBeNull();
  });

  it("rejects missing, impossible, corrupt and fictional snapshots", () => {
    expect(validExportDate("2025-02-30")).toBe(false);
    expect(validExportDate("2025-02-28")).toBe(true);
    expect(() => createSavedSnapshot(dataset, "2025-02-30")).toThrow(
      /valid date/,
    );
    expect(() =>
      createSavedSnapshot(
        { ...dataset, metadata: { ...dataset.metadata, demo: true } },
        "2025-01-15",
      ),
    ).toThrow(/Fictional demo/);
    const storage = memoryStorage();
    storage.setItem(SNAPSHOT_KEY, "not json");
    expect(readSavedSnapshot(storage)).toBeNull();
    storage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        version: 2,
        exportDate: "2025-01-15",
        followers: ["alice"],
        following: [],
      }),
    );
    expect(readSavedSnapshot(storage)).toBeNull();
    storage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        version: 1,
        exportDate: "2025-01-15",
        followers: ["alice", "alice"],
        following: [],
      }),
    );
    expect(readSavedSnapshot(storage)).toBeNull();
  });
});
