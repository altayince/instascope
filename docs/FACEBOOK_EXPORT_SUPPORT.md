# Facebook export support

FB-01 / [INS-159](https://github.com/altayince/instascope/issues/159), tracked by [INS-158](https://github.com/altayince/instascope/issues/158). Development preview only. The owner's current request includes both JSON and HTML ZIP import, superseding the package's earlier JSON-first scope.

## Implemented sources

Import one official ZIP containing the following files at its root or under `connections/friends/`, optionally inside an export wrapper directory. Windows path separators are accepted. Multiple representations or repeated categories are rejected rather than summed. The supplied JSON and HTML archives are representations of the same export, not historical snapshots.

| Category | Filename stem | JSON root list | HTML representation |
|---|---|---|---|
| Current friend records | `your_friends` | `friends_v2` | One record section per source row |
| Received friend requests | `received_friend_requests` | `received_requests_v2` | Same |
| Rejected friend requests | `rejected_friend_requests` | `rejected_requests_v2` | Same |
| Removed friend records | `removed_friends` | `deleted_friends_v2` | Same |

JSON rows project only `name`, `timestamp` and optional boolean `marked_as_spam` for rejected requests. No stable friend IDs or profile URLs were observed. Duplicate names, including identical rows, remain distinct. Row numbers identify positions in this import only. No cross-category identity joining or friendship-history inference occurs. Removal records cannot establish who removed whom. Request records are not a live status check.

The verified HTML structure is `main._a706` containing `section._a6-g`, with the name in `h2._a6-h` and date in `._a72d`. Additional generated IDs/attributes do not affect parsing. Text is decoded from entities and rendered by React as text. Imported markup, scripts, CSS, links, media and base URLs are never rendered, executed or fetched. Unknown structures are unsupported rather than quietly reported empty. HTML does not expose the JSON spam flag in the verified source; the UI does not invent it.

## Dates and Unicode

- JSON connection dates are epoch **seconds**. Fractional, nonnumeric, negative, sentinel 0/1, millisecond and out-of-range values remain unknown. The source instant is preserved; display defaults to UTC with explicit timezone choices.
- HTML record dates omit a timezone. An export-generation heading includes its own offset, which cannot establish historical record offsets. Preserve normalized wall-clock dates without manufacturing UTC instants. English and Turkish month names, observed month-first dates with am/pm, and explicit day-first variants are supported. Unknown locales, impossible dates and missing dates retain the row with a Date unavailable diagnostic.
- In the supplied paired exports, every supported name/date row matches when JSON instants are displayed in `Europe/Istanbul`, including historical seasonal offset changes. That verified correspondence is not a general inference from the HTML language. HTML cannot recover the timezone/instant or JSON-only spam flag.
- Conservatively recover reversible valid UTF-8 sequences misrepresented as Latin-1 or supported Windows-1252 characters. Recovery operates on matching runs, preserving surrounding valid Unicode, combining marks and emoji. Invalid sequences stay unchanged. Bounded repeated recovery is idempotent; no global Latin-1 conversion, accent stripping or blanket URI decoding is used. A literal string indistinguishable from valid mojibake remains an inherent ambiguity; arbitrary legacy encodings are unsupported.

## Coverage and limits

Each category reports `supported`, `partial`, `absent`, `empty` or `unsupported`, separately from other categories. Explicit empty source lists/known empty HTML containers differ from missing files. Invalid names are counted as unreadable source rows; invalid dates retain their records and increment unknown dates. Source-row totals, admitted records, unreadable rows, recovered names and unknown dates are visible. Malformed JSON/HTML and unknown versions never become successful empty analytics. No export is asserted historically complete.

Only the four supported connection files are decompressed. Shared ZIP validation verifies directory/local headers, compression method, sizes, exact expansion and CRC. Limits: one ZIP up to 2 GB; 10,000 entries; 8 MB index; 20 MB per admitted file; 60 MB total admitted expansion; 100,000 rows per category; 500 UTF-16 code units per name. Unsupported ZIP64, multipart, encrypted, unsafe-path, duplicate-name/category, mixed-format and malformed inputs fail with generic actionable guidance. Unrelated media, credentials, login, payment, location, contacts and message payloads are skipped. UTF-8 byte decoding is strict; recoverable mojibake is repaired after decoding, not by guessing arbitrary binary encodings.

Import runs in a dedicated worker with cancellation, termination on navigation/unmount and a two-minute deadline. No automatic persistence, network analysis, archive upload or archive-derived analytics are added. A failed replacement import clears old results. Search and date sorting operate on the normalized records; pagination limits rendered rows to 100 at a time. Year groups apply to the visible page, and undated rows remain explicit.

## Private validation and public regression coverage

Both owner archives were read locally using the implemented importer. For all four categories, independent source row counts match admitted counts; no unreadable rows, unknown dates, duplicate removal or silent loss were found. Name/date multisets match across representations under the explicit historical timezone above. This reports pass/fail coverage only: no original counts, dates, names, archive basenames, identifiers, screenshots or raw records belong in documentation or CI.

Synthetic fixtures are authored from scratch and generated in memory. Regression coverage includes both formats, duplicate names, Turkish/English dates, seasonal offsets, UTF-8/Latin-1/Windows-1252 recovery, malformed and missing dates, empty/absent/unsupported categories, inert HTML, field projection, ZIP corruption/resource limits, cancellation, search/sort/year grouping, mobile themes, production pruning and exclusion from sitemap. Full regression runs in required CI; implementation, CI, merge and production release are distinct states.

For local preview, use `npm run dev:family` on a known non-main branch. Static preview uses `npm run build:dev`. Run `npm run check`, focused `npx vitest run tests/unit/facebook*.test.ts`, and the enabled preview browser suite with `EXPECT_FACEBOOK=true npx playwright test --config playwright.facebook.config.ts` (set the environment variable using the current shell's syntax). The shared preview CI job includes desktop Chromium, Pixel Chromium and iPhone WebKit. The default browser CI job verifies the disabled production route/menu gate.

## Researched for later milestones; not imported in FB-01

| Source | Observed shape / limitation |
|---|---|
| `connections/followers/who_you've_followed.json` | `following_v3: [{name,timestamp}]`; outgoing follows, not incoming followers. Sent friend requests and incoming followers were not established in these inputs. |
| `your_facebook_activity/messages/{inbox,archived_threads,filtered_threads,message_requests,e2ee_cutover}/<thread>/message_N.json` | Root `participants:[{name}]`, `messages`, `title`, `thread_path`, `is_still_participant`, `magic_words`; optional `joinable_mode`, `image`, `is_pending`. Same-title threads remain distinct by source folder. Split-file behavior needs synthetic tests. |
| Messenger messages | `sender_name`, `timestamp_ms`, optional `content`, `share`, `sticker`, `files`, `photos`, `call_duration`, `missed`, `reactions:[{reaction,actor}]`, flags and nested `ip`. Explicit field projection must drop IP and other unrelated fields. Epoch milliseconds; stable message IDs not observed. Identical messages must not automatically deduplicate. |
| Messenger HTML | Corresponding thread folders and record sections, sender headings and date footers; repeated headings may be omitted. Sender inheritance requires a separate verified adapter. No Messenger import or analysis is claimed here. `e2ee_cutover` does not establish support for separate secure-storage backups or complete recent history. |
| `your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json` | Mixed array of timestamp/attachments/data/title; not every record is a written post. |
| `your_facebook_activity/comments_and_reactions/comments.json` | `comments_v2`, nested comment timestamp/text/author. |
| Likes/reactions variants | Typed `data[].reaction` and localized `label_values` formats coexist with possible overlap and sentinel dates. Do not sum on timestamp coincidence or treat `NONE` as a positive reaction. |
| `apps_and_websites_off_of_facebook/connected_apps_and_websites.json` | `installed_apps_v2`, names, added/removed dates, active/inactive/removed categories. Drop app-scoped IDs; exported status is not a live permission audit. |
| Off-Meta and advertisers | Localized nested `label_values`/vectors/dictionaries and advertiser lists. Optional later Digital Footprint scope; no proof of current tracking or inferred sensitive traits. |

Other observed activity areas include groups, events, pages, stories, pokes and mixed location activity. Their presence does not extend FB-01 support. No new backend, scraping, account automation, Messenger analysis, Wrapped or production Facebook SEO is included.
