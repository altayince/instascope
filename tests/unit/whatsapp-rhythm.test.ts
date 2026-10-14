import { describe, expect, it } from "vitest";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import {
  analyzeConversationRhythm,
  delaySummary,
  isRapidParticipantTransition,
  RAPID_TRANSITION_MINUTES,
  SESSION_GAP_MINUTES,
  SILENCE_BREAK_HOURS,
} from "../../src/lib/whatsapp/rhythm";
import type { WhatsAppDataset } from "../../src/lib/whatsapp/types";

// Every label, body and URL in this file is fictional, generated test input.
const A = "Synthetic A";
const B = "Synthetic B";
const C = "Synthetic C";
const fixture = (...lines: string[]) =>
  parseWhatsApp(lines.join("\n"), "ymd-24h");
const analyze = (dataset: WhatsAppDataset) =>
  analyzeConversationRhythm(dataset.messages, dataset.participants);

function sequence(gaps: readonly number[], senders?: readonly string[]) {
  let value = Date.UTC(2024, 5, 1);
  const labels =
    senders ??
    Array.from({ length: gaps.length + 1 }, (_, index) => (index % 2 ? B : A));
  return fixture(
    ...labels.map((label, index) => {
      if (index) value += gaps[index - 1] * 1000;
      const timestamp = new Date(value)
        .toISOString()
        .slice(0, 19)
        .replace("T", ", ");
      return `${timestamp} - ${label}: Fictional message ${index}`;
    }),
  );
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
}

describe("recorded participant-message sessions", () => {
  it("keeps the documented product thresholds explicit", () => {
    expect(SESSION_GAP_MINUTES).toBe(30);
    expect(SILENCE_BREAK_HOURS).toBe(6);
    expect(RAPID_TRANSITION_MINUTES).toBe(5);
  });

  it("keeps an exactly 30-minute gap inside one session", () => {
    const output = analyze(sequence([1800]));
    expect(output.sessionSummary).toEqual({
      total: 1,
      medianMessages: 2,
      longestByMessages: { messageCount: 2, tiedSessions: 1 },
      longestBySpan: { spanSeconds: 1800, tiedSessions: 1 },
    });
    expect(output.sessions).toEqual([
      {
        starterId: output.participants[0].id,
        firstTimestamp: "2024-06-01T00:00:00",
        lastTimestamp: "2024-06-01T00:30:00",
        messageCount: 2,
        spanSeconds: 1800,
      },
    ]);
    expect(output.transitions[0].sameSession).toBe(true);
    expect(output.timing.buckets[3].count).toBe(1);
  });

  it("starts a new session only above 30 minutes and preserves tied longest values", () => {
    const output = analyze(sequence([1801]));
    expect(output.sessionSummary).toEqual({
      total: 2,
      medianMessages: 1,
      longestByMessages: { messageCount: 1, tiedSessions: 2 },
      longestBySpan: { spanSeconds: 0, tiedSessions: 2 },
    });
    expect(
      output.participants.map((participant) => participant.sessionsStarted),
    ).toEqual([1, 1]);
    expect(output.transitions[0]).toMatchObject({
      delaySeconds: 1801,
      sameSession: false,
    });
  });

  it("counts starters and keeps message-count and recorded-span ties independently", () => {
    const output = analyze(
      sequence([60, 1801, 60, 1801, 30], [A, B, B, C, C, A]),
    );
    expect(output.sessions.map((session) => session.messageCount)).toEqual([
      2, 2, 2,
    ]);
    expect(output.sessions.map((session) => session.spanSeconds)).toEqual([
      60, 60, 30,
    ]);
    expect(output.sessionSummary).toEqual({
      total: 3,
      medianMessages: 2,
      longestByMessages: { messageCount: 2, tiedSessions: 3 },
      longestBySpan: { spanSeconds: 60, tiedSessions: 2 },
    });
    expect(
      output.participants.map((participant) => participant.sessionsStarted),
    ).toEqual([1, 1, 1]);
  });

  it("computes median messages per session for odd and even session counts", () => {
    const odd = analyze(sequence([1801, 60, 1801, 60, 60, 60]));
    expect(odd.sessions.map((session) => session.messageCount)).toEqual([
      1, 2, 4,
    ]);
    expect(odd.sessionSummary.medianMessages).toBe(2);
    const even = analyze(sequence([1801, 60, 60, 60]));
    expect(even.sessions.map((session) => session.messageCount)).toEqual([
      1, 4,
    ]);
    expect(even.sessionSummary.medianMessages).toBe(2.5);
  });

  it("handles one message without inventing a predecessor, transition or gap", () => {
    const output = analyze(sequence([]));
    expect(output.messageCount).toBe(1);
    expect(output.sessionSummary).toEqual({
      total: 1,
      medianMessages: 1,
      longestByMessages: { messageCount: 1, tiedSessions: 1 },
      longestBySpan: { spanSeconds: 0, tiedSessions: 1 },
    });
    expect(output.silenceSummary).toEqual({
      total: 0,
      medianGapSeconds: null,
      longestGapSeconds: null,
    });
    expect(output.transitions).toEqual([]);
    expect(output.participants[0]).toMatchObject({
      sessionsStarted: 1,
      silenceBreakers: 0,
      rapidTransitions: 0,
      rapidShare: null,
      timing: {
        count: 0,
        medianSeconds: null,
        p25Seconds: null,
        p75Seconds: null,
      },
    });
  });

  it("returns unavailable timing summaries and no participant rows for an empty subset", () => {
    const dataset = sequence([60]);
    const output = analyzeConversationRhythm([], dataset.participants);
    expect(output.messageCount).toBe(0);
    expect(output.sessions).toEqual([]);
    expect(output.sessionSummary).toEqual({
      total: 0,
      medianMessages: null,
      longestByMessages: null,
      longestBySpan: null,
    });
    expect(output.silenceSummary).toEqual({
      total: 0,
      medianGapSeconds: null,
      longestGapSeconds: null,
    });
    expect(output.transitions).toEqual([]);
    expect(output.participants).toEqual([]);
    expect(output.rapidTransitions).toBe(0);
    expect(output.equalTimestampTransitions).toBe(0);
    expect(output.timing).toMatchObject({
      count: 0,
      medianSeconds: null,
      p25Seconds: null,
      p75Seconds: null,
    });
    expect(output.timing.buckets.map((bucket) => bucket.count)).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });

  it("sorts by recorded timestamp before ID without reordering the accepted input", () => {
    const dataset = freeze(
      fixture(
        `2024-06-01, 00:20:00 - ${C}: Last`,
        `2024-06-01, 00:00:00 - ${A}: First`,
        `2024-06-01, 00:10:00 - ${B}: Middle`,
      ),
    );
    const snapshot = JSON.stringify(dataset);
    const output = analyze(dataset);
    expect(output.sessions[0].starterId).toBe(
      dataset.messages[1].participantId,
    );
    expect(
      output.transitions.map((transition) => transition.delaySeconds),
    ).toEqual([600, 600]);
    expect(
      output.transitions.map((transition) => transition.toParticipantId),
    ).toEqual([
      dataset.messages[2].participantId,
      dataset.messages[0].participantId,
    ]);
    expect(JSON.stringify(dataset)).toBe(snapshot);
  });

  it("orders identical timestamps by accepted message ID with a stable original-index fallback", () => {
    const dataset = sequence([0, 0], [A, B, C]);
    dataset.messages[0].id = 20;
    dataset.messages[1].id = 10;
    dataset.messages[2].id = 10;
    freeze(dataset);
    const output = analyze(dataset);
    expect(output.sessions[0].starterId).toBe(
      dataset.messages[1].participantId,
    );
    expect(
      output.transitions.map((transition) => [
        transition.fromParticipantId,
        transition.toParticipantId,
      ]),
    ).toEqual([
      [dataset.messages[1].participantId, dataset.messages[2].participantId],
      [dataset.messages[2].participantId, dataset.messages[0].participantId],
    ]);
    expect(output.equalTimestampTransitions).toBe(2);
    expect(output.rapidTransitions).toBe(2);
    expect(output.sessionSummary.longestBySpan).toEqual({
      spanSeconds: 0,
      tiedSessions: 1,
    });
  });

  it("ignores system events between messages, including events inside a long gap", () => {
    const dataset = fixture(
      `2024-06-01, 00:00:00 - ${A}: First`,
      "2024-06-01, 00:20:00 - Synthetic system notice",
      "2024-06-01, 00:40:00 - [Anruf]",
      `2024-06-01, 01:00:00 - ${B}: Second`,
      "2024-06-01, 04:00:00 - Synthetic system notice",
      `2024-06-01, 07:00:00 - ${A}: Third`,
    );
    expect(dataset.systemEvents).toHaveLength(3);
    const output = analyze(dataset);
    expect(output.messageCount).toBe(3);
    expect(output.sessionSummary.total).toBe(3);
    expect(
      output.transitions.map((transition) => transition.delaySeconds),
    ).toEqual([3600, 21600]);
    expect(output.silenceSummary.total).toBe(1);
  });
});

describe("long gaps in the supplied export", () => {
  it("excludes below 6 hours and includes exactly 6 hours and above for multiple next senders", () => {
    const output = analyze(sequence([21599, 21600, 21601], [A, A, B, C]));
    expect(output.silenceSummary).toEqual({
      total: 2,
      medianGapSeconds: 21600.5,
      longestGapSeconds: 21601,
    });
    expect(
      output.participants.map((participant) => participant.silenceBreakers),
    ).toEqual([0, 1, 1]);
  });

  it("counts a qualifying long gap when the same participant is the next sender", () => {
    const output = analyze(sequence([21600], [A, A]));
    expect(output.silenceSummary).toEqual({
      total: 1,
      medianGapSeconds: 21600,
      longestGapSeconds: 21600,
    });
    expect(output.participants[0].silenceBreakers).toBe(1);
    expect(output.participants[0].sessionsStarted).toBe(2);
    expect(output.transitions).toEqual([]);
    expect(output.participants[0].rapidShare).toBeNull();
  });

  it("uses the odd-count median rather than an arithmetic mean dominated by the longest gap", () => {
    const output = analyze(sequence([21600, 21610, 864000]));
    expect(output.silenceSummary).toEqual({
      total: 3,
      medianGapSeconds: 21610,
      longestGapSeconds: 864000,
    });
  });

  it("requires an included predecessor at the start of a selected calendar-date subset", () => {
    const dataset = fixture(
      `2024-02-28, 23:55:00 - ${A}: Outside selection`,
      `2024-02-29, 06:00:00 - ${B}: First selected record`,
      `2024-02-29, 06:01:00 - ${C}: Last selected record`,
      `2024-03-01, 00:00:00 - ${A}: Outside selection`,
    );
    expect(analyze(dataset).silenceSummary.total).toBe(2);
    const selected = dataset.messages.filter(
      (message) => message.timestamp.date === "2024-02-29",
    );
    const output = analyzeConversationRhythm(selected, dataset.participants);
    expect(output.sessions[0].starterId).toBe(selected[0].participantId);
    expect(output.sessionSummary.total).toBe(1);
    expect(output.silenceSummary).toEqual({
      total: 0,
      medianGapSeconds: null,
      longestGapSeconds: null,
    });
    expect(output.transitions).toHaveLength(1);
    expect(
      output.participants.map((participant) => participant.displayName),
    ).toEqual([B, C]);
  });
});

describe("consecutive participant transitions", () => {
  it("preserves exported minute/second precision and counts only sender changes at equal timestamps", () => {
    const output = analyze(
      fixture(
        `2024-06-01, 00:00 - ${A}: First recorded minute`,
        `2024-06-01, 00:00:00 - ${A}: Same sender at the same clock value`,
        `2024-06-01, 00:00 - ${B}: Different sender at the same clock value`,
        `2024-06-01, 00:05 - ${A}: Later recorded minute`,
      ),
    );
    expect(
      output.transitions.map((transition) => transition.delaySeconds),
    ).toEqual([0, 300]);
    expect(output.transitions[0]).toMatchObject({
      fromTimestamp: "2024-06-01T00:00:00",
      toTimestamp: "2024-06-01T00:00",
    });
    expect(output.transitions[1].toTimestamp).toBe("2024-06-01T00:05");
    expect(output.equalTimestampTransitions).toBe(1);
    expect(output.rapidTransitions).toBe(2);
  });

  it("keeps session, long-gap, transition and rapid totals consistent with participant allocations", () => {
    const output = analyze(
      sequence(
        [0, 60, 1800, 1801, 21600, 300, 301, 21601],
        [A, A, B, C, B, B, C, A, C],
      ),
    );
    expect(
      output.sessions.reduce((sum, session) => sum + session.messageCount, 0),
    ).toBe(output.messageCount);
    expect(
      output.participants.reduce(
        (sum, participant) => sum + participant.sessionsStarted,
        0,
      ),
    ).toBe(output.sessionSummary.total);
    expect(
      output.participants.reduce(
        (sum, participant) => sum + participant.silenceBreakers,
        0,
      ),
    ).toBe(output.silenceSummary.total);
    expect(
      output.participants.reduce(
        (sum, participant) => sum + participant.timing.count,
        0,
      ),
    ).toBe(output.timing.count);
    expect(
      output.participants.reduce(
        (sum, participant) => sum + participant.rapidTransitions,
        0,
      ),
    ).toBe(output.rapidTransitions);
    for (let index = 0; index < output.timing.buckets.length; index++) {
      expect(
        output.participants.reduce(
          (sum, participant) => sum + participant.timing.buckets[index].count,
          0,
        ),
      ).toBe(output.timing.buckets[index].count);
    }
  });

  it("creates transitions for A to B to B to A only when the sender changes", () => {
    const output = analyze(sequence([30, 600, 90], [A, B, B, A]));
    expect(
      output.transitions.map((transition) => transition.delaySeconds),
    ).toEqual([30, 90]);
    expect(output.timing).toMatchObject({
      count: 2,
      medianSeconds: 60,
      p25Seconds: 45,
      p75Seconds: 75,
    });
    expect(
      output.participants.map((participant) => participant.timing.count),
    ).toEqual([1, 1]);
    expect(
      output.participants.map(
        (participant) => participant.timing.medianSeconds,
      ),
    ).toEqual([90, 30]);
  });

  it("attributes group transitions A to B to C to the next sender, preserving unranked participant order", () => {
    const dataset = sequence([20, 40], [A, B, C]);
    const output = analyzeConversationRhythm(
      dataset.messages,
      [...dataset.participants].reverse(),
    );
    expect(
      output.participants.map((participant) => participant.displayName),
    ).toEqual([C, B, A]);
    expect(
      output.participants.map((participant) => participant.timing.count),
    ).toEqual([1, 1, 0]);
    expect(
      output.participants.map(
        (participant) => participant.timing.medianSeconds,
      ),
    ).toEqual([40, 20, null]);
    expect(
      output.participants.map((participant) => participant.rapidShare),
    ).toEqual([1, 1, null]);
  });

  it("includes transitions across session boundaries in next-message timing", () => {
    const output = analyze(sequence([21600]));
    expect(output.transitions[0]).toMatchObject({
      delaySeconds: 21600,
      sameSession: false,
    });
    expect(output.timing.medianSeconds).toBe(21600);
    expect(output.participants[1].timing.medianSeconds).toBe(21600);
    expect(output.rapidTransitions).toBe(0);
    expect(output.participants[1].rapidShare).toBe(0);
  });

  it("produces body-free scalar context without retaining message, link or timestamp objects", () => {
    const dataset = freeze(
      fixture(
        `2024-06-01, 00:00:00 - ${A}: SYNTHETIC_BODY_SENTINEL https://example.org/synthetic-secret`,
        `2024-06-01, 00:01:00 - ${B}: SYNTHETIC_OTHER_BODY_SENTINEL`,
      ),
    );
    const output = analyze(dataset);
    expect(output.transitions).toEqual([
      {
        fromParticipantId: dataset.participants[0].id,
        toParticipantId: dataset.participants[1].id,
        fromDate: "2024-06-01",
        toDate: "2024-06-01",
        fromTimestamp: "2024-06-01T00:00:00",
        toTimestamp: "2024-06-01T00:01:00",
        delaySeconds: 60,
        sameSession: true,
      },
    ]);
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain("SYNTHETIC_BODY_SENTINEL");
    expect(serialized).not.toContain("SYNTHETIC_OTHER_BODY_SENTINEL");
    expect(serialized).not.toContain("https://example.org");
    const visit = (value: unknown) => {
      if (value !== null && typeof value === "object") {
        expect(dataset.messages).not.toContain(value);
        expect(
          dataset.messages.map((message) => message.timestamp),
        ).not.toContain(value);
        for (const [key, item] of Object.entries(value)) {
          expect([
            "content",
            "links",
            "emoji",
            "media",
            "message",
            "timestamp",
          ]).not.toContain(key);
          visit(item);
        }
      }
    };
    visit(output);
    expect(output.participants[0]).not.toBe(dataset.participants[0]);
    output.participants[0].displayName = "Changed synthetic output";
    expect(dataset.participants[0].displayName).toBe(A);
  });

  it("uses Gregorian wall-clock arithmetic across leap-day, month and year boundaries", () => {
    const leap = analyze(
      fixture(
        `2024-02-28, 23:59:59 - ${A}: Before leap date`,
        `2024-02-29, 00:00:00 - ${B}: Leap date`,
        `2024-02-29, 23:59:59 - ${C}: Leap date end`,
        `2024-03-01, 00:00:00 - ${A}: New month`,
      ),
    );
    expect(
      leap.transitions.map((transition) => transition.delaySeconds),
    ).toEqual([1, 86399, 1]);
    expect(leap.sessionSummary.longestBySpan).toEqual({
      spanSeconds: 1,
      tiedSessions: 2,
    });
    expect(leap.silenceSummary.total).toBe(1);
    const newYear = analyze(
      fixture(
        `2023-12-31, 23:59:59 - ${A}: Before new year`,
        `2024-01-01, 00:00:00 - ${B}: New year`,
      ),
    );
    expect(newYear.transitions[0]).toMatchObject({
      fromDate: "2023-12-31",
      toDate: "2024-01-01",
      delaySeconds: 1,
      sameSession: true,
    });
    const centuryLeap = analyze(
      fixture(
        `2000-02-28, 23:59:59 - ${A}: Before Gregorian century leap`,
        `2000-02-29, 00:00:00 - ${B}: Gregorian century leap`,
      ),
    );
    expect(centuryLeap.transitions[0].delaySeconds).toBe(1);
  });

  it("does not adjust a DST-looking recorded interval to an inferred timezone", () => {
    const output = analyze(
      fixture(
        `2025-03-30, 01:59:59 - ${A}: Earlier wall clock`,
        `2025-03-30, 03:00:00 - ${B}: Later wall clock`,
      ),
    );
    expect(output.transitions[0]).toMatchObject({
      delaySeconds: 3601,
      sameSession: false,
    });
  });
});

describe("median, quartiles and nonoverlapping delay distributions", () => {
  it.each([
    { delays: [120, 0, 60], median: 60, p25: 30, p75: 90 },
    { delays: [180, 60, 0, 120], median: 90, p25: 45, p75: 135 },
    { delays: [10, 30], median: 20, p25: 15, p75: 25 },
    { delays: [42], median: 42, p25: 42, p75: 42 },
  ])(
    "interpolates odd/even/single delay summaries for $delays without mutation",
    ({ delays, median, p25, p75 }) => {
      const original = [...delays];
      freeze(delays);
      expect(delaySummary(delays)).toMatchObject({
        count: delays.length,
        medianSeconds: median,
        p25Seconds: p25,
        p75Seconds: p75,
      });
      expect(delays).toEqual(original);
    },
  );

  it("returns null summary values when no transition evidence exists and independent bucket arrays", () => {
    const first = delaySummary([]);
    const second = delaySummary([]);
    expect(first).toMatchObject({
      count: 0,
      medianSeconds: null,
      p25Seconds: null,
      p75Seconds: null,
    });
    expect(first.buckets.map((bucket) => bucket.count)).toEqual([
      0, 0, 0, 0, 0,
    ]);
    first.buckets[0].count = 99;
    expect(second.buckets[0].count).toBe(0);
  });

  it("places exact 60, 300, 1800 and 21600 second boundaries into the next bucket", () => {
    const gaps = [0, 59, 60, 299, 300, 1799, 1800, 21599, 21600, 99999];
    const output = analyze(sequence(gaps));
    expect(output.timing.buckets).toEqual([
      { key: "under-1m", label: "Under 1 minute", count: 2 },
      { key: "1m-5m", label: "1 minute to under 5 minutes", count: 2 },
      { key: "5m-30m", label: "5 minutes to under 30 minutes", count: 2 },
      { key: "30m-6h", label: "30 minutes to under 6 hours", count: 2 },
      { key: "6h-plus", label: "6 hours or more", count: 2 },
    ]);
    expect(
      output.timing.buckets.reduce((sum, bucket) => sum + bucket.count, 0),
    ).toBe(output.transitions.length);
    expect(output.timing).toMatchObject({
      count: 10,
      medianSeconds: 1049.5,
      p25Seconds: 119.75,
      p75Seconds: 16649.25,
    });
    expect(
      output.participants.map((participant) => participant.rapidTransitions),
    ).toEqual([2, 3]);
    expect(
      output.participants.map((participant) => participant.rapidShare),
    ).toEqual([0.4, 0.6]);
  });
});

describe("rapid participant changes", () => {
  it("includes exactly 5 minutes but excludes above 5 minutes and same-sender gaps", () => {
    const output = analyze(sequence([300, 301, 1, 0], [A, B, A, A, B]));
    expect(
      output.transitions.map((transition) => transition.delaySeconds),
    ).toEqual([300, 301, 0]);
    expect(output.rapidTransitions).toBe(2);
    expect(output.equalTimestampTransitions).toBe(1);
    expect(
      output.participants.map((participant) => participant.rapidTransitions),
    ).toEqual([0, 2]);
    expect(
      output.participants.map((participant) => participant.rapidShare),
    ).toEqual([0, 1]);
  });

  it.each([
    {
      fromParticipantId: "a",
      toParticipantId: "b",
      delaySeconds: 300,
      sameSession: true,
      rapid: true,
    },
    {
      fromParticipantId: "a",
      toParticipantId: "b",
      delaySeconds: 0,
      sameSession: true,
      rapid: true,
    },
    {
      fromParticipantId: "a",
      toParticipantId: "b",
      delaySeconds: 301,
      sameSession: true,
      rapid: false,
    },
    {
      fromParticipantId: "a",
      toParticipantId: "a",
      delaySeconds: 1,
      sameSession: true,
      rapid: false,
    },
    {
      fromParticipantId: "a",
      toParticipantId: "b",
      delaySeconds: 1,
      sameSession: false,
      rapid: false,
    },
    {
      fromParticipantId: "a",
      toParticipantId: "b",
      delaySeconds: -1,
      sameSession: true,
      rapid: false,
    },
  ])(
    "requires a participant change inside a session for $delaySeconds seconds / $sameSession",
    ({ rapid, ...transition }) => {
      expect(isRapidParticipantTransition(transition)).toBe(rapid);
    },
  );
});
