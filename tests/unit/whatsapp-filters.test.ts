import { describe, expect, it } from "vitest";
import { analyzeWhatsApp } from "../../src/lib/whatsapp/analysis";
import {
  analyzeFilteredWhatsApp,
  DEFAULT_WHATSAPP_FILTERS,
  getWhatsAppFilterOptions,
  type WhatsAppAnalysisFilters,
  type WhatsAppDateFilter,
} from "../../src/lib/whatsapp/filters";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import type { WhatsAppDataset } from "../../src/lib/whatsapp/types";

// Fictional labels and text only. Calls use existing verified exact event markers.
const fixture = () =>
  parseWhatsApp(
    [
      "01/06/2022, 08:00 - [Anruf]",
      "31/12/2023, 23:59 - Synthetic One: A fictional line",
      "28/02/2024, 00:00 - Synthetic One: image omitted",
      "29/02/2024, 08:00 - [Anruf]",
      "29/02/2024, 12:00 - Synthetic One: https://example.org/one 🌿",
      "29/02/2024, 12:30 - Synthetic Two: [Anruf]",
      "01/03/2024, 23:59:59 - Synthetic Two: A fictional line",
      "02/03/2024, 00:00 - Synthetic One: [Anruf]",
      "03/03/2024, 10:00 - Synthetic Two: A fictional line",
      "04/03/2024, 18:00 - Synthetic system notice",
      "01/01/2025, 01:00 - Synthetic Two: [Anruf]",
      "31/12/2026, 23:59 - Synthetic system notice",
    ].join("\n"),
    "dmy-24h",
  );

function result(
  dataset: WhatsAppDataset,
  date: WhatsAppDateFilter = { mode: "all" },
  participantId: string | null = null,
) {
  const output = analyzeFilteredWhatsApp(dataset, { date, participantId });
  expect(output.ok).toBe(true);
  if (!output.ok) throw new Error(output.error);
  return output;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
}

describe("pure accepted-record WhatsApp filters", () => {
  it("keeps All time/Everyone analysis identical to the existing analyzer", () => {
    const dataset = fixture();
    const output = analyzeFilteredWhatsApp(dataset, DEFAULT_WHATSAPP_FILTERS);
    expect(output.ok).toBe(true);
    if (!output.ok) throw new Error(output.error);
    expect(output.analysis).toEqual(analyzeWhatsApp(dataset));
    expect(output.participant).toBeNull();
    expect(output.overview).toEqual({
      messagesPerActiveDate: 8 / 7,
      recognizedCallEvents: 5,
      attributedCallEvents: 3,
      unattributedCallEvents: 2,
    });
  });

  it("gets stable options from the full source, including dates with only system events", () => {
    const dataset = fixture();
    const options = getWhatsAppFilterOptions(dataset);
    expect(options.years).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(options.months).toEqual([
      "2022-06",
      "2023-12",
      "2024-02",
      "2024-03",
      "2025-01",
      "2026-12",
    ]);
    expect(options.participants).toEqual(dataset.participants);
    expect(options.participants).not.toBe(dataset.participants);
    result(dataset, { mode: "year", year: 2024 }, dataset.participants[0].id);
    expect(getWhatsAppFilterOptions(dataset)).toEqual(options);
  });

  it("recomputes the selected year, messages, active dates, media, links, emoji and calls", () => {
    const output = result(fixture(), { mode: "year", year: 2024 });
    expect(output.analysis.totals).toEqual({
      messages: 6,
      systemEvents: 2,
      participants: 2,
      mediaMessages: 1,
      links: 1,
      messagesWithLinks: 1,
      emoji: 1,
      messagesWithEmoji: 1,
      activeDays: 5,
    });
    expect(output.analysis.yearly).toEqual([
      { key: "2024", label: "2024", count: 6 },
    ]);
    expect(output.analysis.monthly.map((bucket) => bucket.count)).toEqual([
      3, 3,
    ]);
    expect(output.analysis.media).toEqual([
      { key: "image", label: "image", count: 1 },
    ]);
    expect(output.analysis.topEmoji).toEqual([
      { key: "🌿", label: "🌿", count: 1 },
    ]);
    expect(output.overview).toEqual({
      messagesPerActiveDate: 6 / 5,
      recognizedCallEvents: 3,
      attributedCallEvents: 2,
      unattributedCallEvents: 1,
    });
  });

  it("recomputes one calendar month without changing the export", () => {
    const output = result(fixture(), { mode: "month", month: "2024-02" });
    expect(output.analysis.totals.messages).toBe(3);
    expect(output.analysis.totals.systemEvents).toBe(1);
    expect(output.analysis.daily.map((bucket) => bucket.key)).toEqual([
      "2024-02-28",
      "2024-02-29",
    ]);
    expect(output.analysis.first?.local).toBe("2024-02-28T00:00");
    expect(output.analysis.latest?.local).toBe("2024-02-29T12:30");
    expect(output.analysis.longestStreak).toEqual({
      from: "2024-02-28",
      to: "2024-02-29",
      days: 2,
    });
  });

  it("includes both range boundaries, midnight and the final recorded second", () => {
    const output = result(fixture(), {
      mode: "range",
      from: "2024-02-28",
      to: "2024-03-01",
    });
    expect(output.analysis.totals.messages).toBe(4);
    expect(output.analysis.first?.local).toBe("2024-02-28T00:00");
    expect(output.analysis.latest?.local).toBe("2024-03-01T23:59:59");
    expect(output.analysis.daily.map((bucket) => bucket.key)).toEqual([
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
    expect(output.analysis.longestStreak?.days).toBe(3);
  });

  it("supports an equal-boundary leap date as one inclusive calendar date", () => {
    const output = result(fixture(), {
      mode: "range",
      from: "2024-02-29",
      to: "2024-02-29",
    });
    expect(output.analysis.totals.messages).toBe(2);
    expect(output.analysis.totals.activeDays).toBe(1);
    expect(output.analysis.totals.systemEvents).toBe(1);
    expect(output.overview.messagesPerActiveDate).toBe(2);
  });

  it("matches an exact exported participant ID, preserving its original label separately", () => {
    const dataset = fixture();
    const participant = dataset.participants[0];
    const output = result(dataset, { mode: "all" }, participant.id);
    expect(output.participant).toBe(participant);
    expect(output.analysis.totals.messages).toBe(4);
    expect(output.analysis.totals.participants).toBe(1);
    expect(output.analysis.participants[0]).toMatchObject({
      id: participant.id,
      displayName: "Synthetic One",
      messageCount: 4,
      mediaMessages: 1,
      links: 1,
      emoji: 1,
    });
    expect(output.analysis.totals.systemEvents).toBe(0);
    expect(output.overview.recognizedCallEvents).toBe(1);
    expect(output.overview.unattributedCallEvents).toBe(0);
  });

  it("combines participant and date filters instead of analyzing all records for either filter", () => {
    const dataset = fixture();
    const output = result(
      dataset,
      { mode: "month", month: "2024-02" },
      dataset.participants[0].id,
    );
    expect(output.analysis.totals.messages).toBe(2);
    expect(output.analysis.totals.activeDays).toBe(2);
    expect(output.analysis.totals.mediaMessages).toBe(1);
    expect(output.analysis.totals.links).toBe(1);
    expect(output.analysis.totals.systemEvents).toBe(0);
    expect(output.overview.recognizedCallEvents).toBe(0);
    expect(
      output.analysis.participants.map((item) => item.displayName),
    ).toEqual(["Synthetic One"]);
  });

  it("returns a truthful empty result with no spans, gap, streak or fabricated averages", () => {
    const dataset = fixture();
    const output = result(
      dataset,
      { mode: "year", year: 2030 },
      dataset.participants[0].id,
    );
    expect(output.participant).toBe(dataset.participants[0]);
    expect(output.analysis.totals).toEqual({
      messages: 0,
      systemEvents: 0,
      participants: 0,
      mediaMessages: 0,
      links: 0,
      messagesWithLinks: 0,
      emoji: 0,
      messagesWithEmoji: 0,
      activeDays: 0,
    });
    expect(output.analysis.participants).toEqual([]);
    expect(output.analysis.first).toBeNull();
    expect(output.analysis.latest).toBeNull();
    expect(output.analysis.longestGap).toBeNull();
    expect(output.analysis.longestStreak).toBeNull();
    expect(output.analysis.calendarSpanDays).toBe(0);
    expect(output.analysis.observedSpanSeconds).toBe(0);
    expect(output.overview.messagesPerActiveDate).toBeNull();
    expect(output.heatmap.flat().every((count) => count === 0)).toBe(true);
  });

  it("retains senderless call evidence for Everyone without treating it as message activity", () => {
    const output = result(fixture(), { mode: "year", year: 2022 });
    expect(output.analysis.totals.messages).toBe(0);
    expect(output.analysis.totals.systemEvents).toBe(1);
    expect(output.analysis.totals.activeDays).toBe(0);
    expect(output.analysis.first).toBeNull();
    expect(output.overview).toEqual({
      messagesPerActiveDate: null,
      recognizedCallEvents: 1,
      attributedCallEvents: 0,
      unattributedCallEvents: 1,
    });
    expect(output.heatmap.flat().reduce((sum, count) => sum + count, 0)).toBe(
      0,
    );
  });

  it("never attributes a senderless event by proximity or participant names inside content", () => {
    const dataset = parseWhatsApp(
      [
        "29/02/2024, 12:00 - Synthetic One: Hello",
        "29/02/2024, 12:01 - [Anruf]",
        "29/02/2024, 12:02 - Synthetic One was mentioned by the system",
        "29/02/2024, 12:03 - Synthetic Two: [Anruf]",
      ].join("\n"),
      "dmy-24h",
    );
    expect(result(dataset).overview.recognizedCallEvents).toBe(2);
    const one = result(dataset, { mode: "all" }, dataset.participants[0].id);
    expect(one.analysis.totals.systemEvents).toBe(0);
    expect(one.overview.recognizedCallEvents).toBe(0);
    const two = result(dataset, { mode: "all" }, dataset.participants[1].id);
    expect(two.overview).toMatchObject({
      attributedCallEvents: 1,
      unattributedCallEvents: 0,
    });
  });

  it("does not invent call markers from arbitrary call prose", () => {
    const dataset = parseWhatsApp(
      [
        "01/03/2024, 12:00 - Synthetic One: We should call soon",
        "01/03/2024, 12:01 - Incoming call",
      ].join("\n"),
      "dmy-24h",
    );
    expect(result(dataset).overview.recognizedCallEvents).toBe(0);
  });

  it("recomputes participant gaps and streaks only from that participant's matching messages", () => {
    const dataset = parseWhatsApp(
      [
        "28/02/2024, 12:00 - Synthetic One: First",
        "29/02/2024, 12:00 - Synthetic Two: Middle",
        "01/03/2024, 12:00 - Synthetic One: Last",
      ].join("\n"),
      "dmy-24h",
    );
    const everyone = result(dataset);
    expect(everyone.analysis.longestStreak?.days).toBe(3);
    expect(everyone.analysis.longestGap?.wallClockSeconds).toBe(86400);
    const one = result(dataset, { mode: "all" }, dataset.participants[0].id);
    expect(one.analysis.longestStreak?.days).toBe(1);
    expect(one.analysis.longestGap?.wallClockSeconds).toBe(172800);
    expect(one.analysis.longestGap?.from.date).toBe("2024-02-28");
    expect(one.analysis.longestGap?.to.date).toBe("2024-03-01");
    const cropped = result(
      dataset,
      { mode: "range", from: "2024-02-29", to: "2024-03-01" },
      dataset.participants[0].id,
    );
    expect(cropped.analysis.longestGap).toBeNull();
    expect(cropped.analysis.longestStreak).toEqual({
      from: "2024-03-01",
      to: "2024-03-01",
      days: 1,
    });
  });

  it("does not mutate deeply frozen source records, source Doctor or filters", () => {
    const dataset = freeze(fixture());
    const filters = freeze<WhatsAppAnalysisFilters>({
      date: { mode: "month", month: "2024-02" },
      participantId: dataset.participants[0].id,
    });
    const serialized = JSON.stringify(dataset);
    const metadata = dataset.metadata;
    const doctor = dataset.metadata.doctor;
    const messages = dataset.messages;
    const systemEvents = dataset.systemEvents;
    expect(analyzeFilteredWhatsApp(dataset, filters).ok).toBe(true);
    getWhatsAppFilterOptions(dataset);
    expect(dataset.metadata).toBe(metadata);
    expect(dataset.metadata.doctor).toBe(doctor);
    expect(dataset.messages).toBe(messages);
    expect(dataset.systemEvents).toBe(systemEvents);
    expect(JSON.stringify(dataset)).toBe(serialized);
    expect(filters.date).toEqual({ mode: "month", month: "2024-02" });
  });

  it("keeps unsupported source emoji statistics unavailable even when the filter is empty", () => {
    const dataset = fixture();
    for (const message of dataset.messages) message.emoji = null;
    dataset.metadata.warnings.push({
      code: "emoji-unavailable",
      message: "Synthetic browser limitation",
    });
    const output = result(dataset, { mode: "year", year: 2030 });
    expect(output.analysis.totals.emoji).toBeNull();
    expect(output.analysis.totals.messagesWithEmoji).toBeNull();
    expect(output.analysis.topEmoji).toEqual([]);
    const selected = result(dataset, { mode: "month", month: "2024-02" });
    expect(
      selected.analysis.participants.every(
        (item) => item.emoji === null && item.messagesWithEmoji === null,
      ),
    ).toBe(true);
  });
});

describe("strict recorded-calendar filter validation", () => {
  it.each([999, 10000, 2024.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid year %s",
    (year) => {
      expect(
        analyzeFilteredWhatsApp(fixture(), {
          date: { mode: "year", year },
          participantId: null,
        }),
      ).toEqual({
        ok: false,
        error: "Choose a valid four-digit year.",
      });
    },
  );

  it.each([
    "2024-00",
    "2024-13",
    "2024-2",
    "024-02",
    "0999-02",
    "10000-02",
    "2024-02-01",
    "2024-02 ",
  ])("rejects malformed month %s", (month) => {
    expect(
      analyzeFilteredWhatsApp(fixture(), {
        date: { mode: "month", month },
        participantId: null,
      }).ok,
    ).toBe(false);
  });

  it.each([
    "2023-02-29",
    "2100-02-29",
    "2024-02-30",
    "2024-04-31",
    "2024-00-01",
    "2024-13-01",
    "2024-03-00",
    "2024-03-32",
    "2024-2-29",
    "2024-02-9",
    "0999-12-31",
    "10000-01-01",
    "2024-02-29T00:00",
    "2024-02-29Z",
    "2024-02-29 ",
    "",
  ])("rejects impossible or non-ISO range boundary %s", (date) => {
    for (const range of [
      { from: date, to: "2024-12-31" },
      { from: "2024-01-01", to: date },
    ])
      expect(
        analyzeFilteredWhatsApp(fixture(), {
          date: { mode: "range", ...range },
          participantId: null,
        }).ok,
      ).toBe(false);
  });

  it("rejects reversed ranges with a controlled error", () => {
    expect(
      analyzeFilteredWhatsApp(fixture(), {
        date: { mode: "range", from: "2024-03-01", to: "2024-02-29" },
        participantId: null,
      }),
    ).toEqual({
      ok: false,
      error: "The end date must be on or after the start date.",
    });
  });

  it.each([1000, 9999])("accepts boundary Gregorian year %s", (year) => {
    expect(
      result(fixture(), { mode: "year", year }).analysis.totals.messages,
    ).toBe(0);
    expect(
      result(fixture(), { mode: "month", month: `${year}-01` }).analysis.totals
        .messages,
    ).toBe(0);
    expect(
      result(fixture(), {
        mode: "range",
        from: `${year}-01-01`,
        to: `${year}-12-31`,
      }).analysis.totals.messages,
    ).toBe(0);
  });

  it("accepts Gregorian 400-year leap dates and includes a year-crossing boundary", () => {
    const dataset = parseWhatsApp(
      [
        "29/02/2000, 00:00 - Synthetic One: Gregorian leap day",
        "31/12/2023, 23:59 - Synthetic One: Year end",
        "01/01/2024, 00:00 - Synthetic Two: Year start",
      ].join("\n"),
      "dmy-24h",
    );
    expect(
      result(dataset, { mode: "range", from: "2000-02-29", to: "2000-02-29" })
        .analysis.totals.messages,
    ).toBe(1);
    expect(
      result(dataset, { mode: "range", from: "2023-12-31", to: "2024-01-01" })
        .analysis.longestStreak,
    ).toEqual({
      from: "2023-12-31",
      to: "2024-01-01",
      days: 2,
    });
  });

  it.each(["missing", "Synthetic One", "__proto__", "Participant-1"])(
    "rejects unknown participant ID %s without falling back to Everyone",
    (participantId) => {
      expect(
        analyzeFilteredWhatsApp(fixture(), {
          date: { mode: "all" },
          participantId,
        }),
      ).toEqual({
        ok: false,
        error: "Choose a participant label from this export.",
      });
    },
  );

  it("rejects an unsupported runtime mode instead of exposing unfiltered data", () => {
    const date = { mode: "unsupported" } as unknown as WhatsAppDateFilter;
    expect(
      analyzeFilteredWhatsApp(fixture(), { date, participantId: null }),
    ).toEqual({
      ok: false,
      error: "Choose a supported date filter.",
    });
  });
});

describe("recorded weekday × hour message matrix", () => {
  it("creates exactly seven Monday-first independent rows and 24 recorded-hour columns", () => {
    const dataset = parseWhatsApp(
      [
        ...Array.from(
          { length: 7 },
          (_, index) =>
            `${24 + index}/06/2024, 0${index}:00 - Synthetic One: A fictional line`,
        ),
        "24/06/2024, 23:00 - Synthetic Two: Another fictional line",
        "24/06/2024, 23:00 - Synthetic Two: Repeated recorded hour",
        "24/06/2024, 23:00 - [Anruf]",
      ].join("\n"),
      "dmy-24h",
    );
    const output = result(dataset);
    expect(output.heatmap).toHaveLength(7);
    expect(output.heatmap.every((row) => row.length === 24)).toBe(true);
    for (let weekday = 0; weekday < 7; weekday++)
      expect(output.heatmap[weekday][weekday]).toBe(1);
    expect(output.heatmap[0][23]).toBe(2);
    expect(output.heatmap.flat().reduce((sum, count) => sum + count, 0)).toBe(
      9,
    );
    expect(output.heatmap[0]).not.toBe(output.heatmap[1]);
    expect(
      output.heatmap.map((row) => row.reduce((sum, count) => sum + count, 0)),
    ).toEqual(output.analysis.weekdays.map((bucket) => bucket.count));
    expect(
      Array.from({ length: 24 }, (_, hour) =>
        output.heatmap.reduce((sum, row) => sum + row[hour], 0),
      ),
    ).toEqual(output.analysis.hours.map((bucket) => bucket.count));
  });

  it("applies combined date/participant filters and never counts system events", () => {
    const dataset = fixture();
    const output = result(
      dataset,
      { mode: "month", month: "2024-02" },
      dataset.participants[0].id,
    );
    expect(output.heatmap[2][0]).toBe(1); // Wednesday 28 February.
    expect(output.heatmap[3][12]).toBe(1); // Thursday leap date.
    expect(output.heatmap[3][8]).toBe(0); // Senderless call marker is not a message.
    expect(output.heatmap.flat().reduce((sum, count) => sum + count, 0)).toBe(
      2,
    );
    expect(
      output.heatmap.map((row) => row.reduce((sum, count) => sum + count, 0)),
    ).toEqual(output.analysis.weekdays.map((bucket) => bucket.count));
  });

  it("uses recorded clock fields across a DST-looking range without adjusting timezone", () => {
    const dataset = parseWhatsApp(
      [
        "30/03/2025, 01:00 - Synthetic One: Before",
        "30/03/2025, 03:00 - Synthetic One: After",
      ].join("\n"),
      "dmy-24h",
    );
    const output = result(dataset);
    expect(output.heatmap[6][1]).toBe(1);
    expect(output.heatmap[6][2]).toBe(0);
    expect(output.heatmap[6][3]).toBe(1);
    expect(output.analysis.longestGap?.wallClockSeconds).toBe(7200);
  });
});
