# WhatsAppScope: local importer and Chat Export Doctor

WhatsAppScope is an unreleased member of the InstaScope product family. Work
starts from `dev`; the review PR targets `dev` only. This task performs no main
merge, production deployment, or Cloudflare configuration change.

## Release isolation and local review

Default/production exports have no WhatsApp routes or visible platform switcher.
The gate needs `NEXT_PUBLIC_WHATSAPP_ENABLED=true`, `NEXT_PUBLIC_PREVIEW=true`,
and a known non-main build branch. Local Git, Cloudflare and GitHub branch values
are checked; any known main context disables the feature. `build:production`
forces preview off. Public-path/sitemap registration is unchanged; WhatsApp
pages always carry `noindex, nofollow`.

From a dev-derived branch:

```text
npm run dev:family
npm run build:dev
npm run preview
```

The dev build is a local/preview artifact, not a deploy command. It leaves remote
analytics and the optional Instagram photo endpoint disabled by default. Do not
publish its `out` directory to production. Rebuild with `build:production` to
restore the release artifact. CI separately validates production Instagram and
enabled preview WhatsApp builds; no CI deployment is added.

## Architecture

- `platforms.ts` is the route/identity, navigation and footer registry; only Instagram and
  WhatsApp are exposed. The shared shell chooses navigation and brand identity
  from the active route. Both platforms use current main's InstaScope styles.
  `globals.css` and `actions.css` are restored directly from main, with no
  platform theme variables or page wrapper styles. The header retains main's
  geometry, navigation and privacy note; only its top-left brand opens the native
  platform selector. Disabled builds retain the existing Instagram shell. Typography,
  spacing and generic actions stay shared. Wrapped uses the existing InstaScope
  card palettes for its screen preview and local PNG output.
  Each platform has an explicit availability decision; WhatsApp opt-in cannot
  automatically expose a future unfinished platform.
- `src/lib/whatsapp` owns its types, parser, normalization, bounded importer,
  pure analysis and story model. It imports no Instagram domain types.
- `src/components/whatsapp` owns an independent tab-memory provider, import UI,
  factual charts and local Wrapped drawing/sharing. Platform navigation preserves
  active data across routes; reload/clear removes the chat. No chat persistence,
  account, credentials, cloud sync or new analytics event is introduced.
  Clearing/unmounting terminates a pending reader. An accepted replacement resets
  chart, participant and card navigation; a failed import keeps the prior chat.
- `/whatsapp/`, `/whatsapp/chat-analyzer/`, `/whatsapp/wrapped/` are gated server
  pages. The product is independent and not affiliated with WhatsApp or Meta.

## Explicitly supported input

Choose one UTF-8 `.txt`, or one single-disk ZIP32 containing exactly one chat
`.txt`. Non-TXT companions and attachments are counted and ignored, never
decompressed or interpreted as messages. A chat TXT plus a Markdown companion
works; a second TXT remains ambiguous even if named like a readme. No source
filenames are displayed by format detection or the Doctor.
Multiple TXT candidates, encrypted/multipart/ZIP64/damaged archives, invalid
UTF-8 and resource-limit breaches fail with a controlled explanation.

Limits are 20 MB for chat text, 1 GB for the ZIP, 4 MB for its index, 10,000 ZIP
entries, 200,000 records and 10,000 participant labels (256 characters each).
The import worker has a 45-second timeout. These are safety ceilings, not a
promise that every phone can comfortably analyze a chat at the maximum size.

Selecting a file first runs structural detection in a local worker. Every
recognized timestamp header contributes to the candidate intersection. The UI
shows wrapper, date-order candidates, year width, clock convention, precision
and coverage before parsing. The user must confirm even an unambiguous result;
DMY/MDY ambiguity requires a deliberate choice. The original manual format
selector remains available. Invalid, mixed or unsupported timestamp headers
cannot silently become message continuations.

Synthetic regression fixtures cover DMY/MDY slash dates, YMD hyphen dates,
24-hour clocks or English AM/PM, and Android `date, time - sender: content` or
iOS `[date, time] sender: content` wrappers. Slash DMY/MDY supports YY alongside
YYYY. **The explicit century rule is 2000 + YY (00–99 means 2000–2099)**, with no
rolling pivot or current-year guess. Historical YYYY dates remain unchanged;
year width and optional seconds remain source facts. YMD requires YYYY.

INS-120 used one private local iPhone ZIP to verify slash YY, MDY, English AM/PM,
second precision, generic preamble/continuation structure and the bounded German
markers below. It is evidence for those exact structures, not every iPhone,
Android, locale or WhatsApp version. No private records, names, filenames,
coordinates, URLs or media were copied into the repository or review material.
Named/localized months, translated AM/PM and unknown wrappers need further
verified evidence. Four-digit years are 1000–9999.

Dates must be valid Gregorian calendar dates and clock values. Exports provide
no timezone; stored calendar fields and duration/gap calculations describe
recorded wall-clock values, not exact UTC elapsed time. Day/month/hour/weekday
charts use those recorded fields, not an inferred viewer timezone.

Untimestamped preamble is counted and discarded, never rendered as a message
sample. Its presence makes coverage partial. Multiline text continues the
preceding record. A pasted line identical to an export header is inherently
ambiguous; the UI explains that text exports do not
prove every boundary. Header-shaped unsupported/mixed formats are rejected.
Sender labels are grouped exactly as exported, not treated as verified account
identity. System lines without a sender delimiter are separate from participant
messages. Export text is never executed or inserted as HTML.

## Factual analysis and limitations

Counts cover supplied participant messages, separate system events, messages
per exported label, first/latest recorded timestamps, observed span, yearly/
monthly/daily activity, weekdays/hours, busiest recorded periods, exact supported
media placeholders, HTTP(S) link occurrences, supported emoji graphemes, longest
observed wall-clock gap and consecutive recorded active days. Missing periods
are not reconstructed; a gap means no message in this export, not that nobody
communicated. First/latest records do not establish the real start/end of a
relationship. No compatibility, love, toxicity or personality scoring exists.
Participant lists and longer charts use bounded pagination; all recorded values
remain reachable. The activity calendar renders one selected month at a time.

Media counts recognize complete existing English omission markers and verified
German angle markers for images, video, voice messages, stickers and GIFs. The
document marker family is explicit, but filename/caption-bearing variants remain
unclassified: their contents and extensions are not used to infer media type.
Exact German deleted-message and call markers receive factual event types.
Call records without a sender delimiter remain system events; no duration or
direction is reconstructed. The verified location record shape requires an
in-range coordinate pair and an exactly matching Google Maps query in a complete
record. Its URL/coordinates stay local and do not enter link/emoji share totals.
Prose, incomplete markers and unverified variants are not treated as events.
No attachment is inspected or recovered. Link counts do not visit URLs or claim
uniqueness.
Emoji counts require native `Intl.Segmenter` plus supported Unicode emoji
sequence matching; unsupported runtimes show unavailable instead of zero.

## Chat Export Doctor and product truth

The loaded workspace shows Supported or Partially supported coverage, wrapper,
chosen date order, year width, clock/seconds precision, participant-label count,
recognized event kinds/locales, unclassified marker-like record count, preamble
count, and ignored non-TXT ZIP count. Unsupported structure or
ambiguity appears during preflight and cannot be confirmed without a compatible
choice. The Doctor contains only aggregate facts and fixed explanations, never
message bodies, participant names, file names, URL or coordinate samples.

- **Source facts:** recorded wall-clock fields, labels, recognized marker types,
  and skipped/unsupported structure.
- **Derived metrics:** counts and activity buckets from the supplied participant
  records; recorded spans/gaps are not UTC elapsed time or relationship history.
- **Unavailable:** read receipts, exact seen times, reply-to relationships,
  reactions, attachment contents, verified account identities, inferred call
  duration/direction or relationship/personality conclusions.

Detection and confirmation each use the same bounded reader and ZIP integrity
checks. Staged files and results are ephemeral. Cancel, replacement, clear and
unmount terminate pending workers and discard staged references; failed imports
keep the previously accepted chat available. No server, storage, analytics event
or production binding was added for the Doctor.

## Analyzer V2 Part 1: view-only filters

Chat Analyzer offers All time (the supplied export), a recorded year/month, or
an inclusive custom calendar-date range, combined with Everyone or one exact
exported participant label. Gregorian dates are validated strictly, including
leap dates and range order; invalid or incomplete choices show validation instead
of silently displaying all-time results. Filter choices stay in this view's
memory, never in URLs, browser storage or analytics. A newly accepted export
resets the view; a failed replacement retains the accepted source.

Pure filter functions select new record arrays and reuse the existing analysis.
They do not reparse, normalize again or mutate accepted records. The loaded-chat
banner, original export, reading notes and Chat Export Doctor describe the whole
source. Wrapped continues using the whole loaded chat; Analyzer filters do not
change its stories or shared output.

The filtered overview and existing calendar, year/month, hour, weekday,
participant, media/link/emoji, streak and gap figures describe matching records
only. Messages per active date divides matching participant messages by recorded
dates with at least one such message; it is unavailable when there are none.
An empty subset does not imply an empty original export or missing conversation.
Unknown emoji capability remains unavailable, including an empty subset.

Everyone includes date-matched system events separately from participant
messages. Selecting one label excludes all senderless system events: the source
does not identify their participant. Recognized call counts use only existing
typed call markers, separating sender-labelled and senderless records. A label
on a record is not evidence of call direction, duration or a verified caller.
Unsupported or absent markers are not inferred into call events. Participant
gaps and streaks refer to that label's included messages, not conversation silence,
reply behavior or relationship dynamics. Calendar counts exclude system events.

The 7×24 heatmap counts participant messages by their recorded calendar weekday
(Monday first) and hour (00–23). Intensity scales to the largest cell in the
selected subset; exact cell labels/tooltips and a keyboard-reachable Read weekday
and hour values disclosure provide counts without relying on color. Large cell
counts may be visually truncated; the labels and disclosure retain exact values.
Calendar arithmetic
does not infer a timezone, UTC event time, daylight-saving adjustment or online
presence. No sessions, word analysis, Wrapped V2, Vault or awards are implemented.

## Privacy and Wrapped

Files, text, sender labels, media, URLs and derived private statistics stay local.
No WhatsApp-domain code calls the product analytics collector. No archive, chat
identifier or persistent chat state is written to browser storage. Loading same-
origin application assets/worker code is not an archive upload.

Wrapped cards contain factual aggregate activity and anonymous participant
aliases, without personal labels, message bodies or link URLs. Review cards
before deliberately downloading or using the device share sheet: exported
statistics become a file that the user may choose to share. Card generation
does not contact a server or third-party inference service.

All tests use minimal synthetic fixtures. Automated desktop/mobile/WebKit
coverage is not physical iPhone/Android testing or evidence for untested real
exports/locales. New formats need representative, locally inspected evidence
and anonymized regression fixtures; never commit personal chats or media.

## Validation commands

`npm run check` and the full default Playwright suite validate the production
Instagram build plus disabled-route isolation. For enabled preview coverage,
build with `npm run build:dev`, set `EXPECT_WHATSAPP=true`, and run
`npx playwright test --config playwright.whatsapp.config.ts`. This focused
configuration includes desktop/mobile Chromium and iPhone WebKit emulation;
install those browsers with `npx playwright install chromium webkit` if needed.
Restore the production artifact with `npm run build:production` after review.

### Actual main visual reference (INS-122)

The visual source is main commit `4163a28836af20a5774f76a990c921066eb903f5`.
Build that checkout independently with `NEXT_PUBLIC_SITE_URL=https://instascope.me`
and `NEXT_PUBLIC_PREVIEW=true`, so optional remote services are disabled on both
local builds. Build the proposed dev branch with `build:dev`, then
set `MAIN_VISUAL_REFERENCE_DIR` to the absolute main checkout directory and run:

```text
npx playwright test --config playwright.main-visual.config.ts
```

The dedicated suite serves both static exports and compares full-page rendered
pixels plus computed styles and geometry on desktop/mobile Chromium. Only the
top-left identity is masked. It covers landing and fictional loaded states for
Dashboard, Followers, Cleaner, Wrapped and Vault, plus related tools and guides.
Instagram Wrapped remains `/instagram-wrapped/`; `/wrapped/` keeps its existing
404. CI repeats the comparison against that pinned main commit and retains both
screenshots. No personal exports, reconstructed token baseline, production
deployment or main merge is involved.
