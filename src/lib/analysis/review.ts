import { deduplicate, deduplicateEvents } from "../instagram/normalize";
import { missingConnection } from "../instagram/connections";
import type { Account, Dataset } from "../instagram/types";
import type { Analysis } from "./relationships";
import { utcDate } from "./insights";

export function relationshipReview(dataset: Dataset, analysis: Analysis) {
  const pending = dataset.connections?.pendingRequests ?? missingConnection();
  const history =
    dataset.connections?.recentlyUnfollowed ?? missingConnection();
  const pendingAccounts =
    pending.status === "available" ? deduplicate(pending.accounts) : [];
  const latestUnfollow = new Map<string, Account>();
  if (history.status === "available") {
    for (const record of deduplicateEvents(history.accounts)) {
      const previous = latestUnfollow.get(record.username);
      if (
        !previous ||
        (record.timestamp !== undefined &&
          (previous.timestamp === undefined ||
            record.timestamp > previous.timestamp))
      )
        latestUnfollow.set(record.username, record);
    }
  }
  const unfollowedAccounts = [...latestUnfollow.values()];
  const selectionScope = deduplicate([
    ...analysis.following,
    ...pendingAccounts,
    ...unfollowedAccounts,
  ]);
  const context = new Map<string, string[]>();
  const add = (username: string, label: string) => {
    const labels = context.get(username) ?? [];
    if (!labels.includes(label)) labels.push(label);
    context.set(username, labels);
  };
  for (const entry of analysis.notFollowingBack)
    add(entry.username, "One-way follow in this export");
  for (const entry of analysis.mutuals)
    add(entry.username, "Mutual in this export");
  for (const entry of analysis.following)
    if (entry.timestamp !== undefined)
      add(entry.username, `Follow recorded ${utcDate(entry.timestamp)}`);
  for (const entry of pendingAccounts)
    add(
      entry.username,
      entry.timestamp === undefined
        ? "Sent request recorded; date unavailable"
        : `Sent request recorded ${utcDate(entry.timestamp)}`,
    );
  for (const entry of unfollowedAccounts)
    add(
      entry.username,
      entry.timestamp === undefined
        ? "You unfollowed; date unavailable"
        : `You unfollowed; latest record ${utcDate(entry.timestamp)}`,
    );
  return {
    pending,
    history,
    pendingAccounts,
    unfollowedAccounts,
    datedFollowing: analysis.following.filter(
      (entry) => entry.timestamp !== undefined,
    ),
    selectionScope,
    context,
  };
}
