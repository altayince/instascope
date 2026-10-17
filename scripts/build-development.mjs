import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { normalizeStaticSegments } from "./normalize-static-segments.mjs";
import { pruneUnreleasedPlatforms } from "./prune-unreleased-platforms.mjs";
const require = createRequire(import.meta.url);
const buildEnvironment = {
  ...process.env,
  NEXT_PUBLIC_PREVIEW: "true",
  NEXT_PUBLIC_WHATSAPP_ENABLED: "true",
  NEXT_PUBLIC_FACEBOOK_ENABLED: "true",
};
const build = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build", "--webpack"],
  {
    stdio: "inherit",
    env: buildEnvironment,
  },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
console.log(
  `Static RSC paths normalized: ${await normalizeStaticSegments(resolve("out"))}`,
);
console.log(
  `Unreleased platform output pruned: ${await pruneUnreleasedPlatforms(resolve("out"), { environment: buildEnvironment })}`,
);
