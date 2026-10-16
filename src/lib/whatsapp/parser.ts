import { getWhatsAppFormat } from "./formats";
import { WhatsAppImportError } from "./errors";
import { WHATSAPP_LIMITS } from "./limits";
import { normalizeWhatsApp, type WhatsAppRawRecord } from "./normalize";
import { parseWhatsAppTimestamp } from "./timestamp";
import { detectWhatsAppFormat } from "./detection";
import {
  isWhatsAppHeaderLike,
  readWhatsAppHeader,
  whatsappLines,
} from "./headers";
import type { WhatsAppDataset, WhatsAppFormatId } from "./types";

export function parseWhatsApp(
  text: string,
  formatId: WhatsAppFormatId,
): WhatsAppDataset {
  const format = getWhatsAppFormat(formatId);
  const lines = whatsappLines(text);
  const records: WhatsAppRawRecord[] = [];
  let current: WhatsAppRawRecord | undefined;
  for (const line of lines) {
    const parsed = readWhatsAppHeader(line);
    if (!parsed) {
      // A date-looking unsupported wrapper must never silently enter the message body.
      if (isWhatsAppHeaderLike(line))
        throw new WhatsAppImportError(
          "format",
          "A timestamp header uses an unsupported or mixed format. Use one numeric date order and a supported clock throughout the export.",
        );
      // Untimestamped preamble is counted in the Doctor, never invented as a record.
      if (!current) continue;
      current.content += `\n${line}`;
      continue;
    }
    if (records.length >= WHATSAPP_LIMITS.records)
      throw new WhatsAppImportError(
        "limit",
        "This chat exceeds the 200,000 record safety limit. Export a smaller chat and try again.",
      );
    const timestamp = parseWhatsAppTimestamp(parsed.date, parsed.clock, format);
    const separator = parsed.body.search(/:[ \u00a0\u202f]/);
    if (separator === 0)
      throw new WhatsAppImportError(
        "format",
        "A sender label is empty. Export the chat again and try a supported format.",
      );
    const sender = separator > 0 ? parsed.body.slice(0, separator) : undefined;
    if (
      sender !== undefined &&
      (!sender.trim() ||
        sender.length > WHATSAPP_LIMITS.participantLabelCharacters)
    )
      throw new WhatsAppImportError(
        "format",
        "A sender label is empty or exceeds the supported length. Export the chat again and try a supported format.",
      );
    current = {
      timestamp,
      sender,
      content:
        sender === undefined ? parsed.body : parsed.body.slice(separator + 2),
    };
    records.push(current);
  }
  if (!records.length)
    throw new WhatsAppImportError(
      "empty",
      "This file contains no supported chat records. Choose a WhatsApp chat export containing messages.",
    );
  return normalizeWhatsApp(records, formatId, detectWhatsAppFormat(text));
}
