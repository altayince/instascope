import Link from "next/link";
import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";
import { tools, type ToolSlug } from "@/lib/site";
import { demoSnapshots } from "@/lib/demo";
import { analyze, compareSnapshots } from "@/lib/analysis/relationships";
import { DemoButton } from "@/components/demo-button";
import { pageMetadata } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
export const metadata: Metadata = pageMetadata(
  "Review your Instagram relationships",
  "Review your Instagram circle, sent requests and recorded relationship dates. Compare two exports to see changes over time, privately and without a password.",
  "/",
);
const homepageTools: {
  slug: ToolSlug;
  title: string;
  description: string;
}[] = [
  {
    slug: "followers-analyzer",
    title: "Relationship overview",
    description:
      "Start with the followers, mutuals and one-way connections in your export.",
  },
  {
    slug: "pending-follow-requests",
    title: "Pending requests",
    description:
      "Review sent requests recorded in your export, with ages when dates are available.",
  },
  {
    slug: "relationship-timeline",
    title: "Relationship history",
    description:
      "Explore recorded follow dates and the current connections behind each period.",
  },
  {
    slug: "snapshot-comparison",
    title: "Changes between snapshots",
    description:
      "Bring another export later to see which connections were added or went missing.",
  },
  {
    slug: "instagram-cleaner",
    title: "Manual circle review",
    description:
      "Make a shortlist, open profiles for context and decide what to do yourself.",
  },
  {
    slug: "unfollow-history",
    title: "Your unfollow history",
    description:
      "Review records of accounts you unfollowed, if your export includes them.",
  },
  {
    slug: "instagram-wrapped",
    title: "Your circle in a story",
    description:
      "Share a card with aggregate numbers and no individual usernames.",
  },
  {
    slug: "not-following-back",
    title: "Not following back",
    description:
      "Find one-way follows in the export and decide which deserve another look.",
  },
  {
    slug: "profile-picture-viewer",
    title: "Public profile photos",
    description:
      "Look up a publicly available profile photo without an export, when lookup is available.",
  },
  {
    slug: "connection-privacy",
    title: "Private connection lists",
    description:
      "Review close friends, blocked and other lists when they are in your export.",
  },
  {
    slug: "following-analyzer",
    title: "Your following list",
    description:
      "Search the accounts you follow and sort by recorded dates when available.",
  },
];
export default function Home() {
  const demo = demoSnapshots();
  const preview = analyze(demo.newer);
  const changes = compareSnapshots(demo.older, demo.newer);
  return (
    <main id="main">
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "InstaScope",
          url: "https://instascope.me/",
        }}
      />
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">
            <i /> YOUR RELATIONSHIPS, IN PERSPECTIVE
          </span>
          <h1>
            Your Instagram circle.
            <br />
            <em>With context.</em>
          </h1>
          <p>
            Review older follows, sent requests in your export and what changed
            between snapshots. No Instagram password. Your files stay in your
            browser.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#tool">
              Review my Instagram
            </a>
            <DemoButton />
            <Link
              className="text-link"
              href="/how-to-download-instagram-followers-data/"
            >
              How does it work? <span>→</span>
            </Link>
          </div>
          <div className="trust-row">
            <span>✓ No Instagram password</span>
            <span>✓ Private in your browser</span>
            <span>✓ Your decisions stay yours</span>
          </div>
        </div>
        <aside
          className="result-preview"
          aria-label="Fictional demo result preview"
        >
          <span className="pill">Demo data · Fictional example</span>
          <h2>A circle you can revisit.</h2>
          <div className="preview-counts">
            {[
              ["Current followers", preview.followers.length],
              ["Mutual connections", preview.mutuals.length],
              ["Added between snapshots", changes.newFollowers.length],
              ["Missing between snapshots", changes.lostFollowers.length],
            ].map(([label, count]) => (
              <div key={label}>
                <strong>{count.toLocaleString("en-US")}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p>
            Two fictional snapshots. Added and missing describe the lists in
            those exports, not why or exactly when a relationship changed.
          </p>
          <div className="preview-links">
            <Link href="/relationship-timeline/">Explore recorded dates</Link>
            <Link href="/snapshot-comparison/">Compare snapshots</Link>
          </div>
        </aside>
      </section>
      <section className="intro-line">
        <span className="eyebrow">A CLOSER LOOK AT YOUR CIRCLE</span>
        <h2>More than a follower count.</h2>
        <p>
          See what is pending, revisit older connections and choose what to
          review.
        </p>
      </section>
      <Workspace />
      <div className="upload-footnote">
        <span>
          ⌑ Processed on your device. Your archive never leaves this browser.
        </span>
        <Link href="/how-to-download-instagram-followers-data/">
          Need your Instagram export? Here’s how →
        </Link>
      </div>
      <section className="features">
        <div className="section-heading">
          <span className="eyebrow">
            EXPLORE NOW. RETURN WITH ANOTHER EXPORT LATER.
          </span>
          <h2>Review your circle, your way.</h2>
        </div>
        <div className="feature-grid">
          {homepageTools.map(({ slug, title, description }) => (
            <Link
              key={slug}
              href={`/${slug}/`}
              className={`feature-card ${slug}`}
            >
              <span className="tool-kind">
                {slug === "profile-picture-viewer"
                  ? "Public profile tool"
                  : slug === "snapshot-comparison"
                    ? "Compare two Instagram exports"
                    : "Uses your Instagram export"}
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="feature-link">Open {tools[slug].name}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="how-it-works">
        <div>
          <span className="eyebrow">NO SECRET HANDSHAKE REQUIRED</span>
          <h2>
            Three steps.
            <br />A clearer picture.
          </h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Get your Instagram export</h3>
              <p>
                Choose Followers and Following, All time, and JSON in Accounts
                Center.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Drop it right here</h3>
              <p>
                We read your file locally in your browser. No password, no
                account.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Follow your curiosity</h3>
              <p>
                Review requests and recorded dates, make a manual shortlist or
                return with another export to see what changed.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="privacy-banner">
        <span aria-hidden="true">⌑</span>
        <div>
          <h2>Personal data should stay personal.</h2>
          <p>
            No Instagram login. No archive uploads. Just you and your browser.
          </p>
        </div>
        <Link href="/privacy/">Our privacy promise </Link>
      </section>
    </main>
  );
}
