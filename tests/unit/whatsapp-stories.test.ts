import { describe, expect, it } from "vitest";
import {
  analyzeWhatsApp,
  createWhatsAppDemo,
  parseWhatsApp,
} from "../../src/lib/whatsapp";
import {
  buildWhatsAppStories,
  whatsappPeaks,
} from "../../src/lib/whatsapp/stories";

describe("WhatsApp Wrapped privacy and evidence", () => {
  it("never puts participant labels, messages or URLs into share models", () => {
    const dataset = createWhatsAppDemo();
    dataset.participants[0].displayName = "PRIVATE_SENDER_LABEL";
    dataset.messages[0].content = "PRIVATE_MESSAGE_CONTENT";
    dataset.messages[0].links = ["https://private.example/secret-path"];
    const cards = buildWhatsAppStories(analyzeWhatsApp(dataset), dataset);
    const serialized = JSON.stringify(cards);
    expect(cards.length).toBeGreaterThanOrEqual(6);
    expect(serialized).not.toContain("PRIVATE_SENDER_LABEL");
    expect(serialized).not.toContain("PRIVATE_MESSAGE_CONTENT");
    expect(serialized).not.toContain("private.example");
    expect(serialized).not.toContain("secret-path");
  });

  it("describes all tied participant maxima without declaring one winner", () => {
    const dataset = createWhatsAppDemo();
    const card = buildWhatsAppStories(analyzeWhatsApp(dataset), dataset).find(
      (item) => item.id === "participant-counts",
    );
    expect(card?.lead).toBe(
      "3 participants tie for the highest exported message count.",
    );
    expect(card?.value).toBe("8");
    expect(
      card?.facts.find((item) => item.label === "participants at the maximum")
        ?.value,
    ).toBe("3");
  });

  it("uses every tied daily and hourly maximum", () => {
    const dataset = parseWhatsApp(
      [
        "02/01/2025, 09:00 - One: first",
        "02/01/2025, 10:00 - Two: second",
        "03/01/2025, 09:00 - One: third",
        "03/01/2025, 10:00 - Two: fourth",
      ].join("\n"),
      "dmy-24h",
    );
    const cards = buildWhatsAppStories(analyzeWhatsApp(dataset), dataset);
    expect(cards.find((item) => item.id === "busiest-day")?.lead).toBe(
      "2 recorded days tie for the highest message count.",
    );
    expect(cards.find((item) => item.id === "busiest-hour")?.lead).toBe(
      "2 hourly buckets share the highest recorded message count.",
    );
  });

  it("shares only the first recorded date, never its message or clock time", () => {
    const dataset = parseWhatsApp(
      "13/03/2025, 09:17:42 - Sender: PRIVATE_FIRST_MESSAGE",
      "dmy-24h",
    );
    const card = buildWhatsAppStories(analyzeWhatsApp(dataset), dataset).find(
      (item) => item.id === "first-date",
    );
    expect(card?.value).toBe("13 Mar 2025");
    expect(JSON.stringify(card)).not.toContain("PRIVATE_FIRST_MESSAGE");
    expect(JSON.stringify(card)).not.toContain("09:17");
    expect(card?.note).toContain("partial chat");
  });

  it("preserves anonymous aliases in original export order", () => {
    const dataset = parseWhatsApp(
      [
        "02/01/2025, 09:00 - Alphabetically last: a",
        "02/01/2025, 10:00 - Alphabetically first: b",
        "02/01/2025, 10:01 - Alphabetically first: c",
      ].join("\n"),
      "dmy-24h",
    );
    const card = buildWhatsAppStories(analyzeWhatsApp(dataset), dataset).find(
      (item) => item.id === "participant-counts",
    );
    expect(card?.lead).toBe(
      "Participant 2 has the highest exported message count.",
    );
    expect(JSON.stringify(card)).not.toContain("Alphabetically");
  });

  it("handles unavailable emoji counts without presenting zero", () => {
    const dataset = createWhatsAppDemo();
    const analysis = analyzeWhatsApp(dataset);
    analysis.totals.emoji = null;
    const card = buildWhatsAppStories(analysis, dataset).find(
      (item) => item.id === "message-extras",
    );
    expect(
      card?.facts.find((item) => item.label === "supported emoji occurrences")
        ?.value,
    ).toBe("Unavailable");
  });

  it("produces no cards for an empty normalized dataset", () => {
    const dataset = { ...createWhatsAppDemo(), messages: [] };
    expect(buildWhatsAppStories(analyzeWhatsApp(dataset), dataset)).toEqual([]);
  });

  it("finds tied maxima in large collections without argument spreading", () => {
    const buckets = Array.from({ length: 180000 }, (_, index) => ({
      key: String(index),
      label: String(index),
      count: index === 0 || index === 179999 ? 2 : 1,
    }));
    expect(whatsappPeaks(buckets).map((bucket) => bucket.key)).toEqual([
      "0",
      "179999",
    ]);
    expect(whatsappPeaks([{ key: "zero", label: "Zero", count: 0 }])).toEqual(
      [],
    );
  });
});
