import type { ChatComparisonMetric } from "@/lib/whatsapp/chat-vault-compare";
import { whatsappNumber } from "@/lib/whatsapp/stories";

export const chatComparisonShare = (value: number | null) =>
  value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", {
        style: "percent",
        maximumFractionDigits: 2,
      }).format(value);

/** Display precision only; arithmetic stays in the comparison domain. */
export function chatComparisonValue(
  value: number | null,
  unit: ChatComparisonMetric["unit"],
  delta = false,
) {
  if (value === null) return "Unavailable";
  const prefix = delta && value > 0 ? "+" : "";
  if (unit === "share") {
    if (!delta) return chatComparisonShare(value);
    return `${prefix}${whatsappNumber(Number((value * 100).toFixed(2)))} pp`;
  }
  if (unit === "seconds") {
    const magnitude = Math.abs(value);
    const sign = value < 0 ? "−" : prefix;
    // Match the Analyzer's duration units without rounding away subsecond data.
    const days = Math.floor(magnitude / 86400);
    const hours = Math.floor((magnitude % 86400) / 3600);
    const minutes = Math.floor((magnitude % 3600) / 60);
    const seconds = Number((magnitude % 60).toFixed(3));
    return (
      sign +
      [
        days ? `${whatsappNumber(days)} d` : "",
        hours ? `${hours} h` : "",
        minutes ? `${minutes} min` : "",
        seconds || magnitude === 0 ? `${whatsappNumber(seconds)} s` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
  return `${prefix}${whatsappNumber(value)}${unit === "count" ? "" : ` ${unit}`}`;
}
