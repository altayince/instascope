# Deployment and launch

Production is live at https://instascope.me. Public-page indexing and the application-only Dashboard have their existing independent metadata rules. `node scripts/smoke-production.mjs` checks public HTTP responses and public-photo infrastructure readiness without user archives or Instagram requests; add `--require-profile` to fail when the profile service is not wired.

## Static application

On Cloudflare Pages or Workers Builds, `npm run build` recognizes `CF_PAGES_BRANCH=main` or `WORKERS_CI_BRANCH=main` and generates an indexable `out/` automatically. Cloudflare preview branches generate `noindex, nofollow`, `Disallow: /` and an empty sitemap even if they inherit `NEXT_PUBLIC_SITE_URL=https://instascope.me`. Set the production branch to `main`; a missing branch value fails closed. `NEXT_PUBLIC_PREVIEW=true` always disables indexing. For a manual production release outside Cloudflare, use `npm run build:production` (or set `NEXT_PUBLIC_SITE_URL=https://instascope.me` before `npm run build`). Publish the resulting `out/` directory. The canonical origin is always instascope.me.

The live site previously served a preview/unconfigured build despite correct canonical URLs. If a main-branch deployment still returns `noindex`, inspect the host's build logs and confirm its build command runs `npm run build` on `main` with the Cloudflare branch variable present; alternatively configure the production build command as `npm run build:production`. Keep preview build commands on `npm run build` and set `NEXT_PUBLIC_PREVIEW=true` for non-Cloudflare preview systems. Cloudflare's [Pages build variables](https://developers.cloudflare.com/pages/configuration/build-configuration/) and [Workers Builds variables](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) document the injected branch names.

The live HTTP endpoint currently returns `200` rather than redirecting to HTTPS. Enable Cloudflare's [Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/) in the zone's SSL/TLS → Edge Certificates settings, then check that `http://instascope.me/` redirects to `https://instascope.me/`. The HTTPS canonical already identifies the preferred page; the edge redirect still needs the zone setting. Review any production `*.pages.dev` or `*.workers.dev` alias in Cloudflare and redirect it to the primary domain or block indexing there, because the same static production HTML cannot distinguish hostnames at request time.

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

This confirms the public-HTML format is still usable in at least one request context. It does **not** prove availability from Cloudflare egress: this session had no authenticated Cloudflare CLI/account access, so edge lookup was not tested or deployed. Instagram can return login pages, redirects, restrictions or rate limits depending on the account and request context. No credential-free API or unrestricted retrieval is promised. There are no cookies, credentials, private APIs, proxies or resolution-rewriting workarounds.

### Deploy the actual infrastructure

1. Authenticate to the Cloudflare account owning the `instascope.me` zone: `npx --yes wrangler@4.147.0 login`. In an automated deployment, use an account-scoped API token with Workers Scripts edit, Workers Routes edit for this zone and the zone-read permissions needed to resolve the route. Keep credentials outside the repository. If multiple accounts are available, select the correct account via `CLOUDFLARE_ACCOUNT_ID`.
2. Confirm `instascope.me` uses proxied Cloudflare DNS. The app may remain a static-assets Worker on its custom domain; the more specific API route handles browser requests directly. Do not have the app Worker call this same-zone route using server-side `fetch()`; use a service binding if such a design is ever required. See [Cloudflare routes](https://developers.cloudflare.com/workers/configuration/routing/routes/).
3. Review `workers/wrangler.profile.jsonc`: the explicit `production` environment uses Worker name `instascope-public-photo`, route `instascope.me/api/profile-picture*`, `ENABLE_PUBLIC_LOOKUP=true`, and native `RATE_LIMITER` with namespace `1001`, limit 10 / period 60. Confirm namespace `1001` is not assigned to an unrelated limiter in this account; choose another account-unique number in the config if needed. Bindings are repeated in the production environment because they are not inherited. The default environment stays disabled and has no production route.
4. After repository checks pass, validate the deployment bundle: `npx --yes wrangler@4.147.0 deploy --config workers/wrangler.profile.jsonc --env production --dry-run`. Then deploy with the same command without `--dry-run`. A dry run compiles the Worker and validates config; it does **not** create Cloudflare routes, bindings or a deployment. The real deployment creates the native limiter binding and route. If routes are managed manually, verify Workers & Pages → `instascope-public-photo` → Settings → Domains & Routes contains the exact route, and Settings → Bindings contains the native limiter. Keep dashboard changes consistent with the committed Wrangler config, which is reapplied on deployment.
5. Rebuild the static site with `NEXT_PUBLIC_PROFILE_ENDPOINT=/api/profile-picture`. Set this as a **site build variable**, not a photo-Worker runtime variable. `next.config.ts` now supplies that exact default for recognized production builds (`main` on Cloudflare or the official production origin); explicit configuration wins. Preview/unconfigured local builds default to no endpoint. An explicitly empty value disables the frontend. Next public values are frozen into the static bundle, so changing a dashboard variable requires a rebuild; see [Next environment variables](https://nextjs.org/docs/app/guides/environment-variables).
6. Check `https://instascope.me/api/profile-picture/health`. A ready service returns HTTP 200 with `service: "instascope-profile-picture"`, `status: "ready"`, `configured: true`, `enabled: true`. HTTP 503 with `disabled` or `not_configured` means the switch/binding still needs attention. An HTML/404 response means the route is not reaching this Worker. Health does not invoke the limiter or contact Instagram, and reveals no secrets or identifiers.
7. Run `node scripts/smoke-production.mjs https://instascope.me --require-profile`. It verifies the frontend's compiled endpoint **and** the Worker health response. It fails if either is missing/disabled. Health readiness means infrastructure is configured, not that any particular Instagram account is retrievable. Test a public profile manually through the tool to validate Cloudflare's actual upstream response. No CI gate depends on a third-party account remaining public or available.

The [Cloudflare native rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) requires Wrangler 4.36.0 or later. The documented command was dry-run validated with 4.147.0. Limits are per Cloudflare location, not a global strict quota. Missing or failing rate limiting fails closed. Logs remain disabled. Neither the main site's GitHub/Cloudflare auto-deployment nor committing the profile config automatically deploys this separate Worker; run the explicit command or configure a separate Workers Builds project targeting this config/environment.

### Lookup behavior and validation

Success requires a matching OpenGraph profile title, a consistent `og:url` when present, one unambiguous image field and a verified HTTPS Instagram/Facebook CDN URL. The browser independently checks the returned username and CDN URL. Success analytics fires only after the image loads. Instagram login/redirect/restricted/unavailable responses show a factual unavailable state; the existing Instagram profile link remains the safest fallback. If Cloudflare egress cannot retrieve a verifiable public photo, keep this limitation visible rather than enabling bypasses or promising a working result.

Safe error codes distinguish `service_not_configured`, `lookup_disabled`, `service_unavailable`, `request_rate_limited`, `instagram_rate_limited`, `profile_unavailable`, `upstream_unavailable`, and `lookup_timeout`. Raw upstream exceptions and arbitrary backend error strings are never displayed. Instagram requests time out after eight seconds and HTML is limited to 2 MiB; the browser times out after twelve seconds. Invalid/untrusted image responses and image-load failures show no fake preview.

Run `npm run check`, `npm run build:production` and the full `npm run test:e2e` suite for the configured static build. The profile tests intercept the same-origin API and photo response. To additionally exercise the truly unconfigured build, unset `NEXT_PUBLIC_PROFILE_ENDPOINT`, set `NEXT_PUBLIC_PREVIEW=true`, run `npm run build`, then run `npm run test:e2e -- tests/e2e/profile-viewer.spec.ts --grep "deployment fallback"`. Remove the override and rebuild production before testing or deploying the configured feature. Worker unit tests cover current metadata, identity mismatches, login/redirect responses, rate limits, response-size limits, timeout and URL trust; health smoke tests never contact Instagram.


## Optional product analytics

With no configuration, event names are visible only via a browser event listener:

```js
window.addEventListener('instascope:event', e => console.info(e.detail.event));
```

To enable remote aggregate metrics, deploy `workers/analytics.ts` using its Wrangler config, connect an Analytics Engine dataset and limiter, and add a same-origin `/api/events` route. Set `NEXT_PUBLIC_ANALYTICS_ENDPOINT=/api/events` and rebuild. Check current account pricing/availability first. The worker accepts exactly `{ "event": "<allowlisted name>" }`, rejects extra keys and large bodies, stores one event name and a numeric count, and does not store IP keys used for rate limiting. Hosting request logs must be assessed separately. The client respects Do Not Track and omits credentials and referrer.

Example aggregate query: `SELECT blob1 AS event, SUM(double1) AS total FROM instascope_events GROUP BY event`. Set retention/access controls appropriate to the chosen host. Do not add export counts, usernames, filenames, lists, persistent IDs or arbitrary event properties.

## Public launch gates

- INS-4 verified one current real JSON export locally. Real HTML and a second historical export remain outstanding (see archive-support.md).
- Test physical mobile devices and Safari; Chromium mobile emulation is not sufficient for universal support.
- Set domain, canonical URL, and verify robots now allows crawling.
- Verify the domain in Google Search Console, submit `/sitemap.xml`, and inspect tool pages.
- Configure analytics only if desired, then verify payloads contain event names alone.
- Recheck photo delivery and rate limiting if enabling that optional service.
- No promotional messages have been posted to social/community accounts.
