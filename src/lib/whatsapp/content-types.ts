import type { WhatsAppCountBucket, WhatsAppParticipant } from "./types";

export type WhatsAppNumericSummary = {
  count: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
};

export type WhatsAppBurst = {
  maximum: number;
  tiedWindows: number;
  /** A bounded set of tied window contexts; never messages or bodies. */
  examples: { from: string; to: string }[];
};

export type WhatsAppParticipantPatterns = WhatsAppParticipant & {
  runs: { count: number; medianLength: number | null; longest: number | null };
  burst: WhatsAppBurst;
  questionMarks: {
    messages: number;
    occurrences: number;
    share: number | null;
  };
};

export type WhatsAppMessagePatterns = {
  messageCount: number;
  runs: {
    total: number;
    medianLength: number | null;
    longest: number | null;
    distribution: WhatsAppCountBucket[];
  };
  burst: WhatsAppBurst;
  questionMarks: {
    messages: number;
    occurrences: number;
    share: number | null;
  };
  participants: WhatsAppParticipantPatterns[];
};

export type WhatsAppWordFrequency = { word: string; count: number };
export type WhatsAppComparedWord = WhatsAppWordFrequency & {
  otherCount: number;
  perThousand: number;
  otherPerThousand: number;
  ratio: number;
};

export type WhatsAppWordComparison =
  | { available: true; words: WhatsAppComparedWord[] }
  | {
      available: false;
      reason: "participant-filter" | "one-participant" | "insufficient-data";
    };

export type WhatsAppParticipantText = WhatsAppParticipant & {
  eligibleTextMessages: number;
  length: WhatsAppNumericSummary;
  wordsPerMessage: WhatsAppNumericSummary;
  eligibleWords: number;
  words: WhatsAppWordFrequency[];
  comparison: WhatsAppWordComparison;
};

export type WhatsAppTextAnalysis = {
  eligibleTextMessages: number;
  length: WhatsAppNumericSummary;
  wordsPerMessage: WhatsAppNumericSummary;
  eligibleWords: number;
  words: WhatsAppWordFrequency[];
  participants: WhatsAppParticipantText[];
};

export type WhatsAppContentAnalysis = {
  patterns: WhatsAppMessagePatterns;
  text: WhatsAppTextAnalysis;
  media: {
    total: number;
    categories: WhatsAppCountBucket[];
    participants: (WhatsAppParticipant & {
      total: number;
      categories: WhatsAppCountBucket[];
    })[];
  };
  emoji: {
    available: boolean;
    total: number | null;
    items: WhatsAppCountBucket[];
    participants: (WhatsAppParticipant & {
      total: number | null;
      items: WhatsAppCountBucket[];
    })[];
  };
};
