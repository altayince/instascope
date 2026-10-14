import type {
  WhatsAppComparedWord,
  WhatsAppNumericSummary,
  WhatsAppTextAnalysis,
  WhatsAppWordComparison,
  WhatsAppWordFrequency,
} from "./content-types";
import { hasUnclassifiedWhatsAppMarker } from "./events";
import { isWhatsAppStopword, normalizeWhatsAppWord } from "./stopwords";
import type { WhatsAppMessage, WhatsAppParticipant } from "./types";

export const MIN_WORD_LENGTH = 2;
export const MAX_WORD_LENGTH = 40;
export const MIN_WORD_OCCURRENCES = 2;
export const TOP_WORD_LIMIT = 20;
export const COMPARISON_WORD_LIMIT = 10;
export const MIN_COMPARISON_WORD_OCCURRENCES = 3;
export const MIN_COMPARISON_ELIGIBLE_WORDS = 20;
export const COMPARISON_SMOOTHING = 0.5;
export const MIN_COMPARISON_RATIO = 2;

type TextAccumulator = {
  lengths: number[];
  wordCounts: number[];
  eligibleWords: number;
  frequencies: Map<string, number>;
};

const accumulator = (): TextAccumulator => ({
  lengths: [],
  wordCounts: [],
  eligibleWords: 0,
  frequencies: new Map(),
});

const binaryCompare = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

/** Unicode code points, not UTF-16 units or user-perceived grapheme clusters. */
function codePointLength(text: string): number {
  let length = 0;
  for (let offset = 0; offset < text.length; length++) {
    offset += text.codePointAt(offset)! > 0xffff ? 2 : 1;
  }
  return length;
}

/**
 * Remove URL/URI and email tokens without visiting them. Hierarchical URI schemes
 * are general; the fixed nonhierarchical schemes avoid mistaking prose such as
 * "label:word" for a URL. Bare hostnames without www or a scheme are plain text.
 * Apostrophes stay inside URI tokens and unquoted email local parts, so their
 * path/address suffixes cannot become lexical words. Email local-part punctuation
 * uses the unquoted address character set alongside Unicode letters/marks/numbers.
 * Explicit candidate boundaries prevent repeated scans at every suffix of a
 * long malformed token. The scheme/email repetitions have no nested quantifiers.
 */
function withoutLinks(text: string): string {
  return text
    .replace(/(?<![a-z\d+.-])[a-z][a-z\d+.-]*:\/\/[^\s<>"]+/giu, " ")
    .replace(/\b(?:https?|mailto|tel|sms|urn|data):[^\s<>"]+/giu, " ")
    .replace(/\bwww\.[^\s<>"]+/giu, " ")
    .replace(
      /(?<![\p{L}\p{M}\p{N}.!#$%&'*+\/=?^_`{|}~-])[\p{L}\p{M}\p{N}.!#$%&'*+\/=?^_`{|}~-]+@[\p{L}\p{M}\p{N}.-]+\.[\p{L}\p{M}]{2,}/gu,
      " ",
    );
}

/** Linear interpolation at rank (n - 1) * p; no observations means unavailable. */
function numericSummary(values: readonly number[]): WhatsAppNumericSummary {
  const sorted = [...values].sort((left, right) => left - right);
  const quantile = (proportion: number): number | null => {
    if (sorted.length === 0) return null;
    const rank = (sorted.length - 1) * proportion;
    const lower = Math.floor(rank);
    return (
      sorted[lower] + (sorted[Math.ceil(rank)] - sorted[lower]) * (rank - lower)
    );
  };
  return {
    count: sorted.length,
    median: quantile(0.5),
    p25: quantile(0.25),
    p75: quantile(0.75),
  };
}

function topWords(
  frequencies: ReadonlyMap<string, number>,
): WhatsAppWordFrequency[] {
  return [...frequencies]
    .filter(([, count]) => count >= MIN_WORD_OCCURRENCES)
    .sort(
      ([left, leftCount], [right, rightCount]) =>
        rightCount - leftCount || binaryCompare(left, right),
    )
    .slice(0, TOP_WORD_LIMIT)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Rates use every eligible occurrence, including singleton words excluded from
 * leaderboards. The other population pools all other matching participant labels.
 * Fixed smoothing: (count + 0.5) / (eligible occurrences + 1) * 1,000.
 */
function comparedWords(
  own: TextAccumulator,
  all: TextAccumulator,
  activeParticipantCount: number,
  comparisonAllowed: boolean,
): WhatsAppWordComparison {
  if (!comparisonAllowed)
    return { available: false, reason: "participant-filter" };
  if (activeParticipantCount < 2)
    return { available: false, reason: "one-participant" };
  const otherTotal = all.eligibleWords - own.eligibleWords;
  if (
    own.eligibleWords < MIN_COMPARISON_ELIGIBLE_WORDS ||
    otherTotal < MIN_COMPARISON_ELIGIBLE_WORDS
  ) {
    return { available: false, reason: "insufficient-data" };
  }
  const words: WhatsAppComparedWord[] = [];
  for (const [word, count] of own.frequencies) {
    if (count < MIN_COMPARISON_WORD_OCCURRENCES) continue;
    const otherCount = (all.frequencies.get(word) ?? 0) - count;
    const perThousand =
      ((count + COMPARISON_SMOOTHING) /
        (own.eligibleWords + 2 * COMPARISON_SMOOTHING)) *
      1000;
    const otherPerThousand =
      ((otherCount + COMPARISON_SMOOTHING) /
        (otherTotal + 2 * COMPARISON_SMOOTHING)) *
      1000;
    // Algebraically the rate ratio; avoid rounding each rate before comparing
    // mathematically equal fractions, so count/word tie breakers remain stable.
    const ratio =
      ((count + COMPARISON_SMOOTHING) *
        (otherTotal + 2 * COMPARISON_SMOOTHING)) /
      ((otherCount + COMPARISON_SMOOTHING) *
        (own.eligibleWords + 2 * COMPARISON_SMOOTHING));
    if (ratio >= MIN_COMPARISON_RATIO)
      words.push({
        word,
        count,
        otherCount,
        perThousand,
        otherPerThousand,
        ratio,
      });
  }
  words.sort(
    (left, right) =>
      right.ratio - left.ratio ||
      right.count - left.count ||
      binaryCompare(left.word, right.word),
  );
  return { available: true, words: words.slice(0, COMPARISON_WORD_LIMIT) };
}

/**
 * Pure text summaries for the already selected participant records. Eligible text
 * excludes typed media/events, caption-bearing omission markers and trimmed empty
 * records. Length counts code points after NFC + trim, including interior spacing,
 * punctuation, URLs and emoji. Word counts use URL-scrubbed Unicode letter/mark
 * runs before stopwords or thresholds; apostrophes, hyphens and numbers delimit.
 * Returned records contain bounded word aggregates and copied participant labels,
 * never message bodies, message samples, URLs or references to input records.
 */
export function analyzeWhatsAppText(
  messages: readonly WhatsAppMessage[],
  participants: readonly WhatsAppParticipant[],
  options: { comparisonAllowed?: boolean } = {},
): WhatsAppTextAnalysis {
  const all = accumulator();
  const activeParticipants = new Set(
    messages.map((message) => message.participantId),
  );
  const selectedParticipants = participants.filter((participant) =>
    activeParticipants.has(participant.id),
  );
  const byParticipant = new Map(
    selectedParticipants.map((participant) => [participant.id, accumulator()]),
  );

  for (const message of messages) {
    if (
      message.media ||
      message.event ||
      hasUnclassifiedWhatsAppMarker(message.content)
    )
      continue;
    const text = message.content.normalize("NFC").trim();
    if (!text) continue;
    const own = byParticipant.get(message.participantId);
    const length = codePointLength(text);
    all.lengths.push(length);
    own?.lengths.push(length);
    let wordCount = 0;
    for (const match of withoutLinks(text).matchAll(/\p{L}[\p{L}\p{M}]*/gu)) {
      wordCount++;
      const word = normalizeWhatsAppWord(match[0]);
      const tokenLength = codePointLength(word);
      if (
        tokenLength < MIN_WORD_LENGTH ||
        tokenLength > MAX_WORD_LENGTH ||
        isWhatsAppStopword(word)
      )
        continue;
      all.eligibleWords++;
      all.frequencies.set(word, (all.frequencies.get(word) ?? 0) + 1);
      if (own) {
        own.eligibleWords++;
        own.frequencies.set(word, (own.frequencies.get(word) ?? 0) + 1);
      }
    }
    all.wordCounts.push(wordCount);
    own?.wordCounts.push(wordCount);
  }

  return {
    eligibleTextMessages: all.lengths.length,
    length: numericSummary(all.lengths),
    wordsPerMessage: numericSummary(all.wordCounts),
    eligibleWords: all.eligibleWords,
    words: topWords(all.frequencies),
    participants: selectedParticipants.map((participant) => {
      const own = byParticipant.get(participant.id)!;
      return {
        id: participant.id,
        displayName: participant.displayName,
        eligibleTextMessages: own.lengths.length,
        length: numericSummary(own.lengths),
        wordsPerMessage: numericSummary(own.wordCounts),
        eligibleWords: own.eligibleWords,
        words: topWords(own.frequencies),
        comparison: comparedWords(
          own,
          all,
          activeParticipants.size,
          options.comparisonAllowed !== false,
        ),
      };
    }),
  };
}
