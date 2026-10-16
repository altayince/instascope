# WhatsAppScope owner-managed release checklist

INS-144 prepares the production gate; it does **not** merge or deploy it.
PR #143 / INS-142 is merged into dev at `76bfb07`, including the verified
Workers preview dispatcher. The current live site changes only after the
owner's separate dev -> main release.

## Release and indexing boundaries

- `PLATFORM_RELEASES` in `src/lib/platform-config.ts` explicitly releases
  Instagram and WhatsApp. Rendering and pruning share this decision; unknown
  platforms remain unreleased.
- Intentional production uses the existing official-origin/host detection or
  explicit `npm run build:production`. Recognized Cloudflare main builds use
  that production wrapper, normalizing inherited preview flags. All four
  WhatsApp tools and the switcher are retained without a dashboard flag.
- WhatsApp stays **noindex, nofollow**, outside the production sitemap.
  Public Instagram pages keep index/follow, canonicals and sitemap inclusion.
  Production robots allows public crawling and excludes the existing `/api/`;
  do not disallow WhatsApp, because crawlers must read its page-level noindex.
- Recognized non-main Workers builds keep INS-142's development path: global
  noindex/nofollow, robots Disallow all, empty sitemap. Other previews need both
  opt-ins and a known non-main branch. Missing host branch or a local build
  without a production origin/preview opt-in stays closed. Manually supplying
  the official production origin is an explicit production-build decision.
- These are static compile-time artifacts, not runtime Worker settings.
  No profile/analytics Worker configuration, DNS or route changes are needed.

## Before release

Require current-head quality, browser-tests, whatsapp-tests, main-visual-parity,
branch/ownership and Cloudflare preview checks. Record retries separately.
Check the actual hosted preview: home, all four WhatsApp routes, direct refresh
and assets must work with preview indexing disabled. Compare is inside Chat
Vault, not a fifth route.

Run `npm run check`, `npm run build:production` and the full default production
Playwright suite against the combined artifact. Run `npm run build:dev` and
the full WhatsApp suite with `EXPECT_WHATSAPP=true`, `EXPECT_INDEXABLE=false`;
run independent-main visual parity as documented in `WHATSAPPSCOPE.md`.
Restore the production artifact after local review.

**Physical-device pre-certification is skipped by explicit owner decision.**
It has not been completed. Pixel/iPhone WebKit emulation remains automated
evidence; physical-phone/Safari manual testing becomes post-deploy evidence.
This is not an additional approval gate for this dev task.

## Owner-managed sequence

1. Review and merge this production-release-gate PR into **dev**.
2. Verify dev CI and the actual hosted Cloudflare preview.
3. Create/review a separate **dev -> main** release PR. Record the last healthy
   production static deployment and commit before proceeding. Current PR policy
   still requires an open assigned/projected INS issue and task branch: cut
   `feature/INS-<release-issue>-production-release` from the reviewed current dev,
   target main, and include `Fixes #<release-issue>`. A literal head branch named
   `dev` would fail the existing task-branch/ownership checks; no policy bypass
   or direct main push is needed to release the same reviewed dev changes.
   Main currently also contains INS-134 (`cb0a780`), absent from this dev lineage.
   Preserve its analytics/attribution contract and Worker; keep
   `AnalyticsInitializer` alongside `PlatformShell` when resolving the shared
   layout, and review overlapping Wrangler/docs/changelog/README changes.
   Run production, WhatsApp privacy and traffic-attribution tests on the actual
   integrated release PR before merging. Its approved document-entry event must
   be checked as a bounded safe envelope, not mistaken for a chat-data upload;
   do not discard private-payload assertions or claim this task tested that
   not-yet-integrated artifact. No main history is copied or changed here.
4. Merge that release PR as the owner.
5. Wait for the existing Cloudflare main-branch static production deployment.
   Keep build command `npm run build`; no hidden WhatsApp dashboard action,
   new DNS/route or separate Worker deployment is required.
6. Run `node scripts/smoke-production.mjs https://instascope.me --require-whatsapp`.
   Add `--require-profile` only to require the independent public-photo health
   binding too; neither flag performs a live Instagram lookup. Ordinary smoke
   remains usable on today's pre-release production.
7. Manually use WhatsApp on production using the checklist below. Record this
   as post-deploy evidence, not retroactive pre-certification.
8. If a serious problem appears, execute rollback and recheck Instagram.
9. If stable, proceed to the **separate WhatsApp SEO/indexability task**.
   Do not submit WhatsApp URLs or change indexing policy during this release.

## Post-deploy manual smoke

Use synthetic chats in a disposable browser profile for recovery tests. Never
clear someone's real Vault or put private exports in logs/screenshots.

- Direct entry, refresh, back/forward and switching on `/whatsapp/`,
  `/whatsapp/chat-analyzer/`, `/whatsapp/wrapped/`, `/whatsapp/chat-vault/`;
  unknown routes remain 404. Check mobile fit with long and 20+ label groups.
- Import/Doctor: valid TXT/ZIP, empty/unsupported/system-only input, deliberate
  format confirmation and recovery. Navigation during parsing must preserve
  accepted data without redirecting back; Doctor remains source-level.
- Analyzer: pair/group filters, reset, empty subsets, activity, rhythm/dynamics,
  content and textual chart alternatives retain factual recorded-clock semantics.
- Wrapped: rapid card switching, eager individual 1080x1920 PNG preparation,
  native share/cancel, download fallback/retry and separate async full-deck ZIP.
  Words remain opt-in; revocation removes them. Default artwork has no identities.
- Vault/Compare: explicit save/reload, backup, preview/confirmed restore/delete,
  corruption and storage recovery, fresh same-conversation consent after changed
  selections. Pulse describes saved aggregate differences, never intervening
  messages or causes. V1 stays V1.
- Instagram: homepage/import, Dashboard, Analyzer, Cleaner, Wrapped, Snapshot
  Vault, guides and public-photo viewer retain existing behavior.
- Privacy/analytics: no chat text, labels/counts, filenames, URLs, words, emoji,
  Vault/comparison data or fingerprints leave the browser. Existing bounded
  Instagram analytics is unchanged; WhatsApp adds no semantic events/dimensions.
- Smoke checks HTTP, metadata, robots/sitemap and page-linked same-origin JS/CSS,
  rejecting HTML fallbacks. A real synthetic import also checks the parser Worker;
  static bundles alone do not prove functional import.

## Rollback

Record the last healthy **static application** deployment/commit before release.
For immediate recovery, restore that recorded artifact from Cloudflare's existing
application deployment history/rollback UI. This restores Instagram and the old
artifact's WhatsApp 404s. Do not redeploy profile/analytics Workers.

Then use an owner-reviewed PR to set `PLATFORM_RELEASES.whatsapp` to
`"unreleased"` and rebuild through the existing main production process.
Pruning removes WhatsApp HTML/RSC and the switcher again; non-main previews stay
available. Do not revert only the dispatcher or rely on a preview flag.
Check WhatsApp 404, Instagram index/follow and normal robots/sitemap after
rollback, rather than running `--require-whatsapp`.

No backend migration exists. Vault V1 is browser-local; rollback does not erase
snapshots/backups or require schema changes. Avoid force pushes, clearing user
storage or speculative Wrangler rollback commands.
