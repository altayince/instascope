import { verifiedPublicImageUrl } from "./profile-lookup";

// A small Gaussian unsharp mask enhances existing edges. It cannot recover
// original detail and deliberately does not synthesize facial features.
export function sharpenProfilePixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    pixels.length !== width * height * 4
  )
    throw new Error("Invalid image dimensions");
  const output = new Uint8ClampedArray(pixels);
  const weights = [1, 2, 1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let blurred = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            blurred +=
              pixels[(ny * width + nx) * 4 + channel] *
              weights[dx + 1] *
              weights[dy + 1];
          }
        }
        output[offset + channel] =
          pixels[offset + channel] +
          0.45 * (pixels[offset + channel] - blurred / 16);
      }
    }
  }
  return output;
}

export async function enhancePublicPhoto(url: string, signal: AbortSignal) {
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
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(photo, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  image.data.set(sharpenProfilePixels(image.data, canvas.width, canvas.height));
  context.putImageData(image, 0, 0);
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
