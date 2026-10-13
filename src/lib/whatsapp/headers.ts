import { WhatsAppImportError } from "./errors";
import { WHATSAPP_LIMITS } from "./limits";

export type WhatsAppHeader = {
  date: string;
  clock: string;
  body: string;
  wrapper: "ios" | "android";
};

// This is only an unsupported-header guard, never a date interpretation. At least
// one complete numeric component, two date separators and a comma-clock prefix
// distinguish it from arbitrary bracketed prose. Every component is bounded.
const dateComponent = "[\\p{L}\\d]{0,12}";
const dateWithNumericComponent = `(?:\\d{1,4}[/.-]${dateComponent}[/.-]${dateComponent}|${dateComponent}[/.-]\\d{1,4}[/.-]${dateComponent}|${dateComponent}[/.-]${dateComponent}[/.-]\\d{1,4})`;
const unsupportedDateHeader = new RegExp(
  `^\\[?${dateWithNumericComponent},[ \\u00a0\\u202f]*\\d{1,2}[:.]`,
  "u",
);

/** Only numeric headers in the verified iOS and existing Android wrappers. */
export function readWhatsAppHeader(line: string): WhatsAppHeader | null {
  const text = line.replace(/^[\u200e\u200f]+/, "");
  const bracketed =
    /^\[(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),[ \u00a0\u202f]*(\d{1,2}:\d{2}(?::\d{2})?(?:[ \u00a0\u202f]+[A-Za-z.]+)?)\][ \u00a0\u202f](.*)$/.exec(
      text,
    );
  const dashed =
    /^(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),[ \u00a0\u202f]*(\d{1,2}:\d{2}(?::\d{2})?(?:[ \u00a0\u202f]+[A-Za-z.]+)?)[ \u00a0\u202f]-[ \u00a0\u202f](.*)$/.exec(
      text,
    );
  const match = bracketed ?? dashed;
  return match
    ? {
        date: match[1],
        clock: match[2],
        body: match[3],
        wrapper: bracketed ? "ios" : "android",
      }
    : null;
}

/** Header-shaped unsupported input must never become multiline message content. */
export function isWhatsAppHeaderLike(line: string): boolean {
  const text = line.replace(/^[ \t\u00a0\u202f\u200e\u200f]+/, "");
  return (
    unsupportedDateHeader.test(text) ||
    /^\[?(?:\d{1,4}[/.-]){1,2}\d{1,4}(?:,|[ \u00a0\u202f]+\d{1,2}[:.])/.test(
      text,
    ) ||
    /^\[?(?:\d{1,2}[ .-][A-Za-z]{3,9}[ .-]\d{2,4}|[A-Za-z]{3,9}[ ]\d{1,2},?[ ]\d{2,4})[, ]+\d{1,2}[:.]/.test(
      text,
    )
  );
}

export function whatsappLines(text: string): string[] {
  if (
    text.length > WHATSAPP_LIMITS.textBytes ||
    new TextEncoder().encode(text).length > WHATSAPP_LIMITS.textBytes
  )
    throw new WhatsAppImportError(
      "limit",
      "This chat exceeds the 20 MB safety limit. Export a smaller chat and try again.",
    );
  if (text.includes("\u0000"))
    throw new WhatsAppImportError(
      "encoding",
      "This chat is not a supported UTF-8 text export. Export a fresh WhatsApp chat TXT file.",
    );
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n$/, "")
    .split("\n");
}
