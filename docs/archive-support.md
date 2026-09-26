# Archive compatibility and limits

Supported JSON structures:

- `followers.json`, `followers_1.json`, split `followers_N.json`: arrays of records with `string_list_data`.
- `following.json` / `following_N.json`: direct arrays or `relationships_following` containers.
- Loose JSON with `relationships_followers` and/or `relationships_following` keys, regardless of filename.
- Entries with `value`, a canonical Instagram `href` (including `/_u/name`), or a following `title` paired with a `string_list_data` entry.
- Empty explicit arrays; duplicate/case-variant usernames are normalized. The earliest valid timestamp is retained deterministically.

ZIP: nested directories and alternate parent names are supported. The worker reads the bounded end record and central directory with `Blob.slice`, then reads only recognized Followers/Following JSON or HTML entries. Stored and Deflate entries, including streaming-writer data descriptors, are supported. The full archive is never converted to an ArrayBuffer on the UI thread. Split lists are combined. Both relationship directions must exist; missing data is never interpreted as an empty list. Complete single-volume non-ZIP64 archives are required.

HTML: `followers[_N].html` / `following[_N].html` (also `.htm`) containing Instagram profile links. Scripts, images, CSS and external references are never executed or fetched. Dates are deliberately not inferred from localized HTML text. An empty HTML list requires explicit empty-list wording; otherwise use JSON.

Limits: 2 GB total selected files, 200 selected files, 10,000 ZIP entries, 8 MB central directory, 20 MB compressed/uncompressed per relevant file, 60 MB total expanded relationship data across the selection, 30 seconds per browser import. These limits use binary multiples (MiB/GiB). Unwanted archive payloads are not inflated. Each relevant entry's local header, name, actual length and CRC32 must agree with the central directory. Decompression runs in bounded compressed chunks and rejects output larger than the declared size. Oversized, truncated or unsupported inputs get actionable errors. JSON structures are validated before counts are shown.

Unsupported: encrypted/multipart/ZIP64 exports, generic CSV, unknown account record shapes, arbitrary HTML, nested ZIPs, and ZIP relationship files renamed outside supported patterns. Duplicate relationship paths are rejected. CRC32 is checked only for relationship files we actually consume, not unrelated media. Optional blocked/close-friends/pending-request lists are not analyzed in this MVP.

Use Instagram's **All time** range. An export filtered to a recent date range can make counts misleading. Counts represent the export, not live Instagram state. Renaming/deactivating accounts can also appear as changes between snapshots.

## Real-export validation (INS-4)

A recent user-supplied JSON export was validated locally on 2026-09-26. It is a media-rich, stored ZIP over the previous 100 MB limit, while its relationship records are small. Independent source parsing was reconciled against normalized account membership, timestamps and all five relationship counts, then verified in desktop/mobile Chromium using the original ZIP. Selective reads consumed less than 1 MB. No personal archive, account list, exact personal counts, private screenshots or report is committed.

The observed core structures are the supported followers array (`title`, `media_list_data`, `string_list_data`) and following container (`relationships_following`, with `title` plus `href`/`timestamp` entries without `value`). Optional connection exports use a separate `label_values` structure; this is not silently treated as follower/following data.

This verifies one current real JSON export, not universal compatibility. Real HTML exports, a second historical snapshot, physical mobile devices and Safari remain unverified. Keep any real data in ignored `private-exports/` and never upload it to GitHub or analytics. ZIP field validation follows [PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT); Deflate decoding uses [fflate](https://github.com/101arrowz/fflate).
