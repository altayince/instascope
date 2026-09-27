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
