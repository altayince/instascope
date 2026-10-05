import { expect, it } from "vitest";
import {
  enhancePublicPhoto,
  sharpenProfilePixels,
} from "../../src/lib/profile-enhancement";

it("preserves uniform colors and transparency, including image boundaries", () => {
  const pixels = new Uint8ClampedArray([100, 120, 140, 180, 100, 120, 140, 0]);
  expect(sharpenProfilePixels(pixels, 2, 1)).toEqual(pixels);
});
it("enhances existing contrast without modifying the source or alpha", () => {
  const pixels = new Uint8ClampedArray(3 * 3 * 4).fill(100);
  pixels[16] = pixels[17] = pixels[18] = 180;
  const original = new Uint8ClampedArray(pixels);
  const enhanced = sharpenProfilePixels(pixels, 3, 3);
  expect(enhanced[16]).toBeGreaterThan(180);
  expect(enhanced[12]).toBeLessThan(100);
  expect(pixels).toEqual(original);
  for (let offset = 3; offset < pixels.length; offset += 4)
    expect(enhanced[offset]).toBe(pixels[offset]);
});
it("clamps bright and dark edges rather than wrapping color values", () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
  expect(sharpenProfilePixels(pixels, 2, 1)).toEqual(pixels);
});
it("rejects invalid dimensions and untrusted image URLs before accessing browser APIs", async () => {
  for (const [width, height] of [
    [0, 1],
    [-1, 1],
    [1.5, 1],
    [1, 3],
  ])
    expect(() =>
      sharpenProfilePixels(new Uint8ClampedArray(4), width, height),
    ).toThrow();
  await expect(
    enhancePublicPhoto(
      "https://evil.test/photo.jpg",
      new AbortController().signal,
    ),
  ).rejects.toThrow("Untrusted image");
});
