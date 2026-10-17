import { describe, expect, it } from "vitest";
import { importFacebook } from "../../src/lib/facebook/import";
import {
  detectFacebookConnection,
  parseFacebookConnections,
} from "../../src/lib/facebook/parsers";
import {
  facebookTimestamp,
  parseFacebookHtmlDate,
  repairFacebookText,
} from "../../src/lib/facebook/normalize";
import {
  connectionDate,
  exploreConnections,
} from "../../src/lib/facebook/analysis";
import {
  facebookHtml,
  facebookZip,
  syntheticFacebookZip,
  syntheticFacebookRows,
} from "../helpers/facebook-export";

const file = (bytes: Uint8Array) =>
  new File([Uint8Array.from(bytes)], "facebook.zip");
const load = (files: Record<string, string>) =>
  importFacebook(file(facebookZip(files)));
describe("Facebook supported source representations", () => {
  it("preserves same-name rows and yields equivalent EN/TR names and dates across formats", async () => {
    const json = await importFacebook(file(syntheticFacebookZip("json")));
    const html = await importFacebook(file(syntheticFacebookZip("html")));
    expect(json.categories.friends.records.map((row) => row.name)).toEqual(
      syntheticFacebookRows.map((row) => row.name),
    );
    expect(
      json.categories.friends.records.map((row) => [
        row.name,
        connectionDate(row, "Europe/Istanbul"),
      ]),
    ).toEqual(
      html.categories.friends.records.map((row) => [
        row.name,
        connectionDate(row),
      ]),
    );
    expect(
      new Set(json.categories.friends.records.map((row) => row.row)).size,
    ).toBe(3);
    expect(json.categories.friends.repairedNames).toBe(3);
    expect(json.categories.received.state).toBe("empty");
    expect(html.categories.received.state).toBe("empty");
    expect(json.categories.removed.state).toBe("absent");
    expect(json.categories.rejected.state).toBe("partial");
    expect(json.categories.rejected.records[0].markedAsSpam).toBe(true);
    expect(html.categories.rejected.records[0].markedAsSpam).toBeUndefined();
    expect(
      html.categories.friends.records.every(
        (row) =>
          row.timestamp === undefined && row.dateBasis === "export-local",
      ),
    ).toBe(true);
    expect(JSON.stringify(json)).not.toContain("COOKIE");
  });
  it("keeps categories separate and reports invalid names/dates without deduplicating", async () => {
    const result = await load({
      "your_friends.json": JSON.stringify({
        friends_v2: [
          { name: "Same Example", timestamp: 1 },
          { name: "Same Example", timestamp: null },
          { name: "", timestamp: 1234567890 },
          null,
        ],
      }),
      "received_friend_requests.json":
        '{"received_requests_v2":[{"name":"Received Example","timestamp":1704103200}]}',
      "removed_friends.json":
        '{"deleted_friends_v2":[{"name":"Removed Example","timestamp":1704103200,"ip":"NEVER_PROJECT","id":"NEVER_PROJECT"}]}',
      "rejected_friend_requests.json": '{"unknown_version":[]}',
    });
    expect(result.categories.friends).toMatchObject({
      state: "partial",
      sourceRows: 4,
      invalidRows: 2,
      unknownDates: 2,
    });
    expect(result.categories.friends.records).toHaveLength(2);
    expect(result.categories.received.records[0].name).toBe("Received Example");
    expect(result.categories.removed.records[0].name).toBe("Removed Example");
    expect(result.categories.rejected.state).toBe("unsupported");
    expect(JSON.stringify(result)).not.toContain("NEVER_PROJECT");
  });
  it("distinguishes malformed and unknown HTML from explicit empty containers", () => {
    expect(parseFacebookConnections("{", "friends", "json").state).toBe(
      "unsupported",
    );
    expect(
      parseFacebookConnections("<main>Unknown schema</main>", "friends", "html")
        .state,
    ).toBe("unsupported");
    expect(
      parseFacebookConnections('<main class="_a706">', "friends", "html").state,
    ).toBe("unsupported");
    expect(
      parseFacebookConnections(
        '<main class="_a706"><table></table></main>',
        "friends",
        "html",
      ).state,
    ).toBe("unsupported");
    expect(
      parseFacebookConnections(
        '<main class="_a706"><p>Unknown records</p></main>',
        "friends",
        "html",
      ).state,
    ).toBe("unsupported");
    expect(
      parseFacebookConnections(facebookHtml([]), "friends", "html").state,
    ).toBe("empty");
    const partial = parseFacebookConnections(
      '<main class="_a706"><section class="_a6-g"><h2 class="_a6-h">Readable Example</h2></section><section class="unknown">Unreadable record</section></main>',
      "friends",
      "html",
    );
    expect(partial).toMatchObject({
      state: "partial",
      sourceRows: 2,
      invalidRows: 1,
      unknownDates: 1,
    });
  });
  it("parses inert HTML without resolving entities or retaining raw HTML/resources", () => {
    const source = facebookHtml([
      {
        name: '<script>alert("synthetic")</script>',
        date: "Jan 1, 2024 1:00 pm",
      },
    ])
      .replace(
        "</head>",
        '<script>throw new Error("NEVER_EXECUTE")</script><link href="https://private.invalid/style"></head>',
      )
      .replace("</main>", '<img src="https://private.invalid/image"></main>');
    const result = parseFacebookConnections(source, "friends", "html");
    expect(result.records[0].name).toBe('<script>alert("synthetic")</script>');
    expect(JSON.stringify(result)).not.toContain("private.invalid");
  });
  it("searches, sorts and retains unknown-date rows last", async () => {
    const data = await importFacebook(file(syntheticFacebookZip("json")));
    const records = data.categories.friends.records;
    expect(
      exploreConnections(records, "deniz", "oldest").map((row) => row.row),
    ).toEqual([1, 0]);
    expect(
      exploreConnections(records, "", "newest").map((row) => row.row),
    ).toEqual([0, 2, 1]);
    expect(
      exploreConnections(
        [...records, { row: 99, name: "No Date Example", dateBasis: "utc" }],
        "",
        "oldest",
      ).at(-1)?.row,
    ).toBe(99);
  });
});
describe("Facebook decoder and explicit timestamp semantics", () => {
  it.each([
    "İpek Örnek",
    "Çağrı Şule",
    "👩‍💻 🇹🇷",
    "e\u0301",
    "Literal Ãx Â and ©",
  ])(
    "preserves valid text and recovers reversible Latin-1 runs: %s",
    (name) => {
      const broken = Array.from(new TextEncoder().encode(name), (byte) =>
        String.fromCharCode(byte),
      ).join("");
      // Literal suspicious characters are preserved when valid; ordinary test text recovers from a single export encoding pass.
      expect(repairFacebookText(name)).toBe(name);
      expect(repairFacebookText(broken)).toBe(name);
      expect(repairFacebookText(repairFacebookText(broken))).toBe(name);
    },
  );
  it("repairs supported runs inside already-valid Unicode and leaves invalid sequences unchanged", () => {
    expect(repairFacebookText("İpek Ã–rnek 👩‍💻")).toBe("İpek Örnek 👩‍💻");
    expect(repairFacebookText("Ãx Ã\u0080\u0080")).toBe("Ãx Ã\u0080\u0080");
    expect(repairFacebookText("ÃƒÂ–rnek")).toBe("Örnek");
  });
  it.each([
    0,
    1,
    -1,
    NaN,
    Infinity,
    null,
    "1704103200",
    1704103200000,
    253402300800,
  ])("retains invalid/sentinel or millisecond dates as unknown: %s", (value) =>
    expect(facebookTimestamp(value)).toBeUndefined(),
  );
  it.each([
    ["Şub 29, 2024 12:00:00 am", "2024-02-29T00:00:00"],
    ["29 Şubat 2024 23:12:01", "2024-02-29T23:12:01"],
    ["Aug 2, 2020 12:03 pm", "2020-08-02T12:03:00"],
    ["Feb 30, 2024 1:00 pm", undefined],
    ["Jan 1, 2020 13:00 pm", undefined],
    ["unrecognized localized date", undefined],
  ])("parses only validated calendar dates (%s)", (source, expected) =>
    expect(parseFacebookHtmlDate(source)).toBe(expected),
  );
});
describe("Facebook selective ZIP safety", () => {
  it("supports wrapped directories and Windows separators while ignoring unrelated categories", () => {
    expect(
      detectFacebookConnection("wrapped/connections/friends/your_friends.html")
        ?.format,
    ).toBe("html");
    expect(
      detectFacebookConnection("connections\\friends\\your_friends.json")
        ?.category,
    ).toBe("friends");
    expect(
      detectFacebookConnection(
        "security_and_login_information/your_friends.json",
      ),
    ).toBeUndefined();
  });
  it.each([
    "../your_friends.json",
    "/your_friends.json",
    "C:/your_friends.json",
  ])("rejects unsafe paths: %s", async (path) => {
    await expect(load({ [path]: '{"friends_v2":[]}' })).rejects.toThrow(
      /Unsafe ZIP paths/,
    );
  });
  it("rejects repeated categories and mixed representations", async () => {
    await expect(
      load({
        "your_friends.json": '{"friends_v2":[]}',
        "your_friends.html": facebookHtml([]),
      }),
    ).rejects.toThrow(/one export representation/);
    await expect(
      load({
        "your_friends.json": '{"friends_v2":[]}',
        "connections/friends/your_friends.json": '{"friends_v2":[]}',
      }),
    ).rejects.toThrow(/Repeated categories/);
  });
  it("rejects unsupported, corrupt and oversized ZIPs without sensitive diagnostics", async () => {
    await expect(
      load({ "messages/private.json": "SYNTHETIC_SECRET" }),
    ).rejects.toThrow(/No supported/);
    await expect(importFacebook(file(new Uint8Array([1, 2])))).rejects.toThrow(
      /damaged/,
    );
    const bytes = facebookZip({ "your_friends.json": '{"friends_v2":[]}' });
    const view = new DataView(bytes.buffer);
    const offset = view.getUint32(bytes.length - 6, true);
    view.setUint32(offset + 24, 21 * 1024 * 1024, true);
    await expect(importFacebook(file(bytes))).rejects.toThrow(/safety limit/);
    await expect(
      importFacebook({ name: "secret.zip", size: 3 * 1024 ** 3 } as File),
    ).rejects.toThrow(/up to 2 GB/);
  });
  it("skips actual unrelated bytes rather than inflating the entire archive", async () => {
    const bytes = facebookZip({
      "your_friends.json": '{"friends_v2":[]}',
      "security_and_login_information/browser_cookies.json": "SYNTHETIC_SECRET",
    });
    const source = file(bytes);
    const reads: [number, number][] = [];
    const selective = {
      name: source.name,
      size: source.size,
      arrayBuffer() {
        throw new Error("Whole ZIP read forbidden");
      },
      slice(start: number, end: number) {
        reads.push([start, end]);
        return source.slice(start, end);
      },
    } as unknown as File;
    expect((await importFacebook(selective)).ignoredFiles).toBe(1);
    expect(reads.length).toBeGreaterThan(1);
  });
});
