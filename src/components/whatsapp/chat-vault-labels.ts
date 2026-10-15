import type { ChatVaultSnapshot } from "@/lib/whatsapp/chat-vault";
import { whatsappDate, whatsappNumber } from "@/lib/whatsapp/stories";

export function chatVaultCoverageLabel(snapshot: ChatVaultSnapshot) {
  const { fromDate, toDate } = snapshot.coverage;
  return fromDate && toDate
    ? `${whatsappDate(fromDate, true)} – ${whatsappDate(toDate, true)}`
    : "Recorded participant-message dates unavailable";
}

export const chatVaultSavedLabel = (snapshot: ChatVaultSnapshot) =>
  new Date(snapshot.createdAt).toLocaleString("en-GB");

export const chatVaultOptionLabel = (
  snapshot: ChatVaultSnapshot,
  index: number,
) =>
  `${index + 1}. ${chatVaultCoverageLabel(snapshot)} · ${whatsappNumber(snapshot.totals.messages)} messages · saved ${chatVaultSavedLabel(snapshot)}`;
