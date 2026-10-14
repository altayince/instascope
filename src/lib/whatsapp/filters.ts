import { analyzeWhatsApp } from "./analysis";
import { calendarDayValue } from "./timestamp";
import type {
  WhatsAppAnalysis,
  WhatsAppDataset,
  WhatsAppParticipant,
  WhatsAppTimestamp,
} from "./types";

export type WhatsAppDateFilter =
  | { mode: "all" }
  | { mode: "year"; year: number }
  | { mode: "month"; month: string }
  | { mode: "range"; from: string; to: string };

export type WhatsAppAnalysisFilters = {
  date: WhatsAppDateFilter;
  participantId: string | null;
};

export const DEFAULT_WHATSAPP_FILTERS: WhatsAppAnalysisFilters = Object.freeze({
  date: Object.freeze({ mode: "all" }),
  participantId: null,
});

export type WhatsAppFilteredAnalysis =
  | { ok: false; error: string }
  | {
      ok: true;
      analysis: WhatsAppAnalysis;
      /** Monday-first rows and recorded hours 00–23. No inferred timezone. */
      heatmap: number[][];
      overview: {
        messagesPerActiveDate: number | null;
        recognizedCallEvents: number;
        attributedCallEvents: number;
        unattributedCallEvents: number;
      };
      participant: WhatsAppParticipant | null;
    };

const validYear = (year: number) =>
  Number.isInteger(year) && year >= 1000 && year <= 9999;

function validMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return Boolean(
    match &&
    validYear(Number(match[1])) &&
    Number(match[2]) >= 1 &&
    Number(match[2]) <= 12,
  );
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || !validMonth(value.slice(0, 7))) return false;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  if (day < 1 || day > 31) return false;
  // UTC is only a timezone-independent way to validate Gregorian calendar fields.
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function datePredicate(filter: WhatsAppDateFilter):
  | { ok: true; matches: (timestamp: WhatsAppTimestamp) => boolean }
  | {
      ok: false;
      error: string;
    } {
  switch (filter.mode) {
    case "all":
      return { ok: true, matches: () => true };
    case "year":
      return validYear(filter.year)
        ? { ok: true, matches: (timestamp) => timestamp.year === filter.year }
        : { ok: false, error: "Choose a valid four-digit year." };
    case "month":
      return validMonth(filter.month)
        ? {
            ok: true,
            matches: (timestamp) => timestamp.date.slice(0, 7) === filter.month,
          }
        : { ok: false, error: "Choose a valid month in YYYY-MM format." };
    case "range":
      if (!validDate(filter.from) || !validDate(filter.to))
        return {
          ok: false,
          error: "Choose valid start and end dates in YYYY-MM-DD format.",
        };
      if (filter.from > filter.to)
        return {
          ok: false,
          error: "The end date must be on or after the start date.",
        };
      return {
        ok: true,
        matches: (timestamp) =>
          timestamp.date >= filter.from && timestamp.date <= filter.to,
      };
    default:
      return { ok: false, error: "Choose a supported date filter." };
  }
}

/** Options describe the accepted source, including dates with only system events. */
export function getWhatsAppFilterOptions(dataset: WhatsAppDataset): {
  years: number[];
  months: string[];
  participants: WhatsAppParticipant[];
} {
  const years = new Set<number>(),
    months = new Set<string>();
  for (const records of [dataset.messages, dataset.systemEvents]) {
    for (const record of records) {
      years.add(record.timestamp.year);
      months.add(record.timestamp.date.slice(0, 7));
    }
  }
  return {
    years: [...years].sort((left, right) => left - right),
    months: [...months].sort(),
    participants: [...dataset.participants],
  };
}

/**
 * Analyze a new subset of accepted records without reparsing or mutating the source.
 * Senderless system events belong only to Everyone, never to a selected participant.
 * Existing analysis defines gaps/streaks from matching participant messages alone.
 */
export function analyzeFilteredWhatsApp(
  dataset: WhatsAppDataset,
  filters: WhatsAppAnalysisFilters,
): WhatsAppFilteredAnalysis {
  const date = datePredicate(filters.date);
  if (!date.ok) return date;
  const participant =
    filters.participantId === null
      ? null
      : dataset.participants.find((item) => item.id === filters.participantId);
  if (participant === undefined)
    return { ok: false, error: "Choose a participant label from this export." };
  const messages = dataset.messages.filter(
    (message) =>
      date.matches(message.timestamp) &&
      (participant === null || message.participantId === participant.id),
  );
  const systemEvents =
    participant === null
      ? dataset.systemEvents.filter((event) => date.matches(event.timestamp))
      : [];
  const presentParticipants = new Set(
    messages.map((message) => message.participantId),
  );
  const analysis = analyzeWhatsApp({
    messages,
    systemEvents,
    participants: dataset.participants.filter((item) =>
      presentParticipants.has(item.id),
    ),
    metadata: dataset.metadata,
  });
  const emojiUnavailable =
    dataset.metadata.warnings.some(
      (warning) => warning.code === "emoji-unavailable",
    ) || dataset.messages.some((message) => message.emoji === null);
  if (emojiUnavailable) {
    analysis.totals.emoji = null;
    analysis.totals.messagesWithEmoji = null;
    analysis.topEmoji = [];
    for (const stats of analysis.participants) {
      stats.emoji = null;
      stats.messagesWithEmoji = null;
    }
  }
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  let attributedCallEvents = 0,
    unattributedCallEvents = 0;
  for (const message of messages) {
    const weekday =
      (new Date(calendarDayValue(message.timestamp)).getUTCDay() + 6) % 7;
    heatmap[weekday][message.timestamp.hour]++;
    if (message.event?.kind === "call") attributedCallEvents++;
  }
  for (const event of systemEvents) {
    if (event.event?.kind === "call") unattributedCallEvents++;
  }
  return {
    ok: true,
    analysis,
    heatmap,
    overview: {
      messagesPerActiveDate: analysis.totals.activeDays
        ? analysis.totals.messages / analysis.totals.activeDays
        : null,
      recognizedCallEvents: attributedCallEvents + unattributedCallEvents,
      attributedCallEvents,
      unattributedCallEvents,
    },
    participant,
  };
}
