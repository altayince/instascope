"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "./data-provider";
import { Upload } from "./upload";
import { AccountList } from "./account-list";
import { Wrapped } from "./wrapped";
import {
  PendingRequests,
  PrivacyLists,
  UnfollowHistory,
} from "./connection-insights";
import { RelationshipTimeline } from "./relationship-timeline";
import { analyze, compareSnapshots } from "@/lib/analysis/relationships";
import { track } from "@/lib/analytics";
import type { Mode } from "@/lib/site";
export const categories = {
  followers: ["Followers", "Accounts that follow you."],
  following: ["Following", "Accounts you follow."],
  mutuals: ["Mutuals", "You follow each other."],
  notFollowingBack: [
    "Not following back",
    "You follow them. They do not appear in your followers list.",
  ],
  fans: ["Fans", "They follow you. You do not follow them back."],
} as const;
export type Category = keyof typeof categories;
const changeLabels = {
  newFollowers: "Added followers",
  lostFollowers: "Missing followers",
  newFollowing: "Newly followed",
  removedFollowing: "No longer following",
  newMutuals: "New mutuals",
  lostMutuals: "No longer mutual",
} as const;
export function Workspace({
  mode = "analyzer",
  initialCategory = "followers",
}: {
  mode?: Mode;
  initialCategory?: Category;
}) {
  const { dataset, older, setDataset, setOlder, clear } = useData();
  const [category, setCategory] = useState<Category>(initialCategory);
  const [change, setChange] =
    useState<keyof typeof changeLabels>("newFollowers");
  const analysis = useMemo(
    () => (dataset ? analyze(dataset) : null),
    [dataset],
  );
  const comparison = useMemo(
    () => (dataset && older ? compareSnapshots(older, dataset) : null),
    [dataset, older],
  );
  useEffect(() => {
    track("landing_viewed");
    if (mode === "cleaner") track("cleaner_opened");
  }, [mode]);
  useEffect(() => {
    if (analysis && mode === "wrapped") track("wrapped_generated");
  }, [analysis, mode]);
  useEffect(() => {
    if (comparison) track("comparison_succeeded");
  }, [comparison]);
  const displayCategories =
    mode === "cleaner"
      ? (["following", "notFollowingBack", "mutuals"] as const)
      : (Object.keys(categories) as Category[]);
  return (
    <section id="tool" className="workspace">
      {!dataset && (
        <Upload
          label={
            mode === "comparison"
              ? "Upload newer snapshot"
              : "Upload Instagram export"
          }
          onLoad={setDataset}
        />
      )}
      {dataset && analysis && (
        <>
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
              <h2>
                {mode === "cleaner"
                  ? "A fresh look at your feed."
                  : mode === "comparison"
                    ? "Your circle, then and now."
                    : mode === "wrapped"
                      ? "The story in your numbers."
                      : "Meet your social circle."}
              </h2>
            </div>
            <button className="text-button" onClick={clear}>
              Clear data & start over
            </button>
          </div>
          <div className="tool-tabs">
            <Link
              href="/followers-analyzer/"
              aria-current={mode === "analyzer" ? "page" : undefined}
            >
              Overview
            </Link>
            <Link
              href="/pending-follow-requests/"
              aria-current={mode === "pending" ? "page" : undefined}
            >
              Pending requests
            </Link>
            <Link
              href="/connection-privacy/"
              aria-current={mode === "privacy" ? "page" : undefined}
            >
              Connection privacy
            </Link>
            <Link
              href="/unfollow-history/"
              aria-current={mode === "history" ? "page" : undefined}
            >
              Your unfollow history
            </Link>
            <Link
              href="/relationship-timeline/"
              aria-current={mode === "timeline" ? "page" : undefined}
            >
              Relationship timeline
            </Link>
            <Link
              href="/instagram-cleaner/"
              aria-current={mode === "cleaner" ? "page" : undefined}
            >
              InstaCleaner
            </Link>
            <Link
              href="/snapshot-comparison/"
              aria-current={mode === "comparison" ? "page" : undefined}
            >
              Compare snapshots
            </Link>
            <Link
              href="/instagram-wrapped/"
              aria-current={mode === "wrapped" ? "page" : undefined}
            >
              My Wrapped
            </Link>
          </div>
          {mode === "comparison" ? (
            <>
              <div className="snapshot-status">
                <p>
                  <strong>Newer snapshot</strong> · {dataset.followers.length}{" "}
                  followers / {dataset.following.length} following
                </p>
                {older && (
                  <p>
                    <strong>Older snapshot</strong> · {older.followers.length}{" "}
                    followers / {older.following.length} following{" "}
                    <button onClick={() => setOlder(null)}>
                      Replace older snapshot
                    </button>
                  </p>
                )}
                <p>
                  You choose which export is older. Import time is not the
                  snapshot date.
                </p>
              </div>
              {!older && (
                <Upload
                  label="Upload older snapshot"
                  onLoad={(value) => {
                    track("comparison_started");
                    setOlder(value);
                  }}
                />
              )}
              {comparison && (
                <>
                  <p className="notice">
                    Follower change: {comparison.followerDelta >= 0 ? "+" : ""}
                    {comparison.followerDelta} · Following change:{" "}
                    {comparison.followingDelta >= 0 ? "+" : ""}
                    {comparison.followingDelta}. Differences show presence or
                    absence between exports, not why or exactly when a
                    relationship changed.
                  </p>
                  <div className="category-tabs">
                    {Object.entries(changeLabels).map(([key, label]) => (
                      <button
                        key={key}
                        aria-pressed={change === key}
                        onClick={() => setChange(key as typeof change)}
                      >
                        {label}{" "}
                        <strong>
                          {comparison[key as typeof change].length}
                        </strong>
                      </button>
                    ))}
                  </div>
                  <AccountList key={change} accounts={comparison[change]} />
                </>
              )}
            </>
          ) : mode === "pending" ? (
            <PendingRequests dataset={dataset} />
          ) : mode === "privacy" ? (
            <PrivacyLists dataset={dataset} />
          ) : mode === "history" ? (
            <UnfollowHistory dataset={dataset} />
          ) : mode === "timeline" ? (
            <RelationshipTimeline dataset={dataset} />
          ) : mode === "wrapped" ? (
            <Wrapped
              analysis={analysis}
              comparison={comparison}
              dataset={dataset}
            />
          ) : (
            <>
              <div className="stats-grid">
                {displayCategories.map((key) => (
                  <button
                    key={key}
                    className={`stat ${category === key ? "active" : ""}`}
                    aria-pressed={category === key}
                    onClick={() => setCategory(key)}
                  >
                    <span>{categories[key][0]}</span>
                    <strong>
                      {analysis[key].length.toLocaleString("en-US")}
                    </strong>
                    <small>
                      {key === "mutuals"
                        ? "It goes both ways ↔"
                        : key === "notFollowingBack"
                          ? "You → them"
                          : key === "fans"
                            ? "Them → you"
                            : "Explore connections "}
                    </small>
                  </button>
                ))}
              </div>
              <div className="list-heading">
                <h3>{categories[category][0]}</h3>
                <p>{categories[category][1]}</p>
              </div>
              <AccountList
                key={`${dataset.metadata.parsedAt}-${mode}`}
                accounts={analysis[category]}
                selectable={mode === "cleaner"}
                selectionScope={analysis.following}
              />
            </>
          )}
          <details className="data-notes">
            <summary>About these results</summary>
            {dataset.metadata.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
            <p>
              Data stays in memory until you clear it, reload, or close this
              tab. No lists are stored by InstaScope.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
