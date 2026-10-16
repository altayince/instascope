import { describe, expect, it } from "vitest";
import {
  createChatVaultSnapshot,
  ChatVaultValidationError,
  MAX_CHAT_VAULT_BACKUP_BYTES,
  MAX_CHAT_VAULT_SNAPSHOTS,
  newestChatVaultSnapshots,
  parseChatVaultBackup,
  previewChatVaultImport,
  serializeChatVaultBackup,
  validateChatVaultBackup,
  validateChatVaultSnapshot,
  type ChatVaultSnapshot,
} from "../../src/lib/whatsapp/chat-vault";
import {
  analyzeFilteredWhatsApp,
  DEFAULT_WHATSAPP_FILTERS,
} from "../../src/lib/whatsapp/filters";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import {
  groupPrivateMarker,
  syntheticGroupChat,
} from "../helpers/whatsapp-group";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const options = { id: firstId, createdAt: 1800000000000 };
const fixture = () =>
  parseWhatsApp(
    [
      "01/01/2022, 08:00 - Synthetic system notice",
      "28/02/2024, 23:50 - Synthetic Private One: NEVER_PERSIST_THIS https://example.org/synthetic-private?token=fictional 🌿?",
      "29/02/2024, 00:00 - Synthetic Private Two: image omitted",
      "29/02/2024, 08:00 - Synthetic Private One: [Anruf]",
      "01/03/2024, 08:00 - Synthetic Private Two: SYNTHETIC_SECRET_BODY fictional text??",
      "03/03/2024, 08:00 - [Anruf]",
    ].join("\n"),
    "dmy-24h",
  );
const snapshot = () => createChatVaultSnapshot(fixture(), options);
const backup = (snapshots: unknown[] = [snapshot()]) => ({
  format: "whatsapp-chat-vault",
  version: 1,
  snapshots,
});

function objectPaths(value: unknown, path: string[] = []): string[][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return [
    path,
    ...Object.entries(value).flatMap(([key, child]) =>
      objectPaths(child, [...path, key]),
    ),
  ];
}

describe("anonymous aggregate Chat Vault projection", () => {
  it.each([3, 8, 24])(
    "keeps all %i tied group labels in aggregates and round-trips an identity-free V1 backup",
    (participants) => {
      const dataset = parseWhatsApp(
        syntheticGroupChat(participants),
        "dmy-24h",
      );
      const original = structuredClone(dataset);
      const saved = createChatVaultSnapshot(dataset, options);
      expect(saved.version).toBe(1);
      expect(saved.definitionsVersion).toBe(1);
      expect(saved.totals).toMatchObject({
        messages: participants * 6,
        participants,
        activeDays: 3,
        mediaMessages: participants,
        attributedCallEvents: 1,
        unattributedCallEvents: 1,
      });
      expect(saved.activity.hours.reduce((sum, value) => sum + value, 0)).toBe(
        participants * 6,
      );
      expect(
        saved.activity.weekdays.reduce((sum, value) => sum + value, 0),
      ).toBe(participants * 6);
      expect(
        saved.activity.heatmap.flat().reduce((sum, value) => sum + value, 0),
      ).toBe(participants * 6);
      const serialized = serializeChatVaultBackup([saved]);
      expect(parseChatVaultBackup(serialized).snapshots).toEqual([saved]);
      expect(serialized).not.toContain(groupPrivateMarker);
      expect(serialized).not.toMatch(
        /participantId|displayName|participant-\d|fingerprint|conversationId|Participant \d/,
      );
      expect(dataset).toEqual(original);
    },
  );

  it("projects full-source existing analysis without retaining identities or content", () => {
    const dataset = fixture();
    const original = structuredClone(dataset);
    const selected = analyzeFilteredWhatsApp(dataset, {
      date: { mode: "month", month: "2024-02" },
      participantId: dataset.participants[0].id,
    });
    expect(selected.ok && selected.analysis.totals.messages).toBe(2);
    const saved = createChatVaultSnapshot(dataset, options);
    expect(validateChatVaultSnapshot(saved)).toEqual(saved);
    expect(saved.coverage).toEqual({
      fromDate: "2024-02-28",
      toDate: "2024-03-01",
      precision: "minute",
      sourceSupport: "supported",
    });
    expect(saved.totals).toEqual({
      messages: 4,
      systemEvents: 2,
      participants: 2,
      activeDays: 3,
      mediaMessages: 1,
      links: 1,
      messagesWithLinks: 1,
      emoji: 1,
      messagesWithEmoji: 1,
      attributedCallEvents: 1,
      unattributedCallEvents: 1,
    });
    expect(saved.rhythm.sessionCount).toBe(3);
    expect(saved.rhythm.longGapCount).toBe(2);
    expect(saved.rhythm.transitionCount).toBe(3);
    expect(saved.media.image).toBe(1);
    expect(saved.patterns.text.eligibleMessages).toBe(2);
    expect(saved.activity.heatmap.flat().reduce((a, b) => a + b, 0)).toBe(4);
    expect(dataset).toEqual(original);
    const serialized = serializeChatVaultBackup([saved]);
    for (const forbidden of [
      "Synthetic Private",
      "NEVER_PERSIST_THIS",
      "SYNTHETIC_SECRET_BODY",
      "example.org",
      "fictional-private",
      "🌿",
      "participantId",
      "displayName",
      "firstTimestamp",
      "examples",
      '"word"',
      '"content"',
    ])
      expect(serialized).not.toContain(forbidden);
    const full = analyzeFilteredWhatsApp(dataset, DEFAULT_WHATSAPP_FILTERS);
    expect(full.ok).toBe(true);
    if (full.ok) {
      expect(saved.activity.hours).toEqual(
        full.analysis.hours.map((item) => item.count),
      );
      expect(saved.activity.heatmap).toEqual(full.heatmap);
      expect(saved.patterns.runs.count).toBe(full.content.patterns.runs.total);
      expect(saved.rhythm.medianTransitionSeconds).toBe(
        full.rhythm.available
          ? full.rhythm.analysis.timing.medianSeconds
          : null,
      );
    }
  });

  it("generates a random local UUID and UTC save time, without chat-derived identity", () => {
    const before = Date.now();
    const one = createChatVaultSnapshot(fixture());
    const two = createChatVaultSnapshot(fixture());
    expect(one.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(one.id).not.toBe(two.id);
    expect(one.createdAt).toBeGreaterThanOrEqual(before);
    expect(one.createdAt).toBeLessThanOrEqual(Date.now());
    expect(one.scope).toBe("full-export");
  });

  it("keeps unknown emoji and empty measurements unavailable", () => {
    const dataset = fixture();
    dataset.messages[0].emoji = null;
    const unavailable = createChatVaultSnapshot(dataset, options);
    expect(unavailable.totals.emoji).toBeNull();
    expect(unavailable.totals.messagesWithEmoji).toBeNull();
    dataset.messages = [];
    dataset.participants = [];
    const empty = createChatVaultSnapshot(dataset, options);
    expect(empty.coverage.fromDate).toBeNull();
    expect(empty.coverage.toDate).toBeNull();
    expect(empty.activity.observedSpanSeconds).toBeNull();
    expect(empty.activity.longestStreakDays).toBeNull();
    expect(empty.activity.longestGapSeconds).toBeNull();
    expect(empty.rhythm.medianTransitionSeconds).toBeNull();
    expect(empty.rhythm.medianSessionMessages).toBeNull();
    expect(empty.patterns.text.length.median).toBeNull();
    expect(empty.patterns.questionMarks.share).toBeNull();
  });

  it("preserves written-clock precision and partial support without claiming completeness", () => {
    const dataset = fixture();
    dataset.metadata.timestampPrecision = "mixed";
    dataset.metadata.doctor.status = "partially-supported";
    const saved = createChatVaultSnapshot(dataset, options);
    expect(saved.coverage.precision).toBe("mixed");
    expect(saved.coverage.sourceSupport).toBe("partially-supported");
    expect(JSON.stringify(saved)).not.toMatch(
      /timezone|utcEvent|completeHistory/,
    );
  });

  it("rejects demo data and invalid local save metadata", () => {
    const dataset = fixture();
    dataset.metadata.source = "demo";
    expect(() => createChatVaultSnapshot(dataset)).toThrow(/Fictional demo/);
    for (const invalidOptions of [
      { id: "participant-derived-id" },
      { id: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
      { createdAt: NaN },
      { createdAt: -1 },
    ])
      expect(() => createChatVaultSnapshot(fixture(), invalidOptions)).toThrow(
        /cannot be saved safely/,
      );
  });
});

describe("strict Chat Vault aggregate schema", () => {
  for (const path of objectPaths(snapshot())) {
    it(`rejects unexpected fields at ${path.join(".") || "snapshot root"}`, () => {
      const value = structuredClone(snapshot());
      let target = value as unknown as Record<string, unknown>;
      for (const key of path) target = target[key] as Record<string, unknown>;
      target.rawMessage = "synthetic private content";
      expect(validateChatVaultSnapshot(value)).toBeNull();
    });
  }

  it.each([
    ["version", 2],
    ["definitionsVersion", 2],
    ["createdAt", Infinity],
    ["createdAt", -1],
    ["createdAt", 1.5],
    ["scope", "filtered"],
    ["id", "not-a-uuid"],
  ])("rejects invalid %s value %s", (key, value) => {
    expect(
      validateChatVaultSnapshot({ ...snapshot(), [key]: value }),
    ).toBeNull();
  });

  it("validates real Gregorian dates, order and date-only coverage", () => {
    for (const fromDate of [
      "2023-02-29",
      "2024-02-30",
      "2024-13-01",
      "2024-00-01",
      "2024-01-00",
      "0999-01-01",
      "2024-02-29T12:00:00Z",
      "2025-01-01",
    ]) {
      const value = snapshot();
      value.coverage.fromDate = fromDate;
      expect(validateChatVaultSnapshot(value)).toBeNull();
    }
    const leap = createChatVaultSnapshot(
      parseWhatsApp("29/02/2024, 12:00 - Synthetic One: fictional", "dmy-24h"),
      options,
    );
    expect(validateChatVaultSnapshot(leap)).not.toBeNull();
  });

  it("rejects coverage/span contradictions and durations outside the recorded span", () => {
    for (const mutate of [
      (value: ChatVaultSnapshot) => (value.activity.calendarSpanDays = 99),
      (value: ChatVaultSnapshot) => (value.coverage.fromDate = "2024-02-29"),
      (value: ChatVaultSnapshot) =>
        (value.activity.observedSpanSeconds = 999999999),
      (value: ChatVaultSnapshot) => (value.activity.longestGapSeconds = 999999),
      (value: ChatVaultSnapshot) =>
        (value.rhythm.longestSessionSpanSeconds = 999999),
      (value: ChatVaultSnapshot) =>
        (value.rhythm.p75TransitionSeconds = 999999),
    ]) {
      const value = snapshot();
      mutate(value);
      expect(validateChatVaultSnapshot(value)).toBeNull();
    }
  });

  it("requires participant/session/run/burst evidence in a nonempty export", () => {
    for (const mutate of [
      (value: ChatVaultSnapshot) => (value.totals.participants = 0),
      (value: ChatVaultSnapshot) => {
        value.rhythm.sessionCount = 0;
        value.rhythm.medianSessionMessages = null;
        value.rhythm.longestSessionMessages = null;
        value.rhythm.longestSessionSpanSeconds = null;
      },
      (value: ChatVaultSnapshot) => {
        value.patterns.runs.count = 0;
        value.patterns.runs.longest = null;
        value.patterns.runs.medianLength = null;
        value.patterns.runs.distribution = [0, 0, 0, 0, 0];
      },
      (value: ChatVaultSnapshot) => (value.patterns.burst.maximum = 0),
      (value: ChatVaultSnapshot) => (value.patterns.burst.tiedWindows = 0),
    ]) {
      const value = snapshot();
      mutate(value);
      expect(validateChatVaultSnapshot(value)).toBeNull();
    }
  });

  it("rejects positive message-derived counts when no participant messages exist", () => {
    const dataset = fixture();
    dataset.messages = [];
    dataset.participants = [];
    const empty = createChatVaultSnapshot(dataset, options);
    for (const mutate of [
      (value: ChatVaultSnapshot) => (value.totals.links = 1),
      (value: ChatVaultSnapshot) => (value.totals.emoji = 1),
      (value: ChatVaultSnapshot) =>
        (value.patterns.questionMarks.occurrences = 1),
      (value: ChatVaultSnapshot) => (value.patterns.text.eligibleWords = 1),
    ]) {
      const value = structuredClone(empty);
      mutate(value);
      expect(validateChatVaultSnapshot(value)).toBeNull();
    }
  });

  it("accepts one-message/equal-clock zero spans and short intervals across leap dates", () => {
    for (const lines of [
      ["29/02/2024, 12:00 - Synthetic One: fictional"],
      [
        "29/02/2024, 12:00 - Synthetic One: fictional",
        "29/02/2024, 12:00 - Synthetic Two: fictional",
      ],
      [
        "29/02/2024, 12:00 - Synthetic One: fictional",
        "29/02/2024, 12:01 - Synthetic Two: fictional",
      ],
      [
        "29/02/2024, 23:59 - Synthetic One: fictional",
        "01/03/2024, 00:00 - Synthetic Two: fictional",
      ],
    ]) {
      const saved = createChatVaultSnapshot(
        parseWhatsApp(lines.join("\n"), "dmy-24h"),
        options,
      );
      expect(validateChatVaultSnapshot(saved)).toEqual(saved);
      expect(saved.activity.observedSpanSeconds).toBeLessThanOrEqual(60);
      if (saved.activity.observedSpanSeconds === 0)
        expect(saved.activity.longestGapSeconds).toBeNull();
    }
  });

  it("rejects malformed, excessive or inconsistent numeric aggregates and dimensions", () => {
    for (const messages of [-1, 0.5, NaN, Infinity, 200001, "4"]) {
      const value = snapshot() as unknown as { totals: { messages: unknown } };
      value.totals.messages = messages;
      expect(validateChatVaultSnapshot(value)).toBeNull();
    }
    for (const mutate of [
      (value: ChatVaultSnapshot) => value.activity.hours.pop(),
      (value: ChatVaultSnapshot) => value.activity.heatmap[0].pop(),
      (value: ChatVaultSnapshot) => (value.activity.hours[0] = 999),
      (value: ChatVaultSnapshot) => (value.activity.heatmap[0][0] = 999),
      (value: ChatVaultSnapshot) => (value.totals.participants = 10001),
      (value: ChatVaultSnapshot) => (value.totals.emoji = null),
      (value: ChatVaultSnapshot) => (value.patterns.questionMarks.share = 1.1),
      (value: ChatVaultSnapshot) => (value.patterns.text.length.p25 = null),
      (value: ChatVaultSnapshot) => value.rhythm.transitionDelayBuckets.pop(),
      (value: ChatVaultSnapshot) => (value.media.image = 99),
    ]) {
      const value = snapshot();
      mutate(value);
      expect(validateChatVaultSnapshot(value)).toBeNull();
    }
  });

  it("does not accept sparse/extended arrays or retain references from input", () => {
    const value = snapshot();
    delete value.activity.hours[0];
    expect(validateChatVaultSnapshot(value)).toBeNull();
    const original = snapshot();
    const valid = validateChatVaultSnapshot(original)!;
    expect(valid).toEqual(original);
    expect(valid).not.toBe(original);
    expect(valid.activity.hours).not.toBe(original.activity.hours);
    valid.activity.hours[0] = 99;
    expect(original.activity.hours[0]).not.toBe(99);
  });

  it("rejects fabricated unavailable summaries and impossible ordering", () => {
    for (const mutate of [
      (value: ChatVaultSnapshot) => (value.rhythm.medianSessionMessages = null),
      (value: ChatVaultSnapshot) =>
        (value.rhythm.medianSessionMessages = 99999),
      (value: ChatVaultSnapshot) => (value.rhythm.medianLongGapSeconds = 0),
      (value: ChatVaultSnapshot) => (value.rhythm.p25TransitionSeconds = null),
      (value: ChatVaultSnapshot) =>
        (value.rhythm.p25TransitionSeconds = 999999999),
      (value: ChatVaultSnapshot) => (value.patterns.runs.longest = null),
      (value: ChatVaultSnapshot) => (value.patterns.questionMarks.share = 0),
    ]) {
      const value = snapshot();
      mutate(value);
      expect(validateChatVaultSnapshot(value)).toBeNull();
    }
    const dataset = fixture();
    dataset.messages = [];
    dataset.participants = [];
    const empty = createChatVaultSnapshot(dataset, options);
    empty.rhythm.medianSessionMessages = 0;
    expect(validateChatVaultSnapshot(empty)).toBeNull();
  });
});

describe("versioned local Chat Vault backup and read-only import preview", () => {
  it("round-trips a canonical backup deterministically in newest-save order", () => {
    const older = snapshot();
    const newer = createChatVaultSnapshot(fixture(), {
      id: secondId,
      createdAt: options.createdAt + 1,
    });
    const raw = serializeChatVaultBackup([older, newer]);
    expect(parseChatVaultBackup(raw)).toEqual(backup([newer, older]));
    expect(serializeChatVaultBackup([newer, older])).toBe(raw);
    expect(newestChatVaultSnapshots([older, newer])).toEqual([newer, older]);
    const reversed = Object.fromEntries(Object.entries(older).reverse());
    expect(
      serializeChatVaultBackup([reversed as ChatVaultSnapshot, newer]),
    ).toBe(raw);
    expect(parseChatVaultBackup(serializeChatVaultBackup([]))).toEqual(
      backup([]),
    );
  });

  it("previews without mutation and leaves existing matching IDs authoritative", () => {
    const one = snapshot();
    const two = createChatVaultSnapshot(fixture(), { id: secondId });
    const incoming = validateChatVaultBackup(backup([one, two]))!;
    const existing = [{ id: one.id }];
    const before = structuredClone({ incoming, existing });
    expect(previewChatVaultImport(incoming, existing)).toEqual({
      incoming: 2,
      added: 1,
      duplicates: 1,
    });
    expect({ incoming, existing }).toEqual(before);
    expect(
      previewChatVaultImport(incoming, [{ id: one.id }, { id: two.id }]),
    ).toEqual({
      incoming: 2,
      added: 0,
      duplicates: 2,
    });
  });

  it("rejects unsupported versions, extra fields, invalid records and duplicate IDs", () => {
    for (const value of [
      null,
      [],
      {},
      { ...backup(), version: 2 },
      { ...backup(), format: "instascope-snapshot-vault" },
      { ...backup(), filename: "synthetic-private.txt" },
      backup([snapshot(), { malformed: true }]),
      backup([snapshot(), snapshot()]),
    ]) {
      expect(validateChatVaultBackup(value)).toBeNull();
      expect(() => parseChatVaultBackup(JSON.stringify(value))).toThrow(
        /valid Chat Vault/,
      );
    }
    expect(() => parseChatVaultBackup("{invalid")).toThrow(/valid Chat Vault/);
  });

  it("bounds input byte size and record count before accepting a backup", () => {
    expect(() =>
      parseChatVaultBackup(" ".repeat(MAX_CHAT_VAULT_BACKUP_BYTES + 1)),
    ).toThrow(/2 MB/);
    expect(() =>
      parseChatVaultBackup("🌿".repeat(MAX_CHAT_VAULT_BACKUP_BYTES / 3)),
    ).toThrow(/2 MB/);
    expect(
      validateChatVaultBackup(
        backup(Array(MAX_CHAT_VAULT_SNAPSHOTS + 1).fill(snapshot())),
      ),
    ).toBeNull();
  });

  it("returns controlled validation errors without reflecting private input", () => {
    try {
      parseChatVaultBackup('{"rawMessage":"SYNTHETIC_PRIVATE_BODY"}');
      expect.unreachable("Invalid backup must be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(ChatVaultValidationError);
      expect((error as Error).message).toBe(
        "Choose a valid Chat Vault V1 aggregate backup.",
      );
      expect((error as Error).message).not.toContain("SYNTHETIC_PRIVATE_BODY");
    }
    expect(() =>
      parseChatVaultBackup(" ".repeat(MAX_CHAT_VAULT_BACKUP_BYTES + 1)),
    ).toThrow(ChatVaultValidationError);
  });
});
