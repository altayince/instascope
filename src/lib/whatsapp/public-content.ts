import { whatsappGuides } from "./guide-content.ts";
export { whatsappGuides } from "./guide-content.ts";

/** Published public education only. Never derive this registry from a chat. */
export const whatsappProducts = {
  overview: {
    path: "/whatsapp/",
    title: "WhatsApp Chat Analysis, Wrapped and Local Snapshots",
    description:
      "Analyze your WhatsApp chat export in your browser, explore recorded activity and create anonymous Wrapped cards. No login or chat upload.",
  },
  analyzer: {
    path: "/whatsapp/chat-analyzer/",
    title: "WhatsApp Chat Analyzer",
    description:
      "Explore messages, recorded activity, media markers, words and emoji from your WhatsApp export. Filter locally by date or participant label.",
  },
  wrapped: {
    path: "/whatsapp/wrapped/",
    title: "WhatsApp Wrapped from Your Chat Export",
    description:
      "Create factual WhatsApp Wrapped cards on your device. Download anonymous PNG stories or a full deck ZIP from the data your export supplies.",
  },
  vault: {
    path: "/whatsapp/chat-vault/",
    title: "WhatsApp Chat Vault: Local Snapshots and Comparison",
    description:
      "Save anonymous aggregate chat snapshots in this browser, back them up locally and compare two exports. No message storage or cloud sync.",
  },
} as const;

export const whatsappGuideHub = {
  path: "/whatsapp/guides/",
  title: "WhatsApp Export and Chat Analysis Guides",
  description:
    "Practical guides to WhatsApp text exports, recorded activity, local analysis, Wrapped and anonymous Chat Vault backups. Learn what your export can and cannot show.",
} as const;

export const whatsappGuideCatalog = Object.fromEntries(
  Object.entries(whatsappGuides).map(([slug, guide]) => [
    `whatsapp/guides/${slug}`,
    { href: `/whatsapp/guides/${slug}/`, title: guide.title },
  ]),
);

export const whatsappPublicPaths: string[] = [
  ...Object.values(whatsappProducts).map((product) => product.path),
  whatsappGuideHub.path,
  ...Object.values(whatsappGuideCatalog).map((guide) => guide.href),
];
