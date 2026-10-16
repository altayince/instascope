import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { detectWhatsAppFormat } from "../../src/lib/whatsapp/detection";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import { analyzeWhatsApp } from "../../src/lib/whatsapp/analysis";
import { buildWhatsAppStories } from "../../src/lib/whatsapp/stories";
import { classifyWhatsAppEvent } from "../../src/lib/whatsapp/events";
import { detectWhatsAppMedia } from "../../src/lib/whatsapp/normalize";

describe("local WhatsApp structural format detection", () => {
  it.each([
    ["[3/14/26, 9:45:46 AM] Synthetic A: Hello", "mdy-12h", "ios", 2, "second"],
    ["[14/3/26, 9:45 AM] Synthetic A: Hello", "dmy-12h", "ios", 2, "minute"],
    [
      "14/03/2025, 21:45 - Synthetic A: Hello",
      "dmy-24h",
      "android",
      4,
      "minute",
    ],
    [
      "2025-03-14, 09:45:46 - Synthetic A: Hello",
      "ymd-24h",
      "android",
      4,
      "second",
    ],
  ] as const)(
    "reports only the supported interpretation of %s",
    (input, format, wrapper, yearWidth, precision) => {
      const report = detectWhatsAppFormat(input);
      expect(report.status).toBe("supported");
      expect(report.confidence).toBe("exact");
      expect(report.detectedFormat).toBe(format);
      expect(report.candidateFormats).toEqual([format]);
      expect(report.wrappers).toEqual([wrapper]);
      expect(report.yearWidths).toEqual([yearWidth]);
      expect(report.timestampPrecision).toBe(precision);
      expect(report.headerCount).toBe(1);
      expect(report.unsupportedLookingRecords).toBe(0);
    },
  );

  it("requires deliberate date-order selection when both interpretations are valid", () => {
    const input = "[7/6/26, 9:45:46 AM] Synthetic A: Hello";
    const report = detectWhatsAppFormat(input);
    expect(report.status).toBe("ambiguous");
    expect(report.confidence).toBe("needs-selection");
    expect(report.detectedFormat).toBeNull();
    expect(report.candidateFormats).toEqual(
      expect.arrayContaining(["dmy-12h", "mdy-12h"]),
    );
    expect(report.candidateFormats).toHaveLength(2);
    expect(parseWhatsApp(input, "dmy-12h").messages[0].timestamp.date).toBe(
      "2026-06-07",
    );
    expect(parseWhatsApp(input, "mdy-12h").messages[0].timestamp.date).toBe(
      "2026-07-06",
    );
  });

  it("uses evidence across records rather than the first ambiguous date alone", () => {
    const report = detectWhatsAppFormat(
      [
        "[3/4/26, 9:45 AM] Synthetic A: Hello",
        "[3/14/26, 9:46 AM] Synthetic B: Hello",
      ].join("\n"),
    );
    expect(report.detectedFormat).toBe("mdy-12h");
    expect(report.headerCount).toBe(2);
  });

  it("retains mixed seconds precision without exposing text or identifiers", () => {
    const input = [
      "SYNTHETIC_PRIVATE_PREAMBLE",
      "[3/14/26, 9:45 AM] SYNTHETIC_PRIVATE_PARTICIPANT: SYNTHETIC_PRIVATE_BODY",
      "https://synthetic-private.invalid/secret",
      "[3/14/26, 9:46:07 AM] Synthetic B: Hello",
    ].join("\n");
    const report = detectWhatsAppFormat(input);
    expect(report.timestampPrecision).toBe("mixed");
    expect(report.preambleLines).toBe(1);
    expect(report.continuationLines).toBe(1);
    expect(JSON.stringify(report)).not.toMatch(
      /SYNTHETIC_PRIVATE|synthetic-private|secret/,
    );
  });

  it.each([
    "[2/29/25, 9:45 AM] Synthetic A: Impossible date",
    "[3/14/26, 13:45 AM] Synthetic A: Invalid hour",
    "[3/14/26, 9:60 AM] Synthetic A: Invalid minute",
    "[3/14/26, 9:45:60 AM] Synthetic A: Invalid second",
    "[3/14/26, 9:45 vorm.] Synthetic A: Unknown clock marker",
    "14.03.26, 09:45 - Synthetic A: Unsupported separator",
    "Not a chat export",
  ])("does not offer an inferred supported format for %s", (input) => {
    const report = detectWhatsAppFormat(input);
    expect(report.status).toBe("unsupported");
    expect(report.detectedFormat).toBeNull();
    expect(report.candidateFormats).toEqual([]);
  });

  it("rejects mixed unsupported headers instead of treating them as message text", () => {
    const input = [
      "[3/14/26, 9:45 AM] Synthetic A: Hello",
      "[15/3/26, 9:46 AM] Synthetic B: Mixed order",
    ].join("\n");
    expect(detectWhatsAppFormat(input).status).toBe("unsupported");
    expect(() => parseWhatsApp(input, "mdy-12h")).toThrow();
    const malformed = [
      "[3/14/26, 9:45 AM] Synthetic A: Hello",
      "[3/15/26, 9.46 AM] Synthetic B: Unsupported clock separator",
    ].join("\n");
    expect(detectWhatsAppFormat(malformed).unsupportedLookingRecords).toBe(1);
    expect(() => parseWhatsApp(malformed, "mdy-12h")).toThrow();
  });
});

describe("malformed WhatsApp date-header boundaries", () => {
  it.each([
    "[14/XX/26, 9:45 AM] Synthetic B: Invalid date component",
    "[14/Mar/26, 9:45 AM] Synthetic B: Unsupported month component",
    "14/XX/26, 9:45 AM - Synthetic B: Invalid date component",
    "14/Mar/26, 9:45 AM - Synthetic B: Unsupported month component",
    "[14//26, 9:45 AM] Synthetic B: Missing date component",
  ])(
    "rejects unsupported date components instead of appending %s",
    (header) => {
      const source = `[3/14/26, 9:44 AM] Synthetic A: First record\n${header}`;
      const report = detectWhatsAppFormat(source);
      expect(report.status).toBe("unsupported");
      expect(report.candidateFormats).toEqual([]);
      expect(report.unsupportedLookingRecords).toBe(1);
      expect(() => parseWhatsApp(source, "mdy-12h")).toThrow(
        /unsupported or mixed/,
      );
    },
  );

  it("rejects malformed date-shaped preamble rather than skipping it", () => {
    const source = [
      "[14/XX/26, 9:45 AM] Synthetic B: Invalid first record",
      "[3/14/26, 9:46 AM] Synthetic A: Valid later record",
    ].join("\n");
    expect(detectWhatsAppFormat(source).status).toBe("unsupported");
    expect(() => parseWhatsApp(source, "mdy-12h")).toThrow(
      /unsupported or mixed/,
    );
  });

  it("preserves ordinary bracketed prose that lacks a numeric date component", () => {
    const continuation = [
      "[A fictional note]",
      "[Reminder, 9:45 AM]",
      "[notes/for/later, 9:45 AM]",
      "[14/XX/26 is a fictional example without a clock]",
    ].join("\n");
    const source = `[3/14/26, 9:44 AM] Synthetic A: First record\n${continuation}`;
    expect(detectWhatsAppFormat(source).status).toBe("supported");
    expect(parseWhatsApp(source, "mdy-12h").messages[0].content).toBe(
      `First record\n${continuation}`,
    );
  });
});

describe("explicit WhatsApp year and Doctor source semantics", () => {
  it("parses the structural YY fixtures with recorded precision and continuation text", () => {
    const fixture = (name: string) =>
      readFileSync(
        new URL(`../fixtures/whatsapp/${name}`, import.meta.url),
        "utf8",
      );
    const mdy = parseWhatsApp(fixture("mdy-yy-ios.txt"), "mdy-12h");
    expect(mdy.messages.map((message) => message.timestamp.local)).toEqual([
      "2026-03-14T00:00:01",
      "2026-03-14T12:05",
      "2026-03-15T13:02:03",
    ]);
    expect(mdy.metadata.timestampPrecision).toBe("mixed");
    expect(mdy.metadata.doctor.detection.preambleLines).toBe(1);
    expect(mdy.messages[0].content).toBe(
      "A fictional first line.\nA fictional continuation line.",
    );
    const dmy = parseWhatsApp(fixture("dmy-yy-ios.txt"), "dmy-12h");
    expect(dmy.messages.map((message) => message.timestamp.date)).toEqual([
      "2026-03-14",
      "2026-03-15",
    ]);
    expect(dmy.metadata.timestampPrecision).toBe("minute");
  });

  it.each([
    ["00", "2000"],
    ["26", "2026"],
    ["99", "2099"],
  ])(
    "maps slash YY %s to the documented century without a moving pivot",
    (short, full) => {
      const timestamp = parseWhatsApp(
        `[3/14/${short}, 9:45:46 AM] Synthetic A: Hello`,
        "mdy-12h",
      ).messages[0].timestamp;
      expect(timestamp.date).toBe(`${full}-03-14`);
      expect(timestamp.sourceYearWidth).toBe(2);
      expect(timestamp.precision).toBe("second");
      expect(timestamp.local).toBe(`${full}-03-14T09:45:46`);
      expect(timestamp).not.toHaveProperty("timezone");
    },
  );

  it("preserves explicit historical YYYY independently from the YY century rule", () => {
    const timestamp = parseWhatsApp(
      "[3/14/1999, 9:45 AM] Synthetic A: Hello",
      "mdy-12h",
    ).messages[0].timestamp;
    expect(timestamp.date).toBe("1999-03-14");
    expect(timestamp.precision).toBe("minute");
  });

  it("counts ignored preamble without retaining or sharing source text", () => {
    const dataset = parseWhatsApp(
      [
        "SYNTHETIC_PRIVATE_PREAMBLE",
        "[3/14/26, 9:45 AM] SYNTHETIC_PRIVATE_PARTICIPANT: SYNTHETIC_PRIVATE_BODY",
        "[3/14/26, 9:46 AM] Synthetic B: https://synthetic-private.invalid/secret",
      ].join("\n"),
      "mdy-12h",
    );
    expect(dataset.metadata.doctor.detection.preambleLines).toBe(1);
    expect(dataset.metadata.doctor.participantLabels).toBe(2);
    expect(dataset.metadata.doctor.selectedFormat).toBe("mdy-12h");
    expect(JSON.stringify(dataset.metadata.doctor)).not.toMatch(
      /SYNTHETIC_PRIVATE|synthetic-private|secret/,
    );
    expect(JSON.stringify(dataset)).not.toContain("SYNTHETIC_PRIVATE_PREAMBLE");
    expect(
      JSON.stringify(buildWhatsAppStories(analyzeWhatsApp(dataset), dataset)),
    ).not.toMatch(/SYNTHETIC_PRIVATE|synthetic-private|secret/);
  });
});

describe("exact localized WhatsApp event coverage", () => {
  it("normalizes only verified German markers and keeps calls separate from participant messages", () => {
    const source = readFileSync(
      new URL("../fixtures/whatsapp/ios-de-markers.txt", import.meta.url),
      "utf8",
    );
    const dataset = parseWhatsApp(source, "mdy-12h");
    expect(dataset.messages).toHaveLength(9);
    expect(dataset.systemEvents).toHaveLength(1);
    expect(dataset.messages.map((record) => record.event?.kind)).toEqual([
      "image",
      "video",
      "audio",
      "sticker",
      "gif",
      "deleted-message",
      "document",
      "location",
      undefined,
    ]);
    expect(dataset.messages.map((record) => record.media)).toEqual([
      "image",
      "video",
      "audio",
      "sticker",
      "gif",
      undefined,
      "document",
      undefined,
      undefined,
    ]);
    expect(dataset.systemEvents[0].event).toEqual({
      kind: "call",
      locale: "de",
    });
    for (const kind of [
      "image",
      "video",
      "audio",
      "sticker",
      "gif",
      "document",
      "deleted-message",
      "call",
      "location",
    ])
      expect(dataset.metadata.doctor.localizedMarkers).toContainEqual({
        locale: "de",
        kind,
        count: 1,
      });
    expect(dataset.metadata.doctor.unclassifiedMarkerRecords).toBe(1);
    expect(dataset.metadata.doctor.status).toBe("partially-supported");
    expect(JSON.stringify(dataset.metadata.doctor)).not.toContain(
      "synthetic-document.pdf",
    );
    expect(analyzeWhatsApp(dataset).totals).toMatchObject({
      messages: 9,
      systemEvents: 1,
      mediaMessages: 6,
    });
  });

  it.each([
    ["<Bild ausgelassen>", "image"],
    ["<Video ausgelassen>", "video"],
    ["<Sprachnachricht ausgelassen>", "audio"],
    ["<Sticker ausgelassen>", "sticker"],
    ["<GIF ausgelassen>", "gif"],
    ["<Dokument ausgelassen>", "document"],
    ["Du hast diese Nachricht gelöscht.", "deleted-message"],
    ["[Anruf]", "call"],
    ["- [Anruf]", "call"],
  ] as const)("recognizes an exact complete marker %s", (marker, kind) => {
    expect(classifyWhatsAppEvent(marker)).toEqual({ kind, locale: "de" });
  });

  it.each([
    "We discussed <Bild ausgelassen>",
    "<Bild ausgelassen>\nA fictional caption.",
    '"<Video ausgelassen>"',
    "<bild ausgelassen>",
    "<Sprachnachricht ausgelassen> is a marker",
    "I wrote [Anruf] in a message",
    "Du hast diese Nachricht gelöscht. A fictional explanation.",
    "<Dokument ausgelassen>: synthetic-document.pdf",
    "__proto__",
    "toString",
  ])(
    "does not infer events from arbitrary text or unverified translations: %s",
    (content) => {
      expect(classifyWhatsAppEvent(content)).toBeUndefined();
      expect(detectWhatsAppMedia(content)).toBeUndefined();
    },
  );

  it("keeps source links and location-like text out of Doctor and Wrapped without visiting or inferring them", () => {
    const dataset = parseWhatsApp(
      [
        "[3/14/26, 9:45 AM] Synthetic A: SYNTHETIC_PRIVATE_BODY https://example.invalid/private-location",
        "[3/14/26, 9:46 AM] Synthetic B: A fictional location description.",
      ].join("\n"),
      "mdy-12h",
    );
    expect(dataset.messages[0].event).toBeUndefined();
    expect(dataset.messages[0].links).toEqual([
      "https://example.invalid/private-location",
    ]);
    const output = JSON.stringify({
      doctor: dataset.metadata.doctor,
      cards: buildWhatsAppStories(analyzeWhatsApp(dataset), dataset),
    });
    expect(output).not.toMatch(
      /SYNTHETIC_PRIVATE_BODY|example\.invalid|private-location|fictional location description/,
    );
  });

  it("recognizes the exact location structure but excludes its URL from aggregate analysis and share output", () => {
    const marker = "Standort: 0, 0 - https://maps.google.com/?q=0,0";
    expect(classifyWhatsAppEvent(marker)).toEqual({
      kind: "location",
      locale: "de",
    });
    const dataset = parseWhatsApp(
      `[3/14/26, 9:45 AM] Synthetic A: ${marker}`,
      "mdy-12h",
    );
    expect(dataset.messages[0].event).toEqual({
      kind: "location",
      locale: "de",
    });
    expect(dataset.messages[0].links).toEqual([]);
    expect(dataset.messages[0].emoji ?? []).toEqual([]);
    const analysis = analyzeWhatsApp(dataset);
    expect(analysis.totals.links).toBe(0);
    expect(analysis.totals.emoji ?? 0).toBe(0);
    const output = JSON.stringify({
      doctor: dataset.metadata.doctor,
      cards: buildWhatsAppStories(analysis, dataset),
    });
    expect(output).not.toMatch(/maps\.google\.com|Standort:|q=0|0,0/);
  });

  it.each([
    "Standort: 0, 0 - https://example.invalid/?q=0,0",
    "Standort: 0, 0 - http://maps.google.com/?q=0,0",
    "Standort: 0, 0 - https://maps.google.com.evil.invalid/?q=0,0",
    "Standort: 0, 0 - https://maps.google.com/?q=0,0&extra=1",
    "Standort: 0, 0 - https://maps.google.com/?q=999,0",
    "Standort: 999, 0 - https://maps.google.com/?q=999,0",
    "Standort: 0, 999 - https://maps.google.com/?q=0,999",
    "Standort: 0, 0 - https://maps.google.com/?q=0",
    "We discussed Standort: 0, 0 - https://maps.google.com/?q=0,0",
    "Standort: 0, 0 - https://maps.google.com/?q=0,0\nA fictional caption.",
  ])(
    "does not classify unsupported, mismatched or out-of-range location text: %s",
    (input) => {
      expect(classifyWhatsAppEvent(input)).toBeUndefined();
    },
  );
});
