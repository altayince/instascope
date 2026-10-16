import { describe, expect, it } from "vitest";
import {
  analyzeFilteredWhatsApp,
  DEFAULT_WHATSAPP_FILTERS,
} from "../../src/lib/whatsapp/filters";
import { analyzeConversationRhythm } from "../../src/lib/whatsapp/rhythm";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import type { WhatsAppAnalysisFilters } from "../../src/lib/whatsapp/filters";
import type { WhatsAppDataset } from "../../src/lib/whatsapp/types";

const fixture = () =>
  parseWhatsApp(
    [
      "31/12/2023, 08:00 - Synthetic A: Synthetic private body",
      "01/01/2024, 09:00 - Synthetic B: A fictional record",
      "01/01/2024, 09:05 - Synthetic A: A fictional record",
      "02/01/2024, 11:00 - Synthetic A: A fictional record",
      "02/01/2024, 11:30 - Synthetic B: A fictional record",
      "02/01/2024, 11:50 - [Anruf]",
      "02/01/2024, 12:01 - Synthetic A: A fictional record",
      "01/02/2024, 09:00 - Synthetic B: A fictional record",
      "01/01/2025, 09:00 - Synthetic A: A fictional record",
    ].join("\n"),
    "dmy-24h",
  );

function select(dataset: WhatsAppDataset, filters = DEFAULT_WHATSAPP_FILTERS) {
  const result = analyzeFilteredWhatsApp(dataset, filters);
  if (!result.ok) throw new Error(result.error);
  return result;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

describe("rhythm through the existing analyzer filters", () => {
  it("uses the accepted full source for All time and Everyone without changing Doctor or records", () => {
    const dataset = freeze(fixture());
    const before = JSON.stringify(dataset);
    const doctor = dataset.metadata.doctor;
    const result = select(dataset);
    expect(result.rhythm).toEqual({
      available: true,
      analysis: analyzeConversationRhythm(
        dataset.messages,
        dataset.participants,
      ),
    });
    expect(dataset.metadata.doctor).toBe(doctor);
    expect(JSON.stringify(dataset)).toBe(before);
    expect(JSON.stringify(result.rhythm)).not.toContain(
      "Synthetic private body",
    );
  });

  it.each([
    [{ mode: "year", year: 2024 }, 6, 4, 2],
    [{ mode: "month", month: "2024-01" }, 5, 3, 1],
    [{ mode: "range", from: "2024-01-02", to: "2024-01-02" }, 3, 2, 0],
  ] as const)(
    "recomputes rhythm only inside date scope %s",
    (date, messages, sessions, gaps) => {
      const result = select(fixture(), { date, participantId: null });
      expect(result.rhythm.available).toBe(true);
      if (!result.rhythm.available)
        throw new Error("Expected Everyone dynamics");
      expect(result.analysis.totals.messages).toBe(messages);
      expect(result.rhythm.analysis.messageCount).toBe(messages);
      expect(result.rhythm.analysis.sessionSummary.total).toBe(sessions);
      expect(result.rhythm.analysis.silenceSummary.total).toBe(gaps);
    },
  );

  it("starts at the selected boundary without importing the outside predecessor or long gap", () => {
    const dataset = fixture();
    const result = select(dataset, {
      date: { mode: "range", from: "2024-01-02", to: "2024-01-02" },
      participantId: null,
    });
    if (!result.rhythm.available) throw new Error("Expected Everyone dynamics");
    const rhythm = result.rhythm.analysis;
    expect(rhythm.transitions).toHaveLength(2);
    expect(rhythm.transitions.map((item) => item.delaySeconds)).toEqual([
      1800, 1860,
    ]);
    expect(rhythm.transitions.map((item) => item.sameSession)).toEqual([
      true,
      false,
    ]);
    expect(rhythm.silenceSummary).toEqual({
      total: 0,
      medianGapSeconds: null,
      longestGapSeconds: null,
    });
    expect(rhythm.sessions[0]).toMatchObject({
      starterId: dataset.participants[0].id,
      firstTimestamp: "2024-01-02T11:00",
      messageCount: 2,
    });
    expect(rhythm.rapidTransitions).toBe(0);
    // The senderless call at 11:50 must not bridge or split participant sessions.
    expect(result.analysis.totals.systemEvents).toBe(1);
    expect(rhythm.sessionSummary.total).toBe(2);
  });

  it("makes conversation-relative dynamics unavailable for a participant while preserving descriptive analysis", () => {
    const dataset = freeze(fixture());
    const before = JSON.stringify(dataset);
    for (const participant of dataset.participants) {
      const filters: WhatsAppAnalysisFilters = {
        date: { mode: "year", year: 2024 },
        participantId: participant.id,
      };
      const result = select(dataset, filters);
      expect(result.rhythm).toEqual({
        available: false,
        reason: "participant-filter",
      });
      expect(result.participant).toBe(participant);
      expect(result.analysis.totals.messages).toBe(3);
      expect(result.analysis.participants).toHaveLength(1);
      expect(result.analysis.totals.systemEvents).toBe(0);
    }
    expect(JSON.stringify(dataset)).toBe(before);
    expect(select(dataset).rhythm.available).toBe(true);
  });

  it("returns a truthful empty rhythm with Everyone rather than stale all-time facts", () => {
    const result = select(fixture(), {
      date: { mode: "month", month: "2024-03" },
      participantId: null,
    });
    if (!result.rhythm.available) throw new Error("Expected Everyone dynamics");
    expect(result.rhythm.analysis.messageCount).toBe(0);
    expect(result.rhythm.analysis.sessions).toEqual([]);
    expect(result.rhythm.analysis.transitions).toEqual([]);
    expect(result.rhythm.analysis.participants).toEqual([]);
    expect(result.rhythm.analysis.sessionSummary).toEqual({
      total: 0,
      medianMessages: null,
      longestByMessages: null,
      longestBySpan: null,
    });
    expect(result.rhythm.analysis.timing.medianSeconds).toBeNull();
  });

  it("does not expose rhythm on an invalid date choice", () => {
    const result = analyzeFilteredWhatsApp(fixture(), {
      date: { mode: "range", from: "2024-02-30", to: "2024-03-01" },
      participantId: null,
    });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("rhythm");
  });
});
