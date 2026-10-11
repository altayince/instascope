import { describe, expect, it } from "vitest";
import { account } from "../../src/lib/instagram/normalize";
import type { Dataset } from "../../src/lib/instagram/types";
import {
  analyze,
  compareSnapshots,
} from "../../src/lib/analysis/relationships";
import {
  buildStories,
  buildSavedSnapshotStories,
} from "../../src/lib/analysis/stories";
import { circlePulse } from "../../src/lib/analysis/circle-pulse";
import { relationshipHistoryIndex } from "../../src/lib/analysis/relationship-history";

const date = (value: string) => Date.parse(`${value}T00:00:00Z`) / 1000;
const dataset = (
  following: Dataset["following"],
  followers = following,
): Dataset => ({
  followers,
  following,
  metadata: { parsedAt: Date.now(), sourceFormat: "test", warnings: [] },
});

describe("saved-only Circle Pulse stories", () => {
  const snapshots = [
    {
      id: "story-first",
      version: 1,
      exportDate: "2025-01-15",
      createdAt: 1,
      followers: ["private.stable", "private.retained", "private.missing"],
      following: ["private.stable", "private.outgoing"],
    },
    {
      id: "story-middle",
      version: 1,
      exportDate: "2025-04-15",
      createdAt: 2,
      followers: ["private.stable"],
      following: ["private.stable", "private.outgoing"],
    },
    {
      id: "story-latest",
      version: 1,
      exportDate: "2025-10-15",
      createdAt: 3,
      followers: ["private.stable", "private.retained", "private.new"],
      following: ["private.stable", "private.outgoing"],
    },
  ];
  const summary = circlePulse(relationshipHistoryIndex(snapshots)).summary;

  it("adds at most two cards with correct endpoint retention, including reappeared records", () => {
    const stories = buildSavedSnapshotStories(summary);
    expect(stories.map((story) => story.id)).toEqual([
      "stable-core",
      "still-here",
    ]);
    expect(stories[0].heroValue).toBe("1");
    expect(stories[0].facts).toContainEqual({
      value: "3",
      label: "readable saved snapshots",
    });
    expect(stories[1].heroValue).toBe("66.7%");
    expect(stories[1].heroLabel).toContain("2 of 3 first-snapshot followers");
    expect(stories[1].note).toContain("does not prove uninterrupted following");
    expect(
      buildSavedSnapshotStories({
        ...summary,
        followerRetention: { retained: 2, total: 3, percentage: 99 },
      })[1].heroValue,
    ).toBe("66.7%");
    expect(JSON.stringify(stories)).not.toMatch(
      /private\.|username|loyal|ghosted|refollowed|returned/i,
    );
  });

  it("omits unsupported stories for one snapshot, no stable mutuals or empty baselines", () => {
    expect(buildSavedSnapshotStories(null)).toEqual([]);
    expect(
      buildSavedSnapshotStories(
        circlePulse(relationshipHistoryIndex(snapshots.slice(0, 1))).summary,
      ),
    ).toEqual([]);
    expect(
      buildSavedSnapshotStories({ ...summary, stableMutuals: 0 }).map(
        (s) => s.id,
      ),
    ).toEqual(["still-here"]);
    expect(
      buildSavedSnapshotStories({
        ...summary,
        stableMutuals: 0,
        followerRetention: { retained: 0, total: 0 },
      }),
    ).toEqual([]);
    expect(
      buildSavedSnapshotStories({ ...summary, firstDate: "2025-02-30" }),
    ).toEqual([]);
    expect(
      buildSavedSnapshotStories({ ...summary, latestDate: summary.firstDate }),
    ).toEqual([]);
  });

  it("discloses excluded records and never imports active/private/review metadata into stories", () => {
    const excluded = circlePulse(
      relationshipHistoryIndex([...snapshots, { id: "corrupt" }]),
    ).summary;
    const stories = buildSavedSnapshotStories(excluded);
    expect(
      stories.every((s) => s.note.includes("Unreadable snapshots excluded")),
    ).toBe(true);
    const decorated = {
      ...excluded,
      username: "private.sentinel",
      notes: ["Never share this private note"],
      watch: true,
      blocked: ["private.blocked"],
      closeFriendsCount: 99,
    };
    expect(buildSavedSnapshotStories(decorated)).toEqual(stories);
    const active = dataset([account("foreign.active")!]);
    const original = buildStories(analyze(active), active, null);
    expect(original.map((s) => s.id)).toEqual(["circle", "orbit"]);
    expect(buildStories(analyze(active), active, null)).toEqual(original);
  });
});

describe("Wrapped relationship stories", () => {
  it("offers only undated circle stories without usable dates or comparison", () => {
    const current = dataset(
      [account("private.one")!],
      [account("private.two")!],
    );
    const stories = buildStories(analyze(current), current, null);
    expect(stories.map((story) => story.id)).toEqual(["circle", "orbit"]);
    expect(stories[0].heroValue).toBe("0%");
    expect(JSON.stringify(stories)).not.toMatch(/private\.one|private\.two/);
  });

  it("uses a count instead of an undefined percentage when following is empty", () => {
    const current = dataset([], [account("only.follower")!]);
    const [circle] = buildStories(analyze(current), current, null);
    expect(circle.heroValue).toBe("1");
    expect(circle.heroLabel).toBe("followers recorded in this export");
  });

  it("adds dated timeline and multi-year archaeology without claiming continuity", () => {
    const current = dataset([
      account("old.one", date("2020-01-01"))!,
      account("old.two", date("2020-08-01"))!,
      account("new.one", date("2023-02-03"))!,
      account("unknown")!,
    ]);
    const stories = buildStories(analyze(current), current, null);
    expect(stories.map((story) => story.id)).toEqual([
      "circle",
      "orbit",
      "timeline",
      "archaeology",
      "discovery",
      "timecapsule",
    ]);
    expect(stories.find((s) => s.id === "timeline")!.facts).toContainEqual({
      value: "1",
      label: "current follows without dates",
    });
    expect(stories.find((s) => s.id === "archaeology")!.heroValue).toBe("2020");
    expect(stories.find((s) => s.id === "archaeology")!.facts).toContainEqual({
      value: "2",
      label: "current follows recorded that year",
    });
    expect(JSON.stringify(stories)).not.toMatch(/old\.one|old\.two|new\.one/);
    expect(stories.find((s) => s.id === "timeline")!.note).toMatch(
      /do not prove continuous following/,
    );
  });

  it("adds comparison only with two snapshots and excludes private lists", () => {
    const older = dataset([account("a")!, account("b")!], [account("a")!]);
    const newer = dataset([account("a")!, account("c")!], [account("c")!]);
    newer.connections = {
      pendingRequests: {
        status: "available",
        accounts: [account("private.request")!],
      },
    } as Dataset["connections"];
    const stories = buildStories(
      analyze(newer),
      newer,
      compareSnapshots(older, newer),
    );
    expect(stories.map((story) => story.id)).toEqual([
      "circle",
      "orbit",
      "changes",
      "turnover",
    ]);
    expect(stories.find((s) => s.id === "changes")!.heroValue).toBe("0");
    expect(stories.find((s) => s.id === "changes")!.facts).toContainEqual({
      value: "1",
      label: "missing followers",
    });
    expect(JSON.stringify(stories)).not.toMatch(/private\.request|"a"|"b"|"c"/);
  });
});

describe("shareable derived stories", () => {
  it("counts a unique social orbit and does not double-count mutuals or duplicates", () => {
    const current = dataset(
      [account("mutual")!, account("out")!, account("mutual")!],
      [account("mutual")!, account("in")!],
    );
    const orbit = buildStories(analyze(current), current, null).find(
      (s) => s.id === "orbit",
    )!;
    expect(orbit.heroValue).toBe("3");
    expect(orbit.bars?.map((b) => b.value)).toEqual([1, 1, 1]);
  });

  it("uses dated survivors only for discovery and earliest-year mutuals, resolving ties deterministically", () => {
    const current = dataset(
      [
        account("first", date("2020-01-31"))!,
        account("oneway", date("2020-02-01"))!,
        account("later", date("2024-01-01"))!,
        account("undated")!,
        account("first", date("2020-01-31"))!,
      ],
      [account("first")!, account("later")!, account("undated")!],
    );
    const stories = buildStories(analyze(current), current, null);
    const discovery = stories.find((s) => s.id === "discovery")!;
    expect(discovery.heroValue).toBe("Jan '20");
    expect(discovery.facts[0].value).toBe("33%");
    expect(discovery.facts[1].value).toBe("3");
    const capsule = stories.find((s) => s.id === "timecapsule")!;
    expect(capsule.heroValue).toBe("1");
    expect(capsule.facts[1].value).toBe("50%");
    expect(capsule.note).toContain("do not prove uninterrupted");
  });

  it("keeps HTML wall-date semantics, unknown dates and import time independent", () => {
    const current = dataset([
      {
        ...account("first", date("2020-01-31"))!,
        timestampPrecision: "minute-without-timezone",
      },
      account("later", date("2024-01-01"))!,
      account("unknown")!,
    ]);
    const original = JSON.stringify(current);
    const stories = buildStories(analyze(current), current, null);
    for (const id of ["timeline", "archaeology", "discovery", "timecapsule"]) {
      expect(stories.find((s) => s.id === id)?.note).toContain(
        "HTML dates have no timezone",
      );
    }
    expect(JSON.stringify(current)).toBe(original);
    current.metadata.parsedAt = 0;
    expect(buildStories(analyze(current), current, null)).toEqual(stories);
  });

  it("does not invent dated cards for an empty dataset or mutual cohorts that do not exist", () => {
    const empty = dataset([]);
    expect(buildStories(analyze(empty), empty, null).map((s) => s.id)).toEqual([
      "circle",
    ]);
    const oneYear = dataset([account("solo", date("2024-01-01"))!], []);
    expect(
      buildStories(analyze(oneYear), oneYear, null).map((s) => s.id),
    ).toEqual(["circle", "orbit", "timeline"]);
  });

  it("reveals turnover even when net growth is zero without implying actions or causality", () => {
    const older = dataset([], [account("old")!]);
    const newer = dataset([], [account("new")!]);
    const stories = buildStories(
      analyze(newer),
      newer,
      compareSnapshots(older, newer),
    );
    const turnover = stories.find((s) => s.id === "turnover")!;
    expect(turnover.heroValue).toBe("2");
    expect(turnover.facts[0].value).toBe("0");
    expect(turnover.note).toContain("not a count of actions");
    expect(JSON.stringify(stories)).not.toMatch(/"old"|"new"/);
    const unchanged = buildStories(
      analyze(newer),
      newer,
      compareSnapshots(newer, newer),
    );
    expect(unchanged.find((s) => s.id === "turnover")?.heroValue).toBe("0");
  });
});
