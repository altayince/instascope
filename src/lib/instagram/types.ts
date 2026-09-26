export type Account = { username: string; href: string; timestamp?: number };
export type Dataset = {
  followers: Account[];
  following: Account[];
  metadata: { parsedAt: number; sourceFormat: string; warnings: string[] };
};
export type Relationship = "followers" | "following";
export type ParsedPart = { kind: Relationship; accounts: Account[] };
