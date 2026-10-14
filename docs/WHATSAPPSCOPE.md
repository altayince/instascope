# WhatsAppScope: local import and factual analysis

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
presence. Conversation-rhythm definitions below extend this filtered view;
Message Patterns & Content below extends the same selected view. Wrapped V2,
Vault and awards remain deferred.

## Analyzer V2 Part 2: recorded rhythm and dynamics

Rhythm uses only participant messages inside the selected date scope, sorted by
recorded wall-clock fields, then the accepted source record ID for equal values.
System events neither start nor split sessions and do not create transitions.
Same-timestamp order is deterministic source order, not evidence of real event
sequence; a zero delay means matching written clock values. No timezone, DST
correction, reply metadata or inferred elapsed time is added.

Conversation-relative rhythm is **unavailable whenever one participant filter is
selected**. The existing participant-only overview/charts remain usable. Choose
Everyone to calculate rhythm from all matching labels. A date filter cuts the
record sequence: its first message begins a recorded session, but never qualifies
as a long-gap starter without a predecessor inside the subset. Sessions at the
selection edges may be fragments; no outside message or missing history is used.
The accepted export, Chat Export Doctor and Wrapped remain unchanged.

| Metric | Definition and evidence | Classification and limits |
| --- | --- | --- |
| Conversation sessions | A new session starts at the first matching message or a consecutive participant-message gap **greater than 30 minutes** (`SESSION_GAP_MINUTES`). Exactly 30 minutes stays in the same session. | Derived grouping, not a verified real conversation. Totals, median messages and longest count/span describe selected records; equal longest values are ties. |
| Started recorded sessions | The exported label on the first participant message in each defined session. | Exact count under the derived session definition; not proof of who initiated conversations outside this export. |
| Long-gap starters / silence breakers | A previous matching participant message exists and its gap to the next is **at least 6 hours** (`SILENCE_BREAK_HOURS`). Credit the next sender, even when the label is unchanged. | Derived threshold; total qualifying gaps, their median and longest recorded gap describe absence of supplied participant messages. They do not prove actual silence, complete history or no communication elsewhere. |
| Participant transitions | Two consecutive matching participant messages have different exported labels, including across session boundaries. Record from/to labels, date/clock context, delay and same-session status; never bodies. | Exact adjacency count from accepted records. Contact labels are not verified people; adjacency is not a reply-to relationship or causality. |
| Next-message timing after another participant | All transitions where that label is the next sender. Show count, median, p25/p75 and delay buckets. | Derived wall-clock delay summaries, including long intervals across sessions; not response, read or seen timing. Missing observations have unavailable summaries. |
| Rapid transitions | Different adjacent labels, delay **at most 5 minutes** (`RAPID_TRANSITION_MINUTES`), and both messages in the same defined session. | Derived product threshold; next-sender counts and share of their observed transitions are not chemistry, closeness, attention or responsiveness scores. No share exists without transitions. |

Delay buckets have non-overlapping second boundaries: `[0, 60)`, `[60, 300)`,
`[300, 1800)`, `[1800, 21600)`, and `[21600, infinity)`. Thus exactly five minutes
belongs to the third bucket and may still be rapid; exactly thirty minutes belongs
to the fourth bucket but still shares a session. Median/p25/p75 use linear
interpolation at rank `(n - 1) × p` in sorted delays; even-count medians average
the two central values. Fractional derived values do not add precision to source
timestamps. Empty medians/quartiles/spans/shares are unavailable, not fabricated
zeros. A single message defines one session and a zero recorded session span,
without a preceding gap or transition. Equal participant values remain ties;
the UI provides no awards or inferred winners.

These are explainable calculations from accepted local records, not new source
evidence. Real replies, read/seen timing, intent, interest, affection and
relationship/personality interpretation remain **unavailable**. The rhythm model
retains no message bodies or link lists, stays in memory, and is never uploaded,
persisted or added to analytics. Native tables/text values and bounded participant
pagination keep every aggregate reachable without rendering a message transcript.

## Analyzer V2 Part 3: Message Patterns & Content

These pure modules consume the accepted messages selected by Part 1, without
reparsing or changing the export, Doctor or Wrapped. All-time, year, month,
inclusive range and participant filters apply. Results describe the selected
subsequence, not missing history. No new parser formats or markers are added.

| Metric                                   | Calculation and limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consecutive-message runs                 | Sort by recorded wall-clock, then accepted source record ID (input order as a final tie-break). Consecutive equal labels form a run; another label ends it. System events neither lengthen nor split runs. No time/session threshold applies. Buckets are 1, 2, 3–5, 6–10 and 11+. A participant filter removes intervening labels, so its runs describe that selected subsequence, not the full conversation.                                                                                                                                                                        |
| Highest recorded 10-minute message burst | Maximum participant-message count in an inclusive rolling `[end − 10 minutes, end]` window (`BURST_WINDOW_MINUTES = 10`). Exactly ten minutes counts. Evaluate distinct recorded message end times, including all equal-time messages. Ties count distinct maximum end times, even when windows overlap; show up to three first/last included recorded-clock examples. Per-label windows count only that label. No timezone, online presence or inferred excitement.                                                                                                                  |
| Messages containing a question mark      | Count literal ASCII `?` across all selected participant records, including URL query strings. Show messages containing it, total occurrences and share of selected messages; this is not semantic question detection. Other question-mark glyphs do not count. Empty shares are unavailable.                                                                                                                                                                                                                                                                                          |
| Text lengths                             | Ordinary nonempty participant text only: exclude existing typed media, call, deleted-message and location records, and existing known omission-prefix-with-extra-content records. NFC-normalize and trim edges, then count Unicode code points, including internal spaces/newlines, punctuation, URLs and emoji code points. These are neither UTF-16 units nor visual graphemes. Word units count URL-stripped letter/mark runs before lexical thresholds/stopwords. Median, p25 and p75 linearly interpolate sorted observations at `(n − 1) × p`; empty summaries are unavailable. |
| Media and emoji                          | Reuse the accepted seven-kind media taxonomy and supported emoji graphemes; do not inspect attachments or infer unknown media. Show exact marker/occurrence counts and attributable per-label counts. Source-wide emoji-unavailable remains unavailable even if a filter removes the affected record or selects no messages.                                                                                                                                                                                                                                                          |

**Lexical rules.** Strip scheme URLs, `www` URLs, common nonhierarchical URI
forms and email addresses locally, without fetching them. Bare hostnames with
neither scheme nor `www` remain text. NFC plus Unicode default lowercase is
fixed for every export; fold the combining dot produced by capital `İ` to `i`,
preserving lowercase dotless `ı`, German umlauts and `ß`. Without language
detection, ASCII capital `I` lowercases to `i`; Turkish I/ı variants and German
ß/ss variants may therefore remain separate. No stemming or language detection.
Tokens are Unicode letter/mark runs; apostrophes and hyphens delimit them.
Pure numbers, punctuation and emoji are not words. Use the union of separately
maintained Turkish, German and English stopwords on every export, so a word can
be excluded even when it is a stopword in another language. Require 2–40 code
points and at least two occurrences for displayed top words. Eligible-word
denominators include all surviving occurrences, including singletons. Show up to
20 words overall/per label, sorted by count then binary normalized spelling.
The deterministic local flex word cloud displays that same bounded list with a
count-list fallback. No raw message samples are rendered.

**Words used disproportionately often.** Compare each label with all other
selected labels aggregated, not raw counts. Require at least 20 eligible words
for both populations and at least three own occurrences of a candidate. For own
count `c`, other count `d`, own total `N` and other total `M`:

```text
own per 1,000 = 1,000 × (c + 0.5) / (N + 1)
others per 1,000 = 1,000 × (d + 0.5) / (M + 1)
ratio = own per 1,000 / others per 1,000
```

Require ratio ≥ 2; show at most ten, sorted by ratio, own count, then normalized
spelling. The 0.5 smoothing keeps a zero other count finite. One selected label,
insufficient evidence or an explicit participant filter makes comparison
unavailable. Enough evidence with no qualifying word is an empty result, not a
personality conclusion. Filter changes recalculate the denominators and words.

Exact evidence comprises recognized media markers, supported emoji occurrences,
literal question marks and lexical counts under these declared rules. Runs,
rolling bursts, length summaries, top-word selection and normalized comparison
are derived, with the same calculation disclosure available in the UI. Sentiment,
intent, personality, relationship quality, real replies and read/seen data remain
unavailable. Content, words, labels and derived private statistics stay in local
memory: no logs, storage, URL parameters, analytics or network payloads are added.

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
