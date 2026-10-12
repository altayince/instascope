import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { importDataset, importFiles } from "../../src/lib/instagram/import";
import {
  connectionFormats,
  connectionKinds,
} from "../../src/lib/instagram/connections";
import {
  account,
  isDeletedInstagramAccount,
} from "../../src/lib/instagram/normalize";
import {
  detectKind,
  parseHtml,
  parseHtmlDate,
  parseJson,
} from "../../src/lib/instagram/parsers";
import {
  htmlConnectionDocument,
  htmlLabelRecord,
  syntheticHtmlConnections,
  syntheticHtmlCore,
} from "../helpers/html-connection-export";

const input = (name: string, text: string) => ({ name, bytes: strToU8(text) });
const core = [input("followers.json", "[]"), input("following.json", "[]")];
const dated = (username: string, date: string) =>
  account(username, parseHtmlDate(date), "minute-without-timezone");
const card = (content: string) => `<div class="pam _a6-g">${content}</div>`;
const link = (username: string, text = username) =>
  `<a href="https://www.instagram.com/${username}/">${text}</a>`;

describe("Meta HTML labelled connection records", () => {
  it.each(Object.entries(syntheticHtmlConnections))(
    "reads verified nested label-table structure from %s",
    (filename, text) => {
      const kind = detectKind(filename)!;
      const entries = parseHtml(text, kind)[0].accounts;
      expect(entries).toHaveLength(2);
      expect(entries[0].timestamp).toBeDefined();
      expect(entries[0].timestampPrecision).toBe("minute-without-timezone");
      expect(
        entries.some((entry) => entry.username === "synthetic.display.name"),
      ).toBe(false);
      if (kind !== "recentlyUnfollowed")
        expect(entries[1].timestamp).toBeUndefined();
    },
  );

  it("has the same normalized identities for labelled HTML and JSON while preserving HTML date precision", () => {
    const text = htmlConnectionDocument([
      htmlLabelRecord(
        [
          ["Name", "display.looks.valid"],
          ["URL", "https://www.instagram.com/stale.identity/"],
          ["Username", "ACTUAL.IDENTITY"],
        ],
        "Feb 29, 2024 1:05 pm",
      ),
    ]);
    const html = parseHtml(text, "closeFriends")[0].accounts[0];
    const json = parseJson(
      JSON.stringify([
        {
          timestamp: parseHtmlDate("Feb 29, 2024 1:05 pm"),
          label_values: [
            { label: "Username", value: "ACTUAL.IDENTITY" },
            {
              label: "URL",
              value: "https://www.instagram.com/stale.identity/",
            },
            { label: "Name", value: "display.looks.valid" },
          ],
        },
      ]),
      "closeFriends",
    )[0].accounts[0];
    expect(html).toEqual({
      ...json,
      timestampPrecision: "minute-without-timezone",
    });
    expect(json.timestampPrecision).toBeUndefined();
  });

  it("accepts a username alone or with an unrelated stale URL, without using Name", () => {
    const records = [
      htmlLabelRecord([["Username", "username.only"]]),
      htmlLabelRecord([
        ["URL", "https://example.invalid/stale"],
        ["Name", "should.not.appear"],
        ["Username", "username.authoritative"],
      ]),
    ];
    expect(
      parseHtml(htmlConnectionDocument(records), "blocked")[0].accounts,
    ).toEqual([account("username.only"), account("username.authoritative")]);
  });

  it("uses a trusted URL fallback, including _u URLs, and decodes HTML entities", () => {
    const text = htmlConnectionDocument([
      htmlLabelRecord([
        ["URL", "https://www.instagram.com/_u/fallback.identity?x=1&amp;y=2"],
      ]),
      htmlLabelRecord([["Username", "entity&#46;identity"]]),
    ]);
    expect(parseHtml(text, "restricted")[0].accounts).toEqual([
      account("fallback.identity"),
      account("entity.identity"),
    ]);
  });

  it.each([
    { fields: [["Name", "looks.valid"]] },
    { fields: [["URL", "looks.valid"]] },
    { fields: [["URL", "https://example.invalid/looks.valid"]] },
    { fields: [["URL", "https://www.instagram.com/explore/"]] },
    { fields: [["Username", "not a username"]] },
  ])("rejects unverified identity fields: $fields", ({ fields }) => {
    expect(() =>
      parseHtml(
        htmlConnectionDocument([htmlLabelRecord(fields as [string, string][])]),
        "blocked",
      ),
    ).toThrow(/no supported Instagram username/);
  });

  it("rejects distinct Username values and malformed labelled rows", () => {
    expect(() =>
      parseHtml(
        htmlConnectionDocument([
          htmlLabelRecord([
            ["Username", "first.identity"],
            ["Username", "second.identity"],
          ]),
        ]),
        "pendingRequests",
      ),
    ).toThrow(/multiple Instagram identities/);
    expect(() =>
      parseHtml(
        htmlConnectionDocument([
          htmlLabelRecord([
            ["Username", "valid.identity"],
            ["Username", "not valid"],
          ]),
        ]),
        "pendingRequests",
      ),
    ).toThrow(/malformed Username fields/);
    expect(() =>
      parseHtml(
        htmlConnectionDocument([
          card("<table><tr><td>Username</td></tr></table>"),
        ]),
        "pendingRequests",
      ),
    ).toThrow(/field is malformed/);
  });

  it("does not infer core follower records from optional labelled tables", () => {
    expect(() =>
      parseHtml(
        htmlConnectionDocument([
          htmlLabelRecord([["Username", "optional.identity"]]),
        ]),
        "followers",
      ),
    ).toThrow(/No recognizable/);
  });

  it("preserves deleted-account identity without altering shared display/link semantics", () => {
    const sentinel = "__deleted__bcdefghijabcdefgh";
    const html = parseHtml(
      htmlConnectionDocument([
        htmlLabelRecord([["Username", sentinel]], "Jan 01, 2025 12:00 am"),
      ]),
      "blocked",
    )[0].accounts[0];
    expect(isDeletedInstagramAccount(html.username)).toBe(true);
    expect(html).toEqual(dated(sentinel, "Jan 01, 2025 12:00 am"));
  });
});

describe("HTML record ownership and date association", () => {
  it("handles core split files, nested wrappers, _u links and heading-plus-link records", () => {
    const dataset = importDataset(
      Object.entries(syntheticHtmlCore).map(([name, text]) =>
        input(name, text),
      ),
    );
    expect(dataset.followers).toEqual([
      dated("synthetic.follower.dated", "Jan 01, 2025 12:00 am"),
      account("synthetic.follower.undated"),
    ]);
    expect(dataset.following).toEqual([
      dated("synthetic.following.dated", "Jan 04, 2025 1:15 pm"),
    ]);
  });

  it("does not attach a neighboring card's date to missing or malformed records", () => {
    const text = htmlConnectionDocument([
      htmlLabelRecord([["Username", "first.dated"]], "Jan 01, 2025 12:00 am"),
      htmlLabelRecord([["Username", "second.undated"]]),
      htmlLabelRecord(
        [["Username", "third.malformed"]],
        "Feb 30, 2025 1:05 pm",
      ),
      htmlLabelRecord([["Username", "last.dated"]], "Jan 04, 2025 12:00 pm"),
    ]);
    expect(parseHtml(text, "closeFriends")[0].accounts).toEqual([
      dated("first.dated", "Jan 01, 2025 12:00 am"),
      account("second.undated"),
      account("third.malformed"),
      dated("last.dated", "Jan 04, 2025 12:00 pm"),
    ]);
  });

  it("rejects a malformed declared sibling instead of borrowing its date or returning partial accounts", () => {
    const text = htmlConnectionDocument([
      htmlLabelRecord([["Username", "valid.undated"]]),
      card(
        '<h2>broken record</h2><a href="https://evil.test/broken">broken record</a><p>Jan 02, 2025 1:05 pm</p>',
      ),
    ]);
    expect(() => parseHtml(text, "blocked")).toThrow(
      /no supported Instagram identity/,
    );
    const dataset = importDataset([
      ...core,
      input("blocked_profiles.html", text),
    ]);
    expect(dataset.connections!.blocked.status).toBe("unsupported");
    expect(dataset.connections!.blocked.accounts).toEqual([]);
  });

  it("keeps a narrow legacy direct-document profile-link fragment compatible", () => {
    expect(
      parseHtml(
        '<a href="https://www.instagram.com/example.friend/">friend</a>',
        "followers",
      )[0].accounts,
    ).toEqual([account("example.friend")]);
  });

  it("does not use a date-shaped Name field or unrelated layout date as an event date", () => {
    const text = htmlConnectionDocument([
      htmlLabelRecord([
        ["Username", "undated.identity"],
        ["Name", "Jan 02, 2025 1:05 pm"],
      ]),
      "<p>Jan 03, 2025 1:05 pm</p>",
    ]);
    expect(parseHtml(text, "closeFriends")[0].accounts).toEqual([
      account("undated.identity"),
    ]);
  });

  it("rejects declared cards lacking matching username evidence without keeping partial accounts", () => {
    const text = htmlConnectionDocument([
      card(link("valid.identity")),
      card(link("unverified.identity", "Visit Instagram")),
    ]);
    expect(() => parseHtml(text, "followers")).toThrow(
      /no supported Instagram identity/,
    );
  });

  it("keeps multiple conflicting visible dates unavailable", () => {
    const text = htmlConnectionDocument([
      card(
        `${link("conflicting.dates")}<p>Jan 01, 2025 12:00 am</p><p>Jan 02, 2025 12:00 pm</p>`,
      ),
    ]);
    expect(parseHtml(text, "following")[0].accounts).toEqual([
      account("conflicting.dates"),
    ]);
  });

  it("handles repeated nested Meta cards without treating the outer wrapper as one account", () => {
    const text = htmlConnectionDocument([
      card(
        `<div>${card(`${link("nested.first")}<p>Jan 01, 2025 1:05 pm</p>`)}${card(link("nested.second"))}</div>`,
      ),
    ]);
    expect(parseHtml(text, "followers")[0].accounts).toEqual([
      dated("nested.first", "Jan 01, 2025 1:05 pm"),
      account("nested.second"),
    ]);
  });

  it("supports unmarked record blocks inside an additional semantic wrapper", () => {
    const text = htmlConnectionDocument([
      `<section><div>${link("wrapped.first")}<p>Jan 01, 2025 1:05 pm</p></div><div>${link("wrapped.second")}</div></section>`,
    ]);
    expect(parseHtml(text, "followers")[0].accounts).toEqual([
      dated("wrapped.first", "Jan 01, 2025 1:05 pm"),
      account("wrapped.second"),
    ]);
  });

  it("preserves source order when legacy anchors and labelled records are mixed", () => {
    const text = htmlConnectionDocument([
      card(link("first.anchor")),
      htmlLabelRecord([["Username", "second.table"]]),
      card(link("third.anchor")),
    ]);
    expect(
      parseHtml(text, "blocked")[0].accounts.map((entry) => entry.username),
    ).toEqual(["first.anchor", "second.table", "third.anchor"]);
  });

  it("allows two links to the same identity but rejects a truly ambiguous card", () => {
    const same = htmlConnectionDocument([
      card(
        `${link("same.identity")}<a href="https://www.instagram.com/_u/SAME.IDENTITY">View profile</a><p>Jan 01, 2025 1:05 pm</p>`,
      ),
    ]);
    expect(parseHtml(same, "followers")[0].accounts).toEqual([
      dated("same.identity", "Jan 01, 2025 1:05 pm"),
    ]);
    expect(() =>
      parseHtml(
        htmlConnectionDocument([
          card(`${link("ambiguous.first")}${link("ambiguous.second")}`),
        ]),
        "followers",
      ),
    ).toThrow(/multiple Instagram profiles/);
  });

  it("excludes navigation/footer/other arbitrary profile links and random username text", () => {
    const text = htmlConnectionDocument([
      `<nav>${link("navigation.identity")}</nav>`,
      `<div role="navigation">${link("role.identity")}</div>`,
      `<footer>${link("footer.identity")}</footer>`,
      `<section>${link("unrelated.identity", "Visit Instagram")}</section>`,
      `<section>${link("footer.heading.identity", "Visit Instagram")}<footer><h2>footer.heading.identity</h2></footer></section>`,
      "<section><h2>random.looks.valid</h2><p>Not a relationship record</p></section>",
      card(`${link("actual.identity")}<footer>Jan 01, 2025 1:05 pm</footer>`),
    ]);
    expect(parseHtml(text, "followers")[0].accounts).toEqual([
      account("actual.identity"),
    ]);
  });

  it.each([
    "relative.username",
    "https://evil.test/valid.name",
    "https://www.instagram.com/explore/",
    "https://www.instagram.com/p/valid.name",
    "https://user:pass@www.instagram.com/valid.name/",
    "https://www.instagram.com:1234/valid.name/",
  ])("keeps URL/host/reserved-path safeguards for %s", (href) => {
    expect(() =>
      parseHtml(
        htmlConnectionDocument([card(`<a href="${href}">valid.name</a>`)]),
        "followers",
      ),
    ).toThrow(/No recognizable/);
  });
});

describe("HTML import status and transport parity", () => {
  it("reads all six optional categories from ZIP and direct HTML files with matching results", async () => {
    const files = { ...syntheticHtmlCore, ...syntheticHtmlConnections };
    const direct = Object.entries(files).map(([name, text]) =>
      input(name, text),
    );
    const bytes = zipSync(
      Object.fromEntries(
        Object.entries(files).map(([name, text]) => [
          `export/connections/followers_and_following/${name}`,
          strToU8(text),
        ]),
      ),
    );
    const zip = importDataset([{ name: "synthetic.zip", bytes }]);
    const loose = importDataset(direct);
    const asyncZip = await importFiles([new File([bytes], "synthetic.zip")]);
    expect(zip.followers).toEqual(loose.followers);
    expect(zip.following).toEqual(loose.following);
    expect(zip.connections).toEqual(loose.connections);
    expect(asyncZip.connections).toEqual(zip.connections);
    for (const name of Object.keys(syntheticHtmlConnections)) {
      const kind = connectionKinds.find((value) => detectKind(name) === value)!;
      expect(zip.connections![kind].status).toBe("available");
      expect(zip.connections![kind].accounts).toHaveLength(2);
    }
    expect(zip.connections!.recentFollowRequests.status).toBe("missing");
    expect(zip.connections!.removedSuggestions.status).toBe("missing");
    expect(
      zip.connections!.recentlyUnfollowed.accounts.map(
        (entry) => entry.timestamp,
      ),
    ).toEqual([
      parseHtmlDate("Jan 02, 2025 12:00 am"),
      parseHtmlDate("Jan 03, 2025 12:00 pm"),
    ]);
  });

  it.each(connectionKinds)(
    "requires convincing empty-category evidence for %s",
    (kind) => {
      const title = connectionFormats[kind].filename.replaceAll("_", " ");
      const empty = `<h1>${title}</h1><main><p>No accounts</p></main>`;
      expect(parseHtml(empty, kind)[0].accounts).toEqual([]);
      expect(() => parseHtml(`<h1>${title}</h1><main></main>`, kind)).toThrow(
        /No recognizable/,
      );
      expect(() => parseHtml("<main>No accounts</main>", kind)).toThrow(
        /No recognizable/,
      );
    },
  );

  it("keeps missing, explicit empty and unsupported separate without partial optional success", () => {
    const good = input(
      "blocked_profiles_1.html",
      htmlConnectionDocument([
        htmlLabelRecord([["Username", "valid.blocked"]]),
      ]),
    );
    const bad = input(
      "blocked_profiles_2.html",
      htmlConnectionDocument([
        htmlLabelRecord([["Username", "other.valid"]]),
        htmlLabelRecord([["Name", "looks.valid"]]),
      ]),
    );
    for (const split of [
      [good, bad],
      [bad, good],
    ]) {
      const dataset = importDataset([
        ...core,
        input("close_friends.html", "<h1>Close friends</h1><p>No accounts</p>"),
        ...split,
      ]);
      expect(dataset.connections!.restricted.status).toBe("missing");
      expect(dataset.connections!.closeFriends).toEqual({
        status: "available",
        accounts: [],
      });
      expect(dataset.connections!.blocked.status).toBe("unsupported");
      expect(dataset.connections!.blocked.accounts).toEqual([]);
    }
  });

  it("does not expand unsupported export categories", () => {
    for (const filename of [
      "received_follow_requests.html",
      "favorites.html",
      "synced_contacts.html",
    ])
      expect(detectKind(filename)).toBeUndefined();
  });

  it("does not silently drop an unrecognized table in a mixed optional list", () => {
    const text = htmlConnectionDocument([
      htmlLabelRecord([["Username", "valid.identity"]]),
      htmlLabelRecord([["Unknown identity field", "unverified.identity"]]),
    ]);
    expect(() => parseHtml(text, "restricted")).toThrow(/unsupported fields/);
    const dataset = importDataset([
      ...core,
      input("restricted_profiles.html", text),
    ]);
    expect(dataset.connections!.restricted.status).toBe("unsupported");
    expect(dataset.connections!.restricted.accounts).toEqual([]);
  });
});
