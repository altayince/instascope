# Relationship context (INS-94)

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

## Storage and demo boundaries

No schema, migration, backup format, or saved fields change. Vault continues storing usernames and snapshot metadata only. Current export timestamps, origins and derived indexes remain browser-local memory; no new telemetry, network calls or external service is introduced. `history()` reuses the validated cursor reader without backup-download size limits; backup limits still apply to `backup()`.

The four fictional Vault dates preserve original totals while showing `demo.oneway.0001` as Mutual → Mutual → You follow → Absent, `demo.fan.0001` as Follows you → Mutual, and `demo.mutual.0100` as stable Mutual. Core mutuals demonstrate all four origins: 719 usable dated mutuals and 23 unknown, with original analyzer totals unchanged. Core export and Vault history are separate fictional examples. Optional context therefore asks for an explicit fictional newer export date, rather than pretending their dates form one reconstructed account. Demo context never reads real saved records and fictional accounts remain unlinked.

## Verification

`tests/unit/relationship-context.test.ts` covers transitions, normalization, corruption, chronological ordering, date/confirmation guards, deduplication, JSON/HTML precision, percentage denominator, demo counts, Wrapped threshold/private-list exclusion and preservation of prior stories. `tests/e2e/relationship-context.spec.ts` covers chronological read-only/cached Vault search, limited and fictional history, real/HTML origin filters and dates, keyboard interaction, optional cross-tool context, current-export separation, aggregate PNG output and mobile overflow. Existing Vault comparison, migration, backup/import, parser, analyzer, demo and SEO suites remain enabled.

No new SEO route, public title, H1 or canonical is introduced or changed. Vault remains noindex and excluded from the sitemap.
