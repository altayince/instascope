import type { WhatsAppMediaKind } from "./types";

export type WhatsAppStoryTheme = "mint" | "forest" | "cream" | "lime";
export type WhatsAppStoryEntry = {
  /** Authored bucket text or an anonymous alias, never an exported sender label. */
  label: string;
  value: number;
  display: string;
  share?: number;
};
export type WhatsAppStoryBase = {
  id: string;
  name: string;
  label: string;
  title: string;
  lead: string;
  value: string;
  valueLabel: string;
  facts: { value: string; label: string }[];
  note: string;
  theme: WhatsAppStoryTheme;
  motif: "bubbles" | "rings" | "steps";
  mode: "solo" | "pair" | "group";
  calculation: {
    classification: "Exact" | "Derived";
    definition: string;
    threshold: string | null;
    limitations: string;
  };
};

/** Only bounded, explicitly projected aggregates are allowed in artwork data. */
export type WhatsAppStory = WhatsAppStoryBase &
  (
    | {
        kind: "hero";
        data: {
          activeDates: number;
          calendarSpanDays: number;
          firstDate: string;
          lastDate: string;
        };
      }
    | {
        kind: "split" | "ranking";
        data: {
          entries: WhatsAppStoryEntry[];
          total: number;
          hiddenParticipants: number;
          leaderTieCount: number;
          unit: string;
        };
      }
    | {
        kind: "distribution";
        data: {
          entries: WhatsAppStoryEntry[];
          total: number;
          tiedMaximum: number;
        };
      }
    | {
        kind: "timeline";
        data: {
          from: string;
          to: string;
          streakDays: number | null;
          dates: { date: string; value: number }[];
          tiedDates: number;
        };
      }
    | {
        kind: "rhythm";
        data: {
          buckets: WhatsAppStoryEntry[];
          entries: WhatsAppStoryEntry[];
          /** Qualifying timing labels omitted from the bounded group artwork. */
          hiddenParticipants: number;
          transitionCount: number;
          rapidCount: number;
          rapidShare: number;
        };
      }
    | {
        kind: "patterns";
        data: {
          maximum: number;
          ties: number;
          runs: number;
          medianRunLength: number | null;
          longestRun: number | null;
          distribution: WhatsAppStoryEntry[];
        };
      }
    | {
        kind: "media";
        data: {
          categories: {
            kind: WhatsAppMediaKind;
            label: string;
            count: number;
          }[];
          hiddenCategories: number;
          remainingMedia: number;
          emoji: { symbol: string; count: number }[];
          emojiAvailable: boolean;
          mediaTotal: number;
          emojiTotal: number | null;
        };
      }
    | {
        kind: "word";
        data: {
          words: { word: string; count: number }[];
          eligibleWords: number;
        };
      }
    | {
        kind: "closing";
        data: {
          messages: number;
          participants: number;
          activeDates: number;
          cardCount: number;
        };
      }
  );
