import { notFound } from "next/navigation";
import { WhatsAppWorkspace } from "@/components/whatsapp/workspace";
import { whatsappMetadata } from "@/lib/whatsapp/page-metadata";
export const metadata = whatsappMetadata(
  "WhatsApp tools — Your chat, in perspective",
  "Review your WhatsApp chat export privately in your browser. No login or cloud upload.",
);
export default function WhatsAppPage() {
  if (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== "true") notFound();
  return <WhatsAppWorkspace mode="overview" />;
}
