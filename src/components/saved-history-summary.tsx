"use client";
import { useMemo } from "react";
import { circleAccountSummary } from "@/lib/analysis/circle-pulse";
import {
  relationshipStateLabels,
  type RelationshipHistoryPoint,
} from "@/lib/analysis/relationship-history";
import { formatSnapshotDate } from "@/lib/snapshot-vault";

export function SavedHistorySummary({
  points,
  headingLevel = 3,
}: {
  points: readonly RelationshipHistoryPoint[];
  headingLevel?: 3 | 5;
}) {
  const summary = useMemo(() => circleAccountSummary(points), [points]);
  const Heading = headingLevel === 3 ? "h3" : "h5";
  const gap = summary.absentIntervals
    .filter(
      (interval) => interval.previousPresentDate && interval.nextPresentDate,
    )
    .at(-1);
  if (!summary.snapshotCount) return null;
  return (
    <section
      className="saved-history-summary"
      aria-label="Saved history summary"
    >
      <Heading>Saved history summary</Heading>
      <dl className="relationship-summary">
        <div>
          <dt>Observed presence</dt>
          <dd>
            {summary.observedSnapshots} of {summary.snapshotCount} readable
            snapshots
          </dd>
        </div>
        <div>
          <dt>Observed state changes</dt>
          <dd>{summary.stateChanges ?? "At least 2 snapshots required"}</dd>
        </div>
        <div>
          <dt>Stable observed state</dt>
          <dd>
            {summary.stableState
              ? relationshipStateLabels[summary.stableState]
              : summary.snapshotCount < 2
                ? "At least 2 snapshots required"
                : !summary.observedSnapshots
                  ? "Not observed in these snapshots"
                  : "No single state across every snapshot"}
          </dd>
        </div>
        <div>
          <dt>Observed again after absence</dt>
          <dd>
            {summary.reappeared === undefined
              ? "At least 3 snapshots required"
              : summary.reappeared
                ? "Observed"
                : "No such pattern observed"}
          </dd>
        </div>
      </dl>
      {summary.reappeared && gap && (
        <p>
          Observed again in the {formatSnapshotDate(gap.nextPresentDate!)}{" "}
          snapshot after being absent in saved snapshots from{" "}
          {formatSnapshotDate(gap.firstAbsentDate)}
          {gap.firstAbsentDate !== gap.lastAbsentDate
            ? ` through ${formatSnapshotDate(gap.lastAbsentDate)}`
            : ""}
          . Earlier presence was observed on{" "}
          {formatSnapshotDate(gap.previousPresentDate!)}.
        </p>
      )}
      <p className="list-caption">
        These counts describe saved observations, not uninterrupted
        relationships, exact event times or causes.
      </p>
    </section>
  );
}
