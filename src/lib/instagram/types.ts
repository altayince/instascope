export type TimestampPrecision = "minute-without-timezone";
export type Account = {
  username: string;
  href: string;
  timestamp?: number;
  timestampPrecision?: TimestampPrecision;
};
export type ImportCategoryProvenance = {
  sourceFiles: number;
  jsonFiles: number;
  htmlFiles: number;
  parsedFiles: number;
  unsupportedFiles: number;
  skippedFiles: number;
};
// Aggregate facts from the active import only. No filenames, paths, usernames,
// raw archive metadata or contents belong in provenance or persisted snapshots.
export type ImportProvenance = {
  transports: { json: number; html: number; zip: number };
  contentFormats: { json: number; html: number };
  recognizedFiles: number;
  ignoredFiles: number;
  /** Generation minutes observed only in successfully parsed HTML files. */
  generationDate?: string;
  generationDatedFiles: number;
  generationCheckedFiles: number;
  generationStatus: "unverified" | "consistent" | "conflicting";
  categories: Record<Relationship, ImportCategoryProvenance>;
};
export type Dataset = {
  followers: Account[];
  following: Account[];
  connections?: Record<ConnectionKind, ConnectionList>;
  metadata: {
    parsedAt: number;
    sourceFormat: string;
    warnings: string[];
    demo?: boolean;
    snapshotLabel?: string;
    importProvenance?: ImportProvenance;
  };
};
export type ConnectionKind =
  | "pendingRequests"
  | "closeFriends"
  | "blocked"
  | "restricted"
  | "hideStoryFrom"
  | "recentlyUnfollowed"
  | "recentFollowRequests"
  | "removedSuggestions";
export type ConnectionList =
  | { status: "available"; accounts: Account[] }
  | { status: "missing" | "unsupported"; accounts: []; message: string };
export type Relationship = "followers" | "following" | ConnectionKind;
export type ParsedPart = { kind: Relationship; accounts: Account[] };
