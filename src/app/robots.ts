import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", ...(process.env.NEXT_PUBLIC_SITE_URL ? { allow: "/", disallow: "/api/" } : { disallow: "/" }) }, sitemap: `${siteUrl}/sitemap.xml` }; }
