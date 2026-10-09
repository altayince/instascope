# Relationship context (INS-94, INS-96)

## Observed history

`analysis/relationship-history.ts` validates Vault V1 records, normalizes usernames with the existing helper, and builds chronological per-snapshot follower/following Sets. `accountHistory` returns one point per readable snapshot: `mutual`, `follows-you`, `you-follow`, or `absent`. Corrupt records are skipped using the existing policy, never substituted with an absent point. Ordering uses export date, then snapshot ID.

Adjacent transitions describe observed list membership between two export dates. They do not establish an exact event time, deletion, block, reason, uninterrupted relationship, or rename. One point needs another snapshot to observe changes; one observed presence is explicitly limited history. All saved exports must belong to the same Instagram account; usernames cannot verify identity.

Vault's search requires submission. Validated snapshots load through the existing IndexedDB cursor reader only on explicit search/context request. The index and pending read are cached outside React state by snapshot IDs/export dates/save times. Queries reuse it until those summaries change. Selected history is O(snapshot count); search scans unique names on submit, returns at most 20 matches, and does not rebuild the index on every keystroke. Optional list context scans older indexed sets once, rather than searching every snapshot separately for every displayed account.

## Optional list context

Not Following Back, Fans, and Cleaner reuse `savedHistoryContext`. Users enter the active export date and explicitly confirm that active and saved exports belong to the same account. Both UI and analysis reject an invalid date or missing confirmation. Only snapshots strictly earlier than that date count; import time is never assumed to be the export date. Changing the date/confirmation, dataset, or Vault summary revision invalidates displayed context. Context describes previous observed membership, never a score or action recommendation.

## Current mutual origins

`analysis/mutual-origins.ts` derives a separate record per normalized current mutual. It retains both timestamps and precision flags; the shared `Account` type and import parsing stay unchanged. Missing or unusable dates produce `unknown`. Equal recorded calendar days produce `same-recorded-day`, even if exact JSON times differ. Otherwise the earlier recorded calendar day determines `they-first` or `you-first`.

Exact JSON dates use their UTC calendar labels, consistent with existing date displays. HTML has minute precision without timezone; its normalized surrogate preserves the source calendar label, not an exact UTC event. HTML/mixed-source comparisons use only those recorded labels, never hours or inferred timezone conversion. The optional derived `dayGap` exists only for two exact JSON timestamps and counts completed 24-hour intervals; this UI does not display it. Recorded dates may reflect refollows and do not prove first-ever or uninterrupted following.

The existing Mutuals category exposes aggregate counts, accessible origin filters, and each account's follower date, following date and recorded origin. Percentages include only mutuals with two usable dates, including same-day records; unknowns are excluded. Vault can show the active export's origin separately after real same-account confirmation. It never reconstructs old origin dates from saved presence.

Wrapped appends one aggregate `origins` story only at **10 or more** usable dated mutuals. Every previous story remains unchanged. The new card includes recorded-date/refollow/HTML caveats and no usernames or private categories/counts.

## Relationship Timeline inspection (INS-96)

The existing Timeline route retains its date-direction, year/month chart, period filters, account search, oldest/newest sorting and missing-date handling. Before account selection, four compact facts show dated followers, dated following, mutuals with both dates and available saved snapshots. Followers keeps only **Explore follower dates**; Mutuals owns the compact **Explore who followed first** insight link.

`analysis/timeline-context.ts` builds an in-memory normalized account index from the active export and calls the existing Mutual Origins calculation. Search submits locally, accepts the existing username/profile-URL normalization and returns at most 20 partial matches. Available optional-category usernames are searchable; saved-only names become searchable after explicitly loading history. Nothing performs an Instagram lookup.

- **Summary** separates the active export's observed state and two recorded dates from saved presence. It shows recorded origin, readable/containing snapshot counts, adjacent state-change count, and first/latest saved dates where the username was present. A saved-only or private-only username is not described as live “Absent”. Unknown dates stay unknown; HTML uses recorded calendar dates without hour/timezone inference.
- **Saved History** uses the unchanged `relationship-history.ts` index and transitions. `use-vault-history.ts` extracts the existing cached reader; `account-history-details.tsx` shares the existing table and conservative transition copy with Vault. No-snapshot, one-readable-snapshot and corrupt-record states are explicit. Corrupt records never manufacture absent rows.
- **Context** shows active-export relationship/origin facts and matching sent-request, own-unfollow, Close Friends, blocked, restricted and story-hidden records. Only `available` categories supply facts; missing/unsupported/empty categories never invent membership or absence. Previously mutual/follower/following facts reuse `savedHistoryContext`, never a new history engine.

Combining real saved history with the active export requires explicit same-account confirmation. InstaScope cannot verify identity. The confirmation and loaded result are bound to the dataset and Vault revision. To describe any snapshot as “previously”, the user must also supply the active export date; only strictly earlier snapshots contribute. Import time is not an export date. Replacing the dataset invalidates confirmation and its manually entered date. Unchecking confirmation hides combined history. Inspection never writes Vault records or changes the backup/schema; private categories, timestamps, origins and derived summaries remain in memory and cannot affect Wrapped or share output.

The Timeline demo's native example selector reuses all eight existing fictional examples: stable mutual, mutual→you-follow→absent, follows-you→mutual, they-first, you-first, same-day, unknown dates, and sent request. Fictional history auto-loads from the four in-memory snapshots; it never reads real Vault records. Core export and saved examples remain separate, so earlier context still needs an explicit example export date. No fictional username becomes a profile link.

`timeline-context.test.ts` covers summaries, source precision, origin reuse, normalized search indexing, readable/present counts, transitions, corruption, explicit date/confirmation guards, all optional-category states and the eight unchanged demo examples. `timeline-context.spec.ts` covers CTA placement and keyboard focus, Summary/date controls, confirmed read-only saved history, saved-only search, one-snapshot handling, all six active optional sources, source-change invalidation and demo isolation on desktop/mobile. Existing history, origins, Wrapped, storage, parsing and SEO tests remain enabled.

## Storage and demo boundaries

No schema, migration, backup format, or saved fields change. Vault continues storing usernames and snapshot metadata only. Current export timestamps, origins and derived indexes remain browser-local memory; no new telemetry, network calls or external service is introduced. `history()` reuses the validated cursor reader without backup-download size limits; backup limits still apply to `backup()`.

The four fictional Vault dates preserve original totals while showing `demo.oneway.0001` as Mutual → Mutual → You follow → Absent, `demo.fan.0001` as Follows you → Mutual, and `demo.mutual.0100` as stable Mutual. Core mutuals demonstrate all four origins: 719 usable dated mutuals and 23 unknown, with original analyzer totals unchanged. Core export and Vault history are separate fictional examples. Optional context therefore asks for an explicit fictional newer export date, rather than pretending their dates form one reconstructed account. Demo context never reads real saved records and fictional accounts remain unlinked.

## Verification

`tests/unit/relationship-context.test.ts` covers transitions, normalization, corruption, chronological ordering, date/confirmation guards, deduplication, JSON/HTML precision, percentage denominator, demo counts, Wrapped threshold/private-list exclusion and preservation of prior stories. `tests/e2e/relationship-context.spec.ts` covers chronological read-only/cached Vault search, limited and fictional history, real/HTML origin filters and dates, keyboard interaction, optional cross-tool context, current-export separation, aggregate PNG output and mobile overflow. Existing Vault comparison, migration, backup/import, parser, analyzer, demo and SEO suites remain enabled.

No new SEO route, public title, H1 or canonical is introduced or changed. Vault remains noindex and excluded from the sitemap.
