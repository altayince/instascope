import { tools, type Mode, type ToolSlug } from "./site";

export type NavigationDestination = {
  href: string;
  label: string;
  tool?: ToolSlug;
};
export type ProductSection = {
  id: "circle" | "history" | "review" | "wrapped" | "more";
  label: string;
  description: string;
  links: NavigationDestination[];
};
const tool = (slug: ToolSlug): NavigationDestination => ({
  href: `/${slug}/`,
  label: tools[slug].name,
  tool: slug,
});

export const productSections: ProductSection[] = [
  {
    id: "circle",
    label: "Circle",
    description: "Followers, following and the connections you share.",
    links: [
      tool("followers-analyzer"),
      tool("following-analyzer"),
      tool("not-following-back"),
    ],
  },
  {
    id: "history",
    label: "History",
    description: "Recorded dates, saved snapshots and your own actions.",
    links: [
      tool("relationship-timeline"),
      tool("snapshot-comparison"),
      { href: "/snapshot-vault/", label: "Snapshot Vault" },
      tool("pending-follow-requests"),
      tool("unfollow-history"),
    ],
  },
  {
    id: "review",
    label: "Review",
    description: "Make a private shortlist and review your boundaries.",
    links: [tool("instagram-cleaner"), tool("connection-privacy")],
  },
  {
    id: "wrapped",
    label: "Wrapped",
    description: "Turn supported facts into stories worth sharing.",
    links: [tool("instagram-wrapped")],
  },
  {
    id: "more",
    label: "More",
    description:
      "Public utilities and practical guides, separate from your export.",
    links: [
      tool("profile-picture-viewer"),
      { href: "/guides/", label: "Guides" },
      {
        href: "/how-to-download-instagram-followers-data/",
        label: "Download your export",
      },
    ],
  },
];

export function activeProductSection(pathname: string) {
  return productSections.find((section) =>
    section.links.some((destination) => destination.href === pathname),
  )?.id;
}

export const workspaceSections: {
  label: string;
  links: { label: string; href: string; mode: Mode }[];
}[] = [
  {
    label: "Circle",
    links: [
      { label: "Overview", href: "/followers-analyzer/", mode: "analyzer" },
    ],
  },
  {
    label: "History",
    links: [
      {
        label: "Relationship timeline",
        href: "/relationship-timeline/",
        mode: "timeline",
      },
      {
        label: "Compare snapshots",
        href: "/snapshot-comparison/",
        mode: "comparison",
      },
      {
        label: "Pending requests",
        href: "/pending-follow-requests/",
        mode: "pending",
      },
      {
        label: "Your unfollow history",
        href: "/unfollow-history/",
        mode: "history",
      },
    ],
  },
  {
    label: "Review",
    links: [
      { label: "InstaCleaner", href: "/instagram-cleaner/", mode: "cleaner" },
      {
        label: "Connection privacy",
        href: "/connection-privacy/",
        mode: "privacy",
      },
    ],
  },
  {
    label: "Share",
    links: [
      { label: "My Wrapped", href: "/instagram-wrapped/", mode: "wrapped" },
    ],
  },
];
