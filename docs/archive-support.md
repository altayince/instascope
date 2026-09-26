# Archive compatibility and limits

Supported JSON structures:

- `followers.json`, `followers_1.json`, split `followers_N.json`: arrays of records with `string_list_data`.
- `following.json` / `following_N.json`: direct arrays or `relationships_following` containers.
- Loose JSON with `relationships_followers` and/or `relationships_following` keys, regardless of filename.
- Entries with `value`, a canonical Instagram `href` (including `/_u/name`), or a following `title` paired with a `string_list_data` entry.
- Empty explicit arrays; duplicate/case-variant usernames are normalized. The earliest valid timestamp is retained deterministically.

ZIP: nested directories and alternate parent names are supported. Only recognized Followers/Following JSON or HTML filenames are inflated. Split lists are combined. Both relationship directions must exist; missing data is never interpreted as an empty list. Complete single-volume non-ZIP64 archives are required.

HTML: `followers[_N].html` / `following[_N].html` (also `.htm`) containing Instagram profile links. Scripts, images, CSS and external references are never executed or fetched. Dates are deliberately not inferred from localized HTML text. An empty HTML list requires explicit empty-list wording; otherwise use JSON.

Limits: total selected compressed/file bytes 100 MB, 200 selected files, 10,000 ZIP entries, 20 MB per relevant file, 60 MB total inflated relevant ZIP contents, 30 seconds per browser import. ZIP streams are processed in bounded compressed chunks and unwanted files are not inflated. Oversized, truncated or unsupported inputs get actionable errors. JSON structures are validated before counts are shown.

Unsupported: encrypted/multipart/ZIP64 exports, generic CSV, unknown account record shapes, arbitrary HTML, nested ZIPs, and ZIP relationship files renamed outside supported patterns. ZIP CRC validation is not implemented; obtain a fresh export if transport corruption is suspected. Optional blocked/close-friends/pending-request lists are not analyzed in this MVP.

Use Instagram's **All time** range. An export filtered to a recent date range can make counts misleading. Counts represent the export, not live Instagram state. Renaming/deactivating accounts can also appear as changes between snapshots.

## Real-export validation gate

No real personal archive was supplied for this implementation. Synthetic fixtures establish behavior for known shapes, not universal compatibility. Do not claim production-ready archive compatibility until a recent genuine export has been checked locally against its source lists, ideally in both JSON and HTML. Keep it in the ignored `private-exports/` folder and never upload it to GitHub or analytics.
