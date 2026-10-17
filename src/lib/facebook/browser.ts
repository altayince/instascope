import { validateFacebookFile } from "./import";
import { FacebookImportError } from "./parsers";
import type { FacebookDataset } from "./types";

export function readFacebook(
  file: File,
  signal?: AbortSignal,
): Promise<FacebookDataset> {
  validateFacebookFile(file);
  const cancelled = () =>
    new FacebookImportError("Import cancelled. Choose a ZIP to start again.");
  if (signal?.aborted) return Promise.reject(cancelled());
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./parser.worker.ts", import.meta.url));
    } catch {
      reject(
        new FacebookImportError(
          "The local reader could not start. Refresh or use a browser with Web Worker support.",
        ),
      );
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return false;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (finish()) reject(cancelled());
    };
    const fail = () => {
      if (finish())
        reject(
          new FacebookImportError(
            "The local reader stopped. Refresh or try a smaller Friends export.",
          ),
        );
    };
    const timer = setTimeout(fail, 120000);
    worker.onmessage = (
      event: MessageEvent<{ dataset?: FacebookDataset; error?: string }>,
    ) => {
      if (!finish()) return;
      if (event.data.dataset) resolve(event.data.dataset);
      else
        reject(
          new FacebookImportError(
            event.data.error ??
              "The reader returned no result. Try a fresh Facebook ZIP.",
          ),
        );
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    try {
      worker.postMessage({ file });
    } catch {
      fail();
    }
  });
}
