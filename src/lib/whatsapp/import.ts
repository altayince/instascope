import { WhatsAppImportError } from "./errors";
import { getWhatsAppFormat } from "./formats";
import { validateWhatsAppSelection } from "./limits";
import { parseWhatsApp } from "./parser";
import { extractWhatsAppZip } from "./zip";
import { detectWhatsAppFormat } from "./detection";
import type {
  WhatsAppDataset,
  WhatsAppFormatId,
  WhatsAppInspection,
} from "./types";

export type WhatsAppNamedBlob = Blob & { name: string };

/** Runs in the local browser worker. Never reads whole media-rich ZIPs. */
async function readSource(files: readonly WhatsAppNamedBlob[]) {
  validateWhatsAppSelection(files);
  try {
    const file = files[0],
      zip = /\.zip$/i.test(file.name);
    const extracted = zip
      ? await extractWhatsAppZip(file)
      : {
          bytes: new Uint8Array(await file.arrayBuffer()),
          ignoredAttachments: 0,
        };
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(extracted.bytes);
    } catch {
      throw new WhatsAppImportError(
        "encoding",
        "This file is not valid UTF-8 text. Export a fresh WhatsApp chat TXT file.",
      );
    }
    return {
      text,
      source: zip ? ("zip" as const) : ("txt" as const),
      ignoredCompanionFiles: extracted.ignoredAttachments,
    };
  } catch (error) {
    if (error instanceof WhatsAppImportError) throw error;
    throw new WhatsAppImportError(
      "read",
      "This file could not be read. Export a fresh WhatsApp chat and try again.",
    );
  }
}

/** Structural preflight only. Neither source text nor filenames leave the worker. */
export async function inspectWhatsApp(
  files: readonly WhatsAppNamedBlob[],
): Promise<WhatsAppInspection> {
  const source = await readSource(files);
  return {
    detection: detectWhatsAppFormat(source.text),
    source: source.source,
    ignoredCompanionFiles: source.ignoredCompanionFiles,
  };
}

/** Confirmation uses the same bounded reader and integrity checks as preflight. */
export async function importWhatsApp(
  files: readonly WhatsAppNamedBlob[],
  format: WhatsAppFormatId,
): Promise<WhatsAppDataset> {
  validateWhatsAppSelection(files);
  getWhatsAppFormat(format);
  const source = await readSource(files);
  const dataset = parseWhatsApp(source.text, format);
  dataset.metadata.source = source.source;
  dataset.metadata.ignoredAttachments = source.ignoredCompanionFiles;
  dataset.metadata.doctor.ignoredCompanionFiles = source.ignoredCompanionFiles;
  if (source.ignoredCompanionFiles)
    dataset.metadata.warnings.push({
      code: "ignored-attachments",
      count: source.ignoredCompanionFiles,
      message:
        "Non-TXT ZIP entries, including companions and attachments, were skipped without decompression. Only the chat text was analyzed; their contents are unavailable.",
    });
  return dataset;
}
