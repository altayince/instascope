import type { Dataset } from "./types";
import { LIMITS } from "./import";
export async function readExport(files: File[]): Promise<Dataset> {
  if (
    files.length > LIMITS.files ||
    files.reduce((sum, file) => sum + file.size, 0) > LIMITS.upload
  )
    throw new Error(
      "Upload up to 100 MB and 200 files. Export only Followers and Following.",
    );
  const inputs = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
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
    worker.postMessage(
      inputs,
      inputs.map((input) => input.bytes.buffer),
    );
  });
}
