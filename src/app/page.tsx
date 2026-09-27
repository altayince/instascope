import Link from "next/link";
import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";
import { tools, type ToolSlug } from "@/lib/site";
import { demoSnapshots } from "@/lib/demo";
import { analyze } from "@/lib/analysis/relationships";
import { DemoButton } from "@/components/demo-button";
import { pageMetadata } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
export const metadata: Metadata = pageMetadata(
  "Private Instagram Export Analyzer",
  "Understand followers, mutuals and one-way connections from your Instagram export. Free browser-local analysis, no Instagram login required.",
  "/",
);
export default function Home() {
  const preview = analyze(demoSnapshots().newer);
  const acquisitionTools: ToolSlug[] = [
    "not-following-back",
    "followers-analyzer",
    "profile-picture-viewer",
    "instagram-cleaner",
    "snapshot-comparison",
    "instagram-wrapped",
    "following-analyzer",
  ];
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
            <i /> YOUR CIRCLE, IN PERSPECTIVE
          </span>
          <h1>
            Your Instagram data.
            <br />
            <em>Actually useful.</em>
          </h1>
          <p>
            Analyze your Instagram followers, mutuals and one-way follows. Free,
            without your Instagram password. Your export is processed locally in
            your browser.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#tool">
              Upload Instagram export
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
            <span>✓ No login needed</span>
            <span>✓ Stays in your browser</span>
            <span>✓ Completely free</span>
          </div>
        </div>
        <aside
          className="result-preview"
          aria-label="Fictional demo result preview"
        >
          <span className="pill">Demo data · Fictional example</span>
          <h2>A clearer circle.</h2>
          <div className="preview-counts">
            {[
              ["Followers", preview.followers.length],
              ["Following", preview.following.length],
              ["Mutuals", preview.mutuals.length],
              ["Not following back", preview.notFollowingBack.length],
            ].map(([label, count]) => (
              <div key={label}>
                <strong>{count.toLocaleString("en-US")}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p>
            These sample numbers are not your account. Try the demo to explore
            the lists behind them.
          </p>
          <Link href="/not-following-back/">Explore one-way connections</Link>
        </aside>
      </section>
      <section className="intro-line">
        <span className="eyebrow">A LITTLE SOCIAL DETECTIVE WORK</span>
        <h2>The answers are already in your data.</h2>
        <p>Bring your export. We’ll make it make sense.</p>
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
          <span className="eyebrow">ONE EXPORT. A FEW GOOD DISCOVERIES.</span>
          <h2>All Instagram tools.</h2>
        </div>
        <div className="feature-grid">
          {acquisitionTools.map((slug) => (
            <Link
              key={slug}
              href={`/${slug}/`}
              className={`feature-card ${slug}`}
            >
              <span className="tool-kind">
                {slug === "profile-picture-viewer"
                  ? "Public profile tool"
                  : "Uses your Instagram export"}
              </span>
              <h3>{tools[slug].name}</h3>
              <p>{tools[slug].description}</p>
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
                Explore your connections, compare snapshots, or make your
                Wrapped.
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
