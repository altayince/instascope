import { describe, expect, it } from "vitest";
import {
  circleAccountSummary,
  circlePulse,
  validateCirclePulseRange,
} from "../../src/lib/analysis/circle-pulse";
import {
  accountHistory,
  relationshipHistoryIndex,
  type RelationshipState,
} from "../../src/lib/analysis/relationship-history";
import { compareVaultSnapshots } from "../../src/lib/snapshot-vault";
import { demoVaultSnapshots } from "../../src/lib/demo";

const dates = ["2025-01-15", "2025-04-15", "2025-07-15", "2025-10-15"];
const patterns: Record<string, RelationshipState[]> = {
  "sample.mutual": ["mutual", "mutual", "mutual", "mutual"],
  "sample.follower": [
    "follows-you",
    "follows-you",
    "follows-you",
    "follows-you",
  ],
  "sample.following": ["you-follow", "you-follow", "you-follow", "you-follow"],
  "sample.changing": ["mutual", "you-follow", "you-follow", "follows-you"],
  "sample.reappeared": ["you-follow", "absent", "mutual", "mutual"],
  "sample.missing": ["follows-you", "follows-you", "absent", "absent"],
  "sample.new": ["absent", "absent", "follows-you", "follows-you"],
  "sample.old.name": ["you-follow", "absent", "absent", "absent"],
  "sample.new.name": ["absent", "you-follow", "you-follow", "you-follow"],
  "sample.repeat": ["absent", "follows-you", "absent", "follows-you"],
};
const snapshots = dates.map((exportDate, position) => ({
  id: `pulse-${position}`,
  version: 1 as const,
  exportDate,
  createdAt: position,
  followers: Object.keys(patterns).filter((name) =>
    ["mutual", "follows-you"].includes(patterns[name][position]),
  ),
  following: Object.keys(patterns).filter((name) =>
    ["mutual", "you-follow"].includes(patterns[name][position]),
  ),
}));
const history = () => relationshipHistoryIndex(snapshots);

describe("Circle Pulse saved observations", () => {
  it("distinguishes stable membership from a stable exact relationship state", () => {
    const result = circlePulse(history());
    expect(result.summary).toMatchObject({
      snapshotCount: 4,
      firstDate: dates[0],
      latestDate: dates[3],
      stableFollowers: 2,
      stableFollowing: 2,
      stableMutuals: 1,
      changedAccounts: 7,
      reappearedAccounts: 2,
      skippedSnapshots: 0,
    });
    expect(result.accounts.get("sample.mutual")).toMatchObject({
      username: "sample.mutual",
      observedSnapshots: 4,
      observedFollowerSnapshots: 4,
      observedFollowingSnapshots: 4,
      stableState: "mutual",
      stateChanges: 0,
      reappeared: false,
      firstPresent: dates[0],
      latestPresent: dates[3],
    });
    expect(result.accounts.get("sample.follower")?.stableState).toBe(
      "follows-you",
    );
    expect(result.accounts.get("sample.following")?.stableState).toBe(
      "you-follow",
    );
    expect(result.accounts.get("sample.changing")?.stableState).toBeUndefined();
  });

  it("uses endpoint numerator/denominator retention, including observed reappearances", () => {
    const result = circlePulse(history());
    expect(result.summary.followerRetention).toEqual({
      retained: 3,
      total: 4,
      percentage: 75,
    });
    expect(result.summary.followingRetention).toEqual({
      retained: 3,
      total: 5,
      percentage: 60,
    });
    expect(result.accounts.get("sample.reappeared")?.reappeared).toBe(true);
    expect(result.index.snapshots[0].following.has("sample.reappeared")).toBe(
      true,
    );
    expect(result.index.snapshots[1].following.has("sample.reappeared")).toBe(
      false,
    );
    expect(result.index.snapshots[3].following.has("sample.reappeared")).toBe(
      true,
    );
  });

  it("reuses comparison semantics for the latest interval and counts a changed username only once", () => {
    const result = circlePulse(history());
    const compared = compareVaultSnapshots(snapshots[2], snapshots[3], true);
    expect(result.summary.latestInterval).toEqual({
      olderDate: dates[2],
      newerDate: dates[3],
      newFollowers: compared.newFollowers.length,
      missingFollowers: compared.lostFollowers.length,
      newFollowing: compared.newFollowing.length,
      missingFollowing: compared.removedFollowing.length,
      newMutuals: compared.newMutuals.length,
      missingMutuals: compared.lostMutuals.length,
      stateChanges: 2,
    });
    // You follow -> Follows you changes both lists, but is one state change.
    expect(result.accounts.get("sample.changing")?.stateChanges).toBe(2);
  });

  it("bounds completed reappearance and leading/trailing absence with snapshot dates", () => {
    const result = circlePulse(history());
    expect(result.accounts.get("sample.reappeared")).toMatchObject({
      observedSnapshots: 3,
      stateChanges: 2,
      reappeared: true,
      latestState: "mutual",
      absentIntervals: [
        {
          previousPresentDate: dates[0],
          firstAbsentDate: dates[1],
          lastAbsentDate: dates[1],
          nextPresentDate: dates[2],
        },
      ],
    });
    expect(result.accounts.get("sample.missing")).toMatchObject({
      firstPresent: dates[0],
      latestPresent: dates[1],
      latestState: "absent",
      stateChanges: 1,
      reappeared: false,
      absentIntervals: [
        {
          previousPresentDate: dates[1],
          firstAbsentDate: dates[2],
          lastAbsentDate: dates[3],
        },
      ],
    });
    expect(result.accounts.get("sample.repeat")?.absentIntervals).toEqual([
      {
        firstAbsentDate: dates[0],
        lastAbsentDate: dates[0],
        nextPresentDate: dates[1],
      },
      {
        previousPresentDate: dates[1],
        firstAbsentDate: dates[2],
        lastAbsentDate: dates[2],
        nextPresentDate: dates[3],
      },
    ]);
  });

  it("uses the same metadata helper for every account as the existing classified history points", () => {
    const index = history(),
      result = circlePulse(index);
    for (const [username, actual] of result.accounts) {
      const { username: identity, ...metadata } = actual;
      expect(identity).toBe(username);
      expect(metadata).toEqual(
        circleAccountSummary(accountHistory(username, index)),
      );
    }
  });

  it("does not call all-absent history stable or infer first presence", () => {
    const summary = circleAccountSummary(
      accountHistory("sample.unseen", history()),
    );
    expect(summary).toMatchObject({
      observedSnapshots: 0,
      stateChanges: 0,
      reappeared: false,
      latestState: "absent",
    });
    expect(summary.stableState).toBeUndefined();
    expect(summary.firstPresent).toBeUndefined();
    expect(summary.latestPresent).toBeUndefined();
    expect(summary.absentIntervals).toEqual([
      { firstAbsentDate: dates[0], lastAbsentDate: dates[3] },
    ]);
  });

  it("has honest zero/one/two-snapshot limits and requires three readable points for reappearance", () => {
    const empty = circlePulse(relationshipHistoryIndex([]));
    expect(empty.accounts.size).toBe(0);
    expect(empty.summary).toMatchObject({
      snapshotCount: 0,
      stableFollowers: 0,
      stableFollowing: 0,
      stableMutuals: 0,
    });
    expect(empty.summary.changedAccounts).toBeUndefined();
    expect(empty.summary.reappearedAccounts).toBeUndefined();
    expect(empty.summary.latestInterval).toBeUndefined();
    const single = circlePulse(relationshipHistoryIndex([snapshots[0]]));
    expect(single.summary.changedAccounts).toBeUndefined();
    expect(single.summary.followerRetention).toBeUndefined();
    expect(single.accounts.get("sample.mutual")?.stableState).toBeUndefined();
    expect(single.accounts.get("sample.mutual")?.stateChanges).toBeUndefined();
    const pair = circlePulse(history(), {
      startId: "pulse-0",
      endId: "pulse-1",
    });
    expect(pair.summary.changedAccounts).toBe(5);
    expect(pair.summary.reappearedAccounts).toBeUndefined();
    expect(pair.accounts.get("sample.reappeared")?.reappeared).toBeUndefined();
  });

  it("skips corrupt snapshots without converting them into observed empty snapshots", () => {
    const corrupt = {
      ...snapshots[0],
      id: "pulse-corrupt",
      exportDate: "2025-02-15",
      followers: ["invalid username"],
    };
    const result = circlePulse(
      relationshipHistoryIndex([
        snapshots[3],
        corrupt,
        snapshots[1],
        snapshots[0],
        snapshots[2],
      ]),
    );
    expect(result.summary.skippedSnapshots).toBe(1);
    expect(result.summary.snapshotCount).toBe(4);
    expect(result.summary.reappearedAccounts).toBe(2);
    expect(result.accounts.get("sample.mutual")?.stateChanges).toBe(0);
    expect(result.index.snapshots.map((point) => point.exportDate)).toEqual(
      dates,
    );
    const onlyCorrupt = circlePulse(relationshipHistoryIndex([corrupt]));
    expect(onlyCorrupt.summary.changedAccounts).toBeUndefined();
    expect(onlyCorrupt.summary.reappearedAccounts).toBeUndefined();
    expect(onlyCorrupt.accounts.size).toBe(0);
  });

  it("recomputes only selected observations and rejects unknown/equal/reversed ranges", () => {
    const index = history();
    const result = circlePulse(index, { startId: "pulse-1", endId: "pulse-3" });
    expect(result.summary.snapshotCount).toBe(3);
    expect(result.summary.firstDate).toBe(dates[1]);
    expect(result.summary.followingRetention).toEqual({
      retained: 3,
      total: 4,
      percentage: 75,
    });
    expect(result.accounts.get("sample.reappeared")?.reappeared).toBe(false);
    expect(result.accounts.get("sample.repeat")?.reappeared).toBe(true);
    expect(result.accounts.has("sample.old.name")).toBe(false);
    expect(result.index.names.has("sample.old.name")).toBe(false);
    for (const range of [
      { startId: "missing", endId: "pulse-3" },
      { startId: "pulse-0", endId: "missing" },
      { startId: "pulse-2", endId: "pulse-2" },
      { startId: "pulse-3", endId: "pulse-0" },
    ]) {
      expect(() => circlePulse(index, range)).toThrow(/chronological/);
      expect(() => validateCirclePulseRange(index, range)).toThrow(
        /chronological/,
      );
    }
    expect(() =>
      validateCirclePulseRange(index, { startId: "pulse-1", endId: "pulse-3" }),
    ).not.toThrow();
  });

  it("keeps zero denominators unavailable instead of inventing retention or NaN", () => {
    const first = { ...snapshots[0], followers: [], following: [] };
    const result = circlePulse(relationshipHistoryIndex([first, snapshots[3]]));
    expect(result.summary.followerRetention).toEqual({ retained: 0, total: 0 });
    expect(result.summary.followingRetention).toEqual({
      retained: 0,
      total: 0,
    });
    expect(result.summary.followerRetention?.percentage).toBeUndefined();
  });

  it("treats changed usernames as separate identities and exposes no inferred causes/events", () => {
    const result = circlePulse(history());
    expect(result.accounts.get("sample.old.name")?.latestState).toBe("absent");
    expect(result.accounts.get("sample.new.name")?.firstPresent).toBe(dates[1]);
    expect(result.accounts.get("sample.new.name")?.reappeared).toBe(false);
    expect(JSON.stringify([...result.accounts.values()])).not.toMatch(
      /renamed|refollowed|returned|unfollowed|deleted|loyal|eventTime|reason/,
    );
  });

  it("accumulates sparse observations without repeating absence scans and leaves source indexes untouched", () => {
    const points = Array.from({ length: 20 }, (_, position) => ({
      ...snapshots[0],
      id: `large-${position}`,
      exportDate: `2025-${String(Math.floor(position / 2) + 1).padStart(2, "0")}-${position % 2 ? "20" : "05"}`,
      followers: Array.from(
        { length: 250 },
        (_, index) => `synthetic.${position}.${index}`,
      ),
      following: [],
    }));
    const index = relationshipHistoryIndex(points);
    const before = index.snapshots.map((point) => [
      point.snapshotId,
      [...point.followers],
      [...point.following],
    ]);
    const result = circlePulse(index);
    expect(result.accounts.size).toBe(5000);
    expect(result.summary.changedAccounts).toBe(5000);
    expect(result.summary.reappearedAccounts).toBe(0);
    expect(result.summary.stableFollowers).toBe(0);
    expect(
      index.snapshots.map((point) => [
        point.snapshotId,
        [...point.followers],
        [...point.following],
      ]),
    ).toEqual(before);
  });

  it("produces deterministic fictional aggregate metrics without personal/private categories", () => {
    const result = circlePulse(relationshipHistoryIndex(demoVaultSnapshots()));
    expect(result.summary).toEqual({
      snapshotCount: 4,
      skippedSnapshots: 0,
      firstDate: "2025-01-15",
      latestDate: "2025-10-15",
      stableFollowers: 1037,
      stableFollowing: 827,
      stableMutuals: 687,
      changedAccounts: 396,
      reappearedAccounts: 1,
      followerRetention: {
        retained: 1038,
        total: 1110,
        percentage: (1038 / 1110) * 100,
      },
      followingRetention: {
        retained: 828,
        total: 870,
        percentage: (828 / 870) * 100,
      },
      latestInterval: {
        olderDate: "2025-07-15",
        newerDate: "2025-10-15",
        newFollowers: 82,
        missingFollowers: 24,
        newFollowing: 35,
        missingFollowing: 15,
        newMutuals: 18,
        missingMutuals: 4,
        stateChanges: 134,
      },
    });
    expect(result.accounts.get("demo.mutual.0200")?.reappeared).toBe(true);
    expect(result.accounts.get("demo.oneway.0001")?.latestState).toBe("absent");
    expect(result.accounts.get("demo.mutual.0100")?.stableState).toBe("mutual");
    expect(result.accounts.get("demo.fan.0200")?.stableState).toBe(
      "follows-you",
    );
    expect(result.accounts.get("demo.oneway.0100")?.stableState).toBe(
      "you-follow",
    );
    expect(
      [...result.accounts.keys()].every((name) => name.startsWith("demo.")),
    ).toBe(true);
    expect(JSON.stringify([...result.accounts.values()])).not.toMatch(
      /closefriend|blocked|restricted|hidden|note|watch|keep/,
    );
    expect(
      circlePulse(relationshipHistoryIndex(demoVaultSnapshots())).summary,
    ).toEqual(result.summary);
  });
});
