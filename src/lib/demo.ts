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
