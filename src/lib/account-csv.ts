import type { Account } from "./instagram/types";
import { usableInstagramProfileHref } from "./instagram/normalize";

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function recordedDate(entry: Account): string {
  if (entry.timestamp === undefined || !Number.isFinite(entry.timestamp))
    return "";
  const date = new Date(entry.timestamp * 1000);
  if (!Number.isFinite(date.getTime())) return "";
  // Export calendar dates, matching the list UI. For timezone-less HTML records,
  // UTC storage preserves the supplied calendar fields; it is not a UTC instant.
  // Date-only values therefore never add a timezone or invent missing precision.
  return date.toISOString().slice(0, 10);
}

/** Only the public account fields belong in a list download. */
export function accountCsv(accounts: readonly Account[], demo = false): string {
  return [
    "username,profile_url,recorded_date",
    ...accounts.map((entry) =>
      [
        entry.username,
        demo ? "" : (usableInstagramProfileHref(entry) ?? ""),
        recordedDate(entry),
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");
}
