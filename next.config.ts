import type { NextConfig } from "next";
import { indexableDeployment } from "./src/lib/site-config";
import { profileEndpoint } from "./src/lib/profile-lookup";
const production = indexableDeployment(
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_PREVIEW,
  {
    pages: process.env.CF_PAGES,
    pagesBranch: process.env.CF_PAGES_BRANCH,
    workers: process.env.WORKERS_CI,
    workersBranch: process.env.WORKERS_CI_BRANCH,
  },
);
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_PROFILE_ENDPOINT: profileEndpoint(
      process.env.NEXT_PUBLIC_PROFILE_ENDPOINT,
      production,
    ),
  },
};
export default config;
