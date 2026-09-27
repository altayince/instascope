import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { normalizeStaticSegments } from "./normalize-static-segments.mjs";
const require = createRequire(import.meta.url);
const build = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build", "--webpack"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: "https://instascope.me",
      NEXT_PUBLIC_PREVIEW: "false",
    },
  },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
console.log(
  `Static RSC paths normalized: ${await normalizeStaticSegments(resolve("out"))}`,
);
