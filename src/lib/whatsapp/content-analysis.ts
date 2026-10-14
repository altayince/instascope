import type { WhatsAppContentAnalysis } from "./content-types";
import { analyzeWhatsAppMessagePatterns } from "./message-patterns";
import { analyzeWhatsAppText } from "./text-analysis";
import type {
  WhatsAppAnalysis,
  WhatsAppCountBucket,
  WhatsAppMediaKind,
  WhatsAppMessage,
  WhatsAppParticipant,
} from "./types";

const MEDIA_KINDS: readonly WhatsAppMediaKind[] = [
  "image",
  "video",
  "audio",
  "sticker",
  "gif",
  "document",
  "unspecified",
];
const MEDIA_LABELS: Record<WhatsAppMediaKind, string> = {
  image: "Images",
  video: "Videos",
  audio: "Audio / voice",
  sticker: "Stickers",
  gif: "GIFs",
  document: "Documents",
  unspecified: "Unspecified",
};

function mediaBuckets(
  counts: ReadonlyMap<string, number>,
): WhatsAppCountBucket[] {
  return MEDIA_KINDS.map((key) => ({
    key,
    label: MEDIA_LABELS[key],
    count: counts.get(key) ?? 0,
  }));
}

function emojiBuckets(
  counts: ReadonlyMap<string, number>,
): WhatsAppCountBucket[] {
  return [...counts]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        (left.key < right.key ? -1 : left.key > right.key ? 1 : 0),
    );
}

/**
 * Summarize the selected accepted messages. The filter layer's existing analysis
 * remains authoritative for source-wide emoji availability. No parsing, emoji
 * extraction, attachment inspection or storage occurs here.
 */
export function analyzeWhatsAppContent(
  messages: readonly WhatsAppMessage[],
  participants: readonly WhatsAppParticipant[],
  analysis: WhatsAppAnalysis,
  options: { comparisonAllowed?: boolean } = {},
): WhatsAppContentAnalysis {
  const available = analysis.totals.emoji !== null;
  const byParticipant = new Map<
    string,
    {
      media: Map<string, number>;
      emoji: Map<string, number>;
      mediaTotal: number;
      emojiTotal: number;
    }
  >();
  for (const message of messages) {
    let counts = byParticipant.get(message.participantId);
    if (!counts) {
      counts = {
        media: new Map(),
        emoji: new Map(),
        mediaTotal: 0,
        emojiTotal: 0,
      };
      byParticipant.set(message.participantId, counts);
    }
    if (message.media) {
      counts.media.set(
        message.media,
        (counts.media.get(message.media) ?? 0) + 1,
      );
      counts.mediaTotal++;
    }
    if (available) {
      for (const emoji of message.emoji ?? []) {
        counts.emoji.set(emoji, (counts.emoji.get(emoji) ?? 0) + 1);
        counts.emojiTotal++;
      }
    }
  }
  const selected = participants.filter((item) => byParticipant.has(item.id));
  return {
    patterns: analyzeWhatsAppMessagePatterns(messages, participants),
    text: analyzeWhatsAppText(messages, participants, options),
    media: {
      total: analysis.totals.mediaMessages,
      categories: mediaBuckets(
        new Map(analysis.media.map((item) => [item.key, item.count])),
      ),
      participants: selected.map(({ id, displayName }) => {
        const counts = byParticipant.get(id)!;
        return {
          id,
          displayName,
          total: counts.mediaTotal,
          categories: mediaBuckets(counts.media),
        };
      }),
    },
    emoji: {
      available,
      total: analysis.totals.emoji,
      items: available ? analysis.topEmoji.map((item) => ({ ...item })) : [],
      participants: selected.map(({ id, displayName }) => {
        const counts = byParticipant.get(id)!;
        return {
          id,
          displayName,
          total: available ? counts.emojiTotal : null,
          items: available ? emojiBuckets(counts.emoji) : [],
        };
      }),
    },
  };
}
