import {
  validateChatVaultSnapshot,
  type ChatVaultSnapshot,
} from "./chat-vault";

export type ChatComparisonCompatibility = {
  status: "comparable" | "limited" | "not-comparable";
  reasons: { code: string; message: string }[];
};

export type ChatComparisonMetric = {
  key: string;
  label: string;
  group: "overview" | "activity" | "rhythm" | "patterns" | "media";
  unit: "count" | "seconds" | "days" | "characters" | "words" | "share";
  earlier: number | null;
  later: number | null;
  delta: number | null;
  /** A fraction, not percentage points. Unavailable for a zero base value. */
  relativeDelta: number | null;
  classification: "exact" | "derived" | "unavailable";
};

export type ChatComparisonBucket = {
  key: string;
  label: string;
  earlierCount: number;
  laterCount: number;
  /** Fractions of each snapshot's own declared denominator. */
  earlierShare: number | null;
  laterShare: number | null;
  deltaShare: number | null;
};

export type ChatComparisonDistribution = {
  key: "hours" | "weekdays" | "media" | "transitions";
  label: string;
  earlierTotal: number;
  laterTotal: number;
  buckets: ChatComparisonBucket[];
};

export type ChatVaultComparison = {
  ok: true;
  compatibility: ChatComparisonCompatibility;
  earlier: ChatVaultSnapshot;
  later: ChatVaultSnapshot;
  orderBasis: "coverage-end" | "saved-time" | "id-tie";
  reversed: boolean;
  metrics: ChatComparisonMetric[];
  distributions: ChatComparisonDistribution[];
  heatmap: ChatComparisonBucket[][];
};

export type ChatVaultComparisonResult =
  | ChatVaultComparison
  | { ok: false; compatibility: ChatComparisonCompatibility };

const ratio = (count: number, total: number): number | null =>
  total > 0 ? count / total : null;

function invalidPair(code: string, message: string): ChatVaultComparisonResult {
  return {
    ok: false,
    compatibility: { status: "not-comparable", reasons: [{ code, message }] },
  };
}

function contractIssue(
  value: unknown,
): { code: string; message: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {
      code: "invalid-snapshot",
      message: "Choose two readable Chat Vault snapshots.",
    };
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1)
    return {
      code: "unsupported-schema",
      message: "These snapshots need the supported Chat Vault V1 schema.",
    };
  if (candidate.definitionsVersion !== 1)
    return {
      code: "unsupported-definitions",
      message:
        "The metric definitions are unsupported or incompatible. Their aggregates cannot be compared safely.",
    };
  if (candidate.scope !== "full-export")
    return {
      code: "unsupported-scope",
      message: "Comparison requires full-export aggregate snapshots.",
    };
  return null;
}

function compatibility(
  earlier: ChatVaultSnapshot,
  later: ChatVaultSnapshot,
  orderBasis: ChatVaultComparison["orderBasis"],
): ChatComparisonCompatibility {
  const reasons: ChatComparisonCompatibility["reasons"] = [];
  const add = (code: string, message: string) =>
    reasons.push({ code, message });
  const first = earlier.coverage;
  const second = later.coverage;
  if (!first.fromDate || !first.toDate || !second.fromDate || !second.toDate)
    add(
      "coverage-unavailable",
      "At least one snapshot has no recorded participant-message dates. Save time or a stable ID tie-break orders the snapshots; available aggregate counts can still be compared.",
    );
  if (first.fromDate && second.fromDate && first.fromDate !== second.fromDate)
    add(
      "different-coverage-starts",
      "The exports start on different recorded dates. Counts describe different supplied coverage, not messages added between saves.",
    );
  if (first.toDate && first.toDate === second.toDate)
    add(
      first.fromDate === second.fromDate
        ? "equal-coverage"
        : "equal-coverage-end",
      "The recorded coverage ends on the same date. Save time orders the snapshots where distinct; equal dates do not establish identical included messages.",
    );
  if (first.toDate && second.fromDate && first.toDate < second.fromDate)
    add(
      "disjoint-coverage",
      "Recorded coverage does not overlap. These are separate full-export aggregates, not a continuous message history.",
    );
  if (
    first.sourceSupport === "partially-supported" ||
    second.sourceSupport === "partially-supported"
  )
    add(
      "partial-source-support",
      "At least one source was partially supported. Its saved counts cover only recognized supplied records and markers.",
    );
  if (
    first.precision !== second.precision ||
    first.precision === "mixed" ||
    second.precision === "mixed"
  )
    add(
      "timestamp-precision",
      "Timestamp precision differs or is mixed. Recorded-clock durations may reflect different source precision; no timezone is inferred.",
    );
  if (orderBasis === "coverage-end" && earlier.createdAt > later.createdAt)
    add(
      "save-coverage-order-conflict",
      "Coverage order differs from save-time order. Earlier and later follow recorded coverage end dates here.",
    );
  if (orderBasis === "id-tie")
    add(
      "save-time-tie",
      "Save times and coverage ends do not establish an order. Local snapshot IDs provide a stable display order only.",
    );
  return { status: reasons.length ? "limited" : "comparable", reasons };
}

function metric(
  key: string,
  label: string,
  group: ChatComparisonMetric["group"],
  unit: ChatComparisonMetric["unit"],
  earlier: number | null,
  later: number | null,
  classification: "exact" | "derived",
): ChatComparisonMetric {
  const delta = earlier === null || later === null ? null : later - earlier;
  return {
    key,
    label,
    group,
    unit,
    earlier,
    later,
    delta,
    relativeDelta:
      delta === null || earlier === null || earlier === 0
        ? null
        : delta / earlier,
    classification: delta === null ? "unavailable" : classification,
  };
}

function bucket(
  key: string,
  label: string,
  earlierCount: number,
  laterCount: number,
  earlierTotal: number,
  laterTotal: number,
): ChatComparisonBucket {
  const earlierShare = ratio(earlierCount, earlierTotal);
  const laterShare = ratio(laterCount, laterTotal);
  return {
    key,
    label,
    earlierCount,
    laterCount,
    earlierShare,
    laterShare,
    deltaShare:
      earlierShare === null || laterShare === null
        ? null
        : laterShare - earlierShare,
  };
}

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const media = [
  ["image", "Images"],
  ["video", "Videos"],
  ["audio", "Audio / voice"],
  ["sticker", "Stickers"],
  ["gif", "GIFs"],
  ["document", "Documents"],
  ["unspecified", "Unspecified media"],
] as const;
const transitions = [
  ["under-1m", "Under 1 minute"],
  ["1m-5m", "1 minute to under 5 minutes"],
  ["5m-30m", "5 minutes to under 30 minutes"],
  ["30m-6h", "30 minutes to under 6 hours"],
  ["6h-plus", "6 hours or more"],
] as const;

function compareMetrics(
  earlier: ChatVaultSnapshot,
  later: ChatVaultSnapshot,
): ChatComparisonMetric[] {
  const result: ChatComparisonMetric[] = [];
  const add = (
    key: string,
    label: string,
    group: ChatComparisonMetric["group"],
    unit: ChatComparisonMetric["unit"],
    values: (snapshot: ChatVaultSnapshot) => number | null,
    classification: "exact" | "derived",
  ) =>
    result.push(
      metric(
        key,
        label,
        group,
        unit,
        values(earlier),
        values(later),
        classification,
      ),
    );
  const overview = [
    ["messages", "Exported messages"],
    ["systemEvents", "Recorded system events"],
    ["participants", "Exported participant labels"],
    ["mediaMessages", "Recognized media messages"],
    ["links", "Link occurrences"],
    ["messagesWithLinks", "Messages containing links"],
    ["emoji", "Supported emoji occurrences"],
    ["messagesWithEmoji", "Messages containing supported emoji"],
    ["attributedCallEvents", "Sender-labelled call markers"],
    ["unattributedCallEvents", "Senderless call markers"],
  ] as const;
  for (const [key, label] of overview)
    add(
      `totals.${key}`,
      label,
      "overview",
      "count",
      (s) => s.totals[key],
      "exact",
    );
  add(
    "totals.activeDays",
    "Recorded active dates",
    "overview",
    "days",
    (s) => s.totals.activeDays,
    "exact",
  );
  add(
    "activity.calendarSpanDays",
    "Recorded calendar coverage",
    "overview",
    "days",
    (s) => s.activity.calendarSpanDays,
    "derived",
  );
  add(
    "activity.observedSpanSeconds",
    "Recorded wall-clock span",
    "activity",
    "seconds",
    (s) => s.activity.observedSpanSeconds,
    "derived",
  );
  add(
    "activity.longestGapSeconds",
    "Longest recorded message interval",
    "activity",
    "seconds",
    (s) => s.activity.longestGapSeconds,
    "derived",
  );
  add(
    "activity.longestStreakDays",
    "Longest active-date streak",
    "activity",
    "days",
    (s) => s.activity.longestStreakDays,
    "derived",
  );
  add(
    "activity.messagesPerActiveDate",
    "Messages per recorded active date",
    "activity",
    "count",
    (s) => ratio(s.totals.messages, s.totals.activeDays),
    "derived",
  );
  const rhythm = [
    ["sessionCount", "Recorded sessions", "count"],
    ["medianSessionMessages", "Median recorded session size", "count"],
    ["longestSessionMessages", "Largest recorded session", "count"],
    ["longestSessionSpanSeconds", "Longest recorded session span", "seconds"],
    ["longGapCount", "Recorded gaps of at least six hours", "count"],
    ["medianLongGapSeconds", "Median qualifying long gap", "seconds"],
    ["longestLongGapSeconds", "Longest qualifying long gap", "seconds"],
    ["transitionCount", "Adjacent participant-label changes", "count"],
    ["medianTransitionSeconds", "Median next-message clock delay", "seconds"],
    [
      "p25TransitionSeconds",
      "25th percentile next-message clock delay",
      "seconds",
    ],
    [
      "p75TransitionSeconds",
      "75th percentile next-message clock delay",
      "seconds",
    ],
    ["rapidTransitions", "Rapid participant-label transitions", "count"],
    [
      "equalTimestampTransitions",
      "Equal-clock participant-label transitions",
      "count",
    ],
  ] as const;
  for (const [key, label, unit] of rhythm)
    add(
      `rhythm.${key}`,
      label,
      "rhythm",
      unit,
      (s) => s.rhythm[key],
      "derived",
    );
  add(
    "rhythm.rapidTransitionShare",
    "Rapid share of observed transitions",
    "rhythm",
    "share",
    (s) => ratio(s.rhythm.rapidTransitions, s.rhythm.transitionCount),
    "derived",
  );
  add(
    "patterns.runs.count",
    "Recorded consecutive-message runs",
    "patterns",
    "count",
    (s) => s.patterns.runs.count,
    "derived",
  );
  add(
    "patterns.runs.medianLength",
    "Median recorded run length",
    "patterns",
    "count",
    (s) => s.patterns.runs.medianLength,
    "derived",
  );
  add(
    "patterns.runs.longest",
    "Longest recorded run",
    "patterns",
    "count",
    (s) => s.patterns.runs.longest,
    "derived",
  );
  add(
    "patterns.burst.maximum",
    "Highest recorded 10-minute message count",
    "patterns",
    "count",
    (s) => s.patterns.burst.maximum,
    "derived",
  );
  add(
    "patterns.questionMarks.messages",
    "Messages containing a literal question mark",
    "patterns",
    "count",
    (s) => s.patterns.questionMarks.messages,
    "exact",
  );
  add(
    "patterns.questionMarks.occurrences",
    "Literal question-mark occurrences",
    "patterns",
    "count",
    (s) => s.patterns.questionMarks.occurrences,
    "exact",
  );
  add(
    "patterns.questionMarks.share",
    "Share of messages containing a literal question mark",
    "patterns",
    "share",
    (s) => s.patterns.questionMarks.share,
    "derived",
  );
  add(
    "patterns.text.eligibleMessages",
    "Eligible ordinary-text messages",
    "patterns",
    "count",
    (s) => s.patterns.text.eligibleMessages,
    "derived",
  );
  for (const [summary, label, unit] of [
    ["length", "text length", "characters"],
    ["wordsPerMessage", "word units per text message", "words"],
  ] as const) {
    for (const [key, prefix] of [
      ["median", "Median"],
      ["p25", "25th percentile"],
      ["p75", "75th percentile"],
    ] as const)
      add(
        `patterns.text.${summary}.${key}`,
        `${prefix} ${label}`,
        "patterns",
        unit,
        (s) => s.patterns.text[summary][key],
        "derived",
      );
  }
  for (const [key, label] of media)
    add(`media.${key}`, label, "media", "count", (s) => s.media[key], "exact");
  add(
    "totals.mediaMessageShare",
    "Recognized media share of messages",
    "media",
    "share",
    (s) => ratio(s.totals.mediaMessages, s.totals.messages),
    "derived",
  );
  return result;
}

function compareDistributions(
  earlier: ChatVaultSnapshot,
  later: ChatVaultSnapshot,
): ChatComparisonDistribution[] {
  return [
    {
      key: "hours",
      label: "Hourly activity shares",
      earlierTotal: earlier.totals.messages,
      laterTotal: later.totals.messages,
      buckets: earlier.activity.hours.map((count, hour) => {
        const key = String(hour).padStart(2, "0");
        return bucket(
          key,
          `${key}:00`,
          count,
          later.activity.hours[hour],
          earlier.totals.messages,
          later.totals.messages,
        );
      }),
    },
    {
      key: "weekdays",
      label: "Weekday activity shares",
      earlierTotal: earlier.totals.messages,
      laterTotal: later.totals.messages,
      buckets: weekdays.map((label, day) =>
        bucket(
          String(day),
          label,
          earlier.activity.weekdays[day],
          later.activity.weekdays[day],
          earlier.totals.messages,
          later.totals.messages,
        ),
      ),
    },
    {
      key: "media",
      label: "Recognized media mix",
      earlierTotal: earlier.totals.mediaMessages,
      laterTotal: later.totals.mediaMessages,
      buckets: media.map(([key, label]) =>
        bucket(
          key,
          label,
          earlier.media[key],
          later.media[key],
          earlier.totals.mediaMessages,
          later.totals.mediaMessages,
        ),
      ),
    },
    {
      key: "transitions",
      label: "Transition delay shares",
      earlierTotal: earlier.rhythm.transitionCount,
      laterTotal: later.rhythm.transitionCount,
      buckets: transitions.map(([key, label], index) =>
        bucket(
          key,
          label,
          earlier.rhythm.transitionDelayBuckets[index],
          later.rhythm.transitionDelayBuckets[index],
          earlier.rhythm.transitionCount,
          later.rhythm.transitionCount,
        ),
      ),
    },
  ];
}

/** Compare saved full-export aggregates only; no message membership is inferred. */
export function compareChatVaultSnapshots(
  first: unknown,
  second: unknown,
): ChatVaultComparisonResult {
  const issue = contractIssue(first) ?? contractIssue(second);
  if (issue) return invalidPair(issue.code, issue.message);
  const left = validateChatVaultSnapshot(first);
  const right = validateChatVaultSnapshot(second);
  if (!left || !right)
    return invalidPair(
      "invalid-snapshot",
      "A snapshot has invalid coverage or aggregate data. Choose two readable Chat Vault V1 snapshots.",
    );
  if (left.id === right.id)
    return invalidPair(
      "same-snapshot",
      "Choose two different saved snapshots.",
    );
  let order: number;
  let orderBasis: ChatVaultComparison["orderBasis"];
  if (
    left.coverage.toDate &&
    right.coverage.toDate &&
    left.coverage.toDate !== right.coverage.toDate
  ) {
    order = left.coverage.toDate < right.coverage.toDate ? -1 : 1;
    orderBasis = "coverage-end";
  } else if (left.createdAt !== right.createdAt) {
    order = left.createdAt - right.createdAt;
    orderBasis = "saved-time";
  } else {
    order = left.id < right.id ? -1 : 1;
    orderBasis = "id-tie";
  }
  const earlier = order < 0 ? left : right;
  const later = order < 0 ? right : left;
  return {
    ok: true,
    compatibility: compatibility(earlier, later, orderBasis),
    earlier,
    later,
    orderBasis,
    reversed: order > 0,
    metrics: compareMetrics(earlier, later),
    distributions: compareDistributions(earlier, later),
    heatmap: weekdays.map((label, day) =>
      earlier.activity.heatmap[day].map((count, hour) =>
        bucket(
          `${day}-${String(hour).padStart(2, "0")}`,
          `${label}, ${String(hour).padStart(2, "0")}:00`,
          count,
          later.activity.heatmap[day][hour],
          earlier.totals.messages,
          later.totals.messages,
        ),
      ),
    ),
  };
}
