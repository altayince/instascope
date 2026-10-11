# Review Memory and Watch Circle (INS-100)

Review Memory stores explicit user decisions in this browser. Keep, Reviewed and
Watch are independent flags; none is inferred from exports, dates or notes. They
do not follow, unfollow or modify an Instagram account. Opening an active-export
row opens the existing Relationship Drawer; its factual Summary, History and
Context remain separate from the new Review memory section.

## Model and identity

```ts
type ReviewMemoryRecord = {
  username: string;
  keep: boolean;
  reviewed: boolean;
  watch: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
};
```

Identity uses the existing normalized username, never a display name. Deleted
account sentinels remain internal identities with the existing non-linkable
display policy. Notes are optional, at most 500 characters, preserved as entered;
an explicitly saved empty note clears it. The ISO UTC dates describe Review
Memory edits on this device, not Instagram relationship events. An older local
clock cannot move an existing update timestamp backwards.

## Persistence and migration boundary

`ReviewMemoryStorage` uses native IndexedDB database `instascope:review-memory`,
version 1, object store `records`, key path `username`. Each mutation reads and
writes inside one transaction and resolves only after commit. A quota error or
aborted import leaves earlier records and notes intact. Unreadable rows are
reported and skipped for display, never overwritten automatically. Updates to
such a row reject until it is explicitly cleared. Complete backup export rejects
unreadable records instead of silently omitting notes.

There is **no Snapshot Vault migration**. First use creates a separate database;
it does not open Vault for an upgrade, rewrite its records, add review flags to
snapshot arrays or alter legacy migration metadata. Vault stays version 1 with
its existing record and backup formats. Native browser regression tests verify
its snapshot values, metadata, object stores and database version remain intact.

The provider shares one normalized `Map` across views. Rows perform constant-time
cache lookups, with no IndexedDB read per row. Real memory is refreshed when the
window regains focus; failed reads are disclosed rather than represented as an
empty set of decisions.

## Review and Cleaner behavior

Compact Keep / Reviewed / Watch toggle chips save immediately after a successful
local transaction. Notes have a separate Save note action. Leaving the drawer
with an unsaved note requires an explicit discard; focus containment, Escape and
return to the originating control remain in place. Per-account clear asks for
confirmation and affects only that account's memory.

Active rows show one priority indicator: Watching, then Kept intentionally, then
Reviewed. Existing external Instagram actions remain separate; fictional and
deleted accounts remain externally unlinked. Snapshot-only comparison rows do
not gain unrelated active-export decisions.

Cleaner adds orthogonal All / Unreviewed / Reviewed / Keep / Watching filters.
Unreviewed means the Reviewed flag is false; Keep does not imply Reviewed.
Intentionally kept accounts remain visible by default and are labeled. The
unreviewed-and-not-kept count excludes both Keep and Reviewed. Storage errors or
corruption suspend memory filters/counts rather than assuming unknown decisions.
The selected review list remains ephemeral and independent of these flags.

## Watch Circle observations

The Dashboard has a private Watch Circle section. With no watched records it
explains how to add one in Relationship Drawer. With watched records but no
loaded comparison, it shows the Watch flags and current export state without
claiming zero changes.

Real comparisons require:

1. The user-supplied date represented by the active export, validated using the
   existing date rules; import time is never substituted.
2. Explicit confirmation that the active export and saved snapshots belong to
   the same Instagram account. InstaScope cannot verify account identity.
3. A readable saved snapshot strictly earlier than that export date.

The latest such readable snapshot is the comparison point. Existing
`relationshipHistoryIndex`, `accountHistory` and `timelineAccountSummary`
classify Mutual / Follows you / You follow / Absent; no duplicate state engine
is introduced. Invalid snapshots are skipped and disclosed, never interpreted
as absence. No earlier readable point means comparison unavailable, not no
changes.

Date or confirmation edits, new exports and Vault deletion/replacement revisions
invalidate loaded results. Returning controls to their earlier values does not
restore a prior confirmation/result. Watched identities absent from the active
export stay visible and inspectable. Comparisons use maps/sets; only 50 rows
render initially, with explicit Show more in batches of 50. Totals use all
watched records.

“Observed state changed” means list membership differs at the two observation
points. It does not establish who unfollowed, the cause, an exact event date,
continuous monitoring, account renames or relationship quality. There are no
notifications or automatic Instagram actions.

## Private backup and restore

Review Memory has a **separate**, versioned local JSON backup:

```json
{
  "format": "instascope-review-memory",
  "version": 1,
  "records": []
}
```

Snapshot Vault → Private Review Memory provides export, import preview and
confirmed import. Limits are 10,000 records, 16 MiB and 500 characters per note.
Schema, flags, identities and timestamps are validated; duplicate normalized
usernames and invalid files are rejected before writes. Notes are preserved
exactly. Existing V1 Vault backups continue importing through their own controls.

**Existing local records always win**, even when an incoming record is newer.
Unreadable existing keys also win until explicitly cleared. Import adds missing
usernames atomically; it never silently replaces a local note. The preview gives
incoming and known-conflict counts and explains that local records win. Final
counts reflect the transaction, including changes made in another tab. To replace
a decision from backup, deliberately clear that account first, then import.

Private backup files contain usernames, flags and notes. They are downloaded and
read locally; no automatic backup or cloud destination exists.

## Independent deletion domains

- Per-account clear removes only that account's flags and note.
- Clear all Review Memory requires typing `DELETE` and confirming a danger
  action, including unreadable records.
- Clearing active exports, deleting/replacing one snapshot, or deleting all
  saved snapshots does not delete Review Memory.
- Clearing Review Memory does not delete Vault snapshots or the active export.
- Clearing browser/site data may remove all local data. Backups must be kept safe.

## Privacy and demo isolation

Usernames, notes, flags, watch targets and observed transitions are not uploaded
or sent to analytics. No new events, backend, cloud sync, account system, paid
service or dependency is added. Notes and flags never enter Wrapped, share
images, SEO or selected-account CSV output. Notes never influence factual
analysis. Existing explicit profile actions retain their privacy policy.

Demo has a separate in-memory map of deterministic fictional records: Keep,
Reviewed, Watch, combined Keep + Watch and a fictional note. Its three watched
examples include unchanged Mutual, Mutual → You follow and Follows you → Mutual.
The Dec 15, 2024 comparison point is a separate fictional teaching fixture,
earlier than the unchanged Jan 15, 2025 core demo. It is never read from or saved
to real Vault. Demo controls do not call real Review Memory persistence,
backup/import or deletion. Leaving demo restores the real cache; the actual
stored values remain unchanged. Reload discards fictional edits.

## Verification and practical limits

Synthetic unit tests cover validation, manual updates, corruption, storage
failure, transactional rollback, backup conflicts and Watch semantics. Native
IndexedDB Playwright tests cover persistence/reload, independent deletion,
backup preview/import, unchanged Vault V1 metadata, quota errors, corruption
repair and real/demo isolation. Drawer, Cleaner, Watch state invalidation,
privacy and bounded rows have dedicated desktop/mobile coverage.

The Wrapped regression saves all three flags and a synthetic private note,
then verifies that the same dataset's story text and exported 1080-by-1920 PNG
remain identical, byte for byte. The Cleaner regression verifies the selected
CSV retains exactly its existing username/profile URL fields.

INS-100 validation includes 219 unit tests, the complete 330-test
desktop/mobile Playwright suite (one worker, no retries), and 27 relevant
WebKit iPhone checks, including existing saved-snapshot chronology and manual
upload behavior. The preview build passes 38 targeted feature/SEO browser tests;
its 33 canonical routes remain noindex/nofollow and its sitemap remains empty.
Production output preserves all 35 existing title/H1/description/canonical/OG
URL sets, allows public indexing and lists only the 31 existing public URLs.
Synthetic screenshots of Drawer, Cleaner, Watch Circle and
backup management were reviewed on desktop/mobile with no horizontal overflow.
Strict smoke of the existing live production deployment passed; this does not
deploy the PR or establish real-device Safari support.

Production/preview metadata and sitemap/robots behavior are checked against the
existing output. No new SEO route, title, H1, canonical or indexing policy is
introduced. Review Memory is browser/profile-specific and username-keyed: it
does not establish owner identity or track renames. Safari/iPhone checks use
WebKit emulation; physical-device behavior is not established by emulation.
