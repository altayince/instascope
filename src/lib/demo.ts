import type { Dataset } from "./instagram/types";
import { account } from "./instagram/normalize";
import type { VaultSnapshot } from "./snapshot-vault";
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
const withMissingDates = (accounts: Dataset["followers"]) =>
  accounts.map((entry, index) =>
    index % 32 === 31 ? { ...entry, timestamp: undefined } : entry,
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
    followers: withMissingDates([
      ...mutuals.map((entry, index) => ({
        ...entry,
        timestamp:
          entry.timestamp! +
          (index % 3 === 0 ? 6 : index % 3 === 1 ? -6 : 0) * 86400,
      })),
      ...entries("fan", 542, 50),
    ]),
    following: withMissingDates([
      ...mutuals.map((a) => ({ ...a })),
      ...entries("oneway", 190, 100),
    ]),
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

// In-memory teaching fixtures only; never pass these to Vault persistence/backup.
export function demoVaultSnapshots(): VaultSnapshot[] {
  return ["2025-01-15", "2025-04-15", "2025-07-15", "2025-10-15"]
    .map((exportDate, index) => {
      const names = (prefix: string, count: number, start = 0) =>
        Array.from(
          { length: count },
          (_, n) => `demo.${prefix}.${String(n + start + 1).padStart(4, "0")}`,
        );
      const followers = new Set([
        ...names("mutual", 700 + index * 14, index * 4),
        ...names("fan", 410 + index * 44, index * 20),
      ]);
      const following = new Set([
        ...names("mutual", 700 + index * 14, index * 4),
        ...names("oneway", 170 + index * 6, index * 10),
      ]);
      const followerCount = followers.size,
        followingCount = following.size;
      const changing = "demo.oneway.0001",
        incoming = "demo.fan.0001";
      followers.delete(changing);
      following.delete(changing);
      if (index < 2) followers.add(changing);
      if (index < 3) following.add(changing);
      followers.add(incoming);
      if (index > 0) following.add(incoming);
      const protectedNames = new Set([changing, incoming, "demo.mutual.0100"]);
      const balance = (set: Set<string>, count: number, prefix: string) => {
        for (const name of [...set].reverse()) {
          if (set.size <= count) break;
          if (!protectedNames.has(name)) set.delete(name);
        }
        for (let n = 0; set.size < count; n++)
          set.add(`demo.${prefix}.${String(n + 1).padStart(4, "0")}`);
        return [...set].sort();
      };
      return {
        id: `demo-vault-${exportDate}`,
        version: 1 as const,
        exportDate,
        createdAt: Date.parse(`${exportDate}T12:00:00Z`),
        followers: balance(followers, followerCount, `vaultfan${index}`),
        following: balance(following, followingCount, `vaultfollow${index}`),
      };
    })
    .reverse();
}
