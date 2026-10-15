import { describe, expect, it } from "vitest";
import {
  compareChatVaultSnapshots,
  type ChatVaultComparison,
} from "../../src/lib/whatsapp/chat-vault-compare";
import {
  createChatVaultSnapshot,
  type ChatVaultSnapshot,
} from "../../src/lib/whatsapp/chat-vault";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const lines = [
  "01/01/2024, 08:00 - Synthetic One: A fictional question?",
  "01/01/2024, 08:01 - Synthetic Two: image omitted",
  "02/01/2024, 09:00 - Synthetic One: Fictional text 🌿",
  "02/01/2024, 10:00 - Synthetic Two: video omitted",
];
const make = (
  source: string[] = lines,
  id = firstId,
  createdAt = 1800000000000,
) =>
  createChatVaultSnapshot(parseWhatsApp(source.join("\n"), "dmy-24h"), {
    id,
    createdAt,
  });
const later = () =>
  make(
    [
      ...lines,
      "03/01/2024, 18:00 - Synthetic One: [Anruf]",
      "03/01/2024, 18:05 - Synthetic Two: A longer fictional line with words",
    ],
    secondId,
    1800000000001,
  );
function compare(
  first: unknown = make(),
  second: unknown = later(),
): ChatVaultComparison {
  const result = compareChatVaultSnapshots(first, second);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Synthetic pair should be comparable.");
  return result;
}
const metric = (result: ChatVaultComparison, key: string) => {
  const item = result.metrics.find((item) => item.key === key);
  expect(item).toBeDefined();
  return item!;
};
const distribution = (
  result: ChatVaultComparison,
  key: ChatVaultComparison["distributions"][number]["key"],
) => result.distributions.find((item) => item.key === key)!;

describe("saved Chat Vault pair compatibility and deterministic order", () => {
  it("accepts supported aligned full exports with matching definitions", () => {
    const result = compare();
    expect(result.compatibility).toEqual({ status: "comparable", reasons: [] });
    expect(result.earlier.id).toBe(firstId);
    expect(result.later.id).toBe(secondId);
    expect(result.orderBasis).toBe("coverage-end");
    expect(result.reversed).toBe(false);
  });

  it("normalizes reversed selection without mutating saved snapshots", () => {
    const first = make();
    const second = later();
    const original = structuredClone({ first, second });
    const result = compare(second, first);
    expect(result.earlier).toEqual(first);
    expect(result.later).toEqual(second);
    expect(result.reversed).toBe(true);
    expect({ first, second }).toEqual(original);
    expect(result.earlier).not.toBe(first);
    expect(result.earlier.activity.hours).not.toBe(first.activity.hours);
    expect(result.metrics).toEqual(compare(first, second).metrics);
  });

  it("rejects selecting one saved snapshot twice", () => {
    const value = make();
    const result = compareChatVaultSnapshots(value, structuredClone(value));
    expect(result).toEqual({
      ok: false,
      compatibility: {
        status: "not-comparable",
        reasons: [
          {
            code: "same-snapshot",
            message: "Choose two different saved snapshots.",
          },
        ],
      },
    });
  });

  it.each([
    ["version", 2, "unsupported-schema"],
    ["definitionsVersion", 2, "unsupported-definitions"],
    ["scope", "filtered", "unsupported-scope"],
  ])("rejects incompatible %s safely", (field, value, code) => {
    const result = compareChatVaultSnapshots(make(), {
      ...later(),
      [field]: value,
    });
    expect(result.ok).toBe(false);
    expect(result.compatibility.status).toBe("not-comparable");
    expect(result.compatibility.reasons[0].code).toBe(code);
  });

  it("rejects invalid/reversed/impossible coverage and malformed aggregates", () => {
    for (const mutate of [
      (value: ChatVaultSnapshot) => (value.coverage.fromDate = "2025-01-01"),
      (value: ChatVaultSnapshot) => (value.coverage.toDate = "2024-02-30"),
      (value: ChatVaultSnapshot) => (value.activity.calendarSpanDays = 99),
      (value: ChatVaultSnapshot) => (value.totals.messages = NaN),
    ]) {
      const second = later();
      mutate(second);
      const result = compareChatVaultSnapshots(make(), second);
      expect(result.ok).toBe(false);
      expect(result.compatibility.reasons[0].code).toBe("invalid-snapshot");
    }
    for (const invalid of [null, [], {}, "synthetic private raw content"])
      expect(compareChatVaultSnapshots(make(), invalid).ok).toBe(false);
  });

  it("explains different coverage starts, partial support and mixed precision", () => {
    const dataset = parseWhatsApp(
      [
        "02/01/2024, 08:00 - Synthetic One: fictional",
        "03/01/2024, 08:00 - Synthetic Two: fictional",
      ].join("\n"),
      "dmy-24h",
    );
    dataset.metadata.doctor.status = "partially-supported";
    dataset.metadata.timestampPrecision = "mixed";
    const second = createChatVaultSnapshot(dataset, {
      id: secondId,
      createdAt: 1800000000001,
    });
    const result = compare(make(), second);
    expect(result.compatibility.status).toBe("limited");
    expect(result.compatibility.reasons.map((reason) => reason.code)).toEqual([
      "different-coverage-starts",
      "partial-source-support",
      "timestamp-precision",
    ]);
  });

  it("allows different precision and disjoint exports with explicit limitations", () => {
    const second = make(
      ["01/02/2024, 10:00:30 - Synthetic One: fictional"],
      secondId,
      1800000000001,
    );
    const result = compare(make(), second);
    expect(result.compatibility.status).toBe("limited");
    expect(result.compatibility.reasons.map((reason) => reason.code)).toContain(
      "disjoint-coverage",
    );
    expect(result.compatibility.reasons.map((reason) => reason.code)).toContain(
      "timestamp-precision",
    );
  });

  it("uses save time for equal coverage and stable ID order for exact ties", () => {
    const earlier = make(lines, firstId, 100);
    const newerSave = make(lines, secondId, 200);
    const saved = compare(newerSave, earlier);
    expect(saved.orderBasis).toBe("saved-time");
    expect(saved.reversed).toBe(true);
    expect(saved.compatibility.reasons[0].code).toBe("equal-coverage");
    newerSave.createdAt = 100;
    const tied = compare(newerSave, earlier);
    expect(tied.orderBasis).toBe("id-tie");
    expect(tied.earlier.id).toBe(firstId);
    expect(tied.compatibility.reasons.map((reason) => reason.code)).toEqual([
      "equal-coverage",
      "save-time-tie",
    ]);
  });

  it("warns when coverage order conflicts with save-time order", () => {
    const earlierCoverage = make(lines, firstId, 300);
    const result = compare(earlierCoverage, later());
    const second = later();
    second.createdAt = 100;
    const conflict = compare(earlierCoverage, second);
    expect(conflict.orderBasis).toBe("coverage-end");
    expect(conflict.earlier.id).toBe(firstId);
    expect(conflict.compatibility.reasons[0].code).toBe(
      "save-coverage-order-conflict",
    );
    expect(result.compatibility.status).toBe("comparable");
  });

  it("allows equal coverage ends with different starts without treating them as identical", () => {
    const shorter = make(
      ["02/01/2024, 10:00 - Synthetic Two: fictional"],
      secondId,
      1800000000001,
    );
    const result = compare(make(), shorter);
    expect(result.orderBasis).toBe("saved-time");
    expect(result.compatibility.status).toBe("limited");
    expect(result.compatibility.reasons.map((reason) => reason.code)).toEqual([
      "different-coverage-starts",
      "equal-coverage-end",
    ]);
  });

  it("marks mixed precision as limited even when both precision enums match", () => {
    const first = make();
    const second = later();
    first.coverage.precision = "mixed";
    second.coverage.precision = "mixed";
    expect(compare(first, second).compatibility.reasons[0].code).toBe(
      "timestamp-precision",
    );
  });
});

describe("factual scalar comparison and normalized aggregate distributions", () => {
  it("returns exact counts and derived rhythm/pattern deltas with correct direction", () => {
    const result = compare();
    expect(metric(result, "totals.messages")).toMatchObject({
      earlier: 4,
      later: 6,
      delta: 2,
      relativeDelta: 0.5,
      classification: "exact",
    });
    expect(metric(result, "totals.activeDays")).toMatchObject({
      earlier: 2,
      later: 3,
      delta: 1,
    });
    expect(metric(result, "rhythm.medianSessionMessages")).toMatchObject({
      earlier: 1,
      later: 1.5,
      delta: 0.5,
      classification: "derived",
    });
    expect(
      metric(result, "rhythm.medianTransitionSeconds").classification,
    ).toBe("derived");
    expect(metric(result, "patterns.text.length.median").unit).toBe(
      "characters",
    );
    expect(metric(result, "patterns.questionMarks.share")).toMatchObject({
      earlier: 0.25,
      later: 1 / 6,
      delta: 1 / 6 - 0.25,
      classification: "derived",
    });
    expect(metric(result, "totals.attributedCallEvents")).toMatchObject({
      earlier: 0,
      later: 1,
      delta: 1,
      relativeDelta: null,
    });
    expect(new Set(result.metrics.map((item) => item.key)).size).toBe(
      result.metrics.length,
    );
  });

  it("keeps negative count differences factual without claiming message removal", () => {
    const smallerLater = make(
      [
        "01/01/2024, 08:00 - Synthetic One: fictional",
        "03/01/2024, 08:00 - Synthetic Two: fictional",
      ],
      secondId,
      1800000000001,
    );
    const result = compare(make(), smallerLater);
    expect(metric(result, "totals.messages")).toMatchObject({
      earlier: 4,
      later: 2,
      delta: -2,
      relativeDelta: -0.5,
    });
    expect(JSON.stringify(result.metrics)).not.toMatch(
      /removed messages|since last|relationship|response time/,
    );
  });

  it("does not manufacture activity shifts when a larger export has the same mix", () => {
    const twice = make(
      lines.flatMap((line) => [line, line]),
      secondId,
      1800000000001,
    );
    const result = compare(make(), twice);
    expect(metric(result, "totals.messages").delta).toBe(4);
    for (const key of ["hours", "weekdays", "media"] as const) {
      const values = distribution(result, key);
      expect(values.laterTotal).toBe(values.earlierTotal * 2);
      for (const item of values.buckets) {
        expect(item.laterCount).toBe(item.earlierCount * 2);
        expect(item.deltaShare).toBe(0);
      }
    }
    expect(result.heatmap.flat().every((item) => item.deltaShare === 0)).toBe(
      true,
    );
  });

  it("normalizes hour/weekday/heatmap counts by each snapshot's total", () => {
    const result = compare();
    const hours = distribution(result, "hours");
    expect(hours.buckets[8]).toMatchObject({
      key: "08",
      earlierCount: 2,
      laterCount: 2,
      earlierShare: 0.5,
      laterShare: 1 / 3,
      deltaShare: 1 / 3 - 0.5,
    });
    expect(hours.buckets[18]).toMatchObject({
      earlierCount: 0,
      laterCount: 2,
      earlierShare: 0,
      laterShare: 1 / 3,
    });
    expect(result.heatmap).toHaveLength(7);
    expect(result.heatmap.every((row) => row.length === 24)).toBe(true);
    expect(result.heatmap[2][18]).toMatchObject({
      label: "Wednesday, 18:00",
      earlierCount: 0,
      laterCount: 2,
      deltaShare: 1 / 3,
    });
    expect(
      hours.buckets.reduce((total, item) => total + item.earlierShare!, 0),
    ).toBeCloseTo(1);
    expect(
      hours.buckets.reduce((total, item) => total + item.laterShare!, 0),
    ).toBeCloseTo(1);
  });

  it("uses recognized-media and transition denominators for their own category mix", () => {
    const result = compare();
    const media = distribution(result, "media");
    expect(media.earlierTotal).toBe(2);
    expect(media.buckets.find((item) => item.key === "image")).toMatchObject({
      earlierCount: 1,
      earlierShare: 0.5,
      laterShare: 0.5,
    });
    const transitions = distribution(result, "transitions");
    expect(transitions.earlierTotal).toBe(3);
    expect(
      transitions.buckets.reduce((count, item) => count + item.earlierCount, 0),
    ).toBe(3);
    expect(
      transitions.buckets.reduce(
        (count, item) => count + item.earlierShare!,
        0,
      ),
    ).toBeCloseTo(1);
    expect(metric(result, "rhythm.rapidTransitionShare")).toMatchObject({
      earlier: 1 / 3,
      later: 2 / 5,
    });
  });

  it("treats zero denominators as unavailable while preserving count deltas", () => {
    const dataset = parseWhatsApp(lines.join("\n"), "dmy-24h");
    dataset.messages = [];
    dataset.participants = [];
    const empty = createChatVaultSnapshot(dataset, {
      id: firstId,
      createdAt: 1,
    });
    const result = compare(empty, later());
    expect(result.orderBasis).toBe("saved-time");
    expect(result.compatibility.reasons[0].code).toBe("coverage-unavailable");
    expect(metric(result, "totals.messages")).toMatchObject({
      earlier: 0,
      later: 6,
      delta: 6,
      relativeDelta: null,
    });
    for (const values of result.distributions) {
      expect(values.earlierTotal).toBe(0);
      expect(
        values.buckets.every(
          (item) => item.earlierShare === null && item.deltaShare === null,
        ),
      ).toBe(true);
    }
    expect(
      result.heatmap
        .flat()
        .every(
          (item) => item.earlierShare === null && item.deltaShare === null,
        ),
    ).toBe(true);
    expect(metric(result, "rhythm.rapidTransitionShare").classification).toBe(
      "unavailable",
    );
  });

  it("keeps missing emoji/text/gap summaries unavailable instead of zero", () => {
    const dataset = parseWhatsApp(
      [
        "01/01/2024, 08:00 - Synthetic One: image omitted",
        "01/01/2024, 08:00 - Synthetic Two: video omitted",
      ].join("\n"),
      "dmy-24h",
    );
    dataset.messages[0].emoji = null;
    const unavailable = createChatVaultSnapshot(dataset, {
      id: firstId,
      createdAt: 1,
    });
    const result = compare(unavailable, later());
    for (const key of [
      "totals.emoji",
      "patterns.text.length.median",
      "activity.longestGapSeconds",
    ]) {
      expect(metric(result, key)).toMatchObject({
        earlier: null,
        delta: null,
        relativeDelta: null,
        classification: "unavailable",
      });
    }
    expect(metric(result, "rhythm.medianTransitionSeconds").earlier).toBe(0);
  });

  it("compares zero-message system-only snapshots without inventing shares or dates", () => {
    const dataset = parseWhatsApp(
      [
        "01/01/2024, 08:00 - Synthetic system notice",
        "01/01/2024, 08:01 - Synthetic One: fictional",
      ].join("\n"),
      "dmy-24h",
    );
    dataset.messages = [];
    dataset.participants = [];
    const first = createChatVaultSnapshot(dataset, {
      id: firstId,
      createdAt: 1,
    });
    const second = createChatVaultSnapshot(dataset, {
      id: secondId,
      createdAt: 2,
    });
    const result = compare(second, first);
    expect(result.reversed).toBe(true);
    expect(result.orderBasis).toBe("saved-time");
    expect(result.compatibility.status).toBe("limited");
    expect(metric(result, "totals.systemEvents")).toMatchObject({
      earlier: 1,
      later: 1,
      delta: 0,
    });
    expect(metric(result, "totals.messages")).toMatchObject({
      earlier: 0,
      later: 0,
      delta: 0,
      relativeDelta: null,
      classification: "exact",
    });
    expect(metric(result, "activity.observedSpanSeconds")).toMatchObject({
      earlier: null,
      later: null,
      delta: null,
      classification: "unavailable",
    });
    expect(
      result.distributions
        .flatMap((item) => item.buckets)
        .every(
          (item) =>
            item.earlierShare === null &&
            item.laterShare === null &&
            item.deltaShare === null,
        ),
    ).toBe(true);
  });

  it("returns exact ties/no-change deterministically without mutating or adding identity", () => {
    const first = make();
    const second = make(lines, secondId, 1800000000001);
    const result = compare(first, second);
    expect(compare(first, second)).toEqual(result);
    expect(
      result.metrics.every((item) => item.delta === 0 || item.delta === null),
    ).toBe(true);
    expect(
      result.distributions
        .flatMap((item) => item.buckets)
        .every((item) => item.deltaShare === 0 || item.deltaShare === null),
    ).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(
      /Synthetic One|Synthetic Two|fictional question|displayName|participantId|fingerprint|https?:\/\//,
    );
  });
});
