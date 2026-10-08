export const PROFILE_SCALE = 4;
const CORE = 192;
// The 34-convolution SRVGG network needs neighboring source pixels. Discard
// the halo from each learned output instead of blending/resizing tile edges.
const HALO = 36;
export function profileTiles(width: number, height: number) {
  if (![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 1024))
    throw new Error("Invalid source dimensions");
  const step = Math.max(width, height) <= 270 ? 270 : CORE;
  const tiles = [];
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step) {
      const left = Math.max(0, x - HALO),
        top = Math.max(0, y - HALO);
      const right = Math.min(width, x + step + HALO);
      const bottom = Math.min(height, y + step + HALO);
      tiles.push({
        x,
        y,
        left,
        top,
        width: right - left,
        height: bottom - top,
        coreWidth: Math.min(step, width - x),
        coreHeight: Math.min(step, height - y),
      });
    }
  return tiles;
}
export type ProfileTile = ReturnType<typeof profileTiles>[number];
export function readProfileTile(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  tile: ProfileTile,
) {
  if (pixels.length !== width * height * 4)
    throw new Error("Invalid source pixels");
  const result = new Uint8ClampedArray(tile.width * tile.height * 4);
  for (let row = 0; row < tile.height; row++) {
    const start = ((tile.top + row) * width + tile.left) * 4;
    result.set(
      pixels.subarray(start, start + tile.width * 4),
      row * tile.width * 4,
    );
  }
  return result;
}
export function writeProfileTile(
  target: Uint8ClampedArray,
  sourceWidth: number,
  tile: ProfileTile,
  restored: Uint8ClampedArray,
) {
  if (restored.length !== tile.width * tile.height * PROFILE_SCALE ** 2 * 4)
    throw new Error("Invalid tile output");
  for (let row = 0; row < tile.coreHeight * PROFILE_SCALE; row++) {
    const start =
      (((tile.y - tile.top) * PROFILE_SCALE + row) *
        tile.width *
        PROFILE_SCALE +
        (tile.x - tile.left) * PROFILE_SCALE) *
      4;
    const destination =
      ((tile.y * PROFILE_SCALE + row) * sourceWidth * PROFILE_SCALE +
        tile.x * PROFILE_SCALE) *
      4;
    target.set(
      restored.subarray(start, start + tile.coreWidth * PROFILE_SCALE * 4),
      destination,
    );
  }
}
