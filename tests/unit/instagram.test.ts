import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import {
  account,
  deduplicate,
  normalizeUsername,
} from "../../src/lib/instagram/normalize";
import { importDataset, LIMITS } from "../../src/lib/instagram/import";
import {
  parseHtml,
  parseHtmlDate,
  parseJson,
} from "../../src/lib/instagram/parsers";
import {
  analyze,
  compareSnapshots,
} from "../../src/lib/analysis/relationships";
const fixture = (name: string) => ({
  name,
  bytes: new Uint8Array(readFileSync(`tests/fixtures/${name}`)),
});
const fixtureNamed = (source: string, name: string) => ({
  ...fixture(source),
  name,
});
const json = (name: string, data: unknown) => ({
  name,
  bytes: strToU8(JSON.stringify(data)),
});
const valid = () =>
  importDataset([fixture("followers_1.json"), fixture("following.json")]);
const htmlDocument = (body: string) =>
  `<!doctype html><html><body><main>${body}</main></body></html>`;
const htmlRecord = (username: string, date?: string) => `
  <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
    <div class="_a6-p"><div>
      <div><a href="https://www.instagram.com/${username}/">${username}</a></div>
      ${date ? `<div>${date}</div>` : ""}
    </div></div>
  </div>`;
describe("normalization", () => {
  it.each([
    " Alice ",
    "@ALICE",
    "https://www.instagram.com/Alice/?igsh=abc",
    "instagram.com/alice/",
    "https://instagram.com/_u/alice",
  ])("normalizes %s", (input) =>
    expect(normalizeUsername(input)).toBe("alice"),
  );
  it.each([
    "https://instagram.com.evil.test/alice",
    "javascript:alert(1)",
    "https://instagram.com/p/abc",
    "https://instagram.com/alice/extra",
    "https://instagram.com:444/alice",
    "a/b",
    "",
    "...",
    "bad user",
    "https://evil@instagram.com/alice",
  ])("rejects %s", (input) => expect(normalizeUsername(input)).toBeNull());
  it("drops invalid timestamps and preserves earliest valid duplicate", () => {
    expect(account("a", Infinity)?.timestamp).toBeUndefined();
    expect(account("a", -1)?.timestamp).toBeUndefined();
    expect(account("a", 1700000000000)?.timestamp).toBeUndefined();
    expect(
      deduplicate([
        account("ALICE", 100)!,
        account("alice", 80)!,
        account("Alice")!,
      ]),
    ).toEqual([account("alice", 80)]);
  });
});
describe("archive adapters", () => {
  it("preserves only usable follower timestamps from Instagram JSON", () => {
    const data = importDataset([
      json("followers.json", [
        {
          string_list_data: [
            { value: "dated.follower", timestamp: 1609459200 },
          ],
        },
        { string_list_data: [{ value: "undated.follower" }] },
        {
          string_list_data: [
            { value: "malformed.follower", timestamp: "not-a-timestamp" },
          ],
        },
      ]),
      json("following.json", { relationships_following: [] }),
    ]);

    expect(data.followers).toEqual([
      account("dated.follower", 1609459200),
      account("undated.follower"),
      account("malformed.follower"),
    ]);
  });
  it("reads real-shaped JSON and deduplicates", () => {
    const data = valid();
    expect(data.followers.map((a) => a.username)).toEqual([
      "alice",
      "bob",
      "fan.only",
    ]);
    expect(data.following).toHaveLength(4);
  });
  it("accepts nested ZIP paths, split followers, ignores unrelated media", () => {
    const zip = zipSync({
      "export/connections/followers_and_following/followers_1.json":
        fixture("followers_1.json").bytes,
      "export/connections/followers_and_following/followers_2.json":
        fixture("followers_1.json").bytes,
      "elsewhere/following_1.json": fixture("following.json").bytes,
      "media/unrelated.json": strToU8("not JSON"),
    });
    expect(
      importDataset([{ name: "export.zip", bytes: zip }]).followers,
    ).toHaveLength(3);
  });
  it("detects keyed structures even under alternate JSON filenames", () => {
    const rows = JSON.parse(
      new TextDecoder().decode(fixture("followers_1.json").bytes),
    );
    expect(
      importDataset([
        json("connections.json", {
          relationships_followers: rows,
          relationships_following: [],
        }),
      ]).following,
    ).toEqual([]);
  });
  it("reads HTML without executing scripts or loading images", () => {
    const data = importDataset([
      fixture("followers.html"),
      fixture("following.html"),
    ]);
    expect(data.followers).toHaveLength(3);
    expect(data.following).toHaveLength(4);
  });
  it("reads dated real-shaped Followers and Following HTML records", () => {
    const data = importDataset([
      fixtureNamed("followers-dated.html", "followers_1.html"),
      fixtureNamed("following-dated.html", "following.html"),
    ]);
    const precision = "minute-without-timezone" as const;

    expect(data.followers).toEqual([
      account("dated.follower", Date.UTC(2026, 8, 7, 9, 5) / 1000, precision),
      account(
        "midnight.follower",
        Date.UTC(2024, 0, 1, 0, 0) / 1000,
        precision,
      ),
      account("noon.follower", Date.UTC(2024, 0, 1, 12, 0) / 1000, precision),
      account("malformed.follower"),
      account("impossible.follower"),
      account("undated.follower"),
    ]);
    expect(data.following).toEqual([
      account("dated.following", Date.UTC(2025, 9, 8, 13, 6) / 1000, precision),
    ]);
  });
  it("parses only strict, possible HTML dates", () => {
    expect(parseHtmlDate("Jan 01, 2024 12:00 am")).toBe(
      Date.UTC(2024, 0, 1, 0, 0) / 1000,
    );
    expect(parseHtmlDate("Jan 01, 2024 12:00 pm")).toBe(
      Date.UTC(2024, 0, 1, 12, 0) / 1000,
    );
    expect(parseHtmlDate("Oct 08, 2025 1:06 pm")).toBe(
      Date.UTC(2025, 9, 8, 13, 6) / 1000,
    );
    expect(parseHtmlDate("Not a date")).toBeUndefined();
    expect(parseHtmlDate("Feb 30, 2026 9:05 am")).toBeUndefined();
    expect(parseHtmlDate("Jan 01, 2024 0:00 am")).toBeUndefined();
    expect(parseHtmlDate("Jan 01, 2024 12:60 pm")).toBeUndefined();
    expect(parseHtmlDate("Foo 01, 2024 1:00 pm")).toBeUndefined();
  });
  it("combines dated split follower HTML files", () => {
    const data = importDataset([
      fixtureNamed("followers-dated.html", "followers_1.html"),
      {
        name: "followers_2.html",
        bytes: strToU8(
          htmlDocument(htmlRecord("split.follower", "Nov 09, 2025 2:07 pm")),
        ),
      },
      fixtureNamed("following-dated.html", "following.html"),
    ]);

    expect(data.followers).toHaveLength(7);
    expect(data.followers.at(-1)).toEqual(
      account(
        "split.follower",
        Date.UTC(2025, 10, 9, 14, 7) / 1000,
        "minute-without-timezone",
      ),
    );
  });
  it("ignores Instagram links outside core HTML records", () => {
    const parsed = parseHtml(
      `<!doctype html><html><body>
        <header><a href="https://www.instagram.com/not.a.record/">Ignore</a></header>
        <main>${htmlRecord("actual.record", "Dec 10, 2025 3:08 pm")}</main>
      </body></html>`,
      "followers",
    );

    expect(parsed[0].accounts.map((entry) => entry.username)).toEqual([
      "actual.record",
    ]);
  });
  it("keeps JSON timestamps exact while matching shared calendar values", () => {
    const timestamp = Date.UTC(2025, 11, 10, 15, 8) / 1000;
    const html = parseHtml(
      htmlDocument(htmlRecord("same.account", "Dec 10, 2025 3:08 pm")),
      "followers",
    )[0].accounts[0];
    const jsonAccount = parseJson(
      JSON.stringify([
        {
          string_list_data: [{ value: "same.account", timestamp }],
        },
      ]),
      "followers",
    )[0].accounts[0];

    expect({
      username: html.username,
      href: html.href,
      timestamp: html.timestamp,
    }).toEqual(jsonAccount);
    expect(html.timestampPrecision).toBe("minute-without-timezone");
    expect(jsonAccount.timestampPrecision).toBeUndefined();
  });
  it("supports empty explicit JSON lists", () =>
    expect(
      importDataset([
        json("followers.json", []),
        json("following.json", { relationships_following: [] }),
      ]).followers,
    ).toEqual([]));
  it.each(["followers", "following"])(
    "rejects missing %s rather than inventing empty lists",
    (kind) =>
      expect(() =>
        importDataset([
          fixture(kind === "followers" ? "following.json" : "followers_1.json"),
        ]),
      ).toThrow(/Missing/),
  );
  it("rejects malformed and unfamiliar shapes", () => {
    expect(() => parseJson("{", "followers")).toThrow(/damaged/);
    expect(() => parseJson("{}", "followers")).toThrow(/No supported/);
    expect(() => parseJson('[{"string_list_data":[]}]', "followers")).toThrow(
      /no valid/,
    );
    expect(() =>
      parseJson('[{"string_list_data":[{"value":"bad name"}]}]', "followers"),
    ).toThrow(/no valid/);
  });
  it("rejects arbitrary HTML masquerading as an empty list", () =>
    expect(() =>
      importDataset([
        { name: "followers.html", bytes: strToU8("<html>hello</html>") },
        fixture("following.html"),
      ]),
    ).toThrow(/No recognizable/));
  it("handles invalid ZIP and unsupported files", () => {
    expect(() =>
      importDataset([{ name: "bad.zip", bytes: strToU8("bad") }]),
    ).toThrow(/valid ZIP/);
    expect(() =>
      importDataset([{ name: "export.txt", bytes: strToU8("bad") }]),
    ).toThrow(/Unsupported/);
    expect(() => importDataset([])).toThrow(/Select/);
  });
  it("bounds inflated data", () => {
    const compressed = zipSync({
      "followers.json": new Uint8Array(LIMITS.entry + 1).fill(32),
    });
    expect(() =>
      importDataset([{ name: "bomb.zip", bytes: compressed }]),
    ).toThrow(/limit|20 MB/);
  });
  it("rejects a ZIP truncated after its local entries", () => {
    const zip = zipSync({
      "followers.json": strToU8("[]"),
      "following.json": strToU8("[]"),
    });
    expect(() =>
      importDataset([
        { name: "truncated.zip", bytes: zip.subarray(0, zip.length - 22) },
      ]),
    ).toThrow(/incomplete/);
  });
  it("applies the expansion limit across the entire multi-file upload", () => {
    const paddedList = strToU8("[]" + " ".repeat(16 * 1024 * 1024));
    const zip = zipSync({
      "followers.json": paddedList,
      "following.json": paddedList,
    });
    expect(() =>
      importDataset([
        { name: "part-one.zip", bytes: zip },
        { name: "part-two.zip", bytes: zip },
      ]),
    ).toThrow(/safety limit/);
  });
});
describe("relationship math", () => {
  it("calculates both directions, mutuals, and ratio", () => {
    const stats = analyze(valid());
    expect(stats.mutuals.map((a) => a.username)).toEqual(["alice", "bob"]);
    expect(stats.notFollowingBack.map((a) => a.username)).toEqual([
      "one.way",
      "old.friend",
    ]);
    expect(stats.fans.map((a) => a.username)).toEqual(["fan.only"]);
    expect(stats.ratio).toBe(0.75);
  });
  it("represents a zero denominator as no ratio", () =>
    expect(
      analyze({ followers: [account("a")!], following: [] }).ratio,
    ).toBeNull());
  it("compares snapshots without fake duplicate changes", () => {
    const old = valid(),
      newer = {
        ...valid(),
        followers: [
          account("alice")!,
          account("ALICE")!,
          account("new.friend")!,
        ],
        following: [account("alice")!, account("fan.only")!],
      };
    const changes = compareSnapshots(old, newer);
    expect(changes.newFollowers.map((a) => a.username)).toEqual(["new.friend"]);
    expect(changes.lostFollowers.map((a) => a.username)).toEqual([
      "bob",
      "fan.only",
    ]);
    expect(changes.newFollowing.map((a) => a.username)).toEqual(["fan.only"]);
    expect(changes.removedFollowing.map((a) => a.username)).toEqual([
      "bob",
      "one.way",
      "old.friend",
    ]);
    expect(changes.followerDelta).toBe(-1);
    expect(changes.followingDelta).toBe(-2);
    expect(compareSnapshots(old, old).lostFollowers).toEqual([]);
  });
  it("handles a large personal dataset", () => {
    const followers = Array.from({ length: 20000 }, (_, i) =>
      account(`user.${i}`)!,
    );
    expect(
      analyze({ followers, following: followers.slice(10000) }).mutuals,
    ).toHaveLength(10000);
  });
});
