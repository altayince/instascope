import type { WhatsAppRecordEvent } from "./types";

/** Exact omission/event literals only. No attachment-name, caption or prose inference. */
const eventMarkers = new Map<string, WhatsAppRecordEvent>([
  ["<Media omitted>", { kind: "unspecified", locale: "en" }],
  ["image omitted", { kind: "image", locale: "en" }],
  ["video omitted", { kind: "video", locale: "en" }],
  ["audio omitted", { kind: "audio", locale: "en" }],
  ["sticker omitted", { kind: "sticker", locale: "en" }],
  ["GIF omitted", { kind: "gif", locale: "en" }],
  ["document omitted", { kind: "document", locale: "en" }],
  ["<Bild ausgelassen>", { kind: "image", locale: "de" }],
  ["<Video ausgelassen>", { kind: "video", locale: "de" }],
  ["<Sprachnachricht ausgelassen>", { kind: "audio", locale: "de" }],
  ["<Sticker ausgelassen>", { kind: "sticker", locale: "de" }],
  ["<GIF ausgelassen>", { kind: "gif", locale: "de" }],
  ["<Dokument ausgelassen>", { kind: "document", locale: "de" }],
  [
    "Du hast diese Nachricht gelöscht.",
    { kind: "deleted-message", locale: "de" },
  ],
  ["[Anruf]", { kind: "call", locale: "de" }],
  ["- [Anruf]", { kind: "call", locale: "de" }],
]);

const markerContent = (content: string) =>
  content.replace(/^[\u200e\u200f]+/, "");
const coordinate = "(-?\\d{1,3}(?:\\.\\d{1,20})?)";
const locationMarker = new RegExp(
  `^Standort: ${coordinate}, ${coordinate} - https:\\/\\/maps\\.google\\.com\\/\\?q=${coordinate},${coordinate}$`,
);

/** Bounded verified location wrapper only; values stay in the original private text. */
function isWhatsAppLocationMarker(content: string): boolean {
  const match = locationMarker.exec(content);
  if (
    !match ||
    match[0] !== content ||
    match[1] !== match[3] ||
    match[2] !== match[4]
  )
    return false;
  return Math.abs(Number(match[1])) <= 90 && Math.abs(Number(match[2])) <= 180;
}

/** Known typed markers with extra content are counted, never inferred from filenames. */
export function hasUnclassifiedWhatsAppMarker(content: string): boolean {
  const text = markerContent(content);
  const prefix =
    /^<(?:Bild|Video|Sprachnachricht|Sticker|GIF|Dokument) ausgelassen>/.exec(
      text,
    );
  return Boolean(prefix && text.slice(prefix[0].length).trim());
}

export function classifyWhatsAppEvent(
  content: string,
): WhatsAppRecordEvent | undefined {
  const text = markerContent(content);
  const event = eventMarkers.get(text);
  if (!event && isWhatsAppLocationMarker(text))
    return { kind: "location", locale: "de" };
  return event ? { ...event } : undefined;
}
