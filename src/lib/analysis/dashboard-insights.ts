import type { Dataset } from "../instagram/types";
import { analyze } from "./relationships";
import { relationshipTimeline } from "./insights";
import { mutualOrigins, mutualOriginSummary } from "./mutual-origins";

export type DashboardInsight = {
  id: string;
  label: string;
  value: string;
  description: string;
  href: string;
  action: string;
};

/** Present existing aggregate facts; never match an export to saved accounts. */
export function dashboardInsights(dataset: Dataset, savedSnapshotCount = 0) {
  const analysis = analyze(dataset);
  const dates = relationshipTimeline(analysis);
  const origins = mutualOriginSummary(mutualOrigins(dataset));
  const format = (count: number) => count.toLocaleString("en-US");
  const insights: DashboardInsight[] = [];

  if (dates.coverage.followers > 0) {
    insights.push({
      id: "follower-dates",
      label: "When did someone follow me?",
      value: `${Math.round((dates.coverage.followers / analysis.followers.length) * 100)}%`,
      description: `${format(dates.coverage.followers)} of ${format(analysis.followers.length)} follower records include a usable date. Missing dates remain unknown.`,
      href: "/relationship-timeline/?direction=followers",
      action: "Explore follower dates",
    });
  }
  if (origins.dated > 0) {
    insights.push({
      id: "mutual-origins",
      label: "Earlier follower dates",
      value: `${origins.theyFirstPercent}%`,
      description: `${format(origins.counts["they-first"])} of ${format(origins.dated)} dated mutuals have an earlier follower date. Unknown dates are excluded.`,
      href: "/relationship-timeline/",
      action: "Inspect recorded first",
    });
  }
  if (savedSnapshotCount >= 2) {
    insights.push({
      id: "saved-snapshots",
      label: dataset.metadata.demo
        ? "Fictional saved snapshots"
        : "Saved snapshots",
      value: format(savedSnapshotCount),
      description: dataset.metadata.demo
        ? "Explore example changes between fictional snapshots. Your real saved history stays separate."
        : "Local snapshots are available. Choose two from the same account to compare; nothing is matched automatically.",
      href: dataset.metadata.demo
        ? "/snapshot-vault/?demo=true"
        : "/snapshot-vault/",
      action: "Explore saved snapshots",
    });
  }
  const requests = dataset.connections?.pendingRequests;
  if (requests?.status === "available" && requests.accounts.length > 0) {
    insights.push({
      id: "sent-requests",
      label: "Sent request records",
      value: format(requests.accounts.length),
      description:
        "Sent requests recorded in this export. Their presence does not prove they are still pending today.",
      href: "/pending-follow-requests/",
      action: "Review sent requests",
    });
  }
  if (analysis.notFollowingBack.length > 0) {
    insights.push({
      id: "one-way-follows",
      label: "One-way follows",
      value: format(analysis.notFollowingBack.length),
      description:
        "Accounts you follow that are absent from your followers list in this export. Review them on your terms.",
      href: "/not-following-back/",
      action: "Review one-way follows",
    });
  }
  return insights.slice(0, 4);
}
