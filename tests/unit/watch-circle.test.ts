import { describe, expect, it } from "vitest";
import { watchCircle } from "../../src/lib/analysis/watch-circle";
import { timelineAccountIndex } from "../../src/lib/analysis/timeline-context";
import { relationshipHistoryIndex } from "../../src/lib/analysis/relationship-history";
import { account } from "../../src/lib/instagram/normalize";
import type { Dataset } from "../../src/lib/instagram/types";
import type { ReviewMemoryRecord } from "../../src/lib/review-memory";
import {
  DEMO_WATCH_EXPORT_DATE,
  demoReviewMemory,
  demoWatchSnapshots,
} from "../../src/lib/demo-review-memory";
import { demoSnapshots, demoVaultSnapshots } from "../../src/lib/demo";

const record = (username: string, watch = true): ReviewMemoryRecord => ({
  username,
  keep: false,
  reviewed: false,
  watch,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
});
const current: Dataset = {
  followers: ["sample.stable", "sample.incoming", "sample.new"].map((name) =>
    account(name)!,
  ),
  following: [
    "sample.stable",
    "sample.oneway",
    "sample.incoming",
    "sample.new",
  ].map((name) => account(name)!),
  metadata: { parsedAt: 1, sourceFormat: "test", warnings: [] },
};
const active = timelineAccountIndex(current);
const watched = [
  "sample.stable",
  "sample.oneway",
  "sample.incoming",
  "sample.new",
  "sample.gone",
].map((name) => record(name));
const snapshot = (date: string, followers: string[], following: string[]) => ({
  id: `watch-${date}`,
  version: 1,
  exportDate: date,
  createdAt: 1,
  followers,
  following,
});
const earlier = snapshot(
  "2025-01-15",
  ["sample.stable", "sample.oneway", "sample.incoming", "sample.gone"],
  ["sample.stable", "sample.oneway"],
);

describe("Watch Circle confirmed observations", () => {
  it("shows explicit watches and current export state without any unloaded change claims", () => {
    const result = watchCircle(
      [...watched, record("sample.not.watched", false)],
      active,
    );
    expect(result.status).toBe("unloaded");
    expect(result.changedCount).toBeUndefined();
    expect(result.observations).toHaveLength(5);
    expect(
      result.observations.every(
        (entry) =>
          entry.changed === undefined &&
          entry.previousState === undefined &&
          entry.currentDate === undefined,
      ),
    ).toBe(true);
    expect(
      result.observations.find((entry) => entry.username === "sample.gone")
        ?.currentState,
    ).toBe("absent");
  });
  it("reuses state classification for unchanged, mutual→you-follow, follows-you→mutual, absent→mutual and absence", () => {
    const result = watchCircle(watched, active, {
      history: relationshipHistoryIndex([earlier]),
      currentDate: "2025-02-15",
      confirmed: true,
    });
    expect(result.status).toBe("loaded");
    expect(result.changedCount).toBe(4);
    const states = new Map(
      result.observations.map((entry) => [
        entry.username,
        [entry.previousState, entry.currentState, entry.changed],
      ]),
    );
    expect(states.get("sample.stable")).toEqual(["mutual", "mutual", false]);
    expect(states.get("sample.oneway")).toEqual(["mutual", "you-follow", true]);
    expect(states.get("sample.incoming")).toEqual([
      "follows-you",
      "mutual",
      true,
    ]);
    expect(states.get("sample.new")).toEqual(["absent", "mutual", true]);
    expect(states.get("sample.gone")).toEqual(["follows-you", "absent", true]);
    expect(result.previousSnapshotDate).toBe("2025-01-15");
    expect(result.currentDate).toBe("2025-02-15");
  });
  it("rejects unconfirmed, missing and impossible export dates in the model itself", () => {
    const history = relationshipHistoryIndex([earlier]);
    expect(() =>
      watchCircle(watched, active, {
        history,
        currentDate: "2025-02-15",
        confirmed: false,
      }),
    ).toThrow(/Confirm/);
    for (const currentDate of ["", "invalid", "2025-02-30"])
      expect(() =>
        watchCircle(watched, active, { history, currentDate, confirmed: true }),
      ).toThrow(/date/);
  });
  it("uses exactly the latest strictly earlier readable point, skipping equal/future and corrupt points", () => {
    const valid = snapshot(
      "2025-03-15",
      ["sample.stable"],
      ["sample.stable", "sample.oneway"],
    );
    const corrupt = {
      ...snapshot("2025-03-25", [], []),
      followers: ["invalid username"],
    };
    const history = relationshipHistoryIndex([
      snapshot("2025-05-15", [], []),
      earlier,
      corrupt,
      snapshot("2025-04-15", [], []),
      valid,
    ]);
    const result = watchCircle(watched, active, {
      history,
      currentDate: "2025-04-15",
      confirmed: true,
    });
    expect(result.previousSnapshotDate).toBe("2025-03-15");
    expect(result.skippedSnapshots).toBe(1);
    expect(
      result.observations.find((entry) => entry.username === "sample.oneway")
        ?.previousState,
    ).toBe("you-follow");
  });
  it("does not manufacture absent observations or no-change claims from unreadable/no-earlier history", () => {
    const corrupt = { ...earlier, followers: ["invalid username"] };
    for (const snapshots of [[corrupt], [earlier], []]) {
      const result = watchCircle(watched, active, {
        history: relationshipHistoryIndex(snapshots),
        currentDate: "2025-01-15",
        confirmed: true,
      });
      expect(result.status).toBe("unavailable");
      expect(result.changedCount).toBeUndefined();
      expect(
        result.observations.every(
          (entry) =>
            entry.previousState === undefined && entry.changed === undefined,
        ),
      ).toBe(true);
    }
  });
  it("normalizes and deduplicates watched identities, excludes flags/notes from facts and leaves inputs unchanged", () => {
    const records = [
      record("SAMPLE.STABLE"),
      {
        ...record("@sample.stable"),
        note: "private note should never enter observations",
        keep: true,
      },
      record("invalid username"),
      { ...record("sample.no.watch", false), reviewed: true },
    ];
    const before = JSON.stringify(records);
    const result = watchCircle(records, active, {
      history: relationshipHistoryIndex([earlier]),
      currentDate: "2025-02-15",
      confirmed: true,
    });
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].username).toBe("sample.stable");
    expect(JSON.stringify(result)).not.toMatch(
      /private note|keep|reviewed|updatedAt/,
    );
    expect(JSON.stringify(records)).toBe(before);
  });
  it("demonstrates three fictional watches/two changes without changing core demo or Vault fixtures", () => {
    const demo = demoSnapshots().newer;
    const result = watchCircle(demoReviewMemory(), timelineAccountIndex(demo), {
      history: relationshipHistoryIndex(demoWatchSnapshots()),
      currentDate: DEMO_WATCH_EXPORT_DATE,
      confirmed: true,
    });
    expect(result.observations).toHaveLength(3);
    expect(result.changedCount).toBe(2);
    expect(
      result.observations.find((entry) => entry.username === "demo.mutual.0100")
        ?.changed,
    ).toBe(false);
    expect(
      result.observations.find((entry) => entry.username === "demo.oneway.0001")
        ?.previousState,
    ).toBe("mutual");
    expect(
      result.observations.find((entry) => entry.username === "demo.mutual.0001")
        ?.previousState,
    ).toBe("follows-you");
    expect(demo.followers).toHaveLength(1284);
    expect(demo.following).toHaveLength(932);
    expect(demoVaultSnapshots().map((entry) => entry.exportDate)).toEqual([
      "2025-10-15",
      "2025-07-15",
      "2025-04-15",
      "2025-01-15",
    ]);
    expect(
      result.observations.every((entry) => entry.username.startsWith("demo.")),
    ).toBe(true);
  });
});
