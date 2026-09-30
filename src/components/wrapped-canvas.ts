import type { Story } from "@/lib/analysis/stories";

const WIDTH = 1080;
const HEIGHT = 1920;
import { storyStyles } from "./wrapped-style";

function lines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  top: number,
  maxWidth: number,
  lineHeight: number,
) {
  let current = "";
  let y = top;
  for (const word of text.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      ctx.fillText(current, x, y);
      y += lineHeight;
      current = word;
    } else current = next;
  }
  if (current) ctx.fillText(current, x, y);
  return y;
}

export function drawWrappedStory(
  canvas: HTMLCanvasElement,
  story: Story,
  demo: boolean,
) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable in this browser.");
  const theme = storyStyles[story.id];
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.translate(956, 162);
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = theme.accent;
  ctx.fillStyle = theme.accent;
  ctx.lineWidth = 32;
  if (theme.motif === "steps") ctx.rotate(-Math.PI / 10);
  for (let i = 0; i < 4; i++) {
    const radius = 297 - i * 80;
    if (theme.motif === "rays") {
      ctx.save();
      ctx.rotate((i * Math.PI) / 4);
      ctx.fillRect(-47, -297, 94, 594);
      ctx.restore();
    } else if (theme.motif === "steps")
      ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.fillStyle = theme.ink;
  ctx.font = "bold 28px Arial";
  ctx.fillText(
    demo ? "DEMO DATA · FICTIONAL EXAMPLE" : story.label,
    80,
    150,
    920,
  );
  if (demo) ctx.fillText(story.label, 80, 192, 920);
  ctx.font = "bold 95px Arial";
  lines(ctx, story.title, 80, 335, 920, 98);
  ctx.font = "34px Arial";
  lines(ctx, story.lead, 80, 607, 920, 46);

  ctx.fillStyle = theme.accent;
  ctx.font = "bold 205px Arial";
  ctx.fillText(story.heroValue, 76, 856, 920);
  ctx.fillStyle = theme.ink;
  ctx.font = "32px Arial";
  lines(ctx, story.heroLabel, 80, 931, 920, 43);

  if (story.bars?.length) {
    const maximum = Math.max(...story.bars.map((bar) => bar.value));
    const width = (920 - (story.bars.length - 1) * 22) / story.bars.length;
    story.bars.forEach((bar, i) => {
      const x = 80 + i * (width + 22);
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, 1045, maximum ? (width * bar.value) / maximum : 0, 110);
      ctx.fillStyle = theme.ink;
      ctx.font = "26px Arial";
      ctx.fillText(bar.label, x, 1194, width);
    });
  }
  story.facts.forEach((fact, index) => {
    const x = 80 + (index % 2) * 476;
    const y = 1321 + Math.floor(index / 2) * 166;
    ctx.fillStyle = theme.accent;
    ctx.font = "bold 62px Arial";
    ctx.fillText(fact.value, x, y, 440);
    ctx.fillStyle = theme.ink;
    ctx.font = "28px Arial";
    lines(ctx, fact.label, x, y + 41, 440, 36);
  });

  ctx.fillStyle = theme.ink;
  ctx.font = "27px Arial";
  lines(ctx, story.note, 80, 1696, 920, 36);
  ctx.font = "bold 28px Arial";
  ctx.fillText("◎ Made with InstaScope", 80, 1850);
  ctx.font = "28px Arial";
  ctx.textAlign = "right";
  ctx.fillText("instascope.me", 1000, 1850);
  ctx.textAlign = "left";
  return ctx;
}
