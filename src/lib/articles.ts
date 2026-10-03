export type Article = {
  title: string;
  description: string;
  sections: { heading: string; paragraphs: string[] }[];
  links: { href: string; label: string }[];
};

export const articles: Record<string, Article> = {
  "how-to-see-when-someone-followed-you-on-instagram": {
    title: "How to See When Someone Followed You on Instagram",
    description:
      "You can check a recorded follower date in your Instagram export when a usable date is included. Search and sort your Followers privately with InstaScope.",
    sections: [
      {
        heading: "Check the date in your Followers records",
        paragraphs: [
          "To see when someone followed you on Instagram, look for their username in the Followers list in your own data export. If Instagram included a usable timestamp or a supported HTML date for that record, InstaScope can display it. This is the date attached to the exported relationship, not a guarantee of the first time that person ever followed you.",
          "Followers means accounts following you. Following means accounts you follow. For this question, select Followers in the analyzer; checking the other list answers a different question, even when the same username appears in both.",
        ],
      },
      {
        heading: "Can Instagram show when someone followed you?",
        paragraphs: [
          "Do not rely on Instagram's Followers screen to expose an exact follow date for every account. A current follower list is not a complete, dated history of everyone who has followed you. Instagram's interface can vary, and an account's position in a list is not evidence of a particular date.",
          "If you see a date-followed sorting option in your own Following list, that concerns accounts you followed, not the date they followed you. For a recorded incoming follower date, check the Followers records in your export instead. InstaScope cannot retrieve a missing date from a public profile or query Instagram's live relationship history.",
        ],
      },
      {
        heading: "How follower dates work in an Instagram data export",
        paragraphs: [
          "Supported JSON follower records can include a username, profile link and numeric timestamp. Supported HTML follower records can include an Instagram profile link and a visible date. InstaScope keeps usable dates associated with the correct accounts and shows them in the Followers view.",
          "JSON timestamps represent instants; the account list displays their calendar dates using UTC. Supported HTML dates have no timezone, so InstaScope preserves the recorded calendar date without claiming an exact UTC event time. Missing, malformed or unsupported dates display as Date unavailable, while the accounts remain in the list.",
          "A dated record does not establish uninterrupted following, explain an unfollow and refollow, or reveal account creation time. These files describe the supplied snapshot. They do not provide a complete history of past followers or historical follower totals.",
        ],
      },
      {
        heading: "How to check follower history using InstaScope",
        paragraphs: [
          "1. Request your own Instagram information through Accounts Center. Include both Followers and Following and choose the All time range when available. JSON is recommended; supported HTML relationship files also work. The export guide below walks through obtaining the files.",
          "2. Open Followers Analyzer and select the ZIP from your device. If you use extracted files, select every numbered followers part, such as followers_1.json and followers_2.json, together with following.json. Leaving out a followers part can leave out the account you are looking for.",
          "3. Select Followers and enter the username in Search accounts. Read the date shown beneath that account. A missing search result means the account is absent from the loaded list, not proof that it never followed you. If the row says Date unavailable, InstaScope has no usable source date to show.",
          "The archive is processed locally in your browser. You sign in to Instagram to request your information, but InstaScope does not ask for your Instagram password or upload the archive for analysis.",
        ],
      },
      {
        heading: "How to find your earliest Instagram followers",
        paragraphs: [
          "In Followers, clear the username search and choose Oldest recorded followers in the Sort accounts menu. Dated follower records appear oldest first; undated accounts stay at the end. To inspect the newest recorded dates instead, choose Newest recorded followers while keeping Followers selected.",
          "Use Explore follower dates below to open Relationship Timeline with Accounts that follow you already selected. After opening your export, the account list starts with the oldest recorded followers. Search for one username or explore the dates by year or month.",
          "The first dated result is your earliest recorded follower among the usable records in that export. It is not necessarily your first-ever follower: older relationships may be absent, an account may have followed again, or some records may have no date. Requesting All time coverage helps avoid a deliberately limited range but does not reconstruct missing history.",
        ],
      },
      {
        heading: "When you followed someone versus when someone followed you",
        paragraphs: [
          "If you ask when did someone follow me on Instagram, use their Followers record. If you ask when you followed them, use their Following record. Mutual accounts can have two different recorded dates; one direction cannot establish the date in the other direction.",
          "The separate guide on when you followed someone covers the outgoing relationship. Its oldest-follows companion also concerns people you follow. Use the Followers Analyzer link below for incoming followers and their recorded dates.",
        ],
      },
      {
        heading: "FAQ: Can I find the exact first day someone followed me?",
        paragraphs: [
          "You can inspect the date Instagram supplied for the current follower record, when present. The export does not prove that this was their first-ever follow or that they followed continuously afterward. InstaScope does not turn a recorded date into that stronger claim.",
        ],
      },
      {
        heading: "FAQ: Why does a follower say Date unavailable?",
        paragraphs: [
          "The imported record has no usable date in a supported format. InstaScope preserves the account rather than guessing from list position, another account's date or the day you uploaded the ZIP. A new export may contain different information, but cannot be guaranteed to restore that date.",
        ],
      },
      {
        heading: "FAQ: Can I check dates for someone else's followers?",
        paragraphs: [
          "This method uses your own Instagram export. Entering another person's public username cannot reveal dates for their follower relationships. InstaScope does not access private account history or offer a live follower-date lookup.",
        ],
      },
    ],
    links: [
      {
        href: "/relationship-timeline/?direction=followers",
        label: "Explore follower dates — when did someone follow you?",
      },
      {
        href: "/followers-analyzer/",
        label: "Check your recorded follower dates in Followers Analyzer",
      },
      {
        href: "/how-to-see-when-you-followed-someone-on-instagram/",
        label: "Looking for when you followed someone instead?",
      },
      {
        href: "/oldest-instagram-follows/",
        label: "Find your oldest outgoing follows instead",
      },
    ],
  },
  "how-to-view-instagram-profiles-without-an-account": {
    title: "How to View Instagram Profiles Without an Account",
    description:
      "Learn what you can see on Instagram without an account or login, what private profiles hide, and how to view an available Instagram profile picture in full size.",
    sections: [
      {
        heading: "Can you view Instagram without an account?",
        paragraphs: [
          "Sometimes, but anonymous access is not guaranteed. What you can see without an Instagram account depends on what Instagram makes publicly accessible at that time. Instagram may show limited profile information, require a login, rate-limit requests or change its public access behavior.",
          "You can try opening a public profile directly in a browser. If Instagram presents a login screen or withholds the page, InstaScope cannot remove that restriction or provide privileged access.",
        ],
      },
      {
        heading: "Viewing a public Instagram profile without logging in",
        paragraphs: [
          "A public profile may expose a username, profile image, biography or some public posts to an anonymous visitor. Instagram decides which parts are delivered, and a profile being public does not mean every visitor can always browse the complete page without logging in.",
          "If your goal is specifically the profile image, enter the username in InstaScope's Profile Picture Viewer. Its configured public lookup attempts to retrieve the image Instagram or its public infrastructure makes available; it does not browse the person's posts.",
        ],
      },
      {
        heading: "Can you view a private Instagram profile without an account?",
        paragraphs: [
          "Private posts, private stories, follower-only reels, hidden follower or following information and other follower-only content remain private. InstaScope cannot unlock them, and it does not bypass Instagram authentication or privacy controls.",
          "Anonymous access rules can also change. A page or field visible today may later require a login, and a failed anonymous request does not establish anything about the account owner.",
        ],
      },
      {
        heading: "Can you view a private Instagram profile picture?",
        paragraphs: [
          "A private Instagram account does not mean every piece of profile information is secret. Its posts and other follower-only content remain private. If Instagram makes the account's profile image publicly available, InstaScope may be able to show that image in a larger viewer.",
          "Profile-picture availability is conditional. Instagram may omit the image, require login or limit the public lookup, so a private or public account's picture is never guaranteed to load.",
        ],
      },
      {
        heading: "View an available Instagram profile picture in full size",
        paragraphs: [
          "Open the Instagram Profile Picture Viewer and enter a username, @username or profile URL. When the configured public lookup returns an available image, InstaScope displays it with zoom, square or circular preview, and fullscreen controls.",
          "InstaScope does not ask for your Instagram login or password for this lookup. Only the username you enter is sent to the configured photo service, and the result remains subject to Instagram's public delivery and rate limits.",
        ],
      },
      {
        heading: "What InstaScope cannot show",
        paragraphs: [
          "InstaScope cannot show private posts, private stories, follower-only reels, hidden follower or following lists, or other follower-only content. It cannot turn a profile image into access to the rest of an account.",
          "Be cautious with services that promise unrestricted access to private Instagram content or ask for credentials. InstaScope's viewer is limited to a profile image that public infrastructure actually supplies, when available.",
        ],
      },
    ],
    links: [
      {
        href: "/profile-picture-viewer/",
        label: "View an available Instagram profile picture",
      },
      {
        href: "/is-instagram-follower-tracker-safe/",
        label: "Review Instagram tool safety questions",
      },
    ],
  },
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
      {
        href: "/how-to-see-who-you-requested-to-follow-on-instagram/",
        label: "See the step-by-step sent-request method",
      },
    ],
  },
  "how-to-see-who-you-requested-to-follow-on-instagram": {
    title: "How to See Who You Requested to Follow on Instagram",
    description:
      "Use your Instagram export to review sent follow-request records without a password, and understand why an exported request may no longer be pending.",
    sections: [
      {
        heading: "Use your sent follow-request records",
        paragraphs: [
          "You can see accounts recorded as sent follow requests by requesting your own Instagram information and including the optional sent follow requests category. Open that export in InstaScope's Pending Requests tool to search the supplied records; no Instagram password is required for the analysis.",
          "The result describes the moment the export was prepared. A request listed there was pending at that time, but it may have been accepted, declined or cancelled since then. InstaScope does not check the account's live status or cancel requests for you.",
        ],
      },
      {
        heading: "Request an export that includes the optional list",
        paragraphs: [
          "In Instagram's Accounts Center, request a download of your information with Followers and Following plus the sent follow requests category. Choose All time and JSON when those options are available, then download the ZIP from Instagram and select it in InstaScope.",
          "If the category was not included, InstaScope reports it as missing instead of showing a misleading zero. Request a new export with that category selected; the standard Followers and Following lists cannot recreate sent requests that are absent from the download.",
        ],
      },
      {
        heading: "Review the recorded accounts yourself",
        paragraphs: [
          "Sort dated records to bring older requests into view, search for an account and then check Instagram before taking action. Export dates are evidence about the supplied file, not proof of what is pending today.",
          "The archive is analyzed locally in your browser. InstaScope does not receive your Instagram credentials, follow accounts or automatically withdraw requests.",
        ],
      },
    ],
    links: [
      {
        href: "/instagram-sent-follow-requests/",
        label: "Understand exported sent-request records",
      },
      {
        href: "/pending-follow-requests/",
        label: "Review requests in your export",
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
      {
        href: "/how-to-see-when-you-followed-someone-on-instagram/",
        label: "Check what a recorded follow date means",
      },
    ],
  },
  "how-to-see-when-you-followed-someone-on-instagram": {
    title: "How to See When You Followed Someone on Instagram",
    description:
      "Find a recorded Instagram follow date in your export, sort dated current follows and understand what the timestamp cannot prove.",
    sections: [
      {
        heading: "Look for a timestamp in your Following export",
        paragraphs: [
          "Instagram exports may attach a timestamp to an account in your current Following list. InstaScope reads supported timestamps, lets you sort recorded follows by date and places dated relationships in the Relationship Timeline. Search the list for the username when you want to check one account.",
          "If the record has no usable timestamp, the date remains unknown. InstaScope does not estimate a missing value from list order, account age or other relationships.",
        ],
      },
      {
        heading: "Interpret the recorded date carefully",
        paragraphs: [
          "A timestamp can identify the date attached to that current Following record. It does not prove that you followed the account without interruption from that day, because the export does not reconstruct every unfollow and refollow event.",
          "The date is also not necessarily the first time you ever followed that person, and it is not the creation date of either Instagram account. Supported HTML exports can include a visible date without a timezone, while JSON may provide a precise timestamp; InstaScope preserves those limits instead of inventing precision.",
        ],
      },
      {
        heading: "Find your oldest recorded current follows",
        paragraphs: [
          "Request Followers and Following with All time coverage, preferably in JSON, then select the ZIP in InstaScope. Sort the Following view oldest first or browse the Relationship Timeline by year and month. The earliest result is the oldest usable date among current relationships in that export.",
          "Analysis happens locally in your browser and does not require your Instagram password. Any undated account stays visible in the relationship lists even though it cannot be placed on the dated timeline.",
        ],
      },
    ],
    links: [
      {
        href: "/oldest-instagram-follows/",
        label: "Find your oldest recorded current follows",
      },
      {
        href: "/relationship-timeline/",
        label: "Explore recorded follow dates",
      },
      {
        href: "/how-to-see-when-someone-followed-you-on-instagram/",
        label: "Check when someone followed you instead",
      },
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
      {
        href: "/can-you-see-who-unfollowed-you-on-instagram/",
        label: "Understand what an unfollower comparison can prove",
      },
    ],
  },
  "can-you-see-who-unfollowed-you-on-instagram": {
    title: "Can You See Who Unfollowed You on Instagram?",
    description:
      "Learn what one Instagram export can show, how two follower snapshots reveal missing accounts and why that still cannot prove an intentional unfollow.",
    sections: [
      {
        heading: "One export shows current one-way relationships",
        paragraphs: [
          "A single Instagram export can show accounts in your Following list that are absent from your Followers list. InstaScope calls these accounts Not Following Back. That comparison answers who does not appear to follow you in the supplied snapshot; it does not show who unfollowed you.",
          "Someone in that result may never have followed you. A missing, incomplete or date-limited Followers file can also affect the list, so a one-export result is not evidence of a change over time.",
        ],
      },
      {
        heading: "Two comparable snapshots can show who is missing",
        paragraphs: [
          "To check follower changes, keep an older export and request a newer export from the same Instagram account with comparable Followers and Following coverage. Snapshot Comparison matches normalized usernames and can show accounts present in the older Followers list but missing from the newer one.",
          "The accurate description is missing between snapshots. The exports do not say exactly when the change happened or why. An actual unfollow is one possibility, but a username change, account deactivation or deletion, or a problem or difference in an export can produce the same observation.",
        ],
      },
      {
        heading: "InstaScope compares only the files you provide",
        paragraphs: [
          "InstaScope does not continuously monitor your Instagram account and has no access to Instagram's private account history. It analyzes the older and newer files you deliberately select, locally in your browser and without asking for your Instagram password.",
          "Use Not Following Back when you want a current relationship review. Use Snapshot Comparison when you have two valid exports and want to describe additions and absences between their recorded points in time.",
        ],
      },
    ],
    links: [
      {
        href: "/instagram-follower-changes/",
        label: "Learn how follower snapshot changes are calculated",
      },
      {
        href: "/instagram-unfollowers-without-password/",
        label: "Compare followers without sharing a password",
      },
      {
        href: "/snapshot-comparison/",
        label: "Compare two follower snapshots",
      },
      {
        href: "/not-following-back/",
        label: "Review one-way relationships in one export",
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
      {
        href: "/can-you-see-who-unfollowed-you-on-instagram/",
        label: "See what unfollower evidence actually establishes",
      },
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
