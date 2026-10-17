export const connectionCategories = [
  "friends",
  "received",
  "rejected",
  "removed",
] as const;
export type ConnectionCategory = (typeof connectionCategories)[number];
export type FacebookFormat = "json" | "html";
export type FacebookConnection = {
  /** Import-local row key only. Never a Facebook identity. */
  row: number;
  name: string;
  /** JSON epoch seconds. HTML never invents an instant from an unzoned date. */
  timestamp?: number;
  recordedDate?: string;
  dateBasis: "utc" | "export-local";
  markedAsSpam?: boolean;
};
export type FacebookCoverage = {
  state: "supported" | "partial" | "absent" | "empty" | "unsupported";
  records: FacebookConnection[];
  sourceRows: number;
  invalidRows: number;
  unknownDates: number;
  repairedNames: number;
};
export type FacebookDataset = {
  format: FacebookFormat;
  categories: Record<ConnectionCategory, FacebookCoverage>;
  ignoredFiles: number;
};
export const categoryLabels: Record<ConnectionCategory, string> = {
  friends: "Current friend records",
  received: "Received friend requests",
  rejected: "Rejected friend requests",
  removed: "Removed friend records",
};
