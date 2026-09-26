// Fictional identities and dates only; no personal export records.
export const syntheticConnections = {
  "pending_follow_requests.json": [
    {
      timestamp: 1704067200,
      label_values: [
        { label: "URL", value: "https://www.instagram.com/request.old/" },
        { label: "Name", value: "Wrong.display" },
        { label: "Username", value: "request.old" },
      ],
    },
    {
      timestamp: 1736467200,
      label_values: [{ label: "Username", value: "request.recent" }],
    },
    { label_values: [{ label: "Username", value: "request.undated" }] },
  ],
  "close_friends.json": [
    {
      timestamp: 1704067200,
      label_values: [{ label: "Username", value: "close.friend" }],
    },
  ],
  "blocked_profiles.json": {
    relationships_blocked_users: [
      {
        title: "blocked.person",
        string_list_data: [
          {
            href: "https://www.instagram.com/blocked.person/",
            timestamp: 1704067200,
          },
        ],
      },
    ],
  },
  "restricted_profiles.json": [],
  "hide_story_from.json": [
    { label_values: [{ label: "Username", value: "story.hidden" }] },
  ],
  "recently_unfollowed_profiles.json": [
    {
      timestamp: 1704067200,
      label_values: [{ label: "Username", value: "unfollow.again" }],
    },
    {
      timestamp: 1736467200,
      label_values: [{ label: "Username", value: "unfollow.again" }],
    },
  ],
};
