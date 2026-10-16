import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { whatsappPreviewEnabled } from "../src/lib/platform-config.ts";

/** Only an identified host production branch may normalize inherited flags. */
export function isHostedProductionBuild(environment) {
  const branches = [
    ...(environment.WORKERS_CI === "1" ? [environment.WORKERS_CI_BRANCH] : []),
    ...(environment.CF_PAGES === "1" ? [environment.CF_PAGES_BRANCH] : []),
  ];
  return branches.length > 0 && branches.every((branch) => branch === "main");
}

/** Workers Builds supplies the pushed branch; other builds keep their opt-ins. */
export function isWorkersPreviewBuild(environment, localBranch) {
  const branch = environment.WORKERS_CI_BRANCH;
  return (
    environment.WORKERS_CI === "1" &&
    typeof branch === "string" &&
    branch.length > 0 &&
    branch === branch.trim() &&
    branch !== "HEAD" &&
    whatsappPreviewEnabled("true", "true", [
      localBranch,
      environment.CF_PAGES_BRANCH,
      branch,
      environment.GITHUB_BASE_REF,
      environment.GITHUB_REF_NAME,
    ])
  );
}

function currentBranch() {
  try {
    return (
      execFileSync("git", ["branch", "--show-current"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (isWorkersPreviewBuild(process.env, currentBranch())) {
    console.log("Application build: Cloudflare non-main branch preview");
    await import("./build-development.mjs");
  } else if (isHostedProductionBuild(process.env)) {
    console.log("Application build: intentional hosted production");
    await import("./build-production.mjs");
  } else {
    console.log("Application build: default (existing release gates apply)");
    const require = createRequire(import.meta.url);
    // Retain the original separate CLI stages, including Next/.env loading in
    // the pruning CLI. Do not promote local, unknown-branch or main builds.
    for (const args of [
      [require.resolve("next/dist/bin/next"), "build", "--webpack"],
      ["scripts/normalize-static-segments.mjs"],
      ["scripts/prune-unreleased-platforms.mjs"],
    ]) {
      const step = spawnSync(process.execPath, args, { stdio: "inherit" });
      if (step.error) throw step.error;
      if (step.status !== 0) process.exit(step.status ?? 1);
    }
  }
}
