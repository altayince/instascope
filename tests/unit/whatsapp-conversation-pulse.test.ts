import { describe, expect, it } from "vitest";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import { createChatVaultSnapshot } from "../../src/lib/whatsapp/chat-vault";
import {
  compareChatVaultSnapshots,
  type ChatComparisonDistribution,
  type ChatComparisonMetric,
  type ChatVaultComparison,
} from "../../src/lib/whatsapp/chat-vault-compare";
import {
  CONVERSATION_PULSE_THRESHOLDS,
  deriveConversationPulse,
} from "../../src/lib/whatsapp/conversation-pulse";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];
function source(messagesPerDay = 10) {
  return parseWhatsApp(
    Array.from({ length: 4 }, (_, day) =>
      Array.from(
        { length: messagesPerDay },
        (_, index) =>
          `${String(day + 1).padStart(2, "0")}/01/2026, 09:${String(index).padStart(2, "0")} - ${index % 2 ? "SYNTHETIC_PRIVATE_ONE" : "SYNTHETIC_PRIVATE_TWO"}: SYNTHETIC_PRIVATE_BODY with fictional words`,
      ),
    )
      .flat()
      .join("\n"),
    "dmy-24h",
  );
}
function comparison(messagesPerDay = 10): ChatVaultComparison {
  const result = compareChatVaultSnapshots(
    createChatVaultSnapshot(source(), { id: ids[0], createdAt: 1 }),
    createChatVaultSnapshot(source(messagesPerDay), {
      id: ids[1],
      createdAt: 2,
    }),
  );
  if (!result.ok) throw new Error("Invalid synthetic comparison fixture");
  return result;
}
function change(
  result: ChatVaultComparison,
  key: string,
  earlier: number,
  later: number,
  fields: Partial<ChatComparisonMetric> = {},
) {
  const metric = result.metrics.find((value) => value.key === key);
  if (!metric) throw new Error(`Missing fixture metric ${key}`);
  Object.assign(metric, {
    earlier,
    later,
    delta: later - earlier,
    relativeDelta: earlier === 0 ? null : (later - earlier) / earlier,
    ...fields,
  });
  return result;
}
function distribution(
  key: ChatComparisonDistribution["key"],
  earlierCounts: number[],
  laterCounts: number[],
): ChatComparisonDistribution {
  const earlierTotal = earlierCounts.reduce((sum, count) => sum + count, 0);
  const laterTotal = laterCounts.reduce((sum, count) => sum + count, 0);
  return {
    key,
    label: `${key} distribution`,
    earlierTotal,
    laterTotal,
    buckets: earlierCounts.map((earlierCount, index) => {
      const laterCount = laterCounts[index];
      const earlierShare = earlierTotal ? earlierCount / earlierTotal : null;
      const laterShare = laterTotal ? laterCount / laterTotal : null;
      return {
        key: `bucket-${index}`,
        label: `Bucket ${index}`,
        earlierCount,
        laterCount,
        earlierShare,
        laterShare,
        deltaShare:
          earlierShare === null || laterShare === null
            ? null
            : laterShare - earlierShare,
      };
    }),
  };
}

describe("Conversation Pulse factual summary", () => {
  it("has no cards for identical saved aggregate facts", () => {
    const result = deriveConversationPulse(comparison());
    expect(result.items).toEqual([]);
    expect(result.emptyReason).toMatch(/No aggregate differences meet/);
  });

  it("degrades incompatible pairs to an unavailable state", () => {
    const result = deriveConversationPulse({
      ok: false,
      compatibility: {
        status: "not-comparable",
        reasons: [{ code: "unsupported-definition", message: "Unsupported" }],
      },
    });
    expect(result.items).toEqual([]);
    expect(result.emptyReason).toMatch(/unavailable/);
  });

  it("derives repeatable cards from actual saved snapshots and never mutates comparison facts", () => {
    const result = comparison(20);
    const original = structuredClone(result);
    const first = deriveConversationPulse(result);
    expect(
      first.items.some((item) => item.metricKey === "totals.messages"),
    ).toBe(true);
    expect(first).toEqual(deriveConversationPulse(result));
    expect(first).toEqual(deriveConversationPulse(structuredClone(result)));
    expect(result).toEqual(original);
    expect(JSON.stringify(first)).not.toMatch(
      /SYNTHETIC_PRIVATE|https?:\/\/|11111111-|22222222-/,
    );
    for (const item of first.items)
      expect(item.summary).toContain("full-export snapshot");
  });

  it("uses explicit scalar noise gates including the relative-to-larger-value gate", () => {
    const belowAbsolute = change(comparison(), "totals.messages", 40, 49);
    expect(deriveConversationPulse(belowAbsolute).items).toEqual([]);
    const belowRelative = change(comparison(), "totals.messages", 1000, 1010);
    expect(deriveConversationPulse(belowRelative).items).toEqual([]);
    const atBoundary = change(comparison(), "totals.messages", 90, 100);
    expect(deriveConversationPulse(atBoundary).items).toHaveLength(1);
    const insufficient = change(comparison(), "totals.messages", 0, 19);
    insufficient.earlier.totals.messages = 0;
    insufficient.later.totals.messages = 19;
    expect(deriveConversationPulse(insufficient).items).toEqual([]);
  });

  it("allows a genuine zero count baseline without inventing an infinite percentage", () => {
    const result = change(comparison(), "totals.messages", 0, 40);
    result.earlier.totals.messages = 0;
    const [item] = deriveConversationPulse(result).items;
    expect(item).toMatchObject({ earlier: 0, later: 40, delta: 40 });
    expect(item.summary).not.toMatch(/Infinity|NaN|%/);
  });

  it("requires both values and a supported classification", () => {
    for (const field of ["earlier", "later", "delta"] as const) {
      const result = change(comparison(), "totals.messages", 40, 80, {
        [field]: null,
      });
      expect(deriveConversationPulse(result).items).toEqual([]);
    }
    const unavailable = change(comparison(), "totals.messages", 40, 80, {
      classification: "unavailable",
    });
    expect(deriveConversationPulse(unavailable).items).toEqual([]);
  });

  it("keeps smaller/noisy changes visible only in detail instead of inventing Pulse cards", () => {
    const result = comparison();
    change(result, "totals.activeDays", 4, 5);
    change(result, "rhythm.medianSessionMessages", 10, 10.5);
    change(result, "rhythm.medianTransitionSeconds", 60, 90);
    change(result, "activity.longestGapSeconds", 3600, 5400);
    change(result, "patterns.text.length.median", 30, 32);
    change(result, "patterns.questionMarks.share", 0.1, 0.15);
    expect(deriveConversationPulse(result).items).toEqual([]);
  });

  it("requires sufficient underlying evidence for session, transition and text summaries", () => {
    const result = comparison();
    change(result, "rhythm.medianSessionMessages", 2, 10);
    change(result, "rhythm.medianTransitionSeconds", 60, 300);
    change(result, "patterns.text.length.median", 10, 30);
    result.earlier.rhythm.sessionCount = 2;
    result.earlier.rhythm.transitionCount = 3;
    result.earlier.patterns.text.eligibleMessages = 5;
    expect(deriveConversationPulse(result).items).toEqual([]);
  });

  it("preserves exact/derived classifications and every scalar fact is traceable", () => {
    const result = comparison();
    change(result, "totals.messages", 40, 80);
    change(result, "rhythm.medianSessionMessages", 2, 6);
    change(result, "rhythm.medianTransitionSeconds", 60, 300);
    const pulse = deriveConversationPulse(result);
    expect(pulse.items).toHaveLength(3);
    for (const item of pulse.items) {
      const fact = result.metrics.find(
        (metric) => metric.key === item.metricKey,
      )!;
      expect(item).toMatchObject({
        earlier: fact.earlier,
        later: fact.later,
        delta: fact.delta,
        unit: fact.unit,
        classification: fact.classification,
      });
      expect(item.thresholdExplanation.length).toBeGreaterThan(40);
    }
    expect(
      pulse.items.find((item) => item.metricKey === "totals.messages")
        ?.classification,
    ).toBe("exact");
    expect(
      pulse.items.find(
        (item) => item.metricKey === "rhythm.medianSessionMessages",
      )?.classification,
    ).toBe("derived");
  });

  it("ranks deterministic threshold strength, uses stable ties and caps the deck", () => {
    const result = comparison();
    change(result, "totals.messages", 40, 160);
    change(result, "totals.activeDays", 4, 20);
    change(result, "rhythm.medianSessionMessages", 2, 10);
    change(result, "activity.longestGapSeconds", 3600, 86400);
    change(result, "rhythm.medianTransitionSeconds", 60, 1200);
    change(result, "patterns.text.length.median", 10, 50);
    change(result, "patterns.questionMarks.share", 0.1, 0.8);
    const pulse = deriveConversationPulse(result);
    expect(pulse.items).toHaveLength(CONVERSATION_PULSE_THRESHOLDS.items);
    expect(pulse.items.slice(0, 3).map((item) => item.metricKey)).toEqual([
      "totals.messages",
      "totals.activeDays",
      "rhythm.medianSessionMessages",
    ]);
    expect(pulse).toEqual(deriveConversationPulse(result));
    expect(pulse.emptyReason).toBeNull();
  });

  it("reports decreases as lower saved aggregates without a period or causal claim", () => {
    const result = change(comparison(), "totals.messages", 80, 40);
    const [item] = deriveConversationPulse(result).items;
    expect(item.title).toContain("lower in the later snapshot");
    expect(item.summary).toContain("40");
    expect(item.summary).toContain("80");
    expect(item.delta).toBe(-40);
    expect(item.summary).not.toMatch(
      /since|this month|between saves|because|reply|responsive/i,
    );
  });
});

describe("Conversation Pulse normalized distribution facts", () => {
  it("ignores larger raw bucket counts when the normalized mix is unchanged", () => {
    const result = comparison();
    result.distributions = [distribution("hours", [10, 30], [100, 300])];
    expect(deriveConversationPulse(result).items).toEqual([]);
  });

  it("selects the strongest share change and retains exact numerator/denominator evidence", () => {
    const result = comparison();
    result.distributions = [distribution("hours", [10, 30], [30, 10])];
    const [item] = deriveConversationPulse(result).items;
    expect(item).toMatchObject({
      metricKey: "distribution.hours.bucket-0",
      earlier: 0.25,
      later: 0.75,
      delta: 0.5,
      unit: "share",
      classification: "derived",
      distribution: {
        key: "hours",
        bucketKey: "bucket-0",
        earlierCount: 10,
        laterCount: 30,
        earlierTotal: 40,
        laterTotal: 40,
      },
    });
    expect(item.thresholdExplanation).toContain("own denominator");
  });

  it("has no distribution insight for unavailable denominators or insufficient evidence", () => {
    for (const candidate of [
      distribution("hours", [0, 0], [30, 10]),
      distribution("hours", [1, 9], [9, 1]),
      distribution("media", [1, 3], [3, 1]),
      distribution("transitions", [1, 8], [8, 1]),
    ]) {
      const result = comparison();
      result.distributions = [candidate];
      expect(deriveConversationPulse(result).items).toEqual([]);
    }
  });

  it("treats a precise ten-percentage-point boundary fairly despite binary rounding", () => {
    const result = comparison();
    result.distributions = [distribution("hours", [20, 80], [30, 70])];
    expect(deriveConversationPulse(result).items).toHaveLength(1);
    result.distributions = [
      distribution("hours", [200000, 800000], [299999, 700001]),
    ];
    expect(deriveConversationPulse(result).items).toEqual([]);
  });

  it("does not fill the deck with duplicate activity or transition timing stories", () => {
    const result = comparison();
    change(result, "rhythm.medianTransitionSeconds", 60, 600);
    result.distributions = [
      distribution("hours", [10, 30], [30, 10]),
      distribution("weekdays", [10, 30], [30, 10]),
      distribution("transitions", [10, 30], [30, 10]),
    ];
    const pulse = deriveConversationPulse(result);
    expect(pulse.items).toHaveLength(2);
    expect(
      pulse.items.filter((item) =>
        /distribution\.(hours|weekdays)/.test(item.metricKey),
      ),
    ).toHaveLength(1);
    expect(
      pulse.items.filter(
        (item) =>
          item.metricKey.includes("Transition") ||
          item.metricKey.includes("distribution.transitions"),
      ),
    ).toHaveLength(1);
  });

  it("requires media evidence and uses normalized media mix rather than export size", () => {
    const result = comparison();
    result.distributions = [distribution("media", [1, 9], [16, 4])];
    const [item] = deriveConversationPulse(result).items;
    expect(item.metricKey).toBe("distribution.media.bucket-0");
    expect(item.earlier).toBe(0.1);
    expect(item.later).toBe(0.8);
    expect(item.summary).toContain("recognized media messages");
  });

  it("contains no psychological or relationship-scoring output", () => {
    const result = change(comparison(), "totals.messages", 40, 160);
    change(result, "rhythm.medianTransitionSeconds", 60, 1200);
    const output = JSON.stringify(deriveConversationPulse(result));
    expect(output).not.toMatch(
      /relationship health|chemistry|compatibility score|attachment|toxicity|who cares|red flags|green flags|pulling away|likes? you|personality|love score|sentiment|more interested/i,
    );
    expect(output).not.toMatch(
      /SYNTHETIC_PRIVATE|https?:\/\/|participant-\d|snapshotId/,
    );
  });
});
