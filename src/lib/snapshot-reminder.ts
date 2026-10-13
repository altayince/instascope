import { validExportDate } from "./snapshot-storage";

export type SnapshotReminder = {
  eventDate: string;
  basisDate: string;
  basis: "export-date" | "save-date";
  generatedAt: number;
  uid: string;
};

const EVENT_TITLE = "Export fresh Instagram data and return to InstaScope";
const EVENT_DESCRIPTION =
  "Export fresh Instagram data, then return to InstaScope to save a new snapshot and compare changes.\n" +
  "Open https://instascope.me/snapshot-vault/.\n" +
  "This is a calendar event only. InstaScope sends no notification; choose any alert in your calendar.";

function validCalendarDate(value: string) {
  return validExportDate(value) && value.slice(0, 4) !== "0000";
}

/** Work with calendar days in UTC, without changing the user's all-day date. */
export function addCalendarDays(value: string, days: number): string {
  if (!validCalendarDate(value) || !Number.isSafeInteger(days))
    throw new Error("Enter a valid calendar date and day interval.");
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1 ||
    date.getUTCFullYear() > 9999
  )
    throw new Error(
      "The reminder date is outside the supported calendar range.",
    );
  return date.toISOString().slice(0, 10);
}

function creationDate(timestamp: number) {
  const date = new Date(timestamp);
  if (
    !Number.isSafeInteger(timestamp) ||
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() < 1 ||
    date.getFullYear() > 9999 ||
    date.getUTCFullYear() < 1 ||
    date.getUTCFullYear() > 9999
  )
    throw new Error("Enter a valid reminder creation time.");
  return date;
}

/** Accept only the export date and actual save time, never snapshot data or IDs. */
export function createSnapshotReminder(
  exportDate: string,
  savedAt = Date.now(),
): SnapshotReminder {
  const saved = creationDate(savedAt);
  const saveDate = [
    saved.getFullYear().toString().padStart(4, "0"),
    (saved.getMonth() + 1).toString().padStart(2, "0"),
    saved.getDate().toString().padStart(2, "0"),
  ].join("-");
  let basis: SnapshotReminder["basis"] = "save-date";
  let basisDate = saveDate;
  let eventDate = addCalendarDays(saveDate, 30);
  if (validCalendarDate(exportDate) && exportDate <= saveDate) {
    const candidate = addCalendarDays(exportDate, 30);
    if (candidate > saveDate) {
      basis = "export-date";
      basisDate = exportDate;
      eventDate = candidate;
    }
  }
  // DTEND must also fit the four-digit calendar year range.
  addCalendarDays(eventDate, 1);
  return {
    eventDate,
    basisDate,
    basis,
    generatedAt: savedAt,
    // RFC 5545 requires a unique calendar event identifier. This random value
    // belongs only to this offer and its downloaded event, and is reused for
    // repeated downloads of that offer. It never identifies a user/snapshot,
    // enters browser storage, or becomes an analytics identifier.
    uid: `${crypto.randomUUID()}@instascope.me`,
  };
}

export function escapeCalendarText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** RFC 5545 content lines are at most 75 UTF-8 octets, including fold spaces. */
export function foldCalendarLine(value: string) {
  if (/[\r\n]/.test(value))
    throw new Error("Calendar content lines cannot contain raw line breaks.");
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let line = "";
  let bytes = 0;
  for (const character of value) {
    const size = encoder.encode(character).byteLength;
    if (bytes + size > 75) {
      lines.push(line);
      line = " ";
      bytes = 1;
    }
    line += character;
    bytes += size;
  }
  lines.push(line);
  return lines.join("\r\n");
}

export function serializeSnapshotReminder(reminder: SnapshotReminder): string {
  if (
    !validCalendarDate(reminder.eventDate) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@instascope\.me$/i.test(
      reminder.uid,
    )
  )
    throw new Error(
      "This calendar reminder is invalid. Save a snapshot again.",
    );
  const stamp = creationDate(reminder.generatedAt)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const endDate = addCalendarDays(reminder.eventDate, 1);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//InstaScope//Next Snapshot Reminder//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${reminder.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${reminder.eventDate.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${endDate.replace(/-/g, "")}`,
      `SUMMARY:${escapeCalendarText(EVENT_TITLE)}`,
      `DESCRIPTION:${escapeCalendarText(EVENT_DESCRIPTION)}`,
      "URL:https://instascope.me/snapshot-vault/",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(foldCalendarLine)
      .join("\r\n") + "\r\n"
  );
}
