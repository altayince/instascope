import { analyzeFilteredWhatsApp, DEFAULT_WHATSAPP_FILTERS } from "./filters";
import { WHATSAPP_LIMITS } from "./limits";
import { SILENCE_BREAK_HOURS } from "./rhythm";
import type { WhatsAppDataset } from "./types";

export const MAX_CHAT_VAULT_BACKUP_BYTES = 2 * 1024 * 1024;
export const MAX_CHAT_VAULT_SNAPSHOTS = 100;

/** Controlled product copy only; never construct this from source content. */
export class ChatVaultValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatVaultValidationError";
  }
}

type NumericSummary = {
  count: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
};

/** Only named aggregates cross this boundary. No participant mapping is retained. */
export type ChatVaultSnapshot = {
  version: 1;
  definitionsVersion: 1;
  id: string;
  createdAt: number;
  scope: "full-export";
  coverage: {
    fromDate: string | null;
    toDate: string | null;
    precision: "minute" | "second" | "mixed";
    sourceSupport: "supported" | "partially-supported";
  };
  totals: {
    messages: number;
    systemEvents: number;
    participants: number;
    activeDays: number;
    mediaMessages: number;
    links: number;
    messagesWithLinks: number;
    emoji: number | null;
    messagesWithEmoji: number | null;
    attributedCallEvents: number;
    unattributedCallEvents: number;
  };
  activity: {
    calendarSpanDays: number;
    observedSpanSeconds: number | null;
    longestGapSeconds: number | null;
    longestStreakDays: number | null;
    hours: number[];
    weekdays: number[];
    heatmap: number[][];
  };
  rhythm: {
    sessionCount: number;
    medianSessionMessages: number | null;
    longestSessionMessages: number | null;
    longestSessionSpanSeconds: number | null;
    longGapCount: number;
    medianLongGapSeconds: number | null;
    longestLongGapSeconds: number | null;
    transitionCount: number;
    medianTransitionSeconds: number | null;
    p25TransitionSeconds: number | null;
    p75TransitionSeconds: number | null;
    transitionDelayBuckets: number[];
    rapidTransitions: number;
    equalTimestampTransitions: number;
  };
  media: {
    image: number;
    video: number;
    audio: number;
    sticker: number;
    gif: number;
    document: number;
    unspecified: number;
  };
  patterns: {
    runs: {
      count: number;
      medianLength: number | null;
      longest: number | null;
      distribution: number[];
    };
    burst: { maximum: number; tiedWindows: number };
    questionMarks: {
      messages: number;
      occurrences: number;
      share: number | null;
    };
    text: {
      eligibleMessages: number;
      eligibleWords: number;
      length: NumericSummary;
      wordsPerMessage: NumericSummary;
    };
  };
};

export type ChatVaultBackup = {
  format: "whatsapp-chat-vault";
  version: 1;
  snapshots: ChatVaultSnapshot[];
};

const INVALID = Symbol("invalid-chat-vault-value");
type Reader = (value: unknown) => unknown | typeof INVALID;
const invalidMessage = "Choose a valid Chat Vault V1 aggregate backup.";
const count: Reader = (value) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= WHATSAPP_LIMITS.textBytes
    ? value
    : INVALID;
const measure: Reader = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 315569520000
    ? value
    : INVALID;
const nullable =
  (reader: Reader): Reader =>
  (value) =>
    value === null ? null : reader(value);
const choice =
  (values: readonly unknown[]): Reader =>
  (value) =>
    values.includes(value) ? value : INVALID;
const fixedArray =
  (length: number, reader: Reader): Reader =>
  (value) => {
    if (
      !Array.isArray(value) ||
      value.length !== length ||
      Object.keys(value).length !== length
    )
      return INVALID;
    const output: unknown[] = [];
    for (let index = 0; index < length; index++) {
      if (!Object.hasOwn(value, index)) return INVALID;
      const item = reader(value[index]);
      if (item === INVALID) return INVALID;
      output.push(item);
    }
    return output;
  };
/** Reconstruct in declared field order; reject unknown fields at every level. */
const object =
  (shape: Record<string, Reader>): Reader =>
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return INVALID;
    const keys = Object.keys(shape);
    if (
      Reflect.ownKeys(value).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(value, key))
    )
      return INVALID;
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      const item = shape[key]((value as Record<string, unknown>)[key]);
      if (item === INVALID) return INVALID;
      output[key] = item;
    }
    return output;
  };
const date: Reader = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return INVALID;
  const [year, month, day] = value.split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return year >= 1000 &&
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day
    ? value
    : INVALID;
};
const summary = object({
  count,
  median: nullable(measure),
  p25: nullable(measure),
  p75: nullable(measure),
});
const snapshotReader = object({
  version: choice([1]),
  definitionsVersion: choice([1]),
  id: (value) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value,
    )
      ? value
      : INVALID,
  createdAt: (value) =>
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 253402300799999
      ? value
      : INVALID,
  scope: choice(["full-export"]),
  coverage: object({
    fromDate: nullable(date),
    toDate: nullable(date),
    precision: choice(["minute", "second", "mixed"]),
    sourceSupport: choice(["supported", "partially-supported"]),
  }),
  totals: object({
    messages: count,
    systemEvents: count,
    participants: count,
    activeDays: count,
    mediaMessages: count,
    links: count,
    messagesWithLinks: count,
    emoji: nullable(count),
    messagesWithEmoji: nullable(count),
    attributedCallEvents: count,
    unattributedCallEvents: count,
  }),
  activity: object({
    calendarSpanDays: count,
    observedSpanSeconds: nullable(measure),
    longestGapSeconds: nullable(measure),
    longestStreakDays: nullable(count),
    hours: fixedArray(24, count),
    weekdays: fixedArray(7, count),
    heatmap: fixedArray(7, fixedArray(24, count)),
  }),
  rhythm: object({
    sessionCount: count,
    medianSessionMessages: nullable(measure),
    longestSessionMessages: nullable(count),
    longestSessionSpanSeconds: nullable(measure),
    longGapCount: count,
    medianLongGapSeconds: nullable(measure),
    longestLongGapSeconds: nullable(measure),
    transitionCount: count,
    medianTransitionSeconds: nullable(measure),
    p25TransitionSeconds: nullable(measure),
    p75TransitionSeconds: nullable(measure),
    transitionDelayBuckets: fixedArray(5, count),
    rapidTransitions: count,
    equalTimestampTransitions: count,
  }),
  media: object({
    image: count,
    video: count,
    audio: count,
    sticker: count,
    gif: count,
    document: count,
    unspecified: count,
  }),
  patterns: object({
    runs: object({
      count,
      medianLength: nullable(measure),
      longest: nullable(count),
      distribution: fixedArray(5, count),
    }),
    burst: object({ maximum: count, tiedWindows: count }),
    questionMarks: object({
      messages: count,
      occurrences: count,
      share: nullable((value) =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1
          ? value
          : INVALID,
      ),
    }),
    text: object({
      eligibleMessages: count,
      eligibleWords: count,
      length: summary,
      wordsPerMessage: summary,
    }),
  }),
});

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);
const validSummary = (value: NumericSummary) =>
  value.count === 0
    ? value.median === null && value.p25 === null && value.p75 === null
    : value.median !== null &&
      value.p25 !== null &&
      value.p75 !== null &&
      value.p25 <= value.median &&
      value.median <= value.p75;
const availableWhen = (count: number, values: (number | null)[]) =>
  count === 0
    ? values.every((value) => value === null)
    : values.every((value) => value !== null);

/** Strict validation also returns a new, canonically ordered aggregate object. */
export function validateChatVaultSnapshot(
  value: unknown,
): ChatVaultSnapshot | null {
  const read = snapshotReader(value);
  if (read === INVALID) return null;
  const snapshot = read as ChatVaultSnapshot;
  const { totals, coverage, activity, rhythm, patterns } = snapshot;
  if (
    totals.messages + totals.systemEvents > WHATSAPP_LIMITS.records ||
    totals.participants > WHATSAPP_LIMITS.participants ||
    totals.participants > totals.messages ||
    totals.activeDays > totals.messages ||
    totals.activeDays > activity.calendarSpanDays ||
    totals.mediaMessages > totals.messages ||
    totals.messagesWithLinks > totals.messages ||
    totals.messagesWithLinks > totals.links ||
    totals.attributedCallEvents > totals.messages ||
    totals.unattributedCallEvents > totals.systemEvents ||
    (totals.emoji === null) !== (totals.messagesWithEmoji === null) ||
    (totals.messagesWithEmoji !== null &&
      (totals.messagesWithEmoji > totals.messages ||
        totals.messagesWithEmoji > totals.emoji!)) ||
    sum(activity.hours) !== totals.messages ||
    sum(activity.weekdays) !== totals.messages ||
    activity.heatmap.some(
      (row, index) => sum(row) !== activity.weekdays[index],
    ) ||
    activity.hours.some(
      (value, hour) => sum(activity.heatmap.map((row) => row[hour])) !== value,
    ) ||
    sum(Object.values(snapshot.media)) !== totals.mediaMessages ||
    rhythm.sessionCount > totals.messages ||
    rhythm.longGapCount > Math.max(0, totals.messages - 1) ||
    rhythm.transitionCount > Math.max(0, totals.messages - 1) ||
    sum(rhythm.transitionDelayBuckets) !== rhythm.transitionCount ||
    rhythm.rapidTransitions > rhythm.transitionCount ||
    rhythm.equalTimestampTransitions > rhythm.transitionCount ||
    !availableWhen(rhythm.sessionCount, [
      rhythm.medianSessionMessages,
      rhythm.longestSessionMessages,
      rhythm.longestSessionSpanSeconds,
    ]) ||
    (rhythm.longestSessionMessages !== null &&
      (rhythm.longestSessionMessages < 1 ||
        rhythm.longestSessionMessages > totals.messages ||
        rhythm.medianSessionMessages! > rhythm.longestSessionMessages)) ||
    !availableWhen(rhythm.longGapCount, [
      rhythm.medianLongGapSeconds,
      rhythm.longestLongGapSeconds,
    ]) ||
    (rhythm.longestLongGapSeconds !== null &&
      (rhythm.medianLongGapSeconds! > rhythm.longestLongGapSeconds ||
        rhythm.medianLongGapSeconds! < SILENCE_BREAK_HOURS * 60 * 60)) ||
    !availableWhen(rhythm.transitionCount, [
      rhythm.medianTransitionSeconds,
      rhythm.p25TransitionSeconds,
      rhythm.p75TransitionSeconds,
    ]) ||
    (rhythm.transitionCount > 0 &&
      (rhythm.p25TransitionSeconds! > rhythm.medianTransitionSeconds! ||
        rhythm.medianTransitionSeconds! > rhythm.p75TransitionSeconds!)) ||
    patterns.runs.count > totals.messages ||
    sum(patterns.runs.distribution) !== patterns.runs.count ||
    !availableWhen(patterns.runs.count, [
      patterns.runs.medianLength,
      patterns.runs.longest,
    ]) ||
    (patterns.runs.longest !== null &&
      (patterns.runs.longest < 1 ||
        patterns.runs.longest > totals.messages ||
        patterns.runs.medianLength! > patterns.runs.longest)) ||
    patterns.burst.maximum > totals.messages ||
    patterns.burst.tiedWindows > totals.messages ||
    patterns.questionMarks.messages > totals.messages ||
    patterns.questionMarks.messages > patterns.questionMarks.occurrences ||
    patterns.questionMarks.share !==
      (totals.messages === 0
        ? null
        : patterns.questionMarks.messages / totals.messages) ||
    patterns.text.eligibleMessages > totals.messages ||
    patterns.text.length.count !== patterns.text.eligibleMessages ||
    patterns.text.wordsPerMessage.count !== patterns.text.eligibleMessages ||
    !validSummary(patterns.text.length) ||
    !validSummary(patterns.text.wordsPerMessage) ||
    (patterns.text.length.p75 !== null &&
      patterns.text.length.p75 > WHATSAPP_LIMITS.textBytes) ||
    (patterns.text.wordsPerMessage.p75 !== null &&
      patterns.text.wordsPerMessage.p75 > WHATSAPP_LIMITS.textBytes)
  )
    return null;
  if (totals.messages === 0) {
    if (
      coverage.fromDate !== null ||
      coverage.toDate !== null ||
      activity.observedSpanSeconds !== null ||
      activity.longestGapSeconds !== null ||
      activity.longestStreakDays !== null ||
      activity.calendarSpanDays !== 0 ||
      totals.links !== 0 ||
      (totals.emoji !== null && totals.emoji !== 0) ||
      patterns.questionMarks.occurrences !== 0 ||
      patterns.text.eligibleWords !== 0
    )
      return null;
  } else if (
    coverage.fromDate === null ||
    coverage.toDate === null ||
    coverage.fromDate > coverage.toDate ||
    activity.observedSpanSeconds === null ||
    activity.longestStreakDays === null ||
    activity.longestStreakDays < 1 ||
    activity.longestStreakDays > totals.activeDays ||
    totals.participants < 1 ||
    rhythm.sessionCount < 1 ||
    patterns.runs.count < 1 ||
    patterns.burst.maximum < 1 ||
    patterns.burst.tiedWindows < 1
  )
    return null;
  if (coverage.fromDate !== null && coverage.toDate !== null) {
    // UTC is only a timezone-independent way to compare recorded calendar dates.
    const calendarDay = (date: string) => {
      const [year, month, day] = date.split("-").map(Number);
      return Date.UTC(year, month - 1, day) / 86400000;
    };
    if (
      activity.calendarSpanDays !==
        calendarDay(coverage.toDate) - calendarDay(coverage.fromDate) + 1 ||
      activity.observedSpanSeconds! >= activity.calendarSpanDays * 86400
    )
      return null;
    const durations = [
      activity.longestGapSeconds,
      rhythm.longestSessionSpanSeconds,
      rhythm.medianLongGapSeconds,
      rhythm.longestLongGapSeconds,
      rhythm.medianTransitionSeconds,
      rhythm.p25TransitionSeconds,
      rhythm.p75TransitionSeconds,
    ];
    if (
      durations.some(
        (duration) =>
          duration !== null && duration > activity.observedSpanSeconds!,
      )
    )
      return null;
  }
  return snapshot;
}

/** Reuse the full-source Analyzer; never serialize its identity/content objects. */
export function createChatVaultSnapshot(
  dataset: WhatsAppDataset,
  options: { id?: string; createdAt?: number } = {},
): ChatVaultSnapshot {
  if (dataset.metadata.source === "demo")
    throw new ChatVaultValidationError(
      "Fictional demo data cannot be saved to Chat Vault.",
    );
  const result = analyzeFilteredWhatsApp(dataset, DEFAULT_WHATSAPP_FILTERS);
  if (!result.ok || !result.rhythm.available)
    throw new ChatVaultValidationError(
      "The full chat analysis is unavailable.",
    );
  const { analysis, content, overview } = result;
  const rhythm = result.rhythm.analysis;
  const patterns = content.patterns;
  const numericSummary = (value: NumericSummary): NumericSummary => ({
    count: value.count,
    median: value.median,
    p25: value.p25,
    p75: value.p75,
  });
  const mediaCount = (key: keyof ChatVaultSnapshot["media"]) =>
    content.media.categories.find((item) => item.key === key)?.count ?? 0;
  const snapshot = validateChatVaultSnapshot({
    version: 1,
    definitionsVersion: 1,
    id: options.id ?? crypto.randomUUID(),
    createdAt: options.createdAt ?? Date.now(),
    scope: "full-export",
    coverage: {
      fromDate: analysis.first?.date ?? null,
      toDate: analysis.latest?.date ?? null,
      precision: dataset.metadata.timestampPrecision,
      sourceSupport: dataset.metadata.doctor.status,
    },
    totals: {
      messages: analysis.totals.messages,
      systemEvents: analysis.totals.systemEvents,
      participants: analysis.totals.participants,
      activeDays: analysis.totals.activeDays,
      mediaMessages: analysis.totals.mediaMessages,
      links: analysis.totals.links,
      messagesWithLinks: analysis.totals.messagesWithLinks,
      emoji: analysis.totals.emoji,
      messagesWithEmoji: analysis.totals.messagesWithEmoji,
      attributedCallEvents: overview.attributedCallEvents,
      unattributedCallEvents: overview.unattributedCallEvents,
    },
    activity: {
      calendarSpanDays: analysis.calendarSpanDays,
      observedSpanSeconds: analysis.first ? analysis.observedSpanSeconds : null,
      longestGapSeconds: analysis.longestGap?.wallClockSeconds ?? null,
      longestStreakDays: analysis.longestStreak?.days ?? null,
      hours: analysis.hours.map((bucket) => bucket.count),
      weekdays: analysis.weekdays.map((bucket) => bucket.count),
      heatmap: result.heatmap.map((row) => row.map((value) => value)),
    },
    rhythm: {
      sessionCount: rhythm.sessionSummary.total,
      medianSessionMessages: rhythm.sessionSummary.medianMessages,
      longestSessionMessages:
        rhythm.sessionSummary.longestByMessages?.messageCount ?? null,
      longestSessionSpanSeconds:
        rhythm.sessionSummary.longestBySpan?.spanSeconds ?? null,
      longGapCount: rhythm.silenceSummary.total,
      medianLongGapSeconds: rhythm.silenceSummary.medianGapSeconds,
      longestLongGapSeconds: rhythm.silenceSummary.longestGapSeconds,
      transitionCount: rhythm.timing.count,
      medianTransitionSeconds: rhythm.timing.medianSeconds,
      p25TransitionSeconds: rhythm.timing.p25Seconds,
      p75TransitionSeconds: rhythm.timing.p75Seconds,
      transitionDelayBuckets: rhythm.timing.buckets.map(
        (bucket) => bucket.count,
      ),
      rapidTransitions: rhythm.rapidTransitions,
      equalTimestampTransitions: rhythm.equalTimestampTransitions,
    },
    media: {
      image: mediaCount("image"),
      video: mediaCount("video"),
      audio: mediaCount("audio"),
      sticker: mediaCount("sticker"),
      gif: mediaCount("gif"),
      document: mediaCount("document"),
      unspecified: mediaCount("unspecified"),
    },
    patterns: {
      runs: {
        count: patterns.runs.total,
        medianLength: patterns.runs.medianLength,
        longest: patterns.runs.longest,
        distribution: patterns.runs.distribution.map((bucket) => bucket.count),
      },
      burst: {
        maximum: patterns.burst.maximum,
        tiedWindows: patterns.burst.tiedWindows,
      },
      questionMarks: {
        messages: patterns.questionMarks.messages,
        occurrences: patterns.questionMarks.occurrences,
        share: patterns.questionMarks.share,
      },
      text: {
        eligibleMessages: content.text.eligibleTextMessages,
        eligibleWords: content.text.eligibleWords,
        length: numericSummary(content.text.length),
        wordsPerMessage: numericSummary(content.text.wordsPerMessage),
      },
    },
  });
  if (!snapshot)
    throw new ChatVaultValidationError(
      "This chat analysis cannot be saved safely.",
    );
  return snapshot;
}

export function newestChatVaultSnapshots(
  snapshots: readonly ChatVaultSnapshot[],
): ChatVaultSnapshot[] {
  return [...snapshots].sort(
    (left, right) =>
      right.createdAt - left.createdAt ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
}

export function validateChatVaultBackup(
  value: unknown,
): ChatVaultBackup | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Reflect.ownKeys(value).length !== 3 ||
    !["format", "version", "snapshots"].every((key) =>
      Object.hasOwn(value, key),
    )
  )
    return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.format !== "whatsapp-chat-vault" ||
    candidate.version !== 1 ||
    !Array.isArray(candidate.snapshots) ||
    candidate.snapshots.length > MAX_CHAT_VAULT_SNAPSHOTS ||
    Object.keys(candidate.snapshots).length !== candidate.snapshots.length
  )
    return null;
  const ids = new Set<string>();
  const snapshots: ChatVaultSnapshot[] = [];
  for (const value of candidate.snapshots) {
    const snapshot = validateChatVaultSnapshot(value);
    if (!snapshot || ids.has(snapshot.id)) return null;
    ids.add(snapshot.id);
    snapshots.push(snapshot);
  }
  return {
    format: "whatsapp-chat-vault",
    version: 1,
    snapshots: newestChatVaultSnapshots(snapshots),
  };
}

export function parseChatVaultBackup(raw: string): ChatVaultBackup {
  if (
    raw.length > MAX_CHAT_VAULT_BACKUP_BYTES ||
    new TextEncoder().encode(raw).byteLength > MAX_CHAT_VAULT_BACKUP_BYTES
  )
    throw new ChatVaultValidationError(
      "Chat Vault backups must be 2 MB or smaller.",
    );
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ChatVaultValidationError(invalidMessage);
  }
  const backup = validateChatVaultBackup(value);
  if (!backup) throw new ChatVaultValidationError(invalidMessage);
  return backup;
}

export function serializeChatVaultBackup(
  snapshots: readonly ChatVaultSnapshot[],
): string {
  const backup = validateChatVaultBackup({
    format: "whatsapp-chat-vault",
    version: 1,
    snapshots,
  });
  if (!backup) throw new ChatVaultValidationError(invalidMessage);
  const raw = JSON.stringify(backup);
  if (new TextEncoder().encode(raw).byteLength > MAX_CHAT_VAULT_BACKUP_BYTES)
    throw new ChatVaultValidationError(
      "Chat Vault backups must be 2 MB or smaller.",
    );
  return raw;
}

/** Preview is read-only. Confirmation must recheck storage's current IDs. */
export function previewChatVaultImport(
  backup: ChatVaultBackup,
  existing: readonly Pick<ChatVaultSnapshot, "id">[],
): { incoming: number; added: number; duplicates: number } {
  const valid = validateChatVaultBackup(backup);
  if (!valid) throw new ChatVaultValidationError(invalidMessage);
  const ids = new Set(existing.map((snapshot) => snapshot.id));
  const duplicates = valid.snapshots.filter((snapshot) =>
    ids.has(snapshot.id),
  ).length;
  return {
    incoming: valid.snapshots.length,
    added: valid.snapshots.length - duplicates,
    duplicates,
  };
}
