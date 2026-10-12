// Synthetic identities/dates only. Nested label-table cards reproduce the
// locally verified Meta HTML structure without copying personal export values.
export function htmlConnectionDocument(
  records: string[],
  title = "Connections",
) {
  return `<!doctype html><html><body>
    <header><nav><a href="https://www.instagram.com/synthetic.navigation/">Navigation</a></nav></header>
    <main class="_a706"><h1>${title}</h1><div class="export-wrapper"><div>${records.join("")}</div></div></main>
    <footer><a href="https://www.instagram.com/synthetic.footer/">Footer</a></footer>
  </body></html>`;
}

export function htmlLabelRecord(
  fields: readonly (readonly [string, string])[],
  date?: string,
) {
  return `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
    <div class="_3-95 _a6-p"><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
      <div class="_a6-p"><table>${fields
        .map(
          ([label, value]) =>
            `<tr><td class="_a6_q">${label}</td><td class="_2piu _a6_r">${value}</td></tr>`,
        )
        .join("")}</table></div>
    </div></div>
    ${date ? `<div class="_3-94 _a6-o">${date}</div>` : ""}
  </div>`;
}

const list = (prefix: string) =>
  htmlConnectionDocument([
    htmlLabelRecord(
      [
        ["URL", "https://example.invalid/stale-profile"],
        ["Name", "synthetic.display.name"],
        ["Username", `synthetic.${prefix}.dated`],
      ],
      "Jan 02, 2025 1:05 pm",
    ),
    htmlLabelRecord([["Username", `synthetic.${prefix}.undated`]]),
  ]);

export const syntheticHtmlConnections = {
  "close_friends.html": list("closefriend"),
  "blocked_profiles.html": list("blocked"),
  "restricted_profiles_2.html": list("restricted"),
  "hide_story_from.html": list("hidden"),
  "pending_follow_requests.html": list("request"),
  "recently_unfollowed_profiles.html": htmlConnectionDocument([
    htmlLabelRecord(
      [["Username", "synthetic.unfollow.event"]],
      "Jan 02, 2025 12:00 am",
    ),
    htmlLabelRecord(
      [["Username", "synthetic.unfollow.event"]],
      "Jan 03, 2025 12:00 pm",
    ),
  ]),
};

export const syntheticHtmlCore = {
  "followers_1.html": htmlConnectionDocument(
    [
      '<section><div><a href="https://www.instagram.com/synthetic.follower.dated/">synthetic.follower.dated</a></div><div>Jan 01, 2025 12:00 am</div></section>',
    ],
    "Followers",
  ),
  "followers_2.html": htmlConnectionDocument(
    [
      '<section><a href="https://www.instagram.com/synthetic.follower.undated/">synthetic.follower.undated</a></section>',
    ],
    "Followers",
  ),
  "following.html": htmlConnectionDocument(
    [
      '<section><h2>synthetic.following.dated</h2><div><a href="https://www.instagram.com/_u/synthetic.following.dated">Instagram profile</a></div><div>Jan 04, 2025 1:15 pm</div></section>',
    ],
    "Following",
  ),
};
