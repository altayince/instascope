import type {
  WhatsAppDataset,
  WhatsAppFormatId,
  WhatsAppMediaKind,
  WhatsAppTimestamp,
  WhatsAppWarning,
} from "./types";
import { WHATSAPP_LIMITS } from "./limits";
import { WhatsAppImportError } from "./errors";
import { wallClockValue } from "./timestamp";

export type WhatsAppRawRecord = {
  timestamp: WhatsAppTimestamp;
  sender?: string;
  content: string;
};

const mediaPlaceholders = new Map<string, WhatsAppMediaKind>([
  ["<Media omitted>", "unspecified"],
  ["image omitted", "image"],
  ["video omitted", "video"],
  ["audio omitted", "audio"],
  ["sticker omitted", "sticker"],
  ["GIF omitted", "gif"],
  ["document omitted", "document"],
]);

/** Only complete, known English omission markers; never guess attachment filenames. */
export function detectWhatsAppMedia(
  content: string,
): WhatsAppMediaKind | undefined {
  return mediaPlaceholders.get(content.replace(/^[\u200e\u200f]/, ""));
}

/** Explicit HTTP(S) links only. URLs with credentials or control characters are excluded. */
export function extractWhatsAppLinks(content: string): string[] {
  const links: string[] = [];
  for (const match of content.matchAll(
    /https?:\/\/[^\s<>"'\u0000-\u001f\u007f]+/giu,
  )) {
    // Conservative prose punctuation trimming. No fetching, unfurling or DNS lookup.
    let candidate = match[0].replace(/[.,!?;:]+$/, "");
    while (
      candidate.endsWith(")") &&
      (candidate.match(/\)/g)?.length ?? 0) >
        (candidate.match(/\(/g)?.length ?? 0)
    )
      candidate = candidate.slice(0, -1);
    try {
      const url = new URL(candidate);
      if (
        ["https:", "http:"].includes(url.protocol) &&
        url.hostname &&
        !url.username &&
        !url.password
      )
        links.push(url.href);
    } catch {
      /* Invalid text stays plain text. */
    }
  }
  return links;
}

/** Count graphemes, so skin tones, flags and ZWJ families stay one visible unit. */
let emojiSegmenter: Intl.Segmenter | undefined;
let emojiPattern: RegExp | undefined;
export function extractWhatsAppEmoji(content: string): string[] | null {
  if (typeof Intl.Segmenter !== "function") return null;
  try {
    emojiSegmenter ??= new Intl.Segmenter("en", { granularity: "grapheme" });
    // A string property validates whole RGI emoji sequences rather than code points.
    emojiPattern ??= new RegExp("^\\p{RGI_Emoji}$", "v");
  } catch {
    return null;
  }
  const found: string[] = [];
  for (const { segment } of emojiSegmenter.segment(content)) {
    if (emojiPattern.test(segment)) found.push(segment);
  }
  return found;
}

export const WHATSAPP_BASE_WARNINGS: readonly WhatsAppWarning[] = [
  {
    code: "wall-clock",
    message:
      "Dates and times are the wall-clock values in this export. No timezone is supplied; spans and gaps are displayed-time differences, not exact elapsed time.",
  },
  {
    code: "text-boundaries",
    message:
      "Every supported timestamp header starts a record. A pasted line that looks exactly like an export header cannot be distinguished from a new record. Sender labels use the first colon-space separator; records without it are treated as system events.",
  },
  {
    code: "participant-labels",
    message:
      "Participants are the exact sender labels in the file. Renamed contacts can appear separately; identical labels cannot be resolved to different people.",
  },
  {
    code: "media-placeholders",
    message:
      "Media counts include only complete supported English omission markers. Attachment filenames, captions and translated markers are not inferred; media files are never opened.",
  },
];

export function normalizeWhatsApp(
  records: readonly WhatsAppRawRecord[],
  format: WhatsAppFormatId,
): WhatsAppDataset {
  const dataset: WhatsAppDataset = {
    participants: [],
    messages: [],
    systemEvents: [],
    metadata: {
      format,
      source: "txt",
      warnings: WHATSAPP_BASE_WARNINGS.map((warning) => ({ ...warning })),
      timestampPrecision: "minute",
      ignoredAttachments: 0,
    },
  };
  const participantIds = new Map<string, string>();
  const precisions = new Set<WhatsAppTimestamp["precision"]>();
  let previous = -Infinity,
    unordered = 0,
    missingEmoji = false;
  for (const [index, record] of records.entries()) {
    precisions.add(record.timestamp.precision);
    const value = wallClockValue(record.timestamp);
    if (value < previous) unordered++;
    previous = value;
    if (record.sender === undefined) {
      dataset.systemEvents.push({
        id: index + 1,
        timestamp: record.timestamp,
        content: record.content,
      });
      continue;
    }
    let participantId = participantIds.get(record.sender);
    if (!participantId) {
      if (participantIds.size >= WHATSAPP_LIMITS.participants)
        throw new WhatsAppImportError(
          "limit",
          "This chat exceeds the participant-label safety limit. Export a smaller chat and try again.",
        );
      participantId = `participant-${participantIds.size + 1}`;
      participantIds.set(record.sender, participantId);
      dataset.participants.push({
        id: participantId,
        displayName: record.sender,
      });
    }
    const emoji = extractWhatsAppEmoji(record.content);
    if (emoji === null) missingEmoji = true;
    dataset.messages.push({
      id: index + 1,
      participantId,
      timestamp: record.timestamp,
      content: record.content,
      media: detectWhatsAppMedia(record.content),
      links: extractWhatsAppLinks(record.content),
      emoji,
    });
  }
  if (!dataset.messages.length)
    throw new WhatsAppImportError(
      "system-only",
      "This export contains system events but no sender messages. Choose a chat export containing messages.",
    );
  dataset.metadata.timestampPrecision =
    precisions.size > 1
      ? "mixed"
      : precisions.has("second")
        ? "second"
        : "minute";
  if (unordered)
    dataset.metadata.warnings.push({
      code: "out-of-order",
      count: unordered,
      message:
        "Some records appear out of timestamp order. Activity, spans and gaps are calculated in displayed timestamp order; the source record order is preserved.",
    });
  if (missingEmoji)
    dataset.metadata.warnings.push({
      code: "emoji-unavailable",
      message:
        "This browser cannot segment emoji reliably. Emoji statistics are unavailable; try a current browser.",
    });
  return dataset;
}
