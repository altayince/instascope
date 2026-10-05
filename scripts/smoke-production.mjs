// Read-only public smoke check; never imports or uploads an archive.
import { checkProfileInfrastructure } from "./profile-health.mjs";
const origin =
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ||
  "https://instascope.me";
const paths = [
  "/",
  "/followers-analyzer/",
  "/not-following-back/",
  "/following-analyzer/",
  "/instagram-cleaner/",
  "/snapshot-comparison/",
  "/instagram-wrapped/",
  "/profile-picture-viewer/",
  "/privacy/",
  "/how-to-download-instagram-followers-data/",
  "/changelog/",
  "/robots.txt",
  "/sitemap.xml",
  "/icon.svg",
  "/opengraph-image.png",
];
const results = [];
for (const path of paths) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(15000),
  });
  const html = response.headers.get("content-type")?.includes("text/html")
    ? await response.text()
    : "";
  results.push({
    path,
    status: response.status,
    ...(html
      ? {
          canonical: html.match(/<link rel="canonical" href="([^"]+)"/)?.[1],
          robots: html.match(/<meta name="robots" content="([^"]+)"/)?.[1],
        }
      : {}),
  });
}
console.log(JSON.stringify(results, null, 2));
const profileLookup = await checkProfileInfrastructure(origin);
console.log(JSON.stringify({ profileLookup }, null, 2));
if (results.some((result) => result.status !== 200)) process.exitCode = 1;
if (process.argv.includes("--require-profile") && !profileLookup.ready)
  process.exitCode = 1;
