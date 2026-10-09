import { normalizeUsername } from "../instagram/normalize";
import { validateVaultSnapshot } from "../snapshot-vault";
import { validExportDate } from "../snapshot-storage";

export type RelationshipState =
  "mutual" | "follows-you" | "you-follow" | "absent";
export const relationshipStateLabels: Record<RelationshipState, string> = {
  mutual: "Mutual",
  "follows-you": "Follows you",
  "you-follow": "You follow",
  absent: "Absent",
};
export type RelationshipHistoryPoint = {
  snapshotId: string;
  exportDate: string;
  state: RelationshipState;
};
export function relationshipHistoryIndex(values: readonly unknown[]) {
  let corrupt = 0;
  const names = new Set<string>();
  const snapshots = values
    .flatMap((value) => {
      try {
        const s = validateVaultSnapshot(value);
        const followers = new Set(s.followers),
          following = new Set(s.following);
        for (const name of followers) names.add(name);
        for (const name of following) names.add(name);
        return [
          { snapshotId: s.id, exportDate: s.exportDate, followers, following },
        ];
      } catch {
        corrupt++;
        return [];
      }
    })
    .sort(
      (a, b) =>
        a.exportDate.localeCompare(b.exportDate) ||
        a.snapshotId.localeCompare(b.snapshotId),
    );
  return { snapshots, names, corrupt };
}
export type RelationshipHistoryIndex = ReturnType<
  typeof relationshipHistoryIndex
>;
export function accountHistory(
  username: string,
  index: RelationshipHistoryIndex,
): RelationshipHistoryPoint[] {
  const name = normalizeUsername(username);
  if (!name) throw new Error("Enter a valid Instagram username.");
  return index.snapshots.map((s) => {
    const follower = s.followers.has(name),
      following = s.following.has(name);
    return {
      snapshotId: s.snapshotId,
      exportDate: s.exportDate,
      state: follower
        ? following
          ? "mutual"
          : "follows-you"
        : following
          ? "you-follow"
          : "absent",
    };
  });
}
export function relationshipHistory(
  username: string,
  snapshots: readonly unknown[],
) {
  return accountHistory(username, relationshipHistoryIndex(snapshots));
}
export function historyTransitions(
  points: readonly RelationshipHistoryPoint[],
) {
  return points.slice(1).flatMap((next, i) => {
    const previous = points[i];
    if (previous.state === next.state) return [];
    const beforeFollower =
      previous.state === "mutual" || previous.state === "follows-you";
    const beforeFollowing =
      previous.state === "mutual" || previous.state === "you-follow";
    const afterFollower =
      next.state === "mutual" || next.state === "follows-you";
    const afterFollowing =
      next.state === "mutual" || next.state === "you-follow";
    const observations: string[] = [];
    if (next.state === "mutual" && previous.state === "absent")
      observations.push("Present in both lists in this snapshot.");
    else {
      if (beforeFollower !== afterFollower)
        observations.push(
          afterFollower
            ? "Now also present in Followers."
            : "Not present in Followers by this snapshot.",
        );
      if (beforeFollowing !== afterFollowing)
        observations.push(
          afterFollowing
            ? "Now also present in Following."
            : "Not present in Following by this snapshot.",
        );
    }
    return [
      {
        olderDate: previous.exportDate,
        newerDate: next.exportDate,
        observations,
      },
    ];
  });
}
export type HistoryContextKind = "one-way" | "fans" | "review";
export function savedHistoryContext(
  index: RelationshipHistoryIndex,
  usernames: readonly string[],
  exportDate: string,
  confirmed: boolean,
  kind: HistoryContextKind,
) {
  if (!confirmed)
    throw new Error(
      "Confirm the active export and saved history belong to the same Instagram account.",
    );
  if (!validExportDate(exportDate))
    throw new Error("Enter the date this active export represents.");
  const target = new Set(usernames),
    flags = new Map<
      string,
      { mutual: boolean; follower: boolean; following: boolean }
    >();
  const older = index.snapshots.filter((s) => s.exportDate < exportDate);
  for (const s of older) {
    for (const name of s.followers)
      if (target.has(name)) {
        const flag = flags.get(name) ?? {
          mutual: false,
          follower: false,
          following: false,
        };
        flag.follower = true;
        flag.mutual ||= s.following.has(name);
        flags.set(name, flag);
      }
    for (const name of s.following)
      if (target.has(name)) {
        const flag = flags.get(name) ?? {
          mutual: false,
          follower: false,
          following: false,
        };
        flag.following = true;
        flags.set(name, flag);
      }
  }
  const context = new Map<string, string[]>();
  for (const [name, flagsForName] of flags) {
    const labels: string[] = [];
    if (kind === "one-way" && flagsForName.mutual)
      labels.push("Previously mutual in saved history");
    if (kind === "fans" && flagsForName.following)
      labels.push("You followed this account in saved history");
    if (kind === "review") {
      if (flagsForName.mutual)
        labels.push("Previously mutual in saved history");
      else {
        if (flagsForName.following)
          labels.push("Previously you followed in saved history");
        if (flagsForName.follower)
          labels.push("Previously followed you in saved history");
      }
    }
    if (labels.length) context.set(name, labels);
  }
  return { context, snapshotCount: older.length };
}
