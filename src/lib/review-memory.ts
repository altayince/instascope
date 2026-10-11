import { normalizeUsername } from "./instagram/normalize";

export type ReviewMemoryRecord = {
  username: string;
  keep: boolean;
  reviewed: boolean;
  watch: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewMemoryPatch = Partial<
  Pick<ReviewMemoryRecord, "keep" | "reviewed" | "watch" | "note">
>;

export type ReviewMemoryBackup = {
  format: "instascope-review-memory";
  version: 1;
  records: ReviewMemoryRecord[];
};

export const MAX_REVIEW_NOTE_LENGTH = 500;
export const MAX_REVIEW_MEMORY_RECORDS = 10_000;
export const MAX_REVIEW_MEMORY_BACKUP_BYTES = 16 * 1024 * 1024;
export const MAX_REVIEW_BACKUP_BYTES = MAX_REVIEW_MEMORY_BACKUP_BYTES;

const recordFields = [
  "username",
  "keep",
  "reviewed",
  "watch",
  "createdAt",
  "updatedAt",
];
const patchFields = ["keep", "reviewed", "watch", "note"];

function hasFields(
  value: unknown,
  required: string[],
  optional: string[] = [],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every(
      (key) => required.includes(key) || optional.includes(key),
    )
  );
}

function identity(value: unknown): string {
  const username = normalizeUsername(value);
  if (!username) throw new Error("Choose a valid Instagram username.");
  return username;
}

function timestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  )
    throw new Error("Review Memory dates must be valid ISO UTC timestamps.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Review Memory dates must be valid ISO UTC timestamps.");
  const canonical = date.toISOString();
  if (canonical !== value && canonical.replace(/\.000Z$/, "Z") !== value)
    throw new Error("Review Memory dates must be valid ISO UTC timestamps.");
  return canonical;
}

function note(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_REVIEW_NOTE_LENGTH)
    throw new Error("Private notes must be 500 characters or shorter.");
  return value;
}

export function validateReviewMemoryRecord(value: unknown): ReviewMemoryRecord {
  if (
    !hasFields(value, recordFields, ["note"]) ||
    typeof value.keep !== "boolean" ||
    typeof value.reviewed !== "boolean" ||
    typeof value.watch !== "boolean"
  )
    throw new Error("Invalid or unsupported Review Memory record.");
  const username = identity(value.username);
  const createdAt = timestamp(value.createdAt);
  const updatedAt = timestamp(value.updatedAt);
  if (updatedAt < createdAt)
    throw new Error("A Review Memory update cannot predate its creation.");
  const privateNote = Object.hasOwn(value, "note") ? note(value.note) : "";
  return {
    username,
    keep: value.keep,
    reviewed: value.reviewed,
    watch: value.watch,
    ...(privateNote ? { note: privateNote } : {}),
    createdAt,
    updatedAt,
  };
}

// Shared by persistent real records and isolated, in-memory fictional records.
// Flags remain manual decisions; dates describe edits to Review Memory only.
export function updateReviewMemoryRecord(
  previous: ReviewMemoryRecord | null,
  username: string,
  patch: ReviewMemoryPatch,
  now = new Date().toISOString(),
): ReviewMemoryRecord {
  const normalized = identity(username);
  const existing = previous ? validateReviewMemoryRecord(previous) : null;
  if (existing && existing.username !== normalized)
    throw new Error("Review Memory belongs to a different account.");
  if (!hasFields(patch, [], patchFields))
    throw new Error("Only review flags and the private note can be changed.");
  for (const key of ["keep", "reviewed", "watch"] as const)
    if (Object.hasOwn(patch, key) && typeof patch[key] !== "boolean")
      throw new Error("Review flags must be true or false.");
  if (Object.hasOwn(patch, "note")) note(patch.note);
  const editedAt = timestamp(now);
  return validateReviewMemoryRecord({
    username: normalized,
    keep: existing?.keep ?? false,
    reviewed: existing?.reviewed ?? false,
    watch: existing?.watch ?? false,
    ...(existing?.note ? { note: existing.note } : {}),
    ...patch,
    createdAt: existing?.createdAt ?? editedAt,
    updatedAt:
      existing && existing.updatedAt > editedAt ? existing.updatedAt : editedAt,
  });
}

export function validateReviewMemoryBackup(value: unknown): ReviewMemoryBackup {
  if (
    !hasFields(value, ["format", "version", "records"]) ||
    value.format !== "instascope-review-memory" ||
    value.version !== 1 ||
    !Array.isArray(value.records)
  )
    throw new Error(
      "Choose an InstaScope Review Memory V1 backup, not a Vault backup or Instagram export.",
    );
  if (value.records.length > MAX_REVIEW_MEMORY_RECORDS)
    throw new Error("Import at most 10,000 Review Memory records at a time.");
  const usernames = new Set<string>();
  const records: ReviewMemoryRecord[] = [];
  for (const entry of value.records) {
    const record = validateReviewMemoryRecord(entry);
    if (usernames.has(record.username))
      throw new Error("The backup contains duplicate normalized usernames.");
    usernames.add(record.username);
    records.push(record);
  }
  records.sort((a, b) => a.username.localeCompare(b.username));
  const backup: ReviewMemoryBackup = {
    format: "instascope-review-memory",
    version: 1,
    records,
  };
  if (
    new TextEncoder().encode(JSON.stringify(backup)).byteLength >
    MAX_REVIEW_MEMORY_BACKUP_BYTES
  )
    throw new Error("Review Memory backups must be 16 MB or smaller.");
  return backup;
}

export function parseReviewMemoryBackup(raw: string): ReviewMemoryBackup {
  if (
    typeof raw !== "string" ||
    raw.length > MAX_REVIEW_MEMORY_BACKUP_BYTES ||
    new TextEncoder().encode(raw).byteLength > MAX_REVIEW_MEMORY_BACKUP_BYTES
  )
    throw new Error("Review Memory backups must be 16 MB or smaller.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Choose a valid JSON Review Memory backup.");
  }
  return validateReviewMemoryBackup(value);
}

export function serializeReviewMemoryBackup(
  records: ReviewMemoryRecord[],
): string {
  return JSON.stringify(
    validateReviewMemoryBackup({
      format: "instascope-review-memory",
      version: 1,
      records,
    }),
  );
}
