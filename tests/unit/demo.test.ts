import { describe, expect, it } from "vitest";
import { demoSnapshots, demoVaultSnapshots } from "../../src/lib/demo";
import {
  compareVaultSnapshots,
  validateVaultSnapshot,
} from "../../src/lib/snapshot-vault";
import { relationshipTimeline } from "../../src/lib/analysis/insights";
import {
  analyze,
  compareSnapshots,
} from "../../src/lib/analysis/relationships";
import { buildStories } from "../../src/lib/analysis/stories";
import type { ConnectionKind } from "../../src/lib/instagram/types";

it("provides consistent fictional counts, dated accounts and two meaningful snapshots", () => {
  const { newer, older } = demoSnapshots();
  const result = analyze(newer);
  expect([
    result.followers.length,
    result.following.length,
    result.mutuals.length,
    result.notFollowingBack.length,
    result.fans.length,
  ]).toEqual([1284, 932, 742, 190, 542]);
  expect(newer.followers.every((a) => a.username.startsWith("demo."))).toBe(
    true,
  );
  expect(newer.metadata.demo && older.metadata.demo).toBe(true);
  const changes = compareSnapshots(older, newer);
  expect([
    changes.newFollowers.length,
    changes.lostFollowers.length,
    changes.followerDelta,
  ]).toEqual([25, 10, 15]);
  expect(newer.followers.length).toBeGreaterThan(50);
  newer.followers.length = 0;
  expect(demoSnapshots().newer.followers).toHaveLength(1284);
});

it("demonstrates deterministic missing-date coverage without losing Timeline or Wrapped stories", () => {
  const { newer, older } = demoSnapshots();
  expect(demoSnapshots()).toEqual({ newer, older });
  for (const accounts of [newer.followers, newer.following]) {
    const unknown = accounts.filter((a) => a.timestamp === undefined).length;
    expect(unknown / accounts.length).toBeGreaterThanOrEqual(0.02);
    expect(unknown / accounts.length).toBeLessThanOrEqual(0.05);
    expect(accounts[0].timestamp).toBeDefined();
    expect(accounts.at(-1)?.timestamp).toBeDefined();
  }
  const timeline = relationshipTimeline(newer);
  expect(timeline.coverage.followers).toBe(1244);
  expect(timeline.coverage.following).toBe(903);
  expect(timeline.periods.length).toBeGreaterThan(1);
  expect(
    buildStories(analyze(newer), newer, compareSnapshots(older, newer)).length,
  ).toBeGreaterThan(4);
});

it("provides four fresh fictional Vault records with meaningful changes for every chronological pair", () => {
  const snapshots = demoVaultSnapshots().reverse();
  expect(snapshots.map((s) => s.exportDate)).toEqual([
    "2025-01-15",
    "2025-04-15",
    "2025-07-15",
    "2025-10-15",
  ]);
  for (const snapshot of snapshots) {
    expect(validateVaultSnapshot(snapshot)).toEqual(snapshot);
    expect(
      [...snapshot.followers, ...snapshot.following].every((name) =>
        name.startsWith("demo."),
      ),
    ).toBe(true);
  }
  for (let i = 0; i < snapshots.length; i++) {
    for (let j = i + 1; j < snapshots.length; j++) {
      expect(() =>
        compareVaultSnapshots(snapshots[i], snapshots[j], false),
      ).toThrow(/Confirm/);
      const result = compareVaultSnapshots(snapshots[i], snapshots[j], true);
      for (const key of [
        "newFollowers",
        "lostFollowers",
        "newFollowing",
        "removedFollowing",
        "newMutuals",
        "lostMutuals",
      ] as const) {
        expect(result[key].length).toBeGreaterThan(0);
      }
      expect(result.followerDelta).toBeGreaterThan(0);
    }
  }
  snapshots[0].followers.length = 0;
  expect(demoVaultSnapshots().at(-1)!.followers.length).toBe(1110);
});

const privacyLists = [
  ["closeFriends", "closefriend", 8],
  ["blocked", "blocked", 4],
  ["restricted", "restricted", 3],
  ["hideStoryFrom", "hidden", 5],
] as const satisfies ReadonlyArray<readonly [ConnectionKind, string, number]>;

describe("fictional Connection Privacy demo", () => {
  it("populates every privacy category with deterministic demo accounts and sample dates", () => {
    const { newer } = demoSnapshots();
    expect(newer.metadata.demo).toBe(true);
    for (const [kind, prefix, count] of privacyLists) {
      const list = newer.connections![kind];
      expect(list.status).toBe("available");
      expect(list.accounts).toHaveLength(count);
      expect(list.accounts.map((entry) => entry.username)).toEqual(
        Array.from(
          { length: count },
          (_, index) => `demo.${prefix}.${String(index + 1).padStart(4, "0")}`,
        ),
      );
      expect(
        list.accounts.filter((entry) => entry.timestamp !== undefined),
      ).toHaveLength(count - 1);
      expect(list.accounts.at(-1)?.timestamp).toBeUndefined();
    }
  });

  it("keeps private-list accounts and counts out of Wrapped stories", () => {
    const { newer, older } = demoSnapshots();
    const withoutPrivacy = {
      ...newer,
      connections: {
        ...newer.connections!,
        closeFriends: { status: "available" as const, accounts: [] },
        blocked: { status: "available" as const, accounts: [] },
        restricted: { status: "available" as const, accounts: [] },
        hideStoryFrom: { status: "available" as const, accounts: [] },
      },
    };
    const comparison = compareSnapshots(older, newer);
    const stories = buildStories(analyze(newer), newer, comparison);
    expect(stories).toEqual(
      buildStories(analyze(withoutPrivacy), withoutPrivacy, comparison),
    );
    expect(JSON.stringify(stories)).not.toMatch(
      /demo\.(closefriend|blocked|restricted|hidden)\.|close friends|blocked accounts|restricted accounts|story hidden from/i,
    );
  });
});
