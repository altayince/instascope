// Sanitized fixtures for locally verified source shapes, never personal data.
import {
  htmlConnectionDocument,
  htmlLabelRecord,
} from "./html-connection-export";

export const archiveExtraKinds = [
  "recentFollowRequests",
  "removedSuggestions",
] as const;
export type ArchiveExtraKind = (typeof archiveExtraKinds)[number];
export const archiveExtraFilenames = {
  recentFollowRequests: "recent_follow_requests",
  removedSuggestions: "removed_suggestions",
} as const;
const titles = {
  recentFollowRequests: "Recent follow requests",
  removedSuggestions: "Removed suggestions",
};
export function archiveExtraJsonRow(username: string, timestamp?: unknown) {
  return {
    timestamp,
    media: [],
    fbid: "synthetic-reference-not-account-identity",
    label_values: [
      { label: "Name", value: "synthetic.display.name" },
      { label: "URL", value: "https://example.invalid/stale-profile" },
      { label: "Username", value: username },
    ],
  };
}
export function archiveExtraHtml(
  kind: ArchiveExtraKind,
  records: readonly { username: string; date?: string }[],
) {
  return htmlConnectionDocument(
    records.map(({ username, date }) =>
      htmlLabelRecord(
        [
          ["Name", "synthetic.display.name"],
          ["URL", "https://example.invalid/stale-profile"],
          ["Username", username],
        ],
        date,
      ),
    ),
    titles[kind],
  );
}
