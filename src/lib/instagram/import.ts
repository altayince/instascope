import { strFromU8 } from "fflate";
import { deduplicate, deduplicateEvents } from "./normalize";
import { connectionKinds, missingConnection } from "./connections";
import { detectKind, ImportError, parseHtml, parseJson } from "./parsers";
import { extractZip, extractZipBlob, type ImportBudget } from "./zip";
import { LIMITS, validateSelection } from "./limits";
import type {
  ConnectionKind,
  ConnectionList,
  Dataset,
  ParsedPart,
} from "./types";

export { LIMITS } from "./limits";
export type InputFile = { name: string; bytes: Uint8Array };
export type NamedBlob = Blob & { name: string };

function parseText({ name, bytes }: InputFile): ParsedPart[] {
  if (bytes.byteLength > LIMITS.entry)
    throw new ImportError(
      "A relationship file exceeds the 20 MB safety limit.",
    );
  const text = strFromU8(bytes).replace(/^\uFEFF/, "");
  return /\.json$/i.test(name)
    ? parseJson(text, detectKind(name))
    : parseHtml(text, detectKind(name));
}

function reservePlain(size: number, budget: ImportBudget) {
  budget.expanded += size;
  if (budget.expanded > LIMITS.expanded)
    throw new ImportError(
      "The selected relationship files exceed the 60 MB safety limit. Export only Followers and Following.",
    );
}

function assemble(inputs: InputFile[], sourceFormat: string): Dataset {
  const parts: ParsedPart[] = [];
  const connections = Object.fromEntries(
    connectionKinds.map((kind) => [kind, missingConnection()]),
  ) as Record<ConnectionKind, ConnectionList>;
  for (const input of inputs) {
    const kind = detectKind(input.name);
    if (!kind || kind === "followers" || kind === "following") {
      parts.push(...parseText(input));
      continue;
    }
    if (connections[kind].status === "unsupported") continue;
    try {
      const accounts = parseText(input).flatMap((part) => part.accounts);
      const combined = [...connections[kind].accounts, ...accounts];
      connections[kind] = {
        status: "available",
        accounts:
          kind === "recentlyUnfollowed"
            ? deduplicateEvents(combined)
            : deduplicate(combined),
      };
    } catch (error) {
      if (!(error instanceof ImportError)) throw error;
      // Never show a partially parsed optional list as complete or as zero.
      connections[kind] = {
        status: "unsupported",
        accounts: [],
        message:
          "This list could not be read completely. Request a fresh JSON export including this category. Your core relationship lists are still available.",
      };
    }
  }
  for (const kind of ["followers", "following"] as const) {
    if (!parts.some((part) => part.kind === kind))
      throw new ImportError(
        `Missing ${kind === "followers" ? "Followers" : "Following"} data. Select both lists together, or upload an export ZIP containing Followers and Following. Choose the All time date range in Instagram.`,
      );
  }
  return {
    connections,
    followers: deduplicate(
      parts
        .filter((part) => part.kind === "followers")
        .flatMap((part) => part.accounts),
    ),
    following: deduplicate(
      parts
        .filter((part) => part.kind === "following")
        .flatMap((part) => part.accounts),
    ),
    metadata: {
      parsedAt: Date.now(),
      sourceFormat,
      warnings: [
        "Results reflect the lists in this export. Use an All time export for complete relationships.",
        ...connectionKinds
          .filter((kind) => connections[kind].status === "unsupported")
          .map(
            (kind) =>
              `Optional list ${kind} could not be read completely; its results are unavailable.`,
          ),
        ...(inputs.some((file) => /\.html?$/i.test(file.name))
          ? [
              "HTML timestamps are not interpreted; date sorting is available for JSON exports.",
            ]
          : []),
      ],
    },
  };
}
function sourceFormat(files: readonly { name: string }[]) {
  return files.some((file) => /\.zip$/i.test(file.name))
    ? "zip"
    : files.some((file) => /\.html?$/i.test(file.name))
      ? "html"
      : "json";
}

// In-memory adapter for small programmatic inputs; shares ZIP validation with File imports.
export function importDataset(files: InputFile[]): Dataset {
  validateSelection(
    files.map((file) => ({ name: file.name, size: file.bytes.length })),
  );
  const inputs: InputFile[] = [],
    budget = { expanded: 0 };
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      if (file.bytes[0] !== 80 || file.bytes[1] !== 75)
        throw new ImportError("This file is not a valid ZIP archive.");
      inputs.push(...extractZip(file.bytes, budget));
    } else {
      reservePlain(file.bytes.length, budget);
      inputs.push(file);
    }
  }
  return assemble(inputs, sourceFormat(files));
}

// Browser File objects are cloned to the worker without first reading their contents.
// Read the bounded ZIP index, then only relevant local records. Media stays on disk.
export async function importFiles(
  files: readonly NamedBlob[],
): Promise<Dataset> {
  validateSelection(files);
  const inputs: InputFile[] = [],
    budget = { expanded: 0 };
  for (const file of files) {
    if (/\.zip$/i.test(file.name))
      inputs.push(...(await extractZipBlob(file, budget)));
    else {
      reservePlain(file.size, budget);
      inputs.push({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    }
  }
  return assemble(inputs, sourceFormat(files));
}
