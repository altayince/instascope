import { describe, expect, it } from "vitest";
import { classifyWhatsAppEvent } from "../../src/lib/whatsapp/events";
import {
  ENGLISH_STOPWORDS,
  GERMAN_STOPWORDS,
  TURKISH_STOPWORDS,
  isWhatsAppStopword,
  normalizeWhatsAppWord,
} from "../../src/lib/whatsapp/stopwords";
import {
  COMPARISON_SMOOTHING,
  COMPARISON_WORD_LIMIT,
  MAX_WORD_LENGTH,
  MIN_COMPARISON_ELIGIBLE_WORDS,
  MIN_COMPARISON_RATIO,
  MIN_COMPARISON_WORD_OCCURRENCES,
  MIN_WORD_LENGTH,
  MIN_WORD_OCCURRENCES,
  TOP_WORD_LIMIT,
  analyzeWhatsAppText,
} from "../../src/lib/whatsapp/text-analysis";
import type {
  WhatsAppMessage,
  WhatsAppParticipant,
} from "../../src/lib/whatsapp/types";

// All labels, phrases and URLs are synthetic. No private export is used.
const participants: WhatsAppParticipant[] = [
  { id: "a", displayName: "Synthetic A" },
  { id: "b", displayName: "Synthetic B" },
  { id: "c", displayName: "Synthetic C" },
];

function message(
  content: string,
  participantId = "a",
  overrides: Partial<WhatsAppMessage> = {},
): WhatsAppMessage {
  return {
    id: 1,
    participantId,
    content,
    timestamp: {
      year: 2024,
      month: 6,
      day: 1,
      hour: 12,
      minute: 0,
      second: 0,
      precision: "minute",
      date: "2024-06-01",
      local: "2024-06-01T12:00",
    },
    links: [],
    emoji: [],
    ...overrides,
  };
}

const repeated = (word: string, count: number) =>
  Array.from({ length: count }, () => word).join(" ");
const lexemes = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `lexa${String.fromCharCode(97 + index)}`,
  );

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
}

describe("fixed Turkish, German and English stopwords", () => {
  it("keeps each maintainable language list separate and applies all three together", () => {
    expect(TURKISH_STOPWORDS).toContain("çünkü");
    expect(GERMAN_STOPWORDS).toContain("für");
    expect(ENGLISH_STOPWORDS).toContain("the");
    for (const word of [
      "ÇÜNKÜ",
      "İÇİN",
      "BİR",
      "UND",
      "FU\u0308R",
      "THE",
      "WITH",
    ]) {
      expect(isWhatsAppStopword(word)).toBe(true);
    }
    expect(isWhatsAppStopword("çiçek")).toBe(false);
    expect(isWhatsAppStopword("Straße")).toBe(false);
    expect(isWhatsAppStopword("orchard")).toBe(false);
    const output = analyzeWhatsAppText(
      [message("THE und ve İÇİN FÜR because çünkü")],
      participants,
    );
    expect(output.wordsPerMessage.median).toBe(7);
    expect(output.eligibleWords).toBe(0);
    expect(output.words).toEqual([]);
  });

  it("normalizes composition and dotted İ consistently while preserving dotless ı and ß", () => {
    expect(normalizeWhatsAppWord("İZMİR")).toBe("izmir");
    expect(normalizeWhatsAppWord("i\u0307zmir")).toBe("izmir");
    expect(normalizeWhatsAppWord("IZMIR")).toBe("izmir");
    expect(normalizeWhatsAppWord("ıŞıK")).toBe("ışık");
    expect(normalizeWhatsAppWord("IŞIK")).toBe("işik");
    expect(normalizeWhatsAppWord("STRAẞE")).toBe("straße");
    expect(normalizeWhatsAppWord("STRASSE")).toBe("strasse");
    expect(normalizeWhatsAppWord("A\u0308PFEL")).toBe("äpfel");
  });
});

describe("ordinary-text eligibility and Unicode message lengths", () => {
  it("uses NFC + trim code points and interpolates even medians and quartiles", () => {
    const output = analyzeWhatsAppText(
      [
        message(" a "),
        message("abc"),
        message(" A😀\n e\u0301 ? "),
        message("hello world"),
      ],
      participants,
    );
    expect(output.eligibleTextMessages).toBe(4);
    expect(output.length).toEqual({ count: 4, median: 5, p25: 2.5, p75: 8 });
    expect(output.wordsPerMessage).toEqual({
      count: 4,
      median: 1.5,
      p25: 1,
      p75: 2,
    });
    expect(output.participants[0].length).toEqual(output.length);
    expect(output.participants[0].wordsPerMessage).toEqual(
      output.wordsPerMessage,
    );
  });

  it("counts multi-code-point emoji as code points and keeps URLs in length only", () => {
    const emoji = analyzeWhatsAppText([message("  👩🏽‍💻  ")], participants);
    expect(emoji.length.median).toBe(4);
    expect(emoji.wordsPerMessage.median).toBe(0);
    const url = analyzeWhatsAppText(
      [message(" a https://x.test ")],
      participants,
    );
    expect(url.length.median).toBe(16);
    expect(url.wordsPerMessage.median).toBe(1);
    expect(url.eligibleWords).toBe(0);
  });

  it("keeps pre-stopword and pre-length-threshold word counts separate from eligible frequencies", () => {
    const output = analyzeWhatsAppText(
      [message(`the a bb q ${"x".repeat(41)}`), message("the bb")],
      participants,
    );
    expect(output.wordsPerMessage.median).toBe(3.5);
    expect(output.eligibleWords).toBe(2);
    expect(output.words).toEqual([{ word: "bb", count: 2 }]);
  });

  it("excludes every typed media/event record and filename/caption-bearing marker variant", () => {
    const structural = [
      "<Media omitted>",
      "image omitted",
      "video omitted",
      "audio omitted",
      "sticker omitted",
      "GIF omitted",
      "document omitted",
      "<Bild ausgelassen>",
      "<Video ausgelassen>",
      "<Sprachnachricht ausgelassen>",
      "<Sticker ausgelassen>",
      "<GIF ausgelassen>",
      "<Dokument ausgelassen>",
      "[Anruf]",
      "Du hast diese Nachricht gelöscht.",
      "Standort: 10, 20 - https://maps.google.com/?q=10,20",
    ];
    const records = structural.map((content) => {
      const event = classifyWhatsAppEvent(content);
      expect(event).toBeDefined();
      return message(content, "b", { event });
    });
    const output = analyzeWhatsAppText(
      [
        ...records,
        message("synthetic attachment", "b", { media: "document" }),
        message(
          "<Dokument ausgelassen> synthetic-file.pdf synthetic caption",
          "b",
        ),
        message("\u200e<Bild ausgelassen> synthetic caption", "b"),
        message("Anruf prose Anruf", "a"),
      ],
      participants,
    );
    expect(output.eligibleTextMessages).toBe(1);
    expect(output.words).toEqual([{ word: "anruf", count: 2 }]);
    expect(output.participants[1]).toMatchObject({
      id: "b",
      eligibleTextMessages: 0,
      eligibleWords: 0,
      length: { count: 0, median: null, p25: null, p75: null },
      wordsPerMessage: { count: 0, median: null, p25: null, p75: null },
      comparison: { available: false, reason: "insufficient-data" },
    });
  });

  it("skips trimmed empty text, retains nonempty punctuation/number messages with zero lexical words", () => {
    const output = analyzeWhatsAppText(
      [message(""), message(" \n\t "), message("123 😄 !!!")],
      participants,
    );
    expect(output.eligibleTextMessages).toBe(1);
    expect(output.length.median).toBe(9);
    expect(output.wordsPerMessage.median).toBe(0);
    expect(output.eligibleWords).toBe(0);
    expect(output.words).toEqual([]);
  });

  it("returns unavailable numeric summaries and no participants for an empty selected population", () => {
    expect(analyzeWhatsAppText([], participants)).toEqual({
      eligibleTextMessages: 0,
      length: { count: 0, median: null, p25: null, p75: null },
      wordsPerMessage: { count: 0, median: null, p25: null, p75: null },
      eligibleWords: 0,
      words: [],
      participants: [],
    });
  });
});

describe("local Unicode lexical frequencies", () => {
  it("preserves Turkish/German accents and fixed lowercase distinctions without stemming", () => {
    const output = analyzeWhatsAppText(
      [
        message(
          "İzmir izmir i\u0307zmir IZMIR IŞIK ışık Straße STRAẞE Strasse strasse ÄPFEL a\u0308pfel gün gün ÇİÇEK çiçek",
        ),
      ],
      participants,
    );
    expect(output.eligibleWords).toBe(16);
    expect(output.words).toEqual([
      { word: "izmir", count: 4 },
      { word: "gün", count: 2 },
      { word: "strasse", count: 2 },
      { word: "straße", count: 2 },
      { word: "äpfel", count: 2 },
      { word: "çiçek", count: 2 },
    ]);
    expect(output.wordsPerMessage.median).toBe(16);
  });

  it("uses letter/mark runs across punctuation, apostrophes, hyphens, multiline text, emoji and numbers", () => {
    const output = analyzeWhatsAppText(
      [
        message(
          "orbit,orbit! blue-green blue—green don't don't 123 42 😀\norchard's orchard’s",
        ),
      ],
      participants,
    );
    expect(output.wordsPerMessage.median).toBe(14);
    expect(output.eligibleWords).toBe(8);
    expect(output.words).toEqual([
      { word: "blue", count: 2 },
      { word: "green", count: 2 },
      { word: "orbit", count: 2 },
      { word: "orchard", count: 2 },
    ]);
  });

  it("strips URL schemes, www, common URI forms and Unicode email addresses before token counts", () => {
    const synthetic = [
      "alpha",
      "https://secret.test/path?q=privateword&v=3",
      "HTTP://hidden.test/path",
      "WWW.Hidden.test/secret",
      "ftp://server.test/privateword",
      "git+ssh://host.test/path",
      "mailto:hidden@secret.test",
      "gizli@örnek.test",
      "tel:+4930123",
      "sms:+4930999",
      "urn:uuid:privateword",
      "data:text/plain,privateword",
      "beta",
    ].join(" ");
    const output = analyzeWhatsAppText(
      [message(synthetic), message(synthetic)],
      participants,
    );
    expect(output.wordsPerMessage.median).toBe(2);
    expect(output.eligibleWords).toBe(4);
    expect(output.words).toEqual([
      { word: "alpha", count: 2 },
      { word: "beta", count: 2 },
    ]);
    expect(JSON.stringify(output)).not.toContain("privateword");
    expect(JSON.stringify(output)).not.toContain("hidden");
  });

  it("does not mistake ordinary colon prose for a URI", () => {
    const output = analyzeWhatsAppText(
      [message("orbit:orchard orbit:orchard")],
      participants,
    );
    expect(output.wordsPerMessage.median).toBe(4);
    expect(output.words).toEqual([
      { word: "orbit", count: 2 },
      { word: "orchard", count: 2 },
    ]);
  });

  it("removes apostrophe-bearing URL paths, queries and supported nonhierarchical URIs completely", () => {
    const synthetic = [
      "alpha",
      "https://example.test/o'connor?q=private'orbit",
      "ftp://example.test/o'connor",
      "www.example.test/o'connor",
      "https:example.test/o'connor",
      "HTTP:example.test/o'connor",
      "mailto:orion'connor@example.test",
      "urn:synthetic:o'connor",
      "data:text/plain,o'connor",
      "beta",
    ].join(" ");
    const output = analyzeWhatsAppText(
      [message(synthetic), message(synthetic)],
      participants,
    );
    expect(output.wordsPerMessage.median).toBe(2);
    expect(output.eligibleWords).toBe(4);
    expect(output.words).toEqual([
      { word: "alpha", count: 2 },
      { word: "beta", count: 2 },
    ]);
  });

  it("removes complete Unicode emails with apostrophes and other legal unquoted local-part punctuation", () => {
    const synthetic = [
      "alpha",
      ...[
        "orion'connor",
        "orion!tag",
        "orion#tag",
        "orion+tag",
        "orion/tag",
        "orion=tag",
        "orion_tag",
      ].map((local) => `${local}@example.test`),
      "orion'connor@örnek.test",
      "beta",
    ].join(" ");
    const output = analyzeWhatsAppText(
      [message(synthetic), message(synthetic)],
      participants,
    );
    expect(output.wordsPerMessage.median).toBe(2);
    expect(output.eligibleWords).toBe(4);
    expect(output.words).toEqual([
      { word: "alpha", count: 2 },
      { word: "beta", count: 2 },
    ]);
  });

  it("handles long non-email tokens and malformed scheme candidates without retrying every suffix", () => {
    const longToken = "z".repeat(200_000);
    const malformedScheme = `${"z-".repeat(50_000)}tail`;
    const malformedEmail = "z'".repeat(50_000);
    const output = analyzeWhatsAppText(
      [
        message(
          `${longToken} ${malformedScheme} ${malformedEmail} valid https://hidden.test/secret ${longToken}@example.test fruit fruit`,
        ),
      ],
      participants,
    );
    expect(output.eligibleTextMessages).toBe(1);
    expect(output.eligibleWords).toBe(4);
    expect(output.words).toEqual([{ word: "fruit", count: 2 }]);
  }, 2_000);

  it("applies code-point length boundaries and occurrence thresholds while keeping singleton denominators", () => {
    expect(MIN_WORD_LENGTH).toBe(2);
    expect(MAX_WORD_LENGTH).toBe(40);
    expect(MIN_WORD_OCCURRENCES).toBe(2);
    const forty = "𐐀".repeat(40);
    const output = analyzeWhatsAppText(
      [
        message(`ab x ${forty} ${"𐐀".repeat(41)} singleton`),
        message(`ab x ${forty} ${"𐐀".repeat(41)}`),
      ],
      participants,
    );
    expect(output.eligibleWords).toBe(5);
    expect(output.words).toEqual([
      { word: "ab", count: 2 },
      { word: "𐐨".repeat(40), count: 2 },
    ]);
    expect(output.wordsPerMessage.median).toBe(4.5);
  });

  it("orders equal counts by normalized binary word and bounds global and participant top words", () => {
    expect(TOP_WORD_LIMIT).toBe(20);
    const words = lexemes(26);
    const output = analyzeWhatsAppText(
      [
        message(
          words
            .toReversed()
            .flatMap((word) => [word, word])
            .join(" "),
          "b",
        ),
        message(words.flatMap((word) => [word, word]).join(" "), "a"),
      ],
      participants,
    );
    expect(output.words).toEqual(
      words.slice(0, 20).map((word) => ({ word, count: 4 })),
    );
    for (const participant of output.participants) {
      expect(participant.words).toEqual(
        words.slice(0, 20).map((word) => ({ word, count: 2 })),
      );
      expect(participant.eligibleWords).toBe(52);
    }
  });

  it("recomputes only supplied date/participant subsets and includes only present labels", () => {
    const old = message("pear pear", "a");
    const recent = message("orbit orbit", "b", {
      timestamp: {
        ...old.timestamp,
        year: 2025,
        date: "2025-06-01",
        local: "2025-06-01T12:00",
      },
    });
    const full = analyzeWhatsAppText([old, recent], participants);
    const cropped = analyzeWhatsAppText([recent], participants);
    expect(full.words).toEqual([
      { word: "orbit", count: 2 },
      { word: "pear", count: 2 },
    ]);
    expect(cropped.words).toEqual([{ word: "orbit", count: 2 }]);
    expect(cropped.participants.map((participant) => participant.id)).toEqual([
      "b",
    ]);
    expect(cropped.participants[0].comparison).toEqual({
      available: false,
      reason: "one-participant",
    });
  });
});

describe("participant words used disproportionately often", () => {
  it("keeps all product thresholds and smoothing explicit", () => {
    expect(MIN_COMPARISON_WORD_OCCURRENCES).toBe(3);
    expect(MIN_COMPARISON_ELIGIBLE_WORDS).toBe(20);
    expect(COMPARISON_SMOOTHING).toBe(0.5);
    expect(MIN_COMPARISON_RATIO).toBe(2);
    expect(COMPARISON_WORD_LIMIT).toBe(10);
  });

  it("uses complete eligible denominators and exact additive-smoothed per-thousand rates", () => {
    const singletonWords = lexemes(17).join(" ");
    const output = analyzeWhatsAppText(
      [
        message(`${repeated("nectar", 3)} ${singletonWords}`, "a"),
        message(repeated("stone", 20), "b"),
      ],
      participants,
    );
    expect(output.participants[0].eligibleWords).toBe(20);
    expect(output.participants[0].words).toEqual([
      { word: "nectar", count: 3 },
    ]);
    expect(output.participants[0].comparison).toEqual({
      available: true,
      words: [
        {
          word: "nectar",
          count: 3,
          otherCount: 0,
          perThousand: (3.5 / 21) * 1000,
          otherPerThousand: (0.5 / 21) * 1000,
          ratio: 7,
        },
      ],
    });
  });

  it.each([
    [19, 20],
    [20, 19],
    [0, 20],
    [20, 0],
  ])(
    "requires at least twenty eligible words in both populations (%s, %s)",
    (ownTotal, otherTotal) => {
      const output = analyzeWhatsAppText(
        [
          message(repeated("nectar", ownTotal), "a"),
          message(repeated("stone", otherTotal), "b"),
        ],
        participants,
      );
      for (const participant of output.participants) {
        expect(participant.comparison).toEqual({
          available: false,
          reason: "insufficient-data",
        });
      }
    },
  );

  it("does not qualify two occurrences even with a large smoothed ratio", () => {
    const output = analyzeWhatsAppText(
      [
        message(`${repeated("nectar", 2)} ${repeated("stone", 18)}`, "a"),
        message(repeated("stone", 20), "b"),
      ],
      participants,
    );
    expect(output.participants[0].comparison).toEqual({
      available: true,
      words: [],
    });
  });

  it("keeps sufficient comparison data available when no words meet the ratio", () => {
    const output = analyzeWhatsAppText(
      [
        message(repeated("marble", 20), "a"),
        message(repeated("marble", 20), "b"),
      ],
      participants,
    );
    expect(
      output.participants.map((participant) => participant.comparison),
    ).toEqual([
      { available: true, words: [] },
      { available: true, words: [] },
    ]);
  });

  it("compares normalized frequency rather than favoring a participant with larger raw counts", () => {
    const output = analyzeWhatsAppText(
      [
        message(`${repeated("nectar", 6)} ${repeated("marble", 94)}`, "a"),
        message(`${repeated("nectar", 3)} ${repeated("quartz", 17)}`, "b"),
      ],
      participants,
    );
    const own = output.participants[0].comparison;
    const other = output.participants[1].comparison;
    expect(
      own.available && own.words.some((word) => word.word === "nectar"),
    ).toBe(false);
    expect(other.available).toBe(true);
    if (!other.available)
      throw new Error("Synthetic comparison unexpectedly unavailable");
    const nectar = other.words.find((word) => word.word === "nectar")!;
    expect(nectar.count).toBe(3);
    expect(nectar.otherCount).toBe(6);
    expect(nectar.ratio).toBeCloseTo(3.5 / 21 / (6.5 / 101));
  });

  it("includes the ratio boundary of exactly two", () => {
    const output = analyzeWhatsAppText(
      [
        message(`${repeated("nectar", 3)} ${repeated("marble", 17)}`, "a"),
        message(`${repeated("nectar", 3)} ${repeated("stone", 38)}`, "b"),
      ],
      participants,
    );
    const comparison = output.participants[0].comparison;
    expect(comparison.available).toBe(true);
    if (!comparison.available)
      throw new Error("Synthetic comparison unexpectedly unavailable");
    expect(
      comparison.words.find((word) => word.word === "nectar"),
    ).toMatchObject({ ratio: 2 });
  });

  it("pools the other group labels instead of averaging their per-label rates", () => {
    const output = analyzeWhatsAppText(
      [
        message(`${repeated("nectar", 3)} ${repeated("marble", 17)}`, "a"),
        message(repeated("stone", 10), "b"),
        message(repeated("pebble", 10), "c"),
      ],
      participants,
    );
    const comparison = output.participants[0].comparison;
    expect(comparison.available).toBe(true);
    if (!comparison.available)
      throw new Error("Synthetic comparison unexpectedly unavailable");
    expect(comparison.words.find((word) => word.word === "nectar")).toEqual({
      word: "nectar",
      count: 3,
      otherCount: 0,
      perThousand: (3.5 / 21) * 1000,
      otherPerThousand: (0.5 / 21) * 1000,
      ratio: 7,
    });
    expect(output.participants[1].comparison).toEqual({
      available: false,
      reason: "insufficient-data",
    });
    expect(output.participants[2].comparison).toEqual({
      available: false,
      reason: "insufficient-data",
    });
  });

  it("orders ratio ties by own count and then binary word, and caps the list at ten", () => {
    const counts = analyzeWhatsAppText(
      [
        message(
          `${repeated("orbit", 10)} ${repeated("nectar", 3)} ${repeated("marble", 7)}`,
          "a",
        ),
        message(`orbit ${repeated("marble", 19)}`, "b"),
      ],
      participants,
    ).participants[0].comparison;
    expect(counts.available && counts.words.map((word) => word.word)).toEqual([
      "orbit",
      "nectar",
    ]);
    const candidates = lexemes(14);
    const capped = analyzeWhatsAppText(
      [
        message(
          candidates
            .toReversed()
            .map((word) => repeated(word, 3))
            .join(" "),
          "a",
        ),
        message(repeated("marble", 42), "b"),
      ],
      participants,
    ).participants[0].comparison;
    expect(capped.available && capped.words.map((word) => word.word)).toEqual(
      candidates.slice(0, 10),
    );
  });

  it("uses one-participant unavailability for the present population, with participant-filter taking precedence", () => {
    const messages = [message(repeated("nectar", 25), "a")];
    const one = analyzeWhatsAppText(messages, participants);
    expect(one.participants).toHaveLength(1);
    expect(one.participants[0].comparison).toEqual({
      available: false,
      reason: "one-participant",
    });
    const filtered = analyzeWhatsAppText(messages, participants, {
      comparisonAllowed: false,
    });
    expect(filtered.participants[0].comparison).toEqual({
      available: false,
      reason: "participant-filter",
    });
  });
});

describe("local text-analysis purity and aggregate-only outputs", () => {
  it("does not mutate deeply frozen records or retain bodies, URLs, record references or extra participant fields", () => {
    const source = freeze([
      message(
        "A synthetic one-off sentence https://hidden.test/privateword",
        "a",
      ),
      message("<Dokument ausgelassen> synthetic-filename.pdf", "b"),
    ]);
    const labels = freeze(
      participants.map((participant) => ({
        ...participant,
        content: "synthetic extra participant field",
        privateField: "synthetic secret field",
      })),
    );
    const options = freeze({ comparisonAllowed: false });
    const before = JSON.stringify({ source, labels, options });
    const output = analyzeWhatsAppText(source, labels, options);
    expect(JSON.stringify({ source, labels, options })).toBe(before);
    const serialized = JSON.stringify(output);
    for (const forbidden of [
      source[0].content,
      source[1].content,
      "privateword",
      "synthetic-filename",
      "synthetic extra participant field",
      "synthetic secret field",
      '"content"',
      '"links"',
      '"timestamp"',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(output.participants[0]).not.toBe(labels[0]);
    expect(analyzeWhatsAppText(source, labels, options)).toEqual(output);
    output.participants[0].displayName = "Changed result only";
    expect(labels[0].displayName).toBe("Synthetic A");
  });
});
