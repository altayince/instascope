import { importDataset, type InputFile } from "./import";
self.onmessage = (event: MessageEvent<InputFile[]>) => {
  try {
    self.postMessage({ dataset: importDataset(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Unable to read this export. Try a fresh JSON export.",
    });
  }
};
