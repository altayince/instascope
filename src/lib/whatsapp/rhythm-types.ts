import type { WhatsAppParticipant } from "./types";

/** Calendar/clock strings from accepted records, never UTC instants or bodies. */
export type WhatsAppParticipantTransition = {
  fromParticipantId: string;
  toParticipantId: string;
  fromDate: string;
  toDate: string;
  fromTimestamp: string;
  toTimestamp: string;
  delaySeconds: number;
  sameSession: boolean;
};

export type WhatsAppConversationSession = {
  starterId: string;
  firstTimestamp: string;
  lastTimestamp: string;
  messageCount: number;
  spanSeconds: number;
};

export type WhatsAppDelayBucket = {
  key: "under-1m" | "1m-5m" | "5m-30m" | "30m-6h" | "6h-plus";
  label: string;
  count: number;
};

export type WhatsAppDelaySummary = {
  count: number;
  medianSeconds: number | null;
  p25Seconds: number | null;
  p75Seconds: number | null;
  buckets: WhatsAppDelayBucket[];
};

export type WhatsAppParticipantRhythm = WhatsAppParticipant & {
  sessionsStarted: number;
  silenceBreakers: number;
  timing: WhatsAppDelaySummary;
  rapidTransitions: number;
  /** A proportion of observed transitions, or unavailable when there are none. */
  rapidShare: number | null;
};

export type WhatsAppConversationRhythm = {
  messageCount: number;
  sessions: WhatsAppConversationSession[];
  sessionSummary: {
    total: number;
    medianMessages: number | null;
    longestByMessages: { messageCount: number; tiedSessions: number } | null;
    longestBySpan: { spanSeconds: number; tiedSessions: number } | null;
  };
  silenceSummary: {
    total: number;
    medianGapSeconds: number | null;
    longestGapSeconds: number | null;
  };
  transitions: WhatsAppParticipantTransition[];
  timing: WhatsAppDelaySummary;
  rapidTransitions: number;
  equalTimestampTransitions: number;
  participants: WhatsAppParticipantRhythm[];
};

export type WhatsAppRhythmResult =
  | { available: true; analysis: WhatsAppConversationRhythm }
  | { available: false; reason: "participant-filter" };
