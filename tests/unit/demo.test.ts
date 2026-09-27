import { expect, it } from "vitest";
import { demoSnapshots } from "../../src/lib/demo";
import {
  analyze,
  compareSnapshots,
} from "../../src/lib/analysis/relationships";
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
