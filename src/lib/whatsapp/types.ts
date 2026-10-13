export type WhatsAppFormatId =
  "dmy-24h" | "mdy-24h" | "ymd-24h" | "dmy-12h" | "mdy-12h" | "ymd-12h";

export type WhatsAppFormat = {
  id: WhatsAppFormatId;
  label: string;
  sample: string;
  dateOrder: "dmy" | "mdy" | "ymd";
  timeConvention: "24h" | "12h";
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
  links: string[];
  /** One entry per supported emoji grapheme; null when segmentation is unavailable. */
  emoji: string[] | null;
};

export type WhatsAppSystemEvent = {
  id: number;
  timestamp: WhatsAppTimestamp;
  content: string;
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
