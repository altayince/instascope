import { restoreSavedSnapshot } from "../snapshot-storage";
import { compareSnapshots } from "./relationships";
import {
  relationshipState,
  type RelationshipHistoryIndex,
  type RelationshipHistoryPoint,
  type RelationshipState,
} from "./relationship-history";

export type CircleAbsentInterval = {
  firstAbsentDate: string;
  lastAbsentDate: string;
  previousPresentDate?: string;
  nextPresentDate?: string;
};
export type CircleAccountSummary = {
  snapshotCount: number;
  observedSnapshots: number;
  observedFollowerSnapshots: number;
  observedFollowingSnapshots: number;
  stableState?: RelationshipState;
  stateChanges?: number;
  reappeared?: boolean;
  firstPresent?: string;
  latestPresent?: string;
  latestState: RelationshipState;
  absentIntervals: readonly CircleAbsentInterval[];
};
export type CircleRetention = {
  retained: number;
  total: number;
  // Exact endpoint percentage, not a continuous-presence measurement.
  percentage?: number;
};
export type CirclePulseSummary = {
  snapshotCount: number;
  skippedSnapshots: number;
  firstDate?: string;
  latestDate?: string;
  stableFollowers: number;
  stableFollowing: number;
  stableMutuals: number;
  changedAccounts?: number;
  reappearedAccounts?: number;
  followerRetention?: CircleRetention;
  followingRetention?: CircleRetention;
  latestInterval?: {
    olderDate: string;
    newerDate: string;
    newFollowers: number;
    missingFollowers: number;
    newFollowing: number;
    missingFollowing: number;
    newMutuals: number;
    missingMutuals: number;
    stateChanges: number;
  };
};
export type CirclePulseRange = { startId: string; endId: string };
export type CirclePulseAccount = CircleAccountSummary & { username: string };
export type CirclePulseResult = {
  index: RelationshipHistoryIndex;
  summary: CirclePulseSummary;
  accounts: ReadonlyMap<string, CirclePulseAccount>;
};

type Accumulator = {
  observed: number;
  followers: number;
  following: number;
  firstIndex: number;
  lastIndex: number;
  firstState?: RelationshipState;
  lastState: RelationshipState;
  samePresentState: boolean;
  changes: number;
  reappearances: number;
  absent: CircleAbsentInterval[];
};
const accumulator = (): Accumulator => ({
  observed: 0,
  followers: 0,
  following: 0,
  firstIndex: -1,
  lastIndex: -1,
  lastState: "absent",
  samePresentState: true,
  changes: 0,
  reappearances: 0,
  absent: [],
});

// Missing runs are counted once at their boundaries. Never scan the full
// username union for every snapshot just to materialize absent observations.
function observe(
  record: Accumulator,
  position: number,
  state: RelationshipState,
  dates: readonly string[],
) {
  if (!record.observed) {
    record.firstIndex = position;
    record.firstState = state;
    if (position > 0) {
      record.changes++;
      record.absent.push({
        firstAbsentDate: dates[0],
        lastAbsentDate: dates[position - 1],
        nextPresentDate: dates[position],
      });
    }
  } else if (record.lastIndex < position - 1) {
    record.changes += 2; // present -> absent, then absent -> present
    record.reappearances++;
    record.absent.push({
      previousPresentDate: dates[record.lastIndex],
      firstAbsentDate: dates[record.lastIndex + 1],
      lastAbsentDate: dates[position - 1],
      nextPresentDate: dates[position],
    });
  } else if (record.lastState !== state) record.changes++;
  record.samePresentState &&= record.firstState === state;
  record.observed++;
  if (state === "mutual" || state === "follows-you") record.followers++;
  if (state === "mutual" || state === "you-follow") record.following++;
  record.lastIndex = position;
  record.lastState = state;
}

function finish(
  record: Accumulator,
  dates: readonly string[],
): CircleAccountSummary {
  const count = dates.length;
  let changes = record.changes;
  const absent = record.absent;
  if (count && !record.observed)
    absent.push({
      firstAbsentDate: dates[0],
      lastAbsentDate: dates[count - 1],
    });
  else if (record.observed && record.lastIndex < count - 1) {
    changes++;
    absent.push({
      previousPresentDate: dates[record.lastIndex],
      firstAbsentDate: dates[record.lastIndex + 1],
      lastAbsentDate: dates[count - 1],
    });
  }
  return {
    snapshotCount: count,
    observedSnapshots: record.observed,
    observedFollowerSnapshots: record.followers,
    observedFollowingSnapshots: record.following,
    ...(count >= 2 && record.observed === count && record.samePresentState
      ? { stableState: record.firstState }
      : {}),
    ...(count >= 2 ? { stateChanges: changes } : {}),
    ...(count >= 3 ? { reappeared: record.reappearances > 0 } : {}),
    ...(record.observed
      ? {
          firstPresent: dates[record.firstIndex],
          latestPresent: dates[record.lastIndex],
        }
      : {}),
    latestState:
      count && record.lastIndex === count - 1 ? record.lastState : "absent",
    absentIntervals: absent,
  };
}

// Drawer reuse: existing accountHistory points already carry verified state.
// This computes one account's metadata without recomputing all-account Pulse.
export function circleAccountSummary(
  points: readonly RelationshipHistoryPoint[],
): CircleAccountSummary {
  const dates = points.map((point) => point.exportDate);
  const record = accumulator();
  points.forEach((point, position) => {
    if (point.state !== "absent") observe(record, position, point.state, dates);
  });
  return finish(record, dates);
}

function rangePositions(
  history: RelationshipHistoryIndex,
  range: CirclePulseRange,
) {
  const first = history.snapshots.findIndex(
    (point) => point.snapshotId === range.startId,
  );
  const last = history.snapshots.findIndex(
    (point) => point.snapshotId === range.endId,
  );
  if (
    first < 0 ||
    last < 0 ||
    first >= last ||
    history.snapshots[first].exportDate >= history.snapshots[last].exportDate
  )
    throw new Error(
      "Choose at least two readable snapshots in chronological order.",
    );
  return { first, last };
}

// Let range forms reject invalid controls without running aggregate analysis
// once for validation and again when their selected result recomputes.
export function validateCirclePulseRange(
  history: RelationshipHistoryIndex,
  range: CirclePulseRange,
): void {
  rangePositions(history, range);
}

function selectRange(
  history: RelationshipHistoryIndex,
  range?: CirclePulseRange,
): RelationshipHistoryIndex {
  if (!range) return history;
  const { first, last } = rangePositions(history, range);
  const snapshots = history.snapshots.slice(first, last + 1);
  const names = new Set<string>();
  for (const point of snapshots) {
    for (const name of point.followers) names.add(name);
    for (const name of point.following) names.add(name);
  }
  return { ...history, snapshots, names };
}

function retention(older: Set<string>, newer: Set<string>): CircleRetention {
  let retained = 0;
  for (const name of older) if (newer.has(name)) retained++;
  return {
    retained,
    total: older.size,
    ...(older.size ? { percentage: (retained / older.size) * 100 } : {}),
  };
}

function latestInterval(index: RelationshipHistoryIndex) {
  const [older, newer] = index.snapshots.slice(-2);
  const dataset = (point: (typeof index.snapshots)[number]) =>
    restoreSavedSnapshot({
      version: 1,
      exportDate: point.exportDate,
      followers: [...point.followers],
      following: [...point.following],
    });
  const compared = compareSnapshots(dataset(older), dataset(newer));
  // Every state maps to two membership bits. Any changed bit means one
  // adjacent observed state change; usernames changed in both lists count once.
  const changed = new Set<string>();
  for (const records of [
    compared.newFollowers,
    compared.lostFollowers,
    compared.newFollowing,
    compared.removedFollowing,
  ])
    for (const record of records) changed.add(record.username);
  return {
    olderDate: older.exportDate,
    newerDate: newer.exportDate,
    newFollowers: compared.newFollowers.length,
    missingFollowers: compared.lostFollowers.length,
    newFollowing: compared.newFollowing.length,
    missingFollowing: compared.removedFollowing.length,
    newMutuals: compared.newMutuals.length,
    missingMutuals: compared.lostMutuals.length,
    stateChanges: changed.size,
  };
}

export function circlePulse(
  history: RelationshipHistoryIndex,
  range?: CirclePulseRange,
): CirclePulseResult {
  const index = selectRange(history, range);
  const count = index.snapshots.length;
  const dates = index.snapshots.map((point) => point.exportDate);
  const accumulated = new Map<string, Accumulator>();
  index.snapshots.forEach((point, position) => {
    const visit = (name: string, state: RelationshipState) => {
      let record = accumulated.get(name);
      if (!record) {
        record = accumulator();
        accumulated.set(name, record);
      }
      observe(record, position, state, dates);
    };
    for (const name of point.followers)
      visit(name, relationshipState(true, point.following.has(name)));
    for (const name of point.following)
      if (!point.followers.has(name))
        visit(name, relationshipState(false, true));
  });
  const accounts = new Map<string, CirclePulseAccount>();
  let stableFollowers = 0,
    stableFollowing = 0,
    stableMutuals = 0,
    changedAccounts = 0,
    reappearedAccounts = 0;
  for (const [name, record] of accumulated) {
    const observed = finish(record, dates);
    accounts.set(name, { username: name, ...observed });
    if (record.followers === count) stableFollowers++;
    if (record.following === count) stableFollowing++;
    if (record.followers === count && record.following === count)
      stableMutuals++;
    if (observed.stateChanges) changedAccounts++;
    if (observed.reappeared) reappearedAccounts++;
  }
  const first = index.snapshots[0],
    latest = index.snapshots.at(-1);
  return {
    index,
    accounts,
    summary: {
      snapshotCount: count,
      skippedSnapshots: index.corrupt,
      firstDate: first?.exportDate,
      latestDate: latest?.exportDate,
      stableFollowers,
      stableFollowing,
      stableMutuals,
      ...(count >= 2 && first && latest
        ? {
            changedAccounts,
            followerRetention: retention(first.followers, latest.followers),
            followingRetention: retention(first.following, latest.following),
            latestInterval: latestInterval(index),
          }
        : {}),
      ...(count >= 3 ? { reappearedAccounts } : {}),
    },
  };
}
