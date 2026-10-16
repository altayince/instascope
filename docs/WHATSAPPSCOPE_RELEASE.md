# WhatsAppScope owner-managed release checklist

INS-146 prepares the final owner-reviewed production integration; it does not
merge the release PR or deploy it. PR #145 / INS-144 is merged into current dev;
the release branch integrates current main without rewriting either branch.
The current live site changes only after the owner's release merge/deployment.

## Integration provenance and rollback baseline

| Reference | Exact value |
| --- | --- |
| Reviewed main / INS-134 | `cb0a78099565aa601c7bc18c93f11330091d2e6f` |
| Reviewed dev / PR #145 | `1e68bf8af8eb8a58a6d20e8fb0f5dffef41f921d` |
| History-preserving integration commit | `c8b90b93e86f6309f1c3b8b374f130f9bd0d1286` |
| Existing static deployment | `43118230-a096-4467-a491-e506b42ae50b` |
| Existing static version, 100% | `f1568702-a3f7-40ce-b962-e8762906a889` |

The merge parents are reviewed dev then main. The only textual conflict was
root `wrangler.jsonc`: retain main's schema plus dev's compatibility date
`2026-10-13` and `preview_urls: true`, with the shared static assets/previews
configuration. No routes/bindings were added. Auto-merged layout, README,
deployment docs and changelog were reviewed deliberately: layout retains one
`AnalyticsInitializer` alongside `PlatformShell`; changelog keeps both product
lines in newest-issue order. INS-134 implementation/Worker/configuration remains
identical to reviewed main.

Read-only Cloudflare metadata identifies that static deployment at 15 October
2026 13:39:53 UTC. A 16 October public GET baseline found Instagram root/analyzer
200/index/follow, all four WhatsApp routes 404, production robots/sitemap intact,
photo health ready and collector GET 405. No product event was submitted.
Deployment metadata supplies no Git SHA, so the deployment-to-commit mapping is
not invented. The release PR body/current-head CI records the final release head
and actual integrated validation results. Recheck the baseline before owner merge
if another production deployment has occurred.

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
This is not an additional approval gate for this release task.

## Owner-managed sequence

1. PR #145 / INS-144 is merged into reviewed **dev**; its release gate is retained.
2. Verify current-head integrated release CI and the actual hosted preview.
3. Review INS-146's main-targeted release PR from
   `feature/INS-146-production-release`, including the two input SHAs, merge
   parentage, static rollback reference and `Fixes #146`. Current main is already
   integrated on that task branch; do not replace it with standalone dev.
   Require production, WhatsApp, analytics/privacy and current-main visual jobs
   to execute and pass. They explicitly run for this same-repository main-target
   release branch; do not mistake a skipped WhatsApp job for release validation.
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
  Vault/comparison data or fingerprints leave the browser. The shared initializer
  observes one `document_entry_observed` per full Document on either platform;
  SPA switching does not add an entry. Only `{event, source, webdriver}` with
  approved bounded values may be delivered, subject to DNT/endpoint settings.
  WhatsApp adds no semantic product events or dimensions. Existing INS-134
  attribution, Worker validation/Engine dimensions and legacy compatibility stay
  unchanged; no collector redeployment is part of this static release.
- Smoke checks HTTP, metadata, robots/sitemap and page-linked same-origin JS/CSS,
  rejecting HTML fallbacks. A real synthetic import also checks the parser Worker;
  static bundles alone do not prove functional import.

## Rollback

Record the last healthy **static application** deployment/commit before release.
For immediate recovery, restore recorded static version
`f1568702-a3f7-40ce-b962-e8762906a889` (deployment
`43118230-a096-4467-a491-e506b42ae50b`) from Cloudflare's existing application
deployment history/rollback UI, after confirming it remains the intended healthy
baseline. This restores Instagram and the old
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
