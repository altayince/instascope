export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";
export const tools = {
  "followers-analyzer": {
    name: "Followers analyzer",
    title: "Your circle, a little clearer.",
    description:
      "Turn your Instagram export into a clear picture of your followers, mutuals, and one-way connections.",
    mode: "analyzer",
    category: "followers",
    question: "Does this show live follower counts?",
    answer:
      "These results describe your uploaded export. Upload a fresh All time export when you want an updated picture.",
  },
  "not-following-back": {
    name: "Not following back",
    title: "Find the one-way connections.",
    description:
      "See the accounts you follow that do not appear in your followers export. No password. No guesswork.",
    mode: "analyzer",
    category: "notFollowingBack",
    question: "Does this prove someone unfollowed me?",
    answer:
      "No. One export shows the current relationship lists in that export. Compare two snapshots to see which accounts appear or disappear, without guessing why.",
  },
  "following-analyzer": {
    name: "Following analyzer",
    title: "Make sense of your following.",
    description:
      "Explore who you follow, search your connections, and sort dated relationships from your own Instagram export.",
    mode: "analyzer",
    category: "following",
    question: "Where do follow dates come from?",
    answer:
      "Dates come from timestamps supplied by Instagram in JSON exports. If a timestamp is absent, we show Date unavailable.",
  },
  "instagram-cleaner": {
    name: "InstaCleaner",
    title: "A little room for your people.",
    description:
      "Review your following, make a shortlist, and decide who belongs in your feed. Your account, your call.",
    mode: "cleaner",
    category: "notFollowingBack",
    question: "Will InstaCleaner unfollow accounts for me?",
    answer:
      "No. Select and export a review list, then open profiles and make changes yourself on Instagram. InstaScope never controls your account.",
  },
  "snapshot-comparison": {
    name: "Compare snapshots",
    title: "See how your circle changed.",
    description:
      "Put an older and a newer export side by side. Discover added and missing connections, with the context they deserve.",
    mode: "comparison",
    category: "followers",
    question: "Can you tell exactly when someone left?",
    answer:
      "No. We can only show presence or absence in the two exports you provide. Renames, deactivations, and incomplete exports can also explain differences.",
  },
  "instagram-wrapped": {
    name: "Instagram Wrapped",
    title: "Your circle has a story.",
    description:
      "Make a shareable snapshot of your Instagram connections. Real numbers, a little personality, and no usernames on your card.",
    mode: "wrapped",
    category: "followers",
    question: "What will be on my share card?",
    answer:
      "Only aggregate counts, a ratio, and InstaScope branding. Snapshot growth appears only after you compare two exports. No individual account names are included.",
  },
  "profile-picture-viewer": {
    name: "Profile picture viewer",
    title: "A closer look. Just the public photo.",
    description:
      "Enter an Instagram username or profile link to view a photo when it is publicly available. Public access restrictions always apply.",
    mode: "profile",
    category: "followers",
    question: "Can this reveal private content?",
    answer:
      "No. This tool only attempts to read a publicly delivered profile photo. If Instagram restricts delivery, we cannot retrieve it and will say so.",
  },
} as const;
export type ToolSlug = keyof typeof tools;
export type Mode = (typeof tools)[ToolSlug]["mode"];
