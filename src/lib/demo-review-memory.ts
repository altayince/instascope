import type { ReviewMemoryRecord } from "./review-memory";
import type { VaultSnapshot } from "./snapshot-vault";

export const DEMO_WATCH_EXPORT_DATE = "2025-01-15";
export const DEMO_WATCH_SNAPSHOT_DATE = "2024-12-15";
const recorded = "2025-01-15T12:00:00.000Z";

// Separate in-memory teaching records. Never write these into real local storage.
export function demoReviewMemory(): ReviewMemoryRecord[] {
  const entry = (
    username: string,
    flags: Partial<
      Pick<ReviewMemoryRecord, "keep" | "reviewed" | "watch" | "note">
    >,
  ): ReviewMemoryRecord => ({
    username,
    keep: false,
    reviewed: false,
    watch: false,
    createdAt: recorded,
    updatedAt: recorded,
    ...flags,
  });
  return [
    entry("demo.mutual.0100", { watch: true }),
    entry("demo.oneway.0001", { keep: true, watch: true }),
    entry("demo.mutual.0001", { reviewed: true, watch: true }),
    entry("demo.mutual.0002", { keep: true }),
    entry("demo.fan.0001", {
      reviewed: true,
      note: "Fictional reminder: reviewed this example account.",
    }),
  ];
}

// A dedicated fictional Watch comparison point, separate from the four Vault
// teaching snapshots. It is earlier than the unchanged Jan 15 active core demo.
export function demoWatchSnapshots(): VaultSnapshot[] {
  return [
    {
      id: "demo-watch-2024-12-15",
      version: 1,
      exportDate: DEMO_WATCH_SNAPSHOT_DATE,
      createdAt: Date.parse("2024-12-15T12:00:00.000Z"),
      followers: ["demo.mutual.0100", "demo.oneway.0001", "demo.mutual.0001"],
      following: ["demo.mutual.0100", "demo.oneway.0001"],
    },
  ];
}
