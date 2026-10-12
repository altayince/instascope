import { strFromU8 } from "fflate";
import { deduplicate, deduplicateEvents } from "./normalize";
import { connectionKinds, missingConnection } from "./connections";
import { detectKind, ImportError, parseHtmlSource, parseJson } from "./parsers";
import { extractZip, extractZipBlob, type ImportBudget } from "./zip";
import { LIMITS, validateSelection } from "./limits";
import type {
  ConnectionKind,
  ConnectionList,
  Dataset,
  ImportProvenance,
  ParsedPart,
  Relationship,
} from "./types";

export { LIMITS } from "./limits";
export type InputFile = { name: string; bytes: Uint8Array };
export type NamedBlob = Blob & { name: string };

function parseText({ name, bytes }: InputFile): {
  parts: ParsedPart[];
  generationDate?: string;
} {
  if (bytes.byteLength > LIMITS.entry)
    throw new ImportError(
      "A relationship file exceeds the 20 MB safety limit.",
    );
  const text = strFromU8(bytes).replace(/^\uFEFF/, "");
  return /\.json$/i.test(name)
    ? { parts: parseJson(text, detectKind(name)) }
    : parseHtmlSource(text, detectKind(name));
}

function reservePlain(size: number, budget: ImportBudget) {
  budget.expanded += size;
  if (budget.expanded > LIMITS.expanded)
    throw new ImportError(
      "The selected relationship files exceed the 60 MB safety limit. Export only Followers and Following.",
    );
}

function provenanceFor(
  files: readonly { name: string }[],
  ignoredFiles: number,
): ImportProvenance {
  const transports = { json: 0, html: 0, zip: 0 };
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) transports.zip++;
    else if (/\.html?$/i.test(file.name)) transports.html++;
    else transports.json++;
  }
  return {
    transports,
    contentFormats: { json: 0, html: 0 },
    recognizedFiles: 0,
    ignoredFiles,
    generationDatedFiles: 0,
    generationCheckedFiles: 0,
    generationStatus: "unverified",
    categories: Object.fromEntries(
      (["followers", "following", ...connectionKinds] as Relationship[]).map(
        (kind) => [
          kind,
          {
            sourceFiles: 0,
            jsonFiles: 0,
            htmlFiles: 0,
            parsedFiles: 0,
            unsupportedFiles: 0,
            skippedFiles: 0,
          },
        ],
      ),
    ) as ImportProvenance["categories"],
  };
}

function assemble(
  inputs: InputFile[],
  sourceFormat: string,
  provenance: ImportProvenance,
): Dataset {
  const parts: ParsedPart[] = [];
  const connections = Object.fromEntries(
    connectionKinds.map((kind) => [kind, missingConnection()]),
  ) as Record<ConnectionKind, ConnectionList>;
  for (const input of inputs) {
    const kind = detectKind(input.name);
    const format = /\.json$/i.test(input.name) ? "json" : "html";
    provenance.recognizedFiles++;
    provenance.contentFormats[format]++;
    const countCategory = (
      category: Relationship,
      status: "parsedFiles" | "unsupportedFiles" | "skippedFiles",
    ) => {
      const counts = provenance.categories[category];
      counts.sourceFiles++;
      counts[format === "json" ? "jsonFiles" : "htmlFiles"]++;
      counts[status]++;
    };
    const parsedInput = () => {
      const parsed = parseText(input);
      if (format === "html") {
        provenance.generationCheckedFiles++;
        if (parsed.generationDate) {
          provenance.generationDatedFiles++;
          if (provenance.generationStatus !== "conflicting") {
            if (
              provenance.generationDate &&
              provenance.generationDate !== parsed.generationDate
            ) {
              provenance.generationStatus = "conflicting";
              delete provenance.generationDate;
            } else {
              provenance.generationDate = parsed.generationDate;
              provenance.generationStatus = "consistent";
            }
          }
        }
      }
      return parsed.parts;
    };
    if (!kind || kind === "followers" || kind === "following") {
      const parsed = parsedInput();
      for (const category of new Set(parsed.map((part) => part.kind)))
        countCategory(category, "parsedFiles");
      parts.push(...parsed);
      continue;
    }
    if (connections[kind].status === "unsupported") {
      countCategory(kind, "skippedFiles");
      continue;
    }
    try {
      const accounts = parsedInput().flatMap((part) => part.accounts);
      countCategory(kind, "parsedFiles");
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
      countCategory(kind, "unsupportedFiles");
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
      importProvenance: provenance,
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
              "When present, HTML dates preserve the calendar date and minute shown in the export. HTML does not include a timezone, so these are not exact UTC timestamps.",
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
    budget = { expanded: 0 },
    stats = { ignoredFiles: 0 };
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      if (file.bytes[0] !== 80 || file.bytes[1] !== 75)
        throw new ImportError("This file is not a valid ZIP archive.");
      inputs.push(...extractZip(file.bytes, budget, stats));
    } else {
      reservePlain(file.bytes.length, budget);
      inputs.push(file);
    }
  }
  return assemble(
    inputs,
    sourceFormat(files),
    provenanceFor(files, stats.ignoredFiles),
  );
}

// Browser File objects are cloned to the worker without first reading their contents.
// Read the bounded ZIP index, then only relevant local records. Media stays on disk.
export async function importFiles(
  files: readonly NamedBlob[],
): Promise<Dataset> {
  validateSelection(files);
  const inputs: InputFile[] = [],
    budget = { expanded: 0 },
    stats = { ignoredFiles: 0 };
  for (const file of files) {
    if (/\.zip$/i.test(file.name))
      inputs.push(...(await extractZipBlob(file, budget, stats)));
    else {
      reservePlain(file.size, budget);
      inputs.push({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    }
  }
  return assemble(
    inputs,
    sourceFormat(files),
    provenanceFor(files, stats.ignoredFiles),
  );
}
