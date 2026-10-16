import type { Metadata } from "next";
export function whatsappMetadata(title: string, description: string): Metadata {
  return {
    title: { absolute: `${title} | InstaScope` },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      siteName: "InstaScope",
      type: "website",
      images: [],
    },
    twitter: { card: "summary", title, description, images: [] },
  };
}
