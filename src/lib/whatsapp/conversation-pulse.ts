import type {
  ChatComparisonDistribution,
  ChatComparisonMetric,
  ChatVaultComparison,
  ChatVaultComparisonResult,
} from "./chat-vault-compare";

export type ConversationPulseItem = {
  id: string;
  title: string;
  summary: string;
  metricKey: string;
  earlier: number;
  later: number;
  delta: number;
  unit: ChatComparisonMetric["unit"];
  classification: "exact" | "derived";
  thresholdExplanation: string;
  distribution?: {
    key: ChatComparisonDistribution["key"];
    bucketKey: string;
    earlierCount: number;
    laterCount: number;
    earlierTotal: number;
    laterTotal: number;
  };
};

export type ConversationPulse = {
  items: ConversationPulseItem[];
  emptyReason: string | null;
};

// Display rules, not significance tests or confidence scores. Relative gates
// use the larger absolute saved value, so a zero baseline never implies an
// infinite percentage change. Normalized distribution gates use share points.
export const CONVERSATION_PULSE_THRESHOLDS = {
  items: 5,
  messages: { absolute: 10, fractionOfLarger: 0.1, minimumLargerTotal: 20 },
  activeDays: { absolute: 2, fractionOfLarger: 0.15, minimumMessages: 10 },
  sessionSize: { absolute: 1, fractionOfLarger: 0.2, minimumSessions: 3 },
  longestGap: { absolute: 3600, fractionOfLarger: 0.25, minimumMessages: 10 },
  transitionDelay: {
    absolute: 60,
    fractionOfLarger: 0.2,
    minimumTransitions: 4,
  },
  textLength: { absolute: 5, fractionOfLarger: 0.2, minimumTextMessages: 6 },
  questionShare: { absolute: 0.1, minimumMessages: 20 },
  activityShare: { absolute: 0.1, minimumMessages: 20 },
  mediaShare: { absolute: 0.15, minimumMediaMessages: 5 },
  transitionShare: { absolute: 0.15, minimumTransitions: 10 },
} as const;

type Candidate = {
  item: ConversationPulseItem;
  theme: string;
  strength: number;
  priority: number;
};
type Rule = {
  key: string;
  label: string;
  theme: string;
  absolute: number;
  fractionOfLarger?: number;
  eligible: (comparison: ChatVaultComparison) => boolean;
  explanation: string;
};

const thresholds = CONVERSATION_PULSE_THRESHOLDS;
const enoughMessages = (comparison: ChatVaultComparison, minimum: number) =>
  comparison.earlier.totals.messages >= minimum &&
  comparison.later.totals.messages >= minimum;

const rules: readonly Rule[] = [
  {
    key: "totals.messages",
    label: "Saved message total",
    theme: "volume",
    ...thresholds.messages,
    eligible: ({ earlier, later }) =>
      Math.max(earlier.totals.messages, later.totals.messages) >=
      thresholds.messages.minimumLargerTotal,
    explanation:
      "At least 20 messages in one snapshot, a difference of at least 10, and at least 10% of the larger saved count.",
  },
  {
    key: "totals.activeDays",
    label: "Recorded active dates",
    theme: "activeDates",
    ...thresholds.activeDays,
    eligible: (comparison) =>
      enoughMessages(comparison, thresholds.activeDays.minimumMessages),
    explanation:
      "At least 10 messages in each snapshot, a difference of at least 2 active dates, and at least 15% of the larger saved value.",
  },
  {
    key: "rhythm.medianSessionMessages",
    label: "Median recorded session size",
    theme: "sessionSize",
    ...thresholds.sessionSize,
    eligible: ({ earlier, later }) =>
      earlier.rhythm.sessionCount >= thresholds.sessionSize.minimumSessions &&
      later.rhythm.sessionCount >= thresholds.sessionSize.minimumSessions,
    explanation:
      "At least 3 recorded sessions in each snapshot, a median difference of at least 1 message, and at least 20% of the larger median.",
  },
  {
    key: "activity.longestGapSeconds",
    label: "Longest recorded message gap",
    theme: "gap",
    ...thresholds.longestGap,
    eligible: (comparison) =>
      enoughMessages(comparison, thresholds.longestGap.minimumMessages),
    explanation:
      "At least 10 messages in each snapshot, a difference of at least 1 recorded hour, and at least 25% of the larger gap. Missing exported messages are not proof of conversation silence.",
  },
  {
    key: "rhythm.medianTransitionSeconds",
    label: "Median next-sender delay",
    theme: "transitionTiming",
    ...thresholds.transitionDelay,
    eligible: ({ earlier, later }) =>
      earlier.rhythm.transitionCount >=
        thresholds.transitionDelay.minimumTransitions &&
      later.rhythm.transitionCount >=
        thresholds.transitionDelay.minimumTransitions,
    explanation:
      "At least 4 next-sender transitions in each snapshot, a median difference of at least 60 recorded seconds, and at least 20% of the larger median. This is not reply or read timing.",
  },
  {
    key: "patterns.text.length.median",
    label: "Median eligible text length",
    theme: "textLength",
    ...thresholds.textLength,
    eligible: ({ earlier, later }) =>
      earlier.patterns.text.eligibleMessages >=
        thresholds.textLength.minimumTextMessages &&
      later.patterns.text.eligibleMessages >=
        thresholds.textLength.minimumTextMessages,
    explanation:
      "At least 6 eligible text messages in each snapshot, a median difference of at least 5 code points, and at least 20% of the larger median.",
  },
  {
    key: "patterns.questionMarks.share",
    label: "Question-mark message share",
    theme: "questionMarks",
    ...thresholds.questionShare,
    eligible: (comparison) =>
      enoughMessages(comparison, thresholds.questionShare.minimumMessages),
    explanation:
      "At least 20 messages in each snapshot and a difference of at least 10 percentage points. Literal question marks are not interpreted as intent.",
  },
];

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const percentage = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 1,
});
function valueLabel(value: number, unit: ChatComparisonMetric["unit"]): string {
  if (unit === "share") return percentage.format(value);
  if (unit === "seconds") return `${number.format(value)} recorded seconds`;
  if (unit === "characters") return `${number.format(value)} code points`;
  if (unit === "words") return `${number.format(value)} word units`;
  if (unit === "days") return `${number.format(value)} days`;
  return number.format(value);
}

function atLeast(value: number, threshold: number): boolean {
  const roundingTolerance =
    Number.EPSILON * 8 * Math.max(1, Math.abs(value), Math.abs(threshold));
  return value >= threshold - roundingTolerance;
}

// Qualification and ranking use unrounded facts. Strength is a bounded ratio
// to the display thresholds, never a relationship score or confidence value.
function scalarCandidate(
  comparison: ChatVaultComparison,
  rule: Rule,
  priority: number,
): Candidate | null {
  const metric = comparison.metrics.find((value) => value.key === rule.key);
  if (
    !metric ||
    metric.classification === "unavailable" ||
    metric.earlier === null ||
    metric.later === null ||
    metric.delta === null ||
    !rule.eligible(comparison)
  )
    return null;
  const magnitude = Math.abs(metric.delta);
  const denominator = Math.max(
    Math.abs(metric.earlier),
    Math.abs(metric.later),
  );
  const fraction = denominator ? magnitude / denominator : 0;
  if (
    !atLeast(magnitude, rule.absolute) ||
    (rule.fractionOfLarger !== undefined &&
      !atLeast(fraction, rule.fractionOfLarger))
  )
    return null;
  const relativeStrength = rule.fractionOfLarger
    ? Math.min(4, fraction / rule.fractionOfLarger)
    : Math.min(4, magnitude / rule.absolute);
  return {
    item: {
      id: `metric:${metric.key}`,
      title: `${rule.label} is ${metric.delta > 0 ? "higher" : "lower"} in the later snapshot`,
      summary: `${rule.label} is ${valueLabel(metric.later, metric.unit)} in the later full-export snapshot versus ${valueLabel(metric.earlier, metric.unit)} in the earlier snapshot.`,
      metricKey: metric.key,
      earlier: metric.earlier,
      later: metric.later,
      delta: metric.delta,
      unit: metric.unit,
      classification: metric.classification,
      thresholdExplanation: rule.explanation,
    },
    theme: rule.theme,
    strength: Math.min(4, magnitude / rule.absolute) + relativeStrength,
    priority,
  };
}

function distributionCandidate(
  distribution: ChatComparisonDistribution,
  priority: number,
): Candidate | null {
  const settings =
    distribution.key === "media"
      ? {
          absolute: thresholds.mediaShare.absolute,
          minimum: thresholds.mediaShare.minimumMediaMessages,
          theme: "mediaMix",
          denominator: "recognized media messages",
        }
      : distribution.key === "transitions"
        ? {
            absolute: thresholds.transitionShare.absolute,
            minimum: thresholds.transitionShare.minimumTransitions,
            theme: "transitionTiming",
            denominator: "recorded next-sender transitions",
          }
        : {
            absolute: thresholds.activityShare.absolute,
            minimum: thresholds.activityShare.minimumMessages,
            theme: "activityTiming",
            denominator: "exported participant messages",
          };
  if (
    distribution.earlierTotal < settings.minimum ||
    distribution.laterTotal < settings.minimum
  )
    return null;
  const eligible = distribution.buckets.filter(
    (bucket) =>
      bucket.earlierShare !== null &&
      bucket.laterShare !== null &&
      bucket.deltaShare !== null &&
      atLeast(Math.abs(bucket.deltaShare), settings.absolute),
  );
  // Stable declared bucket order resolves ties; no raw counts break a share tie.
  const strongest = eligible.reduce<(typeof eligible)[number] | null>(
    (current, bucket) =>
      !current || Math.abs(bucket.deltaShare!) > Math.abs(current.deltaShare!)
        ? bucket
        : current,
    null,
  );
  if (!strongest) return null;
  const earlier = strongest.earlierShare!;
  const later = strongest.laterShare!;
  const delta = strongest.deltaShare!;
  return {
    item: {
      id: `distribution:${distribution.key}:${strongest.key}`,
      title: `${distribution.label}: ${strongest.label} has a ${delta > 0 ? "higher" : "lower"} share`,
      summary: `In the later full-export snapshot, ${strongest.label} contains ${number.format(strongest.laterCount)} of ${number.format(distribution.laterTotal)} ${settings.denominator} (${percentage.format(later)}), versus ${number.format(strongest.earlierCount)} of ${number.format(distribution.earlierTotal)} (${percentage.format(earlier)}) earlier.`,
      metricKey: `distribution.${distribution.key}.${strongest.key}`,
      earlier,
      later,
      delta,
      unit: "share",
      classification: "derived",
      thresholdExplanation: `At least ${settings.minimum} ${settings.denominator} in each snapshot and a bucket-share difference of at least ${number.format(settings.absolute * 100)} percentage points. Each snapshot supplies its own denominator; only the largest qualifying bucket change is selected.`,
      distribution: {
        key: distribution.key,
        bucketKey: strongest.key,
        earlierCount: strongest.earlierCount,
        laterCount: strongest.laterCount,
        earlierTotal: distribution.earlierTotal,
        laterTotal: distribution.laterTotal,
      },
    },
    theme: settings.theme,
    strength: Math.min(8, (2 * Math.abs(delta)) / settings.absolute),
    priority,
  };
}

export function deriveConversationPulse(
  comparison: ChatVaultComparisonResult,
): ConversationPulse {
  if (!comparison.ok)
    return {
      items: [],
      emptyReason: "Conversation Pulse is unavailable for this snapshot pair.",
    };
  const candidates = [
    ...rules.map((rule, index) => scalarCandidate(comparison, rule, index)),
    ...comparison.distributions.map((distribution, index) =>
      distributionCandidate(distribution, rules.length + index),
    ),
  ].filter((candidate): candidate is Candidate => candidate !== null);
  candidates.sort(
    (left, right) =>
      right.strength - left.strength || left.priority - right.priority,
  );
  const themes = new Set<string>();
  const items: ConversationPulseItem[] = [];
  for (const candidate of candidates) {
    if (themes.has(candidate.theme)) continue;
    themes.add(candidate.theme);
    items.push(candidate.item);
    if (items.length === thresholds.items) break;
  }
  return {
    items,
    emptyReason: items.length
      ? null
      : "No aggregate differences meet the Conversation Pulse display rules. Smaller or unavailable differences can still appear in the comparison details.",
  };
}
