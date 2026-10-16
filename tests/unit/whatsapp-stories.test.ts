import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeWhatsApp,
  createWhatsAppDemo,
  parseWhatsApp,
} from "../../src/lib/whatsapp";
import * as patternsEngine from "../../src/lib/whatsapp/message-patterns";
import * as rhythmEngine from "../../src/lib/whatsapp/rhythm";
import {
  buildWhatsAppStories,
  WHATSAPP_STORY_EVIDENCE,
  WHATSAPP_STORY_LIMITS,
  whatsappDate,
  whatsappNumber,
  whatsappPeaks,
} from "../../src/lib/whatsapp/stories";
import type { WhatsAppStory } from "../../src/lib/whatsapp/story-types";
import * as textEngine from "../../src/lib/whatsapp/text-analysis";
import type { WhatsAppDataset } from "../../src/lib/whatsapp/types";

// All labels, bodies, dates and links below are invented for these tests.
const fixture = (...lines: string[]) =>
  parseWhatsApp(lines.join("\n"), "ymd-24h");
const build = (dataset: WhatsAppDataset, includeWords = false) =>
  buildWhatsAppStories(analyzeWhatsApp(dataset), dataset, { includeWords });
const ids = (stories: WhatsAppStory[]) => stories.map((story) => story.id);
const richIds = [
  "conversation",
  "participant-counts",
  "busiest-day",
  "busiest-hour",
  "active-streak",
  "sessions",
  "session-starters",
  "silence-breakers",
  "next-message",
  "message-patterns",
  "media-emoji",
  "closing",
];

function sequence(
  gaps: readonly number[],
  senders?: readonly string[],
  bodies?: readonly string[],
) {
  let clock = Date.UTC(2025, 0, 1, 9);
  return fixture(
    ...Array.from({ length: gaps.length + 1 }, (_, index) => {
      if (index) clock += gaps[index - 1] * 1000;
      const timestamp = new Date(clock)
        .toISOString()
        .slice(0, 19)
        .replace("T", ", ");
      return `${timestamp} - ${senders?.[index] ?? (index % 2 ? "Fictional Alpha" : "Fictional Zeta")}: ${bodies?.[index] ?? `Synthetic message ${index}`}`;
    }),
  );
}

function rich(participants = 2) {
  const lines: string[] = [];
  for (let date = 1; date <= 4; date++) {
    for (let session = 0; session < 2; session++) {
      for (let message = 0; message < 5; message++) {
        const sender = `Fictional Sender ${((date + session + message) % participants) + 1}`;
        const body =
          message === 4
            ? "image omitted"
            : "orchard cobalt lantern pebble willow zenith pastel honey 🌿";
        lines.push(
          `2025-01-0${date}, ${session ? "18" : "09"}:${String(message * 2).padStart(2, "0")}:00 - ${sender}: ${body}`,
        );
      }
    }
  }
  return fixture(...lines);
}

function card<K extends WhatsAppStory["kind"]>(
  stories: WhatsAppStory[],
  id: string,
  kind: K,
): WhatsAppStory & { kind: K } {
  const found = stories.find((story) => story.id === id);
  expect(found?.kind).toBe(kind);
  return found as WhatsAppStory & { kind: K };
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
}

afterEach(() => vi.restoreAllMocks());

describe("WhatsApp Wrapped V2 deck selection", () => {
  it("creates the complete 12-card pair deck with split comparisons", () => {
    const stories = build(rich());
    expect(ids(stories)).toEqual(richIds);
    expect(stories.every((story) => story.mode === "pair")).toBe(true);
    for (const id of [
      "participant-counts",
      "session-starters",
      "silence-breakers",
    ]) {
      const split = card(stories, id, "split");
      expect(split.data.entries.map((entry) => entry.label)).toEqual([
        "Participant 1",
        "Participant 2",
      ]);
      expect(split.data.hiddenParticipants).toBe(0);
      expect(
        split.data.entries.reduce((sum, entry) => sum + entry.share!, 0),
      ).toBeCloseTo(1);
    }
    expect(card(stories, "closing", "closing").data.cardCount).toBe(12);
  });

  it("adapts the complete group deck to bounded rankings", () => {
    const stories = build(rich(6));
    expect(ids(stories)).toEqual(richIds);
    expect(stories.every((story) => story.mode === "group")).toBe(true);
    for (const id of [
      "participant-counts",
      "session-starters",
      "silence-breakers",
    ]) {
      const ranking = card(stories, id, "ranking");
      expect(ranking.data.entries).toHaveLength(4);
      expect(ranking.data.hiddenParticipants).toBe(2);
      expect(ranking.data.entries.map((entry) => entry.value)).toEqual(
        ranking.data.entries
          .map((entry) => entry.value)
          .sort((left, right) => right - left),
      );
    }
    expect(
      card(stories, "next-message", "rhythm").data.entries.length,
    ).toBeLessThanOrEqual(4);
  });

  it("keeps useful solo aggregates while skipping participant comparisons", () => {
    const stories = build(rich(1));
    expect(stories.every((story) => story.mode === "solo")).toBe(true);
    expect(ids(stories)).toContain("sessions");
    expect(ids(stories)).toContain("message-patterns");
    for (const id of [
      "participant-counts",
      "session-starters",
      "silence-breakers",
      "next-message",
    ]) {
      expect(ids(stories)).not.toContain(id);
    }
  });

  it("skips weak cards for a single message and shares only recorded dates", () => {
    const stories = build(
      fixture("2025-03-13, 09:17:42 - Fictional Sender: PRIVATE_FIRST_MESSAGE"),
    );
    expect(ids(stories)).toEqual(["conversation", "closing"]);
    const opening = card(stories, "conversation", "hero");
    expect(opening.data).toEqual({
      activeDates: 1,
      calendarSpanDays: 1,
      firstDate: "13 Mar 2025",
      lastDate: "13 Mar 2025",
    });
    expect(opening.note).toContain("partial chat");
    expect(JSON.stringify(stories)).not.toContain("PRIVATE_FIRST_MESSAGE");
    expect(JSON.stringify(stories)).not.toContain("09:17");
  });

  it("returns no cards for an empty accepted source even with stale analysis", () => {
    const source = rich();
    expect(
      buildWhatsAppStories(analyzeWhatsApp(source), {
        ...source,
        messages: [],
      }),
    ).toEqual([]);
    expect(build({ ...source, messages: [], participants: [] })).toEqual([]);
  });

  it("exposes explicit definitions, gates and limitations for every selected card", () => {
    for (const story of build(rich(), true)) {
      expect(story.calculation.classification).toMatch(/^(Exact|Derived)$/);
      expect(story.calculation.definition.length).toBeGreaterThan(25);
      expect(story.calculation.limitations.length).toBeGreaterThan(25);
      if (!["conversation", "closing"].includes(story.id))
        expect(story.calculation.threshold).toBeTruthy();
    }
    expect(WHATSAPP_STORY_LIMITS).toEqual({
      cards: 12,
      participants: 4,
      dates: 4,
      mediaCategories: 4,
      emoji: 3,
      words: 6,
    });
  });

  it("keeps complete-source cards independent of date-filtered Analyzer results", () => {
    const source = rich();
    const filtered = {
      ...source,
      messages: source.messages.filter(
        (message) => message.timestamp.date === "2025-01-02",
      ),
    };
    expect(
      buildWhatsAppStories(analyzeWhatsApp(filtered), source, {
        includeWords: true,
      }),
    ).toEqual(build(source, true));
  });

  it("keeps complete-source cards independent of participant-filtered Analyzer results", () => {
    const source = rich(6);
    const filtered = {
      ...source,
      participants: source.participants.slice(0, 2),
      messages: source.messages.filter((message) =>
        source.participants
          .slice(0, 2)
          .some((participant) => participant.id === message.participantId),
      ),
    };
    expect(buildWhatsAppStories(analyzeWhatsApp(filtered), source)).toEqual(
      build(source),
    );
  });

  it("also guards against source system-event count mismatches", () => {
    const source = rich();
    const supplied = analyzeWhatsApp(source);
    supplied.totals.systemEvents++;
    supplied.totals.activeDays = 999;
    expect(buildWhatsAppStories(supplied, source)).toEqual(build(source));
  });

  it("does not mutate frozen source data, analysis or options", () => {
    const source = freeze(rich(6));
    const analysis = freeze(analyzeWhatsApp(source));
    const options = freeze({ includeWords: true });
    const before = JSON.stringify({ source, analysis, options });
    const first = buildWhatsAppStories(analysis, source, options);
    expect(buildWhatsAppStories(analysis, source, options)).toEqual(first);
    expect(JSON.stringify({ source, analysis, options })).toBe(before);
  });
});

describe("WhatsApp Wrapped counts and ties", () => {
  it.each([3, 8, 24])(
    "keeps all %i group labels in totals, ties and timing while bounding anonymous rows",
    (participants) => {
      const messages = participants * 6;
      const source = sequence(
        Array.from({ length: messages - 1 }, (_, index) =>
          (index + 1) % participants === 0 ? 21600 : 60,
        ),
        Array.from(
          { length: messages },
          (_, index) => `PRIVATE_GROUP_LABEL_${index % participants}`,
        ),
      );
      const stories = build(source);
      expect(build(source)).toEqual(stories);
      expect(stories.every((story) => story.mode === "group")).toBe(true);
      const visible = Math.min(
        participants,
        WHATSAPP_STORY_LIMITS.participants,
      );
      const ranking = card(stories, "participant-counts", "ranking");
      expect(ranking.data.entries).toEqual(
        Array.from({ length: visible }, (_, index) => ({
          label: `Participant ${index + 1}`,
          value: 6,
          display: "6",
          share: 1 / participants,
        })),
      );
      expect(ranking.data.total).toBe(messages);
      expect(ranking.data.hiddenParticipants).toBe(participants - visible);
      expect(ranking.data.leaderTieCount).toBe(participants);
      expect(ranking.lead).toBe(
        `${participants} participants tie for the highest exported message count.`,
      );
      expect(
        ranking.data.entries.reduce((sum, entry) => sum + entry.share!, 0),
      ).toBeCloseTo(visible / participants);
      const timing = card(stories, "next-message", "rhythm");
      expect(timing.data.transitionCount).toBe(messages - 1);
      expect(timing.data.hiddenParticipants).toBe(participants - visible);
      expect(timing.data.entries).toHaveLength(visible);
      // All but the first label have six incoming transitions. Their tied
      // display order follows the accepted export, not a fastest-sender rank.
      expect(timing.data.entries[0].label).toBe("Participant 2");
      if (participants > visible) {
        expect(timing.note).toBe(
          `${visible} of ${participants} qualifying labels shown; ${participants - visible} not displayed. Adjacent messages do not prove replies.`,
        );
      } else {
        expect(timing.note).not.toContain("not displayed");
      }
      expect(timing.calculation.limitations).toContain("not a speed ranking");
      expect(JSON.stringify(stories)).not.toMatch(
        /PRIVATE_GROUP_LABEL|Synthetic message|winner|reply time|response time/i,
      );
      for (const id of ["session-starters", "silence-breakers"]) {
        const starts = card(stories, id, "ranking");
        expect(starts.data.entries).toHaveLength(visible);
        expect(starts.data.hiddenParticipants).toBe(participants - visible);
        expect(starts.data.entries[0].label).toBe("Participant 1");
        expect(starts.data.total).toBe(id === "session-starters" ? 6 : 5);
        expect(starts.data.entries[0].share).toBe(1);
      }
      expect(card(stories, "closing", "closing").data.participants).toBe(
        participants,
      );
    },
  );

  it("retains every tied maximum even when the group display is capped", () => {
    const source = sequence(
      Array(23).fill(60),
      Array.from(
        { length: 24 },
        (_, index) => `Fictional Sender ${index % 12}`,
      ),
    );
    const ranking = card(build(source), "participant-counts", "ranking");
    expect(ranking.lead).toBe(
      "12 participants tie for the highest exported message count.",
    );
    expect(ranking.value).toBe("2");
    expect(ranking.data.leaderTieCount).toBe(12);
    expect(ranking.data.hiddenParticipants).toBe(8);
    expect(ranking.data.entries.map((entry) => entry.label)).toEqual([
      "Participant 1",
      "Participant 2",
      "Participant 3",
      "Participant 4",
    ]);
    expect(ranking.data.entries.every((entry) => entry.share === 1 / 12)).toBe(
      true,
    );
  });

  it("preserves anonymous aliases in accepted export order before ranking", () => {
    const source = sequence(
      [60, 60, 60, 60],
      [
        "Zzz Fictional",
        "Aaa Fictional",
        "Aaa Fictional",
        "Zzz Fictional",
        "Aaa Fictional",
      ],
    );
    const split = card(build(source), "participant-counts", "split");
    expect(split.lead).toBe(
      "Participant 2 has the highest exported message count.",
    );
    expect(split.data.entries).toEqual([
      { label: "Participant 1", value: 2, display: "2", share: 0.4 },
      { label: "Participant 2", value: 3, display: "3", share: 0.6 },
    ]);
    expect(JSON.stringify(split)).not.toMatch(/Zzz|Aaa/);
  });

  it("describes all tied participant maxima in the fictional demo", () => {
    const ranking = card(
      build(createWhatsAppDemo()),
      "participant-counts",
      "ranking",
    );
    expect(ranking.lead).toBe(
      "3 participants tie for the highest exported message count.",
    );
    expect(ranking.value).toBe("8");
    expect(ranking.data.leaderTieCount).toBe(3);
  });

  it("uses every tied daily and hourly maximum", () => {
    const source = fixture(
      "2025-01-02, 09:00 - Fictional One: first",
      "2025-01-02, 10:00 - Fictional Two: second",
      "2025-01-03, 09:00 - Fictional One: third",
      "2025-01-03, 10:00 - Fictional Two: fourth",
    );
    const stories = build(source);
    const daily = card(stories, "busiest-day", "timeline");
    expect(daily.lead).toBe(
      "2 recorded days tie for the highest message count.",
    );
    expect(daily.data.tiedDates).toBe(2);
    expect(daily.data.dates).toEqual([
      { date: "2 Jan 2025", value: 2 },
      { date: "3 Jan 2025", value: 2 },
    ]);
    const hourly = card(stories, "busiest-hour", "distribution");
    expect(hourly.lead).toBe(
      "2 hourly buckets share the highest recorded message count.",
    );
    expect(hourly.data.tiedMaximum).toBe(2);
    expect(hourly.data.entries).toHaveLength(24);
    expect(
      hourly.data.entries.reduce((sum, entry) => sum + entry.value, 0),
    ).toBe(4);
    expect(hourly.data.entries[9]).toEqual({
      label: "9am",
      value: 2,
      display: "2",
      share: 0.5,
    });
  });

  it("caps tied-date display while retaining the total tie count and streak", () => {
    const source = sequence([
      60,
      ...Array.from({ length: 5 }, () => [86340, 60]).flat(),
    ]);
    const daily = card(build(source), "busiest-day", "timeline");
    expect(daily.data.dates).toHaveLength(4);
    expect(daily.data.tiedDates).toBe(6);
    expect(daily.data.streakDays).toBe(6);
    expect(daily.lead).toContain("6 recorded days tie");
    expect(card(build(source), "active-streak", "timeline").value).toBe("6");
  });

  it("finds tied maxima in large collections without argument spreading", () => {
    const buckets = Array.from({ length: 180000 }, (_, index) => ({
      key: String(index),
      label: String(index),
      count: index === 0 || index === 179999 ? 2 : 1,
    }));
    expect(whatsappPeaks(buckets).map((bucket) => bucket.key)).toEqual([
      "0",
      "179999",
    ]);
    expect(whatsappPeaks([{ key: "zero", label: "Zero", count: 0 }])).toEqual(
      [],
    );
    expect(whatsappPeaks([])).toEqual([]);
  });
});

describe("WhatsApp Wrapped consumes Analyzer V2 rhythm and patterns", () => {
  it("uses the existing engines once each on the full accepted source", () => {
    const source = rich();
    const rhythm = vi.spyOn(rhythmEngine, "analyzeConversationRhythm");
    const patterns = vi.spyOn(patternsEngine, "analyzeWhatsAppMessagePatterns");
    build(source);
    expect(rhythm).toHaveBeenCalledExactlyOnceWith(
      source.messages,
      source.participants,
    );
    expect(patterns).toHaveBeenCalledExactlyOnceWith(
      source.messages,
      source.participants,
    );
  });

  it("projects session count, median, longest count and longest span correctly", () => {
    const source = sequence([60, 60, 1801, 1800, 21600, 60]);
    const stories = build(source);
    const sessions = card(stories, "sessions", "distribution");
    expect(sessions.value).toBe("3");
    expect(sessions.data.entries).toEqual([
      { label: "Median session", value: 2, display: "2 messages" },
      { label: "Longest session", value: 3, display: "3 messages" },
    ]);
    expect(sessions.facts).toContainEqual({
      value: "30 min",
      label: "longest recorded session span",
    });
    expect(sessions.calculation.definition).toContain(
      "greater than 30 minutes",
    );
    const starters = card(stories, "session-starters", "split");
    expect(starters.data.entries.map((entry) => entry.value)).toEqual([1, 2]);
    expect(starters.data.total).toBe(3);
    expect(starters.calculation.definition).toContain(
      "including the first session",
    );
  });

  it("retains starter ties without inventing a winner", () => {
    const source = sequence(
      [60, 21600, 60, 21600, 60, 21600, 60],
      [
        "Fictional A",
        "Fictional B",
        "Fictional B",
        "Fictional A",
        "Fictional A",
        "Fictional B",
        "Fictional B",
        "Fictional A",
      ],
    );
    const starters = card(build(source), "session-starters", "split");
    expect(starters.data.entries.map((entry) => entry.value)).toEqual([2, 2]);
    expect(starters.data.leaderTieCount).toBe(2);
    expect(starters.lead).toBe(
      "2 participants tie for the highest recorded session-start count.",
    );
  });

  it("counts silence breakers at the inclusive 6-hour boundary and excludes shorter gaps", () => {
    const source = sequence([21600, 21599, 21600, 21600]);
    const silence = card(build(source), "silence-breakers", "split");
    expect(silence.data.total).toBe(3);
    expect(silence.data.entries.map((entry) => entry.value)).toEqual([1, 2]);
    expect(silence.calculation.definition).toContain("at least 6 hours");
    expect(silence.calculation.definition).toContain(
      "cannot be a silence breaker",
    );
    expect(ids(build(sequence([21600, 21600, 21599])))).not.toContain(
      "silence-breakers",
    );
  });

  it("projects median, interpolated quartiles, buckets and the rapid-transition share", () => {
    const source = sequence([0, 300, 301, 1800, 1801, 21600]);
    const rhythm = card(build(source), "next-message", "rhythm");
    expect(rhythm.value).toBe("17.5 min");
    expect(rhythm.facts[0]).toEqual({
      value: "5 min / 30 min",
      label: "p25 / p75 recorded delay",
    });
    expect(rhythm.data.transitionCount).toBe(6);
    expect(rhythm.data.rapidCount).toBe(2);
    expect(rhythm.data.rapidShare).toBe(1 / 3);
    expect(rhythm.facts[1].value).toBe("33.3%");
    expect(rhythm.data.buckets.map((bucket) => bucket.value)).toEqual([
      1, 0, 2, 2, 1,
    ]);
    expect(rhythm.data.entries).toEqual([]);
    expect(JSON.stringify(rhythm)).not.toMatch(/reply time/i);
    expect(rhythm.calculation.definition).toContain("delay at most 5 minutes");
  });

  it("shows pair timing comparisons only after four incoming transitions per label", () => {
    const weak = card(
      build(sequence(Array(7).fill(60))),
      "next-message",
      "rhythm",
    );
    expect(weak.data.entries).toEqual([]);
    const supported = card(
      build(sequence(Array(8).fill(60))),
      "next-message",
      "rhythm",
    );
    expect(supported.data.entries).toEqual([
      { label: "Participant 1", value: 60, display: "1 min" },
      { label: "Participant 2", value: 60, display: "1 min" },
    ]);
  });

  it("projects the existing burst and run summary without clock contexts", () => {
    const source = sequence(
      [60, 60, 900, 60, 60],
      [
        "Fictional A",
        "Fictional A",
        "Fictional B",
        "Fictional B",
        "Fictional A",
        "Fictional A",
      ],
    );
    const patterns = card(build(source), "message-patterns", "patterns");
    expect(patterns.value).toBe("3");
    expect(patterns.data).toEqual({
      maximum: 3,
      ties: 2,
      runs: 3,
      medianRunLength: 2,
      longestRun: 2,
      distribution: [
        { label: "1", value: 0, display: "0", share: 0 },
        { label: "2", value: 3, display: "3", share: 1 },
        { label: "3–5", value: 0, display: "0", share: 0 },
        { label: "6–10", value: 0, display: "0", share: 0 },
        { label: "11+", value: 0, display: "0", share: 0 },
      ],
    });
    expect(patterns.calculation.definition).toContain(
      "inclusive rolling 10-minute",
    );
    expect(JSON.stringify(patterns)).not.toMatch(/T\d{2}:\d{2}|2025-01/);
  });

  it("uses a useful run presentation when no qualifying burst exists", () => {
    const source = sequence(Array(7).fill(901), [
      "Fictional A",
      "Fictional A",
      "Fictional B",
      "Fictional B",
      "Fictional A",
      "Fictional A",
      "Fictional B",
      "Fictional B",
    ]);
    const patterns = card(build(source), "message-patterns", "patterns");
    expect(patterns.valueLabel).toBe("messages in the longest recorded run");
    expect(patterns.data.maximum).toBe(1);
    expect(patterns.data.longestRun).toBe(2);
    expect(patterns.data.runs).toBe(4);
    expect(patterns.value).toBe("2");
  });

  it("skips weak session, starter, transition and pattern summaries", () => {
    const weak = build(sequence([901, 901, 901]));
    for (const id of [
      "sessions",
      "session-starters",
      "silence-breakers",
      "next-message",
      "message-patterns",
    ]) {
      expect(ids(weak)).not.toContain(id);
    }
    expect(WHATSAPP_STORY_EVIDENCE.sessions).toBe(3);
    expect(WHATSAPP_STORY_EVIDENCE.transitions).toBe(4);
    expect(WHATSAPP_STORY_EVIDENCE.burstMessages).toBe(3);
    expect(WHATSAPP_STORY_EVIDENCE.runs).toBe(4);
  });
});

describe("WhatsApp Wrapped media and emoji", () => {
  it("combines recognized media counts and supported emoji without source bodies", () => {
    const source = sequence([60, 60, 60], undefined, [
      "image omitted",
      "video omitted",
      "🌿🌿🌿",
      "🌿",
    ]);
    const media = card(build(source), "media-emoji", "media");
    expect(media.data.mediaTotal).toBe(2);
    expect(media.data.categories).toEqual([
      { kind: "image", label: "Images", count: 1 },
      { kind: "video", label: "Videos", count: 1 },
    ]);
    expect(media.data.emojiAvailable).toBe(true);
    expect(media.data.emojiTotal).toBe(4);
    expect(media.data.emoji).toEqual([{ symbol: "🌿", count: 4 }]);
    expect(JSON.stringify(media)).not.toContain("image omitted");
  });

  it("retains unavailable emoji as unavailable rather than zero", () => {
    const source = rich();
    const analysis = analyzeWhatsApp(source);
    analysis.totals.emoji = null;
    const media = card(
      buildWhatsAppStories(analysis, source),
      "media-emoji",
      "media",
    );
    expect(media.data.emojiAvailable).toBe(false);
    expect(media.data.emojiTotal).toBeNull();
    expect(media.data.emoji).toEqual([]);
    expect(media.facts).toContainEqual({
      value: "Unavailable",
      label: "supported emoji occurrences",
    });
  });

  it("honors unavailable segmentation warnings even with a stale numeric total", () => {
    const source = rich();
    source.metadata.warnings.push({
      code: "emoji-unavailable",
      message: "Synthetic warning",
    });
    expect(
      card(build(source), "media-emoji", "media").data.emojiAvailable,
    ).toBe(false);
    source.metadata.warnings = source.metadata.warnings.filter(
      (warning) => warning.code !== "emoji-unavailable",
    );
    source.messages[0].emoji = null;
    expect(
      card(build(source), "media-emoji", "media").data.emojiAvailable,
    ).toBe(false);
  });

  it("caps media categories and emoji while retaining omitted aggregate counts", () => {
    const source = sequence(Array(7).fill(60), undefined, [
      "image omitted",
      "video omitted",
      "audio omitted",
      "sticker omitted",
      "GIF omitted",
      "document omitted",
      "<Media omitted>",
      "🌿🌿🎉🎉😀😀🙌🙌",
    ]);
    const media = card(build(source), "media-emoji", "media");
    expect(media.data.categories).toHaveLength(4);
    expect(media.data.hiddenCategories).toBe(3);
    expect(media.data.remainingMedia).toBe(3);
    expect(media.data.mediaTotal).toBe(7);
    expect(media.data.emoji).toHaveLength(3);
    expect(media.data.emojiTotal).toBe(8);
  });

  it("requires two media messages or three supported emoji occurrences", () => {
    expect(
      ids(build(sequence([60], undefined, ["image omitted", "🌿🌿"]))),
    ).not.toContain("media-emoji");
    expect(
      ids(build(sequence([60], undefined, ["image omitted", "video omitted"]))),
    ).toContain("media-emoji");
    const emojiOnly = card(
      build(sequence([], undefined, ["🌿🌿🌿"])),
      "media-emoji",
      "media",
    );
    expect(emojiOnly.valueLabel).toBe("supported emoji occurrences");
    expect(emojiOnly.data.mediaTotal).toBe(0);
  });
});

describe("WhatsApp Wrapped word consent and privacy", () => {
  it("never invokes text analysis or puts lexical words in the default deck", () => {
    const analyzeText = vi
      .spyOn(textEngine, "analyzeWhatsAppText")
      .mockImplementation(() => {
        throw new Error("Text analysis requires explicit opt-in");
      });
    const source = rich();
    const analysis = analyzeWhatsApp(source);
    const implicit = buildWhatsAppStories(analysis, source);
    expect(
      buildWhatsAppStories(analysis, source, { includeWords: false }),
    ).toEqual(implicit);
    expect(analyzeText).not.toHaveBeenCalled();
    expect(ids(implicit)).not.toContain("words");
    expect(JSON.stringify(implicit)).not.toMatch(
      /orchard|cobalt|lantern|pebble|willow|zenith|pastel|honey/,
    );
  });

  it("projects only six bounded existing top words after explicit opt-in", () => {
    const source = rich();
    const analyzeText = vi.spyOn(textEngine, "analyzeWhatsAppText");
    const stories = build(source, true);
    const words = card(stories, "words", "word");
    expect(analyzeText).toHaveBeenCalledExactlyOnceWith(
      source.messages,
      source.participants,
      { comparisonAllowed: false },
    );
    expect(words.data.words).toEqual(
      ["cobalt", "honey", "lantern", "orchard", "pastel", "pebble"].map(
        (word) => ({ word, count: 32 }),
      ),
    );
    expect(words.data.eligibleWords).toBe(256);
    expect(words.note).toContain("PNG may expose these derived words");
    expect(words.calculation.threshold).toContain("2–40 Unicode code points");
    expect(stories).toHaveLength(12);
    expect(ids(stories)).not.toContain("active-streak");
    expect(card(stories, "busiest-day", "timeline").data.streakDays).toBe(4);
    expect(card(stories, "busiest-day", "timeline").facts).toContainEqual({
      value: "4",
      label: "longest consecutive active-date run",
    });
    expect(card(stories, "closing", "closing").data.cardCount).toBe(12);
  });

  it("keeps a standalone streak when an opted-in shorter deck has room", () => {
    const source = sequence(
      [60, 60, 86300, 60, 60],
      undefined,
      Array(6).fill("orchard cobalt lantern pebble"),
    );
    const stories = build(source, true);
    expect(stories.length).toBeLessThan(12);
    expect(ids(stories)).toContain("active-streak");
    expect(ids(stories)).toContain("words");
  });

  it.each([
    {
      reason: "fewer than six eligible text messages",
      bodies: Array(5).fill("orchard cobalt lantern pebble"),
    },
    {
      reason: "fewer than twenty eligible word occurrences",
      bodies: Array(6).fill("orchard cobalt"),
    },
    {
      reason: "only one distinct recurring word",
      bodies: Array(6).fill("orchard orchard orchard orchard"),
    },
    {
      reason: "second word occurs fewer than three times",
      bodies: [
        "orchard orchard cobalt",
        "orchard orchard cobalt",
        ...Array(4).fill("orchard orchard orchard"),
      ],
    },
  ])("skips opted-in words with $reason", ({ bodies }) => {
    expect(
      ids(
        build(
          sequence(Array(bodies.length - 1).fill(60), undefined, bodies),
          true,
        ),
      ),
    ).not.toContain("words");
  });

  it("includes a word card exactly at its text-message, word-count and repetition gates", () => {
    const bodies = [
      "orchard orchard orchard cobalt",
      "orchard orchard orchard cobalt",
      "orchard orchard orchard cobalt",
      "orchard orchard orchard",
      "orchard orchard orchard",
      "orchard orchard",
    ];
    const words = card(
      build(sequence(Array(5).fill(60), undefined, bodies), true),
      "words",
      "word",
    );
    expect(words.data.eligibleWords).toBe(20);
    expect(words.data.words).toEqual([
      { word: "orchard", count: 17 },
      { word: "cobalt", count: 3 },
    ]);
  });

  it("excludes original participant-label tokens even when consent is enabled", () => {
    const source = sequence(
      Array(5).fill(60),
      Array(6).fill("İPEK ÉLODIE"),
      Array(6).fill("İpek élodie orchard cobalt lantern pebble"),
    );
    const words = card(build(source, true), "words", "word");
    expect(words.data.words.map((word) => word.word)).toEqual([
      "cobalt",
      "lantern",
      "orchard",
      "pebble",
    ]);
    expect(JSON.stringify(build(source, true))).not.toMatch(
      /İPEK|ÉLODIE|ipek|élodie/,
    );
  });

  it("uses existing token bounds, URL/email removal and stopword filtering", () => {
    const body = `orchard cobalt ${"x".repeat(41)} a the und ve https://private.invalid/hiddenurlword mailsecret@private.invalid`;
    const source = sequence(Array(9).fill(60), undefined, Array(10).fill(body));
    const words = card(build(source, true), "words", "word");
    expect(words.data.words).toEqual([
      { word: "cobalt", count: 10 },
      { word: "orchard", count: 10 },
    ]);
    expect(JSON.stringify(words)).not.toMatch(
      /hiddenurlword|mailsecret|private\.invalid|xxxxxxxx/,
    );
  });

  it("does not retain opt-in across independent calls", () => {
    const source = rich();
    expect(ids(build(source, true))).toContain("words");
    expect(ids(build(source))).not.toContain("words");
    expect(ids(buildWhatsAppStories(analyzeWhatsApp(source), source))).toEqual(
      richIds,
    );
  });

  it("keeps private names, IDs, bodies, URLs, filenames, phones and coordinates out of default models", () => {
    const source = rich(6);
    source.participants.forEach((participant, index) => {
      const previous = participant.id;
      participant.id = `PRIVATE_PARTICIPANT_ID_${index}`;
      participant.displayName = `PRIVATE_DISPLAY_NAME_${index}`;
      for (const message of source.messages)
        if (message.participantId === previous)
          message.participantId = participant.id;
    });
    source.messages[0].content =
      "PRIVATE_RAW_MESSAGE privatearchive.pdf +49 123 456789 52.520008,13.404954 https://private.invalid/hidden-path";
    source.messages[0].links = ["https://private.invalid/hidden-path"];
    source.systemEvents.push({
      id: 9999,
      timestamp: source.messages[0].timestamp,
      content: "PRIVATE_SYSTEM_EVENT",
    });
    const stories = build(source);
    const serialized = JSON.stringify(stories);
    for (const privateValue of [
      "PRIVATE_",
      "privatearchive",
      "+49 123",
      "52.520008",
      "13.404954",
      "private.invalid",
      "hidden-path",
      "orchard",
      "cobalt",
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
    for (const message of source.messages)
      expect(serialized).not.toContain(message.timestamp.local);
    for (const participant of source.participants)
      expect(serialized).not.toContain(participant.id);
    expect(stories.length).toBeGreaterThanOrEqual(10);
  });

  it("preserves shared Analyzer number and UTC-date formatting conventions", () => {
    expect(whatsappNumber(1234.5678)).toBe("1,234.568");
    expect(whatsappNumber(1000000)).toBe("1,000,000");
    expect(whatsappDate("2025-01-01", true)).toBe("1 Jan 2025");
    expect(whatsappDate("2025-01-01")).toBe("1 January 2025");
  });
});
