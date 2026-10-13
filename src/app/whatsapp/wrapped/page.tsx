import { notFound } from "next/navigation";
import { WhatsAppWorkspace } from "@/components/whatsapp/workspace";
import { whatsappMetadata } from "@/lib/whatsapp/page-metadata";
export const metadata = whatsappMetadata(
  "Your chat Wrapped",
  "Create local, factual story cards from your WhatsApp chat export without sharing messages or participant names.",
);
export default function WhatsAppWrappedPage() {
  if (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== "true") notFound();
  return <WhatsAppWorkspace mode="wrapped" />;
}
