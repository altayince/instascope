# InstaScope

Privacy-first Instagram export analysis. No Instagram login or archive upload;
relationship analysis stays in your browser.

The current product direction is [relationship review in Roadmap V3](docs/PRODUCT_ROADMAP_V3.md).

## Run locally

Use Node.js 24 LTS and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. On this Windows workspace, a checksum-verified portable Node is available under `.tools` (ignored by Git):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1
```

## Available tools

- Followers, following, mutuals, not-following-back, and fans with search, sorting and 50-row pagination. Account-list CSV downloads include every filtered row, across pages.
- InstaCleaner: manual review, selection across filters, profile links and selected CSV export. No automatic account actions.
- Snapshot comparison: explicitly load newer and older exports; show added/missing followers, following and mutuals without causal claims.
- [Snapshot Vault](docs/SNAPSHOT_VAULT.md): save multiple dated follower/following snapshots in this browser, compare saved history and keep a private JSON backup. Optionally download a calendar reminder after saving. No cloud sync.
- Local Review Memory and Watch Circle; observed account history, Mutual Origins and Circle Pulse use only supported export/snapshot facts.
- Wrapped: aggregate-only 1080 × 1920 PNG download and native sharing where supported.
- Optional export insights: pending-request ages, private connection lists, your own recently-unfollowed records, recent sent-request records and removed suggestions. Export Doctor explains source/date coverage and available analyses.
- Dedicated tool routes, export guide, privacy page, issue-numbered changelog, canonical/OpenGraph metadata, sitemap and robots.
- Independent public-photo viewer and rate-limited Worker. Production lookup infrastructure is configured; public upstream access remains best-effort. Preview/local builds default to lookup off.
- Deployed event-name-only aggregate analytics with an isolated Worker collector. Production builds use same-origin `/api/events`; preview builds default to remote analytics off. See [analytics](docs/ANALYTICS.md).

See [current progress](docs/roadmap-progress.md) for completed/deferred scope and
remaining evidence gaps, and [CSV/calendar utilities](docs/PRODUCT_UTILITIES.md)
for download contents and date rules.

## Test and build

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm run preview
```

`check` runs typecheck, ESLint, Vitest and the static production build. Playwright tests the production `out/` output on desktop Chromium and a mobile viewport. On this workspace, set `PLAYWRIGHT_BROWSERS_PATH` to `<repo>/.tools/browsers` to reuse the downloaded browser. Do not confuse mobile emulation with testing a physical iPhone or Android device.

All committed fixtures are synthetic. Never commit real Instagram exports. See [archive support](docs/archive-support.md) and [validation](docs/validation.md).

## Architecture

```text
File selection → Web Worker → ZIP/JSON/HTML adapter → normalized Dataset
                                                       ↓
                                  pure analysis → dashboard / Cleaner / Wrapped
                                                       ↓
                                               snapshot comparison
```

Raw data lives in React context memory only, shared across client navigation. Reloading or clearing discards it. HTML parsing uses a text parser, never DOM insertion. ZIPs up to 2 GB are read selectively in a worker: only the index and relevant entries are read, and media is ignored. Relationship files retain a 20 MB per-file / 60 MB combined limit and CRC32 integrity checks. Import limits and worker timeouts bound resource use. External profile retrieval is isolated in `workers/`; it cannot receive archive data.

Explicitly saved Vault records are separate from the active dataset: IndexedDB retains only normalized follower/following usernames, the entered export date and local record metadata. Clearing active data does not delete this history.

The workspace was empty at inspection; no prototype source was available to preserve. The referenced prototype URL could not be retrieved. This is a fresh Next.js/TypeScript implementation based on [the supplied specification](docs/PRODUCT_SPEC.md), using ordinary CSS instead of an extra utility framework because the design does not need it.

## Deployment

The build produces `out/`, suitable for static hosting. Production is https://instascope.me. Cloudflare builds of `main` generate indexable output; preview branches and unconfigured local builds deliberately emit `noindex` and disallow crawling. See [deployment](docs/deployment.md) for configuration and [roadmap progress](docs/roadmap-progress.md) for the current audit.

## Repository workflow

Follow [WORKFLOW.md](WORKFLOW.md): assigned issue → INS task branch → tested PR → checked merge. [Remote protection details](docs/github-setup.md).
