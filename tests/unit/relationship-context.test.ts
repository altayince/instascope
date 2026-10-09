import { describe, it, expect } from "vitest";
import {
  relationshipHistory,
  relationshipHistoryIndex,
  accountHistory,
  historyTransitions,
  savedHistoryContext,
} from "../../src/lib/analysis/relationship-history";
import {
  mutualOrigins,
  mutualOriginSummary,
  MUTUAL_ORIGIN_CAVEAT,
} from "../../src/lib/analysis/mutual-origins";
import { account } from "../../src/lib/instagram/normalize";
import type { Dataset } from "../../src/lib/instagram/types";
import { demoSnapshots, demoVaultSnapshots } from "../../src/lib/demo";
import { buildStories } from "../../src/lib/analysis/stories";
import {
  analyze,
  compareSnapshots,
} from "../../src/lib/analysis/relationships";
const snapshot = (date: string, followers: string[], following: string[]) => ({
  id: `snapshot-${date}`,
  version: 1,
  exportDate: date,
  createdAt: 1,
  followers,
  following,
});
const date = (s: string) => Date.parse(s) / 1000;
const sample = (
  followers: Dataset["followers"],
  following: Dataset["following"],
): Dataset => ({
  followers,
  following,
  metadata: { sourceFormat: "test", parsedAt: 1, warnings: [] },
});
describe("observed account history", () => {
  const first = "2025-01-15",
    second = "2025-04-15";
  const states = {
    mutual: [["sample"], ["sample"]],
    "you-follow": [[], ["sample"]],
    "follows-you": [["sample"], []],
    absent: [[], []],
  };
  for (const [before, after, text] of [
    ["mutual", "mutual", ""],
    ["mutual", "you-follow", "Not present in Followers"],
    ["mutual", "follows-you", "Not present in Following"],
    ["you-follow", "absent", "Not present in Following"],
    ["follows-you", "mutual", "Now also present in Following"],
    ["absent", "mutual", "Present in both lists"],
  ] as const)
    it(`${before} → ${after} reports presence without exact event claims`, () => {
      const points = relationshipHistory(" @SAMPLE ", [
        snapshot(second, ...(states[after] as [string[], string[]])),
        snapshot(first, ...(states[before] as [string[], string[]])),
      ]);
      expect(points.map((p) => p.exportDate)).toEqual([first, second]);
      expect(points.map((p) => p.state)).toEqual([before, after]);
      const transitions = historyTransitions(points);
      if (text) {
        expect(JSON.stringify(transitions)).toContain(text);
        expect(transitions[0].olderDate).toBe(first);
      } else expect(transitions).toEqual([]);
      expect(JSON.stringify(transitions)).not.toMatch(
        /unfollowed on|stopped following on|followed back on|exactly|blocked|deleted/i,
      );
    });
  it("normalizes URLs, handles one snapshot and skips corrupt records without fabricating absent points", () => {
    const index = relationshipHistoryIndex([
      snapshot(first, ["SAMPLE"], []),
      { bad: true },
      snapshot("2025-02-30", [], []),
    ]);
    expect(index.corrupt).toBe(2);
    expect(
      accountHistory("https://www.instagram.com/SAMPLE/", index).map(
        (p) => p.state,
      ),
    ).toEqual(["follows-you"]);
    expect(historyTransitions(accountHistory("sample", index))).toEqual([]);
    expect(() => accountHistory("https://evil.test/sample", index)).toThrow();
  });
  it("uses only earlier saved snapshots after date and same-account confirmation", () => {
    const index = relationshipHistoryIndex([
      snapshot(first, ["sample"], ["sample"]),
      snapshot(second, ["future"], ["sample"]),
    ]);
    expect(() =>
      savedHistoryContext(index, ["sample"], second, false, "one-way"),
    ).toThrow(/Confirm/);
    expect(() =>
      savedHistoryContext(index, ["sample"], "2025-02-30", true, "review"),
    ).toThrow(/date/);
    const result = savedHistoryContext(
      index,
      ["sample"],
      second,
      true,
      "one-way",
    );
    expect(result.snapshotCount).toBe(1);
    expect(result.context.get("sample")).toEqual([
      "Previously mutual in saved history",
    ]);
    expect(
      savedHistoryContext(index, ["future"], second, true, "fans").context.size,
    ).toBe(0);
    expect(
      savedHistoryContext(index, ["sample"], second, true, "fans").context.get(
        "sample",
      ),
    ).toEqual(["You followed this account in saved history"]);
  });
  it("keeps fictional totals stable while demonstrating changing, incoming and stable relationships", () => {
    const snapshots = demoVaultSnapshots();
    expect(
      relationshipHistory("demo.oneway.0001", snapshots).map((p) => p.state),
    ).toEqual(["mutual", "mutual", "you-follow", "absent"]);
    expect(
      relationshipHistory("demo.fan.0001", snapshots).map((p) => p.state),
    ).toEqual(["follows-you", "mutual", "mutual", "mutual"]);
    expect(
      relationshipHistory("demo.mutual.0100", snapshots).map((p) => p.state),
    ).toEqual(["mutual", "mutual", "mutual", "mutual"]);
    expect(
      snapshots.map((s) => [s.followers.length, s.following.length]),
    ).toEqual([
      [1284, 930],
      [1226, 910],
      [1168, 890],
      [1110, 870],
    ]);
  });
});
describe("recorded mutual origins", () => {
  const early = date("2021-03-12T12:00:00Z"),
    late = date("2021-03-18T12:00:00Z");
  for (const [follower, following, origin] of [
    [early, late, "they-first"],
    [late, early, "you-first"],
    [early, early + 3600, "same-recorded-day"],
    [early, undefined, "unknown"],
    [undefined, early, "unknown"],
    [undefined, undefined, "unknown"],
    [NaN, late, "unknown"],
  ] as const)
    it(`classifies ${origin} for ${follower}/${following}`, () => {
      const [r] = mutualOrigins(
        sample([account("sample", follower)!], [account("sample", following)!]),
      );
      expect(r.origin).toBe(origin);
      if (origin === "unknown" || origin === "same-recorded-day")
        expect(r.dayGap).toBeUndefined();
      else expect(r.dayGap).toBe(6);
    });
  it("compares HTML only by calendar day and never creates an elapsed day gap, including mixed sources", () => {
    const input = sample(
      [
        account("same", early + 36000, "minute-without-timezone")!,
        account("earlier", early, "minute-without-timezone")!,
      ],
      [
        account("same", early - 36000, "minute-without-timezone")!,
        account("earlier", late)!,
      ],
    );
    const origins = mutualOrigins(input);
    expect(origins.map((r) => r.origin)).toEqual([
      "same-recorded-day",
      "they-first",
    ]);
    expect(origins.every((r) => r.dayGap === undefined)).toBe(true);
    expect(origins[0].followerPrecision).toBe("minute-without-timezone");
    expect(MUTUAL_ORIGIN_CAVEAT).toMatch(/refollows/);
    expect(MUTUAL_ORIGIN_CAVEAT).toMatch(/no timezone/);
  });
  it("normalizes and deduplicates both sides without double-counting a mutual", () => {
    const origins = mutualOrigins(
      sample(
        [account("SAMPLE", early)!, account("sample", late)!],
        [account("sample", late)!, account("SAMPLE", late + 86400)!],
      ),
    );
    expect(origins).toHaveLength(1);
    expect(origins[0].origin).toBe("they-first");
    expect(origins[0].followerTimestamp).toBe(early);
    expect(origins[0].followingTimestamp).toBe(late);
  });
  it("demo covers all categories and excludes unknowns from the percentage denominator", () => {
    const records = mutualOrigins(demoSnapshots().newer),
      summary = mutualOriginSummary(records);
    for (const count of Object.values(summary.counts))
      expect(count).toBeGreaterThan(0);
    expect(summary.dated).toBe(719);
    expect(summary.counts.unknown).toBe(23);
    expect(summary.theyFirstPercent).toBe(
      Math.round((summary.counts["they-first"] / 719) * 100),
    );
  });
});
describe("aggregate recorded-first Wrapped story", () => {
  it("private lists cannot affect the recorded-first card or its percentage", () => {
    const { newer } = demoSnapshots();
    const original = buildStories(analyze(newer), newer, null).find(
      (s) => s.id === "origins",
    );
    const changed = { ...newer, connections: undefined };
    expect(
      buildStories(analyze(changed), changed, null).find(
        (s) => s.id === "origins",
      ),
    ).toEqual(original);
  });
  it("adds at most one supported story and leaves every prior story unchanged", () => {
    const { newer, older } = demoSnapshots();
    const comparison = compareSnapshots(older, newer);
    const stories = buildStories(analyze(newer), newer, comparison);
    const withoutFollowerDates = {
      ...newer,
      followers: newer.followers.map((a) => ({ ...a, timestamp: undefined })),
    };
    expect(stories.filter((s) => s.id !== "origins")).toEqual(
      buildStories(
        analyze(withoutFollowerDates),
        withoutFollowerDates,
        comparison,
      ),
    );
    const origin = stories.find((s) => s.id === "origins")!;
    expect(stories.filter((s) => s.id === "origins")).toHaveLength(1);
    const summary = mutualOriginSummary(mutualOrigins(newer));
    expect(origin.heroValue).toBe(`${summary.theyFirstPercent}%`);
    expect(origin.note).toMatch(/Refollows|recorded/);
    expect(origin.note).toMatch(/first-ever/);
    expect(JSON.stringify(origin)).not.toMatch(
      /demo\.|closefriend|blocked|restricted|hidden/,
    );
  });
  it("requires ten usable dated mutuals", () => {
    for (const count of [0, 9, 10]) {
      const records = Array.from({ length: count }, (_, i) =>
        account(`sample.${i}`, date("2020-01-01"))!,
      );
      const current = sample(records, records);
      expect(
        buildStories(analyze(current), current, null).some(
          (s) => s.id === "origins",
        ),
      ).toBe(count >= 10);
    }
  });
});

it("indexes a larger synthetic Vault once and reuses Sets for many account lookups without mutation", () => {
  const names = Array.from(
    { length: 5000 },
    (_, i) => `sample.${String(i).padStart(5, "0")}`,
  );
  const snapshots = Array.from({ length: 12 }, (_, i) =>
    snapshot(`2025-${String(i + 1).padStart(2, "0")}-15`, names, names),
  );
  const index = relationshipHistoryIndex(snapshots);
  for (const name of names.slice(0, 200))
    expect(accountHistory(name, index).map((p) => p.state)).toEqual(
      Array(12).fill("mutual"),
    );
  expect(index.names.size).toBe(5000);
  expect(snapshots[0].followers).toBe(names);
  expect(snapshots[0].following).toBe(names);
});
