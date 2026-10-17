import Link from "next/link";
import { Breadcrumbs, StructuredData } from "@/components/structured-data";
import { applicationData } from "@/lib/seo";
import { whatsappProducts } from "@/lib/whatsapp/public-content";

type Mode = keyof typeof whatsappProducts;

const help: Record<
  Mode,
  {
    heading: string;
    paragraphs: string[];
    example: string;
    links: { href: string; label: string }[];
  }
> = {
  overview: {
    heading: "What can a WhatsApp chat export tell you?",
    paragraphs: [
      "Open one exported conversation to explore message counts, recorded activity, participant-label shares and supported media markers. Chat Analyzer can filter by recorded date and participant without changing the source export. The weekday/hour heatmap describes exported messages, not when somebody was online.",
      "Make anonymous Wrapped cards from the supplied facts, or explicitly save aggregate snapshots in Chat Vault. Your working chat stays in this tab's memory; refreshing or clearing discards it. No WhatsApp login or archive upload is required.",
    ],
    example:
      "The fictional demo above contains 24 messages across 8 active dates, 3 exported labels and 4 recognized media messages. Those counts describe that invented export only; they are not usage figures or claims about a real conversation.",
    links: [
      {
        href: "/whatsapp/guides/export-whatsapp-chat/",
        label: "Export one conversation as text",
      },
      { href: "/whatsapp/chat-analyzer/", label: "Explore Chat Analyzer" },
      { href: "/whatsapp/wrapped/", label: "Create WhatsApp Wrapped" },
      {
        href: "/whatsapp/chat-vault/",
        label: "Keep local aggregate snapshots",
      },
    ],
  },
  analyzer: {
    heading: "How WhatsApp Chat Analyzer reads your export",
    paragraphs: [
      "Choose a TXT or a supported ZIP containing one conversation, review its detected date format and confirm before analysis. The Chat Export Doctor explains the source's format and coverage. Date and participant filters recompute the selected subset locally; the Doctor continues to describe the original file.",
      "Explore the activity calendar, year/month charts, recorded weekday/hour heatmap, participant counts, supported media and emoji, and local word frequencies. A participant label is not a verified identity. System events are not attributed to a person without source evidence. Recorded gaps and adjacent messages do not establish reply times, read receipts or relationship meaning.",
    ],
    example:
      "In a fictional selection with two messages on Monday at 09 and one on Tuesday at 18, those two heatmap cells contain 2 and 1. All other cells are zero. No timezone or online-presence history is inferred.",
    links: [
      {
        href: "/whatsapp/guides/chat-activity-heatmap/",
        label: "Read the recorded activity heatmap",
      },
      {
        href: "/whatsapp/guides/analyze-group-chat/",
        label: "Understand group participant counts",
      },
      {
        href: "/whatsapp/guides/word-and-emoji-analysis/",
        label: "Interpret words and emoji carefully",
      },
      {
        href: "/whatsapp/guides/chat-export-not-working/",
        label: "Troubleshoot format or coverage problems",
      },
    ],
  },
  wrapped: {
    heading: "Make WhatsApp Wrapped from recorded chat facts",
    paragraphs: [
      "Open a supported chat export or try the fictional demo to create a phone-sized deck from full-export counts and recorded dates. Preview each available card, download an individual PNG or save the deck as a ZIP. Cards use the same local rendering as the preview; no third-party AI or image service receives your chat.",
      "Participant names are anonymized in standard share cards. Optional message-derived word cards remain off until you enable them: words can reveal private context even without names, so review every card before sharing. Missing evidence is kept unavailable rather than turned into a personality, compatibility or relationship claim.",
    ],
    example:
      "A fictional 24-message export with 8 active dates can support count and date cards. It cannot establish who cares more, who read a message or why a conversation changed. A story deck is a summary of supplied records, not WhatsApp's complete account history.",
    links: [
      {
        href: "/whatsapp/guides/create-whatsapp-wrapped/",
        label: "Preview and download Wrapped cards",
      },
      {
        href: "/whatsapp/guides/message-and-media-statistics/",
        label: "Understand the counts behind the cards",
      },
      {
        href: "/whatsapp/guides/chat-analysis-privacy/",
        label: "Review privacy before sharing",
      },
    ],
  },
  vault: {
    heading: "What Chat Vault saves — and what it leaves out",
    paragraphs: [
      "Chat Vault saves anonymous full-export aggregates only after you choose to save a snapshot in Chat Analyzer. Message bodies, participant identities, contact details and chat fingerprints are not stored. Reloading can restore the saved aggregate record, but it cannot reopen the original chat or rebuild its messages. Keep your original export privately if you need to analyze it again.",
      "Download a local JSON backup to keep a copy outside this browser. Restore validates the backup and previews additions and existing IDs. Only confirmation merges the records locally, rechecking conflicts and keeping existing entries. A Chat Vault backup is not a WhatsApp, iCloud or Google Drive backup and cannot restore conversations into WhatsApp.",
      "Choose two saved snapshots deliberately and confirm they describe the same conversation before comparison. The comparison shows full-export totals, coverage limits and aggregate differences. It does not identify new individual messages, infer a time period or establish why totals changed. Browser storage can be cleared or unavailable; there is no account or cloud sync.",
    ],
    example:
      "Suppose two fictional snapshots contain 120 and 150 exported messages. Their totals differ by 30. That does not prove 30 new messages were sent: the supplied files may cover different periods or omit records. Neither snapshot contains a participant name or message body.",
    links: [
      {
        href: "/whatsapp/chat-analyzer/",
        label: "Open a chat and explicitly save a snapshot",
      },
      {
        href: "/whatsapp/guides/backup-and-restore-chat-snapshots/",
        label: "Save, reload, back up and restore aggregates",
      },
      {
        href: "/whatsapp/guides/compare-chat-exports/",
        label: "Compare two chat export snapshots",
      },
      {
        href: "/whatsapp/guides/chat-analysis-privacy/",
        label: "Review local storage and privacy",
      },
    ],
  },
};

/** Server-authored public explanation. Never accepts a loaded chat or snapshot. */
export function WhatsAppPublicHelp({ mode }: { mode: Mode }) {
  const product = whatsappProducts[mode];
  const content = help[mode];
  return (
    <section
      className="prose wa-public-help"
      aria-label="Tool explanation and limitations"
    >
      <Breadcrumbs name={product.title} path={product.path} prefetch={false} />
      <StructuredData
        value={applicationData(
          product.title,
          product.description,
          product.path,
        )}
      />
      <h2 id="wa-public-help-title">{content.heading}</h2>
      {content.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <h3>Fictional example</h3>
      <p>{content.example}</p>
      <nav aria-label="WhatsApp help and next steps">
        <ul>
          {content.links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} prefetch={false}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <p>
          <Link href="/whatsapp/guides/" prefetch={false}>
            Browse all WhatsApp guides
          </Link>
        </p>
      </nav>
    </section>
  );
}
