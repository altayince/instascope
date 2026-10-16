import { describe, expect, it } from "vitest";
import {
  analyzeFilteredWhatsApp,
  DEFAULT_WHATSAPP_FILTERS,
} from "../../src/lib/whatsapp/filters";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import { analyzeConversationRhythm } from "../../src/lib/whatsapp/rhythm";

// Generated labels and content only; no personal export evidence is copied here.
function group(size: number) {
  const labels = Array.from(
    { length: size },
    (_, index) => `Synthetic label ${String(index + 1).padStart(2, "0")}`,
  );
  const lines = ["2026-03-14, 08:00 - [Anruf]"];
  for (const [round, content] of [
    "Fictional question? https://example.org/synthetic 🌿",
    "image omitted",
    "[Anruf]",
  ].entries()) {
    for (const [index, label] of labels.entries()) {
      lines.push(
        `2026-03-${round === 2 ? "15" : "14"}, ${String(9 + round).padStart(2, "0")}:${String(index).padStart(2, "0")} - ${label}: ${content}`,
      );
    }
  }
  return parseWhatsApp(lines.join("\n"), "ymd-24h");
}

function everyone(dataset: ReturnType<typeof group>) {
  const result = analyzeFilteredWhatsApp(dataset, DEFAULT_WHATSAPP_FILTERS);
  if (!result.ok) throw new Error("Synthetic group filters must be valid");
  return result;
}

describe("existing analysis across small and large exported groups", () => {
  it.each([3, 8, 24])(
    "keeps all %i labels in totals, distributions and selected-message denominators",
    (size) => {
      const dataset = group(size);
      const source = JSON.stringify(dataset);
      const { analysis, overview, heatmap, content, rhythm } =
        everyone(dataset);
      expect(analysis.totals).toMatchObject({
        messages: size * 3,
        participants: size,
        mediaMessages: size,
        links: size,
        emoji: size,
        activeDays: 2,
        systemEvents: 1,
      });
      expect(overview).toEqual({
        messagesPerActiveDate: (size * 3) / 2,
        recognizedCallEvents: size + 1,
        attributedCallEvents: size,
        unattributedCallEvents: 1,
      });
      expect(analysis.participants.map((item) => item.messageCount)).toEqual(
        Array<number>(size).fill(3),
      );
      expect(
        analysis.participants.reduce(
          (sum, item) => sum + item.messageCount / analysis.totals.messages,
          0,
        ),
      ).toBeCloseTo(1, 12);
      for (const distribution of [
        analysis.hours,
        analysis.weekdays,
        analysis.monthly,
        analysis.daily,
      ]) {
        expect(distribution.reduce((sum, item) => sum + item.count, 0)).toBe(
          size * 3,
        );
      }
      expect(heatmap.flat().reduce((sum, count) => sum + count, 0)).toBe(
        size * 3,
      );
      expect(content.media.participants).toHaveLength(size);
      expect(
        content.media.participants.reduce((sum, item) => sum + item.total, 0),
      ).toBe(size);
      expect(content.patterns.questionMarks).toEqual({
        messages: size,
        occurrences: size,
        share: 1 / 3,
      });
      expect(content.patterns.runs).toMatchObject({
        total: size * 3,
        medianLength: 1,
        longest: 1,
      });
      if (!rhythm.available) throw new Error("Everyone has group rhythm");
      expect(rhythm.analysis.participants).toHaveLength(size);
      expect(rhythm.analysis.sessionSummary.total).toBe(3);
      expect(rhythm.analysis.timing.count).toBe(size * 3 - 1);
      expect(rhythm.analysis.rapidTransitions).toBe((size - 1) * 3);
      expect(rhythm.analysis.silenceSummary.total).toBe(1);
      expect(
        rhythm.analysis.participants.reduce(
          (sum, item) => sum + item.timing.count,
          0,
        ),
      ).toBe(size * 3 - 1);
      expect(
        rhythm.analysis.participants.reduce(
          (sum, item) => sum + item.sessionsStarted,
          0,
        ),
      ).toBe(3);
      expect(JSON.stringify(dataset)).toBe(source);
    },
  );

  it("keeps participant-filter shares local and senderless calls unattributed in a large group", () => {
    const dataset = group(24);
    const result = analyzeFilteredWhatsApp(dataset, {
      ...DEFAULT_WHATSAPP_FILTERS,
      participantId: dataset.participants.at(-1)!.id,
    });
    if (!result.ok) throw new Error("Synthetic participant must be selectable");
    expect(result.analysis.totals).toMatchObject({
      messages: 3,
      participants: 1,
      mediaMessages: 1,
      links: 1,
      emoji: 1,
      systemEvents: 0,
    });
    expect(result.overview).toEqual({
      messagesPerActiveDate: 1.5,
      recognizedCallEvents: 1,
      attributedCallEvents: 1,
      unattributedCallEvents: 0,
    });
    expect(result.analysis.participants[0].messageCount).toBe(
      result.analysis.totals.messages,
    );
    expect(result.rhythm).toEqual({
      available: false,
      reason: "participant-filter",
    });
    expect(dataset.metadata.doctor.participantLabels).toBe(24);
    expect(dataset.systemEvents).toHaveLength(1);
  });

  it("keeps empty large-group subsets at zero with unavailable denominators", () => {
    const result = analyzeFilteredWhatsApp(group(24), {
      date: { mode: "month", month: "2026-04" },
      participantId: null,
    });
    if (!result.ok) throw new Error("An empty valid month is still a result");
    expect(result.analysis.totals.messages).toBe(0);
    expect(result.analysis.participants).toEqual([]);
    expect(result.overview.messagesPerActiveDate).toBeNull();
    expect(result.content.patterns.questionMarks.share).toBeNull();
    if (!result.rhythm.available) throw new Error("Everyone retains rhythm");
    expect(result.rhythm.analysis.timing.medianSeconds).toBeNull();
    expect(result.rhythm.analysis.transitions).toEqual([]);
  });

  it("counts equal-clock group transitions without inventing delay or reply attribution", () => {
    const dataset = parseWhatsApp(
      Array.from(
        { length: 24 },
        (_, index) =>
          `2026-03-14, 09:00 - Synthetic label ${index + 1}: Fictional text`,
      ).join("\n"),
      "ymd-24h",
    );
    const rhythm = analyzeConversationRhythm(
      dataset.messages,
      dataset.participants,
    );
    expect(rhythm.sessionSummary.total).toBe(1);
    expect(rhythm.equalTimestampTransitions).toBe(23);
    expect(rhythm.rapidTransitions).toBe(23);
    expect(rhythm.timing).toMatchObject({
      count: 23,
      medianSeconds: 0,
      p25Seconds: 0,
      p75Seconds: 0,
    });
    expect(rhythm.transitions.map((item) => item.toParticipantId)).toEqual(
      dataset.participants.slice(1).map((item) => item.id),
    );
    expect(rhythm.participants[0].timing.count).toBe(0);
    expect(rhythm.participants[0].rapidShare).toBeNull();
    expect(
      rhythm.participants.slice(1).every((item) => item.rapidShare === 1),
    ).toBe(true);
    expect(JSON.stringify(rhythm)).not.toContain("Fictional text");
  });

  it("compares word rates with every other group label pooled, not an arbitrary second participant", () => {
    const dataset = parseWhatsApp(
      ["cedar", "maple", "cedar"]
        .map(
          (word, index) =>
            `2026-03-14, 09:0${index} - Synthetic label ${index + 1}: ${Array<string>(20).fill(word).join(" ")}`,
        )
        .join("\n"),
      "ymd-24h",
    );
    const { content } = everyone(dataset);
    expect(content.text.eligibleWords).toBe(60);
    expect(content.text.participants[0].comparison).toEqual({
      available: true,
      words: [],
    });
    const comparison = content.text.participants[1].comparison;
    if (!comparison.available)
      throw new Error("Synthetic word evidence qualifies");
    expect(comparison.words).toHaveLength(1);
    expect(comparison.words[0]).toMatchObject({
      word: "maple",
      count: 20,
      otherCount: 0,
    });
    expect(comparison.words[0].otherPerThousand).toBeCloseTo((0.5 / 41) * 1000);
  });
});
