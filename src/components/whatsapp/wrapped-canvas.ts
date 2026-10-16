import type {
  WhatsAppStory,
  WhatsAppStoryEntry,
} from "@/lib/whatsapp/story-types";
import { storyStyles } from "../wrapped-style";

export const WHATSAPP_STORY_WIDTH = 1080;
export const WHATSAPP_STORY_HEIGHT = 1920;
export const whatsappStoryThemes = {
  forest: storyStyles["stable-core"],
  mint: storyStyles["still-here"],
  cream: storyStyles.origins,
  lime: storyStyles.turnover,
} as const;

type Theme = (typeof whatsappStoryThemes)[WhatsAppStory["theme"]];
type Box = { x: number; y: number; width: number; height: number };
const graphemeSegmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;
const numberFormat = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

function graphemes(text: string): string[] {
  return graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment)
    : Array.from(text);
}

function font(ctx: CanvasRenderingContext2D, size: number, bold = false) {
  ctx.font = `${bold ? "bold " : ""}${size}px Arial, sans-serif`;
  // Auto kerning can differ between an attached preview and a detached export
  // canvas. Explicit spacing keeps measured wrapping and PNG artwork identical.
  ctx.fontKerning = "none";
}

/** Break long tokens at grapheme boundaries, preserving emoji sequences. */
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const rows: string[] = [];
  let row = "";
  for (const word of text.trim().split(/\s+/u)) {
    if (!word) continue;
    const candidate = row ? `${row} ${word}` : word;
    if (ctx.measureText(candidate).width <= width) {
      row = candidate;
      continue;
    }
    if (row) rows.push(row);
    row = "";
    for (const segment of graphemes(word)) {
      const part = row + segment;
      if (row && ctx.measureText(part).width > width) {
        rows.push(row);
        row = segment;
      } else row = part;
    }
  }
  if (row) rows.push(row);
  return rows;
}

/** Shrink within a fixed box before using an explicit overflow ellipsis. */
function paragraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: Box,
  maximum = 34,
  minimum = 24,
  bold = false,
  align: CanvasTextAlign = "left",
) {
  let size = maximum;
  let rows: string[];
  let lineHeight: number;
  do {
    font(ctx, size, bold);
    rows = lines(ctx, text, box.width);
    lineHeight = Math.ceil(size * 1.2);
    if (rows.length * lineHeight <= box.height || size <= minimum) break;
    size -= 1;
  } while (true);
  const capacity = Math.max(1, Math.floor(box.height / lineHeight));
  if (rows.length > capacity) {
    rows = rows.slice(0, capacity);
    const parts = graphemes(rows[capacity - 1]);
    while (
      parts.length &&
      ctx.measureText(`${parts.join("")}…`).width > box.width
    )
      parts.pop();
    rows[capacity - 1] = `${parts.join("")}…`;
  }
  ctx.textAlign = align;
  const x = align === "center" ? box.x + box.width / 2 : box.x;
  // A single emoji grapheme can be wider than a narrow box even at the minimum
  // font size. The native canvas width bound keeps that cluster inside its box.
  rows.forEach((row, index) =>
    ctx.fillText(row, x, box.y + index * lineHeight, box.width),
  );
  ctx.textAlign = "left";
}

/** Numeric values remain complete: reduce the font rather than truncate. */
function value(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: Box,
  maximum = 130,
  align: CanvasTextAlign = "left",
) {
  let size = Math.min(maximum, Math.floor(box.height / 1.2));
  font(ctx, size, true);
  while (ctx.measureText(text).width > box.width && size > 1) {
    size -= 1;
    font(ctx, size, true);
  }
  ctx.textAlign = align;
  ctx.fillText(text, align === "center" ? box.x + box.width / 2 : box.x, box.y);
  ctx.textAlign = "left";
}

function panel(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  box: Box,
  radius = 28,
) {
  ctx.save();
  ctx.fillStyle = theme.ink;
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, radius);
  ctx.fill();
  ctx.restore();
}

function rule(ctx: CanvasRenderingContext2D, theme: Theme, y: number) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = theme.ink;
  ctx.fillRect(80, y, 920, 2);
  ctx.restore();
}

function headline(
  ctx: CanvasRenderingContext2D,
  story: WhatsAppStory,
  theme: Theme,
) {
  ctx.fillStyle = theme.accent;
  value(ctx, story.value, { x: 80, y: 710, width: 920, height: 145 });
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    story.valueLabel,
    { x: 80, y: 865, width: 920, height: 82 },
    34,
  );
}

function percent(share: number) {
  return `${(share * 100).toFixed(1)}%`;
}

function smallEntry(
  ctx: CanvasRenderingContext2D,
  entry: WhatsAppStoryEntry,
  theme: Theme,
  box: Box,
) {
  panel(ctx, theme, box, 18);
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    entry.label,
    { x: box.x + 20, y: box.y + 14, width: box.width - 40, height: 36 },
    28,
    22,
  );
  ctx.fillStyle = theme.accent;
  value(
    ctx,
    entry.display,
    { x: box.x + 20, y: box.y + 55, width: box.width - 40, height: 52 },
    40,
  );
}

/** Chart scaling is presentation only; values are projected by the story model. */
function bars(
  ctx: CanvasRenderingContext2D,
  entries: WhatsAppStoryEntry[],
  theme: Theme,
  box: Box,
  showValues: boolean,
) {
  const maximum = entries.reduce(
    (largest, entry) => Math.max(largest, entry.value),
    0,
  );
  const slot = box.width / Math.max(1, entries.length);
  const barWidth = Math.max(1, slot - (entries.length > 8 ? 9 : 22));
  const plotHeight = Math.max(0, box.height - (showValues ? 145 : 65));
  entries.forEach((entry, index) => {
    const x = box.x + index * slot;
    const height = maximum > 0 ? (plotHeight * entry.value) / maximum : 0;
    ctx.save();
    ctx.fillStyle = theme.ink;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(x, box.y, barWidth, plotHeight);
    ctx.restore();
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x, box.y + plotHeight - height, barWidth, height);
    if (showValues) {
      value(
        ctx,
        entry.display,
        { x, y: box.y + plotHeight + 12, width: barWidth, height: 37 },
        30,
      );
      if (entry.share !== undefined) {
        ctx.fillStyle = theme.ink;
        value(
          ctx,
          percent(entry.share),
          { x, y: box.y + plotHeight + 53, width: barWidth, height: 27 },
          21,
        );
      }
    }
    if (entries.length <= 8 || index % 4 === 0) {
      ctx.fillStyle = theme.ink;
      paragraph(
        ctx,
        entry.label,
        {
          x,
          y: box.y + plotHeight + (showValues ? 87 : 17),
          width: entries.length > 8 ? slot * 3.5 : barWidth,
          height: showValues ? 55 : 48,
        },
        entries.length > 8 ? 25 : 27,
        18,
      );
    }
  });
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "hero" }>,
  theme: Theme,
) {
  ctx.fillStyle = theme.accent;
  value(ctx, story.value, { x: 76, y: 730, width: 928, height: 255 }, 214);
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    story.valueLabel,
    { x: 80, y: 994, width: 920, height: 100 },
    40,
  );
  rule(ctx, theme, 1150);
  for (const [index, [label, date]] of [
    ["FIRST RECORDED DATE", story.data.firstDate],
    ["LAST RECORDED DATE", story.data.lastDate],
  ].entries()) {
    const x = 80 + index * 485;
    paragraph(ctx, label, { x, y: 1220, width: 435, height: 70 }, 26, 22, true);
    ctx.fillStyle = theme.accent;
    value(ctx, date, { x, y: 1310, width: 435, height: 82 }, 46);
    ctx.fillStyle = theme.ink;
  }
}

function drawSplit(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "split" | "ranking" }>,
  theme: Theme,
) {
  const maximum = story.data.entries.reduce(
    (largest, entry) => Math.max(largest, entry.value),
    0,
  );
  story.data.entries.forEach((entry, index) => {
    const x = 80 + index * 485;
    panel(ctx, theme, { x, y: 735, width: 435, height: 548 });
    ctx.fillStyle = theme.ink;
    paragraph(
      ctx,
      entry.label,
      { x: x + 30, y: 775, width: 375, height: 125 },
      49,
      30,
      true,
    );
    ctx.fillStyle = theme.accent;
    value(
      ctx,
      entry.display,
      { x: x + 30, y: 953, width: 375, height: 125 },
      100,
    );
    if (entry.share !== undefined)
      value(
        ctx,
        percent(entry.share),
        { x: x + 30, y: 1102, width: 375, height: 87 },
        68,
      );
    ctx.fillRect(x + 30, 1230, maximum ? (375 * entry.value) / maximum : 0, 16);
  });
  ctx.fillStyle = theme.accent;
  value(ctx, story.value, { x: 80, y: 1325, width: 920, height: 83 }, 68);
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    story.valueLabel,
    { x: 80, y: 1410, width: 920, height: 70 },
    29,
  );
}

function drawRanking(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "split" | "ranking" }>,
  theme: Theme,
) {
  headline(ctx, story, theme);
  const maximum = story.data.entries.reduce(
    (largest, entry) => Math.max(largest, entry.value),
    0,
  );
  story.data.entries.forEach((entry, index) => {
    const y = 980 + index * 104;
    ctx.fillStyle = theme.ink;
    paragraph(
      ctx,
      entry.label,
      { x: 80, y, width: 485, height: 54 },
      37,
      24,
      true,
    );
    ctx.fillStyle = theme.accent;
    value(ctx, entry.display, { x: 580, y, width: 260, height: 54 }, 43);
    if (entry.share !== undefined) {
      ctx.fillStyle = theme.ink;
      value(
        ctx,
        percent(entry.share),
        { x: 850, y: y + 8, width: 150, height: 42 },
        29,
      );
    }
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = theme.ink;
    ctx.fillRect(80, y + 68, 920, 9);
    ctx.restore();
    ctx.fillStyle = theme.accent;
    ctx.fillRect(80, y + 68, maximum ? (920 * entry.value) / maximum : 0, 9);
  });
  if (story.data.hiddenParticipants) {
    ctx.fillStyle = theme.ink;
    paragraph(
      ctx,
      `Top ${numberFormat.format(story.data.entries.length)} shown; ${numberFormat.format(story.data.hiddenParticipants)} additional labels not displayed.`,
      { x: 80, y: 1415, width: 920, height: 40 },
      27,
      24,
    );
    paragraph(
      ctx,
      `${numberFormat.format(story.data.total)} ${story.data.unit} in total.`,
      { x: 80, y: 1457, width: 920, height: 31 },
      24,
    );
  }
}

function drawDistribution(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "distribution" }>,
  theme: Theme,
) {
  headline(ctx, story, theme);
  if (story.data.entries.length > 8) {
    const maximum = story.data.entries.reduce(
      (largest, entry) => Math.max(largest, entry.value),
      0,
    );
    // All 24 clock-hour buckets remain individually readable, including zeros.
    // The model supplies shares; session summaries never infer them from total.
    story.data.entries.forEach((entry, index) => {
      const x = 80 + (index % 6) * 156;
      const y = 974 + Math.floor(index / 6) * 125;
      panel(ctx, theme, { x, y, width: 140, height: 113 }, 14);
      ctx.fillStyle = theme.ink;
      paragraph(
        ctx,
        entry.label,
        { x: x + 12, y: y + 9, width: 116, height: 27 },
        22,
        18,
        true,
      );
      ctx.fillStyle = theme.accent;
      value(
        ctx,
        entry.display,
        { x: x + 12, y: y + 39, width: 116, height: 34 },
        28,
      );
      if (entry.share !== undefined) {
        ctx.fillStyle = theme.ink;
        value(
          ctx,
          percent(entry.share),
          { x: x + 12, y: y + 77, width: 116, height: 25 },
          19,
        );
      }
      ctx.fillStyle = theme.accent;
      ctx.fillRect(
        x + 12,
        y + 105,
        maximum ? (116 * entry.value) / maximum : 0,
        3,
      );
    });
  } else {
    const slot = 920 / Math.max(1, story.data.entries.length);
    const maximum = story.data.entries.reduce(
      (largest, entry) => Math.max(largest, entry.value),
      0,
    );
    story.data.entries.forEach((entry, index) => {
      const x = 80 + index * slot;
      panel(ctx, theme, { x, y: 994, width: slot - 24, height: 431 });
      ctx.fillStyle = theme.ink;
      paragraph(
        ctx,
        entry.label,
        { x: x + 24, y: 1022, width: slot - 72, height: 85 },
        32,
        24,
        true,
      );
      ctx.fillStyle = theme.accent;
      const barHeight = maximum ? (150 * entry.value) / maximum : 0;
      ctx.fillRect(x + 24, 1270 - barHeight, slot - 72, barHeight);
      value(
        ctx,
        entry.display,
        { x: x + 24, y: 1300, width: slot - 72, height: 65 },
        52,
      );
      if (entry.share !== undefined) {
        ctx.fillStyle = theme.ink;
        value(
          ctx,
          percent(entry.share),
          { x: x + 24, y: 1373, width: slot - 72, height: 37 },
          28,
        );
      }
    });
  }
}

function drawTimeline(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "timeline" }>,
  theme: Theme,
) {
  headline(ctx, story, theme);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(106, 1047);
  ctx.lineTo(974, 1047);
  ctx.stroke();
  for (const x of [106, 974]) {
    ctx.beginPath();
    ctx.arc(x, 1047, 18, 0, Math.PI * 2);
    ctx.fillStyle = theme.accent;
    ctx.fill();
  }
  for (const [index, [label, date]] of [
    ["FROM", story.data.from],
    ["THROUGH", story.data.to],
  ].entries()) {
    const x = 80 + index * 485;
    ctx.fillStyle = theme.ink;
    paragraph(ctx, label, { x, y: 1100, width: 435, height: 38 }, 27, 22, true);
    value(ctx, date, { x, y: 1156, width: 435, height: 65 }, 39);
  }
  story.data.dates.forEach((entry, index) => {
    const x = 80 + (index % 2) * 485;
    const y = 1252 + Math.floor(index / 2) * 96;
    panel(ctx, theme, { x, y, width: 435, height: 80 }, 16);
    ctx.fillStyle = theme.ink;
    paragraph(
      ctx,
      entry.date,
      { x: x + 16, y: y + 12, width: 255, height: 58 },
      25,
      20,
    );
    ctx.fillStyle = theme.accent;
    value(
      ctx,
      numberFormat.format(entry.value),
      { x: x + 282, y: y + 20, width: 137, height: 45 },
      32,
    );
  });
}

function drawRhythm(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "rhythm" }>,
  theme: Theme,
) {
  headline(ctx, story, theme);
  bars(
    ctx,
    story.data.buckets,
    theme,
    { x: 80, y: 980, width: 920, height: 270 },
    true,
  );
  story.data.entries.forEach((entry, index) => {
    smallEntry(ctx, entry, theme, {
      x: 80 + (index % 2) * 485,
      y: 1248 + Math.floor(index / 2) * 119,
      width: 435,
      height: 112,
    });
  });
}

function drawPatterns(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "patterns" }>,
  theme: Theme,
) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(370, 973, 230, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = theme.accent;
  value(
    ctx,
    story.value,
    { x: 150, y: 858, width: 440, height: 175 },
    145,
    "center",
  );
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    story.valueLabel,
    { x: 185, y: 1038, width: 370, height: 130 },
    31,
    24,
    false,
    "center",
  );
  const summaries = [
    { label: "Recorded runs", count: story.data.runs },
    { label: "Median run length", count: story.data.medianRunLength },
    { label: "Longest run", count: story.data.longestRun },
  ];
  summaries.forEach((entry, index) => {
    smallEntry(
      ctx,
      {
        label: entry.label,
        value: entry.count ?? 0,
        display:
          entry.count === null
            ? "Unavailable"
            : numberFormat.format(entry.count),
      },
      theme,
      { x: 680, y: 781 + index * 153, width: 320, height: 130 },
    );
  });
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    `${numberFormat.format(story.data.maximum)} messages at the 10-minute maximum; ${numberFormat.format(story.data.ties)} tied windows.`,
    { x: 80, y: 1228, width: 920, height: 72 },
    27,
    22,
  );
  const slot = 920 / Math.max(1, story.data.distribution.length);
  const maximum = story.data.distribution.reduce(
    (largest, entry) => Math.max(largest, entry.value),
    0,
  );
  story.data.distribution.forEach((entry, index) => {
    const x = 80 + index * slot;
    panel(ctx, theme, { x, y: 1330, width: slot - 16, height: 142 }, 14);
    ctx.fillStyle = theme.ink;
    paragraph(
      ctx,
      entry.label,
      { x: x + 14, y: 1342, width: slot - 44, height: 29 },
      24,
      20,
      true,
    );
    ctx.fillStyle = theme.accent;
    value(
      ctx,
      entry.display,
      { x: x + 14, y: 1380, width: slot - 44, height: 35 },
      29,
    );
    if (entry.share !== undefined) {
      ctx.fillStyle = theme.ink;
      value(
        ctx,
        percent(entry.share),
        { x: x + 14, y: 1420, width: slot - 44, height: 26 },
        21,
      );
    }
    ctx.fillStyle = theme.accent;
    ctx.fillRect(
      x + 14,
      1457,
      maximum ? ((slot - 44) * entry.value) / maximum : 0,
      4,
    );
  });
}

function drawMedia(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "media" }>,
  theme: Theme,
) {
  headline(ctx, story, theme);
  story.data.categories.forEach((entry, index) => {
    const x = 80 + (index % 2) * 485;
    const y = 985 + Math.floor(index / 2) * 155;
    panel(ctx, theme, { x, y, width: 435, height: 136 });
    ctx.fillStyle = theme.accent;
    value(
      ctx,
      numberFormat.format(entry.count),
      { x: x + 24, y: y + 18, width: 387, height: 60 },
      50,
    );
    ctx.fillStyle = theme.ink;
    paragraph(
      ctx,
      entry.label,
      { x: x + 24, y: y + 88, width: 387, height: 37 },
      28,
      22,
    );
  });
  if (story.data.hiddenCategories) {
    ctx.fillStyle = theme.ink;
    paragraph(
      ctx,
      `${numberFormat.format(story.data.remainingMedia)} across ${numberFormat.format(story.data.hiddenCategories)} more media categories`,
      { x: 80, y: 1308, width: 920, height: 64 },
      27,
      22,
    );
  }
  story.data.emoji.forEach((entry, index) => {
    const x = 80 + index * 315;
    ctx.fillStyle = theme.ink;
    paragraph(ctx, entry.symbol, { x, y: 1388, width: 90, height: 74 }, 54, 36);
    value(
      ctx,
      numberFormat.format(entry.count),
      { x: x + 98, y: 1400, width: 195, height: 50 },
      35,
    );
  });
  if (!story.data.emojiAvailable) {
    ctx.fillStyle = theme.ink;
    paragraph(
      ctx,
      "Supported emoji counts unavailable",
      { x: 80, y: 1400, width: 920, height: 60 },
      28,
    );
  }
}

function drawWords(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "word" }>,
  theme: Theme,
) {
  ctx.fillStyle = theme.accent;
  value(ctx, story.value, { x: 80, y: 714, width: 920, height: 90 }, 72);
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    story.valueLabel,
    { x: 80, y: 815, width: 920, height: 71 },
    31,
  );
  story.data.words.forEach((entry, index) => {
    const y = 908 + index * 93;
    ctx.fillStyle = theme.ink;
    paragraph(
      ctx,
      entry.word,
      { x: 80, y, width: 600, height: 79 },
      47,
      24,
      true,
    );
    ctx.fillStyle = theme.accent;
    value(
      ctx,
      numberFormat.format(entry.count),
      { x: 714, y: y + 12, width: 286, height: 60 },
      45,
    );
  });
}

function drawClosing(
  ctx: CanvasRenderingContext2D,
  story: Extract<WhatsAppStory, { kind: "closing" }>,
  theme: Theme,
) {
  panel(ctx, theme, { x: 80, y: 760, width: 920, height: 435 }, 48);
  ctx.fillStyle = theme.accent;
  value(
    ctx,
    story.value,
    { x: 120, y: 835, width: 840, height: 190 },
    158,
    "center",
  );
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    story.valueLabel,
    { x: 140, y: 1040, width: 800, height: 120 },
    37,
    27,
    false,
    "center",
  );
  paragraph(
    ctx,
    `${numberFormat.format(story.data.cardCount)} cards, generated locally`,
    { x: 80, y: 1216, width: 920, height: 38 },
    28,
    24,
    false,
    "center",
  );
  const recap = [
    [story.data.messages, "messages"],
    [story.data.participants, "participants"],
    [story.data.activeDates, "active dates"],
  ] as const;
  recap.forEach(([count, label], index) => {
    const x = 80 + index * 315;
    ctx.fillStyle = theme.accent;
    value(
      ctx,
      numberFormat.format(count),
      { x, y: 1273, width: 285, height: 87 },
      70,
    );
    ctx.fillStyle = theme.ink;
    paragraph(ctx, label, { x, y: 1382, width: 285, height: 72 }, 30, 24);
  });
}

/** The live preview and PNG export use this same local aggregate-only renderer. */
export function drawWhatsAppStory(
  canvas: HTMLCanvasElement,
  story: WhatsAppStory,
  demo: boolean,
) {
  canvas.width = WHATSAPP_STORY_WIDTH;
  canvas.height = WHATSAPP_STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable in this browser.");
  const theme = whatsappStoryThemes[story.theme];
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, WHATSAPP_STORY_WIDTH, WHATSAPP_STORY_HEIGHT);
  // Decorative motifs carry no analytic meaning and remain behind the header.
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.1;
  ctx.lineWidth = 18;
  for (let index = 0; index < 3; index++) {
    ctx.beginPath();
    if (story.motif === "rings")
      ctx.arc(885, 360, 95 + index * 55, 0, Math.PI * 2);
    else if (story.motif === "bubbles")
      ctx.roundRect(685 + index * 26, 230 + index * 56, 285, 120, 36);
    else ctx.rect(704 + index * 38, 247 + index * 48, 210, 190);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    "WHATSAPPSCOPE / WRAPPED",
    { x: 80, y: 87, width: 920, height: 42 },
    27,
    27,
    true,
  );
  paragraph(
    ctx,
    demo ? "FICTIONAL DEMO DATA" : "FROM YOUR SUPPLIED EXPORT",
    { x: 80, y: 139, width: 920, height: 36 },
    24,
  );
  paragraph(
    ctx,
    story.label,
    { x: 80, y: 244, width: 920, height: 40 },
    27,
    24,
    true,
  );
  paragraph(
    ctx,
    story.title,
    { x: 80, y: 307, width: 920, height: 195 },
    82,
    44,
    true,
  );
  paragraph(
    ctx,
    story.lead,
    { x: 80, y: 535, width: 920, height: 132 },
    34,
    26,
  );

  switch (story.kind) {
    case "hero":
      drawHero(ctx, story, theme);
      break;
    case "split":
      drawSplit(ctx, story, theme);
      break;
    case "ranking":
      drawRanking(ctx, story, theme);
      break;
    case "distribution":
      drawDistribution(ctx, story, theme);
      break;
    case "timeline":
      drawTimeline(ctx, story, theme);
      break;
    case "rhythm":
      drawRhythm(ctx, story, theme);
      break;
    case "patterns":
      drawPatterns(ctx, story, theme);
      break;
    case "media":
      drawMedia(ctx, story, theme);
      break;
    case "word":
      drawWords(ctx, story, theme);
      break;
    case "closing":
      drawClosing(ctx, story, theme);
      break;
  }

  rule(ctx, theme, 1495);
  story.facts.forEach((fact, index) => {
    const x = 80 + index * 485;
    ctx.fillStyle = theme.accent;
    value(ctx, fact.value, { x, y: 1530, width: 435, height: 68 }, 54);
    ctx.fillStyle = theme.ink;
    paragraph(ctx, fact.label, { x, y: 1604, width: 435, height: 66 }, 27, 22);
  });
  ctx.fillStyle = theme.ink;
  paragraph(
    ctx,
    story.note,
    { x: 80, y: 1695, width: 920, height: 72 },
    26,
    22,
  );
  paragraph(
    ctx,
    "Made with WhatsAppScope",
    { x: 80, y: 1790, width: 920, height: 38 },
    29,
    29,
    true,
  );
  paragraph(
    ctx,
    "A local tool by InstaScope",
    { x: 80, y: 1827, width: 920, height: 29 },
    23,
  );
  return ctx;
}
