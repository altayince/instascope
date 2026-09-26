import { importFiles, type NamedBlob } from "./import";
import { ImportError } from "./parsers";
self.onmessage = async (event: MessageEvent<NamedBlob[]>) => {
  try {
    self.postMessage({ dataset: await importFiles(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof ImportError
          ? error.message
          : "Unable to read this export. Try a fresh JSON export.",
    });
  }
};
