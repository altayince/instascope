"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useData } from "./data-provider";
import { Upload } from "./upload";
import { SavedSnapshotNotice } from "./snapshot-return";
import { analyze } from "@/lib/analysis/relationships";
import { relationshipTimeline } from "@/lib/analysis/insights";
import { tools, type ToolSlug } from "@/lib/site";
import { track } from "@/lib/analytics";
import type { ConnectionList } from "@/lib/instagram/types";

const groups: { title: string; description: string; slugs: ToolSlug[] }[] = [
  {
    title: "Understand your circle",
    description: "Who follows you, who you follow and where you meet.",
    slugs: ["followers-analyzer", "not-following-back", "following-analyzer"],
  },
  {
    title: "Explore history",
    description:
      "Recorded dates, your own actions and changes between exports.",
    slugs: [
      "relationship-timeline",
      "pending-follow-requests",
      "unfollow-history",
      "snapshot-comparison",
    ],
  },
  {
    title: "Review and share",
    description: "Decide what to keep. Find a story worth sharing.",
    slugs: ["instagram-cleaner", "instagram-wrapped"],
  },
  {
    title: "Privacy and profiles",
    description: "Review your boundaries or look up a public profile photo.",
    slugs: ["connection-privacy", "profile-picture-viewer"],
  },
];

function optionalRecords(list: ConnectionList | undefined, label: string) {
  if (!list || list.status === "missing")
    return "Not included in this export. Add this optional category to review it.";
  if (list.status === "unsupported")
    return "Included, but could not be read. Open the tool for details.";
  return `${list.accounts.length.toLocaleString("en-US")} ${label} recorded in this export.`;
}

export function Dashboard() {
  const { dataset, older, saved, setDataset, startDemo, clear } = useData();
  const analysis = useMemo(
    () => (dataset ? analyze(dataset) : null),
    [dataset],
  );
  const timeline = useMemo(
    () => (analysis ? relationshipTimeline(analysis) : null),
    [analysis],
  );
  useEffect(() => {
    track("dashboard_opened");
  }, []);

  const dated = timeline
    ? timeline.coverage.followers + timeline.coverage.following
    : 0;
  const format = (count: number) => count.toLocaleString("en-US");
  const privacyLists = [
    "closeFriends",
    "blocked",
    "restricted",
    "hideStoryFrom",
  ] as const;
  const includedPrivacy = privacyLists.filter(
    (kind) => dataset?.connections?.[kind]?.status === "available",
  ).length;
  const unreadablePrivacy = privacyLists.filter(
    (kind) => dataset?.connections?.[kind]?.status === "unsupported",
  ).length;

  function detail(slug: ToolSlug): string {
    if (!dataset || !analysis) return tools[slug].description;
    switch (slug) {
      case "followers-analyzer":
        return `${format(analysis.followers.length)} followers. Search usernames and sort recorded dates.`;
      case "following-analyzer":
        return `${format(analysis.following.length)} accounts you follow. Review old and recent recorded follows.`;
      case "not-following-back":
        return `${format(analysis.notFollowingBack.length)} accounts you follow are absent from your followers list.`;
      case "relationship-timeline":
        return `${format(dated)} follower and following relationships have recorded dates. Explore them by year or month.`;
      case "pending-follow-requests":
        return (
          optionalRecords(
            dataset.connections?.pendingRequests,
            "sent requests",
          ) + " The export cannot confirm which are still pending today."
        );
      case "unfollow-history":
        return optionalRecords(
          dataset.connections?.recentlyUnfollowed,
          "unfollow actions by you",
        );
      case "snapshot-comparison":
        return older
          ? "Two snapshots are loaded. Review added and missing relationships, without guessing when or why they changed."
          : saved && !dataset.metadata.demo
            ? "A saved local snapshot is available. Confirm its date and the same account in Compare snapshots before using it."
            : "Add an older export from the same account to compare it with this one. One export alone cannot show changes.";
      case "instagram-cleaner":
        return "Build a private review shortlist from your connections. You decide what to change on Instagram.";
      case "instagram-wrapped":
        return `Share aggregate stories about your circle, without usernames or private lists. ${timeline?.coverage.following ? "Recorded-date stories are available." : "Date stories need usable recorded following dates."} ${older ? "Comparison stories are available when the snapshots show changes." : "Add an older snapshot for stories about changes."}`;
      case "connection-privacy":
        return `${includedPrivacy} of 4 privacy categories can be reviewed. ${4 - includedPrivacy - unreadablePrivacy} not included in this export.${unreadablePrivacy ? ` ${unreadablePrivacy} included but could not be read.` : ""}`;
      case "profile-picture-viewer":
        return "A separate public-photo lookup; no export needed. Public access restrictions apply.";
    }
  }

  return (
    <>
      <header className="dashboard-heading">
        <div>
          <span className="eyebrow">DASHBOARD · YOUR PRIVATE WORKSPACE</span>
          <h1>
            {dataset ? "Your circle, at a glance." : "Your circle starts here."}
          </h1>
          <p>
            {dataset
              ? "One export, a few useful directions. Pick what you want to explore."
              : "Open your Instagram export to review your connections, explore recorded dates and find your next story."}
          </p>
        </div>
        {dataset && (
          <button className="text-button" onClick={clear}>
            Clear active data & start over
          </button>
        )}
      </header>
      <p className="dashboard-privacy">
        Your export is processed in this browser. No Instagram password
        required.
      </p>
      {!dataset && (
        <section aria-label="Open your export" className="dashboard-welcome">
          <SavedSnapshotNotice />
          <Upload onLoad={setDataset} onDemo={startDemo} />
          <Link
            className="dashboard-guide"
            href="/how-to-download-instagram-followers-data/"
          >
            Need your export? Follow the download guide
          </Link>
        </section>
      )}
      {dataset && analysis && timeline && (
        <>
          {dataset.metadata.demo && (
            <div className="notice demo-notice" role="status">
              <strong>Demo data · Fictional example</strong>
              <p>
                Invented accounts and two example snapshots. These results do
                not describe your Instagram account.
              </p>
              <button onClick={clear}>Use my own export</button>
            </div>
          )}
          <section aria-labelledby="dashboard-summary">
            <h2 id="dashboard-summary" className="dashboard-section-title">
              In this export
            </h2>
            <p>
              These counts describe the loaded relationships, not live Instagram
              data or historical follower totals.
            </p>
            <dl className="dashboard-metrics">
              {(
                [
                  [
                    "Followers",
                    analysis.followers.length,
                    "Accounts that follow you",
                  ],
                  [
                    "Following",
                    analysis.following.length,
                    "Accounts you follow",
                  ],
                  ["Mutuals", analysis.mutuals.length, "You follow each other"],
                  [
                    "Not following back",
                    analysis.notFollowingBack.length,
                    "You follow them; they are not in your followers list",
                  ],
                  [
                    "Fans",
                    analysis.fans.length,
                    "They follow you; you do not follow them",
                  ],
                ] as const
              ).map(([label, value, explanation]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {format(value)}
                    <small>{explanation}</small>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section
            className="dashboard-dates"
            aria-labelledby="dashboard-dates-title"
          >
            <div>
              <span className="eyebrow">THE DATES BEHIND YOUR CIRCLE</span>
              <h2 id="dashboard-dates-title">When did someone follow me?</h2>
              <p>
                Find your earliest recorded followers or search for someone
                specific. Only dates supplied in your export can be shown;
                missing dates stay unavailable.
              </p>
              <Link
                className="button primary"
                href="/relationship-timeline/?direction=followers"
              >
                Explore follower dates
              </Link>
            </div>
            <div className="dashboard-coverage">
              <strong>
                {format(timeline.coverage.followers)} of{" "}
                {format(analysis.followers.length)}
              </strong>
              <p>followers have a recorded date</p>
              <p>
                {format(timeline.coverage.following)} of{" "}
                {format(analysis.following.length)} following relationships have
                a recorded date.
              </p>
              <small>
                Recorded relationships only. Ended relationships and missing
                history are not reconstructed.
              </small>
            </div>
          </section>
          <details className="data-notes">
            <summary>About this export and local data</summary>
            {dataset.metadata.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
            <p>
              The active export stays in this tab’s memory until you clear it,
              reload or close the tab.
            </p>
            <p>
              {saved
                ? "A saved local snapshot remains in this browser until you delete it. Clearing active data keeps that saved copy."
                : "No snapshot is stored unless you choose to save one."}{" "}
              Manage saved snapshots in{" "}
              <Link href="/followers-analyzer/">Followers analyzer</Link>.
            </p>
          </details>
        </>
      )}
      <div className="dashboard-tools">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="dashboard-section-title">{group.title}</h2>
            <p>{group.description}</p>
            <div className="dashboard-tool-grid">
              {group.slugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/${slug}/`}
                  className="dashboard-tool-card"
                >
                  <h3>{tools[slug].name}</h3>
                  <p>{detail(slug)}</p>
                  <span>Open {tools[slug].name}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
