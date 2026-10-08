import { verifiedPublicImageUrl } from "./profile-lookup";
import { PROFILE_SCALE } from "./profile-ai-tiles";

export async function enhancePublicPhoto(
  url: string,
  signal: AbortSignal,
  progress: (message: string) => void = () => {},
) {
  if (!verifiedPublicImageUrl(url)) throw new Error("Untrusted image");
  const photo = new Image();
  photo.crossOrigin = "anonymous";
  photo.referrerPolicy = "no-referrer";
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      photo.onload = null;
      photo.onerror = null;
    };
    const abort = () => {
      cleanup();
      photo.src = "";
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(abort, 12000);
    photo.onload = () => {
      cleanup();
      resolve();
    };
    photo.onerror = () => {
      cleanup();
      reject(new Error("Image enhancement unavailable"));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else photo.src = url;
  });
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const { naturalWidth: width, naturalHeight: height } = photo;
  if (width < 1 || height < 1 || Math.max(width, height) > 1024)
    throw new Error("Image outside enhancement size limits");
  const canvas = document.createElement("canvas");
  // Preserve source pixels. The worker bounds inference memory with tiles.
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(photo, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const restored = await new Promise<ImageData>((resolve, reject) => {
    const worker = new Worker(
      new URL("./profile-ai.worker.ts", import.meta.url),
    );
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error("AI enhancement timed out"));
    }, 180000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => {
      finish();
      reject(new Error("AI enhancement unavailable"));
    };
    worker.onmessage = (
      event: MessageEvent<{
        progress?: string;
        error?: string;
        pixels: Uint8ClampedArray;
        width: number;
        height: number;
      }>,
    ) => {
      if (event.data.progress) {
        progress(event.data.progress);
        return;
      }
      finish();
      if (
        event.data.error ||
        event.data.width !== width * PROFILE_SCALE ||
        event.data.height !== height * PROFILE_SCALE ||
        event.data.pixels?.length !== width * height * PROFILE_SCALE ** 2 * 4
      )
        reject(new Error("AI enhancement unavailable"));
      else
        resolve(
          new ImageData(
            new Uint8ClampedArray(event.data.pixels),
            event.data.width,
            event.data.height,
          ),
        );
    };
    if (signal.aborted) abort();
    else
      worker.postMessage(
        { pixels: image.data, width: image.width, height: image.height },
        [image.data.buffer],
      );
  });
  // Encode the learned output at its native resolution; never manufacture HD
  // dimensions by interpolating after inference.
  canvas.width = restored.width;
  canvas.height = restored.height;
  context.putImageData(restored, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Image encoding unavailable")),
      "image/png",
    ),
  );
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return {
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
  };
}
