# Snapshot Vault V1 (INS-90)

Snapshot Vault is a browser-local product surface at `/snapshot-vault/`. It does not create accounts, contact Instagram, upload relationship data, or provide cloud backup. No new dependency is used.

## Storage and privacy

Native IndexedDB database `instascope:snapshot-vault`, database version 1:

- `snapshots`: key path `id`, unique index `exportDate`.
- `metadata`: key path `key`, contains the `legacy-v1-migrated` marker.

Each version-1 snapshot contains exactly `id`, `version`, `exportDate`, `createdAt`, `followers`, and `following`. Export dates are validated calendar dates in `YYYY-MM-DD`. Usernames use the existing normalization rules, are deduplicated and sorted. IDs stay stable across a confirmed replacement; the local saved-time revision changes.

The Vault does not retain archives, credentials, session cookies, per-relationship timestamps, messages/media, or optional/private connection lists. Active imported datasets and manual older uploads remain in tab memory. Clearing active data keeps the Vault; deleting saved history keeps the active dataset. Dashboard context retains only validated date/count summaries. Records are read by cursor rather than loading all historical usernames into React state.

Native read/write transactions resolve only after commit. Same-date replacements and backup merges are atomic. A failed transaction cannot partially replace the old record or leave a partly imported backup. An optimistic revision check rejects a replacement if another tab changed the candidate after its confirmation opened. Readable history remains accessible for deletion even if migration cannot write because storage is full.

## Legacy migration and rollback

On initialization, a valid `instascope:relationship-snapshot:v1` localStorage record is copied into IndexedDB with ID `legacy-v1-<exportDate>`. The snapshot and migration marker commit together. A matching saved date is kept, not overwritten. Invalid legacy JSON is skipped without breaking startup.

The original legacy key is preserved for rollback to an older deployment. New Vault saves do not update that key. Explicitly deleting its corresponding saved date, or deleting all saved history, also removes the legacy key. The marker remains after deletion, preventing an old restored copy from being re-imported. If legacy-key deletion is blocked, the UI explicitly reports the remaining copy and recommends clearing site storage. If localStorage access is blocked but IndexedDB works, the Vault remains usable and reports that migration could not be checked.

## Product flows

- Save a real loaded export with a user-entered date. Demo exports are rejected in the model as well as excluded from the UI. Different dates add records; the same date opens Replace/Cancel.
- Dashboard shows saved count/latest date and links to the Vault. Snapshot Comparison also links to it.
- Vault lists dates newest first, with follower/following totals and saved time. Compare selects a neighboring pair as a convenience; it never starts the comparison automatically.
- Choose any older/newer saved pair, explicitly confirm the same account, and compare. Distinct IDs and strict chronological order are enforced beneath the UI. The existing `compareSnapshots` function supplies all six relationship differences and both deltas; its result UI is shared with the original comparison route.
- The current uploaded-export flow can select any saved candidate without saving the current export first. Existing newer-date/same-account guards remain. Manually uploaded older files and the fictional demo retain their separate behavior.
- History shows a chronological table and discrete SVG points at the actual saved dates, with no connecting/interpolated counts. It cannot reconstruct dates, removed relationships, causality, or continuous historical totals.
- Individual deletion opens a native confirmation dialog. Delete-all additionally requires typing `DELETE`. Escape cancels, and focus returns to the originating control when it still exists.

Same-account confirmation is the user's responsibility. List overlap is never treated as account identity verification. Renames, deactivations and export differences may affect comparison results; a missing account is not proof of a deliberate unfollow.

## Private backup format

`Export Vault backup` creates `instascope-snapshot-vault.json` locally:

```json
{
  "format": "instascope-snapshot-vault",
  "version": 1,
  "snapshots": []
}
```

Import accepts only this format, not arbitrary Instagram files. Unknown fields, invalid identities/dates/usernames, unsupported versions, duplicate dates/IDs within the file and malformed JSON are rejected. Content is parsed as JSON, never executed or inserted as HTML. Usernames are normalized before preview and storage.

The preview lists dates/counts and describes new versus skipped records. Nothing is written until confirmation. Existing export dates are skipped and preserved even when a backup contains different contents for that date. An ID colliding with a different saved date aborts the entire merge. All new records are merged in one transaction.

Safety limits for a single backup: 32 MiB UTF-8, 1,000 snapshots, 1,000,000 normalized usernames in total; each record permits at most 500,000 source entries per relationship list. These are resource bounds, not paid tiers. Vault storage itself has no product snapshot-count cap. A Vault exceeding the backup bounds stays intact, but V1 cannot export it as one file. Corrupt records are reported, retained until explicit deletion, and excluded from comparisons and backups.

## Browser limits

Browser quota and eviction policy vary. IndexedDB can be disabled, blocked by another tab, or limited in private browsing. Requests/transactions have bounded wait times and safe errors. Quota failure never automatically removes older snapshots. Clearing site/browser data or losing a device may lose the Vault. Private backup files contain usernames and should be kept private; there is no remote recovery.

Native API behavior: [MDN IndexedDB usage](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [transaction lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction).

## Indexing and scope

Production Vault metadata is `noindex, follow`; preview metadata remains `noindex, nofollow`. The route is absent from `publicPaths` and the production sitemap. Existing public SEO URLs, titles, H1s and article copy are unchanged. No analytics infrastructure or new events are added; optional name-only Vault events can be considered in a later analytics task. Adjacent decorative deltas are deliberately omitted; explicit comparisons provide supported differences.

Validation uses synthetic data only. Unit coverage exercises schema, normalization, comparison guards/engine parity, backup limits and unavailable-storage errors. Playwright uses actual browser IndexedDB for CRUD, atomic failures, migration/idempotence, corruption, quota errors, backup import/export, current/manual comparison compatibility, dialogs, private metadata and desktop/mobile layout. Screenshot artifacts are generated for history and comparison states.

## Changed files

- Storage/model: `src/lib/snapshot-vault.ts`, `src/lib/vault-storage.ts`.
- Private route: `src/app/snapshot-vault/page.tsx`.
- Product integration: `src/components/data-provider.tsx`, `src/components/dashboard.tsx`, `src/components/workspace.tsx`, `src/components/snapshot-return.tsx`.
- Shared/new UI: `src/components/snapshot-vault.tsx`, `src/components/snapshot-comparison-results.tsx`, `src/components/vault-confirmation.tsx`.
- Styling/privacy/discovery: `src/app/globals.css`, `src/app/privacy/page.tsx`, `src/app/changelog/page.tsx`.
- Documentation: `README.md`, `docs/SNAPSHOT_VAULT.md`.
- Synthetic verification: `tests/unit/snapshot-vault.test.ts`, `tests/helpers/vault.ts`, `tests/e2e/snapshot-vault.spec.ts`, `tests/e2e/snapshot-return.spec.ts`, `tests/e2e/dashboard.spec.ts`.

## Local validation, 8 October 2026

| Check | Result |
| --- | --- |
| `npm run check` | Typecheck, lint, 162 unit tests and production build passed |
| `npm run test:e2e` | All 228 tests passed: 114 desktop Chromium, 114 Pixel 7 emulation |
| Native WebKit, iPhone 13 viewport | All 19 Vault/return-flow tests passed, including actual IndexedDB and dialog focus restoration |
| Preview `npm run build` | Passed; six desktop/mobile metadata tests passed against preview output |
| `npm run build:production` | Passed; production output restored after preview validation |
| Generated production output | Vault canonical correct, `noindex, follow`, absent from sitemap; public crawling remains allowed |
| Strict live production smoke | All 16 existing paths returned 200; public-photo infrastructure ready |

The live smoke checks the currently deployed main branch. The new Vault route was verified in the PR's generated production output and browser tests; it will become live only after merge/deployment. Screenshots are local Playwright artifacts for desktop/mobile history and comparison states. Tested layouts have no horizontal document overflow beyond a one-pixel rounding tolerance. Windows WebKit with a mobile viewport is not physical Safari/iPhone testing; real iOS storage/eviction and private-mode behavior remain device/browser dependent. No persistence guarantee is made.
