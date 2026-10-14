import { wallClockValue } from "./timestamp";
import type { WhatsAppBurst, WhatsAppMessagePatterns } from "./content-types";
import type {
  WhatsAppCountBucket,
  WhatsAppMessage,
  WhatsAppParticipant,
} from "./types";

/** An inclusive rolling window of recorded wall-clock values, without timezone inference. */
export const BURST_WINDOW_MINUTES = 10;

const BURST_WINDOW_MILLISECONDS = BURST_WINDOW_MINUTES * 60 * 1000;
const BURST_EXAMPLE_LIMIT = 3;

type OrderedMessage = {
  message: WhatsAppMessage;
  value: number;
  index: number;
};

const runBuckets = (): WhatsAppCountBucket[] => [
  { key: "1", label: "1", count: 0 },
  { key: "2", label: "2", count: 0 },
  { key: "3-5", label: "3–5", count: 0 },
  { key: "6-10", label: "6–10", count: 0 },
  { key: "11-plus", label: "11+", count: 0 },
];

function runSummary(lengths: readonly number[]) {
  const sorted = [...lengths].sort((left, right) => left - right);
  const middle = (sorted.length - 1) / 2;
  return {
    count: sorted.length,
    medianLength:
      sorted.length === 0
        ? null
        : (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2,
    longest: sorted.length === 0 ? null : sorted[sorted.length - 1],
  };
}

/** One window per distinct recorded end value; all equal-time records enter together. */
function highestBurst(ordered: readonly OrderedMessage[]): WhatsAppBurst {
  const result: WhatsAppBurst = { maximum: 0, tiedWindows: 0, examples: [] };
  let start = 0;
  let end = 0;
  while (end < ordered.length) {
    const endValue = ordered[end].value;
    let afterEnd = end + 1;
    while (afterEnd < ordered.length && ordered[afterEnd].value === endValue) {
      afterEnd++;
    }
    while (ordered[start].value < endValue - BURST_WINDOW_MILLISECONDS) {
      start++;
    }
    const count = afterEnd - start;
    if (count >= result.maximum) {
      if (count > result.maximum) {
        result.maximum = count;
        result.tiedWindows = 0;
        result.examples = [];
      }
      result.tiedWindows++;
      if (result.examples.length < BURST_EXAMPLE_LIMIT) {
        result.examples.push({
          from: ordered[start].message.timestamp.local,
          to: ordered[afterEnd - 1].message.timestamp.local,
        });
      }
    }
    end = afterEnd;
  }
  return result;
}

function questionMarks(content: string): number {
  let count = 0;
  for (let index = 0; index < content.length; index++) {
    if (content.charCodeAt(index) === 63) count++;
  }
  return count;
}

/**
 * Pure statistics from the supplied, already-selected participant messages.
 * A run ends only on a participant switch, including across long recorded gaps.
 * System events are a separate source collection and never enter this analysis.
 * Literal ASCII question marks include those in URLs and recognized marker records.
 * Returned burst contexts contain scalar recorded timestamps, never source bodies.
 */
export function analyzeWhatsAppMessagePatterns(
  messages: readonly WhatsAppMessage[],
  participants: readonly WhatsAppParticipant[],
): WhatsAppMessagePatterns {
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
  const participantData = participants
    .filter((participant) => presentParticipants.has(participant.id))
    .map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      ordered: [] as OrderedMessage[],
      runLengths: [] as number[],
      questionMessages: 0,
      questionOccurrences: 0,
    }));
  const byParticipant = new Map(
    participantData.map((participant) => [participant.id, participant]),
  );
  const runLengths: number[] = [];
  const distribution = runBuckets();
  let runParticipantId: string | null = null;
  let runLength = 0;
  let questionMessages = 0;
  let questionOccurrences = 0;

  const finishRun = (participantId: string, length: number) => {
    runLengths.push(length);
    byParticipant.get(participantId)?.runLengths.push(length);
    const bucket =
      length === 1
        ? 0
        : length === 2
          ? 1
          : length <= 5
            ? 2
            : length <= 10
              ? 3
              : 4;
    distribution[bucket].count++;
  };

  for (const record of ordered) {
    const { message } = record;
    const participant = byParticipant.get(message.participantId);
    participant?.ordered.push(record);
    if (runParticipantId === message.participantId) {
      runLength++;
    } else {
      if (runParticipantId !== null) finishRun(runParticipantId, runLength);
      runParticipantId = message.participantId;
      runLength = 1;
    }
    const occurrences = questionMarks(message.content);
    if (occurrences > 0) {
      questionMessages++;
      questionOccurrences += occurrences;
      if (participant) {
        participant.questionMessages++;
        participant.questionOccurrences += occurrences;
      }
    }
  }
  if (runParticipantId !== null) finishRun(runParticipantId, runLength);
  const runs = runSummary(runLengths);
  return {
    messageCount: ordered.length,
    runs: {
      total: runs.count,
      medianLength: runs.medianLength,
      longest: runs.longest,
      distribution,
    },
    burst: highestBurst(ordered),
    questionMarks: {
      messages: questionMessages,
      occurrences: questionOccurrences,
      share: ordered.length === 0 ? null : questionMessages / ordered.length,
    },
    participants: participantData.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      runs: runSummary(participant.runLengths),
      burst: highestBurst(participant.ordered),
      questionMarks: {
        messages: participant.questionMessages,
        occurrences: participant.questionOccurrences,
        share: participant.questionMessages / participant.ordered.length,
      },
    })),
  };
}
