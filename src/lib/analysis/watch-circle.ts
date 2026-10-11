import type { ReviewMemoryRecord } from "../review-memory";
import { normalizeUsername } from "../instagram/normalize";
import { validExportDate } from "../snapshot-storage";
import {
  timelineAccountSummary,
  type TimelineAccountIndex,
} from "./timeline-context";
import {
  accountHistory,
  type RelationshipHistoryIndex,
  type RelationshipState,
} from "./relationship-history";

export type WatchedRelationshipObservation = {
  username: string;
  currentState: RelationshipState;
  previousState?: RelationshipState;
  previousSnapshotDate?: string;
  currentDate?: string;
  // Unknown until a confirmed, dated comparison has a readable earlier point.
  changed?: boolean;
};
export type WatchComparison = {
  history: RelationshipHistoryIndex;
  currentDate: string;
  confirmed: boolean;
};

export function watchCircle(
  records: Iterable<ReviewMemoryRecord>,
  active: TimelineAccountIndex,
  comparison?: WatchComparison,
) {
  if (comparison && !comparison.confirmed)
    throw new Error(
      "Confirm the active export and saved snapshots belong to the same Instagram account.",
    );
  if (comparison && !validExportDate(comparison.currentDate))
    throw new Error("Enter the date this active export represents.");
  const names = new Set<string>();
  for (const record of records) {
    const username = record.watch ? normalizeUsername(record.username) : null;
    if (username) names.add(username);
  }
  const previous = comparison?.history.snapshots
    .filter((point) => point.exportDate < comparison.currentDate)
    .at(-1);
  const latest =
    comparison && previous
      ? { ...comparison.history, snapshots: [previous] }
      : undefined;
  const observations: WatchedRelationshipObservation[] = [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((username) => {
      const currentState =
        timelineAccountSummary(username, active).state ?? "absent";
      if (!latest || !comparison) return { username, currentState };
      const prior = accountHistory(username, latest)[0];
      return {
        username,
        currentState,
        previousState: prior.state,
        previousSnapshotDate: prior.exportDate,
        currentDate: comparison.currentDate,
        changed: prior.state !== currentState,
      };
    });
  return {
    observations,
    status: latest
      ? ("loaded" as const)
      : comparison
        ? ("unavailable" as const)
        : ("unloaded" as const),
    changedCount: latest
      ? observations.filter((entry) => entry.changed).length
      : undefined,
    previousSnapshotDate: previous?.exportDate,
    currentDate: latest ? comparison?.currentDate : undefined,
    skippedSnapshots: comparison?.history.corrupt ?? 0,
  };
}
