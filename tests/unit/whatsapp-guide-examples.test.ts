import { expect, test } from "vitest";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";
import { analyzeWhatsApp } from "../../src/lib/whatsapp/analysis";
import {
  analyzeFilteredWhatsApp,
  DEFAULT_WHATSAPP_FILTERS,
} from "../../src/lib/whatsapp/filters";
import { analyzeWhatsAppText } from "../../src/lib/whatsapp/text-analysis";
import { createWhatsAppDemo } from "../../src/lib/whatsapp/demo";
test("public demo and group example totals match current analysis", () => {
  const a = analyzeWhatsApp(createWhatsAppDemo());
  expect(a.totals).toMatchObject({
    messages: 24,
    activeDays: 8,
    participants: 3,
    mediaMessages: 4,
  });
  expect(a.participants.map((p) => p.messageCount)).toEqual([8, 8, 8]);
});
test("published heatmap example uses the source weekday/hour buckets", () => {
  const d = parseWhatsApp(
    [
      "02/02/2026, 09:10 - Example A: one",
      "02/02/2026, 09:45 - Example B: two",
      "03/02/2026, 18:05 - Example A: three",
    ].join("\n"),
    "dmy-24h",
  );
  const a = analyzeFilteredWhatsApp(d, DEFAULT_WHATSAPP_FILTERS);
  expect(a.ok).toBe(true);
  if (a.ok) {
    expect(a.heatmap[0][9]).toBe(2);
    expect(a.heatmap[1][18]).toBe(1);
    expect(a.heatmap.flat().reduce((n, c) => n + c, 0)).toBe(3);
  }
});
test("published media example separates messages and occurrences", () => {
  const d = parseWhatsApp(
    [
      "image omitted",
      "video omitted",
      "https://example.org/a https://example.org/b",
      "A fictional plain-text note",
    ]
      .map((text, i) => `02/02/2026, 09:0${i} - Example A: ${text}`)
      .join("\n"),
    "dmy-24h",
  );
  expect(analyzeWhatsApp(d).totals).toMatchObject({
    messages: 4,
    mediaMessages: 2,
    links: 2,
    messagesWithLinks: 1,
  });
});
test("published words and emoji example matches actual tokenization", () => {
  const d = parseWhatsApp(
    [
      "02/02/2026, 09:00 - Example A: Lantern lantern trail 😊",
      "02/02/2026, 09:01 - Example B: Trail lantern 😊😊",
    ].join("\n"),
    "dmy-24h",
  );
  expect(analyzeWhatsAppText(d.messages, d.participants).words).toEqual([
    { word: "lantern", count: 3 },
    { word: "trail", count: 2 },
  ]);
  expect(analyzeWhatsApp(d).totals).toMatchObject({
    emoji: 3,
    messagesWithEmoji: 2,
  });
});
