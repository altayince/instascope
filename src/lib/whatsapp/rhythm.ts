import { wallClockValue } from "./timestamp";
import type {
  WhatsAppConversationRhythm,
  WhatsAppConversationSession,
  WhatsAppDelayBucket,
  WhatsAppDelaySummary,
  WhatsAppParticipantRhythm,
  WhatsAppParticipantTransition,
} from "./rhythm-types";
import type { WhatsAppMessage, WhatsAppParticipant } from "./types";

/** Product definition: only a gap greater than this starts another session. */
export const SESSION_GAP_MINUTES = 30;
/** Product definition: a previous participant message and at least this gap are required. */
export const SILENCE_BREAK_HOURS = 6;
/** Product definition: a participant change within a session and at most this delay. */
export const RAPID_TRANSITION_MINUTES = 5;

const SESSION_GAP_SECONDS = SESSION_GAP_MINUTES * 60;
const SILENCE_BREAK_SECONDS = SILENCE_BREAK_HOURS * 60 * 60;
const RAPID_TRANSITION_SECONDS = RAPID_TRANSITION_MINUTES * 60;

const delayBuckets = (): WhatsAppDelayBucket[] => [
  { key: "under-1m", label: "Under 1 minute", count: 0 },
  { key: "1m-5m", label: "1 minute to under 5 minutes", count: 0 },
  { key: "5m-30m", label: "5 minutes to under 30 minutes", count: 0 },
  { key: "30m-6h", label: "30 minutes to under 6 hours", count: 0 },
  { key: "6h-plus", label: "6 hours or more", count: 0 },
];

/** Linear interpolation at rank (n - 1) * p; accepted delays are nonnegative seconds. */
function quantile(
  sorted: readonly number[],
  proportion: number,
): number | null {
  if (sorted.length === 0) return null;
  const rank = (sorted.length - 1) * proportion;
  const lower = Math.floor(rank);
  return (
    sorted[lower] + (sorted[Math.ceil(rank)] - sorted[lower]) * (rank - lower)
  );
}

/** Nonoverlapping delay buckets are [0, 60), [60, 300), [300, 1800), [1800, 21600), [21600, infinity). */
export function delaySummary(delays: readonly number[]): WhatsAppDelaySummary {
  const sorted = [...delays].sort((left, right) => left - right);
  const buckets = delayBuckets();
  for (const seconds of sorted) {
    const index =
      seconds < 60
        ? 0
        : seconds < 300
          ? 1
          : seconds < 1800
            ? 2
            : seconds < 21600
              ? 3
              : 4;
    buckets[index].count++;
  }
  return {
    count: sorted.length,
    medianSeconds: quantile(sorted, 0.5),
    p25Seconds: quantile(sorted, 0.25),
    p75Seconds: quantile(sorted, 0.75),
    buckets,
  };
}

export function isRapidParticipantTransition(
  transition: Pick<
    WhatsAppParticipantTransition,
    "fromParticipantId" | "toParticipantId" | "delaySeconds" | "sameSession"
  >,
): boolean {
  return (
    transition.fromParticipantId !== transition.toParticipantId &&
    transition.sameSession &&
    transition.delaySeconds >= 0 &&
    transition.delaySeconds <= RAPID_TRANSITION_SECONDS
  );
}

/**
 * Pure rhythm statistics from the supplied participant messages only. Date selection
 * happens before this function; its first message starts a session but cannot break
 * a preceding silence. System events cannot create or split these sessions.
 * Recorded wall-clock differences never infer reply metadata, timezone or DST.
 * Returned transitions and sessions contain scalar context, never source records.
 */
export function analyzeConversationRhythm(
  messages: readonly WhatsAppMessage[],
  participants: readonly WhatsAppParticipant[],
): WhatsAppConversationRhythm {
  const ordered = messages
    .map((message, index) => ({
      message,
      value: wallClockValue(message.timestamp),
      index,
    }))
    .sort(
      (left, right) =>
        left.value - right.value ||
        left.message.id - right.message.id ||
        left.index - right.index,
    );
  const presentParticipants = new Set(
    messages.map((message) => message.participantId),
  );
  const participantStats: WhatsAppParticipantRhythm[] = participants
    .filter((participant) => presentParticipants.has(participant.id))
    .map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      sessionsStarted: 0,
      silenceBreakers: 0,
      timing: delaySummary([]),
      rapidTransitions: 0,
      rapidShare: null,
    }));
  const byParticipant = new Map(
    participantStats.map((stats) => [
      stats.id,
      { stats, delays: [] as number[] },
    ]),
  );
  const sessions: WhatsAppConversationSession[] = [];
  const transitions: WhatsAppParticipantTransition[] = [];
  const transitionDelays: number[] = [];
  const qualifyingGaps: number[] = [];
  let session: WhatsAppConversationSession | null = null;
  let sessionStartValue = 0;
  let rapidTransitions = 0;
  let equalTimestampTransitions = 0;

  for (const [index, { message, value }] of ordered.entries()) {
    const previous = ordered[index - 1];
    const delaySeconds = previous ? (value - previous.value) / 1000 : null;
    const participant = byParticipant.get(message.participantId);
    const sameSession =
      delaySeconds !== null && delaySeconds <= SESSION_GAP_SECONDS;

    if (session === null || !sameSession) {
      session = {
        starterId: message.participantId,
        firstTimestamp: message.timestamp.local,
        lastTimestamp: message.timestamp.local,
        messageCount: 1,
        spanSeconds: 0,
      };
      sessionStartValue = value;
      sessions.push(session);
      if (participant) participant.stats.sessionsStarted++;
    } else {
      session.lastTimestamp = message.timestamp.local;
      session.messageCount++;
      session.spanSeconds = (value - sessionStartValue) / 1000;
    }

    if (delaySeconds !== null && delaySeconds >= SILENCE_BREAK_SECONDS) {
      qualifyingGaps.push(delaySeconds);
      if (participant) participant.stats.silenceBreakers++;
    }

    if (
      previous &&
      delaySeconds !== null &&
      previous.message.participantId !== message.participantId
    ) {
      const transition: WhatsAppParticipantTransition = {
        fromParticipantId: previous.message.participantId,
        toParticipantId: message.participantId,
        fromDate: previous.message.timestamp.date,
        toDate: message.timestamp.date,
        fromTimestamp: previous.message.timestamp.local,
        toTimestamp: message.timestamp.local,
        delaySeconds,
        sameSession,
      };
      transitions.push(transition);
      transitionDelays.push(delaySeconds);
      participant?.delays.push(delaySeconds);
      if (delaySeconds === 0) equalTimestampTransitions++;
      if (isRapidParticipantTransition(transition)) {
        rapidTransitions++;
        if (participant) participant.stats.rapidTransitions++;
      }
    }
  }

  for (const { stats, delays } of byParticipant.values()) {
    stats.timing = delaySummary(delays);
    stats.rapidShare = delays.length
      ? stats.rapidTransitions / delays.length
      : null;
  }

  let longestByMessages: WhatsAppConversationRhythm["sessionSummary"]["longestByMessages"] =
    null;
  let longestBySpan: WhatsAppConversationRhythm["sessionSummary"]["longestBySpan"] =
    null;
  for (const item of sessions) {
    if (
      longestByMessages === null ||
      item.messageCount > longestByMessages.messageCount
    ) {
      longestByMessages = { messageCount: item.messageCount, tiedSessions: 1 };
    } else if (item.messageCount === longestByMessages.messageCount) {
      longestByMessages.tiedSessions++;
    }
    if (
      longestBySpan === null ||
      item.spanSeconds > longestBySpan.spanSeconds
    ) {
      longestBySpan = { spanSeconds: item.spanSeconds, tiedSessions: 1 };
    } else if (item.spanSeconds === longestBySpan.spanSeconds) {
      longestBySpan.tiedSessions++;
    }
  }
  const sortedSessionCounts = sessions
    .map((item) => item.messageCount)
    .sort((left, right) => left - right);
  const sortedGaps = qualifyingGaps.sort((left, right) => left - right);

  return {
    messageCount: messages.length,
    sessions,
    sessionSummary: {
      total: sessions.length,
      medianMessages: quantile(sortedSessionCounts, 0.5),
      longestByMessages,
      longestBySpan,
    },
    silenceSummary: {
      total: sortedGaps.length,
      medianGapSeconds: quantile(sortedGaps, 0.5),
      longestGapSeconds: sortedGaps.at(-1) ?? null,
    },
    transitions,
    timing: delaySummary(transitionDelays),
    rapidTransitions,
    equalTimestampTransitions,
    participants: participantStats,
  };
}
