import { productionOrigin, indexableDeployment } from "./site-config";
// Canonicals identify the official site; only production build contexts index.
export const siteUrl = productionOrigin;
export const isIndexable = indexableDeployment(
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_PREVIEW,
  {
    pages: process.env.CF_PAGES,
    pagesBranch: process.env.CF_PAGES_BRANCH,
    workers: process.env.WORKERS_CI,
    workersBranch: process.env.WORKERS_CI_BRANCH,
  },
);
export const tools = {
  "pending-follow-requests": {
    name: "Pending requests",
    title: "Review the Instagram follow requests you sent.",
    description:
      "See sent follow requests recorded in your Instagram export, with dates and ages when available. The export cannot confirm which requests are still pending today.",
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
    title: "Review accounts you unfollowed on Instagram.",
    description:
      "See your own recently-unfollowed records when Instagram includes them in your export. This is not a list of people who unfollowed you.",
    mode: "history",
    category: "followers",
    question: "Is this a list of people who unfollowed me?",
    answer:
      "No. It is the export's record of accounts you recently unfollowed. The list may cover a limited period and does not prove the current relationship state.",
  },
  "relationship-timeline": {
    name: "Relationship timeline",
    title: "Explore your recorded Instagram follow dates.",
    description:
      "Explore dated follower and following relationships in your Instagram export by year or month. This is not a record of historical follower totals.",
    mode: "timeline",
    category: "followers",
    question: "Does this show my follower count over time?",
    answer:
      "No. It groups dates for relationships present in this export. Missing dates and relationships that ended are not reconstructed. Compare two snapshots for changes in totals.",
  },
  "followers-analyzer": {
    name: "Followers analyzer",
    title: "Your Instagram followers, explained.",
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
    title: "Who doesn’t follow you back on Instagram?",
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
    title: "See who you follow on Instagram.",
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
    title: "Review your Instagram circle.",
    description:
      "Explore one-way and dated follows, sent requests, your own unfollow history and mutuals. Build one private shortlist and decide what to do yourself.",
    mode: "cleaner",
    category: "notFollowingBack",
    question: "Will InstaCleaner unfollow accounts for me?",
    answer:
      "No. Select and export a review list, then open profiles and make changes yourself on Instagram. InstaScope never controls your account or judges which relationships to keep.",
  },
  "snapshot-comparison": {
    name: "Compare snapshots",
    title: "Compare your Instagram followers between exports.",
    description:
      "Compare two Instagram exports to see added and missing followers, following changes and mutuals. The files cannot tell why or exactly when a relationship changed.",
    mode: "comparison",
    category: "followers",
    question: "Can you tell exactly when someone left?",
    answer:
      "No. We can only show presence or absence in the two exports you provide. Renames, deactivations, and incomplete exports can also explain differences.",
  },
  "instagram-wrapped": {
    name: "Instagram Wrapped",
    title: "Your Instagram Wrapped, from your export.",
    description:
      "Browse shareable stories about your circle, recorded follow dates and changes between exports when the data supports them. No usernames on the cards.",
    mode: "wrapped",
    category: "followers",
    question: "What will be on my share card?",
    answer:
      "Choose from the stories your data supports: circle, recorded dates, year cohorts and changes between two exports. Cards contain aggregate facts only, with no usernames or private connection lists.",
  },
  "profile-picture-viewer": {
    name: "Profile picture viewer",
    title: "View a publicly available Instagram profile photo.",
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
export const primaryTools: ToolSlug[] = [
  "pending-follow-requests",
  "relationship-timeline",
  "unfollow-history",
  "followers-analyzer",
  "not-following-back",
  "following-analyzer",
  "instagram-cleaner",
  "snapshot-comparison",
  "instagram-wrapped",
  "profile-picture-viewer",
  "connection-privacy",
];
