import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/structured-data";
export const metadata: Metadata = pageMetadata(
  "What’s new",
  "Product improvements and archive compatibility updates in InstaScope, the private Instagram export analyzer.",
  "/changelog/",
);
const changes = [
  ...(process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === "true"
    ? [
        {
          issue: 144,
          title: "Prepare WhatsAppScope production release gate",
          summary:
            "A reviewed repository release state retains WhatsApp tools and the platform switcher in intentional production builds, while WhatsApp stays noindex and outside the sitemap. Preview and unknown-context protections remain. An optional production smoke and owner release/rollback checklist prepare the later launch; this change does not deploy it.",
        },
        {
          issue: 142,
          title: "Harden WhatsAppScope release paths",
          summary:
            "Pending imports no longer redirect after leaving their page. PNG download failures offer a safe retry, Vault backup operations announce progress, and empty filtered coverage stays unavailable. Cloudflare non-main branch previews reuse the enabled development build, with the existing main gate and pruning preserved. An owner-run release checklist keeps launch separate. Preview only; production remains Instagram-only.",
        },
        {
          issue: 140,
          title: "Polish WhatsAppScope group mode",
          summary:
            "Group message counts now keep source-order ties explicit across paginated rankings. Anonymous Wrapped timing cards disclose qualifying labels outside the displayed rows. Synthetic small and large groups verify full-population totals, local Vault backups and factual comparison without identity or joined/left inference. Preview only; pair mode and PNG/ZIP exports are preserved.",
        },
        {
          issue: 138,
          title: "Add WhatsApp Snapshot Compare and Conversation Pulse",
          summary:
            "Deliberately compare two locally saved full-export aggregates, with coverage and compatibility limits, normalized activity/media shares and a small deterministic Conversation Pulse. No period inference, conversation fingerprint, raw chat storage or new analytics. Preview only; Chat Vault V1 backups remain unchanged. Individual Wrapped PNG downloads and sharing no longer wait for background encoding; full-deck ZIP exports are preserved.",
        },
        {
          issue: 136,
          title: "Build privacy-safe WhatsApp Chat Vault",
          summary:
            "Explicitly save full-export aggregate snapshots locally, without message text, participant identity or chat fingerprints. Browse and delete snapshots, export a strict JSON backup, and preview before confirming an atomic import. Unreadable entries and unavailable storage are handled safely. Preview only; comparison remains a separate next task.",
        },
        {
          issue: 132,
          title: "Upgrade WhatsApp Wrapped with Analyzer V2 stories",
          summary:
            "Preview-only Wrapped turns full-export facts into varied anonymous story cards, with evidence rules and local single-card or full-deck PNG downloads. Optional message-derived words stay off until explicitly enabled. Preview and export share one renderer; no chat data is uploaded or persisted.",
        },
        {
          issue: 130,
          title: "Add WhatsApp message patterns and local content analysis",
          summary:
            "Preview-only Chat Analyzer adds selected-message runs, rolling recorded ten-minute bursts, literal question marks, text lengths, media and emoji leaderboards, and local word frequencies. Date and participant filters apply without reparsing; comparison evidence, calculation rules and unavailable states remain explicit. No chat content leaves the browser, and Wrapped stays unchanged.",
        },
        {
          issue: 128,
          title: "Add WhatsApp recorded conversation rhythm and dynamics",
          summary:
            "Preview-only Chat Analyzer describes recorded sessions, session starters, six-hour gaps and next-sender transition timing with medians, distributions and rapid transitions. Date filters recompute locally; conversation-relative dynamics are unavailable with one participant selected. No reply, read-time or relationship inference is added.",
        },
        {
          issue: 126,
          title: "Add WhatsApp Analyzer filters and recorded activity heatmap",
          summary:
            "Preview-only Chat Analyzer filters by recorded year, month, inclusive date range and exported participant label. Existing charts and facts recompute locally; a weekday/hour heatmap exposes exact counts. Source coverage and Wrapped remain unfiltered, and senderless events are never assigned to a participant.",
        },
        {
          issue: 122,
          title: "Match dev product visuals to current main",
          summary:
            "Development previews reuse the current main stylesheet and header geometry. Only the top-left platform identity opens the switcher; WhatsAppScope uses the same controls, surfaces and story palettes. Independent main/dev screenshot and computed-style comparisons guard desktop and mobile parity.",
        },
        {
          issue: 120,
          title: "Support verified WhatsApp exports and add Chat Export Doctor",
          summary:
            "Preview-only WhatsAppScope checks export structure locally before explicit format confirmation, supports verified two-digit years and German record markers, and shows factual source coverage without message samples. Ambiguous dates require a choice; archive safety limits and production isolation stay intact.",
        },
        {
          issue: 118,
          title: "Restore the shared original InstaScope visual theme",
          summary:
            "Instagram and WhatsAppScope share the original InstaScope colors and controls again. Platform identity and navigation remain distinct; local analysis, share cards and development-only release protection are preserved.",
        },
        {
          issue: 116,
          title: "Add Cloudflare Worker Previews configuration",
          summary:
            "Development previews have a dedicated static-site configuration, separate from the production photo and analytics services. No production routes or service bindings are added.",
        },
        {
          issue: 114,
          title: "Build dev-only WhatsAppScope product foundation",
          summary:
            "Preview-only WhatsAppScope adds local chat TXT/ZIP analysis and factual shareable cards, with a distinct green identity in the shared product family. An explicit release gate keeps its routes and platform switcher out of production; Instagram tools remain unchanged.",
        },
      ]
    : []),
  {
    issue: 134,
    title: "Audit production traffic with private coarse attribution",
    summary:
      "Product events gain coarse referring-source and automation hints without URLs, search queries, cookies or identifiers. One document-entry observation measures JavaScript execution, not unique visitors. The collector remains compatible with older tabs; rollout requires the analytics Worker first.",
  },
  {
    issue: 112,
    title: "Finish park-ready product utilities",
    summary:
      "Download the full filtered account list as a browser-local CSV, including results beyond the current page. Cleaner selected exports stay separate. After saving a real snapshot, download a 30-day calendar event for your next export; InstaScope sends no notification and stores no reminder.",
  },
  {
    issue: 110,
    title: "Enable privacy-safe aggregate product analytics",
    summary:
      "Measure real import, snapshot, Wrapped and public-photo actions using first-party event names only. Demo use stays separate from real outcome metrics; Do Not Track, no identifiers and no private export payloads protect your data. Analytics failures never block the tools.",
  },
  {
    issue: 108,
    title: "Audit and support safe relationship archive extras",
    summary:
      "Review recent sent-request records and profiles removed from suggestions, with explicit missing, empty and unreadable states. These local export lists stay separate from pending requests, unfollow actions and saved snapshots; source dates never imply a live state or a known resolution time.",
  },
  {
    issue: 106,
    title: "Export Doctor: factual local export diagnostics",
    summary:
      "See which relationship files were combined, usable recorded-date coverage, optional list availability and supported analyses. Aggregate facts stay in active memory. Consistent HTML generation minutes are labelled with source scope; requested range and safe rename identity remain unverified. Existing tools and saved-data formats are unchanged.",
  },
  {
    issue: 104,
    title: "Align navigation, polish backups and read HTML connection lists",
    summary:
      "Header links and native menu triggers now share consistent alignment. Vault and Review Memory use one accessible backup picker with clear filenames. Instagram HTML relationship records support nested wrappers and explicitly labelled account tables while preserving date precision, privacy and missing/empty/unsupported distinctions.",
  },
  {
    issue: 102,
    title: "Circle Pulse and local Vault intelligence",
    summary:
      "Explore stable membership, observed state changes, reappeared accounts and retention across a selected saved-history range. Latest-interval facts, private relationship details and two optional aggregate Wrapped stories are derived locally without changing Vault backups or treating snapshots as continuous monitoring.",
  },
  {
    issue: 100,
    title: "Review Memory and Watch Circle with local-only persistence",
    summary:
      "Keep, Reviewed, Watch and private notes now stay in a separate browser-local memory. Manage decisions from relationship details, filter Cleaner across sessions and review watched observations only after a dated same-account comparison. Private backups, explicit deletion and fictional demo isolation preserve Vault records, shared output and SEO behavior.",
  },
  {
    issue: 98,
    title: "Product UI refresh for a coherent relationship workspace",
    summary:
      "Grouped navigation, supported Dashboard insights and a local Relationship Drawer make the existing tools easier to explore. Clearer account rows, review controls, Vault actions and truthful upload feedback preserve browser-local processing, saved-history confirmation and all existing analysis and SEO behavior.",
  },
  {
    issue: 96,
    title: "Clean up insight CTAs and enrich Relationship Timeline",
    summary:
      "Followers keeps its follower-date insight; mutual origins is discovered from Mutuals. Inspect one account’s active-export summary, observed saved history and supported optional context inside Timeline. Dates, same-account confirmation and source labels keep claims factual; Vault fields and shared stories are unchanged.",
  },
  {
    issue: 94,
    title:
      "Relationship context: account history across Vault and recorded mutual origins",
    summary:
      "Search observed relationship states across local Vault snapshots, add optional earlier-history context to review lists, and compare both recorded dates of current mutuals. A new aggregate Wrapped story excludes unknown dates. Observations do not establish intent, exact change times or uninterrupted following; no relationship dates are added to Vault storage.",
  },
  {
    issue: 92,
    title: "Explore every tool with fictional data or a local sample",
    summary:
      "Snapshot Vault now has four in-memory fictional snapshots, isolated from your real saved history. The photo viewer offers a local synthetic sample with the same controls and native AI upscaling. A small portion of core demo dates is intentionally unavailable to show export limits honestly.",
  },
  {
    issue: 90,
    title: "Keep a private history in Snapshot Vault",
    summary:
      "Save multiple dated follower/following snapshots locally, compare any two after confirming the same account, and review recorded totals over time. The earlier saved copy migrates automatically. Private JSON backups, confirmed replacements and deletion keep you in control; archives and private connection lists are never saved.",
  },
  {
    issue: 82,
    title: "Show native AI upscale dimensions without manufacturing HD",
    summary:
      "Optional general-purpose AI upscaling keeps its actual 4× learned output and preserves source detail with bounded tiles. Original comparison, cancellation and PNG saving remain. Face restoration is explicitly unavailable: the evaluated browser model is too large for a safe mobile default, and AI estimates are never described as an authentic HD original.",
  },
  {
    issue: 87,
    title: "Keep fictional demo review exports free of real profile links",
    summary:
      "Demo review CSVs leave profile URLs blank, matching the non-clickable fictional accounts in the app. Demo list captions now describe fictional review. Real imported accounts keep their existing profile links and deleted-account exclusions.",
  },
  {
    issue: 85,
    title: "Find focused guides and report problems safely",
    summary:
      "A grouped Guides hub and curated related links make existing educational content easier to explore. Public-photo explanations now cover local AI enhancement and its limits. Privacy copy explains local processing and public problem reports; the footer links to a safe GitHub reporting form.",
  },
  {
    issue: 83,
    title: "Explain oldest followers and incoming one-way connections",
    summary:
      "New guides show how to find oldest recorded incoming followers and use Fans for followers you do not follow back. The existing follower-changes guide now explains net changes and snapshot limits, with focused links between related questions and tools.",
  },
  {
    issue: 80,
    title: "Fit the complete profile photo in fullscreen without cropping",
    summary:
      "Fullscreen now fits the complete original or AI-enhanced photo to the screen. Preview zoom and circular clipping do not carry into fullscreen, and the selected preview settings remain intact when you exit.",
  },
  {
    issue: 78,
    title: "Restore public photos with local AI at 1080px",
    summary:
      "The basic 2× sharpening option is replaced by browser-local Real-ESRGAN super resolution with a 1080px output. Model loading and processing have visible progress and cancellation. Compare the original or save an explicitly AI-enhanced PNG; estimated detail is never presented as Instagram's original HD photo.",
  },
  {
    issue: 76,
    title: "Show public-photo progress, retry times and optional enhancement",
    summary:
      "Photo searches now show visible progress through lookup and image loading. Rate limits include a retry countdown and explain shared request, minute or daily allowances. An optional browser-local 2× smoothing and sharpening preview can be compared with the original and saved without claiming recovered HD detail.",
  },
  {
    issue: 74,
    title: "Open public profile photos in an enlarged viewer",
    summary:
      "Public photo lookup now uses Cloudflare's browser service when the direct public-page request cannot provide a verified image. Only the requested public page may load, and the viewer enlarges the available photo with zoom and fullscreen controls. Image quality remains limited to what Instagram supplies.",
  },
  {
    issue: 72,
    title: "Connect public photo lookup to production infrastructure",
    summary:
      "Production builds now target the same-origin public-photo service. The Worker has an explicit production route, native rate limiting and a configuration health check. Lookup errors distinguish unavailable infrastructure, restrictions, rate limits and timeouts; photos are shown only after profile identity and CDN checks.",
  },
  {
    issue: 70,
    title: "Bring your circle together in a private dashboard",
    summary:
      "A new Dashboard brings export counts, recorded-date coverage and grouped tools into one starting point. Navigate between tools with your loaded data intact, explore follower dates directly, and see which optional records are available. The homepage remains the public entry point.",
  },
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
