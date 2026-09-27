import { describe, expect, it } from "vitest";
import { analyze } from "../../src/lib/analysis/relationships";
import { relationshipReview } from "../../src/lib/analysis/review";
import { account } from "../../src/lib/instagram/normalize";
import type { Dataset } from "../../src/lib/instagram/types";

const entry = (name: string, date?: number) => account(name, date)!;
function dataset(): Dataset {
  return {
    followers: [entry("mutual", 1704067200)],
    following: [
      entry("one.way", 1672531200),
      entry("mutual", 1704067200),
      entry("undated"),
    ],
    connections: {
      pendingRequests: {
        status: "available",
        accounts: [entry("ONE.WAY", 1736467200), entry("request.only")],
      },
      recentlyUnfollowed: {
        status: "available",
        accounts: [
          entry("one.way", 1704067200),
          entry("ONE.WAY", 1736467200),
          entry("gone", 1704067200),
        ],
      },
      closeFriends: { status: "missing", accounts: [], message: "Missing" },
      blocked: { status: "missing", accounts: [], message: "Missing" },
      restricted: { status: "missing", accounts: [], message: "Missing" },
      hideStoryFrom: { status: "missing", accounts: [], message: "Missing" },
    },
    metadata: {
      parsedAt: Date.UTC(2025, 0, 15),
      sourceFormat: "synthetic",
      warnings: [],
    },
  };
}
describe("relationship review signals", () => {
  it("keeps one normalized account identity across overlapping signals", () => {
    const data = dataset();
    const review = relationshipReview(data, analyze(data));
    expect(review.selectionScope.map((account) => account.username)).toEqual([
      "one.way",
      "mutual",
      "undated",
      "request.only",
      "gone",
    ]);
    expect(review.pendingAccounts.map((account) => account.username)).toEqual([
      "one.way",
      "request.only",
    ]);
    expect(
      review.unfollowedAccounts.map((account) => account.username),
    ).toEqual(["one.way", "gone"]);
    expect(review.context.get("one.way")).toEqual([
      "One-way follow in this export",
      "Follow recorded 2023-01-01",
      "Sent request recorded 2025-01-10",
      "You unfollowed; latest record 2025-01-10",
    ]);
    expect(review.datedFollowing).toHaveLength(2);
  });

  it("distinguishes absent and unreadable optional lists from an empty list", () => {
    const data = dataset();
    delete data.connections;
    const missing = relationshipReview(data, analyze(data));
    expect(missing.pending.status).toBe("missing");
    expect(missing.history.status).toBe("missing");
    expect(missing.selectionScope).toHaveLength(3);
    data.connections = dataset().connections;
    data.connections!.pendingRequests = {
      status: "unsupported",
      accounts: [],
      message: "Unsupported synthetic input",
    };
    data.connections!.recentlyUnfollowed = {
      status: "available",
      accounts: [],
    };
    const mixed = relationshipReview(data, analyze(data));
    expect(mixed.pending.status).toBe("unsupported");
    expect(mixed.history.status).toBe("available");
    expect(mixed.unfollowedAccounts).toEqual([]);
  });
});
