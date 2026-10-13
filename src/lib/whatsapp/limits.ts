import { WhatsAppImportError } from "./errors";

export const WHATSAPP_LIMITS = {
  textBytes: 20 * 1024 * 1024,
  zipBytes: 1024 * 1024 * 1024,
  directoryBytes: 4 * 1024 * 1024,
  zipEntries: 10000,
  records: 200000,
  participantLabelCharacters: 256,
  participants: 10000,
  workerTimeoutMs: 45000,
} as const;

export function validateWhatsAppSelection(
  files: readonly { name: string; size: number }[],
) {
  if (files.length !== 1)
    throw new WhatsAppImportError(
      "selection",
      "Choose one WhatsApp chat TXT file or one ZIP containing exactly one chat TXT file.",
    );
  const file = files[0];
  const zip = /\.zip$/i.test(file.name);
  if (!zip && !/\.txt$/i.test(file.name))
    throw new WhatsAppImportError(
      "file-type",
      "This file type is unsupported. Choose a WhatsApp chat export in TXT or ZIP format.",
    );
  if (!Number.isSafeInteger(file.size) || file.size <= 0)
    throw new WhatsAppImportError(
      "empty",
      "This file is empty. Export a WhatsApp chat with messages and try again.",
    );
  if (file.size > (zip ? WHATSAPP_LIMITS.zipBytes : WHATSAPP_LIMITS.textBytes))
    throw new WhatsAppImportError(
      "limit",
      zip
        ? "This ZIP exceeds the 1 GB safety limit. Export the chat without media and try again."
        : "This chat exceeds the 20 MB safety limit. Export a smaller chat and try again.",
    );
}
