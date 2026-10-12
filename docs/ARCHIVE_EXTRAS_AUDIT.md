# Archive Extras audit

INS-108 expands the active export with two conservatively understood account
lists. This is selective relationship analysis, not a general archive explorer.
The audit preceded category implementation.

## Local evidence

The supplied real JSON export from September 26, 2026 and HTML export from
September 27, 2026 were inspected locally. Their `connections` directories contain
Followers, Following, the existing six optional connection categories and three
additional files. Archive directory names were also checked for received request,
Favorites, mute and removed-follower candidates; none were found in either
archive. Absence here is not a claim about every Instagram export.

No archives, account identities, owner names, IDs, contact details, private text,
personal counts or source screenshots belong in this document, repository or
synthetic fixtures. Local verification emits only structural names and aggregate
checks. Real data is not uploaded to services or analytics.

## Category decisions

| Category                                              | Export filenames                                     | JSON      | HTML      | Account identity source                 | Recorded date available?      | Implemented? | Reason                                                                                                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------- | --------- | --------- | --------------------------------------- | ----------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sent pending requests                                 | `pending_follow_requests.json`, `.html`              | Present   | Present   | Explicit `Username` label               | Yes                           | Existing     | Preserve the existing exported-request behavior; not a live pending-status check.                                                                               |
| Close friends                                         | `close_friends.json`, `.html`                        | Present   | Present   | Explicit `Username` label               | Yes                           | Existing     | Explicit exported list membership; no closeness or continuity inference.                                                                                        |
| Blocked accounts                                      | `blocked_profiles.json`, `.html`                     | Present   | Present   | Explicit `Username` label               | Yes                           | Existing     | Preserve the existing privacy category.                                                                                                                         |
| Restricted accounts                                   | `restricted_profiles.json`, `.html`                  | Present   | Present   | Explicit `Username` label               | Yes                           | Existing     | Preserve the existing privacy category.                                                                                                                         |
| Story hidden from                                     | `hide_story_from.json`, `.html`                      | Present   | Present   | Explicit `Username` label               | Yes                           | Existing     | Preserve the existing story-visibility category.                                                                                                                |
| Your unfollow history                                 | `recently_unfollowed_profiles.json`, `.html`         | Present   | Present   | Explicit `Username` label               | Yes                           | Existing     | Own exported unfollow records; not evidence of someone unfollowing you.                                                                                         |
| Recent sent requests                                  | `recent_follow_requests.json`, `.html`               | Present   | Present   | Explicit `Username` label               | Yes                           | Yes          | The HTML description identifies recently sent requests that were confirmed or deleted. Preserve that combined category without guessing which outcome occurred. |
| Removed profile suggestions                           | `removed_suggestions.json`, `.html`                  | Present   | Present   | Explicit `Username` label               | Yes                           | Yes          | The HTML description identifies profiles removed from suggestions. This is neither removed followers nor an unfollow list.                                      |
| Synced contacts                                       | `connections/contacts/synced_contacts.json`, `.html` | Present   | Present   | No supported Instagram account identity | No relationship date observed | No           | Address-book contact data, not a safe Instagram relationship list. Contact names/details must not be interpreted as usernames.                                  |
| Received follow requests                              | None found                                           | Not found | Not found | Unverified                              | Unverified                    | No           | `recent_follow_requests` is explicitly about sent requests, so it cannot supply this category.                                                                  |
| Favorites                                             | None found                                           | Not found | Not found | Unverified                              | Unverified                    | No           | No source account list verified; do not fabricate support or merge it with Close Friends.                                                                       |
| Muted posts, stories, notes or generic muted accounts | None found                                           | Not found | Not found | Unverified                              | Unverified                    | No           | No mute list or mute-type semantics verified.                                                                                                                   |
| Accounts removed from followers                       | None found                                           | Not found | Not found | Unverified                              | Unverified                    | No           | Removed suggestions do not establish removed followers.                                                                                                         |
| Additional story-visibility lists                     | None found beyond `hide_story_from`                  | Not found | Not found | Unverified                              | Unverified                    | No           | Keep the existing category; no duplicate or guessed list.                                                                                                       |

## Accepted JSON structures

Both new categories are **root arrays**, not named relationship containers.
Each inspected row has `timestamp`, `media`, `fbid` and `label_values`.
The labelled fields are `URL`, `Name` and `Username`.

The explicit `Username` establishes identity. Display `Name` never establishes
identity; URL fields can be empty, stale or point to a non-profile destination.
The existing hardened normalizer validates the explicit username. Neither URL
nor Name substitutes for a missing, malformed or ambiguous Username in these
two new categories. `fbid`, display names and media are not added to the normalized
account model, provenance or storage.

Only the verified labelled-array shape is added for these categories. Guessed
keys such as `relationships_recent_follow_requests`, generic `string_list_data`
records, arbitrary JSON objects and fuzzy filename matching are not new support.
Existing categories retain their own current contracts.

## Accepted HTML structures

The real HTML separates category meaning from its records:

```text
header._a70a
  > div._a70d
    > h1
    > p._a70f                 category description
main
  > div._a6-g                one outer record
    > div._a6-p
      > div._a6-g
        > div._a6-p
          > table
            > ... tr > td    label, value
    > div._a6-o              visible recorded date
```

Layout classes can include additional `_3-95`, `_2ph-` and `_3-94` tokens.
Recent sent requests supplied `Name` and `Username` rows. Removed suggestions
supplied `Username`, with `Name` and `URL` sometimes absent. Both categories have
an explicit Username field in every inspected record. URL fields are table
text, not additional accounts or independent navigation anchors.

The parser consumes labelled account tables under record boundaries. It does
not collect arbitrary Instagram links from headers, navigation or neighboring
records. Dates cannot migrate across accounts. Scripts, embedded resources and
external links in source HTML are neither executed nor fetched.

The new recognized basenames are `recent_follow_requests` and
`removed_suggestions`. Only the observed `.json` and `.html` extensions are
added. Neither `.htm` nor a numeric suffix was found for these two categories,
so those variants are not added. Existing split Followers,
Following and previously supported optional filenames retain their support.

## Meaning and dates

The verified recent-request description distinguishes **sent** requests and
combines confirmed-or-deleted outcomes. It does not identify which outcome
applies to a row, who confirmed/deleted it, or whether the relationship exists
today. The category is presented separately from sent pending requests and is
never called received requests or current followers.

Removed suggestions means exported profiles removed from suggestions. It does
not imply removed followers, an unfollow, blocking, motive or a current privacy
setting. It appears in a separate removed-suggestions disclosure beside Your
Unfollow History, with observational wording and its own account list.

JSON rows have numeric source Unix timestamps. Their values are preserved by
the existing validator, with exact source-instant precision. The timestamp is
an **associated record date**, not proof of the exact confirmation, deletion,
request-send or suggestion-removal event time.

HTML record dates use the observed English format `MMM DD, YYYY h:mm am|pm`.
Strict parsing validates month, calendar day, hour, minute and period. They have
minute precision and **no timezone**. UTC-shaped numeric storage preserves the
visible calendar fields; `minute-without-timezone` prevents claiming an exact
UTC event or JSON-equivalent precision. Missing or malformed dates leave the
account undated. File creation time, generation headers and upload time never
substitute for a record date. The new categories do not enter Timeline.

## States and import behavior

- **Available, nonempty:** an included list safely parsed in full.
- **Available, empty:** an explicit empty JSON array or a recognized HTML
  category with explicit empty-list wording; shown as included with zero records.
- **Missing:** no recognized category file; no zero count is implied.
- **Unsupported:** a recognized file has unsafe/unknown shape or a malformed
  account; no partial result is presented as complete.

Both core directions still accompany optional imports. Explicit names are
discovered within the existing selective ZIP pass; only recognized files are
read. Normalization, case handling, duplicate-account handling, deleted-account
sentinels, validated profile URLs and resource/integrity limits are preserved.
The real captures are on different days; unchanged behavior is verified against
each source independently, not by assuming the complete captures are identical.

## Product and privacy boundaries

Pending Requests reuses its existing page for pending and recent sent records.
Unfollow History has a separate, compact removed-suggestions disclosure; its
own unfollow records are not combined with suggestions. Connection Privacy
retains its four existing categories. Export Doctor
reports both categories using the same missing/empty/unsupported semantics and
import provenance counters. No top-level navigation or public SEO page is added.

The extras remain in the active in-memory export. Snapshot Vault, backups,
Review Memory, Watch Circle and Circle Pulse do not persist or infer state from
these lists. Wrapped/share output receives no new list usernames, counts or
stories. Category membership does not automatically Keep, Review or Watch an
account. Deterministic synthetic demo accounts remain visibly fictional and
non-linkable; they do not read or change real storage.

The fixtures reproduce only these structures with synthetic identities. Local
real-source verification confirms conservative identity and date preservation;
regression tests cover filename boundaries, JSON/HTML shapes, import transports,
states, duplicates, deleted accounts and unchanged private storage/tool behavior.
