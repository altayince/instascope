import type { NextConfig } from "next";
import { indexableDeployment } from "./src/lib/site-config";
import { profileEndpoint } from "./src/lib/profile-lookup";
import { analyticsEndpoint } from "./src/lib/analytics-config";
import { whatsappFeatureEnabled } from "./src/lib/platform-config";
import { execFileSync } from "node:child_process";
let localBranch: string | undefined;
try {
  localBranch =
    execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || undefined;
} catch {
  /* A host without Git must supply its build branch explicitly. */
}
const hostContext = {
  pages: process.env.CF_PAGES,
  pagesBranch: process.env.CF_PAGES_BRANCH,
  workers: process.env.WORKERS_CI,
  workersBranch: process.env.WORKERS_CI_BRANCH,
};
const production = indexableDeployment(
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_PREVIEW,
  hostContext,
);
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_WHATSAPP_ENABLED: String(
      whatsappFeatureEnabled(
        process.env.NEXT_PUBLIC_WHATSAPP_ENABLED,
        process.env.NEXT_PUBLIC_PREVIEW,
        [
          localBranch,
          process.env.CF_PAGES_BRANCH,
          process.env.WORKERS_CI_BRANCH,
          process.env.GITHUB_BASE_REF,
          process.env.GITHUB_REF_NAME,
        ],
        production,
        hostContext,
      ),
    ),
    NEXT_PUBLIC_ANALYTICS_ENDPOINT: analyticsEndpoint(
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
      production,
    ),
    NEXT_PUBLIC_PROFILE_ENDPOINT: profileEndpoint(
      process.env.NEXT_PUBLIC_PROFILE_ENDPOINT,
      production,
    ),
  },
};
export default config;
