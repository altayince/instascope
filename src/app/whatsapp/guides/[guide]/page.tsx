import { notFound } from "next/navigation";
import { ArticlePage } from "@/components/article-page";
import { whatsappMetadata } from "@/lib/whatsapp/page-metadata";
import {
  whatsappGuides,
  whatsappGuideCatalog,
} from "@/lib/whatsapp/public-content";

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(whatsappGuides).map((guide) => ({ guide }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ guide: string }>;
}) {
  const { guide } = await params;
  const article = Object.hasOwn(whatsappGuides, guide)
    ? whatsappGuides[guide]
    : null;
  if (!article) notFound();
  const metadata = whatsappMetadata(
    article.title,
    article.description,
    `/whatsapp/guides/${guide}/`,
  );
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, type: "article" as const },
  };
}
export default async function WhatsAppGuidePage({
  params,
}: {
  params: Promise<{ guide: string }>;
}) {
  if (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== "true") notFound();
  const { guide } = await params;
  if (!Object.hasOwn(whatsappGuides, guide)) notFound();
  return (
    <ArticlePage
      slug={`whatsapp/guides/${guide}`}
      article={whatsappGuides[guide]}
      catalog={whatsappGuideCatalog}
      eyebrow="INSTASCOPE / WHATSAPP"
      hub={{ href: "/whatsapp/guides/", label: "Browse all WhatsApp guides" }}
      exportGuide={{
        href: "/whatsapp/guides/export-whatsapp-chat/",
        label: "Get the right WhatsApp chat export",
      }}
    />
  );
}
