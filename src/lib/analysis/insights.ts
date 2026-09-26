import type { Account, Dataset } from "../instagram/types";

const DAY = 86_400_000;
export function utcDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}
export function requestAge(
  timestamp: number | undefined,
  referenceDate: string,
): number | null {
  if (timestamp === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate))
    return null;
  const reference = Date.parse(`${referenceDate}T00:00:00Z`);
  if (
    !Number.isFinite(reference) ||
    new Date(reference).toISOString().slice(0, 10) !== referenceDate
  )
    return null;
  const recorded = Date.parse(`${utcDate(timestamp)}T00:00:00Z`);
  return recorded > reference ? null : Math.round((reference - recorded) / DAY);
}
export type AgeFilter = "all" | "30" | "90" | "365" | "unknown";
export function filterRequests(
  accounts: Account[],
  referenceDate: string,
  filter: AgeFilter,
) {
  return accounts.filter((entry) => {
    const age = requestAge(entry.timestamp, referenceDate);
    return (
      filter === "all" ||
      (filter === "unknown"
        ? age === null
        : age !== null && age >= Number(filter))
    );
  });
}
export type TimelinePeriod = {
  period: string;
  followers: number;
  following: number;
};
export function relationshipTimeline(
  dataset: Pick<Dataset, "followers" | "following">,
  granularity: "year" | "month" = "year",
) {
  const periods = new Map<string, TimelinePeriod>();
  const coverage = { followers: 0, following: 0 };
  let earliest: number | undefined, latest: number | undefined;
  for (const kind of ["followers", "following"] as const) {
    for (const entry of dataset[kind]) {
      if (entry.timestamp === undefined) continue;
      coverage[kind]++;
      if (kind === "following") {
        earliest = Math.min(earliest ?? entry.timestamp, entry.timestamp);
        latest = Math.max(latest ?? entry.timestamp, entry.timestamp);
      }
      const key = utcDate(entry.timestamp).slice(
        0,
        granularity === "year" ? 4 : 7,
      );
      const period = periods.get(key) ?? {
        period: key,
        followers: 0,
        following: 0,
      };
      period[kind]++;
      periods.set(key, period);
    }
  }
  const sorted = [...periods.values()].sort((a, b) =>
    a.period.localeCompare(b.period),
  );
  const busiest = sorted
    .filter((p) => p.following > 0)
    .reduce<TimelinePeriod | null>(
      (best, p) => (!best || p.following > best.following ? p : best),
      null,
    );
  return { periods: sorted, coverage, earliest, latest, busiest };
}
export function timelineCardStats(
  dataset: Pick<Dataset, "followers" | "following">,
): [string, string | number][] {
  const timeline = relationshipTimeline(dataset);
  return [
    ["Dated follows in this export", timeline.coverage.following],
    [
      "Following dates missing",
      dataset.following.length - timeline.coverage.following,
    ],
    [
      "Earliest following date",
      timeline.earliest === undefined
        ? "Unavailable"
        : utcDate(timeline.earliest),
    ],
    [
      "Latest following date",
      timeline.latest === undefined ? "Unavailable" : utcDate(timeline.latest),
    ],
    ["Top year among dated follows", timeline.busiest?.period ?? "Unavailable"],
    [
      "Dated follows in that year",
      timeline.busiest?.following ?? "Unavailable",
    ],
  ];
}
