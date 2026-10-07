import { articles } from "./articles";

type Guide = { href: string; title: string; description: string };

// The hub catalogs educational pages; article navigation selects explicit IDs.
export const guides: Record<string, Guide> = {
  ...Object.fromEntries(
    Object.entries(articles).map(([slug, article]) => [
      slug,
      {
        href: `/${slug}/`,
        title: article.title,
        description: article.description,
      },
    ]),
  ),
  "how-to-download-instagram-followers-data": {
    href: "/how-to-download-instagram-followers-data/",
    title: "How to download your Instagram information",
    description:
      "Request the right categories and date range, then open your ZIP locally on iPhone, Android or desktop.",
  },
  "profile-picture-viewer": {
    href: "/profile-picture-viewer/",
    title: "Public profile photos and optional AI enhancement",
    description:
      "Learn how public-photo lookup, zoom, fullscreen and local enhancement work, and what they cannot recover or unlock.",
  },
  privacy: {
    href: "/privacy/",
    title: "Privacy, in plain language",
    description:
      "Understand local archive analysis, optional saved snapshots and the separate public-photo service.",
  },
};

export const guideGroups = [
  {
    id: "relationships",
    title: "Followers & Following",
    description:
      "Understand one-way connections and the follow requests you sent.",
    slugs: [
      "how-to-see-who-doesnt-follow-you-back-on-instagram",
      "how-to-see-who-follows-you-but-you-dont-follow-back-on-instagram",
      "instagram-sent-follow-requests",
      "how-to-see-who-you-requested-to-follow-on-instagram",
    ],
  },
  {
    id: "dates",
    title: "Follow Dates & History",
    description:
      "Find recorded dates in each direction, with missing-date and history limits kept clear.",
    slugs: [
      "how-to-see-when-someone-followed-you-on-instagram",
      "how-to-find-oldest-instagram-followers",
      "how-to-see-when-you-followed-someone-on-instagram",
      "oldest-instagram-follows",
    ],
  },
  {
    id: "changes",
    title: "Unfollowers & Changes",
    description:
      "Compare two snapshots and understand what additions and absences actually establish.",
    slugs: [
      "instagram-follower-changes",
      "can-you-see-who-unfollowed-you-on-instagram",
      "instagram-unfollowers-without-password",
    ],
  },
  {
    id: "exports",
    title: "Instagram Data Exports",
    description:
      "Get the right files and understand how the analyzer interprets them.",
    slugs: [
      "how-to-download-instagram-followers-data",
      "how-to-analyze-instagram-data-download",
      "instagram-followers-json-explained",
    ],
  },
  {
    id: "privacy",
    title: "Privacy & Public Profiles",
    description:
      "Keep your export private and understand the limits of public profile access.",
    slugs: [
      "how-to-view-instagram-profiles-without-an-account",
      "profile-picture-viewer",
      "is-instagram-follower-tracker-safe",
      "privacy",
    ],
  },
];
