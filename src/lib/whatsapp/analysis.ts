import { calendarDayValue, wallClockValue } from "./timestamp";
import type {
  WhatsAppAnalysis,
  WhatsAppCountBucket,
  WhatsAppDataset,
  WhatsAppParticipantStats,
} from "./types";

const DAY = 86400000;
const compareKey = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;
const add = (counts: Map<string, number>, key: string) =>
  counts.set(key, (counts.get(key) ?? 0) + 1);
const buckets = (counts: Map<string, number>): WhatsAppCountBucket[] =>
  Array.from(counts, ([key, count]) => ({ key, label: key, count })).sort(
    (left, right) => compareKey(left.key, right.key),
  );
const busiest = (
  counts: readonly WhatsAppCountBucket[],
): WhatsAppCountBucket | null =>
  counts.reduce<WhatsAppCountBucket | null>(
    (best, item) => (item.count > (best?.count ?? 0) ? item : best),
    null,
  );

/** Pure message statistics. System events never inflate message activity or spans. */
export function analyzeWhatsApp(dataset: WhatsAppDataset): WhatsAppAnalysis {
  const yearlyCounts = new Map<string, number>(),
    monthlyCounts = new Map<string, number>(),
    dailyCounts = new Map<string, number>();
  const hourCounts = Array.from({ length: 24 }, () => 0),
    weekdayCounts = Array.from({ length: 7 }, () => 0);
  const mediaCounts = new Map<string, number>(),
    emojiCounts = new Map<string, number>();
  const ordered = dataset.messages
    .map((message) => ({
      message,
      value: wallClockValue(message.timestamp),
      day: calendarDayValue(message.timestamp),
    }))
    .sort(
      (left, right) =>
        left.value - right.value || left.message.id - right.message.id,
    );
  const emojiAvailable = dataset.messages.every(
    (message) => message.emoji !== null,
  );
  const participants: WhatsAppParticipantStats[] = dataset.participants.map(
    (participant) => ({
      ...participant,
      messageCount: 0,
      mediaMessages: 0,
      links: 0,
      messagesWithLinks: 0,
      emoji: emojiAvailable ? 0 : null,
      messagesWithEmoji: emojiAvailable ? 0 : null,
      first: null,
      latest: null,
    }),
  );
  const participantStats = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  const totals: WhatsAppAnalysis["totals"] = {
    messages: dataset.messages.length,
    systemEvents: dataset.systemEvents.length,
    participants: participants.length,
    mediaMessages: 0,
    links: 0,
    messagesWithLinks: 0,
    emoji: emojiAvailable ? 0 : null,
    messagesWithEmoji: emojiAvailable ? 0 : null,
    activeDays: 0,
  };
  let longestGap: WhatsAppAnalysis["longestGap"] = null;
  for (const [index, { message, value, day }] of ordered.entries()) {
    const timestamp = message.timestamp;
    add(yearlyCounts, String(timestamp.year));
    add(monthlyCounts, timestamp.date.slice(0, 7));
    add(dailyCounts, timestamp.date);
    hourCounts[timestamp.hour]++;
    weekdayCounts[(new Date(day).getUTCDay() + 6) % 7]++;
    const participant = participantStats.get(message.participantId);
    if (participant) {
      participant.messageCount++;
      participant.first ??= timestamp;
      participant.latest = timestamp;
    }
    if (message.media) {
      totals.mediaMessages++;
      if (participant) participant.mediaMessages++;
      add(mediaCounts, message.media);
    }
    totals.links += message.links.length;
    if (participant) participant.links += message.links.length;
    if (message.links.length) {
      totals.messagesWithLinks++;
      if (participant) participant.messagesWithLinks++;
    }
    if (emojiAvailable && message.emoji) {
      totals.emoji! += message.emoji.length;
      if (participant) participant.emoji! += message.emoji.length;
      if (message.emoji.length) {
        totals.messagesWithEmoji!++;
        if (participant) participant.messagesWithEmoji!++;
      }
      for (const emoji of message.emoji) add(emojiCounts, emoji);
    }
    if (index > 0) {
      const previous = ordered[index - 1];
      const seconds = (value - previous.value) / 1000;
      if (seconds > (longestGap?.wallClockSeconds ?? 0))
        longestGap = {
          from: previous.message.timestamp,
          to: timestamp,
          wallClockSeconds: seconds,
        };
    }
  }
  const yearly = buckets(yearlyCounts),
    monthly = buckets(monthlyCounts),
    daily = buckets(dailyCounts);
  const hours = hourCounts.map((count, hour) => ({
    key: String(hour).padStart(2, "0"),
    label: `${String(hour).padStart(2, "0")}:00`,
    count,
  }));
  const weekdays = weekdayCounts.map((count, day) => ({
    key: String(day),
    label: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ][day],
    count,
  }));
  totals.activeDays = daily.length;
  let longestStreak: WhatsAppAnalysis["longestStreak"] = null;
  let streakStart = "",
    streakDays = 0,
    previousDayValue = -Infinity;
  for (const bucket of daily) {
    // Already validated date fields; this arithmetic never uses the browser timezone.
    const [year, month, day] = bucket.key.split("-").map(Number),
      dayValue = Date.UTC(year, month - 1, day);
    if (dayValue !== previousDayValue + DAY) {
      streakStart = bucket.key;
      streakDays = 1;
    } else streakDays++;
    if (streakDays > (longestStreak?.days ?? 0))
      longestStreak = { from: streakStart, to: bucket.key, days: streakDays };
    previousDayValue = dayValue;
  }
  const first = ordered[0]?.message.timestamp ?? null,
    latest = ordered.at(-1)?.message.timestamp ?? null;
  return {
    totals,
    participants,
    first,
    latest,
    observedSpanSeconds: ordered.length
      ? (ordered.at(-1)!.value - ordered[0].value) / 1000
      : 0,
    calendarSpanDays:
      first && latest
        ? (calendarDayValue(latest) - calendarDayValue(first)) / DAY + 1
        : 0,
    yearly,
    monthly,
    daily,
    hours,
    weekdays,
    busiest: {
      year: busiest(yearly),
      month: busiest(monthly),
      day: busiest(daily),
      hour: busiest(hours),
      weekday: busiest(weekdays),
    },
    media: buckets(mediaCounts),
    topEmoji: buckets(emojiCounts).sort(
      (left, right) =>
        right.count - left.count || compareKey(left.key, right.key),
    ),
    longestGap,
    longestStreak,
  };
}
