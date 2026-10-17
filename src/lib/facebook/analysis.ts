import type { FacebookConnection } from "./types";

export function connectionDate(record: FacebookConnection, timeZone = "UTC") {
  if (record.timestamp === undefined) return record.recordedDate;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(record.timestamp * 1000));
  const field = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${field("year")}-${field("month")}-${field("day")}T${field("hour")}:${field("minute")}:${field("second")}`;
}
export function exploreConnections(
  records: readonly FacebookConnection[],
  query: string,
  sort: "newest" | "oldest" | "name",
  timeZone = "UTC",
) {
  const needle = query.trim().normalize("NFC").toLocaleLowerCase();
  return records
    .filter((record) =>
      record.name.normalize("NFC").toLocaleLowerCase().includes(needle),
    )
    .map((record) => ({
      ...record,
      displayDate: connectionDate(record, timeZone),
    }))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name) || a.row - b.row;
      if (!a.displayDate || !b.displayDate)
        return a.displayDate ? -1 : b.displayDate ? 1 : a.row - b.row;
      return (
        (sort === "newest" ? -1 : 1) *
          a.displayDate.localeCompare(b.displayDate) || a.row - b.row
      );
    });
}
