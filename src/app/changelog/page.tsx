import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/structured-data";
export const metadata: Metadata = pageMetadata(
  "What’s new",
  "Product improvements and archive compatibility updates in InstaScope, the private Instagram export analyzer.",
  "/changelog/",
);
const changes = [
  {
    issue: 68,
    title: "Make recorded follower dates easier to find",
    summary:
      "The homepage, Followers overview and follower-date guide now lead directly to the incoming direction in Relationship Timeline. Clear follower-specific sorting labels explain how to search and find the oldest supplied dates without implying a complete history.",
  },
  {
    issue: 66,
    title: "Explain when someone followed you on Instagram",
    summary:
      "A dedicated guide explains recorded incoming follower dates, earliest-follower sorting and missing-date limits, with links to Followers Analyzer and the separate guide for accounts you followed.",
  },
  {
    issue: 64,
    title: "Make Wrapped a shareable relationship story pack",
    summary:
      "Colorful portrait stories reveal your social orbit, recorded eras, earliest-year mutuals and the changes behind follower totals. Swipe through cards, save a Story-sized PNG or send it through your phone's share menu. Usernames and private lists stay off the cards.",
  },
  {
    issue: 62,
    title: "Explain viewing Instagram without an account",
    summary:
      "A new guide explains the limits of anonymous public-profile access, keeps private content private and leads to the existing viewer only when a profile image is publicly available.",
  },
  {
    issue: 60,
    title: "Add three informational Instagram search guides",
    summary:
      "New guides explain how to review exported sent requests, interpret recorded follow dates and distinguish one-way relationships from followers missing between two snapshots.",
  },
  {
    issue: 58,
    title: "Keep deleted export accounts from linking to Instagram",
    summary:
      "Instagram's deleted-account sentinel remains in relationship counts and comparisons, but shared account lists now show a friendly label without unusable profile links.",
  },
  {
    issue: 56,
    title: "Add dated core HTML export parsing",
    summary:
      "Followers and Following HTML records now retain valid visible dates for sorting and timelines. HTML dates remain marked as minute-precision values without a source timezone, while missing or invalid dates stay unavailable.",
  },
  {
    issue: 53,
    title: "Make real account-list usernames clickable",
    summary:
      "Usernames from uploaded exports now open the same Instagram profile as the existing profile action. Fictional demo usernames remain plain, non-clickable text.",
  },
  {
    issue: 51,
    title: "Lock follower timestamp parsing and rendering behavior",
    summary:
      "Followers with usable timestamps in Instagram JSON exports show their recorded dates. Missing, malformed and timestamp-free HTML records continue to say that the date is unavailable.",
  },
  {
    issue: 49,
    title: "Keep fictional request and unfollow profiles inside the demo",
    summary:
      "Pending Requests and Unfollow History now label demo accounts as fictional without linking them to Instagram. Real export account links continue to work.",
  },
  {
    issue: 47,
    title: "Close All tools menu after navigation or outside taps",
    summary:
      "The shared header menu now closes when the route changes or a user taps outside it, while retaining native details behavior and Escape focus handling.",
  },
  {
    issue: 45,
    title: "Populate the fictional Connection Privacy demo",
    summary:
      "The fictional demo now shows close friends, blocked, restricted and story-hidden accounts with sample recorded dates. Real exports still distinguish missing, empty and unreadable categories.",
  },
  {
    issue: 43,
    title: "Stabilize workspace tab position across mobile routes",
    summary:
      "The workspace keeps its heading and tabs together across tool routes, then restores the tab bar to the same viewport position after a tab switch.",
  },
  {
    issue: 41,
    title: "Keep workspace position while switching tools on mobile",
    summary:
      "Workspace tabs now preserve the page position when opening another tool route, so an active review stays in view while its data remains available.",
  },
  {
    issue: 39,
    title: "V3.5–V3.7: Relationship stories and local snapshot return",
    summary:
      "Wrapped now offers factual circle, dated-history and two-export change stories as private portrait cards. A user can optionally save minimal relationship lists in this browser, then compare a newer export only after confirming it belongs to the same account. Saved snapshots can be replaced or deleted.",
  },
  {
    issue: 37,
    title: "Add three focused Instagram search-intent guides",
    summary:
      "New guides answer how to review sent follow requests, find oldest recorded follows and compare follower changes, then lead readers to the matching tools with clear export and privacy limits.",
  },
  {
    issue: 35,
    title: "V3.4: Strengthen relationship tool landing pages",
    summary:
      "The pending requests, relationship timeline, own unfollow history and snapshot comparison pages now explain their export requirements, useful results and limits more clearly, with focused links to related tools.",
  },
  {
    issue: 33,
    title: "V3.3: Redesign InstaCleaner as Relationship Review",
    summary:
      "InstaCleaner now brings one-way, dated and mutual follows together with recorded requests and your own unfollow history. One private shortlist persists across review groups, with factual context and manual account actions only.",
  },
  {
    issue: 31,
    title: "V3.2: Promote relationship review tools and polish navigation",
    summary:
      "Pending requests, relationship timeline and your own unfollow history are easier to find after upload and in navigation. Export help now explains optional categories, and the header no longer shows a pre-release badge or decorative link arrows.",
  },
  {
    issue: 29,
    title: "V3.1: Reposition homepage around relationship review",
    summary:
      "The homepage now leads with reviewing your Instagram circle, dated and pending connections, and changes between snapshots. The demo and existing tools remain available.",
  },
  {
    issue: 27,
    title: "Prepare production for Google indexing",
    summary:
      "The production build now recognizes Cloudflare's main branch automatically. Preview branches stay excluded even when they inherit the production URL setting.",
  },
  {
    issue: 24,
    title: "M7: Improve Instagram export guide",
    summary:
      "The export guide now covers iPhone, Android and desktop, highlights the required categories, date range and format, and explains how to select the downloaded ZIP.",
  },
  {
    issue: 22,
    title: "M6: Add initial organic traffic content",
    summary:
      "Five practical guides explain one-way follows, snapshot changes, tool privacy, archive analysis and followers JSON, with links to the relevant tools.",
  },
  {
    issue: 19,
    title: "M5: Improve homepage acquisition and conversion",
    summary:
      "The homepage now shows a fictional result preview, a direct demo action and all seven main tools, with clear labels for export analysis and public profile lookup.",
  },
  {
    issue: 17,
    title: "M4: Add interactive fictional demo mode",
    summary:
      "Explore the analyzer, Cleaner, comparison and Wrapped without an export. Clearly labeled fictional snapshots include dated accounts, searchable lists and demo-branded share cards.",
  },
  {
    issue: 15,
    title: "M3: Build high-intent SEO landing pages",
    summary:
      "Each main tool now explains its results, export requirements, privacy behavior and limitations in more detail while keeping the utility at the top of the page.",
  },
  {
    issue: 13,
    title: "M2: Prepare search engine indexing and structured metadata",
    summary:
      "Public pages now have consistent social previews, unique descriptions and visible breadcrumbs with accurate structured data. Preview builds stay excluded from the sitemap.",
  },
  {
    issue: 12,
    title: "M1: Prepare instascope.me production shell and navigation",
    summary:
      "Official site links now use instascope.me, all main tools are accessible from the navigation, and decorative up-right arrows have been removed. Preview builds remain excluded from indexing.",
  },
  {
    issue: 9,
    title: "M0: Validate production baseline and record V2 roadmap",
    summary:
      "All public routes now have desktop and mobile checks for missing assets and runtime errors. Static exports built on Windows include corrected navigation payload paths.",
  },
  {
    issue: 8,
    title: "Close matching INS issue whenever its task PR is closed",
    summary:
      "Repository task tracking now closes the matching issue when a task pull request closes, including work closed without merging.",
  },
  {
    issue: 6,
    title:
      "Add pending requests, privacy lists, unfollow history and relationship timeline",
    summary:
      "Review sent requests with dated age filters, inspect private connection lists, explore your own recently-unfollowed records, and group relationship dates by year or month. A new Wrapped card shares aggregate following dates. Missing optional lists are distinguished from empty lists, and all archive analysis stays local.",
  },
  {
    issue: 4,
    title:
      "Validate current Instagram exports and support large archives safely",
    summary:
      "Large media-rich ZIP exports now load through selective local reads. Relationship files retain strict size limits and gain CRC integrity checks. Current JSON export counts and account membership were verified against a real export locally.",
  },
  {
    issue: 1,
    title: "Build privacy-first InstaScope MVP and INS repository workflow",
    summary:
      "Local ZIP, JSON and HTML analysis; searchable relationships; manual Cleaner review lists; snapshot comparison; Wrapped image export; dedicated tool pages and isolated public-photo integration.",
  },
].slice(0, 10);
export default function Changelog() {
  return (
    <main id="main" className="prose">
      <Breadcrumbs name="What’s new" path="/changelog/" />
      <h1>What’s new / Neler değişti?</h1>
      {changes.map((change) => (
        <article key={change.issue}>
          <h2>
            INS-{change.issue} · {change.title}
          </h2>
          <p>{change.summary}</p>
        </article>
      ))}
    </main>
  );
}
