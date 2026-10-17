import { notFound } from "next/navigation";
import { WhatsAppWorkspace } from "@/components/whatsapp/workspace";
import { WhatsAppPublicHelp } from "@/components/whatsapp/public-help";
import { whatsappMetadata } from "@/lib/whatsapp/page-metadata";
import { whatsappProducts } from "@/lib/whatsapp/public-content";
const product = whatsappProducts.vault;
export const metadata = whatsappMetadata(
  product.title,
  product.description,
  product.path,
);
export default function WhatsAppChatVaultPage() {
  if (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== "true") notFound();
  return (
    <WhatsAppWorkspace mode="vault">
      <WhatsAppPublicHelp mode="vault" />
    </WhatsAppWorkspace>
  );
}
