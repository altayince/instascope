import { WhatsAppImportError } from "./errors";
import { getWhatsAppFormat } from "./formats";
import { validateWhatsAppSelection } from "./limits";
import { parseWhatsApp } from "./parser";
import { extractWhatsAppZip } from "./zip";
import type { WhatsAppDataset, WhatsAppFormatId } from "./types";

export type WhatsAppNamedBlob = Blob & { name: string };

/** Runs in the local browser worker. Never reads whole media-rich ZIPs. */
export async function importWhatsApp(
  files: readonly WhatsAppNamedBlob[],
  format: WhatsAppFormatId,
): Promise<WhatsAppDataset> {
  validateWhatsAppSelection(files);
  getWhatsAppFormat(format);
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
    const dataset = parseWhatsApp(text, format);
    dataset.metadata.source = zip ? "zip" : "txt";
    dataset.metadata.ignoredAttachments = extracted.ignoredAttachments;
    if (extracted.ignoredAttachments)
      dataset.metadata.warnings.push({
        code: "ignored-attachments",
        count: extracted.ignoredAttachments,
        message:
          "Non-TXT files were skipped without decompression. Only the chat text was analyzed; attachment contents are unavailable.",
      });
    return dataset;
  } catch (error) {
    if (error instanceof WhatsAppImportError) throw error;
    throw new WhatsAppImportError(
      "read",
      "This file could not be read. Export a fresh WhatsApp chat and try again.",
    );
  }
}
