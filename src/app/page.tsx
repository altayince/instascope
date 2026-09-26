import Link from "next/link";
import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";
import { tools } from "@/lib/site";
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "Your Instagram data, actually useful.",
    description:
      "A little clarity for your social circle. No Instagram login required.",
    url: "/",
  },
};
export default function Home() {
  return (
    <main id="main">
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
            Find your mutuals. Spot the one-way follows.
            <br />
            Get to know your circle — without handing over your password.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#tool">
              Explore my connections <span>↗</span>
            </a>
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
        <div
          className="hero-art"
          aria-label="Illustration of a connected social circle"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <span className="orbit-dot dot-one">✳</span>
          <span className="orbit-dot dot-two">↗</span>
          <span className="orbit-dot dot-three">♡</span>
          <div className="circle-center">
            ◎<span>your circle</span>
          </div>
          <div className="floating-note note-one">
            <span>↔</span>
            <div>
              Better together<small>Find your mutuals</small>
            </div>
          </div>
          <div className="floating-note note-two">
            <span>✦</span>
            <div>
              A little clarity<small>A lot less guessing</small>
            </div>
          </div>
          <span className="art-caption">CONNECT THE DOTS.</span>
        </div>
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
          <h2>There’s more to your circle.</h2>
        </div>
        <div className="feature-grid">
          {[
            [
              "not-following-back",
              "↗",
              "Who’s on the other side?",
              "Make sense of one-way follows, without the guesswork.",
            ],
            [
              "instagram-cleaner",
              "✳",
              "Make space in your feed.",
              "A thoughtful shortlist. A fresh start. Always your decision.",
            ],
            [
              "instagram-wrapped",
              "✦",
              "Your numbers. Your story.",
              "Turn your connections into something worth sharing.",
            ],
          ].map(([slug, icon, title, copy]) => (
            <Link
              key={slug}
              href={`/${slug}/`}
              className={`feature-card ${slug}`}
            >
              <span className="feature-icon">{icon}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <span className="feature-link">
                {tools[slug as keyof typeof tools].name} →
              </span>
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
        <Link href="/privacy/">Our privacy promise ↗</Link>
      </section>
    </main>
  );
}
