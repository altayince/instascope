import { getWhatsAppFormat } from "./formats";
import { WhatsAppImportError } from "./errors";
import { WHATSAPP_LIMITS } from "./limits";
import { normalizeWhatsApp, type WhatsAppRawRecord } from "./normalize";
import { parseWhatsAppTimestamp } from "./timestamp";
import type { WhatsAppDataset, WhatsAppFormatId } from "./types";

/** Numeric timestamps in the two supported export wrappers, before validating the selection. */
function header(
  line: string,
): { date: string; clock: string; body: string } | null {
  const text = line.replace(/^[\u200e\u200f]/, "");
  const bracketed =
    /^\[(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),[ \u00a0\u202f]*(\d{1,2}:\d{2}(?::\d{2})?(?:[ \u00a0\u202f]+[A-Za-z.]+)?)\][ \u00a0\u202f](.*)$/.exec(
      text,
    );
  const dashed =
    /^(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),[ \u00a0\u202f]*(\d{1,2}:\d{2}(?::\d{2})?(?:[ \u00a0\u202f]+[A-Za-z.]+)?)[ \u00a0\u202f]-[ \u00a0\u202f](.*)$/.exec(
      text,
    );
  const match = bracketed ?? dashed;
  return match ? { date: match[1], clock: match[2], body: match[3] } : null;
}

export function parseWhatsApp(
  text: string,
  formatId: WhatsAppFormatId,
): WhatsAppDataset {
  const format = getWhatsAppFormat(formatId);
  if (
    text.length > WHATSAPP_LIMITS.textBytes ||
    new TextEncoder().encode(text).length > WHATSAPP_LIMITS.textBytes
  )
    throw new WhatsAppImportError(
      "limit",
      "This chat exceeds the 20 MB safety limit. Export a smaller chat and try again.",
    );
  if (text.includes("\u0000"))
    throw new WhatsAppImportError(
      "encoding",
      "This chat is not a supported UTF-8 text export. Export a fresh WhatsApp chat TXT file.",
    );
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n$/, "")
    .split("\n");
  const records: WhatsAppRawRecord[] = [];
  let current: WhatsAppRawRecord | undefined;
  for (const line of lines) {
    const parsed = header(line);
    if (!parsed) {
      if (!current) {
        if (!line.trim()) continue;
        throw new WhatsAppImportError(
          "format",
          "This file does not start with a supported WhatsApp timestamp header. Check the selected format. Numeric dates with four-digit years are required.",
        );
      }
      // A date-looking unsupported wrapper must never silently enter the message body.
      if (
        /^[\u200e\u200f]?\[?\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}[, ]+\d{1,2}[:.]/.test(
          line,
        )
      )
        throw new WhatsAppImportError(
          "format",
          "A timestamp header uses an unsupported or mixed format. Use one export format with four-digit years, numeric dates and a supported clock.",
        );
      current.content += `\n${line}`;
      continue;
    }
    if (records.length >= WHATSAPP_LIMITS.records)
      throw new WhatsAppImportError(
        "limit",
        "This chat exceeds the 200,000 record safety limit. Export a smaller chat and try again.",
      );
    const timestamp = parseWhatsAppTimestamp(parsed.date, parsed.clock, format);
    const separator = parsed.body.search(/:[ \u00a0]/);
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
  return normalizeWhatsApp(records, formatId);
}
