import { parseDocument } from "htmlparser2";
import { findAll, textContent } from "domutils";
import {
  facebookTimestamp,
  parseFacebookHtmlDate,
  repairFacebookText,
} from "./normalize";
import type {
  ConnectionCategory,
  FacebookCoverage,
  FacebookFormat,
} from "./types";

export class FacebookImportError extends Error {}
export const sourceSchemas: Record<
  ConnectionCategory,
  { filename: string; key: string }
> = {
  friends: { filename: "your_friends", key: "friends_v2" },
  received: {
    filename: "received_friend_requests",
    key: "received_requests_v2",
  },
  rejected: {
    filename: "rejected_friend_requests",
    key: "rejected_requests_v2",
  },
  removed: { filename: "removed_friends", key: "deleted_friends_v2" },
};
export function detectFacebookConnection(
  path: string,
): { category: ConnectionCategory; format: FacebookFormat } | undefined {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  if (
    normalized.startsWith("/") ||
    normalized.includes(":") ||
    normalized.split("/").some((part) => part === ".." || part === ".")
  )
    throw new FacebookImportError(
      "Unsafe ZIP paths. Download a fresh Facebook export and try again.",
    );
  // Root files and wrapped connections/friends directories are supported.
  const match = normalized.match(
    /^(?:.*\/connections\/friends\/|connections\/friends\/)?([^/]+)\.(json|html)$/,
  );
  if (!match) return;
  const category = (Object.keys(sourceSchemas) as ConnectionCategory[]).find(
    (key) => sourceSchemas[key].filename === match[1],
  );
  return category
    ? { category, format: match[2] as FacebookFormat }
    : undefined;
}
export function emptyCoverage(
  state: FacebookCoverage["state"] = "absent",
): FacebookCoverage {
  return {
    state,
    records: [],
    sourceRows: 0,
    invalidRows: 0,
    unknownDates: 0,
    repairedNames: 0,
  };
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const MAX_ROWS = 100000;

export function parseFacebookConnections(
  text: string,
  category: ConnectionCategory,
  format: FacebookFormat,
): FacebookCoverage {
  const result = emptyCoverage("supported");
  const add = (
    name: unknown,
    timestamp: unknown,
    localDate?: string,
    spam?: unknown,
  ) => {
    const row = result.sourceRows++;
    if (row >= MAX_ROWS)
      throw new FacebookImportError(
        "Too many connection records. Request a smaller Facebook export.",
      );
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 500 ||
      /[\u0000-\u001f\u007f]/.test(name)
    ) {
      result.invalidRows++;
      return;
    }
    const repaired = repairFacebookText(name);
    if (repaired !== name) result.repairedNames++;
    const epoch = facebookTimestamp(timestamp);
    const recordedDate =
      format === "json"
        ? epoch === undefined
          ? undefined
          : new Date(epoch * 1000).toISOString().slice(0, 19)
        : localDate;
    if (!recordedDate) result.unknownDates++;
    result.records.push({
      row,
      name: repaired.trim(),
      recordedDate,
      timestamp: epoch,
      dateBasis: format === "json" ? "utc" : "export-local",
      ...(category === "rejected" && typeof spam === "boolean"
        ? { markedAsSpam: spam }
        : {}),
    });
  };
  if (format === "json") {
    let root: unknown;
    try {
      root = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
      return emptyCoverage("unsupported");
    }
    const rows = object(root) ? root[sourceSchemas[category].key] : undefined;
    if (!Array.isArray(rows)) return emptyCoverage("unsupported");
    for (const row of rows) {
      if (object(row))
        add(row.name, row.timestamp, undefined, row.marked_as_spam);
      else add(undefined, undefined);
    }
  } else {
    // htmlparser2 creates inert data nodes. It never fetches URLs or executes HTML.
    if (!/<\/main\s*>/i.test(text)) return emptyCoverage("unsupported");
    const document = parseDocument(text);
    const hasClass = (node: ReturnType<typeof findAll>[number], cls: string) =>
      (node.attribs.class ?? "").split(/\s+/).includes(cls);
    const mains = findAll(
      (node) => node.name === "main" && hasClass(node, "_a706"),
      document.children,
    );
    if (mains.length !== 1) return emptyCoverage("unsupported");
    const sections = findAll(
      (node) => node.name === "section" && hasClass(node, "_a6-g"),
      mains[0].children,
    );
    // An explicit known main container can represent an empty category.
    if (
      !sections.length &&
      (textContent(mains[0]).trim() ||
        findAll(() => true, mains[0].children).length)
    )
      return emptyCoverage("unsupported");
    for (const section of sections) {
      const headings = findAll(
        (node) => node.name === "h2" && hasClass(node, "_a6-h"),
        section.children,
      );
      const dates = findAll(
        (node) => hasClass(node, "_a72d"),
        section.children,
      );
      const date =
        dates.length === 1
          ? parseFacebookHtmlDate(textContent(dates[0]))
          : undefined;
      add(
        headings.length === 1 ? textContent(headings[0]) : undefined,
        undefined,
        date,
      );
    }
    const unrecognizedSections = findAll(
      (node) => node.name === "section" && !hasClass(node, "_a6-g"),
      mains[0].children,
    );
    result.invalidRows += unrecognizedSections.length;
    result.sourceRows += unrecognizedSections.length;
    if (result.sourceRows > MAX_ROWS)
      throw new FacebookImportError(
        "Too many connection records. Request a smaller Facebook export.",
      );
  }
  result.state =
    result.invalidRows || result.unknownDates
      ? "partial"
      : result.records.length
        ? "supported"
        : "empty";
  return result;
}
