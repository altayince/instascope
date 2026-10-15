import { analyzeWhatsApp } from "./analysis";
import {
  analyzeWhatsAppMessagePatterns,
  BURST_WINDOW_MINUTES,
} from "./message-patterns";
import {
  analyzeConversationRhythm,
  RAPID_TRANSITION_MINUTES,
  SESSION_GAP_MINUTES,
  SILENCE_BREAK_HOURS,
} from "./rhythm";
import { normalizeWhatsAppWord } from "./stopwords";
import type {
  WhatsAppStory,
  WhatsAppStoryBase,
  WhatsAppStoryEntry,
} from "./story-types";
import {
  analyzeWhatsAppText,
  MAX_WORD_LENGTH,
  MIN_WORD_LENGTH,
} from "./text-analysis";
import type {
  WhatsAppAnalysis,
  WhatsAppCountBucket,
  WhatsAppDataset,
  WhatsAppMediaKind,
} from "./types";

export type { WhatsAppStory } from "./story-types";

/** Presentation evidence gates; metric definitions remain in the Analyzer engines. */
export const WHATSAPP_STORY_EVIDENCE = {
  activityMessages: 4,
  participantMessages: 2,
  activeDates: 2,
  peakMessages: 2,
  streakDays: 2,
  sessions: 3,
  silenceBreaks: 3,
  transitions: 4,
  participantTransitions: 4,
  burstMessages: 3,
  runs: 4,
  longestRun: 2,
  mediaMessages: 2,
  emojiOccurrences: 3,
  eligibleTextMessages: 6,
  eligibleWords: 20,
  wordOccurrences: 3,
  distinctWords: 2,
} as const;

export const WHATSAPP_STORY_LIMITS = {
  cards: 12,
  participants: 4,
  dates: 4,
  mediaCategories: 4,
  emoji: 3,
  words: 6,
} as const;

export const whatsappNumber = (value: number) =>
  new Intl.NumberFormat("en-GB").format(value);

const conciseNumber = (value: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);

export function whatsappDate(date: string, short = false) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** Return every maximum. A tied count must never produce a sole winner. */
export function whatsappPeaks(buckets: readonly WhatsAppCountBucket[]) {
  const maximum = buckets.reduce(
    (highest, bucket) => Math.max(highest, bucket.count),
    0,
  );
  return maximum ? buckets.filter((bucket) => bucket.count === maximum) : [];
}

const scope = "From the full supplied export only. System events are excluded.";
const clockLimitations =
  "Recorded clocks have no inferred timezone or daylight-saving correction. Missing records and export timestamp precision may change these results.";

const duration = (seconds: number | null): string => {
  if (seconds === null) return "Unavailable";
  if (seconds < 60) return `${conciseNumber(seconds)} sec`;
  if (seconds < 3600) return `${conciseNumber(seconds / 60)} min`;
  if (seconds < 86400) return `${conciseNumber(seconds / 3600)} hr`;
  return `${conciseNumber(seconds / 86400)} days`;
};

const hourLabels = [
  "Midnight",
  "1am",
  "2am",
  "3am",
  "4am",
  "5am",
  "6am",
  "7am",
  "8am",
  "9am",
  "10am",
  "11am",
  "Noon",
  "1pm",
  "2pm",
  "3pm",
  "4pm",
  "5pm",
  "6pm",
  "7pm",
  "8pm",
  "9pm",
  "10pm",
  "11pm",
] as const;

const mediaLabels: Record<WhatsAppMediaKind, string> = {
  unspecified: "Other media",
  image: "Images",
  video: "Videos",
  audio: "Audio",
  sticker: "Stickers",
  gif: "GIFs",
  document: "Documents",
};

function base(
  mode: WhatsAppStoryBase["mode"],
  values: Omit<WhatsAppStoryBase, "mode" | "note"> & { note?: string },
): WhatsAppStoryBase {
  return { ...values, mode, note: values.note ?? scope };
}

type ParticipantCount = { id: string; count: number };

/** Stable ordering resolves display positions only; it never resolves a tied winner. */
function participantEntries(
  values: readonly ParticipantCount[],
  aliases: ReadonlyMap<string, string>,
  mode: WhatsAppStoryBase["mode"],
  total: number,
) {
  const maximum = values.reduce(
    (highest, item) => Math.max(highest, item.count),
    0,
  );
  const leaders = maximum
    ? values.filter((item) => item.count === maximum)
    : [];
  const ordered =
    mode === "group"
      ? [...values].sort((left, right) => right.count - left.count)
      : [...values];
  const visible = ordered.slice(0, WHATSAPP_STORY_LIMITS.participants);
  return {
    entries: visible.map((item): WhatsAppStoryEntry => ({
      label: aliases.get(item.id) ?? "Participant",
      value: item.count,
      display: whatsappNumber(item.count),
      share: total ? item.count / total : 0,
    })),
    hiddenParticipants: values.length - visible.length,
    leaderTieCount: leaders.length,
    maximum,
    leader:
      leaders.length === 1
        ? (aliases.get(leaders[0].id) ?? "A participant")
        : null,
  };
}

/**
 * The accepted dataset is always the scope, independent of temporary Analyzer filters.
 * The normal caller supplies its full-source core analysis. If its source totals do
 * not match, use that same core engine on the full source instead. No source records,
 * identifiers, names or recorded timestamp clocks are projected into artwork data.
 * Lexical analysis is not even invoked unless the current-session opt-in is true.
 */
export function buildWhatsAppStories(
  suppliedAnalysis: WhatsAppAnalysis,
  dataset: WhatsAppDataset,
  options: { includeWords?: boolean } = {},
): WhatsAppStory[] {
  if (!dataset.messages.length) return [];
  const analysis =
    suppliedAnalysis.totals.messages === dataset.messages.length &&
    suppliedAnalysis.totals.participants === dataset.participants.length &&
    suppliedAnalysis.totals.systemEvents === dataset.systemEvents.length
      ? suppliedAnalysis
      : analyzeWhatsApp(dataset);
  if (!analysis.first || !analysis.latest || !analysis.totals.messages)
    return [];

  const total = analysis.totals;
  const mode =
    dataset.participants.length === 2
      ? "pair"
      : dataset.participants.length >= 3
        ? "group"
        : "solo";
  const aliases = new Map(
    dataset.participants.map((participant, index) => [
      participant.id,
      `Participant ${index + 1}`,
    ]),
  );
  const coreParticipants = new Map(
    analysis.participants.map((participant) => [participant.id, participant]),
  );
  const participantCounts = dataset.participants.map((participant) => ({
    id: participant.id,
    count: coreParticipants.get(participant.id)?.messageCount ?? 0,
  }));
  const comparisonParticipants = participantCounts.filter(
    (item) => item.count >= WHATSAPP_STORY_EVIDENCE.participantMessages,
  ).length;
  const rhythm = analyzeConversationRhythm(
    dataset.messages,
    dataset.participants,
  );
  const rhythmParticipants = new Map(
    rhythm.participants.map((participant) => [participant.id, participant]),
  );
  const patterns = analyzeWhatsAppMessagePatterns(
    dataset.messages,
    dataset.participants,
  );
  const participantLimitations = `Anonymous aliases follow the accepted export order. All ${whatsappNumber(dataset.participants.length)} participant labels are counted; group artwork shows at most ${WHATSAPP_STORY_LIMITS.participants}. Labels may represent people, renamed senders or shared accounts. Counts do not describe relationships or personalities.`;
  const firstDate = whatsappDate(analysis.first.date, true);
  const lastDate = whatsappDate(analysis.latest.date, true);
  const stories: WhatsAppStory[] = [
    {
      ...base(mode, {
        id: "conversation",
        name: "The conversation",
        label: "YOUR CHAT, IN NUMBERS",
        title: "All those messages.",
        lead: `${firstDate} to ${lastDate}: the chapter recorded in your export.`,
        value: whatsappNumber(total.messages),
        valueLabel: `messages across ${whatsappNumber(analysis.calendarSpanDays)} calendar days`,
        facts: [
          {
            value: whatsappNumber(total.participants),
            label: "participant labels",
          },
          { value: whatsappNumber(total.activeDays), label: "active dates" },
        ],
        note: "This may be a partial chat. Recorded dates do not prove when the conversation began.",
        theme: "forest",
        motif: "bubbles",
        calculation: {
          classification: "Exact",
          definition:
            "Count accepted participant messages and participant labels. Active dates have at least one message; the inclusive calendar span runs from the earliest to latest recorded date.",
          threshold: null,
          limitations:
            "Describes the full accepted source export. System events are excluded. The export may contain only part of the conversation.",
        },
      }),
      kind: "hero",
      data: {
        activeDates: total.activeDays,
        calendarSpanDays: analysis.calendarSpanDays,
        firstDate,
        lastDate,
      },
    },
  ];

  if (
    total.messages >= WHATSAPP_STORY_EVIDENCE.activityMessages &&
    comparisonParticipants >= 2
  ) {
    const counts = participantEntries(
      participantCounts,
      aliases,
      mode,
      total.messages,
    );
    stories.push({
      ...base(mode, {
        id: "participant-counts",
        name: "The contributors",
        label: "MESSAGES BY PARTICIPANT",
        title:
          mode === "pair"
            ? "Two sides of the story."
            : "The counts behind the chat.",
        lead: counts.leader
          ? `${counts.leader} has the highest exported message count.`
          : `${whatsappNumber(counts.leaderTieCount)} participants tie for the highest exported message count.`,
        value: whatsappNumber(counts.maximum),
        valueLabel: counts.leader
          ? "messages from that participant"
          : "messages from each tied participant",
        facts: [
          {
            value: whatsappNumber(total.participants),
            label: "participant labels in the export",
          },
          {
            value: whatsappNumber(counts.leaderTieCount),
            label: "participants at the maximum",
          },
        ],
        note: "Anonymous aliases, counted from the full export. A message count is just a message count.",
        theme: "cream",
        motif: "bubbles",
        calculation: {
          classification: "Exact",
          definition:
            "Messages attributed to each accepted participant label. Each percentage divides that count by all accepted participant messages. Every tied maximum is counted before limiting visible rows.",
          threshold: `At least ${WHATSAPP_STORY_EVIDENCE.activityMessages} messages and two labels with at least ${WHATSAPP_STORY_EVIDENCE.participantMessages} messages each.`,
          limitations: participantLimitations,
        },
      }),
      kind: mode === "pair" ? "split" : "ranking",
      data: {
        entries: counts.entries,
        total: total.messages,
        hiddenParticipants: counts.hiddenParticipants,
        leaderTieCount: counts.leaderTieCount,
        unit: "messages",
      },
    });
  }

  const days = whatsappPeaks(analysis.daily);
  if (
    total.messages >= WHATSAPP_STORY_EVIDENCE.activityMessages &&
    total.activeDays >= WHATSAPP_STORY_EVIDENCE.activeDates &&
    days[0]?.count >= WHATSAPP_STORY_EVIDENCE.peakMessages
  ) {
    const dates = days
      .slice(0, WHATSAPP_STORY_LIMITS.dates)
      .map((day) => ({ date: whatsappDate(day.key, true), value: day.count }));
    stories.push({
      ...base(mode, {
        id: "busiest-day",
        name: "The busiest day",
        label: "DAILY MESSAGE COUNTS",
        title: days.length === 1 ? "One busy day." : "A shared high point.",
        lead:
          days.length === 1
            ? `${whatsappDate(days[0].key)} had the highest recorded message count.`
            : `${whatsappNumber(days.length)} recorded days tie for the highest message count.`,
        value: whatsappNumber(days[0].count),
        valueLabel:
          days.length === 1
            ? "messages on that date"
            : "messages on each tied date",
        facts: [
          { value: whatsappNumber(days.length), label: "dates at the maximum" },
          {
            value: whatsappNumber(analysis.longestStreak?.days ?? 0),
            label: "longest consecutive active-date run",
          },
        ],
        theme: "lime",
        motif: "steps",
        calculation: {
          classification: "Exact",
          definition:
            "Group accepted participant messages by their recorded calendar date and keep every maximum. The streak summary counts consecutive dates with at least one accepted message.",
          threshold: `At least ${WHATSAPP_STORY_EVIDENCE.activityMessages} messages across ${WHATSAPP_STORY_EVIDENCE.activeDates} active dates; the maximum must contain at least ${WHATSAPP_STORY_EVIDENCE.peakMessages} messages.`,
          limitations: `Missing messages may change date counts. All ${whatsappNumber(days.length)} tied maxima are counted; artwork shows at most ${WHATSAPP_STORY_LIMITS.dates} dates. No timezone is inferred.`,
        },
      }),
      kind: "timeline",
      data: {
        from: whatsappDate(days[0].key, true),
        to: whatsappDate(days[days.length - 1].key, true),
        streakDays: analysis.longestStreak?.days ?? null,
        dates,
        tiedDates: days.length,
      },
    });
  }

  const hours = whatsappPeaks(analysis.hours);
  if (
    total.messages >= WHATSAPP_STORY_EVIDENCE.activityMessages &&
    hours[0]?.count >= WHATSAPP_STORY_EVIDENCE.peakMessages
  ) {
    stories.push({
      ...base(mode, {
        id: "busiest-hour",
        name: "The hour",
        label: "RECORDED TIME OF DAY",
        title:
          hours.length === 1
            ? "An hour with a lot to say."
            : "A rhythm with a tie.",
        lead:
          hours.length === 1
            ? `The hour starting at ${hourLabels[Number(hours[0].key)]} has the highest recorded message count.`
            : `${whatsappNumber(hours.length)} hourly buckets share the highest recorded message count.`,
        value: whatsappNumber(hours[0].count),
        valueLabel: "messages in each peak hourly bucket",
        facts: [
          {
            value: whatsappNumber(hours.length),
            label: "hourly buckets at the maximum",
          },
          {
            value: whatsappNumber(total.messages),
            label: "messages across every hour",
          },
        ],
        note: "Times are as recorded in the export. No timezone is inferred.",
        theme: "forest",
        motif: "rings",
        calculation: {
          classification: "Exact",
          definition:
            "Count accepted messages in each of the 24 recorded clock-hour buckets across all dates. Every tied maximum is retained.",
          threshold: `At least ${WHATSAPP_STORY_EVIDENCE.activityMessages} messages, with at least ${WHATSAPP_STORY_EVIDENCE.peakMessages} in the peak hour.`,
          limitations: clockLimitations,
        },
      }),
      kind: "distribution",
      data: {
        entries: analysis.hours.map((hour) => ({
          label: hourLabels[Number(hour.key)],
          value: hour.count,
          display: whatsappNumber(hour.count),
          share: hour.count / total.messages,
        })),
        total: total.messages,
        tiedMaximum: hours.length,
      },
    });
  }

  const streak = analysis.longestStreak;
  if (streak && streak.days >= WHATSAPP_STORY_EVIDENCE.streakDays) {
    stories.push({
      ...base(mode, {
        id: "active-streak",
        name: "The streak",
        label: "CONSECUTIVE RECORDED DATES",
        title: "A message, day after day.",
        lead: "The longest recorded run of calendar dates with a message on every date.",
        value: whatsappNumber(streak.days),
        valueLabel: "consecutive active dates",
        facts: [
          {
            value: whatsappNumber(total.activeDays),
            label: "active dates in total",
          },
          {
            value: whatsappNumber(analysis.calendarSpanDays),
            label: "calendar days covered",
          },
        ],
        theme: "mint",
        motif: "steps",
        calculation: {
          classification: "Exact",
          definition:
            "The longest run of consecutive recorded calendar dates with at least one accepted participant message on each date.",
          threshold: `At least ${WHATSAPP_STORY_EVIDENCE.streakDays} consecutive active dates.`,
          limitations:
            "Missing messages may change the result. The Analyzer supplies the first representative run when several runs have the same longest length. The length remains in the busiest-date summary if an eligible word card replaces this standalone card at the deck limit.",
        },
      }),
      kind: "timeline",
      data: {
        from: whatsappDate(streak.from, true),
        to: whatsappDate(streak.to, true),
        streakDays: streak.days,
        dates: analysis.daily
          .filter((day) => day.key >= streak.from && day.key <= streak.to)
          .slice(0, WHATSAPP_STORY_LIMITS.dates)
          .map((day) => ({
            date: whatsappDate(day.key, true),
            value: day.count,
          })),
        tiedDates: 0,
      },
    });
  }

  const session = rhythm.sessionSummary;
  if (
    session.total >= WHATSAPP_STORY_EVIDENCE.sessions &&
    session.medianMessages !== null &&
    session.longestByMessages &&
    session.longestBySpan
  ) {
    stories.push({
      ...base(mode, {
        id: "sessions",
        name: "Conversation sessions",
        label: "RECORDED CONVERSATION SESSIONS",
        title: "A chat in chapters.",
        lead: "Messages cluster into recorded sessions, with a pause between chapters.",
        value: whatsappNumber(session.total),
        valueLabel: "recorded sessions",
        facts: [
          {
            value: whatsappNumber(session.medianMessages),
            label: "median messages per session",
          },
          {
            value: duration(session.longestBySpan.spanSeconds),
            label: "longest recorded session span",
          },
        ],
        theme: "cream",
        motif: "steps",
        calculation: {
          classification: "Derived",
          definition: `New recorded session after a gap greater than ${SESSION_GAP_MINUTES} minutes. The first accepted message starts the first session. Median messages per session uses the Analyzer's linear-interpolation summary; the longest-by-count and longest-by-span facts may describe different sessions.`,
          threshold: `Session gap >${SESSION_GAP_MINUTES} minutes; at least ${WHATSAPP_STORY_EVIDENCE.sessions} recorded sessions for this card.`,
          limitations: `${clockLimitations} ${whatsappNumber(session.longestByMessages.tiedSessions)} sessions tie for the longest message count and ${whatsappNumber(session.longestBySpan.tiedSessions)} tie for the longest recorded span.`,
        },
      }),
      kind: "distribution",
      data: {
        entries: [
          {
            label: "Median session",
            value: session.medianMessages,
            display: `${whatsappNumber(session.medianMessages)} messages`,
          },
          {
            label: "Longest session",
            value: session.longestByMessages.messageCount,
            display: `${whatsappNumber(session.longestByMessages.messageCount)} messages`,
          },
        ],
        total: session.total,
        tiedMaximum: session.longestByMessages.tiedSessions,
      },
    });
  }

  const pushParticipantRhythm = (
    metric: "sessionsStarted" | "silenceBreakers",
  ) => {
    const isStarter = metric === "sessionsStarted";
    const observations = isStarter
      ? session.total
      : rhythm.silenceSummary.total;
    const minimum = isStarter
      ? WHATSAPP_STORY_EVIDENCE.sessions
      : WHATSAPP_STORY_EVIDENCE.silenceBreaks;
    if (observations < minimum || comparisonParticipants < 2) return;
    const values = dataset.participants.map((participant) => ({
      id: participant.id,
      count: rhythmParticipants.get(participant.id)?.[metric] ?? 0,
    }));
    const counts = participantEntries(values, aliases, mode, observations);
    stories.push({
      ...base(mode, {
        id: isStarter ? "session-starters" : "silence-breakers",
        name: isStarter ? "Started recorded sessions" : "Silence breakers",
        label: isStarter
          ? "WHO STARTED RECORDED SESSIONS"
          : "AFTER A RECORDED PAUSE",
        title: isStarter
          ? "The first message in a chapter."
          : "The next message after a pause.",
        lead: counts.leader
          ? `${counts.leader} has the highest ${isStarter ? "recorded session-start" : "recorded silence-break"} count.`
          : `${whatsappNumber(counts.leaderTieCount)} participants tie for the highest ${isStarter ? "recorded session-start" : "recorded silence-break"} count.`,
        value: whatsappNumber(observations),
        valueLabel: isStarter
          ? "recorded sessions started"
          : "recorded pauses ended by a message",
        facts: [
          {
            value: whatsappNumber(counts.leaderTieCount),
            label: "participants at the maximum",
          },
          {
            value: isStarter
              ? `>${SESSION_GAP_MINUTES} min`
              : `≥${SILENCE_BREAK_HOURS} hr`,
            label: "recorded gap threshold",
          },
        ],
        note: "A recorded count, with no inference about intent or relationships.",
        theme: isStarter ? "mint" : "lime",
        motif: "bubbles",
        calculation: {
          classification: "Derived",
          definition: isStarter
            ? `Attribute each recorded session to its first participant message, including the first session in the export. A new session starts after a gap greater than ${SESSION_GAP_MINUTES} minutes.`
            : `Next exported participant message after a recorded gap of at least ${SILENCE_BREAK_HOURS} hours. The first exported message has no preceding observed gap and cannot be a silence breaker.`,
          threshold: `${isStarter ? `Gap >${SESSION_GAP_MINUTES} minutes` : `Gap ≥${SILENCE_BREAK_HOURS} hours`}; at least ${minimum} ${isStarter ? "sessions" : "qualifying gaps"} and two participant labels with at least ${WHATSAPP_STORY_EVIDENCE.participantMessages} messages each.`,
          limitations: `${participantLimitations} ${clockLimitations} Zero is an observed count within this export, not a claim about an absent conversation.`,
        },
      }),
      kind: mode === "pair" ? "split" : "ranking",
      data: {
        entries: counts.entries,
        total: observations,
        hiddenParticipants: counts.hiddenParticipants,
        leaderTieCount: counts.leaderTieCount,
        unit: isStarter ? "session starts" : "silence breaks",
      },
    });
  };
  pushParticipantRhythm("sessionsStarted");
  pushParticipantRhythm("silenceBreakers");

  const timing = rhythm.timing;
  if (
    timing.count >= WHATSAPP_STORY_EVIDENCE.transitions &&
    timing.medianSeconds !== null
  ) {
    const eligible = rhythm.participants.filter(
      (participant) =>
        participant.timing.count >=
          WHATSAPP_STORY_EVIDENCE.participantTransitions &&
        participant.timing.medianSeconds !== null,
    );
    const compared =
      eligible.length >= 2
        ? (mode === "group"
            ? [...eligible].sort(
                (left, right) => right.timing.count - left.timing.count,
              )
            : eligible
          ).slice(0, WHATSAPP_STORY_LIMITS.participants)
        : [];
    const rapidShare = rhythm.rapidTransitions / timing.count;
    stories.push({
      ...base(mode, {
        id: "next-message",
        name: "Next-message rhythm",
        label: "RECORDED PARTICIPANT CHANGES",
        title: "Then came the next message.",
        lead: "The recorded delay when consecutive messages change participant labels.",
        value: duration(timing.medianSeconds),
        valueLabel: "median next-message transition delay",
        facts: [
          {
            value: `${duration(timing.p25Seconds)} / ${duration(timing.p75Seconds)}`,
            label: "p25 / p75 recorded delay",
          },
          {
            value: `${conciseNumber(rapidShare * 100)}%`,
            label: `rapid transitions (${whatsappNumber(rhythm.rapidTransitions)} of ${whatsappNumber(timing.count)})`,
          },
        ],
        note: "This describes consecutive recorded messages. It does not identify which message was being answered.",
        theme: "forest",
        motif: "rings",
        calculation: {
          classification: "Derived",
          definition: `Measure nonnegative recorded-clock gaps between consecutive messages when the participant changes, including changes across sessions. Median, p25 and p75 use the Analyzer's linear interpolation. Rapid transition: participant change within the same defined session with delay at most ${RAPID_TRANSITION_MINUTES} minutes. Rapid share divides these transitions by every observed participant change.`,
          threshold: `At least ${WHATSAPP_STORY_EVIDENCE.transitions} observed transitions. Participant comparisons require at least two labels with ${WHATSAPP_STORY_EVIDENCE.participantTransitions} incoming transitions each. Rapid delay ≤${RAPID_TRANSITION_MINUTES} minutes within a session defined by gaps ≤${SESSION_GAP_MINUTES} minutes.`,
          limitations: `${clockLimitations} Equal recorded timestamps can produce zero delay. No answered-message metadata or emotional interpretation is inferred. ${whatsappNumber(eligible.length)} labels qualify for timing comparison; group artwork shows at most ${WHATSAPP_STORY_LIMITS.participants}.`,
        },
      }),
      kind: "rhythm",
      data: {
        buckets: timing.buckets.map((bucket, index) => ({
          label: ["Under 1 min", "1–5 min", "5–30 min", "30 min–6 hr", "6+ hr"][
            index
          ],
          value: bucket.count,
          display: whatsappNumber(bucket.count),
          share: bucket.count / timing.count,
        })),
        entries: compared.map((participant) => ({
          label: aliases.get(participant.id) ?? "Participant",
          value: participant.timing.medianSeconds!,
          display: duration(participant.timing.medianSeconds),
        })),
        transitionCount: timing.count,
        rapidCount: rhythm.rapidTransitions,
        rapidShare,
      },
    });
  }

  const showBurst =
    patterns.burst.maximum >= WHATSAPP_STORY_EVIDENCE.burstMessages;
  const showRuns =
    patterns.runs.total >= WHATSAPP_STORY_EVIDENCE.runs &&
    (patterns.runs.longest ?? 0) >= WHATSAPP_STORY_EVIDENCE.longestRun;
  if (showBurst || showRuns) {
    stories.push({
      ...base(mode, {
        id: "message-patterns",
        name: "Message patterns",
        label: showBurst ? "TEN RECORDED MINUTES" : "CONSECUTIVE MESSAGE RUNS",
        title: showBurst
          ? "A little burst of conversation."
          : "One message. Then another.",
        lead: showBurst
          ? "The highest message count inside a rolling ten-minute recorded-clock window."
          : "A run continues while consecutive messages keep the same participant label.",
        value: whatsappNumber(
          showBurst ? patterns.burst.maximum : (patterns.runs.longest ?? 0),
        ),
        valueLabel: showBurst
          ? "messages in the peak 10-minute window"
          : "messages in the longest recorded run",
        facts: [
          {
            value: whatsappNumber(
              showBurst ? patterns.burst.tiedWindows : patterns.runs.total,
            ),
            label: showBurst
              ? "rolling windows at the maximum"
              : "recorded message runs",
          },
          {
            value: whatsappNumber(patterns.runs.medianLength ?? 0),
            label: "median messages per run",
          },
        ],
        theme: "lime",
        motif: "bubbles",
        calculation: {
          classification: "Derived",
          definition: `Burst: maximum participant-message count in an inclusive rolling ${BURST_WINDOW_MINUTES}-minute recorded-clock window, with one window per distinct recorded end value; tied windows can overlap. Run: consecutive messages from the same participant label, ending only when that label changes, including across long gaps.`,
          threshold: `Burst ≥${WHATSAPP_STORY_EVIDENCE.burstMessages} messages; otherwise at least ${WHATSAPP_STORY_EVIDENCE.runs} runs with a longest run ≥${WHATSAPP_STORY_EVIDENCE.longestRun} messages.`,
          limitations: `${clockLimitations} Burst windows may overlap; their tie count is not a count of independent events. Runs can continue across session boundaries. No message examples or timestamp clocks appear in the artwork.`,
        },
      }),
      kind: "patterns",
      data: {
        maximum: patterns.burst.maximum,
        ties: patterns.burst.tiedWindows,
        runs: patterns.runs.total,
        medianRunLength: patterns.runs.medianLength,
        longestRun: patterns.runs.longest,
        distribution: patterns.runs.distribution.map((bucket, index) => ({
          label: ["1", "2", "3–5", "6–10", "11+"][index],
          value: bucket.count,
          display: whatsappNumber(bucket.count),
          share: bucket.count / patterns.runs.total,
        })),
      },
    });
  }

  const emojiAvailable =
    total.emoji !== null &&
    !dataset.metadata.warnings.some(
      (warning) => warning.code === "emoji-unavailable",
    ) &&
    dataset.messages.every((message) => message.emoji !== null);
  if (
    total.mediaMessages >= WHATSAPP_STORY_EVIDENCE.mediaMessages ||
    (emojiAvailable &&
      (total.emoji ?? 0) >= WHATSAPP_STORY_EVIDENCE.emojiOccurrences)
  ) {
    const media = analysis.media
      .filter((bucket) => Object.hasOwn(mediaLabels, bucket.key))
      .map((bucket) => ({
        kind: bucket.key as WhatsAppMediaKind,
        label: mediaLabels[bucket.key as WhatsAppMediaKind],
        count: bucket.count,
      }))
      .sort((left, right) => right.count - left.count);
    const categories = media.slice(0, WHATSAPP_STORY_LIMITS.mediaCategories);
    const emoji = emojiAvailable
      ? analysis.topEmoji
          .slice(0, WHATSAPP_STORY_LIMITS.emoji)
          .map((item) => ({ symbol: item.key, count: item.count }))
      : [];
    stories.push({
      ...base(mode, {
        id: "media-emoji",
        name: "Media and emoji",
        label: "THE EXTRAS, WITHOUT THEIR CONTENTS",
        title: "A little more than words.",
        lead: "Recognized media placeholders and supported emoji, counted locally.",
        value: whatsappNumber(total.mediaMessages || total.emoji || 0),
        valueLabel: total.mediaMessages
          ? "recognized media messages"
          : "supported emoji occurrences",
        facts: [
          {
            value: whatsappNumber(total.mediaMessages),
            label: "recognized media messages",
          },
          {
            value: emojiAvailable
              ? whatsappNumber(total.emoji!)
              : "Unavailable",
            label: "supported emoji occurrences",
          },
        ],
        note: "Attachments are not inspected. Only recognized text markers and supported emoji are counted.",
        theme: "cream",
        motif: "rings",
        calculation: {
          classification: "Exact",
          definition:
            "Count media categories from recognized text placeholders and supported emoji grapheme occurrences using the existing core analysis. Top categories and emoji retain their source aggregate counts.",
          threshold: `At least ${WHATSAPP_STORY_EVIDENCE.mediaMessages} recognized media messages or ${WHATSAPP_STORY_EVIDENCE.emojiOccurrences} supported emoji occurrences.`,
          limitations: `Actual attachments are not opened and may be omitted or unrecognized. Emoji remain unavailable when segmentation is unavailable, rather than being reported as zero. Artwork shows up to ${WHATSAPP_STORY_LIMITS.mediaCategories} media categories and ${WHATSAPP_STORY_LIMITS.emoji} emoji; these are occurrences, not unique messages.`,
        },
      }),
      kind: "media",
      data: {
        categories,
        hiddenCategories: media.length - categories.length,
        remainingMedia: media
          .slice(WHATSAPP_STORY_LIMITS.mediaCategories)
          .reduce((sum, item) => sum + item.count, 0),
        emoji,
        emojiAvailable,
        mediaTotal: total.mediaMessages,
        emojiTotal: emojiAvailable ? total.emoji : null,
      },
    });
  }

  if (options.includeWords === true) {
    const text = analyzeWhatsAppText(dataset.messages, dataset.participants, {
      comparisonAllowed: false,
    });
    // This is privacy selection over the existing bounded word metrics, not a new
    // lexical engine. Original label tokens never become shareable word entries.
    const labelTokens = new Set(
      dataset.participants.flatMap((participant) =>
        [...participant.displayName.matchAll(/\p{L}[\p{L}\p{M}]*/gu)].map(
          (match) => normalizeWhatsAppWord(match[0]),
        ),
      ),
    );
    const words = text.words
      .filter(
        (item) =>
          item.count >= WHATSAPP_STORY_EVIDENCE.wordOccurrences &&
          !labelTokens.has(item.word),
      )
      .slice(0, WHATSAPP_STORY_LIMITS.words)
      .map((item) => ({ word: item.word, count: item.count }));
    if (
      text.eligibleTextMessages >=
        WHATSAPP_STORY_EVIDENCE.eligibleTextMessages &&
      text.eligibleWords >= WHATSAPP_STORY_EVIDENCE.eligibleWords &&
      words.length >= WHATSAPP_STORY_EVIDENCE.distinctWords
    ) {
      stories.push({
        ...base(mode, {
          id: "words",
          name: "Word-based insights",
          label: "MESSAGE-DERIVED WORDS · OPTED IN",
          title: "A few recurring words.",
          lead: "Words from message text, included because you opted in for this session.",
          value: whatsappNumber(text.eligibleWords),
          valueLabel: "eligible word occurrences",
          facts: [
            {
              value: whatsappNumber(text.eligibleTextMessages),
              label: "eligible text messages",
            },
            {
              value: whatsappNumber(words.length),
              label: "recurring words shown",
            },
          ],
          note: "Generated locally from message text. An exported PNG may expose these derived words.",
          theme: "mint",
          motif: "bubbles",
          calculation: {
            classification: "Derived",
            definition:
              "Eligible Unicode tokens after URL/email removal and combined Turkish/German/English stopword filtering, using the existing Analyzer text results. Typed media/events, omission markers and empty text are excluded. Original participant-label tokens are excluded from the shareable selection.",
            threshold: `Explicit current-session opt-in; eligible token length ${MIN_WORD_LENGTH}–${MAX_WORD_LENGTH} Unicode code points; at least ${WHATSAPP_STORY_EVIDENCE.eligibleTextMessages} eligible text messages, ${WHATSAPP_STORY_EVIDENCE.eligibleWords} eligible word occurrences and ${WHATSAPP_STORY_EVIDENCE.distinctWords} selected words occurring at least ${WHATSAPP_STORY_EVIDENCE.wordOccurrences} times. Show at most ${WHATSAPP_STORY_LIMITS.words} of the existing bounded top words.`,
            limitations:
              "These are message-derived words and may expose private context in an exported PNG. This is not sentiment, topic, personality or relationship analysis. At the 12-card limit this card replaces the standalone streak card; the busiest-date card retains the longest-streak summary.",
          },
        }),
        kind: "word",
        data: { words, eligibleWords: text.eligibleWords },
      });
    }
  }

  // Reserve the closing poster. The streak already lives in the busiest-date
  // aggregate, so an eligible opt-in card never grows a rich deck beyond 12.
  if (stories.length >= WHATSAPP_STORY_LIMITS.cards) {
    const standaloneStreak = stories.findIndex(
      (story) => story.id === "active-streak",
    );
    if (standaloneStreak !== -1) stories.splice(standaloneStreak, 1);
  }
  stories.push({
    ...base(mode, {
      id: "closing",
      name: "Your Wrapped",
      label: "MADE WITH WHATSAPPSCOPE",
      title: "Your chat. A little perspective.",
      lead: "A few recorded moments, brought together in one local story.",
      value: whatsappNumber(total.messages),
      valueLabel: "messages in this recorded chapter",
      facts: [
        {
          value: whatsappNumber(total.participants),
          label: "anonymous participant labels",
        },
        { value: whatsappNumber(total.activeDays), label: "active dates" },
      ],
      note: "Made with WhatsAppScope. Generated locally in your browser; your archive is not uploaded.",
      theme: "forest",
      motif: "rings",
      calculation: {
        classification: "Exact",
        definition:
          "Recap of accepted participant-message, participant-label and active-date counts from the full source export.",
        threshold: null,
        limitations:
          "Only cards with enough recorded evidence are included. Anonymous aliases and aggregate counts do not describe relationships, personalities or the complete history of a chat.",
      },
    }),
    kind: "closing",
    data: {
      messages: total.messages,
      participants: total.participants,
      activeDates: total.activeDays,
      cardCount: stories.length + 1,
    },
  });
  return stories;
}
