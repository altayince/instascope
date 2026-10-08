export function profileTensor(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const size = width * height;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 270 ||
    height > 270 ||
    pixels.length !== size * 4
  )
    throw new Error("Invalid AI input");
  const tensor = new Float32Array(size * 3);
  for (let i = 0; i < size; i++)
    for (let channel = 0; channel < 3; channel++)
      tensor[channel * size + i] = pixels[i * 4 + channel] / 255;
  return tensor;
}

export function profilePixels(
  tensor: Float32Array,
  width: number,
  height: number,
) {
  // This bound is for a single inference tile, not the assembled image size.
  const size = width * height;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 1080 ||
    height > 1080 ||
    tensor.length !== size * 3
  )
    throw new Error("Invalid AI output");
  const pixels = new Uint8ClampedArray(size * 4);
  for (let i = 0; i < size; i++) {
    for (let channel = 0; channel < 3; channel++) {
      const value = tensor[channel * size + i];
      if (!Number.isFinite(value)) throw new Error("Invalid AI output");
      pixels[i * 4 + channel] = value * 255;
    }
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}
