import type { Metadata } from "next";
import { SnapshotVault } from "@/components/snapshot-vault";
import { pageMetadata } from "@/lib/seo";
import { isIndexable } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata(
    "Snapshot Vault",
    "Your locally saved Instagram export history and private snapshot comparisons.",
    "/snapshot-vault/",
  ),
  robots: { index: false, follow: isIndexable },
};
export default function SnapshotVaultPage() {
  return (
    <main id="main" tabIndex={-1} className="dashboard snapshot-vault">
      <SnapshotVault />
    </main>
  );
}
