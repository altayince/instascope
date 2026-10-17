import { notFound } from "next/navigation";
import { WhatsAppWorkspace } from "@/components/whatsapp/workspace";
import { whatsappMetadata } from "@/lib/whatsapp/page-metadata";
export const metadata = whatsappMetadata(
  "WhatsApp Chat Analyzer",
  "Explore recorded messages, activity, links and media placeholders from your local WhatsApp export.",
  "/whatsapp/chat-analyzer/",
);
export default function WhatsAppAnalyzerPage() {
  if (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== "true") notFound();
  return <WhatsAppWorkspace mode="analyzer" />;
}
