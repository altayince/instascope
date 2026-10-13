import type { WhatsAppStory } from "@/lib/whatsapp/stories";

export const WHATSAPP_STORY_WIDTH = 1080;
export const WHATSAPP_STORY_HEIGHT = 1920;
export const whatsappStoryThemes = {
  forest: { background: "#143c32", ink: "#f5f6e9", accent: "#c7f6bc" },
  mint: { background: "#d5ece1", ink: "#173d32", accent: "#256c52" },
  cream: { background: "#f5f1e4", ink: "#263d31", accent: "#356c50" },
  lime: { background: "#d6f1b9", ink: "#183d31", accent: "#315f41" },
} as const;

function drawLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  top: number,
  width: number,
  lineHeight: number,
  maximumLines = 5,
) {
  const rows: string[] = [];
  let row = "";
  for (const word of text.split(/\s+/)) {
    const candidate = row ? `${row} ${word}` : word;
    if (row && ctx.measureText(candidate).width > width) {
      rows.push(row);
      row = word;
    } else row = candidate;
  }
  if (row) rows.push(row);
  rows.slice(0, maximumLines).forEach((line, index) => {
    ctx.fillText(line, x, top + index * lineHeight, width);
  });
  return Math.min(rows.length, maximumLines) * lineHeight;
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maximum: number,
  minimum: number,
  width: number,
) {
  let size = maximum;
  ctx.font = `bold ${size}px Arial`;
  while (size > minimum && ctx.measureText(text).width > width) {
    size -= 2;
    ctx.font = `bold ${size}px Arial`;
  }
}

/** Render only the already sanitized, aggregate story model. */
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
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, WHATSAPP_STORY_WIDTH, WHATSAPP_STORY_HEIGHT);
  ctx.save();
  ctx.translate(970, 210);
  ctx.strokeStyle = theme.accent;
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.14;
  ctx.lineWidth = 26;
  for (let i = 0; i < 4; i++) {
    const radius = 325 - i * 76;
    ctx.beginPath();
    if (story.motif === "bubbles") {
      ctx.roundRect(-radius, -radius * 0.7, radius * 1.8, radius * 1.15, 45);
    } else if (story.motif === "rings") {
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    } else {
      ctx.rect(-radius, -radius, radius * 2, radius * 2);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = theme.ink;
  ctx.font = "bold 27px Arial";
  ctx.fillText("WHATSAPPSCOPE / WRAPPED", 80, 115);
  ctx.font = "24px Arial";
  ctx.fillText(
    demo ? "FICTIONAL DEMO DATA" : "FROM YOUR SUPPLIED EXPORT",
    80,
    157,
  );
  ctx.font = "bold 27px Arial";
  ctx.fillText(story.label, 80, 303, 920);
  ctx.font = "bold 99px Arial";
  drawLines(ctx, story.title, 80, 443, 915, 107, 3);
  ctx.font = "34px Arial";
  drawLines(ctx, story.lead, 80, 756, 915, 47, 4);

  ctx.fillStyle = theme.accent;
  fitFont(ctx, story.value, 205, 70, 920);
  ctx.fillText(story.value, 77, 1090, 920);
  ctx.fillStyle = theme.ink;
  ctx.font = "31px Arial";
  drawLines(ctx, story.valueLabel, 80, 1150, 900, 43, 2);

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = theme.ink;
  ctx.fillRect(80, 1260, 920, 1);
  ctx.globalAlpha = 1;
  story.facts.slice(0, 2).forEach((fact, index) => {
    const x = 80 + index * 485;
    ctx.fillStyle = theme.accent;
    fitFont(ctx, fact.value, 62, 34, 435);
    ctx.fillText(fact.value, x, 1370, 435);
    ctx.fillStyle = theme.ink;
    ctx.font = "29px Arial";
    drawLines(ctx, fact.label, x, 1424, 420, 40, 3);
  });
  ctx.font = "26px Arial";
  drawLines(ctx, story.note, 80, 1650, 915, 36, 4);
  ctx.font = "bold 29px Arial";
  ctx.fillText("Made with WhatsAppScope", 80, 1840);
  ctx.font = "24px Arial";
  ctx.fillText("A local tool by InstaScope", 80, 1880);
  return ctx;
}
