import { afterEach, describe, expect, it, vi } from "vitest";
import {
  drawWhatsAppStory,
  WHATSAPP_STORY_HEIGHT,
  WHATSAPP_STORY_WIDTH,
} from "../../src/components/whatsapp/wrapped-canvas";
import {
  analyzeWhatsApp,
  createWhatsAppDemo,
  parseWhatsApp,
} from "../../src/lib/whatsapp";
import { buildWhatsAppStories } from "../../src/lib/whatsapp/stories";
import type {
  WhatsAppStory,
  WhatsAppStoryBase,
  WhatsAppStoryEntry,
} from "../../src/lib/whatsapp/story-types";

type TextDraw = {
  text: string;
  x: number;
  y: number;
  width: number;
  naturalWidth: number;
  size: number;
  align: CanvasTextAlign;
  fill: string;
  kerning: CanvasFontKerning;
};
type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

/** A font-aware recorder exercises wrapping and bounds without native graphics. */
function recordingCanvas() {
  const texts: TextDraw[] = [];
  const rectangles: Rectangle[] = [];
  const operations: unknown[][] = [];
  const state = {
    font: "10px Arial",
    fontKerning: "auto" as CanvasFontKerning,
    textAlign: "left" as CanvasTextAlign,
    textBaseline: "top",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
  };
  const stack: (typeof state)[] = [];
  function fontSize() {
    return Number(state.font.match(/([\d.]+)px/u)?.[1] ?? 10);
  }
  function measure(text: string) {
    let em = 0;
    for (const point of text) {
      em += /\p{M}|\u200d|\ufe0f/u.test(point)
        ? 0
        : /\s/u.test(point)
          ? 0.3
          : /[0-9]/u.test(point)
            ? 0.56
            : /[A-Z]/u.test(point)
              ? 0.67
              : /[\u0020-\u007e]/u.test(point)
                ? 0.52
                : 1;
    }
    return em * fontSize();
  }
  const ctx = {
    get fontKerning() {
      return state.fontKerning;
    },
    set fontKerning(next: CanvasFontKerning) {
      state.fontKerning = next;
    },
    get font() {
      return state.font;
    },
    set font(next: string) {
      state.font = next;
    },
    get textAlign() {
      return state.textAlign;
    },
    set textAlign(next: CanvasTextAlign) {
      state.textAlign = next;
    },
    get textBaseline() {
      return state.textBaseline;
    },
    set textBaseline(next: string) {
      state.textBaseline = next;
    },
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(next: string) {
      state.fillStyle = next;
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(next: string) {
      state.strokeStyle = next;
    },
    get lineWidth() {
      return state.lineWidth;
    },
    set lineWidth(next: number) {
      state.lineWidth = next;
    },
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(next: number) {
      state.globalAlpha = next;
    },
    measureText: (text: string) => ({ width: measure(text) }),
    fillText(text: string, x: number, y: number, maxWidth?: number) {
      const naturalWidth = measure(text);
      texts.push({
        text,
        x,
        y,
        naturalWidth,
        width: Math.min(naturalWidth, maxWidth ?? Infinity),
        size: fontSize(),
        align: state.textAlign,
        fill: state.fillStyle,
        kerning: state.fontKerning,
      });
    },
    fillRect(x: number, y: number, width: number, height: number) {
      rectangles.push({ x, y, width, height, fill: state.fillStyle });
    },
    save() {
      stack.push({ ...state });
    },
    restore() {
      Object.assign(state, stack.pop());
    },
    beginPath() {
      operations.push(["beginPath"]);
    },
    roundRect(...args: number[]) {
      operations.push(["roundRect", ...args]);
    },
    rect(...args: number[]) {
      operations.push(["rect", ...args]);
    },
    arc(...args: number[]) {
      operations.push(["arc", ...args]);
    },
    moveTo(...args: number[]) {
      operations.push(["moveTo", ...args]);
    },
    lineTo(...args: number[]) {
      operations.push(["lineTo", ...args]);
    },
    fill() {
      operations.push(["fill"]);
    },
    stroke() {
      operations.push(["stroke"]);
    },
  };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) };
  return {
    canvas: canvas as unknown as HTMLCanvasElement,
    texts,
    rectangles,
    operations,
    ctx,
  };
}

const entry = (
  label: string,
  count: number,
  share?: number,
): WhatsAppStoryEntry => ({
  label,
  value: count,
  display: String(count),
  ...(share === undefined ? {} : { share }),
});
const base: WhatsAppStoryBase = {
  id: "synthetic",
  name: "Synthetic card",
  label: "RECORDED COUNTS",
  title: "A recorded chapter.",
  lead: "Anonymous aggregate counts from a fictional export.",
  value: "12,345",
  valueLabel: "recorded messages",
  facts: [
    { value: "2", label: "participant labels" },
    { value: "4", label: "active dates" },
  ],
  note: "Generated locally from the supplied export.",
  theme: "forest",
  motif: "rings",
  mode: "pair",
  calculation: {
    classification: "Exact",
    definition: "PRIVATE_METHODOLOGY_SENTINEL",
    threshold: null,
    limitations: "Methodology stays outside artwork.",
  },
};

function allKinds(): WhatsAppStory[] {
  const entries = [
    entry("Participant 1", 8, 2 / 3),
    entry("Participant 2", 4, 1 / 3),
  ];
  return [
    {
      ...base,
      kind: "hero",
      data: {
        activeDates: 4,
        calendarSpanDays: 9,
        firstDate: "1 Sep 2025",
        lastDate: "9 Sep 2025",
      },
    },
    {
      ...base,
      kind: "split",
      data: {
        entries,
        total: 12,
        hiddenParticipants: 0,
        leaderTieCount: 1,
        unit: "messages",
      },
    },
    {
      ...base,
      kind: "ranking",
      mode: "group",
      data: {
        entries: [
          ...entries,
          entry("Participant 3", 3, 0.2),
          entry("Participant 4", 1, 0.05),
        ],
        total: 16,
        hiddenParticipants: 12,
        leaderTieCount: 1,
        unit: "messages",
      },
    },
    {
      ...base,
      kind: "distribution",
      data: {
        entries: Array.from({ length: 24 }, (_, hour) =>
          entry(`${hour}:00`, hour, hour / 276),
        ),
        total: 276,
        tiedMaximum: 1,
      },
    },
    {
      ...base,
      kind: "timeline",
      data: {
        from: "1 Sep 2025",
        to: "4 Sep 2025",
        streakDays: 4,
        dates: [1, 2, 3, 4].map((day) => ({
          date: `${day} Sep 2025`,
          value: day * 2,
        })),
        tiedDates: 4,
      },
    },
    {
      ...base,
      kind: "rhythm",
      data: {
        buckets: [
          "Under 1 min",
          "1–5 min",
          "5–30 min",
          "30 min–6 hr",
          "6+ hr",
        ].map((label, index) => entry(label, index + 1, (index + 1) / 15)),
        entries: [
          ...entries,
          entry("Participant 3", 3),
          entry("Participant 4", 2),
        ],
        transitionCount: 15,
        hiddenParticipants: 0,
        rapidCount: 3,
        rapidShare: 0.2,
      },
    },
    {
      ...base,
      kind: "patterns",
      data: {
        maximum: 8,
        ties: 2,
        runs: 15,
        medianRunLength: 2,
        longestRun: 9,
        distribution: ["1", "2", "3–5", "6–10", "11+"].map((label, index) =>
          entry(label, index + 1, (index + 1) / 15),
        ),
      },
    },
    {
      ...base,
      kind: "media",
      data: {
        categories: [
          { kind: "image", label: "Images", count: 5 },
          { kind: "video", label: "Videos", count: 4 },
          { kind: "audio", label: "Audio", count: 3 },
          { kind: "sticker", label: "Stickers", count: 2 },
        ],
        hiddenCategories: 3,
        remainingMedia: 5,
        emoji: [
          { symbol: "🙂", count: 4 },
          { symbol: "👨‍👩‍👧‍👦", count: 3 },
          { symbol: "🎉", count: 2 },
        ],
        emojiAvailable: true,
        mediaTotal: 19,
        emojiTotal: 9,
      },
    },
    {
      ...base,
      kind: "word",
      data: {
        words: [
          "synthetic",
          "fictional",
          "example",
          "riverside",
          "notebook",
          "sunflower",
        ].map((word, index) => ({ word, count: index + 3 })),
        eligibleWords: 33,
      },
    },
    {
      ...base,
      kind: "closing",
      data: { messages: 12345, participants: 2, activeDates: 4, cardCount: 12 },
    },
  ];
}

function assertReadableBounds(rendered: ReturnType<typeof recordingCanvas>) {
  for (const draw of rendered.texts) {
    const left = draw.x - (draw.align === "center" ? draw.width / 2 : 0);
    expect(left, draw.text).toBeGreaterThanOrEqual(76);
    expect(left + draw.width, draw.text).toBeLessThanOrEqual(1004.01);
    expect(draw.y, draw.text).toBeGreaterThanOrEqual(80);
    expect(draw.y + draw.size * 1.2, draw.text).toBeLessThanOrEqual(1856.01);
    expect(Number.isFinite(draw.size), draw.text).toBe(true);
  }
  for (const rect of rendered.rectangles) {
    expect(
      [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite),
    ).toBe(true);
    expect(rect.width).toBeGreaterThanOrEqual(0);
    expect(rect.height).toBeGreaterThanOrEqual(0);
  }
}

afterEach(() => vi.restoreAllMocks());

describe("WhatsApp Wrapped shared preview and PNG canvas", () => {
  it.each([3, 8, 24])(
    "renders %i-label group rankings and timing remainders with complete anonymous text",
    (participants) => {
      let clock = Date.UTC(2026, 0, 1, 9);
      const lines = Array.from({ length: participants * 6 }, (_, index) => {
        if (index) clock += index % participants === 0 ? 21600000 : 60000;
        const timestamp = new Date(clock)
          .toISOString()
          .slice(0, 19)
          .replace("T", ", ");
        return `${timestamp} - PRIVATE_GROUP_LABEL_${index % participants}: PRIVATE_CONTENT`;
      });
      const dataset = parseWhatsApp(lines.join("\n"), "ymd-24h");
      const stories = buildWhatsAppStories(analyzeWhatsApp(dataset), dataset);
      for (const story of stories) {
        const rendered = recordingCanvas();
        drawWhatsAppStory(rendered.canvas, story, false);
        assertReadableBounds(rendered);
        expect(rendered.canvas.width).toBe(1080);
        expect(rendered.canvas.height).toBe(1920);
        const text = rendered.texts.map((draw) => draw.text).join(" ");
        expect(text).not.toMatch(/PRIVATE_GROUP_LABEL|PRIVATE_CONTENT|winner/i);
        if (story.kind === "ranking" && participants > 4) {
          expect(text).toContain(
            `Top 4 shown; ${participants - 4} additional labels not displayed.`,
          );
          expect(text).toContain(
            `${story.data.total} ${story.data.unit} in total.`,
          );
        }
        if (story.kind === "rhythm" && participants > 4) {
          expect(text).toContain(story.note);
          expect(text).toContain(
            `4 of ${participants} qualifying labels shown; ${participants - 4} not displayed.`,
          );
        }
      }
    },
  );

  it.each(allKinds().map((story) => [story.kind, story] as const))(
    "renders %s at 1080 × 1920 within the safe text area",
    (_kind, story) => {
      const rendered = recordingCanvas();
      expect(drawWhatsAppStory(rendered.canvas, story, false)).toBe(
        rendered.ctx,
      );
      expect(rendered.canvas.width).toBe(WHATSAPP_STORY_WIDTH);
      expect(rendered.canvas.height).toBe(WHATSAPP_STORY_HEIGHT);
      expect([rendered.canvas.width, rendered.canvas.height]).toEqual([
        1080, 1920,
      ]);
      expect(rendered.rectangles[0]).toMatchObject({
        x: 0,
        y: 0,
        width: 1080,
        height: 1920,
      });
      expect(
        rendered.texts.some((draw) => draw.text === "Made with WhatsAppScope"),
      ).toBe(true);
      expect(rendered.texts.map((draw) => draw.text).join(" ")).not.toContain(
        "PRIVATE_METHODOLOGY_SENTINEL",
      );
      assertReadableBounds(rendered);
    },
  );

  it("renders the same deterministic artwork on repeated preview/export draws", () => {
    for (const story of allKinds()) {
      const first = recordingCanvas();
      const second = recordingCanvas();
      drawWhatsAppStory(first.canvas, story, true);
      drawWhatsAppStory(second.canvas, story, true);
      expect(second.texts).toEqual(first.texts);
      expect(second.rectangles).toEqual(first.rectangles);
      expect(second.operations).toEqual(first.operations);
      expect(first.texts.every((draw) => draw.kerning === "none")).toBe(true);
      expect(
        first.texts.some((draw) => draw.text === "FICTIONAL DEMO DATA"),
      ).toBe(true);
    }
  });

  it("retains every hourly bucket, zero, count, and supplied share", () => {
    const story = allKinds().find((item) => item.kind === "distribution")!;
    const rendered = recordingCanvas();
    drawWhatsAppStory(rendered.canvas, story, false);
    if (story.kind !== "distribution")
      throw new Error("Expected distribution fixture");
    for (const item of story.data.entries) {
      expect(rendered.texts.some((draw) => draw.text === item.label)).toBe(
        true,
      );
      expect(rendered.texts.some((draw) => draw.text === item.display)).toBe(
        true,
      );
      expect(
        rendered.texts.some(
          (draw) => draw.text === `${(item.share! * 100).toFixed(1)}%`,
        ),
      ).toBe(true);
    }
  });

  it("renders session medians and maxima without treating session totals as a denominator", () => {
    const story: WhatsAppStory = {
      ...base,
      kind: "distribution",
      value: "7",
      valueLabel: "recorded sessions",
      data: {
        entries: [
          { label: "Median session", value: 12.5, display: "12.5 messages" },
          { label: "Longest session", value: 125, display: "125 messages" },
        ],
        total: 7,
        tiedMaximum: 2,
      },
    };
    const rendered = recordingCanvas();
    drawWhatsAppStory(rendered.canvas, story, false);
    const text = rendered.texts.map((draw) => draw.text).join(" ");
    expect(text).toContain("12.5 messages");
    expect(text).toContain("125 messages");
    expect(text).not.toContain("%");
    assertReadableBounds(rendered);
  });

  it("keeps long complete numbers, aliases, far-future dates and six Unicode words within bounds", () => {
    const large = "9,007,199,254,740,991";
    for (const fixture of allKinds()) {
      const story = structuredClone(fixture);
      story.value = large;
      story.facts = [
        { value: large, label: "accepted messages" },
        { value: "9999", label: "active dates" },
      ];
      if (story.kind === "split" || story.kind === "ranking")
        story.data.entries.forEach((item) => {
          item.label = "Participant 10000";
          item.value = Number.MAX_SAFE_INTEGER;
          item.display = large;
        });
      if (story.kind === "hero") {
        story.data.firstDate = "31 December 9999";
        story.data.lastDate = "31 December 9999";
      }
      if (story.kind === "timeline") {
        story.data.from = "31 December 9999";
        story.data.to = "31 December 9999";
        story.data.dates.forEach((item) => {
          item.date = "31 December 9999";
          item.value = Number.MAX_SAFE_INTEGER;
        });
      }
      if (story.kind === "word")
        story.data.words = ["界", "𐐀", "ş", "é", "Ж", "λ"].map((point) => ({
          word: point.repeat(40),
          count: Number.MAX_SAFE_INTEGER,
        }));
      const rendered = recordingCanvas();
      drawWhatsAppStory(rendered.canvas, story, false);
      assertReadableBounds(rendered);
      const body = rendered.texts.map((draw) => draw.text).join("");
      expect(body).toContain(large);
      if (story.kind === "word") {
        for (const item of story.data.words) expect(body).toContain(item.word);
        expect(body).not.toContain("…");
      }
      for (const draw of rendered.texts.filter((item) => item.text === large))
        expect(draw.naturalWidth).toBeLessThanOrEqual(928);
    }
  });

  it("keeps private source names, content, links and unselected words out of canvas operations", () => {
    const dataset = createWhatsAppDemo();
    dataset.participants[0].displayName = "PRIVATE_CANVAS_NAME";
    dataset.messages[0].content =
      "PRIVATE_CANVAS_CONTENT PRIVATE_LEXICAL_SENTINEL https://private.example/source";
    dataset.messages[0].links = ["https://private.example/source"];
    const calls: unknown[] = [];
    for (const story of buildWhatsAppStories(
      analyzeWhatsApp(dataset),
      dataset,
    )) {
      const rendered = recordingCanvas();
      drawWhatsAppStory(rendered.canvas, story, false);
      calls.push(rendered.texts, rendered.rectangles, rendered.operations);
    }
    const serialized = JSON.stringify(calls);
    for (const privateValue of [
      "PRIVATE_CANVAS_NAME",
      "PRIVATE_CANVAS_CONTENT",
      "PRIVATE_LEXICAL_SENTINEL",
      "private.example",
      "https://",
    ])
      expect(serialized).not.toContain(privateValue);
    expect(serialized).toContain("Participant 1");
  });

  it("renders emoji unavailability explicitly without inventing zero occurrences", () => {
    const story = allKinds().find((item) => item.kind === "media")!;
    if (story.kind !== "media") throw new Error("Expected media fixture");
    story.data.emoji = [];
    story.data.emojiAvailable = false;
    story.data.emojiTotal = null;
    const rendered = recordingCanvas();
    drawWhatsAppStory(rendered.canvas, story, false);
    expect(
      rendered.texts.some(
        (draw) => draw.text === "Supported emoji counts unavailable",
      ),
    ).toBe(true);
  });

  it("imports and renders safely when Intl.Segmenter is unavailable", async () => {
    vi.resetModules();
    const descriptor = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
    Object.defineProperty(Intl, "Segmenter", {
      configurable: true,
      value: undefined,
    });
    try {
      const fallback =
        await import("../../src/components/whatsapp/wrapped-canvas");
      const story = allKinds().find((item) => item.kind === "word")!;
      if (story.kind !== "word") throw new Error("Expected word fixture");
      story.data.words = [{ word: "𐐀".repeat(40), count: 8 }];
      const rendered = recordingCanvas();
      fallback.drawWhatsAppStory(rendered.canvas, story, false);
      assertReadableBounds(rendered);
      expect(rendered.texts.map((draw) => draw.text).join("")).toContain(
        "𐐀".repeat(40),
      );
      expect(
        rendered.texts.some((draw) => /[\uD800-\uDBFF]$/u.test(draw.text)),
      ).toBe(false);
    } finally {
      if (descriptor) Object.defineProperty(Intl, "Segmenter", descriptor);
      vi.resetModules();
    }
  });

  it("reports a missing canvas context so the UI can keep its textual fallback", () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(() => drawWhatsAppStory(canvas, allKinds()[0], false)).toThrow(
      "Image export is unavailable in this browser.",
    );
  });
});
