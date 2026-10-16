# Deployment and launch

Production is live at https://instascope.me. Public-page indexing and the application-only Dashboard have their existing independent metadata rules. `node scripts/smoke-production.mjs` checks public HTTP responses and public-photo infrastructure readiness without user archives or Instagram requests; add `--require-profile` to fail when the profile service is not wired. After the owner deploys the WhatsApp release, add `--require-whatsapp` to verify the four tools, Instagram indexing, WhatsApp noindex, sitemap/robots and required page-linked JS/CSS. Ordinary smoke does not require WhatsApp on today's live site.

INS-144 prepares WhatsAppScope's explicit repository production release state;
the live site changes only after the owner's later dev -> main release. Its
[owner-managed release checklist](WHATSAPPSCOPE_RELEASE.md) covers that sequence,
post-deploy manual testing and rollback. Production builds retain Instagram and
all four WhatsApp routes/switcher without a dashboard flag. WhatsApp stays
noindex/nofollow and outside the sitemap; public Instagram indexing is unchanged.
Ordinary WhatsApp PRs never merge or deploy that production release. The owner
has skipped physical-device pre-certification; it is not claimed as completed.

## Static application

On Cloudflare Pages or Workers Builds, `npm run build` recognizes an identified main production branch and uses the production wrapper to generate an indexable `out/`, resetting inherited preview flags. Cloudflare preview branches generate `noindex, nofollow`, `Disallow: /` and an empty sitemap even if they inherit `NEXT_PUBLIC_SITE_URL=https://instascope.me`. Set the production branch to `main`; a missing/conflicting host branch fails closed. Explicit preview artifacts remain noindex. For a manual production release outside Cloudflare, use `npm run build:production` (or explicitly set `NEXT_PUBLIC_SITE_URL=https://instascope.me` with preview off before `npm run build`). Publish the resulting `out/` directory. The canonical origin is always instascope.me.

The live site previously served a preview/unconfigured build despite correct canonical URLs. If a main-branch deployment still returns `noindex`, inspect the host's build logs and confirm its build command runs `npm run build` on `main` with the Cloudflare branch variable present; alternatively configure the production build command as `npm run build:production`. Keep Workers Builds commands on `npm run build`; the preview wiring below chooses the existing development build only in a recognized non-main Workers context. Set `NEXT_PUBLIC_PREVIEW=true` for other preview systems; enabling WhatsApp there still requires its explicit opt-in and a known non-main branch. Cloudflare's [Pages build variables](https://developers.cloudflare.com/pages/configuration/build-configuration/) and [Workers Builds variables](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) document the injected branch names.

### Workers branch previews (INS-142)

Workers Builds runs its configured build command before the separate Preview
command. `previews: {}` and `assets.directory` in the root Wrangler file describe
the preview deployment; they do not enable Next's compile-time WhatsApp flag.
Before the INS-144 release decision, an ordinary build without the opt-ins
compiled it out and pruned its HTML/RSC, explaining the earlier successful
preview build with WhatsApp 404s.

The repository's `npm run build` entry now recognizes only `WORKERS_CI=1` with
an explicit nonempty `WORKERS_CI_BRANCH` and no main branch in any existing
Git/Cloudflare/GitHub context. It delegates that non-main Workers build to the
unchanged `build-development.mjs`, which supplies both preview opt-ins. Ordinary
local/GitHub builds, missing/invalid host branch and every main context retain
the original Next → normalize → prune path, except recognized Cloudflare main
builds now use `build-production.mjs` to normalize inherited preview flags.
Availability/pruning share the reviewed repository release state; preview
dispatch still uses its separate strict non-main predicate. `build:dev` and
`build:production` remain explicit, separate commands.

Keep the host build command `npm run build`, Preview command
`npx wrangler preview`, and production branch `main`. No dashboard, production
route or separate Worker change is needed for this repository wiring. Cloudflare
[documents branch-aware build variables](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
and [non-production branch preview execution](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).
Workers Builds does not honor Wrangler Custom Builds settings; no speculative
Wrangler build fields are used. The existing OAuth session could read Workers
but returned 403 for Builds configuration, so dashboard values were not inferred
from that session. The real generated preview must still be checked after push:
all four WhatsApp routes and assets 200, noindex/nofollow, robots Disallow all and
an empty sitemap. Snapshot Compare lives inside Chat Vault, not a separate route.

The 13 October 2026 live audit confirms `http://instascope.me/` returns `301` to `https://instascope.me/`; the earlier HTTP-200 finding is historical. If a future deployment loses that redirect, review Cloudflare's [Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/) setting. Review any production `*.pages.dev` or `*.workers.dev` alias in Cloudflare and redirect it to the primary domain or block indexing there, because the same static production HTML cannot distinguish hostnames at request time. See [current progress](roadmap-progress.md) for the dated live audit and remaining evidence gaps.

1. Use Node 24; run `npm ci`.
2. Confirm that the Cloudflare production branch is `main`, or set `NEXT_PUBLIC_SITE_URL=https://instascope.me` for a manual production build.
3. Run `npm run check` and `npm run test:e2e` after installing Chromium.
4. Publish `out/` to a static host such as Cloudflare Pages. `public/_headers` supplies security headers for hosts supporting that format; configure equivalent headers elsewhere.
5. Confirm direct visits to every tool route, worker script loading, favicon, social image, sitemap and mobile uploads on the final domain.
6. Verify current hosting quotas/prices before enabling infrastructure. No cost or free-tier assumption is encoded in the application.

Next supports [static exports](https://nextjs.org/docs/app/guides/static-exports). This application needs no application server for archive analysis. Its CSP permits Next's generated inline scripts; do not claim a strict nonce-based CSP. Do not add third-party scripts with access to the export workspace.

Always use `npm run build`, including on Windows. It normalizes wrongly nested Next RSC segment paths in the static output so browser prefetch URLs resolve on ordinary static hosts; it does not change payload content. A collision with different content fails the build. Correctly emitted Linux exports are unchanged.

## Production public-photo Worker

`workers/profile-picture.ts` accepts usernames only, builds a fixed Instagram HTTPS URL, refuses redirects, omits cookies/authentication, caps response bytes/time, and accepts only a matching profile OpenGraph title plus an Instagram/Facebook image CDN URL. It neither rewrites CDN URLs to invent resolution nor accesses private APIs. The available upstream image determines resolution. Restrictions, login responses and rate limits return an error.

INS-72 audit (2026-10-05): the live `/api/profile-picture` path returned 404. The previous config had no route, lookup was disabled, and the static frontend had no compiled endpoint. The production CSP already allows same-origin requests and Instagram/Facebook CDN subdomains; CORS changes are unnecessary. A credential-free request from the development machine to Instagram's public profile HTML returned 200, a matching `og:title` containing `&#064;username` / `&#x2022;`, `og:url`, and a CDN `og:image`. A nonexistent synthetic username returned HTML without usable profile metadata. Synthetic tests reproduce these fields without committing the response or real profile identifiers.

That first audit established the HTML format, not edge availability. The INS-72 Worker was subsequently deployed: its route and health check worked, but public-profile lookups failed. A Cloudflare remote diagnostic confirmed Instagram redirected the direct request to `/accounts/login/` with HTTP 302.

INS-74 verified a credential-free alternative through Cloudflare's official Browser Run service: a public profile document returned HTTP 200 with matching profile metadata when JavaScript was disabled and requests were restricted to that exact document URL. The native browser binding is now the fallback for unavailable direct public HTML. Login/challenge redirects and other URLs are blocked, and only a matching public profile image from a trusted CDN is returned. This is still best-effort availability, not a private-profile or login bypass. No Instagram credentials, cookies, private APIs, scraping proxies or resolution-rewriting workarounds are used.

### Deploy the actual infrastructure

1. Authenticate to the Cloudflare account owning the `instascope.me` zone: `npx --yes wrangler@4.147.0 login`. In an automated deployment, use an account-scoped API token with Workers Scripts edit, Workers Routes edit for this zone and the zone-read permissions needed to resolve the route. Keep credentials outside the repository. If multiple accounts are available, select the correct account via `CLOUDFLARE_ACCOUNT_ID`.
2. Confirm `instascope.me` uses proxied Cloudflare DNS. The app may remain a static-assets Worker on its custom domain; the more specific API route handles browser requests directly. Do not have the app Worker call this same-zone route using server-side `fetch()`; use a service binding if such a design is ever required. See [Cloudflare routes](https://developers.cloudflare.com/workers/configuration/routing/routes/).
3. Review `workers/wrangler.profile.jsonc`: the explicit `production` environment uses Worker name `instascope-public-photo`, route `instascope.me/api/profile-picture*`, `ENABLE_PUBLIC_LOOKUP=true`, native `RATE_LIMITER` with namespace `1001`, limit 10 / period 60, and native `BROWSER`. Confirm namespace `1001` is not assigned to an unrelated limiter in this account; choose another account-unique number in the config if needed. Bindings are explicit in the production environment because they are not inherited. The default environment stays disabled and has no production route or browser binding.
4. After repository checks pass, validate the deployment bundle: `npx --yes wrangler@4.147.0 deploy --config workers/wrangler.profile.jsonc --env production --dry-run`. Then deploy with the same command without `--dry-run`. A dry run compiles the Worker and validates config; it does **not** create Cloudflare routes, bindings or a deployment. The real deployment creates the native limiter binding and route. If routes are managed manually, verify Workers & Pages → `instascope-public-photo` → Settings → Domains & Routes contains the exact route, and Settings → Bindings contains the native limiter. Keep dashboard changes consistent with the committed Wrangler config, which is reapplied on deployment.
5. Rebuild the static site with `NEXT_PUBLIC_PROFILE_ENDPOINT=/api/profile-picture`. Set this as a **site build variable**, not a photo-Worker runtime variable. `next.config.ts` now supplies that exact default for recognized production builds (`main` on Cloudflare or the official production origin); explicit configuration wins. Preview/unconfigured local builds default to no endpoint. An explicitly empty value disables the frontend. Next public values are frozen into the static bundle, so changing a dashboard variable requires a rebuild; see [Next environment variables](https://nextjs.org/docs/app/guides/environment-variables).
6. Check `https://instascope.me/api/profile-picture/health`. A ready service returns HTTP 200 with `service: "instascope-profile-picture"`, `status: "ready"`, `configured: true`, `browserConfigured: true`, `enabled: true`. HTTP 503 with `disabled` or `not_configured` means the switch or a required binding still needs attention. An HTML/404 response means the route is not reaching this Worker. Health does not invoke either binding or contact Instagram, and reveals no secrets or identifiers.
7. Run `node scripts/smoke-production.mjs https://instascope.me --require-profile`. It verifies the frontend's compiled endpoint **and** the Worker health response. It fails if either is missing/disabled. Health readiness means infrastructure is configured, not that any particular Instagram account is retrievable. Test a public profile manually through the tool to validate Cloudflare's actual upstream response. No CI gate depends on a third-party account remaining public or available.

The [Cloudflare native rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) requires Wrangler 4.36.0 or later. The documented command was dry-run validated with 4.147.0. Limits are per Cloudflare location, not a global strict quota. Missing or failing rate limiting fails closed. Logs remain disabled. Neither the main site's GitHub/Cloudflare auto-deployment nor committing the profile config automatically deploys this separate Worker; run the explicit command or configure a separate Workers Builds project targeting this config/environment.

The [Browser Run native Quick Actions binding](https://developers.cloudflare.com/browser-run/quick-actions/) requires compatibility date `2026-03-24` or later; this Worker already uses `2026-09-26`. No browser SDK dependency or runtime API token is required. Use remote mode for real binding tests; local emulation does not implement `quickAction`. Browser calls additionally consume the limiter's shared `profile-browser` key, limiting browser attempts to 10/minute per Cloudflare location. This is not a strict account-wide budget. [Browser Run quotas/pricing](https://developers.cloudflare.com/browser-run/pricing/) apply: Free includes 10 browser minutes/day; Paid includes 10 hours/month with additional browser time billed. Monitor usage in the account's Browser Run dashboard; platform rate/quota failures return a safe capacity error. No plan upgrade is made by this repository.

### Lookup behavior and validation

Success requires a matching OpenGraph profile title, a consistent `og:url` when present, one unambiguous image field and a verified HTTPS Instagram/Facebook CDN URL. After that check, a public `application/json` script record identifying the same username may provide an explicit `profile_pic_url`; exactly one trusted URL is preferred over the smaller OpenGraph thumbnail. Malformed, unrelated or ambiguous JSON records retain the verified OpenGraph image. Scripts are parsed as JSON, never executed, and no image URLs are rewritten. The Browser Run fallback also requires a successful upstream status and an unchanged final public profile URL. Its exact-URL allowlist blocks redirected documents and subresources; JavaScript is disabled. Instagram rate limits and server errors do not trigger browser retries. The client independently checks the returned username and CDN URL. Success analytics fires only after the image loads. If neither request method provides a verified photo, the existing unavailable state and Instagram profile link remain. The viewer enlarges the supplied image within its frame, with zoom/fullscreen controls; enlargement adds no source detail. A small source thumbnail must not be advertised as an original HD photo.

Safe error codes distinguish `service_not_configured`, `lookup_disabled`, `service_unavailable`, `service_rate_limited`, `service_budget_limited`, `service_daily_limited`, `request_rate_limited`, `instagram_rate_limited`, `profile_unavailable`, `upstream_unavailable`, and `lookup_timeout`. Raw exceptions and arbitrary backend strings are never displayed. The complete direct-plus-browser lookup is bounded by eight seconds, and both response bodies are limited to 2 MiB; the client times out after twelve seconds. Invalid/untrusted image responses and image-load failures show no fake preview.

### Progress, retry delays and local enhancement (INS-76)

The viewer shows an accessible progress panel through the API request and image loading, with a separate twelve-second image-load timeout. HTTP 429 responses disable lookup until a countdown expires, including attempts submitted with a different username. No automatic retry contacts Instagram. A validated provider `Retry-After` is forwarded; absent/invalid values use a ten-second retry interval for browser-provider capacity, or sixty seconds for the app's per-IP/shared-minute budget and Instagram rate limits. These are retry opportunities, not guarantees of upstream availability. The documented provider daily-exhaustion error is distinguished and retries wait until midnight UTC.

Cloudflare's [current Browser Run limits](https://developers.cloudflare.com/browser-run/limits/) list one Quick Action every ten seconds and ten browser minutes per day on Workers Free, shared across the account. This interval is **not** the lookup's maximum duration. The UI explains the shared interval for provider capacity, the ten-per-minute app budget separately, and daily exhaustion separately. Recheck these limits when changing the infrastructure plan.

Public HTML inspected for INS-76 exposed only `profile_pic_url`, with a 150px photo and no distinct higher-resolution owner field. The viewer does not modify signed CDN URLs or claim an original HD image. Optional **Enhance 2×** uses browser-canvas high-quality interpolation and a mild Gaussian unsharp mask on the verified photo; it synthesizes no facial detail. Original/enhanced comparison and a PNG download remain browser-local. No image is uploaded to an AI provider or other backend. Source dimensions are shown, enhancement inputs are capped at 1024px per side, and the local output URL is released on replacement/unmount. A CDN must allow anonymous CORS image loading for processing; failure leaves the original preview usable. CSP and profile URL validation remain unchanged.

INS-82 keeps browser-local Real-ESRGAN as an explicitly general-purpose **AI upscale 4×** option, preserving native learned dimensions rather than interpolating to 1080. Bounded overlapping tiles preserve larger source inputs. Face-specific restoration remains unavailable after the browser GFPGAN evaluation; it is not silently substituted with generic upscaling. Model/runtime files are self-hosted, hash/version pinned and prepared by both build commands. The dedicated worker keeps the UI responsive, can be cancelled and has bounded input/time. AI can estimate or change details and is not an original HD source. See [model provenance, licences, CSP and deployment details](PROFILE_AI.md) and the [face-model audit](PROFILE_AI_AUDIT.md). Lookup infrastructure and quotas are unchanged.

Run `npm run check`, `npm run build:production` and the full `npm run test:e2e` suite for the configured static build. The profile tests intercept the same-origin API and photo response. To additionally exercise the truly unconfigured build, unset `NEXT_PUBLIC_PROFILE_ENDPOINT`, set `NEXT_PUBLIC_PREVIEW=true`, run `npm run build`, then run `npm run test:e2e -- tests/e2e/profile-viewer.spec.ts --grep "deployment fallback"`. Remove the override and rebuild production before testing or deploying the configured feature. Worker unit tests cover current metadata, identity mismatches, login/redirect responses, rate limits, response-size limits, timeout and URL trust; health smoke tests never contact Instagram.

## First-party aggregate product analytics

INS-110 / merged PR #111 implements aggregate analytics, and the owner confirms the production collector is deployed. On 13 October 2026, live Privacy compiled `/api/events`; GET returned 405 and the non-writing unknown-event probe returned 400 with the collector's expected headers. This confirms configuration, not durable event ingestion or totals.

Production builds compile `NEXT_PUBLIC_ANALYTICS_ENDPOINT=/api/events` by default using the existing production/preview environment detection. Preview and local builds remain disabled unless a valid same-origin endpoint is explicitly configured. `NEXT_PUBLIC_ANALYTICS_ENDPOINT=off` disables delivery even in production; a preserved explicit empty value also disables it. Rebuild after changing public variables. Check `out/privacy/index.html` and the deployed Privacy paragraph's `data-analytics-endpoint`; runtime Worker variables cannot change the static client.

The static application deployment does **not** deploy this separate collector. The following is the runbook for a future explicit collector deployment: use the existing account session/token for the Cloudflare account owning `instascope.me`, confirm proxied DNS and Analytics Engine availability, and verify native limiter namespace `1002` does not belong to an unrelated service. The production config declares `EVENTS` for `instascope_events`, `RATE_LIMITER` at 60 events per 60 seconds, and the HTTPS route `https://instascope.me/api/events*`. Only exact `/api/events` is accepted by the handler. Existing CSP `connect-src 'self'` already permits this endpoint; no CORS or third-party endpoint is added.

```powershell
$env:PATH = "$PWD\.tools\node-v24.21.0-win-x64;$env:PATH"
npx.cmd --yes wrangler@4.147.0 deploy --config workers/wrangler.analytics.jsonc --env production
npm.cmd run build:production
```

Then publish the generated `out` directory through the existing static deployment. Analytics Engine creates the dataset on the first accepted write. Native rate limiter bindings are verified through Wrangler's config/deployment output, not a dashboard binding list. Limiting is approximate and per Cloudflare location. Check [current account availability and pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/) without upgrading or assuming permanently free quotas. The INS-112 readiness audit changes no deployment, account settings, bindings or plan.

The footer's reporting destination is the existing public repository's GitHub issue form. Repository visibility and enabled Issues were verified before linking it. Reports are public and must contain fictional examples rather than archives, account lists or credentials; GitHub sign-in is required to submit a report. If repository visibility changes, remove or replace this public link rather than pointing users at a private repository.

With remote delivery disabled, event names are visible only via a browser event listener:

```js
window.addEventListener("instascope:event", (e) =>
  console.info(e.detail.event),
);
```

The collector accepts exactly `{ "event": "<allowlisted name>" }`, with a 100-byte body bound and no metadata. It writes only `blobs: [event]`, `doubles: [1]`, with no indexes; Cloudflare additionally supplies ingestion timestamp and sampling fields. The connecting IP is used ephemerally by the native limiter, never stored in Analytics Engine or intentionally logged. Worker observability, invocation logs and Logpush are disabled; assess hosting/security logging separately. Client delivery respects Do Not Track, omits credentials/referrer and rejects redirects. Every response is `no-store`. Product actions remain usable if analytics is missing, rate limited or unavailable.

Use sampling-weighted totals, not raw row counts: `SELECT blob1 AS event, SUM(_sample_interval * double1) AS total FROM instascope_events WHERE timestamp >= NOW() - INTERVAL '7' DAY GROUP BY blob1 ORDER BY total DESC FORMAT JSON`. [ANALYTICS.md](ANALYTICS.md) contains the full event audit, exact SQL/API instructions and guarded event-volume ratios. Account-restricted reporting tokens stay outside the frontend and repository. These metrics do not identify users, sessions or whether one person returned.

A configuration probe can POST `{"event":"readiness_probe"}` to `/api/events` with `Origin: https://instascope.me` and `Content-Type: application/json`. The unknown event is never persisted: `400` from the collector means it safely rejected the probe, `503` means bindings are unavailable, and `404`/HTML indicates a missing route. `429` means wait for the limiter; `204` with `DNT: 1` is a discarded request and does not prove readiness. Confirm `Cache-Control: no-store` and `X-Robots-Tag: noindex`. This checks routing/bindings, not durable event ingestion. Do not use a real product event for automated smoke checks.

## Remaining validation and owner decisions

- One JSON capture and one HTML capture have been audited locally; a repeated historical export series and alternate formats remain evidence gaps. See [archive support](archive-support.md).
- Test physical iPhone/Android devices and Safari; mobile Chromium/WebKit emulation does not establish physical-device behavior.
- Production domain, HTTPS redirect, canonicals, robots and sitemap now pass the dated live checks. Search Console verification/submission and actual indexing require separate evidence.
- Keep analytics payloads event-name-only. Use the non-writing readiness probe for configuration; inspect genuine product actions privately when checking ingestion.
- Public-photo health is ready, but upstream availability and provider limits can change. Recheck when changing that service; no account/plan change is part of this parking task.
- Further feature/growth work is deferred as described in [current progress](roadmap-progress.md).
