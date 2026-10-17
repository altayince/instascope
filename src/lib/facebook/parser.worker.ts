import { importFacebook } from "./import";
import { FacebookImportError } from "./parsers";
self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    self.postMessage({ dataset: await importFacebook(event.data.file) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof FacebookImportError
          ? error.message
          : "Unable to read this Facebook export. Try a fresh JSON or HTML ZIP.",
    });
  }
};
