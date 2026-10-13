import { notFound } from "next/navigation";
import { WhatsAppWorkspace } from "@/components/whatsapp/workspace";
import { whatsappMetadata } from "@/lib/whatsapp/page-metadata";
export const metadata = whatsappMetadata(
  "Chat Analyzer",
  "Explore recorded messages, activity, links and media placeholders from your local WhatsApp export.",
);
export default function WhatsAppAnalyzerPage() {
  if (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== "true") notFound();
  return <WhatsAppWorkspace mode="analyzer" />;
}
