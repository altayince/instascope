import { expect, it } from "vitest";
import {
  PLATFORM_RELEASES,
  platformReleased,
  whatsappFeatureEnabled,
  whatsappPreviewEnabled,
} from "../../src/lib/platform-config";
import { indexableDeployment } from "../../src/lib/site-config";
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

it("records the intentional release and keeps unknown platforms unreleased", () => {
  expect(PLATFORM_RELEASES).toEqual({
    instagram: "released",
    whatsapp: "released",
    facebook: "unreleased",
  });
  expect(platformReleased("instagram")).toBe(true);
  expect(platformReleased("whatsapp")).toBe(true);
  for (const platform of ["tiktok", "unknown", "toString", "__proto__", ""])
    expect(platformReleased(platform)).toBe(false);
});

it.each([undefined, "false", "true"])(
  "enables released WhatsApp in an intentional production context without opt-ins (%s)",
  (requested) => {
    expect(whatsappFeatureEnabled(requested, "false", ["main"], true)).toBe(
      true,
    );
    // Release must not turn the production dispatcher into a preview build.
    expect(whatsappPreviewEnabled(requested, "false", ["main"])).toBe(false);
  },
);

it.each([[], [""], ["HEAD"], ["   "], [" dev "], ["main"]])(
  "keeps unconfigured/invalid contexts closed (%j)",
  (...branches) => {
    expect(whatsappFeatureEnabled(undefined, undefined, branches.flat())).toBe(
      false,
    );
    expect(whatsappFeatureEnabled("true", "true", branches.flat())).toBe(false);
  },
);

it("does not mistake an unknown host for an intentional production build", () => {
  const production = indexableDeployment("https://instascope.me", "false", {
    workers: "1",
    workersBranch: undefined,
  });
  expect(production).toBe(false);
  expect(whatsappFeatureEnabled(undefined, "false", [], production)).toBe(
    false,
  );
});

it.each([undefined, "", " ", "HEAD", "dev "])(
  "rejects unknown/invalid host branches despite local Git and leaked flags (%s)",
  (branch) => {
    for (const host of [
      { workers: "1", workersBranch: branch },
      { pages: "1", pagesBranch: branch },
    ])
      expect(
        whatsappFeatureEnabled("true", "true", ["feature/task"], false, host),
      ).toBe(false);
  },
);
