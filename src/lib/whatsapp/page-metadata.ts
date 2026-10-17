import type { Metadata } from "next";
import { pageMetadata } from "../seo";
import { isIndexable } from "../site";
import { isPublicPath } from "../public-paths";

export function whatsappMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const base = pageMetadata(title, description, path);
  const index =
    isIndexable &&
    process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === "true" &&
    isPublicPath(path);
  return {
    ...base,
    robots: { index, follow: index },
    openGraph: {
      ...base.openGraph,
      title,
      description,
      siteName: "InstaScope",
      type: "website",
      images: [],
    },
    twitter: { ...base.twitter, card: "summary", images: [] },
  };
}
