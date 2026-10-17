// Build the site first, then serve its static output on loopback, for example:
// PORT=3002 node scripts/serve.mjs
// node scripts/generate-whatsapp-social-image.mjs http://127.0.0.1:3002
// Uses the actual landing preview and its built-in fictional analysis only.
import { chromium } from "@playwright/test";
import sharp from "sharp";

const origin = new URL(process.argv[2] || "http://127.0.0.1:3002");
if (
  origin.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
  origin.username ||
  origin.password
) {
  throw new Error("Use a local HTTP preview server on loopback only.");
}
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.route("**/*", async (route) => {
    const request = new URL(route.request().url());
    if (request.pathname === "/api/events") {
      await route.fulfill({ status: 204 });
    } else if (request.origin === origin.origin) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  const page = await context.newPage();
  await page.goto(new URL("/whatsapp/", origin).href);
  await page.getByRole("switch", { name: "Dark mode" }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".theme-toggle")?.disabled,
  );
  await page.evaluate(() => document.fonts.ready);
  const preview = page.locator(".wa-landing-preview");
  const totals = await preview.locator(".wa-stat strong").allTextContents();
  if (totals.join(",") !== "24,8,3,4") {
    throw new Error(`Unexpected fictional preview totals: ${totals.join(",")}`);
  }
  if (!(await preview.innerText()).includes("Demo data · Fictional example")) {
    throw new Error("The preview must clearly identify its fictional source.");
  }
  const capture = await preview.screenshot({ animations: "disabled" });
  const card = await sharp(capture).resize({ width: 506 }).png().toBuffer();
  const { height } = await sharp(card).metadata();
  const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#faf9f5"/>
    <rect x="56" y="55" width="6" height="31" rx="3" fill="#263b30"/>
    <text x="78" y="80" font-family="Arial" font-size="28" font-weight="bold" fill="#263b30">InstaScope / WhatsApp</text>
    <text x="56" y="220" font-family="Arial" font-size="47" font-weight="bold" fill="#263b30">Your conversations.</text>
    <text x="56" y="282" font-family="Georgia" font-size="48" font-style="italic" fill="#263b30">A new perspective.</text>
    <text x="56" y="355" font-family="Arial" font-size="25" fill="#657168">Analyze a local chat export.</text>
    <text x="56" y="395" font-family="Arial" font-size="25" fill="#657168">Explore the facts. Make a Wrapped.</text>
    <rect x="56" y="456" width="464" height="52" rx="12" fill="#d9efa8"/>
    <text x="76" y="490" font-family="Arial" font-size="22" fill="#263b30">Your chat stays on your device.</text>
    <line x1="56" y1="555" x2="1144" y2="555" stroke="#e1e5dc"/>
    <text x="56" y="594" font-family="Arial" font-size="20" fill="#657168">No login needed.</text>
    <text x="1144" y="594" text-anchor="end" font-family="Arial" font-size="20" fill="#657168">Demo data · Fictional example</text>
  </svg>`;
  await sharp(Buffer.from(canvas))
    .composite([{ input: card, left: 638, top: Math.round(320 - height / 2) }])
    .png()
    .toFile("public/whatsapp-opengraph-image.png");
  console.log("Generated public/whatsapp-opengraph-image.png (1200×630)");
} finally {
  await browser.close();
}
