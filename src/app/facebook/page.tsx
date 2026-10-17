import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FriendsExplorer } from "@/components/facebook/friends-explorer";

export const metadata: Metadata = {
  title: "Facebook Friends Explorer · Preview",
  description:
    "Explore friend records from your own Facebook export locally in your browser.",
  robots: { index: false, follow: false },
};
export default function FacebookPage() {
  if (process.env.NEXT_PUBLIC_FACEBOOK_ENABLED !== "true") notFound();
  return <FriendsExplorer />;
}
