import type {
  WhatsAppAnalysis,
  WhatsAppCountBucket,
  WhatsAppDataset,
} from "./types";

export type WhatsAppStory = {
  id: string;
  name: string;
  label: string;
  title: string;
  lead: string;
  value: string;
  valueLabel: string;
  facts: { value: string; label: string }[];
  note: string;
  theme: "mint" | "forest" | "cream" | "lime";
  motif: "bubbles" | "rings" | "steps";
};

export const whatsappNumber = (value: number) =>
  new Intl.NumberFormat("en-GB").format(value);

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

/** Only counts, recorded dates and stable participant aliases enter share cards. */
export function buildWhatsAppStories(
  analysis: WhatsAppAnalysis,
  dataset: WhatsAppDataset,
): WhatsAppStory[] {
  if (!analysis.first || !analysis.latest || !analysis.totals.messages)
    return [];
  const total = analysis.totals;
  const aliases = new Map(
    dataset.participants.map((participant, index) => [
      participant.id,
      `Participant ${index + 1}`,
    ]),
  );
  const highestParticipantCount = analysis.participants.reduce(
    (highest, participant) => Math.max(highest, participant.messageCount),
    0,
  );
  const participants = analysis.participants.filter(
    (participant) => participant.messageCount === highestParticipantCount,
  );
  const days = whatsappPeaks(analysis.daily);
  const hours = whatsappPeaks(analysis.hours);
  const scope = "From the supplied export only. System events are excluded.";
  const stories: WhatsAppStory[] = [
    {
      id: "conversation",
      name: "The conversation",
      label: "YOUR CHAT, IN NUMBERS",
      title: "All those messages.",
      lead: "A little perspective on the conversation recorded in your export.",
      value: whatsappNumber(total.messages),
      valueLabel: "exported messages",
      facts: [
        {
          value: whatsappNumber(total.participants),
          label: "participant labels",
        },
        {
          value: whatsappNumber(total.activeDays),
          label: "days with messages",
        },
      ],
      note: scope,
      theme: "forest",
      motif: "bubbles",
    },
    {
      id: "first-date",
      name: "The first date",
      label: "THE FIRST RECORDED DATE",
      title: "This chapter starts here.",
      lead: "The earliest message date included in this export.",
      value: whatsappDate(analysis.first.date, true),
      valueLabel: "first recorded message date",
      facts: [
        {
          value: whatsappDate(analysis.latest.date, true),
          label: "latest recorded message date",
        },
        {
          value: whatsappNumber(analysis.calendarSpanDays),
          label: "calendar days covered",
        },
      ],
      note: "This may be a partial chat. A recorded date does not prove when the conversation began.",
      theme: "mint",
      motif: "rings",
    },
  ];

  if (days.length) {
    stories.push({
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
        {
          value: whatsappNumber(total.activeDays),
          label: "active dates in the export",
        },
        { value: whatsappNumber(days.length), label: "dates at the maximum" },
      ],
      note: scope,
      theme: "lime",
      motif: "steps",
    });
  }

  if (participants.length && highestParticipantCount) {
    const only = participants[0];
    stories.push({
      id: "participant-counts",
      name: "The contributors",
      label: "MESSAGES BY PARTICIPANT",
      title: "The counts behind the chat.",
      lead:
        participants.length === 1
          ? `${aliases.get(only.id) ?? "A participant"} has the highest exported message count.`
          : `${whatsappNumber(participants.length)} participants tie for the highest exported message count.`,
      value: whatsappNumber(highestParticipantCount),
      valueLabel:
        participants.length === 1
          ? "messages from that participant"
          : "messages from each tied participant",
      facts: [
        {
          value: whatsappNumber(total.participants),
          label: "participant labels in the export",
        },
        {
          value: whatsappNumber(participants.length),
          label: "participants at the maximum",
        },
      ],
      note: "Names use anonymous aliases in export order. Message counts do not describe relationships or personalities.",
      theme: "cream",
      motif: "bubbles",
    });
  }

  if (hours.length) {
    stories.push({
      id: "busiest-hour",
      name: "The hour",
      label: "RECORDED TIME OF DAY",
      title:
        hours.length === 1
          ? "An hour with a lot to say."
          : "A rhythm with a tie.",
      lead:
        hours.length === 1
          ? `${hours[0].label} is the most active recorded hour across all dates.`
          : `${whatsappNumber(hours.length)} hourly buckets share the highest recorded message count.`,
      value: whatsappNumber(hours[0].count),
      valueLabel:
        hours.length === 1
          ? "messages in that hourly bucket"
          : "messages in each tied hourly bucket",
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
      note: "Times are exactly as recorded in the export. No timezone is inferred.",
      theme: "forest",
      motif: "rings",
    });
  }

  if (analysis.longestStreak) {
    stories.push({
      id: "active-streak",
      name: "The streak",
      label: "CONSECUTIVE RECORDED DATES",
      title: "A message, day after day.",
      lead: "The longest run of consecutive calendar dates with at least one exported message.",
      value: whatsappNumber(analysis.longestStreak.days),
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
      note: "This is a date count from the export. Missing messages may change the result.",
      theme: "mint",
      motif: "steps",
    });
  }

  stories.push({
    id: "message-extras",
    name: "The extras",
    label: "WHAT THE TEXT EXPORT CONTAINS",
    title: "More than a message count.",
    lead: "Recognized media placeholders and link occurrences, without sharing their contents.",
    value: whatsappNumber(total.mediaMessages),
    valueLabel: "messages with recognized media placeholders",
    facts: [
      { value: whatsappNumber(total.links), label: "HTTP(S) link occurrences" },
      {
        value:
          total.emoji === null ? "Unavailable" : whatsappNumber(total.emoji),
        label: "supported emoji occurrences",
      },
    ],
    note: "Attachments are not inspected. Only supported text markers and emoji are counted; actual totals may differ.",
    theme: "cream",
    motif: "rings",
  });
  return stories;
}
