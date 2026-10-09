import type { Dataset, TimestampPrecision } from "../instagram/types";
import { analyze } from "./relationships";
import { utcDate } from "./insights";
export type MutualOrigin =
  "they-first" | "you-first" | "same-recorded-day" | "unknown";
export type MutualOriginRecord = {
  username: string;
  followerTimestamp?: number;
  followingTimestamp?: number;
  followerPrecision?: TimestampPrecision;
  followingPrecision?: TimestampPrecision;
  origin: MutualOrigin;
  dayGap?: number;
};
export const mutualOriginLabels: Record<MutualOrigin, string> = {
  "they-first": "They followed first",
  "you-first": "You followed first",
  "same-recorded-day": "Same recorded day",
  unknown: "Date unavailable",
};
export const MUTUAL_ORIGIN_CAVEAT =
  "Based on recorded dates, not a guaranteed first-ever follow. Recorded dates do not prove uninterrupted following and may reflect refollows. HTML dates have no timezone; only recorded calendar days are compared.";
export const MIN_ORIGIN_STORY_MUTUALS = 10;
export function mutualOrigins(
  dataset: Pick<Dataset, "followers" | "following">,
): MutualOriginRecord[] {
  const normalized = analyze(dataset);
  const followers = new Map(normalized.followers.map((a) => [a.username, a]));
  return normalized.mutuals.map((following) => {
    const follower = followers.get(following.username)!;
    const followerTimestamp = follower.timestamp,
      followingTimestamp = following.timestamp;
    const first =
      followerTimestamp === undefined ? undefined : utcDate(followerTimestamp);
    const second =
      followingTimestamp === undefined
        ? undefined
        : utcDate(followingTimestamp);
    const origin: MutualOrigin =
      !first || !second
        ? "unknown"
        : first === second
          ? "same-recorded-day"
          : first < second
            ? "they-first"
            : "you-first";
    const exact = !follower.timestampPrecision && !following.timestampPrecision;
    return {
      username: following.username,
      followerTimestamp,
      followingTimestamp,
      followerPrecision: follower.timestampPrecision,
      followingPrecision: following.timestampPrecision,
      origin,
      ...(exact && origin !== "unknown" && origin !== "same-recorded-day"
        ? {
            dayGap: Math.floor(
              Math.abs(followerTimestamp! - followingTimestamp!) / 86400,
            ),
          }
        : {}),
    };
  });
}
export function mutualOriginSummary(records: readonly MutualOriginRecord[]) {
  const counts: Record<MutualOrigin, number> = {
    "they-first": 0,
    "you-first": 0,
    "same-recorded-day": 0,
    unknown: 0,
  };
  for (const record of records) counts[record.origin]++;
  const dated = records.length - counts.unknown;
  return {
    counts,
    dated,
    theyFirstPercent: dated
      ? Math.round((counts["they-first"] / dated) * 100)
      : null,
  };
}
