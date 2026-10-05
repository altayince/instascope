import { expect, it } from "vitest";
import { enhancePublicPhoto } from "../../src/lib/profile-enhancement";
import { profileTensor, profilePixels } from "../../src/lib/profile-ai-pixels";

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
  await expect(
    enhancePublicPhoto(
      "https://evil.test/photo.jpg",
      new AbortController().signal,
    ),
  ).rejects.toThrow("Untrusted image");
});
