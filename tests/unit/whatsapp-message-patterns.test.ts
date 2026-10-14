import { describe, expect, it } from "vitest";
import {
  analyzeWhatsAppMessagePatterns,
  BURST_WINDOW_MINUTES,
} from "../../src/lib/whatsapp/message-patterns";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import type {
  WhatsAppDataset,
  WhatsAppMessage,
} from "../../src/lib/whatsapp/types";

// All labels, content, dates, coordinates and URLs below are synthetic test input.
const A = "Synthetic A";
const B = "Synthetic B";
const C = "Synthetic C";
const fixture = (lines: readonly string[]) =>
  parseWhatsApp(lines.join("\n"), "ymd-24h");
const analyze = (dataset: WhatsAppDataset) =>
  analyzeWhatsAppMessagePatterns(dataset.messages, dataset.participants);

function sequence(
  offsets: readonly number[],
  senders: readonly string[] = offsets.map(() => A),
  contents: readonly string[] = offsets.map((_, index) => `Fictional ${index}`),
) {
  return fixture(
    offsets.map((offset, index) => {
      const timestamp = new Date(Date.UTC(2024, 5, 1) + offset * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", ", ");
      return `${timestamp} - ${senders[index]}: ${contents[index]}`;
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

describe("consecutive selected participant-message runs", () => {
  it.each([
    { senders: [A, A, B], total: 2, medianLength: 1.5, longest: 2 },
    { senders: [A, A, A], total: 1, medianLength: 3, longest: 3 },
    { senders: [A, B, A], total: 3, medianLength: 1, longest: 1 },
  ])("counts runs for $senders", ({ senders, ...expected }) => {
    const output = analyze(
      sequence(
        senders.map((_, index) => index),
        senders,
      ),
    );
    expect(output.runs).toMatchObject(expected);
    expect(output.participants.map((participant) => participant.runs)).toEqual(
      senders[1] === B
        ? [
            { count: 2, medianLength: 1, longest: 1 },
            { count: 1, medianLength: 1, longest: 1 },
          ]
        : senders[2] === B
          ? [
              { count: 1, medianLength: 2, longest: 2 },
              { count: 1, medianLength: 1, longest: 1 },
            ]
          : [{ count: 1, medianLength: 3, longest: 3 }],
    );
  });

  it("ends a group run at every label switch, preserving supplied participant order", () => {
    const dataset = sequence([0, 1, 2, 3, 4, 5, 6], [A, A, B, C, C, B, A]);
    const output = analyzeWhatsAppMessagePatterns(
      dataset.messages,
      [...dataset.participants].reverse(),
    );
    expect(output.runs).toMatchObject({
      total: 5,
      medianLength: 1,
      longest: 2,
    });
    expect(
      output.participants.map((participant) => participant.displayName),
    ).toEqual([C, B, A]);
    expect(output.participants.map((participant) => participant.runs)).toEqual([
      { count: 1, medianLength: 2, longest: 2 },
      { count: 2, medianLength: 1, longest: 1 },
      { count: 2, medianLength: 1.5, longest: 2 },
    ]);
  });

  it("does not split the same participant's run at a long recorded gap", () => {
    const output = analyze(sequence([0, 86400, 172800]));
    expect(output.runs).toMatchObject({
      total: 1,
      medianLength: 3,
      longest: 3,
    });
    expect(output.participants[0].runs).toEqual({
      count: 1,
      medianLength: 3,
      longest: 3,
    });
    expect(output.burst).toMatchObject({ maximum: 1, tiedWindows: 3 });
  });

  it("sorts accepted wall-clock values before record IDs without mutating inputs", () => {
    const dataset = sequence([1200, 0, 600], [A, A, B]);
    const original = JSON.stringify(dataset);
    freeze(dataset);
    const output = analyze(dataset);
    expect(output.runs).toMatchObject({
      total: 3,
      medianLength: 1,
      longest: 1,
    });
    expect(output.burst.examples[0]).toEqual({
      from: "2024-06-01T00:00:00",
      to: "2024-06-01T00:10:00",
    });
    expect(JSON.stringify(dataset)).toBe(original);
  });

  it("orders equal timestamps by ID with original-index fallback for duplicate IDs", () => {
    const dataset = sequence([0, 0, 0], [A, B, A]);
    dataset.messages[0].id = 20;
    dataset.messages[1].id = 10;
    dataset.messages[2].id = 10;
    freeze(dataset);
    const output = analyze(dataset);
    expect(output.runs).toMatchObject({
      total: 2,
      medianLength: 1.5,
      longest: 2,
    });
    expect(output.participants.map((participant) => participant.runs)).toEqual([
      { count: 1, medianLength: 2, longest: 2 },
      { count: 1, medianLength: 1, longest: 1 },
    ]);
  });

  it("keeps fixed distribution buckets at every inclusive run-length boundary", () => {
    const lengths = [1, 2, 3, 5, 6, 10, 11, 12];
    const senders = lengths.flatMap((length, index) =>
      Array.from({ length }, () => (index % 2 === 0 ? A : B)),
    );
    const output = analyze(
      sequence(
        senders.map((_, index) => index),
        senders,
      ),
    );
    expect(output.runs).toEqual({
      total: 8,
      medianLength: 5.5,
      longest: 12,
      distribution: [
        { key: "1", label: "1", count: 1 },
        { key: "2", label: "2", count: 1 },
        { key: "3-5", label: "3–5", count: 2 },
        { key: "6-10", label: "6–10", count: 2 },
        { key: "11-plus", label: "11+", count: 2 },
      ],
    });
    expect(output.participants.map((participant) => participant.runs)).toEqual([
      { count: 4, medianLength: 4.5, longest: 11 },
      { count: 4, medianLength: 7.5, longest: 12 },
    ]);
    expect(
      output.runs.distribution.reduce((sum, bucket) => sum + bucket.count, 0),
    ).toBe(output.runs.total);
  });

  it("treats the supplied participant subset as authoritative for adjacency", () => {
    const dataset = sequence([0, 1, 2, 3, 4], [A, B, A, C, A]);
    const selected = dataset.messages.filter(
      (message) => message.participantId === dataset.participants[0].id,
    );
    const output = analyzeWhatsAppMessagePatterns(
      selected,
      dataset.participants,
    );
    expect(output.messageCount).toBe(3);
    expect(output.runs).toMatchObject({
      total: 1,
      medianLength: 3,
      longest: 3,
    });
    expect(
      output.participants.map((participant) => participant.displayName),
    ).toEqual([A]);
  });

  it("cannot count system events or use them to extend a message burst", () => {
    const dataset = fixture([
      `2024-06-01, 00:00:00 - ${A}: Fictional first`,
      "2024-06-01, 00:05:00 - Synthetic system notice?",
      "2024-06-01, 00:10:00 - [Anruf]",
      `2024-06-01, 00:10:01 - ${A}: Fictional second`,
      "2024-06-01, 00:12:00 - Synthetic system notice?",
      `2024-06-01, 00:20:02 - ${B}: Fictional third`,
    ]);
    expect(dataset.systemEvents).toHaveLength(3);
    const output = analyze(dataset);
    expect(output.messageCount).toBe(3);
    expect(output.runs).toMatchObject({
      total: 2,
      medianLength: 1.5,
      longest: 2,
    });
    expect(output.burst).toMatchObject({ maximum: 1, tiedWindows: 3 });
    expect(output.questionMarks).toEqual({
      messages: 0,
      occurrences: 0,
      share: 0,
    });
  });

  it("returns unavailable empty summaries and independent five-bucket arrays", () => {
    const dataset = sequence([0], [A]);
    const first = analyzeWhatsAppMessagePatterns([], dataset.participants);
    const second = analyzeWhatsAppMessagePatterns([], dataset.participants);
    expect(first).toEqual({
      messageCount: 0,
      runs: {
        total: 0,
        medianLength: null,
        longest: null,
        distribution: [
          { key: "1", label: "1", count: 0 },
          { key: "2", label: "2", count: 0 },
          { key: "3-5", label: "3–5", count: 0 },
          { key: "6-10", label: "6–10", count: 0 },
          { key: "11-plus", label: "11+", count: 0 },
        ],
      },
      burst: { maximum: 0, tiedWindows: 0, examples: [] },
      questionMarks: { messages: 0, occurrences: 0, share: null },
      participants: [],
    });
    first.runs.distribution[0].count = 99;
    expect(second.runs.distribution[0].count).toBe(0);
  });

  it("defines one length-one run and one recorded burst window for a single message", () => {
    const output = analyze(sequence([0], [A], ["One fictional question?"]));
    expect(output.runs).toMatchObject({
      total: 1,
      medianLength: 1,
      longest: 1,
    });
    expect(output.burst).toEqual({
      maximum: 1,
      tiedWindows: 1,
      examples: [{ from: "2024-06-01T00:00:00", to: "2024-06-01T00:00:00" }],
    });
    expect(output.participants[0].questionMarks).toEqual({
      messages: 1,
      occurrences: 1,
      share: 1,
    });
  });
});

describe("inclusive rolling recorded 10-minute message bursts", () => {
  it("keeps the explicit product window at ten minutes", () => {
    expect(BURST_WINDOW_MINUTES).toBe(10);
  });

  it.each([
    { second: 600, maximum: 2, tiedWindows: 1 },
    { second: 601, maximum: 1, tiedWindows: 2 },
  ])(
    "uses the inclusive boundary at $second seconds",
    ({ second, ...expected }) => {
      const output = analyze(sequence([0, second], [A, B]));
      expect(output.burst).toMatchObject(expected);
    },
  );

  it("slides past the first message to find the maximum, without anchored bins", () => {
    const output = analyze(sequence([0, 550, 600, 650, 1150]));
    expect(output.burst).toEqual({
      maximum: 4,
      tiedWindows: 1,
      examples: [{ from: "2024-06-01T00:09:10", to: "2024-06-01T00:19:10" }],
    });
  });

  it("finds windows that cross fixed ten-minute calendar boundaries", () => {
    const output = analyze(sequence([590, 600, 601, 610]));
    expect(output.burst).toEqual({
      maximum: 4,
      tiedWindows: 1,
      examples: [{ from: "2024-06-01T00:09:50", to: "2024-06-01T00:10:10" }],
    });
  });

  it("calculates each participant's maximum from their own records and end values", () => {
    const output = analyze(
      sequence([0, 100, 200, 701, 702, 703], [A, A, B, B, B, B]),
    );
    expect(output.burst.maximum).toBe(4);
    expect(output.participants.map((participant) => participant.burst)).toEqual(
      [
        {
          maximum: 2,
          tiedWindows: 1,
          examples: [
            { from: "2024-06-01T00:00:00", to: "2024-06-01T00:01:40" },
          ],
        },
        {
          maximum: 4,
          tiedWindows: 1,
          examples: [
            { from: "2024-06-01T00:03:20", to: "2024-06-01T00:11:43" },
          ],
        },
      ],
    );
  });

  it("does not count another participant's later endpoint as a per-label tie", () => {
    const output = analyze(sequence([0, 600], [A, B]));
    expect(output.burst).toMatchObject({ maximum: 2, tiedWindows: 1 });
    expect(
      output.participants.map((participant) => participant.burst.tiedWindows),
    ).toEqual([1, 1]);
  });

  it("includes all records at the same ending timestamp before evaluating one window", () => {
    const output = analyze(sequence([0, 600, 600, 600], [A, B, A, B]));
    expect(output.burst).toEqual({
      maximum: 4,
      tiedWindows: 1,
      examples: [{ from: "2024-06-01T00:00:00", to: "2024-06-01T00:10:00" }],
    });
    expect(
      output.participants.map((participant) => participant.burst.maximum),
    ).toEqual([2, 2]);
    expect(
      output.participants.map((participant) => participant.burst.tiedWindows),
    ).toEqual([1, 1]);
  });

  it("counts overlapping tied maximum windows at all distinct recorded ends", () => {
    const output = analyze(sequence([0, 300, 600, 900, 1200, 1500]));
    expect(output.burst).toEqual({
      maximum: 3,
      tiedWindows: 4,
      examples: [
        { from: "2024-06-01T00:00:00", to: "2024-06-01T00:10:00" },
        { from: "2024-06-01T00:05:00", to: "2024-06-01T00:15:00" },
        { from: "2024-06-01T00:10:00", to: "2024-06-01T00:20:00" },
      ],
    });
    expect(output.participants[0].burst).toEqual(output.burst);
  });

  it("discards earlier lower-maximum examples when a later window is larger", () => {
    const output = analyze(sequence([0, 1200, 2400, 3600, 3601, 3602]));
    expect(output.burst).toEqual({
      maximum: 3,
      tiedWindows: 1,
      examples: [{ from: "2024-06-01T01:00:00", to: "2024-06-01T01:00:02" }],
    });
  });

  it("preserves recorded timestamp precision instead of fabricating a window start", () => {
    const dataset = fixture([
      `2024-06-01, 00:07 - ${A}: Fictional first`,
      `2024-06-01, 00:08:00 - ${A}: Fictional last`,
    ]);
    expect(analyze(dataset).burst).toEqual({
      maximum: 2,
      tiedWindows: 1,
      examples: [{ from: "2024-06-01T00:07", to: "2024-06-01T00:08:00" }],
    });
  });

  it.each([
    { from: "2024-02-28, 23:55:00", to: "2024-02-29, 00:05:00" },
    { from: "2024-02-29, 23:55:00", to: "2024-03-01, 00:05:00" },
    { from: "2023-12-31, 23:55:00", to: "2024-01-01, 00:05:00" },
    { from: "2000-02-28, 23:55:00", to: "2000-02-29, 00:05:00" },
  ])(
    "uses Gregorian wall-clock arithmetic across $from / $to",
    ({ from, to }) => {
      const output = analyze(
        fixture([
          `${from} - ${A}: Fictional first`,
          `${to} - ${B}: Fictional last`,
        ]),
      );
      expect(output.burst).toEqual({
        maximum: 2,
        tiedWindows: 1,
        examples: [
          { from: from.replace(", ", "T"), to: to.replace(", ", "T") },
        ],
      });
    },
  );

  it("does not adjust a DST-looking recorded gap to an inferred timezone", () => {
    const output = analyze(
      fixture([
        `2025-03-30, 01:59:59 - ${A}: Fictional earlier wall clock`,
        `2025-03-30, 03:00:00 - ${B}: Fictional later wall clock`,
      ]),
    );
    expect(output.burst).toMatchObject({ maximum: 1, tiedWindows: 2 });
  });
});

describe("literal ASCII question-mark counts", () => {
  it("counts matching messages separately from occurrences with all messages in the share", () => {
    const output = analyze(
      sequence(
        [0, 1, 2, 3, 4],
        [A, A, B, B, C],
        [
          "Fictional statement",
          "Fictional question?",
          "Fictional questions?? ?",
          "",
          "Fictional last?",
        ],
      ),
    );
    expect(output.questionMarks).toEqual({
      messages: 3,
      occurrences: 5,
      share: 3 / 5,
    });
    expect(
      output.participants.map((participant) => participant.questionMarks),
    ).toEqual([
      { messages: 1, occurrences: 1, share: 1 / 2 },
      { messages: 1, occurrences: 3, share: 1 / 2 },
      { messages: 1, occurrences: 1, share: 1 },
    ]);
  });

  it("counts ASCII question marks alongside Unicode text and emoji without semantic detection", () => {
    const output = analyze(
      sequence(
        [0, 1, 2],
        [A, A, A],
        [
          "Fictional ¿ ？ ⁇ ؟ ❓ 😀",
          "Fictional? 😀 Türkçe Größe?\nFictional?",
          "A fictional interrogative sentence without punctuation",
        ],
      ),
    );
    expect(output.questionMarks).toEqual({
      messages: 1,
      occurrences: 3,
      share: 1 / 3,
    });
  });

  it("includes literal question marks from URL queries and typed location records", () => {
    const dataset = sequence(
      [0, 1, 2],
      [A, B, B],
      [
        "https://example.invalid/?synthetic=1?more=2",
        "Standort: 0, 0 - https://maps.google.com/?q=0,0",
        "<Media omitted>",
      ],
    );
    expect(dataset.messages[1].event?.kind).toBe("location");
    expect(dataset.messages[1].links).toEqual([]);
    const output = analyze(dataset);
    expect(output.questionMarks).toEqual({
      messages: 2,
      occurrences: 3,
      share: 2 / 3,
    });
    expect(
      output.participants.map((participant) => participant.questionMarks),
    ).toEqual([
      { messages: 1, occurrences: 2, share: 1 },
      { messages: 1, occurrences: 1, share: 1 / 2 },
    ]);
  });

  it("returns zero share for selected messages containing no literal question marks", () => {
    const output = analyze(
      sequence([0, 1], [A, B], ["Fictional", "Fictional"]),
    );
    expect(output.questionMarks).toEqual({
      messages: 0,
      occurrences: 0,
      share: 0,
    });
    expect(
      output.participants.map((participant) => participant.questionMarks.share),
    ).toEqual([0, 0]);
  });
});

describe("pure bounded message-pattern output", () => {
  it("retains only defined scalar aggregates and contexts with no input object references", () => {
    const dataset = sequence(
      [0, 60, 600],
      [A, B, A],
      [
        "SYNTHETIC_BODY_SENTINEL? https://example.invalid/?synthetic=1",
        "SYNTHETIC_OTHER_BODY_SENTINEL",
        "SYNTHETIC_LAST_BODY_SENTINEL?",
      ],
    );
    Object.assign(dataset.participants[0], {
      privateSentinel: "SYNTHETIC_EXTRA_FIELD",
    });
    const original = JSON.stringify(dataset);
    freeze(dataset);
    const output = analyze(dataset);
    const serialized = JSON.stringify(output);
    expect(serialized).not.toMatch(
      /SYNTHETIC_|example\.invalid|privateSentinel/,
    );
    expect(Object.keys(output).sort()).toEqual([
      "burst",
      "messageCount",
      "participants",
      "questionMarks",
      "runs",
    ]);
    for (const participant of output.participants) {
      expect(Object.keys(participant).sort()).toEqual([
        "burst",
        "displayName",
        "id",
        "questionMarks",
        "runs",
      ]);
    }
    const sourceObjects = new Set<unknown>([
      ...dataset.messages,
      ...dataset.messages.map((message) => message.timestamp),
      ...dataset.messages.map((message) => message.links),
      ...dataset.participants,
    ]);
    const visit = (value: unknown) => {
      if (value !== null && typeof value === "object") {
        expect(sourceObjects.has(value)).toBe(false);
        for (const [key, item] of Object.entries(value)) {
          expect([
            "content",
            "links",
            "emoji",
            "media",
            "event",
            "message",
            "timestamp",
            "ordered",
            "runLengths",
            "index",
            "value",
          ]).not.toContain(key);
          visit(item);
        }
      }
    };
    visit(output);
    output.participants[0].displayName = "Changed synthetic output";
    expect(JSON.stringify(dataset)).toBe(original);
  });

  it("handles many equal-time records and runs without large argument spreads", () => {
    const dataset = sequence([0, 0], [A, B]);
    const messages: WhatsAppMessage[] = Array.from(
      { length: 130001 },
      (_, index) => ({
        ...dataset.messages[index % 2],
        id: index,
      }),
    );
    const output = analyzeWhatsAppMessagePatterns(
      messages,
      dataset.participants,
    );
    expect(output.messageCount).toBe(130001);
    expect(output.runs).toMatchObject({
      total: 130001,
      medianLength: 1,
      longest: 1,
    });
    expect(output.runs.distribution.map((bucket) => bucket.count)).toEqual([
      130001, 0, 0, 0, 0,
    ]);
    expect(output.burst).toMatchObject({ maximum: 130001, tiedWindows: 1 });
    expect(
      output.participants.map((participant) => participant.burst.maximum),
    ).toEqual([65001, 65000]);
  });
});
