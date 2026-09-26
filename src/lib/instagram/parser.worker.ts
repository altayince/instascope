import { importDataset, type InputFile } from "./import";
import { ImportError } from "./parsers";
self.onmessage = (event: MessageEvent<InputFile[]>) => {
  try {
    self.postMessage({ dataset: importDataset(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof ImportError
          ? error.message
          : "Unable to read this export. Try a fresh JSON export.",
    });
  }
};
