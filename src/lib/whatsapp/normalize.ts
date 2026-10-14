import type {
  WhatsAppDataset,
  WhatsAppFormatId,
  WhatsAppFormatDetection,
  WhatsAppEventKind,
  WhatsAppMediaKind,
  WhatsAppTimestamp,
  WhatsAppWarning,
} from "./types";
import { WHATSAPP_LIMITS } from "./limits";
import { WhatsAppImportError } from "./errors";
import { wallClockValue } from "./timestamp";
import { classifyWhatsAppEvent, hasUnclassifiedWhatsAppMarker } from "./events";

export type WhatsAppRawRecord = {
  timestamp: WhatsAppTimestamp;
  sender?: string;
  content: string;
};

const mediaKinds = new Set<WhatsAppMediaKind>([
  "unspecified",
  "image",
  "video",
  "audio",
  "sticker",
  "gif",
  "document",
]);

/** Only complete verified omission markers; never guess attachment filenames. */
export function detectWhatsAppMedia(
  content: string,
): WhatsAppMediaKind | undefined {
  const event = classifyWhatsAppEvent(content);
  return event && mediaKinds.has(event.kind as WhatsAppMediaKind)
    ? (event.kind as WhatsAppMediaKind)
    : undefined;
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
      "Media counts include only complete supported English or verified German omission markers. Attachment filenames, captions and other translated markers are not inferred; media files are never opened.",
  },
];

export function normalizeWhatsApp(
  records: readonly WhatsAppRawRecord[],
  format: WhatsAppFormatId,
  detection?: WhatsAppFormatDetection,
): WhatsAppDataset {
  // A direct normalization call has no raw headers to inspect. Do not invent source evidence.
  const sourceDetection: WhatsAppFormatDetection = detection ?? {
    status: "unsupported",
    confidence: "unsupported",
    candidateFormats: [],
    detectedFormat: null,
    wrappers: [],
    yearWidths: [],
    clockStyles: [],
    timestampPrecision: null,
    headerCount: 0,
    unsupportedLookingRecords: 0,
    preambleLines: 0,
    continuationLines: 0,
  };
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
      doctor: {
        status: sourceDetection.preambleLines
          ? "partially-supported"
          : "supported",
        detection: sourceDetection,
        selectedFormat: format,
        participantLabels: 0,
        eventTypes: [],
        localizedMarkers: [],
        ignoredCompanionFiles: 0,
        unclassifiedMarkerRecords: 0,
        sourceLimitations: [
          "Dates and times are recorded wall-clock values; the export supplies no timezone.",
          "Two-digit slash years are interpreted as 2000 + YY, without a moving century guess.",
          "Pasted timestamp-shaped text cannot be distinguished from new export records.",
          "Sender labels are not verified people or accounts; renamed or identical labels cannot be resolved.",
          "Media contents, read receipts, seen times, reply-to relationships and reactions are unavailable.",
          "Call markers do not establish call duration or direction, and no relationship or personality conclusions are derived.",
          "Recognized location-share content is excluded from link and emoji statistics.",
        ],
      },
    },
  };
  const participantIds = new Map<string, string>();
  const precisions = new Set<WhatsAppTimestamp["precision"]>();
  const eventCounts = new Map<WhatsAppEventKind, number>();
  const markerCounts = new Map<
    string,
    { locale: "en" | "de"; kind: WhatsAppEventKind; count: number }
  >();
  let previous = -Infinity,
    unordered = 0,
    missingEmoji = false;
  for (const [index, record] of records.entries()) {
    const event = classifyWhatsAppEvent(record.content);
    if (!event && hasUnclassifiedWhatsAppMarker(record.content))
      dataset.metadata.doctor.unclassifiedMarkerRecords++;
    if (event) {
      eventCounts.set(event.kind, (eventCounts.get(event.kind) ?? 0) + 1);
      const key = `${event.locale}:${event.kind}`;
      const entry = markerCounts.get(key) ?? { ...event, count: 0 };
      entry.count++;
      markerCounts.set(key, entry);
    }
    precisions.add(record.timestamp.precision);
    const value = wallClockValue(record.timestamp);
    if (value < previous) unordered++;
    previous = value;
    if (record.sender === undefined) {
      dataset.systemEvents.push({
        id: index + 1,
        timestamp: record.timestamp,
        content: record.content,
        event,
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
    const emoji =
      event?.kind === "location" ? [] : extractWhatsAppEmoji(record.content);
    if (emoji === null) missingEmoji = true;
    dataset.messages.push({
      id: index + 1,
      participantId,
      timestamp: record.timestamp,
      content: record.content,
      media: detectWhatsAppMedia(record.content),
      event,
      links:
        event?.kind === "location" ? [] : extractWhatsAppLinks(record.content),
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
  dataset.metadata.doctor.participantLabels = dataset.participants.length;
  dataset.metadata.doctor.eventTypes = [...eventCounts]
    .map(([kind, count]) => ({ kind, count }))
    .sort((left, right) => left.kind.localeCompare(right.kind));
  dataset.metadata.doctor.localizedMarkers = [...markerCounts.values()].sort(
    (left, right) =>
      `${left.locale}:${left.kind}`.localeCompare(
        `${right.locale}:${right.kind}`,
      ),
  );
  if (dataset.metadata.doctor.unclassifiedMarkerRecords) {
    dataset.metadata.doctor.status = "partially-supported";
    dataset.metadata.doctor.sourceLimitations.push(
      "Some typed omission markers contain extra text. Filenames and captions are not interpreted, so recognized media counts may underreport these records.",
    );
  }
  if (sourceDetection.preambleLines) {
    dataset.metadata.warnings.push({
      code: "ignored-preamble",
      count: sourceDetection.preambleLines,
      message:
        "Untimestamped preamble lines were skipped. They are not counted as messages or system events.",
    });
    dataset.metadata.doctor.sourceLimitations.push(
      "Untimestamped preamble was skipped; only supported timestamped records were analyzed.",
    );
  }
  return dataset;
}
