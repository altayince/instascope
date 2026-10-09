import type { Dataset, ConnectionKind } from "../instagram/types";
import { normalizeUsername, deduplicate } from "../instagram/normalize";
import { analyze } from "./relationships";
import { mutualOrigins } from "./mutual-origins";
import {
  accountHistory,
  historyTransitions,
  savedHistoryContext,
  type RelationshipHistoryIndex,
  type RelationshipState,
} from "./relationship-history";
import { validExportDate } from "../snapshot-storage";

export const connectionContextLabels: Record<ConnectionKind, string> = {
  pendingRequests: "Sent request recorded",
  recentlyUnfollowed: "You unfollowed this account in export history",
  closeFriends: "Close Friends record",
  blocked: "Blocked account record",
  restricted: "Restricted account record",
  hideStoryFrom: "Story hidden from record",
};
export function timelineAccountIndex(dataset: Dataset) {
  const analysis = analyze(dataset);
  const followers = new Map(analysis.followers.map((a) => [a.username, a]));
  const following = new Map(analysis.following.map((a) => [a.username, a]));
  const origins = new Map(mutualOrigins(dataset).map((r) => [r.username, r]));
  const names = new Set([...followers.keys(), ...following.keys()]);
  const connections = new Map<ConnectionKind, Set<string>>();
  for (const kind of Object.keys(connectionContextLabels) as ConnectionKind[]) {
    const list = dataset.connections?.[kind];
    if (list?.status !== "available") continue;
    const accounts = new Set(deduplicate(list.accounts).map((a) => a.username));
    connections.set(kind, accounts);
    for (const name of accounts) names.add(name);
  }
  return { followers, following, origins, connections, names };
}
export type TimelineAccountIndex = ReturnType<typeof timelineAccountIndex>;
export function timelineAccountSummary(
  username: string,
  index: TimelineAccountIndex,
  history?: RelationshipHistoryIndex,
) {
  const name = normalizeUsername(username);
  if (!name) throw new Error("Enter a valid Instagram username.");
  const follower = index.followers.get(name),
    following = index.following.get(name);
  const state: Exclude<RelationshipState, "absent"> | undefined = follower
    ? following
      ? "mutual"
      : "follows-you"
    : following
      ? "you-follow"
      : undefined;
  const points = history ? accountHistory(name, history) : undefined;
  const present = points?.filter((p) => p.state !== "absent");
  return {
    username: name,
    state,
    follower,
    following,
    origin: index.origins.get(name),
    points,
    readableSnapshots: points?.length,
    containingSnapshots: present?.length,
    transitions: points ? historyTransitions(points) : undefined,
    firstPresent: present?.[0]?.exportDate,
    latestPresent: present?.at(-1)?.exportDate,
  };
}
export function timelineAccountContext(
  username: string,
  index: TimelineAccountIndex,
  history?: RelationshipHistoryIndex,
  activeExportDate?: string,
  confirmed = false,
) {
  const summary = timelineAccountSummary(username, index, history);
  const current: string[] = [];
  if (summary.state)
    current.push(
      summary.state === "mutual"
        ? "Mutual in current export"
        : summary.state === "follows-you"
          ? "Follows you in current export"
          : "You follow in current export",
    );
  for (const [kind, names] of index.connections)
    if (names.has(summary.username))
      current.push(connectionContextLabels[kind]);
  const saved =
    history &&
    confirmed &&
    activeExportDate &&
    validExportDate(activeExportDate)
      ? (savedHistoryContext(
          history,
          [summary.username],
          activeExportDate,
          confirmed,
          "review",
        ).context.get(summary.username) ?? [])
      : [];
  return { current, saved };
}
