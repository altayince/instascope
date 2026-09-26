import type { MetadataRoute } from "next";
import { siteUrl, tools } from "@/lib/site";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap { return ["", ...Object.keys(tools), "privacy", "how-to-download-instagram-followers-data", "changelog"].map(path => ({ url: `${siteUrl}/${path ? `${path}/` : ""}` })); }
