import type { Metadata } from "next";
export function whatsappMetadata(title: string, description: string): Metadata {
  return {
    title: { absolute: `${title} | WhatsAppScope` },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      siteName: "WhatsAppScope",
      type: "website",
      images: [],
    },
    twitter: { card: "summary", title, description, images: [] },
  };
}
