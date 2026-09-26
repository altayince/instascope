import type { Dataset } from "./types";
import { validateSelection } from "./limits";
export async function readExport(files: File[]): Promise<Dataset> {
  validateSelection(files);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./parser.worker.ts", import.meta.url));
    const timer = setTimeout(() => {
      worker.terminate();
      reject(
        new Error(
          "This export took too long to process. Request only Followers and Following and try again.",
        ),
      );
    }, 30000);
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onmessage = (event) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.dataset);
    };
    worker.onerror = () => {
      finish();
      reject(
        new Error(
          "The archive reader could not start. Refresh the page and retry.",
        ),
      );
    };
    worker.postMessage(files);
  });
}
