import { parseDocument } from "htmlparser2";
import { findAll, textContent } from "domutils";
import { account } from "./normalize";
import type { Account, ParsedPart, Relationship } from "./types";
import { ImportError } from "./errors";
import { connectionFormats, connectionKinds } from "./connections";

type HtmlElement = ReturnType<typeof findAll>[number];
type HtmlNode = HtmlElement["children"][number];

export { ImportError } from "./errors";
export function detectKind(path: string): Relationship | undefined {
  const filename =
    path.replaceAll("\\", "/").split("/").pop()?.toLowerCase() ?? "";
  if (/^followers(?:_\d+)?\.(json|html?)$/.test(filename)) return "followers";
  if (/^following(?:_\d+)?\.(json|html?)$/.test(filename)) return "following";
  return connectionKinds.find((kind) => {
    const format = connectionFormats[kind];
    const suffix = format.allowNumericSuffix === false ? "" : "(?:_\\d+)?";
    const extension =
      format.allowHtm === false ? "(json|html)" : "(json|html?)";
    return new RegExp(`^${format.filename}${suffix}\\.${extension}$`).test(
      filename,
    );
  });
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function parseEntries(
  value: unknown,
  allowLabels = false,
  labelledOnly = false,
): Account[] {
  if (!Array.isArray(value))
    throw new ImportError(
      "The relationship list has an unsupported structure. Request a fresh JSON export from Instagram.",
    );
  const result: Account[] = [];
  for (const row of value) {
    if (allowLabels && record(row) && Array.isArray(row.label_values)) {
      const fields = row.label_values.filter(record);
      if (labelledOnly) {
        const identities = fields
          .filter((field) => field.label === "Username")
          .map((field) => account(field.value, row.timestamp));
        if (
          !identities.length ||
          identities.some((entry) => entry === null) ||
          new Set(identities.map((entry) => entry?.username)).size !== 1
        )
          throw new ImportError(
            "A connection record has no unambiguous exported Username. Incomplete results would be misleading.",
          );
        result.push(identities[0]!);
        continue;
      }
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
    if (labelledOnly)
      throw new ImportError(
        "This connection list requires exported labelled account records. Request a fresh export including this category.",
      );
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
          kind !== "followers" && kind !== "following"
            ? connectionFormats[kind].labelledOnly
            : false,
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

function htmlElement(node: HtmlNode | null | undefined): node is HtmlElement {
  return !!node && "name" in node;
}

function htmlProfile(value: string | undefined): Account | null {
  // A bare relative href can look like a username. Only exported, absolute
  // profile URLs establish identity; normalize keeps the host/path safeguards.
  return value && /^https?:\/\//i.test(value.trim()) ? account(value) : null;
}

function excludedHtmlContext(node: HtmlElement, root: HtmlNode): boolean {
  for (
    let parent: HtmlNode | null = node;
    parent && parent !== root;
    parent = parent.parent
  ) {
    if (
      htmlElement(parent) &&
      (["nav", "header", "footer", "aside", "script", "style"].includes(
        parent.name,
      ) ||
        ["navigation", "banner", "contentinfo"].includes(parent.attribs.role))
    )
      return true;
  }
  return false;
}

function ancestorTable(node: HtmlNode): HtmlElement | undefined {
  for (let parent = node.parent; parent; parent = parent.parent)
    if (htmlElement(parent) && parent.name === "table") return parent;
}

function htmlLabelAccount(
  table: HtmlElement,
  requireUsername = false,
): Account | undefined {
  const fields = new Map<string, string[]>();
  let hasFieldRows = false;
  for (const row of findAll((node) => node.name === "tr", table.children)) {
    if (ancestorTable(row) !== table) continue;
    const cells = row.children.filter(
      (node): node is HtmlElement =>
        htmlElement(node) && ["td", "th"].includes(node.name),
    );
    if (!cells.length) continue;
    hasFieldRows = true;
    const label = textContent(cells[0]).trim();
    if (!["Username", "URL", "Name"].includes(label)) continue;
    if (cells.length !== 2)
      throw new ImportError(
        "An HTML connection field is malformed. Incomplete results would be misleading.",
      );
    const values = fields.get(label) ?? [];
    values.push(textContent(cells[1]).trim());
    fields.set(label, values);
  }
  if (!fields.size) {
    if (hasFieldRows)
      throw new ImportError(
        "An HTML connection table has unsupported fields. Incomplete results would be misleading.",
      );
    return undefined;
  }
  // Match JSON label_values: Username is authoritative even when URL is stale,
  // and Name never supplies identity. Multiple distinct identities are unsafe.
  const usernameFields = (fields.get("Username") ?? []).map((value) =>
    account(value),
  );
  if (
    requireUsername &&
    (!usernameFields.length || usernameFields.some((entry) => entry === null))
  )
    throw new ImportError(
      "An HTML connection record has no supported exported Username. Incomplete results would be misleading.",
    );
  if (
    usernameFields.length > 1 &&
    usernameFields.some((entry) => entry === null)
  )
    throw new ImportError(
      "An HTML connection record contains malformed Username fields. Incomplete results would be misleading.",
    );
  const usernames = usernameFields.filter(
    (entry): entry is Account => entry !== null,
  );
  const profiles = usernames.length
    ? usernames
    : (fields.get("URL") ?? [])
        .map((value) => htmlProfile(value))
        .filter((entry): entry is Account => entry !== null);
  if (!profiles.length)
    throw new ImportError(
      "An HTML connection record has no supported Instagram username. Incomplete results would be misleading.",
    );
  if (new Set(profiles.map((entry) => entry.username)).size !== 1)
    throw new ImportError(
      "An HTML connection record contains multiple Instagram identities. Incomplete results would be misleading.",
    );
  return profiles[0];
}

function htmlRecordContainer(node: HtmlElement, root: HtmlNode): HtmlElement {
  let closestBlock: HtmlElement | undefined;
  for (
    let parent: HtmlNode | null = node;
    parent && parent !== root;
    parent = parent.parent
  ) {
    if (!htmlElement(parent)) continue;
    if (parent.attribs.class?.split(/\s+/).includes("_a6-g")) return parent;
    if (
      !closestBlock &&
      ["div", "table", "section", "article", "li"].includes(parent.name)
    )
      closestBlock = parent;
  }
  return closestBlock ?? node;
}

function htmlRecordAccounts(
  document: ReturnType<typeof parseDocument>,
  kind: Relationship,
): Account[] {
  const main = findAll((node) => node.name === "main", document.children)[0];
  const body = findAll((node) => node.name === "body", document.children)[0];
  const root = main ?? body ?? document;
  const labelledOnly =
    kind !== "followers" &&
    kind !== "following" &&
    connectionFormats[kind].labelledOnly === true;
  const seeds: { node: HtmlElement; profile: Account; labelled: boolean }[] =
    [];
  for (const node of findAll(
    (node) => ["table", "a"].includes(node.name),
    root.children,
  )) {
    if (excludedHtmlContext(node, root)) continue;
    if (node.name === "table") {
      if (kind === "followers" || kind === "following") continue;
      const profile = htmlLabelAccount(node, labelledOnly);
      if (profile) seeds.push({ node, profile, labelled: true });
      continue;
    }
    // URL fields inside tables belong to their labelled record, never a second
    // account inferred from its stale URL. Core imports do not consume tables.
    if (ancestorTable(node)) continue;
    if (labelledOnly) continue;
    const profile = htmlProfile(node.attribs.href);
    if (profile) seeds.push({ node, profile, labelled: false });
  }
  const records = new Map<HtmlElement, typeof seeds>();
  for (const seed of seeds) {
    const container = htmlRecordContainer(seed.node, root);
    const entries = records.get(container) ?? [];
    entries.push(seed);
    records.set(container, entries);
  }
  // Count logical records under each wrapper, rather than assuming that every
  // main child is one account. Dates may climb nested single-record wrappers,
  // but never cross a container owning another record.
  const declaredCards = findAll(
    (node) =>
      node.attribs.class?.split(/\s+/).includes("_a6-g") === true &&
      !excludedHtmlContext(node, root),
    root.children,
  );
  const cardsWithChildren = new Set<HtmlElement>();
  for (const card of declaredCards)
    for (let node = card.parent; node && node !== root; node = node.parent)
      if (
        htmlElement(node) &&
        node.attribs.class?.split(/\s+/).includes("_a6-g")
      )
        cardsWithChildren.add(node);
  const terminalCards = declaredCards.filter(
    (card) => !cardsWithChildren.has(card),
  );
  // Declared record boundaries matter even if a malformed record supplies no
  // valid profile seed. Otherwise its date could migrate to an adjacent account.
  const boundaries = new Set([...records.keys(), ...terminalCards]);
  const recordCounts = new Map<HtmlNode, number>();
  for (const container of boundaries)
    for (
      let node: HtmlNode | null = container;
      node && node !== root;
      node = node.parent
    )
      recordCounts.set(node, (recordCounts.get(node) ?? 0) + 1);
  if (records.size)
    for (const card of terminalCards)
      if (!records.has(card) && textContent(card).trim())
        throw new ImportError(
          "An HTML relationship record has no supported Instagram identity. Incomplete results would be misleading.",
        );
  const result: Account[] = [];
  for (const [container, entries] of records) {
    if (new Set(entries.map(({ profile }) => profile.username)).size !== 1)
      throw new ImportError(
        "An HTML relationship record contains multiple Instagram profiles. Request a fresh export; incomplete results would be misleading.",
      );
    const profile = entries[0].profile;
    let record = container;
    let declaredScope = container.attribs.class?.split(/\s+/).includes("_a6-g")
      ? container
      : undefined;
    while (
      htmlElement(record.parent) &&
      record.parent !== root &&
      recordCounts.get(record.parent) === 1
    ) {
      record = record.parent;
      if (record.attribs.class?.split(/\s+/).includes("_a6-g"))
        declaredScope = record;
    }
    // A Meta account card owns its dates. Extra layout wrappers must not lend
    // unrelated date text to an otherwise undated card.
    if (declaredScope) record = declaredScope;
    const headings = findAll(
      (node) =>
        /^h[1-6]$/.test(node.name) &&
        !ancestorTable(node) &&
        !excludedHtmlContext(node, record),
      record.children,
    );
    if (
      !entries.some(
        ({ node, labelled }) =>
          labelled ||
          (!main && !body && node.parent === root) ||
          account(textContent(node).trim())?.username === profile.username,
      ) &&
      !headings.some(
        (heading) =>
          account(textContent(heading).trim())?.username === profile.username,
      )
    ) {
      if (declaredScope)
        throw new ImportError(
          "An HTML relationship record has no supported Instagram identity. Incomplete results would be misleading.",
        );
      continue;
    }
    const dates = findAll(
      (node) =>
        !ancestorTable(node) &&
        !excludedHtmlContext(node, record) &&
        parseHtmlDate(textContent(node)) !== undefined,
      record.children,
    )
      .map((node) => parseHtmlDate(textContent(node)))
      .filter((timestamp): timestamp is number => timestamp !== undefined);
    const timestamps = [...new Set(dates)];
    result.push(
      timestamps.length === 1
        ? account(profile.username, timestamps[0], "minute-without-timezone")!
        : profile,
    );
  }
  return result;
}

function htmlGenerationMinute(
  document: ReturnType<typeof parseDocument>,
): string | undefined {
  const dates = new Set<string>();
  for (const header of findAll(
    (node) =>
      node.name === "header" &&
      node.attribs.class?.split(/\s+/).includes("_a70a") === true,
    document.children,
  )) {
    for (const aside of findAll(
      (node) =>
        node.name === "aside" &&
        node.attribs.role === "contentinfo" &&
        node.attribs.class?.split(/\s+/).includes("_aoaa") === true,
      header.children,
    )) {
      // Only the verified Meta generation header establishes this meaning.
      // Owner text is checked, then discarded; it never enters provenance.
      const label = aside.children
        .filter((node) => !htmlElement(node))
        .map((node) => textContent(node))
        .join("")
        .trim();
      if (!/^Generated by\s+.+\s+on$/i.test(label)) continue;
      const times = findAll((node) => node.name === "time", aside.children);
      if (times.length !== 1) return undefined;
      const value = times[0].attribs.datetime;
      if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(value))
        return undefined;
      const milliseconds = Date.parse(value);
      if (
        !Number.isFinite(milliseconds) ||
        `${new Date(milliseconds).toISOString().slice(0, 16)}Z` !== value
      )
        return undefined;
      dates.add(value);
    }
  }
  return dates.size === 1 ? [...dates][0] : undefined;
}

export function parseHtmlSource(
  text: string,
  kind?: Relationship,
): { parts: ParsedPart[]; generationDate?: string } {
  if (!kind)
    throw new ImportError(
      "Keep the original Instagram list filenames so we can identify each list.",
    );
  // A pure text parser: no DOM insertion, resource loading, or script execution.
  const document = parseDocument(text);
  const accounts = htmlRecordAccounts(document, kind);
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
  return {
    parts: [{ kind, accounts }],
    generationDate: htmlGenerationMinute(document),
  };
}

// Preserve the public record-only parser contract; import additionally consumes
// the bounded, non-sensitive generation observation from the same parsed tree.
export function parseHtml(text: string, kind?: Relationship): ParsedPart[] {
  return parseHtmlSource(text, kind).parts;
}
