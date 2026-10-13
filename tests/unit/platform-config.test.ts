import { expect, it } from "vitest";
import { whatsappFeatureEnabled } from "../../src/lib/platform-config";
it("requires an explicit preview opt-in and a known non-main branch", () => {
  expect(whatsappFeatureEnabled("true", "true", ["dev"])).toBe(true);
  expect(
    whatsappFeatureEnabled("true", "true", [
      "feature/INS-114-whatsappscope-foundation",
      "dev",
    ]),
  ).toBe(true);
  expect(whatsappFeatureEnabled(undefined, "true", ["dev"])).toBe(false);
  expect(whatsappFeatureEnabled("true", "false", ["dev"])).toBe(false);
  expect(whatsappFeatureEnabled("true", undefined, ["dev"])).toBe(false);
  expect(whatsappFeatureEnabled("true", "true", [])).toBe(false);
  for (const branch of ["main", "refs/heads/main"])
    expect(
      whatsappFeatureEnabled("true", "true", ["feature/task", branch]),
    ).toBe(false);
});
