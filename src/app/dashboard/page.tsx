import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { pageMetadata } from "@/lib/seo";
import { isIndexable } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata(
    "Your dashboard",
    "Your private starting point for reviewing Instagram connections, recorded dates and stories from your own export.",
    "/dashboard/",
  ),
  robots: { index: false, follow: isIndexable },
};

export default function DashboardPage() {
  return (
    <main id="main" className="dashboard">
      <Dashboard />
    </main>
  );
}
