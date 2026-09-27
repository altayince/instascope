import type { Story } from "@/lib/analysis/stories";

const WIDTH = 1080;
const HEIGHT = 1920;
const PAPER = "#faf8f0";
const LIME = "#d8f5a4";

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
  ctx.fillStyle = "#202c28";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = LIME;
  ctx.beginPath();
  ctx.arc(1030, 65, 280, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PAPER;
  ctx.font = "bold 28px Arial";
  ctx.fillText(
    demo ? "DEMO DATA - FICTIONAL EXAMPLE" : story.label,
    80,
    135,
    920,
  );
  if (demo) {
    ctx.font = "24px Arial";
    ctx.fillText(story.label, 80, 185, 920);
  }
  ctx.font = "bold 86px Arial";
  lines(ctx, story.title, 80, 300, 900, 100);
  ctx.font = "34px Arial";
  lines(ctx, story.lead, 80, 560, 900, 45);

  ctx.fillStyle = LIME;
  ctx.font = "bold 186px Arial";
  ctx.fillText(story.heroValue, 76, 810, 930);
  ctx.fillStyle = PAPER;
  ctx.font = "32px Arial";
  lines(ctx, story.heroLabel, 82, 875, 880, 42);

  story.facts.forEach((fact, index) => {
    const x = 82 + (index % 2) * 505;
    const y = 1070 + Math.floor(index / 2) * 195;
    ctx.fillStyle = LIME;
    ctx.font = "bold 69px Arial";
    ctx.fillText(fact.value, x, y, 440);
    ctx.fillStyle = PAPER;
    ctx.font = "27px Arial";
    lines(ctx, fact.label, x, y + 46, 430, 34);
  });

  ctx.fillStyle = PAPER;
  ctx.font = "28px Arial";
  lines(ctx, story.note, 82, 1710, 900, 37);
  ctx.font = "bold 40px Arial";
  ctx.fillText("◎ Made with InstaScope", 82, 1840, 900);
  return ctx;
}
