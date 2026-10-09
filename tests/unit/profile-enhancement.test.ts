import { expect, it } from "vitest";
import { enhancePublicPhoto } from "../../src/lib/profile-enhancement";
import { profileTensor, profilePixels } from "../../src/lib/profile-ai-pixels";
import {
  profileTiles,
  readProfileTile,
  writeProfileTile,
} from "../../src/lib/profile-ai-tiles";

it("keeps small inputs whole and bounds larger inference tiles without shrinking source pixels", () => {
  expect(profileTiles(150, 150)).toEqual([
    {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 150,
      height: 150,
      coreWidth: 150,
      coreHeight: 150,
    },
  ]);
  for (const [width, height] of [
    [320, 320],
    [1024, 1024],
    [271, 37],
  ]) {
    const tiles = profileTiles(width, height);
    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles.every((tile) => tile.width <= 270 && tile.height <= 270)).toBe(
      true,
    );
    expect(
      tiles.reduce((area, tile) => area + tile.coreWidth * tile.coreHeight, 0),
    ).toBe(width * height);
  }
  for (const dimensions of [
    [0, 10],
    [1025, 10],
    [1.5, 20],
    [NaN, 30],
  ])
    expect(() => profileTiles(...(dimensions as [number, number]))).toThrow();
});

it("discards tile halos and stitches every learned pixel at its original output position", () => {
  const width = 321,
    height = 279;
  const source = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++)
    source.set([i % 251, Math.floor(i / width) % 251, 37, 255], i * 4);
  const output = new Uint8ClampedArray(width * height * 16 * 4);
  for (const tile of profileTiles(width, height)) {
    const input = readProfileTile(source, width, height, tile);
    const learned = new Uint8ClampedArray(tile.width * tile.height * 16 * 4);
    for (let y = 0; y < tile.height * 4; y++)
      for (let x = 0; x < tile.width * 4; x++) {
        const start = (Math.floor(y / 4) * tile.width + Math.floor(x / 4)) * 4;
        learned.set(
          input.subarray(start, start + 4),
          (y * tile.width * 4 + x) * 4,
        );
      }
    writeProfileTile(output, width, tile, learned);
  }
  for (let y = 0; y < height * 4; y++)
    for (let x = 0; x < width * 4; x++) {
      const sourceIndex = (Math.floor(y / 4) * width + Math.floor(x / 4)) * 4;
      const outputIndex = (y * width * 4 + x) * 4;
      for (let channel = 0; channel < 4; channel++)
        if (output[outputIndex + channel] !== source[sourceIndex + channel])
          throw new Error(`Incorrect stitched pixel at ${x},${y}`);
    }
});

it("rejects truncated source and tile output instead of producing incomplete images", () => {
  const tile = profileTiles(150, 150)[0];
  expect(() =>
    readProfileTile(new Uint8ClampedArray(4), 150, 150, tile),
  ).toThrow();
  expect(() =>
    writeProfileTile(
      new Uint8ClampedArray(600 * 600 * 4),
      150,
      tile,
      new Uint8ClampedArray(4),
    ),
  ).toThrow();
});

it("converts RGB pixels to normalized planar input without changing channel order", () => {
  const input = profileTensor(
    new Uint8ClampedArray([255, 0, 128, 255, 0, 255, 64, 255]),
    2,
    1,
  );
  expect(Array.from(input)).toEqual([
    1,
    0,
    0,
    1,
    Math.fround(128 / 255),
    Math.fround(64 / 255),
  ]);
});
it("converts planar model output to opaque pixels and clamps overshoots", () => {
  expect(
    profilePixels(new Float32Array([-1, 2, 1, 0, 0.5, 0.25]), 2, 1),
  ).toEqual(new Uint8ClampedArray([0, 255, 128, 255, 255, 0, 64, 255]));
});
it("rejects oversized, malformed and nonfinite model data", () => {
  expect(() => profileTensor(new Uint8ClampedArray(4), 271, 1)).toThrow();
  expect(() => profileTensor(new Uint8ClampedArray(4), 1.5, 1)).toThrow();
  expect(() => profilePixels(new Float32Array([NaN, 0, 0]), 1, 1)).toThrow();
  expect(() => profilePixels(new Float32Array(3), 1081, 1)).toThrow();
});
it("rejects untrusted image URLs before browser APIs or model downloads", async () => {
  for (const url of [
    "https://evil.test/photo.jpg",
    "/demo/arbitrary.png",
    "/demo/profile-sample.png?url=https://evil.test",
    "https://evil.test/demo/profile-sample.png",
  ])
    await expect(
      enhancePublicPhoto(url, new AbortController().signal),
    ).rejects.toThrow("Untrusted image");
});
