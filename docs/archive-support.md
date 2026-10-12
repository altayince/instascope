# Archive compatibility and limits

Supported JSON structures:

- `followers.json`, `followers_1.json`, split `followers_N.json`: arrays of records with `string_list_data`.
- `following.json` / `following_N.json`: direct arrays or `relationships_following` containers.
- Loose JSON with `relationships_followers` and/or `relationships_following` keys, regardless of filename.
- Entries with `value`, a canonical Instagram `href` (including `/_u/name`), or a following `title` paired with a `string_list_data` entry.
- Empty explicit arrays; duplicate/case-variant usernames are normalized. The earliest valid timestamp is retained deterministically.

ZIP: nested directories and alternate parent names are supported. The worker reads the bounded end record and central directory with `Blob.slice`, then reads only recognized core and optional connection JSON or HTML entries. Stored and Deflate entries, including streaming-writer data descriptors, are supported. The full archive is never converted to an ArrayBuffer on the UI thread. Split lists are combined where explicitly supported. Both relationship directions must exist; missing data is never interpreted as an empty list. Complete single-volume non-ZIP64 archives are required.

HTML: `followers[_N].html` / `following[_N].html` (also `.htm`) contain bounded account records with absolute, validated Instagram profile URLs. Optional categories use labelled account tables under the verified record structure. Headers/navigation and arbitrary links are not relationship records. Scripts, images, CSS and external references are never executed or fetched. Visible record dates in the observed English format `MMM DD, YYYY h:mm am|pm` are strictly parsed and preserve minute-without-timezone semantics; localized/unknown/malformed dates remain unavailable without dropping the account. HTML dates are not exact UTC events. An empty HTML list requires explicit category and empty-list wording; otherwise use JSON.

Limits: 2 GB total selected files, 200 selected files, 10,000 ZIP entries, 8 MB central directory, 20 MB compressed/uncompressed per relevant file, 60 MB total expanded relationship data across the selection, 30 seconds per browser import. These limits use binary multiples (MiB/GiB). Unwanted archive payloads are not inflated. Each relevant entry's local header, name, actual length and CRC32 must agree with the central directory. Decompression runs in bounded compressed chunks and rejects output larger than the declared size. Oversized, truncated or unsupported inputs get actionable errors. JSON structures are validated before counts are shown.

Unsupported: encrypted/multipart/ZIP64 exports, generic CSV, unknown account record shapes, arbitrary HTML, nested ZIPs, and ZIP relationship files renamed outside supported patterns. Duplicate relationship paths are rejected. CRC32 is checked only for relationship files we actually consume, not unrelated media.

## Optional connection insights (INS-6)

The same selective ZIP reader also consumes `pending_follow_requests`, `close_friends`, `blocked_profiles`, `restricted_profiles`, `hide_story_from` and `recently_unfollowed_profiles` files (JSON/HTML, with optional numeric suffixes). JSON supports `label_values` arrays with row timestamps and legacy `string_list_data` containers listed in `src/lib/instagram/connections.ts`. Explicit Username takes precedence over potentially stale URL fields; Name is never interpreted as a username. HTML labelled tables preserve associated visible record dates with minute-without-timezone precision. A malformed account invalidates the optional list instead of silently presenting partial results.

Optional files must accompany core Followers and Following lists. Missing, explicitly empty, and unsupported lists are distinct states. A malformed optional split invalidates that category, with a warning, while core analysis remains usable; ZIP integrity and resource violations still reject the import. Account lists deduplicate usernames; unfollow history deduplicates exact username/date events and preserves different dates for the same account.

Request age uses UTC calendar days against an editable reference date, initially the import day. It is not live pending-status verification. Unfollow history describes the user's own actions, not lost followers. Timeline bins describe dated relationships present in the export, not historical totals/net growth. Following-date Wrapped cards contain aggregate dates and counts; optional private lists never enter share cards.

## Audited Archive Extras (INS-108)

Two additional relationship-adjacent categories use the same selective import pass:

| Category                    | Exact basename           | JSON shape                                                         | HTML structure                                                              | Meaning                                                                                                        |
| --------------------------- | ------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Recent sent request records | `recent_follow_requests` | Root array of `label_values` records with optional row `timestamp` | Labelled account table in a bounded `_a6-g` record, associated `_a6-o` date | Recently sent requests described by the export as confirmed or deleted; the outcome of each record is unknown. |
| Removed profile suggestions | `removed_suggestions`    | Root array of `label_values` records with optional row `timestamp` | Same labelled-table structure                                               | Profiles removed from suggestions; not removed followers or unfollow events.                                   |

Only the observed `.json` and `.html` extensions are accepted for these new basenames. Neither `.htm` nor a numeric suffix is accepted because those variants were not observed. No guessed JSON container or generic account-link shape is added for them. Identity requires a valid, unambiguous explicit `Username`; neither URL nor Name supplies a fallback for these two categories. `fbid` and media do not supply or extend normalized identity. Existing categories retain their own filename and identity contracts.

JSON dates retain source Unix-instant precision; HTML dates remain timezone-unknown minutes. Neither is labelled as the exact confirmation/deletion/removal event time. Missing or unusable dates remain unavailable. Available-empty, missing and unsupported lists are distinct. Both extras deduplicate normalized account identities like the other exported membership lists; they do not add a complete event-history claim or Timeline series.

Recent requests appear separately within Pending Requests. Removed suggestions appear in their own disclosure beside Your Unfollow History, without being combined with unfollow records. Connection Privacy retains its four existing categories. Export Doctor includes extras availability and source counters. These lists stay with the active export; Vault snapshots/backups, Review Memory, Watch Circle, Circle Pulse and Wrapped/share output are unchanged. `synced_contacts` is deliberately ignored: address-book contact fields do not establish Instagram account identity. No received-request, Favorites, muted-account or removed-follower file was present in the inspected archives, so those categories are not added. See [the sanitized Archive Extras audit](ARCHIVE_EXTRAS_AUDIT.md) for the acceptance gate, structures and limitations.

Use Instagram's **All time** range. An export filtered to a recent date range can make counts misleading. Counts represent the export, not live Instagram state. Renaming/deactivating accounts can also appear as changes between snapshots.

## Real-export validation (INS-4)

A recent user-supplied JSON export was validated locally on 2026-09-26. It is a media-rich, stored ZIP over the previous 100 MB limit, while its relationship records are small. Independent source parsing was reconciled against normalized account membership, timestamps and all five relationship counts, then verified in desktop/mobile Chromium using the original ZIP. Selective reads consumed less than 1 MB. No personal archive, account list, exact personal counts, private screenshots or report is committed.

The observed core structures are the supported followers array (`title`, `media_list_data`, `string_list_data`) and following container (`relationships_following`, with `title` plus `href`/`timestamp` entries without `value`). INS-6 also reconciled all six optional `label_values` categories against independent source Username/timestamp sets locally, including records with stale or empty URL fields. This structure is not silently treated as follower/following data.

INS-104 and INS-106 subsequently inspected the supplied real HTML export from 2026-09-27 locally, including core dates, all six existing labelled optional categories and the scoped generation header. INS-108 additionally checked both supplied archives for relationship-adjacent files and reconciled the two accepted extras against independent source identity/date extraction. No real archive was added to fixtures or uploaded for these audits. Browser regression fixtures are synthetic.

This verifies one JSON and one HTML capture, not universal compatibility or a full historical sequence. Physical mobile devices and physical Safari remain unverified; automated mobile Chromium/WebKit coverage uses synthetic fixtures. Keep any real data in ignored `private-exports/` and never upload it to GitHub or analytics. ZIP field validation follows [PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT); Deflate decoding uses [fflate](https://github.com/101arrowz/fflate).
