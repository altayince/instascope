"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "./data-provider";
import { Upload } from "./upload";
import { AccountList } from "./account-list";
import { Wrapped } from "./wrapped";
import {
  SavedComparisonChoice,
  SavedSnapshotNotice,
  SnapshotSaver,
} from "./snapshot-return";
import {
  PendingRequests,
  PrivacyLists,
  UnfollowHistory,
} from "./connection-insights";
import { RelationshipTimeline } from "./relationship-timeline";
import { RelationshipReview } from "./relationship-review";
import { analyze, compareSnapshots } from "@/lib/analysis/relationships";
import { track } from "@/lib/analytics";
import type { Mode } from "@/lib/site";
import type { ConnectionList, Dataset } from "@/lib/instagram/types";
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
function optionalSummary(list: ConnectionList | undefined, label: string) {
  if (!list || list.status === "missing")
    return "Not included in this export. Add this optional category to review it.";
  if (list.status !== "available")
    return "Could not read this category from the export.";
  return `${list.accounts.length} ${label} recorded in this export.`;
}
function ReviewNext({ dataset }: { dataset: Dataset }) {
  const countDated = (accounts: Dataset["followers"]) =>
    accounts.reduce(
      (count, account) => count + Number(account.timestamp !== undefined),
      0,
    );
  const dated = countDated(dataset.followers) + countDated(dataset.following);
  const paths = [
    {
      href: "/pending-follow-requests/",
      title: "Pending requests",
      detail: optionalSummary(
        dataset.connections?.pendingRequests,
        "sent requests",
      ),
    },
    {
      href: "/relationship-timeline/",
      title: "Relationship timeline",
      detail: `${dated} current connections have recorded dates. These are not historical follower totals.`,
    },
    {
      href: "/unfollow-history/",
      title: "Your unfollow history",
      detail: optionalSummary(
        dataset.connections?.recentlyUnfollowed,
        "recent unfollow actions by you",
      ),
    },
  ];
  return (
    <section className="review-next" aria-label="Explore more from this export">
      <div>
        <h3>Go beyond the overview</h3>
        <p>See requests, recorded dates and your own recent unfollows.</p>
      </div>
      <div className="review-next-grid">
        {paths.map((path) => (
          <Link href={path.href} key={path.href}>
            <strong>{path.title}</strong>
            <span>{path.detail}</span>
          </Link>
        ))}
      </div>
      <p>
        Missing a category?{" "}
        <Link href="/how-to-download-instagram-followers-data/">
          Check what to include in your export
        </Link>
        .
      </p>
    </section>
  );
}
export function Workspace({
  mode = "analyzer",
  initialCategory = "followers",
}: {
  mode?: Mode;
  initialCategory?: Category;
}) {
  const {
    dataset,
    older,
    olderSource,
    currentExportDate,
    saved,
    setDataset,
    setOlder,
    clear,
    startDemo,
  } = useData();
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
  return (
    <section id="tool" className="workspace">
      {!dataset && (
        <>
          <SavedSnapshotNotice />
          <Upload
            label={
              mode === "comparison"
                ? "Upload newer snapshot"
                : "Upload Instagram export"
            }
            onLoad={setDataset}
            onDemo={startDemo}
          />
        </>
      )}
      {dataset && analysis && (
        <>
          {dataset.metadata.demo && (
            <div className="notice demo-notice" role="status">
              <strong>Demo data · Fictional example</strong>
              <p>
                Explore the tools with invented accounts and two example
                snapshots. These results do not describe your Instagram account.
              </p>
              <button onClick={clear}>Use my own export</button>
            </div>
          )}
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
              <h2>
                {mode === "cleaner"
                  ? "Review your Instagram circle."
                  : mode === "comparison"
                    ? "Your circle, then and now."
                    : mode === "wrapped"
                      ? "The story in your numbers."
                      : "Meet your social circle."}
              </h2>
            </div>
            <button className="text-button" onClick={clear}>
              Clear active data & start over
            </button>
          </div>
          {mode === "analyzer" && <ReviewNext dataset={dataset} />}
          {mode === "analyzer" && <SnapshotSaver />}
          <div className="tool-tabs">
            <Link
              href="/followers-analyzer/"
              scroll={false}
              aria-current={mode === "analyzer" ? "page" : undefined}
            >
              Overview
            </Link>
            <Link
              href="/pending-follow-requests/"
              scroll={false}
              aria-current={mode === "pending" ? "page" : undefined}
            >
              Pending requests
            </Link>
            <Link
              href="/connection-privacy/"
              scroll={false}
              aria-current={mode === "privacy" ? "page" : undefined}
            >
              Connection privacy
            </Link>
            <Link
              href="/unfollow-history/"
              scroll={false}
              aria-current={mode === "history" ? "page" : undefined}
            >
              Your unfollow history
            </Link>
            <Link
              href="/relationship-timeline/"
              scroll={false}
              aria-current={mode === "timeline" ? "page" : undefined}
            >
              Relationship timeline
            </Link>
            <Link
              href="/instagram-cleaner/"
              scroll={false}
              aria-current={mode === "cleaner" ? "page" : undefined}
            >
              InstaCleaner
            </Link>
            <Link
              href="/snapshot-comparison/"
              scroll={false}
              aria-current={mode === "comparison" ? "page" : undefined}
            >
              Compare snapshots
            </Link>
            <Link
              href="/instagram-wrapped/"
              scroll={false}
              aria-current={mode === "wrapped" ? "page" : undefined}
            >
              My Wrapped
            </Link>
          </div>
          {mode === "comparison" ? (
            <>
              <div className="snapshot-status">
                <p>
                  <strong>Current uploaded export · newer snapshot</strong> ·{" "}
                  {dataset.followers.length} followers /{" "}
                  {dataset.following.length} following
                  {dataset.metadata.snapshotLabel && (
                    <> · {dataset.metadata.snapshotLabel}</>
                  )}
                </p>
                {older && (
                  <p>
                    <strong>
                      {olderSource === "saved"
                        ? "Saved local older snapshot"
                        : olderSource === "manual"
                          ? "Manually uploaded older snapshot"
                          : "Fictional older snapshot"}
                    </strong>{" "}
                    · {older.followers.length} followers /{" "}
                    {older.following.length} following{" "}
                    {older.metadata.snapshotLabel && (
                      <> · {older.metadata.snapshotLabel} </>
                    )}
                    {olderSource === "saved" && currentExportDate && (
                      <>
                        {" "}
                        · You entered {currentExportDate} for the current
                        export.
                      </>
                    )}
                    {!dataset.metadata.demo && (
                      <button onClick={() => setOlder(null)}>
                        Choose another older snapshot
                      </button>
                    )}
                  </p>
                )}
                <p>
                  You choose which export is older. Import time is not an export
                  date; compare files from the same account.
                </p>
              </div>
              {!older && <SavedComparisonChoice />}
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
                  <AccountList
                    key={change}
                    accounts={comparison[change]}
                    demo={dataset.metadata.demo}
                  />
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
          ) : mode === "cleaner" ? (
            <RelationshipReview dataset={dataset} analysis={analysis} />
          ) : mode === "wrapped" ? (
            <Wrapped
              analysis={analysis}
              comparison={comparison}
              dataset={dataset}
            />
          ) : (
            <>
              <div className="stats-grid">
                {(Object.keys(categories) as Category[]).map((key) => (
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
                demo={dataset.metadata.demo}
                key={`${dataset.metadata.parsedAt}-${mode}`}
                accounts={analysis[category]}
              />
            </>
          )}
          {(mode === "cleaner" ||
            mode === "wrapped" ||
            (mode === "comparison" && older)) && <SnapshotSaver />}
          <details className="data-notes">
            <summary>About these results</summary>
            {dataset.metadata.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
            <p>
              The current export stays in this tab’s memory until you clear it,
              reload, or close the tab.{" "}
              {saved
                ? "Your saved local snapshot contains only follower and following usernames in this browser. You can delete it from the snapshot controls in Overview."
                : "No snapshot is stored unless you choose to save one."}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
