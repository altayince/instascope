import { WhatsAppImportError, type WhatsAppErrorCode } from "./errors";
import { getWhatsAppFormat } from "./formats";
import { WHATSAPP_LIMITS, validateWhatsAppSelection } from "./limits";
import type { WhatsAppDataset, WhatsAppFormatId } from "./types";

const cancelled = () =>
  new WhatsAppImportError(
    "cancelled",
    "Chat reading was cancelled. Choose a file to start again.",
  );

export async function readWhatsApp(
  files: readonly File[],
  format: WhatsAppFormatId,
  signal?: AbortSignal,
): Promise<WhatsAppDataset> {
  validateWhatsAppSelection(files);
  getWhatsAppFormat(format);
  if (signal?.aborted) throw cancelled();
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./parser.worker.ts", import.meta.url));
    } catch {
      reject(
        new WhatsAppImportError(
          "worker",
          "The local chat reader could not start. Refresh the page or use a browser with Web Worker support.",
        ),
      );
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (finish()) reject(cancelled());
    };
    const timer = setTimeout(() => {
      if (!finish()) return;
      reject(
        new WhatsAppImportError(
          "timeout",
          "This chat took too long to process. Export a smaller chat without media and try again.",
        ),
      );
    }, WHATSAPP_LIMITS.workerTimeoutMs);
    worker.onmessage = (
      event: MessageEvent<{
        dataset?: WhatsAppDataset;
        error?: { code: WhatsAppErrorCode; message: string };
      }>,
    ) => {
      if (!finish()) return;
      if (event.data.error)
        reject(
          new WhatsAppImportError(
            event.data.error.code,
            event.data.error.message,
          ),
        );
      else if (event.data.dataset) resolve(event.data.dataset);
      else
        reject(
          new WhatsAppImportError(
            "worker",
            "The local chat reader returned no result. Refresh the page and try again.",
          ),
        );
    };
    worker.onerror = () => {
      if (!finish()) return;
      reject(
        new WhatsAppImportError(
          "worker",
          "The local chat reader stopped. Export a smaller chat or refresh the page and try again.",
        ),
      );
    };
    worker.onmessageerror = () => {
      if (!finish()) return;
      reject(
        new WhatsAppImportError(
          "worker",
          "The local chat reader could not return its result. Refresh the page and try again.",
        ),
      );
    };
    signal?.addEventListener("abort", abort, { once: true });
    // Covers an abort during worker construction before the listener was added.
    if (signal?.aborted) {
      abort();
      return;
    }
    try {
      worker.postMessage({ files: [...files], format });
    } catch {
      if (!finish()) return;
      reject(
        new WhatsAppImportError(
          "worker",
          "The local chat reader could not receive this file. Refresh the page and try again.",
        ),
      );
    }
  });
}
