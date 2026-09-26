# Validation record

Local validation on Windows, Node 24.21.0:

- TypeScript: passed.
- ESLint: passed without warnings after cleanup.
- Unit tests: 37 passed. Normalization, timestamp handling, duplicates, both relationship directions, snapshot differences, large lists, JSON/HTML/nested/split ZIP, empty/missing/malformed lists, truncated ZIP and decompression bounds; isolated profile/analytics service validation.
- Production build: passed; static `out/` generated.
- Playwright: 18 passed across desktop and mobile Chromium. Covers ZIP upload and counts, no POST during analysis, Cleaner selection across search/filters and CSV download, old/new comparison, actual PNG signature and 1080 × 1920 dimensions, clear-data, malformed-input recovery, HTML without resource fetching, missing lists, and graceful profile-service unavailability.
- Initial browser failures were ambiguous test locators (Next's live announcer also has role=alert, and the file input has button semantics). Locators were scoped; the application results and PNG export already worked.
- npm dependency audit at installation: no known vulnerabilities reported.

All test data is synthetic. A real export, physical mobile/Safari checks, a production domain, and live optional service configuration remain launch gates. No production deployment has been performed.
