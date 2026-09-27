import type { MetadataRoute } from "next";
import { siteUrl, isIndexable } from "@/lib/site";
import { publicPaths } from "@/lib/public-paths";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexable) return [];
  return publicPaths.map((path) => ({ url: `${siteUrl}${path}` }));
}
