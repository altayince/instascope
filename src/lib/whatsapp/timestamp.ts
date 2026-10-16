import { WhatsAppImportError } from "./errors";
import type { WhatsAppFormat, WhatsAppTimestamp } from "./types";

const pad = (value: number) => String(value).padStart(2, "0");

export function parseWhatsAppTimestamp(
  date: string,
  clock: string,
  format: WhatsAppFormat,
): WhatsAppTimestamp {
  const dateMatch =
    format.dateOrder === "ymd"
      ? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date)
      : /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(date);
  const clockMatch =
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[ \u00a0\u202f]+(AM|PM))?$/i.exec(clock);
  if (
    !dateMatch ||
    !clockMatch ||
    (format.timeConvention === "12h") !== Boolean(clockMatch[4])
  )
    throw new WhatsAppImportError(
      "format",
      "The timestamps do not match the selected format. Choose the matching date order and clock. Slash dates support two- or four-digit years; year-first dates require four digits. Only English AM/PM is supported.",
    );
  const parts = dateMatch.slice(1).map(Number);
  const [sourceYear, month, day] =
    format.dateOrder === "ymd"
      ? parts
      : format.dateOrder === "dmy"
        ? [parts[2], parts[1], parts[0]]
        : [parts[2], parts[0], parts[1]];
  const sourceYearWidth = (
    format.dateOrder === "ymd" ? dateMatch[1] : dateMatch[3]
  ).length as 2 | 4;
  // The verified recent slash format has YY. Never use a moving century pivot.
  const year = sourceYearWidth === 2 ? 2000 + sourceYear : sourceYear;
  let hour = Number(clockMatch[1]);
  const minute = Number(clockMatch[2]),
    second = Number(clockMatch[3] ?? 0);
  if (format.timeConvention === "12h") {
    if (hour < 1 || hour > 12) throw invalidTimestamp();
    hour = (hour % 12) + (clockMatch[4].toUpperCase() === "PM" ? 12 : 0);
  }
  if (
    year < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    throw invalidTimestamp();
  const numeric = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );
  if (
    numeric.getUTCFullYear() !== year ||
    numeric.getUTCMonth() !== month - 1 ||
    numeric.getUTCDate() !== day
  )
    throw invalidTimestamp();
  const calendarDate = `${year}-${pad(month)}-${pad(day)}`;
  const precision = clockMatch[3] === undefined ? "minute" : "second";
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    precision,
    sourceYearWidth,
    date: calendarDate,
    local: `${calendarDate}T${pad(hour)}:${pad(minute)}${precision === "second" ? `:${pad(second)}` : ""}`,
  };
}

const invalidTimestamp = () =>
  new WhatsAppImportError(
    "timestamp",
    "This chat contains an invalid calendar date or clock value. Check the selected format or export the chat again.",
  );

/** UTC arithmetic is only a device-timezone-independent representation of calendar fields. */
export const wallClockValue = (timestamp: WhatsAppTimestamp) =>
  Date.UTC(
    timestamp.year,
    timestamp.month - 1,
    timestamp.day,
    timestamp.hour,
    timestamp.minute,
    timestamp.second,
  );
export const calendarDayValue = (timestamp: WhatsAppTimestamp) =>
  Date.UTC(timestamp.year, timestamp.month - 1, timestamp.day);
