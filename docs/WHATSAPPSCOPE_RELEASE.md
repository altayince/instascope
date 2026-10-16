# WhatsAppScope owner-managed release checklist

INS-142 hardens the existing preview product; it does **not** release it.
PR #141 (Group Mode) is merged into `dev`. Normal production still excludes
WhatsApp HTML/RSC routes and the platform switcher. Preview WhatsApp pages stay
`noindex, nofollow`, outside the sitemap.

## Before proposing a release

- Require current-head `quality`, `browser-tests`, `whatsapp-tests`,
  `main-visual-parity`, branch/ownership policy and Cloudflare branch preview
  checks to pass. Review retries separately; a retry is not a clean first pass.
- Run `npm run check` with `NEXT_PUBLIC_SITE_URL=https://instascope.me` for the
  indexable Instagram artifact. Verify `out/whatsapp` is absent, direct WhatsApp
  URLs return 404, the platform switcher is absent, and the production sitemap
  contains only existing public Instagram URLs.
- Run `npm run build:dev`, then `EXPECT_WHATSAPP=true EXPECT_INDEXABLE=false`
  with `npx playwright test --config playwright.whatsapp.config.ts`. These are
  environment settings, not a shell-independent inline command. Run the actual
  independent-main visual comparison described in `WHATSAPPSCOPE.md` too.
- Manually review desktop, Android and physical iPhone/Safari import, navigation
  and exports. Automated Pixel/iPhone WebKit emulation does not replace actual
  device evidence. Use a disposable browser profile and synthetic chats for
  recovery/corruption tests; never clear someone's real Vault to test a release.

## Explicit release decision — owner only

- Create the reviewed `dev` → `main` release PR only when ready. Ordinary
  WhatsApp task PRs target `dev`; agents must not merge or deploy this release.
- First explicitly review the release gate in `next.config.ts`,
  `src/lib/platform-config.ts` and `scripts/prune-unreleased-platforms.mjs`.
  Currently WhatsApp requires both opt-in and preview mode on a known non-main
  branch. **Any main branch context disables it, even with both flags set.**
  Merely setting `NEXT_PUBLIC_WHATSAPP_ENABLED=true` cannot release WhatsApp.
  A later reviewed release change must define the intended production enablement
  consistently in rendering, pruning, tests and hosting build configuration.
- Review future indexing policy separately. This hardening task keeps every
  WhatsApp route noindex/nofollow and adds no SEO content or public sitemap entry.
  Do not remove the preview/fail-closed indexing protections to launch the tools.
- Build the exact proposed release artifact using the documented static build
  process in `deployment.md`; inspect the compiled effective gate and routes.
  Do not deploy today's gated artifact expecting environment changes at runtime
  to enable it: these flags are compiled into the static site.

## Smoke the proposed artifact, then the owner-released site

- WhatsApp: direct entry, reload, browser back/forward and tool switching on
  `/whatsapp/`, `/whatsapp/chat-analyzer/`, `/whatsapp/wrapped/` and
  `/whatsapp/chat-vault/`. Check active navigation, missing-source state, unknown
  route 404 and no horizontal overflow with long labels and 20+ label groups.
- Import/Doctor: valid TXT/ZIP; wrong, empty, unsupported and system-only input;
  recover by selecting a valid file. Confirm format deliberately. Navigate during
  parsing without being pulled back; Doctor remains source-level and unfiltered.
- Analyzer/Rhythm/Content: pair/group, date/participant filters, reset, empty
  subsets, chart text alternatives and factual recorded-clock/adjacency wording.
- Wrapped: rapid card switching, all cards, 1080×1920 PNG, native share/cancel,
  unsupported-share download fallback, full-deck ZIP and cancellation. Verify
  download/encoding errors recover. Words remain opt-in and revocation removes
  them from the artwork/files. Default cards contain no identities or raw text.
- Vault: explicit real save, reload/focus, local backup, preview + confirmed
  restore, existing-ID conflict rules and confirmed deletion. Simulated IndexedDB
  denial/transaction failure must leave analysis usable and permit retry after
  recovery. No raw chats or participant identities enter persisted snapshots.
- Compare/Pulse: deliberately choose two compatible snapshots and confirm the
  same conversation. Deleted, changed, corrupt or incompatible selections must
  clear consent/results. Check equal/disjoint/missing coverage and empty Pulse;
  differences describe saved aggregates, never messages between snapshots.
- Instagram: homepage, import, Dashboard, Analyzer, Cleaner, Wrapped, Snapshot
  Vault, existing public guides and public-photo viewer retain their behavior.
- Analytics/privacy: preserve the existing bounded event contract. Inspect
  network payloads during WhatsApp import/filter/export/save/restore/compare:
  no chat text, labels/counts, filenames, URLs, words, emoji, Vault IDs, snapshot
  contents, comparison metrics or conversation fingerprints. No new telemetry
  integration is required to release the existing tools.
- Indexing: inspect robots.txt, sitemap.xml, canonical tags and robots metadata
  on the actual artifact. Existing public Instagram pages stay indexable in the
  configured production context; previews fail closed; WhatsApp follows only the
  separately approved release/indexing policy.
- Cloudflare: use the existing static application's main-branch deployment
  process, not the separate profile/analytics Worker deployment commands or the
  preview-only root Wrangler configuration. Confirm current-head build, routes,
  asset responses and headers. Run
  `node scripts/smoke-production.mjs https://instascope.me --require-profile`
  after owner release; this checks existing Instagram/public-photo health without
  contacting Instagram or uploading chats. Perform the WhatsApp smoke above too.

## Rollback prepared before release

Record the last healthy static deployment/commit before the owner release. If
smoke fails, use the existing Cloudflare deployment rollback to that artifact,
then have the owner revert the release change through a reviewed PR; avoid a
force push or unrelated Worker redeployment. Recheck Instagram health, route
isolation and robots/sitemap after rollback. A static rollback does not undo
browser-local Vault writes: preserve V1 compatibility and users' local backups.

No production launch, main merge, release-gate change, new supported export
format, final WhatsApp SEO strategy or physical-device certification is included
in INS-142.
