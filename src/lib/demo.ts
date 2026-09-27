import type { Dataset } from "./instagram/types";
import { account } from "./instagram/normalize";
// Deterministic fictional identities; generated locally without network access.
const entries = (prefix: string, count: number, offset = 0) =>
  Array.from({ length: count }, (_, index) =>
    account(
      `demo.${prefix}.${String(index + 1).padStart(4, "0")}`,
      1451606400 + (index + offset) * 172800,
    )!,
  );
const privacyEntries = (prefix: string, count: number, offset: number) =>
  entries(prefix, count, offset).map((entry, index) =>
    index === count - 1 ? { ...entry, timestamp: undefined } : entry,
  );
export function demoSnapshots(): { newer: Dataset; older: Dataset } {
  const mutuals = entries("mutual", 742);
  const metadata = {
    parsedAt: Date.UTC(2025, 0, 15),
    sourceFormat: "demo",
    demo: true,
    warnings: [
      "Fictional demonstration only. These accounts and dates do not describe a real Instagram account.",
    ],
  };
  const newer: Dataset = {
    followers: [...mutuals, ...entries("fan", 542, 50)],
    following: [
      ...mutuals.map((a) => ({ ...a })),
      ...entries("oneway", 190, 100),
    ],
    connections: {
      pendingRequests: {
        status: "available",
        accounts: [
          account("demo.request.0001", 1704067200)!,
          account("demo.request.0002", 1736467200)!,
          account("demo.request.0003")!,
        ],
      },
      recentlyUnfollowed: {
        status: "available",
        accounts: [
          account("demo.unfollow.0001", 1704067200)!,
          account("demo.unfollow.0002", 1736467200)!,
        ],
      },
      closeFriends: {
        status: "available",
        accounts: privacyEntries("closefriend", 8, 1400),
      },
      blocked: {
        status: "available",
        accounts: privacyEntries("blocked", 4, 1410),
      },
      restricted: {
        status: "available",
        accounts: privacyEntries("restricted", 3, 1420),
      },
      hideStoryFrom: {
        status: "available",
        accounts: privacyEntries("hidden", 5, 1430),
      },
    },
    metadata: {
      ...metadata,
      snapshotLabel: "Fictional newer snapshot · Jan 15, 2025",
    },
  };
  const older: Dataset = {
    followers: [...newer.followers.slice(25), ...entries("previous", 10)],
    following: [...newer.following.slice(10), ...entries("earlier", 5)],
    metadata: {
      ...metadata,
      parsedAt: Date.UTC(2024, 11, 15),
      snapshotLabel: "Fictional older snapshot · Dec 15, 2024",
    },
  };
  return { newer, older };
}
