import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { importDataset, importFiles } from "../../src/lib/instagram/import";
import {
  detectKind,
  parseJson,
  parseHtml,
} from "../../src/lib/instagram/parsers";
import {
  connectionFormats,
  connectionKinds,
} from "../../src/lib/instagram/connections";
import {
  filterRequests,
  relationshipTimeline,
  requestAge,
  timelineCardStats,
} from "../../src/lib/analysis/insights";
import { account } from "../../src/lib/instagram/normalize";
import { syntheticConnections } from "../helpers/connection-export";

const json = (name: string, value: unknown) => ({
  name,
  bytes: strToU8(JSON.stringify(value)),
});
const core = [json("followers.json", []), json("following.json", [])];
describe("optional connection adapters", () => {
  it("reads every optional list from a nested ZIP without confusing it with core lists", async () => {
    const files = {
      "followers.json": strToU8("[]"),
      "following.json": strToU8("[]"),
      ...Object.fromEntries(
        Object.entries(syntheticConnections).map(([name, value]) => [
          `export/connections/${name}`,
          strToU8(JSON.stringify(value)),
        ]),
      ),
      "media/image.jpg": strToU8("ignored"),
    };
    const zip = zipSync(files);
    const dataset = importDataset([{ name: "export.zip", bytes: zip }]);
    const asyncDataset = await importFiles([new File([zip], "export.zip")]);
    expect(asyncDataset.connections).toEqual(dataset.connections);
    expect(dataset.followers).toEqual([]);
    expect(dataset.following).toEqual([]);
    expect(
      Object.values(dataset.connections!).every(
        (v) => v.status === "available",
      ),
    ).toBe(true);
    expect(
      dataset.connections!.pendingRequests.accounts.map((a) => a.username),
    ).toEqual(["request.old", "request.recent", "request.undated"]);
    expect(dataset.connections!.blocked.accounts[0]).toEqual(
      account("blocked.person", 1704067200),
    );
    expect(dataset.connections!.recentlyUnfollowed.accounts).toHaveLength(2);
    expect(dataset.connections!.restricted.accounts).toEqual([]);
  });
  it.each(connectionKinds)(
    "accepts known legacy and split shapes for %s",
    (kind) => {
      const format = connectionFormats[kind];
      expect(detectKind(`nested/${format.filename}_2.json`)).toBe(kind);
      const parts = parseJson(
        JSON.stringify({
          [format.keys[0]]: [
            {
              title: "Legacy.Name",
              string_list_data: [{ timestamp: 1704067200 }],
            },
          ],
        }),
        kind,
      );
      expect(parts).toEqual([
        { kind, accounts: [account("legacy.name", 1704067200)] },
      ]);
    },
  );
  it("distinguishes missing, empty and unsupported lists and keeps complete core results", () => {
    const dataset = importDataset([
      ...core,
      json("close_friends.json", []),
      json("blocked_profiles.json", [
        { label_values: [{ label: "Name", value: "looks.valid" }] },
      ]),
    ]);
    expect(dataset.connections!.pendingRequests.status).toBe("missing");
    expect(dataset.connections!.closeFriends).toEqual({
      status: "available",
      accounts: [],
    });
    expect(dataset.connections!.blocked.status).toBe("unsupported");
    expect(dataset.metadata.warnings.some((w) => w.includes("blocked"))).toBe(
      true,
    );
    expect(dataset.followers).toEqual([]);
  });
  it("never returns partial optional results when any split is malformed", () => {
    const first = json(
      "pending_follow_requests_1.json",
      syntheticConnections["pending_follow_requests.json"],
    );
    const broken = {
      name: "pending_follow_requests_2.json",
      bytes: strToU8("{"),
    };
    for (const files of [
      [first, broken],
      [broken, first],
    ]) {
      const list = importDataset([...core, ...files]).connections!
        .pendingRequests;
      expect(list.status).toBe("unsupported");
      expect(list.accounts).toEqual([]);
    }
  });
  it("prefers explicit Username over stale URLs, ignores display names and unrelated labels", () => {
    const parts = parseJson(
      JSON.stringify([
        {
          timestamp: 1704067200,
          label_values: [
            {
              label: "URL",
              value: "https://www.instagram.com/_u/Actual.Name/",
            },
            { label: "Username", value: "other.name" },
            { label: "Name", value: "Display.Name" },
            { label: "Email", value: "private@example.test" },
          ],
        },
      ]),
      "closeFriends",
    );
    expect(parts[0].accounts).toEqual([account("other.name", 1704067200)]);
    expect(
      parseJson(
        '[{"label_values":[{"label":"URL","value":"https://www.instagram.com/_u/fallback/"}]}]',
        "blocked",
      )[0].accounts,
    ).toEqual([account("fallback")]);
    expect(() =>
      parseJson(
        '[{"label_values":[{"label":"URL","value":"https://evil.test/alice"},{"label":"Name","value":"Alice"}]}]',
        "blocked",
      ),
    ).toThrow(/no supported/);
    expect(() =>
      parseJson(
        '[{"label_values":[{"label":"URL","value":"not_a_url"}]}]',
        "blocked",
      ),
    ).toThrow(/no supported/);
  });
  it("deduplicates account lists but preserves distinct unfollow events", () => {
    const rows = [
      { string_list_data: [{ value: "ALICE", timestamp: 200 }] },
      { string_list_data: [{ value: "alice", timestamp: 100 }] },
      { string_list_data: [{ value: "Alice", timestamp: 200 }] },
    ];
    const dataset = importDataset([
      ...core,
      json("pending_follow_requests.json", rows),
      json("recently_unfollowed_profiles.json", rows),
    ]);
    expect(dataset.connections!.pendingRequests.accounts).toEqual([
      account("alice", 100),
    ]);
    expect(dataset.connections!.recentlyUnfollowed.accounts).toEqual([
      account("alice", 200),
      account("alice", 100),
    ]);
  });
  it("reads optional HTML links without interpreting localized timestamps or arbitrary empty content", () => {
    const parts = parseHtml(
      '<h1>Close friends</h1><a href="https://www.instagram.com/alice/">Alice</a><img src="https://example.test/track"><script>alert(1)</script><p>Jan 1, 2024</p>',
      "closeFriends",
    );
    expect(parts[0].accounts).toEqual([account("alice")]);
    expect(
      parseHtml("<h1>Close friends</h1><p>No accounts</p>", "closeFriends")[0]
        .accounts,
    ).toEqual([]);
    expect(() => parseHtml("<h1>Close friends</h1>", "closeFriends")).toThrow(
      /No recognizable/,
    );
  });
  it("does not silently interpret optional records as followers or accept only optional data", () => {
    expect(() =>
      parseJson(
        JSON.stringify(syntheticConnections["close_friends.json"]),
        "followers",
      ),
    ).toThrow(/malformed/);
    expect(() =>
      importDataset([json("pending_follow_requests.json", [])]),
    ).toThrow(/Missing Followers/);
  });
});
describe("request ages", () => {
  it("uses UTC calendar days and does not invent ages for missing or future dates", () => {
    expect(
      requestAge(Date.parse("2024-01-01T23:59:59Z") / 1000, "2024-01-02"),
    ).toBe(1);
    expect(
      requestAge(Date.parse("2024-02-28T12:00:00Z") / 1000, "2024-03-01"),
    ).toBe(2);
    expect(requestAge(undefined, "2025-01-01")).toBeNull();
    expect(requestAge(1736467200, "2024-01-01")).toBeNull();
    expect(requestAge(1704067200, "2024-02-30")).toBeNull();
    expect(requestAge(1704067200, "")).toBeNull();
  });
  it("filters boundary ages, missing timestamps and future dates explicitly", () => {
    const entries = [
      account("old", Date.parse("2024-01-01T00:00:00Z") / 1000)!,
      account("recent", Date.parse("2024-01-30T00:00:00Z") / 1000)!,
      account("future", 1736467200)!,
      account("unknown")!,
    ];
    expect(
      filterRequests(entries, "2024-01-31", "30").map((a) => a.username),
    ).toEqual(["old"]);
    expect(
      filterRequests(entries, "2024-01-31", "unknown").map((a) => a.username),
    ).toEqual(["future", "unknown"]);
    expect(filterRequests(entries, "2024-01-31", "365")).toEqual([]);
  });
});
describe("relationship date insights", () => {
  const data = {
    followers: [
      account("follower", Date.parse("2023-12-31T23:59:59Z") / 1000)!,
    ],
    following: [
      account("a", Date.parse("2024-01-01T00:00:00Z") / 1000)!,
      account("b", Date.parse("2025-02-01T00:00:00Z") / 1000)!,
      account("undated")!,
    ],
  };
  it("groups directions independently with coverage and deterministic ties", () => {
    const result = relationshipTimeline(data);
    expect(result.periods).toEqual([
      { period: "2023", followers: 1, following: 0 },
      { period: "2024", followers: 0, following: 1 },
      { period: "2025", followers: 0, following: 1 },
    ]);
    expect(result.coverage).toEqual({ followers: 1, following: 2 });
    expect(result.busiest?.period).toBe("2024");
    expect(
      relationshipTimeline(data, "month").periods.map((p) => p.period),
    ).toEqual(["2023-12", "2024-01", "2025-02"]);
    expect(data.following).toHaveLength(3);
  });
  it("builds shareable aggregate dates without usernames or optional private lists", () => {
    expect(timelineCardStats(data).map(([, value]) => value)).toEqual([
      2,
      1,
      "2024-01-01",
      "2025-02-01",
      "2024",
      1,
    ]);
    expect(
      timelineCardStats({
        followers: [],
        following: [account("undated")!],
      }).map(([, value]) => value),
    ).toEqual([
      0,
      1,
      "Unavailable",
      "Unavailable",
      "Unavailable",
      "Unavailable",
    ]);
  });
});
