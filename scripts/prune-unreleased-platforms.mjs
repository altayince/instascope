import { execFileSync } from "node:child_process";
import { lstat, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { whatsappFeatureEnabled } from "../src/lib/platform-config.ts";
import { indexableDeployment } from "../src/lib/site-config.ts";

function currentBranch() {
  try {
    return (
      execFileSync("git", ["branch", "--show-current"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || undefined
    );
  } catch {
    // Hosts without Git must provide their build branch in the environment.
    return undefined;
  }
}

/** Remove only the gated route tree, including HTML and RSC export artifacts. */
export async function pruneUnreleasedPlatforms(
  directory,
  { environment = process.env, localBranch = currentBranch() } = {},
) {
  const hostContext = {
    pages: environment.CF_PAGES,
    pagesBranch: environment.CF_PAGES_BRANCH,
    workers: environment.WORKERS_CI,
    workersBranch: environment.WORKERS_CI_BRANCH,
  };
  const enabled = whatsappFeatureEnabled(
    environment.NEXT_PUBLIC_WHATSAPP_ENABLED,
    environment.NEXT_PUBLIC_PREVIEW,
    [
      localBranch,
      environment.CF_PAGES_BRANCH,
      environment.WORKERS_CI_BRANCH,
      environment.GITHUB_HEAD_REF,
      environment.GITHUB_REF_NAME,
    ],
    indexableDeployment(
      environment.NEXT_PUBLIC_SITE_URL,
      environment.NEXT_PUBLIC_PREVIEW,
      hostContext,
    ),
    hostContext,
  );
  if (enabled) return false;

  const output = resolve(directory);
  const target = resolve(output, "whatsapp");
  if (relative(output, target) !== "whatsapp")
    throw new Error(
      "Unreleased platform output must remain inside the export.",
    );
  try {
    await lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  // rm removes a symlink itself; it does not traverse a target outside output.
  await rm(target, { recursive: true, force: true });
  return true;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const require = createRequire(import.meta.url);
  // Match Next's production .env loading while preserving explicit build flags.
  const { loadEnvConfig } = require("@next/env");
  loadEnvConfig(process.cwd(), false);
  console.log(
    `Unreleased platform output pruned: ${await pruneUnreleasedPlatforms(resolve("out"))}`,
  );
}
