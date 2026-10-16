export type WhatsAppFormatId =
  "dmy-24h" | "mdy-24h" | "ymd-24h" | "dmy-12h" | "mdy-12h" | "ymd-12h";

export type WhatsAppFormat = {
  id: WhatsAppFormatId;
  label: string;
  sample: string;
  dateOrder: "dmy" | "mdy" | "ymd";
  timeConvention: "24h" | "12h";
};

/** Aggregate structural evidence only: never include source text or identifiers. */
export type WhatsAppFormatDetection = {
  status: "supported" | "ambiguous" | "unsupported";
  confidence: "exact" | "needs-selection" | "unsupported";
  candidateFormats: WhatsAppFormatId[];
  detectedFormat: WhatsAppFormatId | null;
  wrappers: ("ios" | "android")[];
  yearWidths: (2 | 4)[];
  clockStyles: ("12h" | "24h")[];
  timestampPrecision: "minute" | "second" | "mixed" | null;
  headerCount: number;
  unsupportedLookingRecords: number;
  preambleLines: number;
  continuationLines: number;
};

export type WhatsAppInspection = {
  detection: WhatsAppFormatDetection;
  source: "txt" | "zip";
  ignoredCompanionFiles: number;
};

export type WhatsAppEventKind =
  WhatsAppMediaKind | "call" | "deleted-message" | "location";

export type WhatsAppRecordEvent = {
  kind: WhatsAppEventKind;
  locale: "en" | "de";
};

/** Loaded-source coverage; counts and fixed parser facts, never message samples. */
export type WhatsAppExportDoctor = {
  status: "supported" | "partially-supported";
  detection: WhatsAppFormatDetection;
  selectedFormat: WhatsAppFormatId;
  participantLabels: number;
  eventTypes: { kind: WhatsAppEventKind; count: number }[];
  localizedMarkers: {
    locale: "en" | "de";
    kind: WhatsAppEventKind;
    count: number;
  }[];
  ignoredCompanionFiles: number;
  unclassifiedMarkerRecords: number;
  sourceLimitations: string[];
};

/** A Gregorian wall-clock value from the export, with no inferred timezone. */
export type WhatsAppTimestamp = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  precision: "minute" | "second";
  /** Slash-export YY means 2000 + YY; the original width remains explicit. */
  sourceYearWidth?: 2 | 4;
  date: string;
  local: string;
};

export type WhatsAppWarning = {
  code:
    | "wall-clock"
    | "text-boundaries"
    | "participant-labels"
    | "media-placeholders"
    | "ignored-attachments"
    | "ignored-preamble"
    | "out-of-order"
    | "emoji-unavailable";
  message: string;
  count?: number;
};

export type WhatsAppParticipant = { id: string; displayName: string };
export type WhatsAppMediaKind =
  "unspecified" | "image" | "video" | "audio" | "sticker" | "gif" | "document";

export type WhatsAppMessage = {
  id: number;
  participantId: string;
  timestamp: WhatsAppTimestamp;
  content: string;
  media?: WhatsAppMediaKind;
  event?: WhatsAppRecordEvent;
  links: string[];
  /** One entry per supported emoji grapheme; null when segmentation is unavailable. */
  emoji: string[] | null;
};

export type WhatsAppSystemEvent = {
  id: number;
  timestamp: WhatsAppTimestamp;
  content: string;
  event?: WhatsAppRecordEvent;
};

export type WhatsAppDataset = {
  participants: WhatsAppParticipant[];
  messages: WhatsAppMessage[];
  systemEvents: WhatsAppSystemEvent[];
  metadata: {
    format: WhatsAppFormatId;
    source: "txt" | "zip" | "demo";
    warnings: WhatsAppWarning[];
    timestampPrecision: "minute" | "second" | "mixed";
    ignoredAttachments: number;
    doctor: WhatsAppExportDoctor;
  };
};

export type WhatsAppCountBucket = { key: string; label: string; count: number };
export type WhatsAppParticipantStats = WhatsAppParticipant & {
  messageCount: number;
  mediaMessages: number;
  links: number;
  messagesWithLinks: number;
  emoji: number | null;
  messagesWithEmoji: number | null;
  first: WhatsAppTimestamp | null;
  latest: WhatsAppTimestamp | null;
};

export type WhatsAppAnalysis = {
  totals: {
    messages: number;
    systemEvents: number;
    participants: number;
    mediaMessages: number;
    links: number;
    messagesWithLinks: number;
    emoji: number | null;
    messagesWithEmoji: number | null;
    activeDays: number;
  };
  participants: WhatsAppParticipantStats[];
  first: WhatsAppTimestamp | null;
  latest: WhatsAppTimestamp | null;
  /** Difference between displayed wall-clock values, not UTC elapsed time. */
  observedSpanSeconds: number;
  calendarSpanDays: number;
  yearly: WhatsAppCountBucket[];
  monthly: WhatsAppCountBucket[];
  daily: WhatsAppCountBucket[];
  hours: WhatsAppCountBucket[];
  weekdays: WhatsAppCountBucket[];
  busiest: {
    year: WhatsAppCountBucket | null;
    month: WhatsAppCountBucket | null;
    day: WhatsAppCountBucket | null;
    hour: WhatsAppCountBucket | null;
    weekday: WhatsAppCountBucket | null;
  };
  media: WhatsAppCountBucket[];
  topEmoji: WhatsAppCountBucket[];
  longestGap: {
    from: WhatsAppTimestamp;
    to: WhatsAppTimestamp;
    wallClockSeconds: number;
  } | null;
  longestStreak: { from: string; to: string; days: number } | null;
};
