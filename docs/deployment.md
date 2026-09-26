# Deployment and launch

Production is now live at https://instascope.me (owner-confirmed 2026-09-27). The initial live audit found localhost canonical URLs and noindex metadata; do not submit for indexing until M1/M2 production configuration is verified. `node scripts/smoke-production.mjs` checks public HTTP responses without any user data.

## Static application

1. Use Node 24; run `npm ci`.
2. Set `NEXT_PUBLIC_SITE_URL` to the actual HTTPS origin (without a trailing slash).
3. Run `npm run check` and `npm run test:e2e` after installing Chromium.
4. Publish `out/` to a static host such as Cloudflare Pages. `public/_headers` supplies security headers for hosts supporting that format; configure equivalent headers elsewhere.
5. Confirm direct visits to every tool route, worker script loading, favicon, social image, sitemap and mobile uploads on the final domain.
6. Verify current hosting quotas/prices before enabling infrastructure. No cost or free-tier assumption is encoded in the application.

Next supports [static exports](https://nextjs.org/docs/app/guides/static-exports). This application needs no application server for archive analysis. Its CSP permits Next's generated inline scripts; do not claim a strict nonce-based CSP. Do not add third-party scripts with access to the export workspace.

Always use `npm run build`, including on Windows. It normalizes wrongly nested Next RSC segment paths in the static output so browser prefetch URLs resolve on ordinary static hosts; it does not change payload content. A collision with different content fails the build. Correctly emitted Linux exports are unchanged.

## Optional public-photo Worker

`workers/profile-picture.ts` accepts usernames only, builds a fixed Instagram HTTPS URL, refuses redirects, omits cookies/authentication, caps response bytes/time, and accepts only a matching profile OpenGraph title plus an Instagram/Facebook image CDN URL. It neither rewrites CDN URLs to invent resolution nor accesses private APIs. The available upstream image determines resolution. Restrictions, login responses and rate limits return an error.

Research checked Meta's Business Discovery documentation URL but could not retrieve it in this environment. There is no verified universally available, credential-free Instagram profile-photo API in this implementation. The public HTML adapter is explicitly best-effort, not a promise of reliable access, and is disabled by default. Revalidate current platform requirements and availability before enabling public lookup.

Deploy independently with Wrangler using `workers/wrangler.profile.jsonc`, add a same-origin route such as `/api/profile-picture*`, and bind the native rate limiter. Set `ENABLE_PUBLIC_LOOKUP=true` only after verifying public delivery. Set `NEXT_PUBLIC_PROFILE_ENDPOINT=/api/profile-picture` and rebuild the site. The [Cloudflare rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) allows 10 requests/minute per IP key in this config; its limits are per Cloudflare location, not a global strict quota. Requests fail closed without the binding. Logs are disabled by default.

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
