# Validation record

Local validation on Windows, Node 24.21.0:

- TypeScript: passed.
- ESLint: passed without warnings after cleanup.
- Unit tests: 75 passed. Normalization, timestamp handling, duplicates, both relationship directions, snapshot differences, large lists, JSON/HTML/nested/split ZIP, empty/missing/malformed lists, truncated ZIP and decompression bounds; isolated profile/analytics service validation. INS-4 adds selective large-archive reading, stored/Deflate/data-descriptor compatibility, CRC32, forged metadata and resource-limit regressions.
- Production build: passed; static `out/` generated.
- Playwright: 40 passed across desktop and mobile Chromium. Covers ZIP upload and counts, no POST during analysis, Cleaner selection across search/filters and CSV download, old/new comparison, actual PNG signature and 1080 × 1920 dimensions, clear-data, malformed-input recovery, HTML without resource fetching, missing lists, and graceful profile-service unavailability. INS-4 tests a synthetic ZIP over 100 MB and forbids whole-file reads on the UI thread.
- Initial browser failures were ambiguous test locators (Next's live announcer also has role=alert, and the file input has button semantics). Locators were scoped; the application results and PNG export already worked.
- npm dependency audit at installation: no known vulnerabilities reported.

All committed test data is synthetic. Additionally, INS-4 validated a current real JSON ZIP locally: independent source sets matched all parsed account identities and timestamps; desktop/mobile Chromium showed matching counts, working Cleaner selection, real Wrapped PNG output, data clearing, no overflow, no runtime errors, zero POSTs and zero external requests. Private fixtures, screenshots, counts and reports stay outside Git. The local selective-read check consumed less than 1 MB from a media-rich archive over 100 MB.

A real HTML export, a second historical export, physical mobile/Safari checks, a production domain, and live optional service configuration remain launch gates. The owner deployed https://instascope.me; the 2026-09-27 baseline audit found successful HTTP responses but incorrect localhost canonical/noindex configuration, tracked by M1/M2.

INS-6: All six optional connection lists were independently reconciled against source usernames and timestamps. Real-ZIP desktop/mobile Chromium checks passed request ages, privacy counts, own unfollow history, timeline navigation, 1080 x 1920 date-card export and clearing. Zero external requests, POSTs or runtime errors. Synthetic regressions cover stale URLs, missing/empty/unsupported lists, split failures, event deduplication and UTC ages. Private validation artifacts remain ignored.

M0 / INS-9: The full public-route sweep passes on desktop/mobile Chromium with one H1, no overflow, no runtime errors and no asset failures. It caught and now guards a Windows RSC export-path defect; the build normalizer has an idempotence/collision regression test. All 15 read-only production HTTP checks passed. INS-8 adds five issue-closure workflow tests.

M1 / INS-12: The explicit production build emits instascope.me canonicals and index/follow metadata; robots allows public pages and references the official sitemap. All seven tools are discoverable in the keyboard-accessible menu, public pages contain no up-right arrows, and the desktop/mobile route tests pass. Unconfigured/preview indexability is unit-tested. Live deployment still requires the owner's deployment integration to pick up the new artifact.

M2 / INS-13: Every production sitemap URL passed unique title/description, canonical, OG image, indexability and structured-data checks. A separate preview build emitted noindex, disallowed crawling and an empty sitemap; desktop/mobile SEO tests passed. A delayed-JavaScript regression verifies uploads stay disabled until handlers are ready, preventing an observed hydration race. No Search Console submission was made.

M3 / INS-15: All seven primary landing pages have distinct intent-focused titles and original explanations of results, requirements and limits. The utility remains above explanatory content. Typecheck, lint, 74 unit tests, production build and 34 desktop/mobile tests passed, including metadata uniqueness and all public routes.

M4 / INS-17: Fictional demo counts and comparison deltas are unit-verified. Desktop/mobile tests cover demo activation without an archive, search/pagination, Cleaner selection, comparison, explicitly demo-labeled PNGs and switching to real data without carrying over fictional snapshots. No demo profile links navigate to real Instagram accounts; zero remote requests were observed.

M5 / INS-19: The homepage shows an explicitly fictional result preview, a working hero demo action and all seven primary tools with export/public-profile labels. All 75 unit and 38 desktop/mobile tests pass, along with typecheck, lint and the production build.

M6 / INS-22: Five original guides pass unique metadata, sitemap, internal-link and desktop/mobile layout checks. The guide-to-tool-to-demo journey works. Typecheck, lint, 75 unit tests, production build and 40 Playwright tests passed.

M7 / INS-24: The guide has iPhone, Android and desktop entry points, shared export settings, local ZIP selection help and contextual tool links. Typecheck, lint, 75 unit tests, production build and all 40 browser tests passed. Meta's Accounts Center documentation supports the shared entry point; its help endpoint returned HTTP 429 during research, so exact current app labels and physical-device behavior are not claimed as verified.
