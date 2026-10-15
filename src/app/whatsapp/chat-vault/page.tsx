import { notFound } from "next/navigation";
import { WhatsAppWorkspace } from "@/components/whatsapp/workspace";
import { whatsappMetadata } from "@/lib/whatsapp/page-metadata";

export const metadata = whatsappMetadata(
  "Chat Vault",
  "Explicitly save anonymous aggregate chat snapshots and manage local JSON backups on this browser.",
);
export default function WhatsAppChatVaultPage() {
  if (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== "true") notFound();
  return <WhatsAppWorkspace mode="vault" />;
}
