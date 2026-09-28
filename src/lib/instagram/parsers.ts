import { parseDocument } from "htmlparser2";
import { findAll, textContent } from "domutils";
import { account } from "./normalize";
import type { Account, ParsedPart, Relationship } from "./types";
import { ImportError } from "./errors";
import { connectionFormats, connectionKinds } from "./connections";

type HtmlElement = ReturnType<typeof findAll>[number];

export { ImportError } from "./errors";
export function detectKind(path: string): Relationship | undefined {
  const filename =
    path.replaceAll("\\", "/").split("/").pop()?.toLowerCase() ?? "";
  if (/^followers(?:_\d+)?\.(json|html?)$/.test(filename)) return "followers";
  if (/^following(?:_\d+)?\.(json|html?)$/.test(filename)) return "following";
  return connectionKinds.find((kind) =>
    new RegExp(
      `^${connectionFormats[kind].filename}(?:_\\d+)?\\.(json|html?)$`,
    ).test(filename),
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function parseEntries(value: unknown, allowLabels = false): Account[] {
  if (!Array.isArray(value))
    throw new ImportError(
      "The relationship list has an unsupported structure. Request a fresh JSON export from Instagram.",
    );
  const result: Account[] = [];
  for (const row of value) {
    if (allowLabels && record(row) && Array.isArray(row.label_values)) {
      const fields = row.label_values.filter(record);
      // A display name can look like a username. Never infer identity from Name.
      const url = fields.find((field) => field.label === "URL")?.value;
      const username = fields.find(
        (field) => field.label === "Username",
      )?.value;
      // Explicit Username is authoritative: exported profile URLs can be stale.
      const entry =
        account(username, row.timestamp) ??
        (typeof url === "string" && /^https?:\/\//i.test(url)
          ? account(url, row.timestamp)
          : null);
      if (!entry)
        throw new ImportError(
          "A connection record has no supported Instagram username. Request a fresh JSON export.",
        );
      result.push(entry);
      continue;
    }
    if (!record(row) || !Array.isArray(row.string_list_data))
      throw new ImportError(
        "A relationship record is malformed. Request a fresh export; incomplete results would be misleading.",
      );
    let accepted = false;
    for (const item of row.string_list_data) {
      if (!record(item)) continue;
      const entry =
        account(item.value, item.timestamp) ??
        account(item.href, item.timestamp) ??
        account(row.title, item.timestamp);
      if (entry) {
        result.push(entry);
        accepted = true;
      }
    }
    if (!accepted)
      throw new ImportError(
        "A relationship record has no valid Instagram username. This export format is not supported yet.",
      );
  }
  return result;
}
export function parseJson(text: string, kind?: Relationship): ParsedPart[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError(
      "This JSON file is damaged or incomplete. Download it again and retry.",
    );
  }
  if (record(data)) {
    const parts: ParsedPart[] = [];
    if (kind && kind !== "followers" && kind !== "following") {
      for (const key of connectionFormats[kind].keys) {
        if (key in data)
          return [{ kind, accounts: parseEntries(data[key], true) }];
      }
      throw new ImportError(
        "This optional connection list has an unsupported structure. Request a fresh JSON export.",
      );
    }
    for (const relation of ["followers", "following"] as const) {
      const key = `relationships_${relation}`;
      if (key in data)
        parts.push({ kind: relation, accounts: parseEntries(data[key]) });
    }
    if (parts.length) return parts;
  }
  if (kind && Array.isArray(data))
    return [
      {
        kind,
        accounts: parseEntries(
          data,
          kind !== "followers" && kind !== "following",
        ),
      },
    ];
  throw new ImportError(
    "No supported Followers or Following list was found. Keep the original filenames or upload the complete export ZIP.",
  );
}

const htmlMonths = new Map(
  [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].map((month, index) => [month, index]),
);

export function parseHtmlDate(value: string): number | undefined {
  const match =
    /^(?<month>[A-Z][a-z]{2}) (?<day>\d{2}), (?<year>\d{4}) (?<hour>\d{1,2}):(?<minute>\d{2}) (?<period>am|pm)$/.exec(
      value.trim(),
    );
  if (!match?.groups) return undefined;
  const month = htmlMonths.get(match.groups.month);
  const day = Number(match.groups.day);
  const year = Number(match.groups.year);
  const sourceHour = Number(match.groups.hour);
  const minute = Number(match.groups.minute);
  if (
    month === undefined ||
    year < 1000 ||
    day < 1 ||
    sourceHour < 1 ||
    sourceHour > 12 ||
    minute > 59
  )
    return undefined;
  const hour =
    match.groups.period === "am" ? sourceHour % 12 : (sourceHour % 12) + 12;
  const milliseconds = Date.UTC(year, month, day, hour, minute);
  const date = new Date(milliseconds);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  )
    return undefined;
  // HTML exports omit timezone and seconds. UTC storage preserves the displayed
  // calendar fields; timestampPrecision prevents treating this as an exact instant.
  return milliseconds / 1000;
}

function htmlRecordAccounts(
  document: ReturnType<typeof parseDocument>,
): Account[] {
  const main = findAll((node) => node.name === "main", document.children)[0];
  const body = findAll((node) => node.name === "body", document.children)[0];
  const root = main ?? body;
  const children = (root?.children ?? document.children).filter(
    (node): node is HtmlElement => "name" in node,
  );
  const records = main
    ? children
    : children.filter((node) => node.name === "a");
  const result: Account[] = [];
  for (const record of records) {
    const anchors =
      record.name === "a"
        ? [record]
        : findAll(
            (node) => node.name === "a" && !!account(node.attribs.href),
            record.children,
          );
    const profiles = anchors
      .map((anchor) => account(anchor.attribs.href))
      .filter((entry): entry is Account => entry !== null);
    if (!profiles.length) continue;
    if (profiles.length !== 1)
      throw new ImportError(
        "An HTML relationship record contains multiple Instagram profiles. Request a fresh export; incomplete results would be misleading.",
      );
    const dates = findAll(
      (node) => parseHtmlDate(textContent(node)) !== undefined,
      record.children,
    )
      .map((node) => parseHtmlDate(textContent(node)))
      .filter((timestamp): timestamp is number => timestamp !== undefined);
    const timestamps = [...new Set(dates)];
    result.push(
      timestamps.length === 1
        ? account(
            profiles[0].username,
            timestamps[0],
            "minute-without-timezone",
          )!
        : profiles[0],
    );
  }
  return result;
}

export function parseHtml(text: string, kind?: Relationship): ParsedPart[] {
  if (!kind)
    throw new ImportError(
      "Keep the original Instagram list filenames so we can identify each list.",
    );
  // A pure text parser: no DOM insertion, resource loading, or script execution.
  const document = parseDocument(text);
  const accounts = htmlRecordAccounts(document);
  if (!accounts.length) {
    const content = textContent(document).toLowerCase();
    // Accept explicit empty exports only; an arbitrary empty document is not valid data.
    if (
      !content.includes(
        kind === "followers" || kind === "following"
          ? kind
          : connectionFormats[kind].filename.replaceAll("_", " "),
      ) ||
      !/no (?:data|followers|following)|no accounts|0 accounts/.test(content)
    ) {
      throw new ImportError(
        "No recognizable profile links were found in this HTML list. Try Instagram's JSON export instead.",
      );
    }
  }
  return [{ kind, accounts }];
}
