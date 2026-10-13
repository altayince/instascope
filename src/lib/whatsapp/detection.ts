import { WHATSAPP_FORMATS } from "./formats";
import {
  isWhatsAppHeaderLike,
  readWhatsAppHeader,
  whatsappLines,
} from "./headers";
import { parseWhatsAppTimestamp } from "./timestamp";
import { WhatsAppImportError } from "./errors";
import { WHATSAPP_LIMITS } from "./limits";
import type { WhatsAppFormatDetection, WhatsAppFormatId } from "./types";

/** Intersect all header evidence. Ambiguous day/month order is never guessed. */
export function detectWhatsAppFormat(text: string): WhatsAppFormatDetection {
  let candidates = WHATSAPP_FORMATS.map((format) => format.id);
  const wrappers = new Set<"ios" | "android">();
  const widths = new Set<2 | 4>();
  const clocks = new Set<"12h" | "24h">();
  const precisions = new Set<"minute" | "second">();
  let headerCount = 0,
    unsupportedLookingRecords = 0,
    preambleLines = 0,
    continuationLines = 0;
  for (const line of whatsappLines(text)) {
    const header = readWhatsAppHeader(line);
    if (!header) {
      if (isWhatsAppHeaderLike(line)) unsupportedLookingRecords++;
      else if (headerCount) continuationLines++;
      else if (line.trim()) preambleLines++;
      continue;
    }
    headerCount++;
    if (headerCount > WHATSAPP_LIMITS.records)
      throw new WhatsAppImportError(
        "limit",
        "This chat exceeds the 200,000 record safety limit. Export a smaller chat and try again.",
      );
    wrappers.add(header.wrapper);
    if (/(?:AM|PM)$/i.test(header.clock)) clocks.add("12h");
    else if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(header.clock)) clocks.add("24h");
    precisions.add(/:\d{2}:\d{2}/.test(header.clock) ? "second" : "minute");
    const matching: WhatsAppFormatId[] = [];
    for (const format of WHATSAPP_FORMATS) {
      try {
        const timestamp = parseWhatsAppTimestamp(
          header.date,
          header.clock,
          format,
        );
        matching.push(format.id);
        if (timestamp.sourceYearWidth) widths.add(timestamp.sourceYearWidth);
      } catch {
        // No source values are copied into errors or the aggregate report.
      }
    }
    if (!matching.length) unsupportedLookingRecords++;
    const nextCandidates = candidates.filter((id) => matching.includes(id));
    if (matching.length && candidates.length && !nextCandidates.length)
      unsupportedLookingRecords++;
    candidates = nextCandidates;
  }
  if (!headerCount || unsupportedLookingRecords) candidates = [];
  const status =
    candidates.length === 1
      ? "supported"
      : candidates.length > 1
        ? "ambiguous"
        : "unsupported";
  return {
    status,
    confidence:
      status === "supported"
        ? "exact"
        : status === "ambiguous"
          ? "needs-selection"
          : "unsupported",
    candidateFormats: candidates,
    detectedFormat: candidates.length === 1 ? candidates[0] : null,
    wrappers: [...wrappers],
    yearWidths: [...widths].sort(),
    clockStyles: [...clocks],
    timestampPrecision:
      precisions.size > 1
        ? "mixed"
        : precisions.has("second")
          ? "second"
          : precisions.has("minute")
            ? "minute"
            : null,
    headerCount,
    unsupportedLookingRecords,
    preambleLines,
    continuationLines,
  };
}
