import type { Metadata } from "next";
import { siteUrl, isIndexable } from "@/lib/site";
import { PlatformShell } from "@/components/platform-shell";
import { DataProvider } from "@/components/data-provider";
import { ReviewMemoryProvider } from "@/components/review-memory-provider";
import { AnalyticsInitializer } from "@/components/analytics-initializer";
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
        <AnalyticsInitializer />
        <DataProvider>
          <ReviewMemoryProvider>
            <PlatformShell>{children}</PlatformShell>
          </ReviewMemoryProvider>
        </DataProvider>
      </body>
    </html>
  );
}
