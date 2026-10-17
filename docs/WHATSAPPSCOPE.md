# WhatsAppScope: local import and factual analysis

WhatsAppScope is released through merged PR #147. Unreleased roadmap work still
starts from `dev` and targets `dev`; explicitly requested production fixes and
SEO follow the main-based rules in [WORKFLOW.md](../WORKFLOW.md). INS-154 prepares
the public search launch separately, without merging or deploying it.

## Release isolation and local review

`PLATFORM_RELEASES` in `src/lib/platform-config.ts` is the reviewed release
decision: Instagram and WhatsApp are released; unknown platforms are not.
Intentional production contexts use the existing production-origin/host detection
and retain all four WhatsApp routes plus the switcher without preview opt-ins.
`build:production` explicitly selects that artifact. Recognized Cloudflare main
builds normalize inherited preview flags through the production build path.
Unknown/unconfigured contexts remain disabled; a development preview still
requires both opt-ins and a known non-main branch. The Workers branch-preview
dispatcher remains separate from release availability. INS-154's shared public
inventory registers the four tool landing pages, guide hub and ten guides for
production `index, follow`, self-canonicals and sitemap inclusion. Chat Vault's
public education does not expose saved records or create private result URLs.
Preview/unknown contexts retain `noindex, nofollow`, robots Disallow all and an
empty sitemap. Instagram public/private rules remain unchanged. See
[search readiness](search-readiness.md) for the complete current policy.

From a dev-derived branch:

```text
npm run dev:family
npm run build:dev
npm run preview
```

The dev build is a local/preview artifact, not a deploy command. It leaves remote
analytics and the optional Instagram photo endpoint disabled by default. Do not
publish its `out` directory to production. Rebuild with `build:production` to
restore the release artifact. CI separately validates the combined production and
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
  active data across routes; reload/clear removes the chat. Raw chat content and
  identities are never persisted. Explicit aggregate-only Chat Vault saves are
  separate from that working copy; there are no accounts, credentials, cloud
  sync or new analytics events.
  Clearing/unmounting terminates a pending reader. An accepted replacement resets
  chart, participant and card navigation; a failed import keeps the prior chat.
- `/whatsapp/`, `/whatsapp/chat-analyzer/`, `/whatsapp/wrapped/` and
  `/whatsapp/chat-vault/` are gated server
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
Message Patterns & Content below extends the same selected view. Wrapped V2
uses the full source instead, as documented below. Chat Vault also saves the full
source's approved aggregates. Snapshot Compare and Conversation Pulse consume
those saved aggregates separately below; awards remain deferred.

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
retains no message bodies or link lists, stays in memory, and is never uploaded
or added to analytics. Only explicitly selected scalar summaries enter Chat
Vault after a deliberate save; sessions, transitions and participant mappings
are not persisted. Native tables/text values and bounded participant
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
unavailable. Content, words and labels stay in local memory: no logs, URL
parameters, analytics or network payloads are added. Only approved numeric
summaries enter Chat Vault after an explicit save; words, emoji glyphs and source
contexts never do.

## Privacy and Wrapped

Files, text, sender labels, media, URLs and derived private statistics stay local.
WhatsApp adds no semantic product analytics. The shared root initializer retains
INS-134's once-per-full-Document entry on either platform, with only the approved
bounded `{event, source, webdriver}` envelope and existing DNT suppression.
SPA platform changes do not create another document entry. No archive, chat
identifier, participant mapping or raw chat state is written to browser storage.
Explicit Chat Vault snapshots contain only the approved aggregates below. Loading same-
origin application assets/worker code is not an archive upload.

### Wrapped V2 (INS-132)

Wrapped always describes the full accepted export, independent of temporary
Analyzer filters. It consumes existing activity, rhythm and content analysis;
parser, Doctor and metric definitions are unchanged. Pair mode means exactly
two exported participant labels; three or more uses bounded group rankings.
Cards use exported display names in accepted participant order, not verified identities. Number-only labels use neutral Contact labels.

The evidence-rich default deck has up to 12 cards: opening, message split,
busiest recorded date, recorded hour distribution, active-date streak, sessions,
session starters, long-gap next senders, next-message rhythm, message patterns,
media/emoji and closing. Group rankings show at most four display names plus
a remaining-label count. Equal maxima are explicitly tied, including leaders
outside the displayed rows. One-label and sparse exports get fewer cards rather
than invented comparisons. Empty input gets no deck.

Pure evidence rules in `stories.ts` skip weak cards: activity needs four
messages; participant comparisons need two labels with at least two messages
each; date/hour peaks need two messages; a streak needs two dates;
sessions and long-gap observations need three;
transition timing needs four observations, including four per displayed label;
a burst needs three messages, or run evidence needs four runs with a longest
run of at least two. Media needs two markers or three supported emoji
occurrences. Source-wide unsupported emoji stays unavailable. These are display
thresholds, not statistical significance. Each selected card has a native
**How this is calculated** disclosure outside the artwork, with Exact/Derived,
definition, evidence rule and limits. Recorded-clock metrics never imply a
timezone, replies, presence, intent or relationship quality.

Word insights are always enabled and open the deck when the existing evidence
rules qualify: at least six eligible text messages, 20 eligible words and two
distinct words occurring at least three times each. At most six words are shown,
excluding participant-label tokens as an extra precaution. Otherwise the deck
opens with the conversation card. At the 12-card cap the word card replaces the
standalone streak card; the busiest-date summary retains the longest streak.

Artwork can contain exported display names and derived words, alongside factual
aggregates and date-only summaries. Number-only labels are replaced. Raw message
bodies, URLs, filenames and coordinates are not projected into the artwork.
Names and words stay local; one reminder beside export controls asks users to
review before sharing. Parser notes remain in the application methodology,
outside the artwork. Preview and PNG use the same 1080×1920 renderer with an accessible
text equivalent and a readable fallback if canvas is unavailable. Swipe,
arrows, Home/End, slide announcements and the existing InstaScope story palettes
are preserved. Share uses the prepared local PNG with the device share sheet
where supported, otherwise downloads it; cancellation leaves the card ready.

**Export full deck** sequentially renders the current deck into a browser-local
ZIP using the existing `fflate` dependency. Filenames contain only ordered static
card IDs, with generic ZIP metadata. Safety limits are 12 cards, 8 MiB per PNG
and 32 MiB of PNG payload; actions are locked while progress is shown. Clearing
or replacing the source cancels pending export and prevents stale downloads.
No server renderer, new telemetry, network request or storage is added. Review
cards before deliberately sharing: downloaded statistics become a file outside
the app's control.

All tests use minimal synthetic fixtures. Automated desktop/mobile/WebKit
coverage is not physical iPhone/Android testing or evidence for untested real
exports/locales. New formats need representative, locally inspected evidence
and anonymized regression fixtures; never commit personal chats or media.

## Chat Vault V1 (INS-136)

Chat Analyzer's **Save to Chat Vault** action deliberately projects the full
accepted export through the existing analysis functions. Current date and
participant filters are not saved. Opening/importing a chat or viewing Analyzer
never saves a snapshot. Fictional demo saves are disabled, including in the
projection layer. `/whatsapp/chat-vault/` lists saved snapshots without needing
the original export; it cannot reopen that chat. Clearing/reloading the active
chat does not delete the Vault.

The pure `chat-vault.ts` domain module separates projection, strict validation,
canonical serialization and preview from persistence. V1 stores schema and
metric-definition versions, an opaque random local UUID, actual UTC save time,
recorded participant-message date coverage and precision/source-support enums.
Only selected numeric totals, fixed hour/weekday/heatmap/media distributions,
streak/gap, session/transition and message-pattern/text-length summaries follow.
No daily record series, sessions, transitions, burst contexts, lexical words,
emoji glyphs, source files, raw messages, participant names/IDs/aliases, phone
numbers, URLs, labels or fingerprints are stored. `supported` describes source
structure, not complete history; missing summaries/emoji remain unavailable.
Source coverage excludes system-only dates and has no inferred timezone.
Exact supplied counts and derived threshold summaries retain the Analyzer's
methodology; `definitionsVersion: 1` allows future comparisons to reject
incompatible metric definitions.

`ChatVaultStorage` uses a separate IndexedDB database,
`instascope:whatsapp-chat-vault`, version 1, with an ID-keyed `snapshots` store.
It reuses the existing Snapshot Vault transaction/open/timeout mechanics through
`local-indexeddb.ts`; Instagram schema, migration and conflict rules are unchanged.
Existing `BackupFilePicker`, `VaultConfirmation`, action controls and local Blob
download infrastructure are reused. There are no backend calls or new analytics
events. Other platform stores are isolated.

V1 deliberately has no conversation identity, automatic grouping or user label.
Equal coverage/counts do not identify a chat. Separate explicit saves get
different random IDs; importing an existing ID always keeps the local entry.
There is no automatic replacement or eviction. Future comparison must require
explicit selection and cannot infer identity from these aggregates.

The store holds at most 100 entries, including unreadable ones. JSON backups use
`format: "whatsapp-chat-vault"`, version 1, and only validated snapshots, ordered
by saved time and ID. Input is bounded to 2 MiB and 100 unique snapshots. Unknown
versions, malformed structures, extra fields at every level, invalid dates,
nonfinite/out-of-range numbers and inconsistent distributions are rejected
before writing. Selection validates and shows a readonly current-ID preview;
only explicit confirmation merges, rechecking IDs in one atomic transaction.
Errors roll back all additions. Existing entries, even unreadable ones, are not
overwritten. Corrupt rows are disclosed without crashing the app; backup refuses
partial output. Explicit confirmed unreadable-entry removal preserves valid
records and enables recovery. Storage errors leave analysis usable.

Everything stays on this browser/device. Clearing site data may remove snapshots;
backup is manual, local and not a cloud copy. Even anonymous aggregate counts and
dates may be personal, so keep downloaded files private. History charts and
product release remain separate work.

## Snapshot Compare / Conversation Pulse (INS-138)

Chat Vault offers two native snapshot selectors and a same-conversation
confirmation. No association is inferred or persisted. Compare explicitly reads
both selected records in one existing readonly storage transaction; missing,
changed or unreadable selections and unavailable storage invalidate consent and
results. Focus refresh also rechecks the displayed pair. Selection/results stay
in this view's memory. Saving, deletion and V1 backup/import are unchanged.

`chat-vault-compare.ts` consumes and strictly validates V1 snapshots, with no new
parser, Analyzer, persistence schema or raw-chat dependency. Unsupported
schema/definitions/scope, invalid aggregates and the same ID are rejected.
Unequal recorded coverage ends determine display order; otherwise actual save
times, then IDs, provide a stable fallback. The UI states the order basis and
does not present an ID tie as chronology. Different starts, equal ends, disjoint
or missing coverage, partial source support, mixed/different precision and
conflicting save/coverage order are structured limitations, not automatic
rejection. Even aligned coverage cannot prove equal messages or chat identity.

The typed result contains exact count differences and derived recorded durations,
session/run/text summaries and normalized distributions. Hours, weekdays and
7×24 cells divide by each snapshot's own message count; media mix divides by
recognized media messages, transition mix by next-sender transitions. Raw counts
remain visible alongside shares. Share differences use percentage points; zero
denominators and missing values stay unavailable, never fabricated zeroes.
Overview appears first; native disclosures group activity, rhythm, media and
message-pattern detail. Paired bars share a 0–100% scale, and the delta heatmap
has exact textual values and a keyboard-accessible scroll region on mobile.

`conversation-pulse.ts` derives at most five observations from comparison facts.
Display rules require both usable values and meaningful absolute/relative
differences with minimum message/session/transition/text/media evidence. Rules
include message totals (at least 10 and 10% of the larger saved total), active
dates, session size, longest recorded gap, transition median, text median and
question-mark share. Distribution candidates require at least 10 percentage
points for activity, 15 for media/transition mix and their own minimum counts.
Candidates rank by bounded threshold exceedance, then fixed rule priority;
declared bucket order resolves equal distribution changes. At most one
activity-timing and one transition-timing theme is shown.
Every item exposes its metric key, earlier/later values, delta, classification
and threshold explanation. These are deterministic noise/display thresholds,
not statistical significance, confidence or relationship scoring. No meaningful
change produces an explicit empty Pulse rather than manufactured observations.

All copy describes differences between saved **full-export aggregates**. V1 has
no message membership, so subtraction cannot identify messages sent between
snapshots, a new month, replies, causes or relationship changes. Recorded clocks
have no inferred timezone. Participant counts are exported-label counts only;
no identity, who-joined/left or responsiveness inference is possible. There are
no LLM/API calls, comparison analytics events, fingerprints or stored pairings.
INS-144 prepared intentional production availability, subsequently released in
PR #147. INS-154's public search launch does not change these comparison rules;
the [release checklist](WHATSAPPSCOPE_RELEASE.md) preserves the historical sequence.

## Group presentation (INS-140)

Three or more exported labels use group presentation, not verified group
membership or identity. Analyzer message rows sort by descending count; equal
group counts retain accepted source-label order and display the same count
rank. Tie counts include labels on every page. Eight rows are shown at a time,
with the displayed range and additional-label count explicit; all rows remain
reachable. Shares still divide by all selected participant messages, including
off-page labels. Rounded displayed shares may not add to exactly 100%.

Wrapped count rankings retain their existing four-label cap, full-population
totals and maximum ties. Next-message timing cards now also disclose qualifying
labels outside their four displayed rows, in both accessible text and PNG.
Cards use local display names with number-only labels protected; timing is recorded adjacency, never proof of replies.
Individual PNG preparation retains the eager draw/toDataURL/File path; the
separate full-deck ZIP encoder still produces Blobs asynchronously.

Synthetic 3-, 8- and 24-label groups cover ties, pagination, whole-population
denominators, equal-clock transitions and group-local content. Group Vault
saves and backups keep the unchanged V1 aggregate schema, without participant
names, IDs, aliases or conversation identity. Explicit comparison uses the
same compatibility rules and describes participant-count differences only;
it cannot identify anyone joining or leaving. Pair presentation, parser,
Doctor, Rhythm, Content, Vault and Compare/Pulse definitions are unchanged.

## Release hardening (INS-142)

Import completion preserves accepted local data when switching routes, without
letting an unmounted import view redirect the user afterward. Empty filtered
analysis has no observed span rather than a fabricated zero-duration coverage.
Individual PNG download failures show a recoverable status; eager
draw/toDataURL/Uint8Array/File preparation and the async full-deck ZIP path are
unchanged. Vault backup checking/export announces its local working state.
Synthetic recovery tests cover browser download failures, import navigation,
storage/restore retry and corrupt/incompatible comparison selections.

Parser formats, Doctor, metric definitions, privacy boundaries and Vault V1
schema are unchanged. INS-142's preview-only production exclusion is superseded
by the explicit INS-144 release decision below; preview metadata stays
noindex/nofollow. The [owner-run release checklist](WHATSAPPSCOPE_RELEASE.md)
separates preparing the gate from the actual owner production release.

## Production release gate (INS-144; historical indexing policy)

One repository release state feeds Next's compiled availability and static output
pruning. Known main Cloudflare builds use the explicit production wrapper, so
inherited preview flags cannot accidentally make Instagram noindex. Production
keeps all existing Instagram pages and all four WhatsApp tools. The original
INS-144 release kept WhatsApp page-level noindex/nofollow and outside the sitemap,
with robots permitting crawlers to read that metadata. INS-154 supersedes only
that public indexing policy through the shared inventory described above; the
release gate and private-data boundaries remain unchanged.

Recognized non-main Workers builds retain INS-142's development path, globally
noindex with Disallow all and an empty sitemap. No-origin/unconfigured or unknown
host contexts do not gain production availability. Future platforms are not
implicitly released. No parser, analysis, sharing, Vault V1, analytics event or
privacy contract changes. Physical-device pre-certification is skipped by owner
decision, not completed; manual production testing follows the owner's release.

## Validation commands

`npm run check`, an explicit `npm run build:production` and the full default
Playwright suite validate the production artifact and its public/private search
policy. Run `node scripts/audit-public-seo.mjs --static out` against that output.
For preview coverage, build with `npm run build:dev`, audit using
`node scripts/audit-public-seo.mjs --static out --mode preview`, set
`EXPECT_WHATSAPP=true` and `EXPECT_INDEXABLE=false`, and run
`npx playwright test --config playwright.whatsapp.config.ts`. This focused
configuration includes desktop/mobile Chromium and iPhone WebKit emulation;
install those browsers with `npx playwright install chromium webkit` if needed.
Restore the production artifact with `npm run build:production` after review.

### Actual main visual reference (INS-122)

The INS-146 visual source is the actual reviewed current main commit
`cb0a78099565aa601c7bc18c93f11330091d2e6f`.
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
