# Validation record

Local validation on Windows, Node 24.21.0:

- TypeScript: passed.
- ESLint: passed without warnings after cleanup.
- Unit tests: 74 passed. Normalization, timestamp handling, duplicates, both relationship directions, snapshot differences, large lists, JSON/HTML/nested/split ZIP, empty/missing/malformed lists, truncated ZIP and decompression bounds; isolated profile/analytics service validation. INS-4 adds selective large-archive reading, stored/Deflate/data-descriptor compatibility, CRC32, forged metadata and resource-limit regressions.
- Production build: passed; static `out/` generated.
- Playwright: 30 passed across desktop and mobile Chromium. Covers ZIP upload and counts, no POST during analysis, Cleaner selection across search/filters and CSV download, old/new comparison, actual PNG signature and 1080 × 1920 dimensions, clear-data, malformed-input recovery, HTML without resource fetching, missing lists, and graceful profile-service unavailability. INS-4 tests a synthetic ZIP over 100 MB and forbids whole-file reads on the UI thread.
- Initial browser failures were ambiguous test locators (Next's live announcer also has role=alert, and the file input has button semantics). Locators were scoped; the application results and PNG export already worked.
- npm dependency audit at installation: no known vulnerabilities reported.

All committed test data is synthetic. Additionally, INS-4 validated a current real JSON ZIP locally: independent source sets matched all parsed account identities and timestamps; desktop/mobile Chromium showed matching counts, working Cleaner selection, real Wrapped PNG output, data clearing, no overflow, no runtime errors, zero POSTs and zero external requests. Private fixtures, screenshots, counts and reports stay outside Git. The local selective-read check consumed less than 1 MB from a media-rich archive over 100 MB.

A real HTML export, a second historical export, physical mobile/Safari checks, a production domain, and live optional service configuration remain launch gates. The owner deployed https://instascope.me; the 2026-09-27 baseline audit found successful HTTP responses but incorrect localhost canonical/noindex configuration, tracked by M1/M2.

INS-6: All six optional connection lists were independently reconciled against source usernames and timestamps. Real-ZIP desktop/mobile Chromium checks passed request ages, privacy counts, own unfollow history, timeline navigation, 1080 x 1920 date-card export and clearing. Zero external requests, POSTs or runtime errors. Synthetic regressions cover stale URLs, missing/empty/unsupported lists, split failures, event deduplication and UTC ages. Private validation artifacts remain ignored.

M0 / INS-9: The full public-route sweep passes on desktop/mobile Chromium with one H1, no overflow, no runtime errors and no asset failures. It caught and now guards a Windows RSC export-path defect; the build normalizer has an idempotence/collision regression test. All 15 read-only production HTTP checks passed. INS-8 adds five issue-closure workflow tests.

M1 / INS-12: The explicit production build emits instascope.me canonicals and index/follow metadata; robots allows public pages and references the official sitemap. All seven tools are discoverable in the keyboard-accessible menu, public pages contain no up-right arrows, and the desktop/mobile route tests pass. Unconfigured/preview indexability is unit-tested. Live deployment still requires the owner's deployment integration to pick up the new artifact.
