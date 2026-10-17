import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/structured-data";
import { whatsappMetadata } from "@/lib/whatsapp/page-metadata";
import {
  whatsappGuideHub,
  whatsappGuides,
} from "@/lib/whatsapp/public-content";

export const metadata = whatsappMetadata(
  whatsappGuideHub.title,
  whatsappGuideHub.description,
  whatsappGuideHub.path,
);

export default function WhatsAppGuidesPage() {
  if (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== "true") notFound();
  return (
    <main id="main" className="prose guides-hub">
      <Breadcrumbs name={whatsappGuideHub.title} path={whatsappGuideHub.path} />
      <span className="eyebrow">INSTASCOPE / WHATSAPP</span>
      <h1>WhatsApp export and chat analysis guides</h1>
      <p>
        Start with a question about your exported conversation. These guides
        explain how to open one chat, read the recorded facts, create Wrapped
        cards and keep anonymous aggregate snapshots on your own device.
      </p>
      <p>
        Analysis uses the file you supply, not a connection to your WhatsApp
        account. Missing records, unsupported event markers and unknown
        timezones stay limitations; they are not filled in with guesses.
      </p>
      <nav aria-label="WhatsApp guide topics">
        <ul className="guide-directory">
          {Object.entries(whatsappGuides).map(([slug, guide]) => (
            <li key={slug}>
              <h2>
                <Link href={`/whatsapp/guides/${slug}/`}>{guide.title}</Link>
              </h2>
              <p>{guide.description}</p>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="WhatsApp tools">
        <h2>Ready to use your export?</h2>
        <ul>
          <li>
            <Link href="/whatsapp/chat-analyzer/">Open Chat Analyzer</Link>
          </li>
          <li>
            <Link href="/whatsapp/wrapped/">Make WhatsApp Wrapped</Link>
          </li>
          <li>
            <Link href="/whatsapp/chat-vault/">
              Manage local Chat Vault snapshots
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
