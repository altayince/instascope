import { parseWhatsApp } from "./parser";
import type { WhatsAppDataset } from "./types";

/** Fully synthetic sender labels, dates and content. No personal exports. */
export const WHATSAPP_DEMO_TEXT = [
  "28/12/2025, 08:55 - Messages and calls are end-to-end encrypted.",
  "28/12/2025, 09:00 - Mira: Ready for our winter project? 🌿",
  "28/12/2025, 09:05 - Rowan: Yes! Here is the plan: https://example.org/plan",
  "28/12/2025, 09:10 - Jules: Count me in 🙌",
  "29/12/2025, 08:30 - Mira: Morning checklist",
  "First: choose a route",
  "Then: pack snacks",
  "29/12/2025, 12:10 - Rowan: <Media omitted>",
  "29/12/2025, 18:30 - Jules: Looks good 🌿🌿",
  "30/12/2025, 09:20 - Mira: Updated map: https://example.org/map",
  "30/12/2025, 18:00 - Rowan: image omitted",
  "30/12/2025, 18:10 - Jules: Great teamwork 👍🏽",
  "31/12/2025, 20:00 - Mira: One more day! 🎉",
  "31/12/2025, 20:02 - Rowan: See you next year 🎉",
  "31/12/2025, 20:04 - Jules: 🎉",
  "01/01/2026, 10:00 - Mira: New year, same project 🌿",
  "01/01/2026, 10:05 - Rowan: Happy new year!",
  "01/01/2026, 10:08 - Jules: Let's go 🙌",
  "03/01/2026, 14:00 - Mira: We have a new stop: https://example.org/new-stop",
  "03/01/2026, 14:01 - Rowan: https://example.org/stop and https://example.org/weather",
  "03/01/2026, 14:05 - Jules: video omitted",
  "04/01/2026, 16:00 - Mira: Thanks for today 🌿",
  "04/01/2026, 16:01 - Rowan: audio omitted",
  "04/01/2026, 16:02 - Jules: That was fun 🙌",
  "07/01/2026, 19:00 - Mira: Final notes: https://example.org/notes",
  "07/01/2026, 19:04 - Rowan: Finished! 🎉",
  "07/01/2026, 19:07 - Jules: See you at the next one 🌿",
].join("\n");

export function createWhatsAppDemo(): WhatsAppDataset {
  const dataset = parseWhatsApp(WHATSAPP_DEMO_TEXT, "dmy-24h");
  dataset.metadata.source = "demo";
  return dataset;
}
