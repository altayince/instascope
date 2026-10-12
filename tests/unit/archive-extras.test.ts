import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { importDataset, importFiles } from "../../src/lib/instagram/import";
import {
  detectKind,
  parseHtml,
  parseHtmlDate,
  parseJson,
} from "../../src/lib/instagram/parsers";
import {
  account,
  isDeletedInstagramAccount,
} from "../../src/lib/instagram/normalize";
import { analyze } from "../../src/lib/analysis/relationships";
import { buildStories } from "../../src/lib/analysis/stories";
import {
  createVaultSnapshot,
  serializeVaultBackup,
} from "../../src/lib/snapshot-vault";
import { demoPartialExport, demoSnapshots } from "../../src/lib/demo";
import {
  archiveExtraFilenames,
  archiveExtraHtml,
  archiveExtraJsonRow,
  archiveExtraKinds,
} from "../helpers/archive-extras-export";
import {
  htmlConnectionDocument,
  htmlLabelRecord,
} from "../helpers/html-connection-export";

const input = (name: string, text: string) => ({ name, bytes: strToU8(text) });
const json = (name: string, value: unknown) =>
  input(name, JSON.stringify(value));
const core = [json("followers.json", []), json("following.json", [])];
const timestamp = 1704067200;
const deleted = "__deleted__abcdefghijabcdefg";

describe.each(archiveExtraKinds)("verified archive extra %s", (kind) => {
  const filename = archiveExtraFilenames[kind];

  it("detects only the observed exact JSON/HTML filename, including nested paths", () => {
    for (const extension of ["json", "html"])
      expect(
        detectKind(
          `export/connections/followers_and_following/${filename.toUpperCase()}.${extension}`,
        ),
      ).toBe(kind);
    for (const name of [
      `${filename}_1.json`,
      `${filename}_2.html`,
      `${filename}.htm`,
      `my_${filename}.json`,
      `${filename}.json.bak`,
    ])
      expect(detectKind(name)).toBeUndefined();
  });

  it("reads a labelled JSON root array and never keeps names or IDs", () => {
    const parsed = parseJson(
      JSON.stringify([archiveExtraJsonRow("SYNTHETIC.Extra", timestamp)]),
      kind,
    );
    expect(parsed).toEqual([
      { kind, accounts: [account("synthetic.extra", timestamp)] },
    ]);
    expect(JSON.stringify(parsed)).not.toMatch(
      /fbid|synthetic-reference|display.name|label_values/,
    );
  });

  it("requires explicit valid, unambiguous Username fields and rejects guessed containers or legacy rows", () => {
    for (const source of [
      { relationships_follow_requests_sent_recently: [] },
      { relationships_removed_suggestions: [] },
      [{ string_list_data: [{ value: "synthetic.extra", timestamp }] }],
      [{ label_values: [{ label: "Name", value: "looks.valid" }] }],
      [
        {
          label_values: [
            {
              label: "URL",
              value: "https://www.instagram.com/synthetic.extra/",
            },
          ],
        },
      ],
      [
        {
          label_values: [
            { label: "Username", value: "bad/name" },
            {
              label: "URL",
              value: "https://www.instagram.com/synthetic.extra/",
            },
          ],
        },
      ],
      [
        {
          label_values: [
            { label: "Username", value: "synthetic.first" },
            { label: "Username", value: "synthetic.second" },
          ],
        },
      ],
    ])
      expect(() => parseJson(JSON.stringify(source), kind)).toThrow();
  });

  it("reads verified nested HTML label cards while discarding navigation and stale URLs", () => {
    const parsed = parseHtml(
      archiveExtraHtml(kind, [
        { username: "SYNTHETIC.Extra", date: "Jan 02, 2025 1:05 pm" },
        { username: "synthetic.unknown" },
      ]),
      kind,
    );
    expect(parsed[0].accounts).toEqual([
      account(
        "synthetic.extra",
        parseHtmlDate("Jan 02, 2025 1:05 pm"),
        "minute-without-timezone",
      ),
      account("synthetic.unknown"),
    ]);
    expect(JSON.stringify(parsed)).not.toMatch(
      /navigation|footer|stale-profile|display.name/,
    );
  });

  it("does not consume arbitrary profile anchors or URL/display-name-only HTML records", () => {
    for (const text of [
      `<main><section><a href="https://www.instagram.com/synthetic.extra/">synthetic.extra</a><p>Jan 02, 2025 1:05 pm</p></section></main>`,
      htmlConnectionDocument([
        htmlLabelRecord([
          ["Name", "looks.valid"],
          ["URL", "https://www.instagram.com/synthetic.extra/"],
        ]),
      ]),
      htmlConnectionDocument([htmlLabelRecord([["Username", "p"]])]),
      htmlConnectionDocument([
        htmlLabelRecord([
          ["Username", "synthetic.first"],
          ["Username", "synthetic.second"],
        ]),
      ]),
    ])
      expect(() => parseHtml(text, kind)).toThrow();
  });

  it("imports loose JSON and HTML alongside unchanged core lists", () => {
    const jsonData = importDataset([
      ...core,
      json(`${filename}.json`, [
        archiveExtraJsonRow("synthetic.extra", timestamp),
      ]),
    ]);
    const htmlData = importDataset([
      ...core,
      input(
        `${filename}.html`,
        archiveExtraHtml(kind, [
          { username: "synthetic.extra", date: "Jan 02, 2025 1:05 pm" },
        ]),
      ),
    ]);
    for (const dataset of [jsonData, htmlData]) {
      expect(dataset.connections![kind].status).toBe("available");
      expect(dataset.connections![kind].accounts[0].username).toBe(
        "synthetic.extra",
      );
      expect(analyze(dataset).followers).toEqual([]);
      expect(analyze(dataset).following).toEqual([]);
      expect(
        dataset.metadata.importProvenance!.categories[kind].sourceFiles,
      ).toBe(1);
    }
  });

  it("selectively imports both formats from ZIP through memory and browser File adapters", async () => {
    for (const extension of ["json", "html"]) {
      const text =
        extension === "json"
          ? JSON.stringify([archiveExtraJsonRow("synthetic.extra", timestamp)])
          : archiveExtraHtml(kind, [
              { username: "synthetic.extra", date: "Jan 02, 2025 1:05 pm" },
            ]);
      const zip = zipSync({
        "connections/followers_and_following/followers.json": strToU8("[]"),
        "connections/followers_and_following/following.json": strToU8("[]"),
        [`connections/followers_and_following/${filename}.${extension}`]:
          strToU8(text),
        [`connections/followers_and_following/${filename}_1.${extension}`]:
          strToU8("invalid unobserved split"),
        "connections/contacts/synced_contacts.json": strToU8(
          "ignored private contacts",
        ),
        "messages/inbox/unsupported.json": strToU8("ignored unrelated content"),
      });
      const sync = importDataset([{ name: "synthetic.zip", bytes: zip }]);
      const blob = await importFiles([new File([zip], "synthetic.zip")]);
      expect(blob.connections).toEqual(sync.connections);
      expect(sync.connections![kind].status).toBe("available");
      expect(sync.metadata.importProvenance).toMatchObject({
        recognizedFiles: 3,
        ignoredFiles: 3,
      });
      expect(sync.metadata.importProvenance!.categories[kind]).toMatchObject({
        sourceFiles: 1,
        parsedFiles: 1,
      });
    }
  });

  it("distinguishes available-empty, missing and unsupported without invalidating core data", () => {
    const empty = importDataset([...core, json(`${filename}.json`, [])]);
    const missing = importDataset(core);
    const broken = importDataset([...core, input(`${filename}.json`, "{")]);
    expect(empty.connections![kind]).toEqual({
      status: "available",
      accounts: [],
    });
    expect(missing.connections![kind].status).toBe("missing");
    expect(broken.connections![kind].status).toBe("unsupported");
    expect(broken.connections![kind].accounts).toEqual([]);
    expect(broken.followers).toEqual([]);
    expect(broken.following).toEqual([]);
    expect(
      broken.metadata.importProvenance!.categories[kind].unsupportedFiles,
    ).toBe(1);
  });

  it("accepts explicit HTML empty-list evidence, never an arbitrary empty section", () => {
    const title = filename.replaceAll("_", " ");
    const empty = importDataset([
      ...core,
      input(`${filename}.html`, `<h1>${title}</h1><main>No accounts</main>`),
    ]);
    const unsupported = importDataset([
      ...core,
      input(`${filename}.html`, `<h1>${title}</h1><main></main>`),
    ]);
    expect(empty.connections![kind]).toEqual({
      status: "available",
      accounts: [],
    });
    expect(unsupported.connections![kind].status).toBe("unsupported");
  });

  it("marks the whole category unsupported if one record is malformed", () => {
    const jsonData = importDataset([
      ...core,
      json(`${filename}.json`, [
        archiveExtraJsonRow("synthetic.extra"),
        { label_values: [{ label: "Name", value: "bad.identity" }] },
      ]),
    ]);
    const htmlData = importDataset([
      ...core,
      input(
        `${filename}.html`,
        htmlConnectionDocument([
          htmlLabelRecord([["Username", "synthetic.extra"]]),
          htmlLabelRecord([["Name", "bad.identity"]]),
        ]),
      ),
    ]);
    for (const dataset of [jsonData, htmlData]) {
      expect(dataset.connections![kind].status).toBe("unsupported");
      expect(dataset.connections![kind].accounts).toEqual([]);
    }
  });

  it("normalizes and deduplicates account records without turning them into action events", () => {
    const rows = [
      archiveExtraJsonRow("SYNTHETIC.Extra", 200),
      archiveExtraJsonRow("synthetic.extra", 100),
      archiveExtraJsonRow("@synthetic.extra", 200),
    ];
    const data = importDataset([...core, json(`${filename}.json`, rows)]);
    expect(data.connections![kind].accounts).toEqual([
      account("synthetic.extra", 100),
    ]);
  });

  it("preserves deleted sentinels and does not classify legitimate deleted-word usernames", () => {
    const jsonData = importDataset([
      ...core,
      json(`${filename}.json`, [
        archiveExtraJsonRow(deleted),
        archiveExtraJsonRow("synthetic.deleted.editor"),
      ]),
    ]);
    const htmlData = importDataset([
      ...core,
      input(
        `${filename}.html`,
        archiveExtraHtml(kind, [
          { username: deleted },
          { username: "synthetic.deleted.editor" },
        ]),
      ),
    ]);
    expect(jsonData.connections![kind].accounts).toEqual(
      htmlData.connections![kind].accounts,
    );
    expect(jsonData.connections![kind].accounts).toHaveLength(2);
    expect(
      isDeletedInstagramAccount(
        jsonData.connections![kind].accounts[0].username,
      ),
    ).toBe(true);
    expect(
      isDeletedInstagramAccount(
        jsonData.connections![kind].accounts[1].username,
      ),
    ).toBe(false);
  });

  it("keeps exact JSON instants distinct from timezone-free HTML minutes", () => {
    const htmlDate = "Jan 02, 2025 12:00 am";
    const value = parseHtmlDate(htmlDate)!;
    const jsonRecord = parseJson(
      JSON.stringify([archiveExtraJsonRow("synthetic.extra", value)]),
      kind,
    )[0].accounts[0];
    const htmlRecord = parseHtml(
      archiveExtraHtml(kind, [{ username: "synthetic.extra", date: htmlDate }]),
      kind,
    )[0].accounts[0];
    expect(jsonRecord.timestamp).toBe(htmlRecord.timestamp);
    expect(jsonRecord.timestampPrecision).toBeUndefined();
    expect(htmlRecord.timestampPrecision).toBe("minute-without-timezone");
    expect(
      importDataset([
        ...core,
        json(`${filename}.json`, [
          archiveExtraJsonRow("synthetic.extra", value),
        ]),
        input(
          `${filename}.html`,
          archiveExtraHtml(kind, [
            { username: "synthetic.extra", date: htmlDate },
          ]),
        ),
      ]).connections![kind].accounts,
    ).toEqual([jsonRecord]);
  });

  it("preserves accounts with missing or malformed dates without inventing them", () => {
    for (const value of [undefined, "yesterday", Number.NaN, -1, 0])
      expect(
        parseJson(
          JSON.stringify([archiveExtraJsonRow("synthetic.extra", value)]),
          kind,
        )[0].accounts,
      ).toEqual([account("synthetic.extra")]);
    for (const date of [undefined, "Feb 30, 2025 1:00 pm", "yesterday"])
      expect(
        parseHtml(
          archiveExtraHtml(kind, [{ username: "synthetic.extra", date }]),
          kind,
        )[0].accounts,
      ).toEqual([account("synthetic.extra")]);
  });
});

it("never detects received requests, favorites, muted, removed followers or synced contacts from speculative filenames", () => {
  for (const filename of [
    "received_follow_requests",
    "follow_requests_received",
    "favorites",
    "favorite_profiles",
    "muted_accounts",
    "removed_followers",
    "synced_contacts",
  ])
    expect(detectKind(`${filename}.json`)).toBeUndefined();
});

it("keeps deterministic extras fictional, local and separate from missing/empty demo illustrations", () => {
  const first = demoSnapshots().newer;
  expect(first).toEqual(demoSnapshots().newer);
  for (const [kind, prefix, count] of [
    ["recentFollowRequests", "recentrequest", 3],
    ["removedSuggestions", "suggestion", 4],
  ] as const) {
    expect(first.connections![kind].status).toBe("available");
    expect(first.connections![kind].accounts).toHaveLength(count);
    expect(
      first.connections![kind].accounts.every((entry) =>
        entry.username.startsWith(`demo.${prefix}.`),
      ),
    ).toBe(true);
    expect(first.connections![kind].accounts.at(-1)?.timestamp).toBeUndefined();
  }
  const partial = demoPartialExport();
  expect(partial.connections!.recentFollowRequests.status).toBe("missing");
  expect(partial.connections!.removedSuggestions).toEqual({
    status: "available",
    accounts: [],
  });
});

it("excludes extras and their counts from saved snapshots/backups and shared Wrapped stories", () => {
  const dataset = demoSnapshots().newer;
  dataset.metadata.demo = false;
  const plain = { ...dataset, connections: undefined };
  expect(buildStories(analyze(dataset), dataset, null)).toEqual(
    buildStories(analyze(plain), plain, null),
  );
  const snapshot = createVaultSnapshot(
    dataset,
    "2025-01-15",
    "synthetic-extras",
    1,
  );
  expect(snapshot).toEqual(
    createVaultSnapshot(plain, "2025-01-15", "synthetic-extras", 1),
  );
  expect(serializeVaultBackup([snapshot])).not.toMatch(
    /recentFollowRequests|removedSuggestions|demo\.(recentrequest|suggestion)\./,
  );
});
