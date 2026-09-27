import { expect, it } from "vitest";
import { indexableDeployment } from "../../src/lib/site-config";
it("indexes official production builds and keeps preview contexts closed", () => {
  expect(indexableDeployment("https://instascope.me", undefined)).toBe(true);
  expect(indexableDeployment("https://instascope.me/", undefined)).toBe(true);
  for (const origin of [
    undefined,
    "",
    "http://localhost:3000",
    "https://preview.workers.dev",
    "https://instascope.me.evil.test",
  ])
    expect(indexableDeployment(origin, undefined)).toBe(false);
  expect(indexableDeployment("https://instascope.me", "true")).toBe(false);
  expect(
    indexableDeployment(undefined, undefined, {
      pages: "1",
      pagesBranch: "main",
    }),
  ).toBe(true);
  expect(
    indexableDeployment(undefined, undefined, {
      workers: "1",
      workersBranch: "main",
    }),
  ).toBe(true);
  expect(
    indexableDeployment("https://instascope.me", undefined, {
      pages: "1",
      pagesBranch: "feature/INS-27-google-indexing",
    }),
  ).toBe(false);
  expect(
    indexableDeployment("https://instascope.me", undefined, {
      workers: "1",
      workersBranch: "preview",
    }),
  ).toBe(false);
  expect(indexableDeployment(undefined, undefined, { pages: "1" })).toBe(false);
  expect(
    indexableDeployment("https://preview.example", undefined, {
      pages: "1",
      pagesBranch: "main",
    }),
  ).toBe(false);
  expect(
    indexableDeployment("https://instascope.me", "true", {
      pages: "1",
      pagesBranch: "main",
    }),
  ).toBe(false);
  expect(
    indexableDeployment(undefined, undefined, {
      pages: "1",
      pagesBranch: "main",
      workers: "1",
      workersBranch: "preview",
    }),
  ).toBe(false);
});
