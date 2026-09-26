import type { Account } from "./types";

const reserved = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "direct",
  "about",
  "developer",
  "legal",
]);
export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let name = value.trim();
  if (/^(?:https?:\/\/|(?:www\.|m\.)?instagram\.com\/)/i.test(name)) {
    try {
      const url = new URL(/^https?:/i.test(name) ? name : `https://${name}`);
      if (
        !["instagram.com", "www.instagram.com", "m.instagram.com"].includes(
          url.hostname,
        ) ||
        url.username ||
        url.password ||
        url.port
      )
        return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "_u") parts.shift();
      if (parts.length !== 1) return null;
      name = decodeURIComponent(parts[0]);
    } catch {
      return null;
    }
  }
  name = name.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(name) &&
    !reserved.has(name) &&
    !/^\.+$/.test(name)
    ? name
    : null;
}
export function account(value: unknown, timestamp?: unknown): Account | null {
  const username = normalizeUsername(value);
  if (!username) return null;
  const seconds =
    typeof timestamp === "number" &&
    Number.isFinite(timestamp) &&
    timestamp > 0 &&
    timestamp < 1e11
      ? timestamp
      : undefined;
  return {
    username,
    href: `https://www.instagram.com/${username}/`,
    ...(seconds ? { timestamp: seconds } : {}),
  };
}
export function deduplicate(accounts: Account[]): Account[] {
  const unique = new Map<string, Account>();
  for (const entry of accounts) {
    const normalized = account(entry.username, entry.timestamp);
    if (!normalized) continue;
    const previous = unique.get(normalized.username);
    // Deterministically retain the earliest known relationship timestamp.
    if (
      !previous ||
      (normalized.timestamp !== undefined &&
        (previous.timestamp === undefined ||
          normalized.timestamp < previous.timestamp))
    )
      unique.set(normalized.username, normalized);
  }
  return [...unique.values()];
}

// History records are events: repeated exports of one event collapse, distinct dates survive.
export function deduplicateEvents(accounts: Account[]): Account[] {
  const events = new Map<string, Account>();
  for (const entry of accounts) {
    const normalized = account(entry.username, entry.timestamp);
    if (normalized)
      events.set(
        `${normalized.username}:${normalized.timestamp ?? "unknown"}`,
        normalized,
      );
  }
  return [...events.values()];
}
