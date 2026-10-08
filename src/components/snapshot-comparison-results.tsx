"use client";
import { useState } from "react";
import { AccountList } from "./account-list";
import type { compareSnapshots } from "@/lib/analysis/relationships";

const changeLabels = {
  newFollowers: "Added followers",
  lostFollowers: "Missing followers",
  newFollowing: "Newly followed",
  removedFollowing: "No longer following",
  newMutuals: "New mutuals",
  lostMutuals: "No longer mutual",
} as const;
export type SnapshotComparison = ReturnType<typeof compareSnapshots>;
export function SnapshotComparisonResults({
  comparison,
  demo,
}: {
  comparison: SnapshotComparison;
  demo?: boolean;
}) {
  const [change, setChange] =
    useState<keyof typeof changeLabels>("newFollowers");
  return (
    <section aria-label="Snapshot comparison results">
      <p className="notice">
        Follower change: {comparison.followerDelta >= 0 ? "+" : ""}
        {comparison.followerDelta} · Following change:{" "}
        {comparison.followingDelta >= 0 ? "+" : ""}
        {comparison.followingDelta}. Differences show presence or absence
        between exports, not why or exactly when a relationship changed. Missing
        does not prove a deliberate unfollow. Renames, deactivations and
        differences in exports can affect the results.
      </p>
      <div className="category-tabs">
        {Object.entries(changeLabels).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={change === key}
            onClick={() => setChange(key as typeof change)}
          >
            {label} <strong>{comparison[key as typeof change].length}</strong>
          </button>
        ))}
      </div>
      <AccountList key={change} accounts={comparison[change]} demo={demo} />
    </section>
  );
}
