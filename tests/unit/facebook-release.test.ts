import { expect, it } from "vitest";
import { mkdir, access, writeFile, mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  facebookFeatureEnabled,
  platformReleased,
} from "../../src/lib/platform-config";
import {
  getActivePlatform,
  getAvailablePlatforms,
} from "../../src/lib/platforms";
import { pruneUnreleasedPlatforms } from "../../scripts/prune-unreleased-platforms.mjs";

it("keeps Facebook unreleased and opt-in on identified non-main previews", () => {
  expect(platformReleased("facebook")).toBe(false);
  expect(facebookFeatureEnabled("true", "true", ["dev"])).toBe(true);
  for (const [requested, preview, branches] of [
    [undefined, "true", ["dev"]],
    ["true", "false", ["dev"]],
    ["true", "true", []],
    ["true", "true", ["HEAD"]],
    ["true", "true", ["feature/task", "main"]],
    ["true", "true", ["refs/heads/main"]],
  ] as const)
    expect(facebookFeatureEnabled(requested, preview, branches)).toBe(false);
  expect(facebookFeatureEnabled("true", "true", ["dev"], { pages: "1" })).toBe(
    false,
  );
  expect(
    facebookFeatureEnabled("true", "true", ["dev"], {
      workers: "1",
      workersBranch: "main",
    }),
  ).toBe(false);
  expect(
    getAvailablePlatforms(true, true).map((platform) => platform.id),
  ).toEqual(["instagram", "whatsapp", "facebook"]);
  expect(getActivePlatform("/facebook/", true, true).id).toBe("facebook");
  expect(getActivePlatform("/facebookish/", true, true).id).toBe("instagram");
  expect(getActivePlatform("/facebook/", true, false).id).toBe("instagram");
});
it.each([false, true])(
  "prunes Facebook HTML/RSC only outside enabled previews (preview %s)",
  async (preview) => {
    const root = resolve("test-results");
    await mkdir(root, { recursive: true });
    const output = await mkdtemp(join(root, "facebook-release-"));
    for (const platform of ["facebook", "whatsapp"]) {
      await mkdir(join(output, platform));
      await writeFile(join(output, platform, "index.html"), "synthetic HTML");
      await writeFile(join(output, platform, "index.txt"), "synthetic RSC");
    }
    await writeFile(join(output, "index.html"), "Instagram");
    await pruneUnreleasedPlatforms(output, {
      environment: {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://instascope.me",
        NEXT_PUBLIC_PREVIEW: String(preview),
        NEXT_PUBLIC_FACEBOOK_ENABLED: "true",
        NEXT_PUBLIC_WHATSAPP_ENABLED: "true",
      },
      localBranch: preview ? "dev" : "main",
    });
    if (preview)
      await expect(
        access(join(output, "facebook", "index.html")),
      ).resolves.toBeUndefined();
    else
      await expect(access(join(output, "facebook"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    await expect(access(join(output, "index.html"))).resolves.toBeUndefined();
    await expect(
      access(join(output, "whatsapp", "index.html")),
    ).resolves.toBeUndefined();
  },
);
