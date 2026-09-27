export type Account = { username: string; href: string; timestamp?: number };
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
  };
};
export type ConnectionKind =
  | "pendingRequests"
  | "closeFriends"
  | "blocked"
  | "restricted"
  | "hideStoryFrom"
  | "recentlyUnfollowed";
export type ConnectionList =
  | { status: "available"; accounts: Account[] }
  | { status: "missing" | "unsupported"; accounts: []; message: string };
export type Relationship = "followers" | "following" | ConnectionKind;
export type ParsedPart = { kind: Relationship; accounts: Account[] };
