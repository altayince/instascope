import { deduplicate, account, normalizeUsername } from "./instagram/normalize";
import type { Dataset } from "./instagram/types";

export const SNAPSHOT_KEY = "instascope:relationship-snapshot:v1";
const MAX_SNAPSHOT_LENGTH = 8_000_000;
export type SavedSnapshot = {
  version: 1;
  exportDate: string;
  followers: string[];
  following: string[];
};
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function validExportDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

export function createSavedSnapshot(
  dataset: Dataset,
  exportDate: string,
): SavedSnapshot {
  if (!validExportDate(exportDate))
    throw new Error("Enter a valid date for this export.");
  if (dataset.metadata.demo)
    throw new Error("Fictional demo data cannot be saved as your snapshot.");
  return {
    version: 1,
    exportDate,
    followers: deduplicate(dataset.followers).map((entry) => entry.username),
    following: deduplicate(dataset.following).map((entry) => entry.username),
  };
}

function validSavedSnapshot(value: unknown): value is SavedSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.exportDate !== "string" ||
    !validExportDate(record.exportDate) ||
    !Array.isArray(record.followers) ||
    !Array.isArray(record.following) ||
    record.followers.length > 500_000 ||
    record.following.length > 500_000
  )
    return false;
  return [record.followers, record.following].every(
    (list) =>
      list.every(
        (name) => typeof name === "string" && normalizeUsername(name) === name,
      ) && new Set(list).size === list.length,
  );
}

export function readSavedSnapshot(storage: StorageLike): SavedSnapshot | null {
  const raw = storage.getItem(SNAPSHOT_KEY);
  if (!raw || raw.length > MAX_SNAPSHOT_LENGTH) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validSavedSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSavedSnapshot(
  storage: StorageLike,
  dataset: Dataset,
  exportDate: string,
): SavedSnapshot {
  const saved = createSavedSnapshot(dataset, exportDate);
  const serialized = JSON.stringify(saved);
  if (serialized.length > MAX_SNAPSHOT_LENGTH)
    throw new Error("This snapshot is too large for browser storage.");
  storage.setItem(SNAPSHOT_KEY, serialized);
  return saved;
}

export function deleteSavedSnapshot(storage: StorageLike) {
  storage.removeItem(SNAPSHOT_KEY);
}

export function restoreSavedSnapshot(saved: SavedSnapshot): Dataset {
  return {
    followers: saved.followers.map((name) => account(name)!),
    following: saved.following.map((name) => account(name)!),
    metadata: {
      parsedAt: Date.parse(`${saved.exportDate}T00:00:00Z`),
      sourceFormat: "saved-local-snapshot",
      snapshotLabel: `Saved local snapshot · ${saved.exportDate}`,
      warnings: [],
    },
  };
}
