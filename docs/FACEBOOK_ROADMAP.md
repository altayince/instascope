# InstaScope / Facebook: Roadmap V1

Status: FB-01 implemented for review; unreleased. Tracker: [INS-158](https://github.com/altayince/instascope/issues/158). Task: [INS-159](https://github.com/altayince/instascope/issues/159).
Updated: 17 October 2026.
This document contains public-safe product decisions and generic schema descriptions only. Do not copy private archive contents or the separate owner audit into the repository.

## Product decision

Facebook is the third area under InstaScope. Messenger is a tool within Facebook, not a separate sub-brand. The product combines:

1. Friends Explorer: connections and recorded dates.
2. Messenger Library and Analyzer: searchable conversations, words, emoji and activity.
3. Time Capsule: the owner's recorded posts/comments and changes in vocabulary over time.
4. App Time Machine: connected-application history and statuses as recorded in the export.
5. Personal Wrapped: My Facebook Wrapped and My Messenger Wrapped.

Comparison and Digital Footprint are follow-ups. LinkedIn is outside this work package.

## Evidence that changes the plan

The supplied sources are JSON and HTML representations with matching conversation folders, record counts and friend-name multisets. They must not be treated as independent historical snapshots or summed together. This observation does not certify every field in the complete archives as equivalent.

The source contains usable friends, received/rejected/removed connection records, outgoing following, Messenger conversations, mixed post/media/check-in records, comments, reaction records, installed-app history and off-Meta/advertiser categories. Availability differs by category. A sent-friend-request file and an incoming follower list were not established in these inputs.

Important observed edge cases:

- Friend records contain names and timestamps, but no stable friend IDs/profile URLs. Duplicate names occur.
- Distinct Messenger thread paths can share the same title. A stable per-message ID was not observed.
- JSON text contains UTF-8 bytes misrepresented as Latin-1 characters. Valid Unicode must not be damaged while restoring supported mojibake.
- Message timestamps are epoch milliseconds. Do not force them into WhatsApp's timezone-free wall-clock representation.
- Two reaction representations coexist with overlapping timestamps. This is evidence of possible overlap, not a deduplication key. Some timestamps are 0/1-like placeholders; don't generate a 1970 story from them.
- Recent message coverage is sparse despite a recent export-generation date. Do not equate missing recent records with inactivity or complete encrypted chat coverage.
- A directory named `e2ee_cutover` is present; it does not certify support for a separately downloaded secure-storage backup.
- Nested IP fields exist inside some message records. A path allowlist alone is insufficient: explicitly project permitted fields.
- Security/session/cookie, payment, precise-location and imported-contact data are outside product scope. Ignore media and office-document bytes by default.

## Prioritized execution plan

| ID | Scope | Acceptance gate | Status |
|---|---|---|---|
| FB-01 | Preview-only Facebook entry, browser-local JSON + HTML ZIP import, coverage summary and Friends Explorer. | Both supplied representations privately validated; names, duplicate source rows and recorded dates match using an explicit timezone. Search/date sorting/year groups, separate received/rejected/removed categories, missing versus empty, safe bounded ZIP reading and cancellation. | Implemented for review in INS-159; merge and release pending |
| FB-02 | Messenger adapter and conversation library. | Inbox/archived/filtered/requests/e2ee-cutover folders remain distinguishable; same-title conversations remain separate; selected-thread loading and epoch-ms semantics are correct; synthetic split-file cases preserve order and don't silently deduplicate identical messages. | Queued |
| FB-03 | Messenger analysis and local transcript search. | Most-used words first, large emoji, per-person/date filtering, calendar/hour heatmap, native reactions when supplied. Group/empty/partial data supported. No attachment fetching, inferred replies, sentiment or relationship scoring. | Queued |
| FB-04 | Time Capsule and App Time Machine. | Recorded posts/comments grouped by year; grounded vocabulary comparisons; reaction-source overlap handled; unknown dates remain unknown. App statuses reflect the exported category, not a live permissions audit. | Queued |
| FB-05 | Personal Facebook/Messenger Wrapped. | Strongest eligible card first; words on when supported; names with number-only fallback; clean captions; fictional demo label; PNG/ZIP/preview parity, accessibility and explicit sharing. | Queued |
| FB-06 | V1 hardening, owner release and useful SEO. | Representative real-input acceptance privately; synthetic regression fixtures; responsive Light/Dark; isolated production/preview policy; useful public pages and export guidance. Owner approves dev-to-main release. | Queued |
| FB-07 | Deliberately saved snapshots and comparison; optional reconnect review. | Independent older/newer inputs, explicit account confirmation, conservative matching and ambiguity display; separate bounded storage schema, export/restore/delete. No definitive unfriend claims from absence alone. | Post-V1 |
| FB-08 | Optional Digital Footprint explorer. | Off-Meta event and advertiser-list semantics verified; overlaps and category limits visible; no inferred sensitive traits or claims that every advertiser currently tracks the user. No default sharing. | Post-V1 |

A milestone is a work package, not a mandate for one huge PR. Split only when needed for reviewability. Never implement the whole table in one session. V1 ends at FB-06; FB-07/08 do not delay the first release.

HTML compatibility is part of FB-01 under the owner's current request. The older package's JSON-only/FB-00 sequence is superseded. Supported HTML uses inert parsing and explicit English/Turkish dates. Record dates omit their timezone; preserve wall-clock dates and disclose this limitation rather than inferring instants. Independent secure-storage exports still require their own source evidence.

## Feature direction

### Friends Explorer

Search the supplied friend records, inspect recorded dates and year cohorts, and review distinct received/rejected/removed categories. Outgoing follows are not incoming followers. Label removal records conservatively unless the source establishes direction. Never advertise them as proof of who removed the owner. Local row IDs are not cross-export identities. Do not merge names, fabricate profile links or automatically join friend rows to Messenger participants.

### Messenger Library and Analyzer

A conversation picker is essential: use source thread identity, folder category, coverage and local counts. Default to a selected conversation, not an all-chat dump. Separate participant messages from verified system events; unsupported event-shaped records retain an explicit unknown classification. Body text can contain automated/system notices and is not sufficient by itself to classify a human message.

Display words and large emoji near the top. Reuse existing text/emoji analysis when its assumptions match. Activity uses a declared timezone/display policy. Reactions and call fields are conditional; do not infer read receipts, attachment contents or reply relationships from adjacent messages. Transcript search remains entirely local with safe text rendering and bounded results.

### Time Capsule

Use mixed post/check-in/photo records and authored comments to let the user revisit a year, see its words and compare periods. Do not call every record a standalone written post. Compare vocabulary on a stated denominator; don't confuse unequal archive volume with a personality change. Keep private excerpts local. Source missingness and unknown dates must remain visible outside shared artwork.

### App Time Machine

Make the application's recorded added/removed dates and exported active/inactive/removed category understandable. Provide useful manual-review guidance, not automatic revocation. An old `active` value is not a current live permission check. Exclude app-scoped identity values from normalized analytics and shared cards.

### Wrapped

Preserve the owner's current design decisions: Light by default, optional Dark; words enabled whenever eligible; real exported display names with number-only fallback; concise My Facebook Wrapped / My Messenger Wrapped headers. Avoid parser footnotes inside artwork, but retain meaningful metric labels and an app-level methodology section. Show a brief names/words sharing reminder near controls. No invented names, old-year totals, relationship judgments or undefined empty cards. Privacy-sensitive advertising/contact/login information stays out of the default deck.

Candidate cards include recurring words, top emoji, busiest recorded year, long-standing current friend records, own reaction mix, vocabulary then/now and old-app eras. Every card has an eligibility rule and defined data scope. These are proposed features, not implemented behavior.

## Reuse and boundaries

Reuse the shared platform shell/theme, accessible controls, selective archive reader, worker cancellation/error handling and existing canvas/ZIP techniques. Keep Facebook's source adapter and any future storage schema separate. Extract a shared helper only when it is genuinely used by both products; do not create a generic multi-network framework in advance.

No login, scraping, account automation, cloud analysis or new backend. Do not attach original exports to GitHub. Public synthetic examples must be written from scratch, not a real conversation with renamed people. Explicitly drop nested identity/device/IP data, keep filenames generic for downloads, and never transmit chat/word/name content to analytics, URLs, public metadata or error logs.

## Workflow and development baseline

Follow CURRENT WORKFLOW.md. Unreleased Facebook work targets `dev`; production continues on `main`. For this kickoff only, the owner explicitly authorized replacing old dev history with current main using an exact force-with-lease, with no backup/merge/synchronization PR. Both fetched refs were verified at `c9b15beb53eb80faecdd98cf73e5d4051235e90f`. Main was not modified. This one-time authorization does not change the normal no-force-push policy.

FB-01 branches from synchronized dev as `feature/INS-159-facebook-friends-explorer`. The owner requests one PR to dev, no merge and no deployment.

## Durable tracking and token economy

Roadmap tracker: [INS-158](https://github.com/altayince/instascope/issues/158). FB-01: [INS-159](https://github.com/altayince/instascope/issues/159). Both are assigned to altayince and added to INS. Create later milestone issues when work starts, not as a batch.

Canonical repository files:
- `docs/FACEBOOK_ROADMAP.md`
- `docs/FACEBOOK_EXPORT_SUPPORT.md`

Every subsequent PR references the roadmap tracker, updates only its affected milestone/support row and records implementation/CI/release state separately. Do not close the whole roadmap with an early PR's Fixes keyword. Owner/reviewer marks merged work complete based on actual PR state.

Read only task-relevant context. Focused local checks; full required CI on the PR. Avoid repeatedly running successful full suites, broad searches, duplicated research and unsolicited redesigns. Required integration/privacy checks are not optional merely to reduce tokens.

## Competitor evidence retained

- T.LY Facebook Unfriend Checker: local friend-list comparison and its acknowledged duplicate-name limitation. https://t.ly/tools/facebook-unfriend-checker
- ChatPeek Messenger Analyzer: words, emoji, reactions, activity and exportable summaries. https://chatpeek.app/facebook-messenger-analyzer/
- FriendFilter: usable filtering/review workflows; exclude automated removals and unsupported engagement classifications. https://friendfilter.com/

These are product-page observations, not independently tested performance, popularity or privacy guarantees. Time Capsule, App Time Machine and the optional footprint module were selected from the supplied export categories, not because a competitor demanded them.

## Release and success

At FB-06, propose only functioning public pages such as `/facebook/`, `/facebook/friends-analyzer/`, `/facebook/messenger-analyzer/`, `/facebook/time-capsule/`, `/facebook/wrapped/` and focused export/interpretation guides. Exact routes remain a reviewed implementation decision. Preview stays noindex; private state never becomes a public per-person/per-chat URL. Do not create keyword-variant pages just to enlarge the sitemap.

Evaluate correct import -> first useful result, successful PNG/share, and Google clicks on Facebook public pages. Use existing permitted aggregate events where possible; any analytics schema extension is a separate explicit decision. Do not claim traffic recovery or Google indexing from a green build.
