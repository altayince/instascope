import { WhatsAppImportError } from "./errors";
import {
  importWhatsApp,
  inspectWhatsApp,
  type WhatsAppNamedBlob,
} from "./import";
import type { WhatsAppFormatId } from "./types";

self.onmessage = async (
  event: MessageEvent<{
    files: WhatsAppNamedBlob[];
    format: WhatsAppFormatId;
    operation?: "inspect";
  }>,
) => {
  try {
    if (event.data.operation === "inspect")
      self.postMessage({ inspection: await inspectWhatsApp(event.data.files) });
    else
      self.postMessage({
        dataset: await importWhatsApp(event.data.files, event.data.format),
      });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof WhatsAppImportError
          ? { code: error.code, message: error.message }
          : {
              code: "read",
              message:
                "Unable to read this chat. Export a fresh WhatsApp chat TXT file and try again.",
            },
    });
  }
};
