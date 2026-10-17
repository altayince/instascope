import { articles } from "./articles.ts";
import { tools } from "./site.ts";
import { platformReleased } from "./platform-config.ts";
import { whatsappPublicPaths } from "./whatsapp/public-content.ts";

export const instagramPublicPaths = [
  "/",
  ...Object.keys(tools).map((slug) => `/${slug}/`),
  ...Object.keys(articles).map((slug) => `/${slug}/`),
  "/privacy/",
  "/guides/",
  "/how-to-download-instagram-followers-data/",
  "/changelog/",
];

// Exact published URLs only: no private results, query states or unknown routes.
// This same registry is read by sitemap generation and the read-only auditor.
export const publicPaths = [
  ...instagramPublicPaths,
  ...(platformReleased("whatsapp") ? whatsappPublicPaths : []),
];
export const privatePaths = ["/dashboard/", "/snapshot-vault/"];

export function isPublicPath(path: string) {
  return publicPaths.includes(path);
}
