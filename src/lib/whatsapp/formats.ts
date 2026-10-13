import type { WhatsAppFormat, WhatsAppFormatId } from "./types";
import { WhatsAppImportError } from "./errors";

export const WHATSAPP_FORMATS: readonly WhatsAppFormat[] = [
  {
    id: "dmy-24h",
    label: "Day / month / year · 24-hour",
    sample: "14/03/2025, 09:15 - Mira: Hello",
    dateOrder: "dmy",
    timeConvention: "24h",
  },
  {
    id: "mdy-24h",
    label: "Month / day / year · 24-hour",
    sample: "03/14/2025, 09:15 - Mira: Hello",
    dateOrder: "mdy",
    timeConvention: "24h",
  },
  {
    id: "ymd-24h",
    label: "Year-month-day · 24-hour",
    sample: "2025-03-14, 09:15 - Mira: Hello",
    dateOrder: "ymd",
    timeConvention: "24h",
  },
  {
    id: "dmy-12h",
    label: "Day / month / year · AM/PM",
    sample: "14/03/2025, 9:15 AM - Mira: Hello",
    dateOrder: "dmy",
    timeConvention: "12h",
  },
  {
    id: "mdy-12h",
    label: "Month / day / year · AM/PM",
    sample: "03/14/2025, 9:15 AM - Mira: Hello",
    dateOrder: "mdy",
    timeConvention: "12h",
  },
  {
    id: "ymd-12h",
    label: "Year-month-day · AM/PM",
    sample: "2025-03-14, 9:15 AM - Mira: Hello",
    dateOrder: "ymd",
    timeConvention: "12h",
  },
];

export function getWhatsAppFormat(id: WhatsAppFormatId): WhatsAppFormat {
  const format = WHATSAPP_FORMATS.find((candidate) => candidate.id === id);
  if (!format)
    throw new WhatsAppImportError(
      "format",
      "Choose a supported date and time format before importing your chat.",
    );
  return format;
}
