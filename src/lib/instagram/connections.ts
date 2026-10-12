import type { ConnectionKind, ConnectionList } from "./types";

// Only explicitly supported export names/containers are consumed from a ZIP.
export const connectionFormats: Record<
  ConnectionKind,
  {
    filename: string;
    keys: string[];
    allowNumericSuffix?: boolean;
    allowHtm?: boolean;
    /** Verified extras require labelled records with an explicit Username. */
    labelledOnly?: boolean;
  }
> = {
  pendingRequests: {
    filename: "pending_follow_requests",
    keys: ["relationships_follow_requests_sent"],
  },
  closeFriends: {
    filename: "close_friends",
    keys: ["relationships_close_friends"],
  },
  blocked: {
    filename: "blocked_profiles",
    keys: ["relationships_blocked_users"],
  },
  restricted: {
    filename: "restricted_profiles",
    keys: ["relationships_restricted_users"],
  },
  hideStoryFrom: {
    filename: "hide_story_from",
    keys: ["relationships_hide_stories_from"],
  },
  recentlyUnfollowed: {
    filename: "recently_unfollowed_profiles",
    keys: ["relationships_unfollowed_users"],
  },
  recentFollowRequests: {
    filename: "recent_follow_requests",
    keys: [],
    allowNumericSuffix: false,
    allowHtm: false,
    labelledOnly: true,
  },
  removedSuggestions: {
    filename: "removed_suggestions",
    keys: [],
    allowNumericSuffix: false,
    allowHtm: false,
    labelledOnly: true,
  },
};
export const connectionKinds = Object.keys(
  connectionFormats,
) as ConnectionKind[];
export function missingConnection(): ConnectionList {
  return {
    status: "missing",
    accounts: [],
    message:
      "Not included in this export. Include this connection category in a fresh Instagram export, then upload the ZIP together with Followers and Following. Missing data does not mean an empty list.",
  };
}
