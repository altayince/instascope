import { expect, it } from "vitest";
import { indexableDeployment } from "../../src/lib/site-config";
it("indexes only the explicit official production build and keeps previews closed", () => {
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
});
