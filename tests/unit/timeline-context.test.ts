import { describe, it, expect } from "vitest";
import { account } from "../../src/lib/instagram/normalize";
import type { Dataset, ConnectionKind } from "../../src/lib/instagram/types";
import {
  connectionKinds,
  missingConnection,
} from "../../src/lib/instagram/connections";
import {
  timelineAccountIndex,
  timelineAccountSummary,
  timelineAccountContext,
  connectionContextLabels,
} from "../../src/lib/analysis/timeline-context";
import { relationshipHistoryIndex } from "../../src/lib/analysis/relationship-history";
import { mutualOrigins } from "../../src/lib/analysis/mutual-origins";
import { demoSnapshots, demoVaultSnapshots } from "../../src/lib/demo";

const day = (d: number, h = 0) => Date.UTC(2021, 0, d, h) / 1000;
const current: Dataset = {
  followers: [
    account("SAMPLE.MUTUAL", day(1))!,
    account("sample.follower", day(2))!,
    account("sample.unknown")!,
    account("sample.same", day(3, 23), "minute-without-timezone")!,
  ],
  following: [
    account("sample.mutual", day(7))!,
    account("sample.following", day(1))!,
    account("sample.unknown", day(4))!,
    account("sample.same", day(3, 1), "minute-without-timezone")!,
  ],
  metadata: { sourceFormat: "test", parsedAt: 1, warnings: [] },
};
const snapshot = (
  exportDate: string,
  followers: string[],
  following: string[],
) => ({
  id: `timeline-${exportDate}`,
  version: 1,
  createdAt: 1,
  exportDate,
  followers,
  following,
});
const records = [
  snapshot("2025-10-15", [], []),
  snapshot(
    "2025-01-15",
    ["sample.mutual", "sample.follower"],
    ["sample.mutual", "sample.following"],
  ),
  snapshot("2025-07-15", [], ["sample.mutual"]),
  snapshot("2025-04-15", ["sample.mutual"], ["sample.mutual"]),
  { ...snapshot("2025-08-15", [], []), followers: ["invalid name"] },
];
describe("Timeline relationship summaries", () => {
  it("keeps export direction, normalization and date precision; reuses mutual origins", () => {
    const index = timelineAccountIndex(current);
    const result = timelineAccountSummary(
      "https://www.instagram.com/SAMPLE.MUTUAL/",
      index,
    );
    expect(result.state).toBe("mutual");
    expect(result.follower?.timestamp).toBe(day(1));
    expect(result.following?.timestamp).toBe(day(7));
    expect(result.origin).toEqual(
      mutualOrigins(current).find((r) => r.username === "sample.mutual"),
    );
    expect(timelineAccountSummary("sample.follower", index).state).toBe(
      "follows-you",
    );
    expect(timelineAccountSummary("sample.following", index).state).toBe(
      "you-follow",
    );
    expect(timelineAccountSummary("sample.unknown", index).origin?.origin).toBe(
      "unknown",
    );
    const same = timelineAccountSummary("sample.same", index);
    expect(same.origin?.origin).toBe("same-recorded-day");
    expect(same.origin?.dayGap).toBeUndefined();
    expect(same.follower?.timestampPrecision).toBe("minute-without-timezone");
    expect(timelineAccountSummary("saved.only", index).state).toBeUndefined();
    expect(() => timelineAccountSummary("invalid name", index)).toThrow();
  });
  it("reports containing vs readable snapshots and adjacent changes without corrupt/absent fabricated presence", () => {
    const index = timelineAccountIndex(current),
      history = relationshipHistoryIndex(records);
    const result = timelineAccountSummary("sample.mutual", index, history);
    expect(history.corrupt).toBe(1);
    expect(result.points?.map((p) => p.state)).toEqual([
      "mutual",
      "mutual",
      "you-follow",
      "absent",
    ]);
    expect(result.readableSnapshots).toBe(4);
    expect(result.containingSnapshots).toBe(3);
    expect(result.transitions).toHaveLength(2);
    expect(result.firstPresent).toBe("2025-01-15");
    expect(result.latestPresent).toBe("2025-07-15");
    const never = timelineAccountSummary("never.recorded", index, history);
    expect(never.containingSnapshots).toBe(0);
    expect(never.firstPresent).toBeUndefined();
    expect(never.latestPresent).toBeUndefined();
    expect(never.state).toBeUndefined();
    expect(
      timelineAccountSummary("sample.mutual", index).readableSnapshots,
    ).toBeUndefined();
    expect(
      timelineAccountSummary(
        "sample.mutual",
        index,
        relationshipHistoryIndex([records[1]]),
      ).transitions,
    ).toEqual([]);
    expect(
      timelineAccountSummary(
        "sample.mutual",
        index,
        relationshipHistoryIndex([{ bad: true }]),
      ).readableSnapshots,
    ).toBe(0);
  });
});
describe("Timeline supported context", () => {
  it("uses only available active-export optional records, without treating private-only names as current absent", () => {
    const connections = Object.fromEntries(
      connectionKinds.map((kind) => [kind, missingConnection()]),
    ) as NonNullable<Dataset["connections"]>;
    for (const kind of Object.keys(connectionContextLabels) as ConnectionKind[])
      connections[kind] = {
        status: "available",
        accounts: [account("sample.private")!, account("SAMPLE.PRIVATE")!],
      };
    const index = timelineAccountIndex({ ...current, connections });
    expect(timelineAccountContext("sample.private", index).current).toEqual(
      Object.values(connectionContextLabels),
    );
    expect(index.names.has("sample.private")).toBe(true);
    expect(
      timelineAccountSummary("sample.private", index).state,
    ).toBeUndefined();
    connections.blocked = {
      status: "unsupported",
      accounts: [],
      message: "Unsupported",
    };
    connections.closeFriends = {
      status: "missing",
      accounts: [],
      message: "Missing",
    };
    connections.restricted = { status: "available", accounts: [] };
    const partial = timelineAccountContext(
      "sample.private",
      timelineAccountIndex({ ...current, connections }),
    );
    expect(partial.current).not.toContain("Blocked account record");
    expect(partial.current).not.toContain("Close Friends record");
    expect(partial.current).not.toContain("Restricted account record");
    expect(timelineAccountContext("never.recorded", index).current).toEqual([]);
    expect(timelineAccountContext("sample.mutual", index).current).toEqual([
      "Mutual in current export",
    ]);
  });
  it("requires a valid explicit export date and confirmation for earlier facts, never import time", () => {
    const index = timelineAccountIndex(current),
      history = relationshipHistoryIndex(records);
    for (const name of ["sample.mutual", "sample.follower", "sample.following"])
      for (const [date, confirmed] of [
        [undefined, true],
        ["2025-02-30", true],
        ["2025-10-16", false],
        ["2025-01-15", true],
      ] as const)
        expect(
          timelineAccountContext(name, index, history, date, confirmed).saved,
        ).toEqual([]);
    expect(
      timelineAccountContext(
        "sample.mutual",
        index,
        history,
        "2025-04-15",
        true,
      ).saved,
    ).toEqual(["Previously mutual in saved history"]);
    expect(
      timelineAccountContext(
        "sample.follower",
        index,
        history,
        "2025-04-15",
        true,
      ).saved,
    ).toEqual(["Previously followed you in saved history"]);
    expect(
      timelineAccountContext(
        "sample.following",
        index,
        history,
        "2025-04-15",
        true,
      ).saved,
    ).toEqual(["Previously you followed in saved history"]);
    expect(
      timelineAccountContext(
        "never.recorded",
        index,
        history,
        "2025-10-16",
        true,
      ).saved,
    ).toEqual([]);
  });
  it("reuses all eight existing fictional examples without modifying export or Vault data", () => {
    const dataset = demoSnapshots().newer,
      snapshots = demoVaultSnapshots();
    const before = JSON.stringify({ dataset, snapshots });
    const index = timelineAccountIndex(dataset),
      history = relationshipHistoryIndex(snapshots);
    expect(
      timelineAccountSummary("demo.mutual.0100", index, history).transitions,
    ).toHaveLength(0);
    expect(
      timelineAccountSummary("demo.oneway.0001", index, history).points?.map(
        (p) => p.state,
      ),
    ).toEqual(["mutual", "mutual", "you-follow", "absent"]);
    expect(
      timelineAccountSummary("demo.fan.0001", index, history).points?.map(
        (p) => p.state,
      ),
    ).toEqual(["follows-you", "mutual", "mutual", "mutual"]);
    for (const [name, origin] of [
      ["demo.mutual.0002", "they-first"],
      ["demo.mutual.0001", "you-first"],
      ["demo.mutual.0003", "same-recorded-day"],
      ["demo.mutual.0032", "unknown"],
    ])
      expect(timelineAccountSummary(name, index).origin?.origin).toBe(origin);
    expect(timelineAccountContext("demo.request.0001", index).current).toEqual([
      "Sent request recorded",
    ]);
    expect(JSON.stringify({ dataset, snapshots })).toBe(before);
  });
});
