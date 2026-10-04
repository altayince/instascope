import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl, isIndexable } from "@/lib/site";
import { ToolNavigation } from "@/components/tool-navigation";
import { DataProvider } from "@/components/data-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "InstaScope — Your Instagram data, actually useful",
    template: "%s | InstaScope",
  },
  description:
    "Understand your Instagram connections with a private, browser-based export analyzer. No Instagram login required.",
  robots: { index: isIndexable, follow: isIndexable },
  openGraph: {
    type: "website",
    siteName: "InstaScope",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DataProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <header className="site-header">
            <Link className="brand" href="/" aria-label="InstaScope home">
              <span className="brand-mark" aria-hidden="true">
                ◎
              </span>{" "}
              insta<span>scope</span>
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/dashboard/">Dashboard</Link>
              <Link href="/pending-follow-requests/">Requests</Link>
              <Link href="/relationship-timeline/">Timeline</Link>
              <Link href="/unfollow-history/">Your unfollows</Link>
              <ToolNavigation />
            </nav>
            <span className="header-note">
              <i /> Your data stays yours
            </span>
          </header>
          {children}
          <footer>
            <Link className="brand" href="/">
              ◎ instascope
            </Link>
            <p>A little clarity for your social circle.</p>
            <div>
              <Link href="/privacy/">Privacy</Link>
              <Link href="/how-to-download-instagram-followers-data/">
                Export guide
              </Link>
              <Link href="/changelog/">What’s new</Link>
            </div>
            <small>
              Independent tool. Not affiliated with Instagram or Meta.
            </small>
          </footer>
        </DataProvider>
      </body>
    </html>
  );
}
