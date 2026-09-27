import type { ToolSlug } from "./site";
type Content = {
  seoTitle: string;
  sections: { title: string; paragraphs: string[] }[];
  related?: ToolSlug[];
};
export const toolContent: Partial<Record<ToolSlug, Content>> = {
  "pending-follow-requests": {
    seoTitle: "See Instagram Follow Requests You Sent",
    sections: [
      {
        title: "Find sent requests recorded in your export",
        paragraphs: [
          "InstaScope reads the sent follow requests category in your own Instagram export. Search the recorded accounts and review request dates and ages where Instagram supplies timestamps. You can sort older requests first and select accounts for a manual review list.",
          "This is an export snapshot, not a live request check. A request recorded there may have been accepted, declined or cancelled since the export was created. Open the profile and check Instagram yourself before acting.",
        ],
      },
      {
        title: "Include the optional sent requests category",
        paragraphs: [
          "When you request your Instagram information, choose the All time range and JSON format if available. Include sent follow requests as well as Followers and Following. Those two relationship lists alone cannot supply pending request records.",
          "If your export does not contain the sent requests category, InstaScope marks it unavailable rather than showing zero requests. Follow the export guide below to request a new copy with the relevant category; an older export cannot reveal later changes.",
        ],
      },
      {
        title: "Review privately, without an Instagram password",
        paragraphs: [
          "The archive is read locally in your browser. InstaScope does not sign in to Instagram, send your archive to a server or cancel requests for you. Dates describe the supplied records, and request age is calculated against the reference date you choose.",
          "Relationship Review offers a separate private shortlist for accounts you want to revisit. You decide whether to change anything in Instagram after reviewing each account.",
        ],
      },
    ],
    related: ["instagram-cleaner", "relationship-timeline"],
  },
  "relationship-timeline": {
    seoTitle: "Instagram Following History & Follow Dates",
    sections: [
      {
        title: "See your oldest and newest recorded follows",
        paragraphs: [
          "The timeline groups timestamped follower and following relationships from your Instagram export by year or month. Choose a period to see the accounts behind it, or browse the oldest and newest recorded connections. The dates come from Instagram's supplied records, not from a live account lookup.",
          "It describes relationships still present in the uploaded lists. An old follow date does not mean you have continuously followed that account, and a missing date remains undated rather than being guessed.",
        ],
      },
      {
        title: "A timeline of records, not historical totals",
        paragraphs: [
          "One export cannot reconstruct how many followers you had in a past month or year. Accounts no longer in its relationship lists are not recovered by grouping current records. The chart shows dated relationships in this snapshot, with undated records called out separately.",
          "To see which accounts were added or went missing between two points, compare an older and newer export in Snapshot Comparison. Even two snapshots cannot show the exact time or reason for a change.",
        ],
      },
      {
        title: "Get useful dates from your own export",
        paragraphs: [
          "Request Followers and Following with the All time range; JSON is recommended because it can contain relationship timestamps. Some records may lack a usable date, especially in HTML exports. The timeline does not invent dates for them.",
          "Your archive is analyzed locally in your browser, with no Instagram password. If a period brings an old connection to mind, Relationship Review lets you select it for your own follow-up without changing your Instagram account.",
        ],
      },
    ],
    related: ["snapshot-comparison", "instagram-cleaner", "following-analyzer"],
  },
  "unfollow-history": {
    seoTitle: "Accounts You Recently Unfollowed on Instagram",
    sections: [
      {
        title: "Review accounts you chose to unfollow",
        paragraphs: [
          "When Instagram includes recently-unfollowed records in your export, InstaScope shows the accounts you unfollowed and their recorded dates where available. Search or sort the list to revisit your own actions. A record does not tell you whether you later followed the account again.",
          "This is your unfollow history, not a list of people who unfollowed you. It cannot identify someone else's decision from your own recently-unfollowed records.",
        ],
      },
      {
        title: "What to include in the download",
        paragraphs: [
          "Choose the All time range and JSON format when requesting your Instagram information, and include the optional recently-unfollowed category. Followers and Following alone do not contain your unfollow action history. Instagram may provide only a limited period of these records, even in an All time export.",
          "If that optional category is absent, InstaScope reports it as unavailable rather than claiming you have unfollowed nobody. Use the export guide below to check the categories in a new download.",
        ],
      },
      {
        title: "A private record for manual review",
        paragraphs: [
          "Your archive stays in your browser; no Instagram password or connection to your account is needed. InstaScope does not restore follows or take account actions on your behalf.",
          "Select accounts in Relationship Review if you want a private shortlist. Snapshot Comparison answers a separate question: which usernames are present or absent across two exports, without claiming who initiated a change.",
        ],
      },
    ],
    related: ["instagram-cleaner", "snapshot-comparison"],
  },
  "not-following-back": {
    seoTitle: "Who Doesn't Follow Me Back on Instagram? — No Login",
    sections: [
      {
        title: "What not following back means",
        paragraphs: [
          "This list contains accounts in your following export that are absent from your followers export. In plain language: you follow them, and they do not appear to follow you in the data you supplied. It can include creators, shops and friends; the tool does not judge which connections are worth keeping.",
          "For example, if you follow three accounts and two also appear among your followers, the remaining account is a one-way follow. The reverse direction is shown under Fans: people who follow you, whom you do not follow back.",
        ],
      },
      {
        title: "How the check works",
        paragraphs: [
          "Download your own Instagram information with Followers and Following, the All time range and preferably JSON. Select the ZIP above, or select both lists together. InstaScope normalizes usernames, removes duplicate account records and compares the two lists locally in your browser.",
          "Search the results, change the sorting or open a profile for your own review. To create a shortlist, use InstaCleaner and export the accounts you select. No Instagram account action is performed automatically.",
        ],
      },
      {
        title: "One-way follows and unfollowers are different",
        paragraphs: [
          "A single export cannot establish that someone previously followed you. They may never have followed you, or the export may be incomplete. Comparing an older and newer export can show which usernames disappeared from the followers list; it still does not establish why they disappeared or exactly when.",
          "Renames, deactivated accounts and different export ranges can also change what appears in a list. Treat these results as a description of the supplied snapshots, not continuous monitoring.",
        ],
      },
      {
        title: "Check your circle without sharing a password",
        paragraphs: [
          "The analyzer reads your export on your device. There is no Instagram login or archive upload to an InstaScope server. Your lists remain in tab memory until you clear them or leave the session. If you open a profile, your browser visits Instagram directly.",
          "Use a fresh export when you want an updated view. The results are not live follower counts, and InstaScope cannot reveal profile visitors or private content.",
        ],
      },
    ],
  },
  "followers-analyzer": {
    seoTitle: "Instagram Followers Analyzer — Private & No Login",
    sections: [
      {
        title: "Five views of the same social circle",
        paragraphs: [
          "Followers are accounts that follow you. Following are accounts you follow. Mutuals appear in both lists. Not following back means you follow them but they are absent from your followers list; Fans describes the opposite direction.",
          "The follower-to-following ratio divides the first count by the second. When following is zero, there is no meaningful ratio, so InstaScope shows it as unavailable. Counts always describe the uploaded lists, not a live Instagram lookup.",
        ],
      },
      {
        title: "From export files to useful results",
        paragraphs: [
          "You can upload the complete ZIP, including a media-rich archive, without manually removing photos. The browser worker reads the recognized relationship files and leaves unrelated media alone. JSON and HTML lists can also be selected together; split follower files are combined.",
          "Both Followers and Following are required. If a required list is absent or malformed, the analyzer explains what to fix instead of producing misleading empty results. Use an All time export to avoid deliberately excluding older relationships.",
        ],
      },
      {
        title: "Explore the people behind the counts",
        paragraphs: [
          "Choose a category, search by username and browse the results in pages of 50. JSON timestamps enable oldest/newest sorting; records without usable dates remain explicitly undated. The relationship timeline groups the dates that actually exist in the export.",
          "Move into Cleaner for a manual review list, compare two exports to inspect changes, or make an aggregate Wrapped card. Your dataset stays available while you navigate between tools in the same tab.",
        ],
      },
      {
        title: "Local analysis, clear limits",
        paragraphs: [
          "InstaScope requires neither your Instagram password nor a connection to your Instagram account. Parsing and relationship calculations run in your browser; the archive is not sent to a server. Clear data removes the active workspace.",
          "A snapshot cannot tell you who viewed your profile, why a relationship changed or whether an account is inactive. The analyzer only presents information supported by the supplied files.",
        ],
      },
    ],
  },
  "following-analyzer": {
    seoTitle: "Instagram Following Analyzer — No Login",
    sections: [
      {
        title: "Make your following list easier to review",
        paragraphs: [
          "Start with the accounts you chose to follow. Search for a username, sort alphabetically, or use recorded JSON dates to look at older and newer connections. You can see which relationships are mutual and which accounts do not appear in your followers export.",
          "An old follow is not automatically a bad follow. InstaScope does not assign an activity score or guess whether a person is worth following; the list gives you context for your own decisions.",
        ],
      },
      {
        title: "What the recorded dates can tell you",
        paragraphs: [
          "When Instagram supplies a timestamp for a relationship, InstaScope displays it in UTC and makes date sorting available. Missing timestamps stay unavailable, and dates embedded in localized HTML are not inferred.",
          "The timeline groups dates for relationships still present in the export. It cannot reconstruct everyone you ever followed or your historical following total. Two exports are needed to compare their totals and membership.",
        ],
      },
      {
        title: "Bring both relationship directions",
        paragraphs: [
          "Choose Followers and Following with the All time range when requesting your export. The following list supplies the accounts you follow; the followers list makes mutual and one-way analysis possible. JSON offers more date detail than HTML.",
          "Select your ZIP above or both extracted lists together. The data stays on your device. When you are ready to act, Cleaner lets you select and export a manual review list without giving InstaScope access to your Instagram account.",
        ],
      },
    ],
  },
  "instagram-cleaner": {
    seoTitle: "Instagram Relationship Review & Cleaner — No Password",
    sections: [
      {
        title: "One place to review your circle",
        paragraphs: [
          "Start with one-way follows, all following, oldest or newest recorded follows, sent requests, your own recent unfollows or mutuals. The dated views sort real timestamps supplied by the export; they do not score people or infer activity.",
          "Select accounts into one review list. Your choices survive changes to group, search and sorting. An account appearing in several groups is selected once, and the review list lets you revisit or remove it.",
        ],
      },
      {
        title: "You make every account decision",
        paragraphs: [
          "InstaCleaner never signs in to Instagram and never automatically unfollows, blocks or restricts anyone. Open a profile when you want more context, then make any changes yourself on Instagram.",
          "Being absent from your followers export is not evidence that an account is inactive or uninteresting. Many useful connections are one-way. Use the results as a review aid rather than a recommendation to remove everyone in a category.",
          "Pending requests reflect the uploaded export, not necessarily their live status. Recently-unfollowed records describe actions you took, not people who unfollowed you. Optional categories missing from the export are marked unavailable rather than empty.",
        ],
      },
      {
        title: "Export your shortlist and keep it private",
        paragraphs: [
          "The selected CSV contains usernames and profile URLs for the accounts you chose. The download is created in your browser. Keep it private unless you deliberately decide to share it.",
          "Your archive is not uploaded to InstaScope and no Instagram password is required. Start with a fresh All time export and both relationship directions. Include optional sent-request and recently-unfollowed categories to review those signals; missing categories do not mean empty lists. Changes made on Instagram will appear only in a later export.",
        ],
      },
    ],
  },
  "snapshot-comparison": {
    seoTitle: "Compare Instagram Followers Between Exports",
    sections: [
      {
        title: "Two exports, a clear account of changes",
        paragraphs: [
          "Upload your newer export first and your older export second. InstaScope compares normalized usernames and shows added or missing followers, newly followed or no-longer-followed accounts, and changes to mutual connections. Duplicate records do not create extra changes.",
          "You choose which snapshot is older. Import time is not the export date; labeling an older file as newer reverses the direction of the results. Use comparable All time exports from the same account.",
        ],
      },
      {
        title: "Missing from a snapshot is a precise statement",
        paragraphs: [
          "Missing followers means a username was in the older followers list and is absent from the newer list. That is narrower than claiming someone deliberately unfollowed you. A rename, deactivation or incomplete export may also explain the difference.",
          "The comparison does not reveal an exact departure time, check accounts continuously or fill in activity between the two snapshots. It shows what the two files establish.",
        ],
      },
      {
        title: "Counts and changes answer different questions",
        paragraphs: [
          "A positive follower delta means the newer list contains more accounts overall. It can coexist with missing accounts, because additions and removals can happen between the same two snapshots. Browse the individual change categories to understand that difference.",
          "The comparison runs locally alongside the analyzer. You can also include its aggregate follower delta on your circle Wrapped card; individual account names are excluded from that share image.",
        ],
      },
      {
        title: "Compare privately and choose what to review",
        paragraphs: [
          "Request Followers and Following in both exports, ideally with the All time range and JSON format. If either required list is missing, the comparison cannot safely calculate those changes. The export guide below explains how to request the right files.",
          "Both archives are analyzed locally in your browser, without an Instagram password. You can inspect a changed account yourself or use Relationship Review for a manual shortlist; InstaScope does not take action on your Instagram account.",
        ],
      },
    ],
    related: ["relationship-timeline", "instagram-cleaner"],
  },
  "instagram-wrapped": {
    seoTitle: "Instagram Wrapped — Relationship Stories from Your Export",
    sections: [
      {
        title: "A small story pack from your own records",
        paragraphs: [
          "Browse separate portrait cards for your current circle, recorded follow dates, a year with many surviving dated follows, and changes between two exports. Only stories supported by your supplied files appear; each downloads as a 1080 by 1920 PNG.",
          "These are export-based relationship stories, not an official Instagram annual report. A date on a current follow does not prove an uninterrupted relationship, and one export cannot reconstruct historical follower totals.",
        ],
      },
      {
        title: "Choose what you share",
        paragraphs: [
          "Wrapped cards contain aggregate counts and dates, with no individual usernames. Pending requests, blocked and restricted accounts, close friends, story visibility lists and your own unfollow history are excluded from the cards.",
          "Preview the card before downloading or sharing it. Sharing uses your browser's native share interface when available; otherwise InstaScope downloads the PNG so you can choose where to post it yourself.",
        ],
      },
      {
        title: "The available stories follow the available evidence",
        paragraphs: [
          "The timeline card needs at least one usable current-follow date. The year-cohort card needs dated follows in more than one year. Missing dates remain unknown, and a tie for the largest year resolves to the earliest year.",
          "The changes card appears only after an older and newer export have been supplied. Added and missing accounts and net deltas describe those two snapshots, without claiming exactly when or why relationships changed.",
        ],
      },
    ],
  },
  "profile-picture-viewer": {
    seoTitle: "Instagram Profile Picture Viewer — Public Photos",
    sections: [
      {
        title: "A closer look at a publicly available photo",
        paragraphs: [
          "Enter a username, @username or Instagram profile URL. When public lookup is enabled and Instagram makes the image available, InstaScope shows the supplied photo with zoom, a circular or square preview, and fullscreen controls.",
          "The resolution comes from the image Instagram publicly provides. InstaScope does not manufacture a higher-resolution original or guarantee that every account can be retrieved.",
        ],
      },
      {
        title: "Public delivery determines availability",
        paragraphs: [
          "Instagram can restrict a page, require login, omit an image or limit requests. Those cases produce an explanatory error. The viewer does not ask for Instagram credentials, follow redirects into a login flow or bypass restrictions.",
          "A private-account label does not grant access to private posts or stories. This tool only attempts to retrieve a publicly delivered profile image, and availability can change independently of InstaScope.",
        ],
      },
      {
        title: "Separate from your private export workspace",
        paragraphs: [
          "A lookup submits the username you entered to a separate photo service, when configured. A returned photo loads from Instagram's image servers. This is different from archive analysis, which reads your own files locally without uploading them.",
          "You do not need an export to try the viewer. If you want to understand your own followers, use Followers Analyzer or Not Following Back with an Instagram information export; the public-photo service is not used to analyze those lists.",
        ],
      },
    ],
  },
};
