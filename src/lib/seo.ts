import type { Metadata } from "next";
import { productionOrigin } from "./site-config";
export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const url = `${productionOrigin}${path}`;
  const images = [
    {
      url: `${productionOrigin}/opengraph-image.png`,
      width: 1200,
      height: 630,
      alt: "InstaScope — private Instagram export analysis",
    },
  ];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | InstaScope`,
      description,
      url,
      type: "website",
      siteName: "InstaScope",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | InstaScope`,
      description,
      images: images.map((image) => image.url),
    },
  };
}
export function breadcrumbData(name: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "InstaScope",
        item: `${productionOrigin}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name,
        item: `${productionOrigin}${path}`,
      },
    ],
  };
}
export function applicationData(
  name: string,
  description: string,
  path: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${name} | InstaScope`,
    description,
    url: `${productionOrigin}${path}`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript and a modern web browser",
    isAccessibleForFree: true,
  };
}
