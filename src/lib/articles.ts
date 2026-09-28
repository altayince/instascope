export type Article = {
  title: string;
  description: string;
  sections: { heading: string; paragraphs: string[] }[];
  links: { href: string; label: string }[];
};

export const articles: Record<string, Article> = {
  "instagram-sent-follow-requests": {
    title: "How to see follow requests you sent on Instagram",
    description:
      "Find sent follow requests recorded in your Instagram export, learn which optional data to include and why an old record cannot confirm a request is still pending.",
    sections: [
      {
        heading: "Where can you see the requests you sent?",
        paragraphs: [
          "InstaScope can show the sent follow requests recorded in a copy of your own Instagram information. Open the Pending Requests tool with an export that includes the optional sent-requests category. You can search those records and, when dates are supplied, review older requests first.",
          "A request in that file was recorded as pending when the export was prepared. It may have been accepted, declined or cancelled afterward. The file cannot confirm today's status, so check the account on Instagram before deciding what to do.",
        ],
      },
      {
        heading: "Request the right data, then check what is missing",
        paragraphs: [
          "When downloading your Instagram information, include Followers and Following plus the optional sent follow requests category. Choose All time and JSON when available, then select the ZIP in InstaScope. The two basic relationship lists alone do not contain your sent-request records.",
          "If that optional list is absent, the tool says it was not included rather than reporting zero requests. The export guide explains how to request another copy with the relevant category. A new download is also the way to inspect a later snapshot.",
        ],
      },
      {
        heading: "Keep the review in your hands",
        paragraphs: [
          "Archive analysis happens in your browser; InstaScope does not need your Instagram password or upload the archive to inspect it. Open a profile for context and make any account changes yourself on Instagram. The tool does not cancel requests automatically.",
        ],
      },
    ],
    links: [
      {
        href: "/pending-follow-requests/",
        label: "Review sent requests in your export",
      },
    ],
  },
  "oldest-instagram-follows": {
    title: "How to find your oldest recorded Instagram follows",
    description:
      "Sort dated accounts you still follow using your Instagram export, see which follow dates are unknown and understand what an old recorded date can and cannot tell you.",
    sections: [
      {
        heading: "Who did you follow first, according to this export?",
        paragraphs: [
          "Start with the Following list in your own Instagram export. InstaScope can sort its usable timestamps oldest first, and the Relationship Timeline can group the dated accounts by year or month. The first result is your oldest recorded follow among accounts still in that list, not necessarily the first person you ever followed.",
          "If an account has no usable recorded date, its date stays unknown. It cannot be placed earlier or later by guesswork. JSON timestamps identify an instant, while supported HTML dates omit the timezone; records in either format may still be undated.",
        ],
      },
      {
        heading: "What the date does not prove",
        paragraphs: [
          "A dated entry does not establish that you followed the account continuously since that day; you may have unfollowed and followed it again. Relationships that ended are not reconstructed from the current Following list.",
          "The year and month groups are counts of dated relationships in this export, not a chart of your historical follower totals. To inspect changes between two points in time, you need separate snapshots rather than one dated list.",
        ],
      },
      {
        heading: "Explore old connections privately",
        paragraphs: [
          "Request Followers and Following with All time coverage, preferably as JSON, and choose the ZIP on your device. InstaScope analyzes it in your browser without asking for an Instagram password. Use Relationship Review if an old connection deserves a closer look; any follow or unfollow decision remains yours.",
        ],
      },
    ],
    links: [
      {
        href: "/relationship-timeline/",
        label: "Explore your follow-date timeline",
      },
      { href: "/instagram-cleaner/", label: "Review old connections manually" },
    ],
  },
  "instagram-follower-changes": {
    title: "How to compare Instagram follower changes between exports",
    description:
      "Compare older and newer Instagram exports to see added or missing followers, following and mutual changes, while keeping the limits of two snapshots clear.",
    sections: [
      {
        heading: "What changed between two follower lists?",
        paragraphs: [
          "Save an older Instagram export and request a newer one from the same account. In Snapshot Comparison, provide the newer file first and the older file second. InstaScope compares normalized usernames present in each Followers and Following list, then shows accounts added to or missing from the newer snapshot.",
          "It also separates newly followed and no-longer-followed accounts, new and lost mutuals, and the overall follower and following count differences. An increase in the total can coexist with missing followers when other accounts were added.",
        ],
      },
      {
        heading: "Presence is visible; the reason is not",
        paragraphs: [
          "If a username occurs in the older Followers list but not the newer one, the precise finding is that it is missing from the newer export. The files do not establish who initiated a change, exactly when it happened or why. A rename, deactivation or incomplete export can also affect the comparison.",
          "Use comparable All time exports with both Followers and Following. Import time is not the export date, so check which file is older before loading it; reversing them reverses the direction of every change.",
        ],
      },
      {
        heading: "Compare privately, then decide what to revisit",
        paragraphs: [
          "The two archives are processed locally in your browser; InstaScope does not need your Instagram password. Keep your original downloads private. For dated relationships still present in one export, the Relationship Timeline answers a different question about recorded follow dates rather than changes between snapshots.",
        ],
      },
    ],
    links: [
      {
        href: "/snapshot-comparison/",
        label: "Compare two Instagram snapshots",
      },
      {
        href: "/relationship-timeline/",
        label: "Explore recorded follow dates",
      },
    ],
  },
  "how-to-see-who-doesnt-follow-you-back-on-instagram": {
    title: "How to see who doesn't follow you back on Instagram",
    description:
      "Compare your exported Following and Followers lists locally to find one-way follows, understand the result and review accounts yourself.",
    sections: [
      {
        heading: "Start with both lists",
        paragraphs: [
          "You need the accounts you follow and the accounts following you. A Following list alone cannot tell you whether those accounts follow back. Request Followers and Following together, using the All time date range and JSON format.",
          "Open Not Following Back and choose the ZIP from your device. InstaScope reads the relevant files in your browser. You can also select all extracted followers files and the following file together. No Instagram password is needed here.",
        ],
      },
      {
        heading: "Read the difference correctly",
        paragraphs: [
          "An account appears in Not Following Back when its username is in your Following list but absent from your Followers list. For example, if you follow sample.fern and sample.moss but only sample.fern follows you, sample.moss is the one-way connection.",
          "This describes the supplied export. It does not prove that sample.moss unfollowed you: they may never have followed you. A missing or date-limited Followers file can also make the result misleading, so check the input before acting.",
        ],
      },
      {
        heading: "Turn the result into a considered review",
        paragraphs: [
          "Search for a username, sort the list or open a profile to decide whether you still want that connection. Creators, shops and friends may all be intentional one-way follows. Reciprocity is a category, not a recommendation to unfollow.",
          "InstaCleaner helps you prepare a manual review list. InstaScope does not click Instagram controls or unfollow accounts for you. If your question is what changed over time, compare two exports instead.",
        ],
      },
    ],
    links: [
      { href: "/not-following-back/", label: "Find one-way follows" },
      { href: "/instagram-cleaner/", label: "Review your following list" },
      { href: "/snapshot-comparison/", label: "Compare two exports" },
    ],
  },
  "instagram-unfollowers-without-password": {
    title: "Instagram unfollowers without a password: what exports can show",
    description:
      "Learn how two Instagram exports reveal new and missing followers without sharing your password, and why a snapshot cannot prove an unfollow.",
    sections: [
      {
        heading: "Use exports you already control",
        paragraphs: [
          "InstaScope compares files you request from Instagram. Sign in only through Instagram's own app or website to request them; InstaScope never needs that login. For a comparison, keep an older export and request a newer one with the same categories and All time date range.",
          "In Compare Snapshots, load the newer export first, then the older export. Both must contain Followers and Following. Check which file belongs in each position: swapping them reverses the meaning of new and missing.",
        ],
      },
      {
        heading: "Missing since an earlier export is the precise result",
        paragraphs: [
          "If sample.cedar appears among the older followers but not the newer followers, the result is missing since the earlier export. The files do not explain why. A changed username or a difference in export coverage can also change the comparison.",
          "A single export can identify accounts you follow that do not appear to follow back. It cannot establish who stopped following between two dates. Likewise, a net change of minus three does not mean exactly three accounts disappeared: five missing and two new also produce minus three.",
        ],
      },
      {
        heading: "Keep a useful comparison routine",
        paragraphs: [
          "Keep the original ZIPs in a private location and label them with their actual export dates. Do not rename a file in a way that confuses when you downloaded it with when its contents were prepared. Request comparable exports at intervals that are useful to you.",
          "This is a comparison you initiate, not continuous account monitoring. InstaScope does not know what happened between exports, who viewed your profile or why a relationship changed.",
        ],
      },
    ],
    links: [
      {
        href: "/snapshot-comparison/",
        label: "Compare your follower snapshots",
      },
      { href: "/not-following-back/", label: "Analyze one export instead" },
    ],
  },
  "is-instagram-follower-tracker-safe": {
    title: "Is an Instagram follower tracker safe? Questions to ask first",
    description:
      "Check credentials, file handling, account actions and unsupported promises before choosing a follower tool. Understand InstaScope's local processing model.",
    sections: [
      {
        heading: "Identify exactly what the tool asks for",
        paragraphs: [
          "Before using a follower tool, separate three requests: selecting an export on your device, uploading that file to a service and handing over account access. They give a product different capabilities. A password, session cookie or recovery code is not needed to compare two lists of usernames.",
          "A promise of safety is not enough. Look for a clear explanation of where processing occurs, what is retained and how you can remove it. If those answers are absent, you do not have enough information to judge the product's handling of your data.",
        ],
      },
      {
        heading: "Match the promise to the evidence",
        paragraphs: [
          "A Followers and Following export can support list comparison. Those lists do not identify profile visitors, motives or a precise unfollow time. A tool claiming those results from the same input is promising more than the data establishes.",
          "Check whether account changes are manual. Reviewing a list is different from giving a service permission to perform bulk actions. InstaScope does not automate follows or unfollows.",
        ],
      },
      {
        heading: "What happens in InstaScope",
        paragraphs: [
          "Archive parsing and relationship analysis run locally in your browser. The analyzer does not transmit your archive or ask for Instagram credentials. The public profile-photo feature is separate: when configured, it sends the username you enter to a lookup service.",
          "A downloadable CSV or Wrapped image becomes a file on your device. Review it before sharing, and protect your original archive because it may contain information beyond your follower lists. Local processing does not make a shared device or a file you later publish private.",
        ],
      },
    ],
    links: [
      { href: "/privacy/", label: "Read how InstaScope handles data" },
      { href: "/followers-analyzer/", label: "Try the local analyzer" },
    ],
  },
  "how-to-analyze-instagram-data-download": {
    title: "How to analyze your Instagram data download",
    description:
      "Choose the right export files, check follower relationships and dates, and understand what to do when an Instagram archive is incomplete or unsupported.",
    sections: [
      {
        heading: "Choose the part of your archive that answers your question",
        paragraphs: [
          "For follower relationships, request Followers and Following with All time coverage. JSON is recommended for machine-readable entries and timestamps. Your full archive may contain media and messages; InstaScope's relationship tools do not need those files.",
          "Select the ZIP directly or select all extracted followers parts together with the following file. If followers are split into several files, leaving out a part changes the result. A missing list is different from an explicitly empty list.",
        ],
      },
      {
        heading: "Read the summary before exploring individual accounts",
        paragraphs: [
          "Followers are accounts listed as following you. Following is the set you follow. Mutuals occur in both sets; fans are followers absent from Following; not-following-back accounts are in Following but absent from Followers.",
          "These categories help you check the result: mutuals plus fans equals followers, and mutuals plus not-following-back equals following. Duplicate usernames are counted once in these account lists. Compare against the exported files, rather than assuming a live profile count represents the same moment.",
        ],
      },
      {
        heading: "Treat dates and optional lists as separate evidence",
        paragraphs: [
          "The relationship timeline groups timestamps attached to entries in the export. It does not reconstruct your total follower count in each past month. Entries without usable dates remain undated instead of receiving guessed dates.",
          "Optional connection files can add pending requests, privacy lists and your own recently-unfollowed entries. Their absence does not mean the corresponding Instagram list is empty. An unsupported category is reported without inventing its contents.",
        ],
      },
      {
        heading: "Recover from an import problem",
        paragraphs: [
          "If a core list is missing, request another export containing both categories or select the omitted file. For a damaged ZIP, try downloading it again. Follow the specific message shown by the importer; changing an extension from HTML to JSON does not convert a file.",
          "Keep your original download private. You can explore the fictional demo while obtaining a usable export, then replace it with your own files when ready.",
        ],
      },
    ],
    links: [
      { href: "/followers-analyzer/", label: "Analyze your export" },
      {
        href: "/relationship-timeline/",
        label: "Explore exported relationship dates",
      },
      {
        href: "/instagram-followers-json-explained/",
        label: "Understand the JSON files",
      },
    ],
  },
  "instagram-followers-json-explained": {
    title: "Instagram followers JSON explained",
    description:
      "Understand followers_1.json, following.json, username entries, timestamps and split files before using your Instagram data download for analysis.",
    sections: [
      {
        heading: "JSON is a structured file, not an app to install",
        paragraphs: [
          "A JSON export represents data as lists and named fields. You do not need to edit or execute it. InstaScope can read the relevant JSON directly from the ZIP, so extracting everything is optional.",
          "Supported exports commonly use followers_1.json (and additional numbered parts) and following.json inside a followers_and_following folder. Folder depth can vary. Select every followers part when working with extracted files.",
        ],
      },
      {
        heading: "How account entries become relationship lists",
        paragraphs: [
          "In supported followers files, string_list_data entries contain a username value and may include a profile href and timestamp. Following entries can be nested under relationships_following, with the username in title or the list entry. These are supported shapes, not a guarantee that every future export uses identical fields.",
          "InstaScope normalizes usernames and removes duplicates before comparing the two sets. A display name is not a reliable substitute for a username. If the parser cannot recognize required data, it reports the problem rather than silently treating it as zero accounts.",
        ],
      },
      {
        heading: "A timestamp is not a complete account history",
        paragraphs: [
          "Usable numeric timestamps describe dates supplied with individual entries. The analyzer can sort dated entries or group them on a timeline. Missing or invalid dates stay unknown, and an HTML export may provide fewer usable dates.",
          "The earliest dated entry in an export is only the earliest among the dated entries present. It is not proof of when the account was created or when you first used Instagram. An export is also not a log of every historical follower total.",
        ],
      },
      {
        heading: "Keep the files together and private",
        paragraphs: [
          "Do not paste follower JSON into a public issue or online formatter merely to check its shape. For this analyzer, choose the file locally. If both lists are explicitly empty, zero is a valid result; if a list is absent, provide it before interpreting the analysis.",
          "For changes over time, keep a second export with comparable coverage. Renaming or copying one file does not create an independent historical snapshot.",
        ],
      },
    ],
    links: [
      {
        href: "/followers-analyzer/",
        label: "Open your followers JSON locally",
      },
      { href: "/following-analyzer/", label: "Explore your Following list" },
    ],
  },
};
