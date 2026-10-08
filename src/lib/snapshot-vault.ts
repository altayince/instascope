import type { Dataset } from "./instagram/types";
import { normalizeUsername } from "./instagram/normalize";
import {
  createSavedSnapshot,
  restoreSavedSnapshot,
  validExportDate,
} from "./snapshot-storage";
import { compareSnapshots } from "./analysis/relationships";

export type VaultSnapshot = {
  id: string;
  version: 1;
  exportDate: string;
  createdAt: number;
  followers: string[];
  following: string[];
};
export type VaultSummary = Pick<
  VaultSnapshot,
  "id" | "exportDate" | "createdAt"
> & {
  followersCount: number;
  followingCount: number;
};
export type VaultBackup = {
  format: "instascope-snapshot-vault";
  version: 1;
  snapshots: VaultSnapshot[];
};
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
export const MAX_BACKUP_SNAPSHOTS = 1000;
export const MAX_BACKUP_USERNAMES = 1_000_000;

function exactFields(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function usernames(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 500_000)
    throw new Error("Invalid snapshot usernames.");
  const names = new Set<string>();
  for (const name of value) {
    if (typeof name !== "string" || !/^@?[a-z0-9._]{1,30}$/i.test(name.trim()))
      throw new Error("Invalid snapshot usernames.");
    const normalized = normalizeUsername(name);
    if (!normalized) throw new Error("Invalid snapshot usernames.");
    names.add(normalized);
  }
  return [...names].sort();
}
export function validateVaultSnapshot(value: unknown): VaultSnapshot {
  if (
    !exactFields(value, [
      "id",
      "version",
      "exportDate",
      "createdAt",
      "followers",
      "following",
    ]) ||
    value.version !== 1 ||
    typeof value.id !== "string" ||
    !/^[a-z0-9][a-z0-9:_-]{0,79}$/i.test(value.id) ||
    typeof value.exportDate !== "string" ||
    !validExportDate(value.exportDate) ||
    typeof value.createdAt !== "number" ||
    !Number.isSafeInteger(value.createdAt) ||
    value.createdAt < 0 ||
    !Number.isFinite(new Date(value.createdAt).getTime())
  )
    throw new Error("Invalid or unsupported Vault snapshot.");
  return {
    id: value.id,
    version: 1,
    exportDate: value.exportDate,
    createdAt: value.createdAt,
    followers: usernames(value.followers),
    following: usernames(value.following),
  };
}
export function createVaultSnapshot(
  dataset: Dataset,
  exportDate: string,
  id: string = crypto.randomUUID(),
  createdAt = Date.now(),
): VaultSnapshot {
  return validateVaultSnapshot({
    ...createSavedSnapshot(dataset, exportDate),
    id,
    createdAt,
  });
}
export function vaultSummary(snapshot: VaultSnapshot): VaultSummary {
  return {
    id: snapshot.id,
    exportDate: snapshot.exportDate,
    createdAt: snapshot.createdAt,
    followersCount: snapshot.followers.length,
    followingCount: snapshot.following.length,
  };
}
export function newestSnapshots<T extends { exportDate: string }>(
  snapshots: T[],
): T[] {
  return [...snapshots].sort((a, b) =>
    b.exportDate.localeCompare(a.exportDate),
  );
}
export function formatSnapshotDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
export function vaultComparisonError(
  older: VaultSummary,
  newer: VaultSummary,
  confirmed: boolean,
): string | null {
  if (older.id === newer.id) return "Choose two different saved snapshots.";
  if (
    !validExportDate(older.exportDate) ||
    !validExportDate(newer.exportDate) ||
    older.exportDate >= newer.exportDate
  )
    return "The older export date must be earlier than the newer export date.";
  if (!confirmed)
    return "Confirm both exports are from the same Instagram account.";
  return null;
}
export function compareVaultSnapshots(
  older: VaultSnapshot,
  newer: VaultSnapshot,
  confirmed: boolean,
) {
  const first = validateVaultSnapshot(older),
    second = validateVaultSnapshot(newer);
  const error = vaultComparisonError(
    vaultSummary(first),
    vaultSummary(second),
    confirmed,
  );
  if (error) throw new Error(error);
  return compareSnapshots(
    restoreSavedSnapshot(first),
    restoreSavedSnapshot(second),
  );
}
export function validateVaultBackup(value: unknown): VaultBackup {
  if (
    !exactFields(value, ["format", "version", "snapshots"]) ||
    value.format !== "instascope-snapshot-vault" ||
    value.version !== 1 ||
    !Array.isArray(value.snapshots)
  )
    throw new Error(
      "Choose a valid InstaScope Vault V1 backup, not an Instagram export.",
    );
  if (value.snapshots.length > MAX_BACKUP_SNAPSHOTS)
    throw new Error(
      "This backup has too many snapshots for one import. Import at most 1,000 at a time.",
    );
  const ids = new Set<string>(),
    dates = new Set<string>();
  let count = 0;
  const snapshots = value.snapshots.map((value) => {
    const snapshot = validateVaultSnapshot(value);
    if (ids.has(snapshot.id) || dates.has(snapshot.exportDate))
      throw new Error(
        "The backup contains duplicate snapshot IDs or export dates.",
      );
    ids.add(snapshot.id);
    dates.add(snapshot.exportDate);
    count += snapshot.followers.length + snapshot.following.length;
    if (count > MAX_BACKUP_USERNAMES)
      throw new Error(
        "This backup contains too many usernames for one import.",
      );
    return snapshot;
  });
  return {
    format: "instascope-snapshot-vault",
    version: 1,
    snapshots: newestSnapshots(snapshots),
  };
}
export function parseVaultBackup(raw: string): VaultBackup {
  if (
    raw.length > MAX_BACKUP_BYTES ||
    new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES
  )
    throw new Error("Vault backups must be 32 MB or smaller.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose an InstaScope Vault backup.",
    );
  }
  return validateVaultBackup(value);
}
export function serializeVaultBackup(snapshots: VaultSnapshot[]): string {
  const backup = validateVaultBackup({
    format: "instascope-snapshot-vault",
    version: 1,
    snapshots,
  });
  const raw = JSON.stringify(backup);
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error(
      "This Vault exceeds the 32 MB V1 backup limit. Your saved snapshots have not been changed.",
    );
  return raw;
}
export function previewVaultImport(
  backup: VaultBackup,
  existing: VaultSummary[],
) {
  const dates = new Set(existing.map((snapshot) => snapshot.exportDate));
  const added = backup.snapshots.filter(
    (snapshot) => !dates.has(snapshot.exportDate),
  );
  return { added, skipped: backup.snapshots.length - added.length };
}
