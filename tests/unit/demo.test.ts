import { describe, expect, it } from "vitest";
import { demoSnapshots } from "../../src/lib/demo";
import { analyze, compareSnapshots } from "../../src/lib/analysis/relationships";
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
  expect(
    newer.followers.every(
      (a) => a.username.startsWith("demo.") && !!a.timestamp,
    ),
  ).toBe(true);
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
      expect(list.accounts.filter((entry) => entry.timestamp !== undefined))
        .toHaveLength(count - 1);
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
