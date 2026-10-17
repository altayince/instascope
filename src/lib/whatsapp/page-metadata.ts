import type { Metadata } from "next";
import { pageMetadata } from "../seo";
import { isIndexable } from "../site";
import { isPublicPath } from "../public-paths";
import { productionOrigin } from "../site-config";

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
  const image = `${productionOrigin}/whatsapp-opengraph-image.png`;
  return {
    ...base,
    robots: { index, follow: index },
    openGraph: {
      ...base.openGraph,
      title,
      description,
      siteName: "InstaScope",
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: "InstaScope / WhatsApp — fictional local chat analysis example",
        },
      ],
    },
    twitter: { ...base.twitter, card: "summary_large_image", images: [image] },
  };
}
