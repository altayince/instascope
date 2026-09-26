export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";
export const tools = {
  "pending-follow-requests": {
    name: "Pending requests",
    title: "The requests still on your list.",
    description:
      "Review sent follow requests in your Instagram export, calculate their age, and make a manual review list.",
    mode: "pending",
    category: "followers",
    question: "Does this check whether requests are still pending?",
    answer:
      "No. It reads the export's pending requests list. Age is measured against a date you choose; Instagram may have changed since the export.",
  },
  "connection-privacy": {
    name: "Connection privacy",
    title: "Your boundaries, in one place.",
    description:
      "Review close friends, blocked accounts, restricted accounts and the accounts your story is hidden from. Everything stays in your browser.",
    mode: "privacy",
    category: "followers",
    question: "Will this change my privacy settings?",
    answer:
      "No. These are lists recorded in your export. Open profiles to review them yourself. Missing categories are shown as unavailable, and private lists are excluded from Wrapped.",
  },
  "unfollow-history": {
    name: "Your unfollow history",
    title: "The accounts you moved on from.",
    description:
      "Explore your own recently-unfollowed records and their dates from your Instagram export.",
    mode: "history",
    category: "followers",
    question: "Is this a list of people who unfollowed me?",
    answer:
      "No. It is the export's record of accounts you recently unfollowed. The list may cover a limited period and does not prove the current relationship state.",
  },
  "relationship-timeline": {
    name: "Relationship timeline",
    title: "A little history in your circle.",
    description:
      "Explore recorded follower and following dates by year or month, then discover the relationships behind each period.",
    mode: "timeline",
    category: "followers",
    question: "Does this show my follower count over time?",
    answer:
      "No. It groups dates for relationships present in this export. Missing dates and relationships that ended are not reconstructed. Compare two snapshots for changes in totals.",
  },
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
      "Choose a circle summary or a following-date story. Cards contain aggregate counts and dates only; no usernames or private connection lists. Snapshot growth appears only after comparing two exports.",
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
