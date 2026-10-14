import { describe, expect, it } from "vitest";
import { analyzeWhatsApp } from "../../src/lib/whatsapp/analysis";
import {
  analyzeFilteredWhatsApp,
  DEFAULT_WHATSAPP_FILTERS,
  type WhatsAppAnalysisFilters,
} from "../../src/lib/whatsapp/filters";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import { buildWhatsAppStories } from "../../src/lib/whatsapp/stories";
import type { WhatsAppDataset } from "../../src/lib/whatsapp/types";

function selected(
  dataset: WhatsAppDataset,
  filters = DEFAULT_WHATSAPP_FILTERS,
) {
  const result = analyzeFilteredWhatsApp(dataset, filters);
  if (!result.ok) throw new Error(result.error);
  return result;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

const source = () =>
  parseWhatsApp(
    [
      "31/12/2023, 23:59 - Synthetic A: cedar cedar? 🌿",
      "29/02/2024, 08:00 - Synthetic A: orchard orchard 🌿🌿",
      "29/02/2024, 08:01 - Synthetic B: meadow meadow? 🌱",
      "01/03/2024, 08:02 - Synthetic A: image omitted",
      "01/03/2024, 08:03 - Synthetic B: https://example.org/?q=synthetic",
      "01/03/2024, 08:04 - [Anruf]",
      "01/01/2025, 08:05 - Synthetic B: future future",
    ].join("\n"),
    "dmy-24h",
  );

describe("filtered local WhatsApp content integration", () => {
  it("keeps the source, Doctor, base analysis and Wrapped unchanged", () => {
    const dataset = freeze(source());
    const before = JSON.stringify(dataset);
    const base = analyzeWhatsApp(dataset);
    const stories = buildWhatsAppStories(base, dataset);
    expect(stories.length).toBeGreaterThan(0);
    const output = selected(dataset);
    expect(output.analysis).toEqual(base);
    selected(dataset, {
      date: { mode: "year", year: 2024 },
      participantId: dataset.participants[0].id,
    });
    expect(JSON.stringify(dataset)).toBe(before);
    expect(buildWhatsAppStories(analyzeWhatsApp(dataset), dataset)).toEqual(
      stories,
    );
    expect(dataset.metadata.doctor.participantLabels).toBe(2);
  });

  it.each<{ filters: WhatsAppAnalysisFilters; messages: number; word: string }>(
    [
      { filters: DEFAULT_WHATSAPP_FILTERS, messages: 6, word: "cedar" },
      {
        filters: { date: { mode: "year", year: 2024 }, participantId: null },
        messages: 4,
        word: "orchard",
      },
      {
        filters: {
          date: { mode: "month", month: "2024-02" },
          participantId: null,
        },
        messages: 2,
        word: "meadow",
      },
      {
        filters: {
          date: { mode: "range", from: "2024-02-29", to: "2024-02-29" },
          participantId: null,
        },
        messages: 2,
        word: "orchard",
      },
    ],
  )(
    "applies $filters.date.mode to every content metric",
    ({ filters, messages, word }) => {
      const result = selected(source(), filters);
      expect(result.content.patterns.messageCount).toBe(messages);
      expect(result.content.text.words).toContainEqual({ word, count: 2 });
      expect(result.content.media.total).toBe(
        result.analysis.totals.mediaMessages,
      );
      expect(result.content.emoji.total).toBe(result.analysis.totals.emoji);
    },
  );

  it("combines date/participant filters and explicitly disables comparison", () => {
    const dataset = source();
    const result = selected(dataset, {
      date: { mode: "year", year: 2024 },
      participantId: dataset.participants[0].id,
    });
    expect(result.content.patterns.messageCount).toBe(2);
    expect(result.content.patterns.runs).toMatchObject({
      total: 1,
      longest: 2,
    });
    expect(result.content.text.words).toEqual([{ word: "orchard", count: 2 }]);
    expect(result.content.text.participants[0].comparison).toEqual({
      available: false,
      reason: "participant-filter",
    });
    expect(
      result.content.media.participants.map((item) => item.displayName),
    ).toEqual(["Synthetic A"]);
    expect(result.content.emoji.total).toBe(2);
    expect(result.content.emoji.participants[0].items).toEqual([
      { key: "🌿", label: "🌿", count: 2 },
    ]);
  });

  it("recomputes cropped bursts, questions, length and comparison evidence from the date subset", () => {
    const own = Array(10).fill("cedar").join(" ");
    const other = Array(10).fill("meadow").join(" ");
    const dataset = parseWhatsApp(
      [
        `14/06/2026, 08:00 - Synthetic A: ${own}?`,
        `14/06/2026, 08:01 - Synthetic B: ${other}`,
        `15/06/2026, 08:00 - Synthetic A: ${own}??`,
        `15/06/2026, 08:01 - Synthetic B: ${other}?`,
      ].join("\n"),
      "dmy-24h",
    );
    const full = selected(dataset).content;
    expect(
      full.text.participants.every((item) => item.comparison.available),
    ).toBe(true);
    expect(full.patterns.burst).toMatchObject({ maximum: 2, tiedWindows: 2 });
    expect(full.patterns.questionMarks).toEqual({
      messages: 3,
      occurrences: 4,
      share: 0.75,
    });
    const cropped = selected(dataset, {
      date: { mode: "range", from: "2026-06-15", to: "2026-06-15" },
      participantId: null,
    }).content;
    expect(cropped.patterns.burst).toMatchObject({
      maximum: 2,
      tiedWindows: 1,
    });
    expect(cropped.patterns.questionMarks).toEqual({
      messages: 2,
      occurrences: 3,
      share: 1,
    });
    expect(cropped.text.length).toEqual({
      count: 2,
      median: 65.5,
      p25: 63.25,
      p75: 67.75,
    });
    expect(cropped.text.wordsPerMessage.median).toBe(10);
    expect(cropped.text.participants.map((item) => item.comparison)).toEqual([
      { available: false, reason: "insufficient-data" },
      { available: false, reason: "insufficient-data" },
    ]);
    expect(dataset.messages).toHaveLength(4);
  });

  it("keeps empty summaries unavailable and the seven media kinds explicit", () => {
    const result = selected(source(), {
      date: { mode: "year", year: 2030 },
      participantId: null,
    }).content;
    expect(result.patterns.runs).toMatchObject({
      total: 0,
      medianLength: null,
      longest: null,
    });
    expect(result.patterns.questionMarks.share).toBeNull();
    expect(result.text.length.median).toBeNull();
    expect(result.text.participants).toEqual([]);
    expect(result.media.categories).toHaveLength(7);
    expect(result.media.categories.every((item) => item.count === 0)).toBe(
      true,
    );
    expect(result.emoji).toEqual({
      available: true,
      total: 0,
      items: [],
      participants: [],
    });
  });

  it("reuses all typed media categories, without promoting unknown omission tails", () => {
    const markers = [
      "image omitted",
      "video omitted",
      "audio omitted",
      "sticker omitted",
      "GIF omitted",
      "document omitted",
      "<Media omitted>",
    ];
    const dataset = parseWhatsApp(
      [
        ...markers.map(
          (marker, index) =>
            `14/06/2026, 08:0${index} - Synthetic A: ${marker}`,
        ),
        "14/06/2026, 08:07 - Synthetic B: <Bild ausgelassen> synthetic-file.jpg",
        "14/06/2026, 08:08 - Synthetic B: [Anruf]",
        "14/06/2026, 08:09 - Synthetic B: Du hast diese Nachricht gelöscht.",
        "14/06/2026, 08:10 - Synthetic B: Standort: 0, 0 - https://maps.google.com/?q=0,0",
      ].join("\n"),
      "dmy-24h",
    );
    const result = selected(dataset).content;
    expect(result.media.total).toBe(7);
    expect(result.media.categories.map((item) => item.count)).toEqual(
      Array(7).fill(1),
    );
    expect(result.media.participants.map((item) => item.total)).toEqual([7, 0]);
    expect(result.text.eligibleTextMessages).toBe(0);
    expect(result.text.words).toEqual([]);
    expect(dataset.metadata.doctor.unclassifiedMarkerRecords).toBe(1);
    expect(result.patterns.messageCount).toBe(11);
    expect(result.patterns.questionMarks.occurrences).toBe(1);
  });

  it("preserves source-wide emoji unavailability through narrowed and empty selections", () => {
    const dataset = source();
    dataset.messages[0].emoji = null;
    for (const year of [2024, 2030]) {
      const result = selected(dataset, {
        date: { mode: "year", year },
        participantId: null,
      }).content;
      expect(result.emoji.available).toBe(false);
      expect(result.emoji.total).toBeNull();
      expect(result.emoji.items).toEqual([]);
      expect(
        result.emoji.participants.every(
          (item) => item.total === null && item.items.length === 0,
        ),
      ).toBe(true);
    }
  });

  it("counts existing emoji graphemes with deterministic leaderboard ties", () => {
    const dataset = parseWhatsApp(
      "14/06/2026, 08:00 - Synthetic A: 🌿🌱🌿🌱👩‍💻",
      "dmy-24h",
    );
    const result = selected(dataset).content;
    expect(result.emoji.total).toBe(5);
    expect(result.emoji.items).toEqual([
      { key: "🌱", label: "🌱", count: 2 },
      { key: "🌿", label: "🌿", count: 2 },
      { key: "👩‍💻", label: "👩‍💻", count: 1 },
    ]);
    expect(result.emoji.participants[0].items).toEqual(result.emoji.items);
  });
});
