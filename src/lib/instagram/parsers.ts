import { parseDocument } from "htmlparser2";
import { findAll, textContent } from "domutils";
import { account } from "./normalize";
import type { Account, ParsedPart, Relationship } from "./types";
import { ImportError } from "./errors";

export { ImportError } from "./errors";
export function detectKind(path: string): Relationship | undefined {
  const filename =
    path.replaceAll("\\", "/").split("/").pop()?.toLowerCase() ?? "";
  if (/^followers(?:_\d+)?\.(json|html?)$/.test(filename)) return "followers";
  if (/^following(?:_\d+)?\.(json|html?)$/.test(filename)) return "following";
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function parseEntries(value: unknown): Account[] {
  if (!Array.isArray(value))
    throw new ImportError(
      "The relationship list has an unsupported structure. Request a fresh JSON export from Instagram.",
    );
  const result: Account[] = [];
  for (const row of value) {
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
    for (const relation of ["followers", "following"] as const) {
      const key = `relationships_${relation}`;
      if (key in data)
        parts.push({ kind: relation, accounts: parseEntries(data[key]) });
    }
    if (parts.length) return parts;
  }
  if (kind && Array.isArray(data))
    return [{ kind, accounts: parseEntries(data) }];
  throw new ImportError(
    "No supported Followers or Following list was found. Keep the original filenames or upload the complete export ZIP.",
  );
}
export function parseHtml(text: string, kind?: Relationship): ParsedPart[] {
  if (!kind)
    throw new ImportError(
      "Keep the original followers.html or following.html filenames so we can identify each list.",
    );
  // A pure text parser: no DOM insertion, resource loading, or script execution.
  const document = parseDocument(text);
  const anchors = findAll(
    (node) => node.name === "a" && !!node.attribs.href,
    document.children,
  );
  const accounts: Account[] = [];
  for (const anchor of anchors) {
    const entry = account(anchor.attribs.href);
    if (entry) accounts.push(entry);
  }
  if (!accounts.length) {
    const content = textContent(document).toLowerCase();
    // Accept explicit empty exports only; an arbitrary empty document is not valid data.
    if (
      !content.includes(kind) ||
      !/no (?:data|followers|following)|no accounts|0 accounts/.test(content)
    ) {
      throw new ImportError(
        "No recognizable profile links were found in this HTML list. Try Instagram's JSON export instead.",
      );
    }
  }
  return [{ kind, accounts }];
}
