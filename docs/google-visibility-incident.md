# Google visibility investigation — INS-154

The owner's latest Search Console update confirms zero impressions/clicks in
the latest 24 hours, while the preceding completed-period comparisons improved
for several important Instagram pages. The short zero-impression interval remains
unexplained; a site-wide ranking loss is not established. Differences between
report dates are not the diagnosis. Private Search Console exports and analytics
excerpts are not included here.

## Confirmed baseline

Audited production and source at `8ecb31747d2bff976afb48e4ade5026eed99d9e6`.
Cloudflare production check `df626ac5-78d2-4860-8c03-1163ce280168` and post-merge
GitHub Actions run `39022294288` succeeded. Live responses were consistent with
that release; independent Cloudflare account-version inspection was denied.

- All 31 existing Instagram public URLs returned GET 200, unique titles,
  descriptions and H1s, one production self-canonical, and index/follow.
- Each appeared exactly once in the production sitemap. Robots allowed public
  crawling, excluded `/api/`, and referenced `https://instascope.me/sitemap.xml`.
- No contradictory X-Robots-Tag, preview canonical, broken discovery link or
  orphan public page was found. Unknown paths returned real 404 responses.
- HTTP redirected to HTTPS (301); slashless and index.html variants redirected
  to the trailing-slash URL (307). All 32 referenced script/style assets loaded.
- Ten priority Instagram routes passed desktop Chromium, Pixel and iPhone
  WebKit rendering checks (30 checks). Explanatory initial HTML did not require
  an upload or browser storage. No hydration, asset or viewport failure occurred.
- Analytics was intercepted before browser navigation. No synthetic event was
  sent to the production collector.

Source history did not show an Instagram robots, sitemap or public-path policy
change around the investigated releases. Shared-shell/build changes alone are
not evidence that they caused the loss. No current Instagram-wide technical
indexing defect was established; do not describe this PR as a proven recovery.

## Hosting findings requiring owner review

1. `www.instascope.me` returned NXDOMAIN through independent DNS resolvers. No
   canonical or audited internal link uses www. An optional www redirect needs
   owner-managed DNS/hosting configuration; the missing alias is not established
   as the incident cause.
2. The production workers.dev alias returned index/follow HTML and permissive
   robots for the homepage and Followers Analyzer. Its canonical correctly
   points to instascope.me. Restricting that alternative host would reduce
   conflicting crawl signals, but Google's selected canonical is unknown.
   Do not put a global noindex in the shared production artifact: that would
   also block the canonical domain. See the owner handoff for host-level options.

No verified Googlebot challenge/block was observed because real bot/security
logs were inaccessible. A spoofed Googlebot user agent would not establish real
Google access, so it is not used as proof. No security rule has been changed.

## Unverified evidence and next diagnosis

The owner reports that three critical Instagram URLs are indexed and pass live
inspection, and confirms no manual action, temporary removal or host-access
problem. This is owner-supplied account evidence, not direct API access. The
specific three URLs, Google's selected canonicals, last crawl details, remaining
exclusion reasons and Security Issues results were not supplied. Do not claim
the complete inventory's Google status is verified. One consolidated evidence
request was made; no credentials or account writes are requested.

**Cause not yet established.** Eligibility checks cannot prove indexing,
ranking or traffic recovery. If inspection shows an unintended canonical or
crawl failure, correct that evidenced signal. If pages are indexed and fetchable,
assess intent/usefulness and actual search performance. An account action needs
its specific Google remediation, not an invented code fix.

Targeted content improvements preserve existing URLs and separate incoming
follower dates, outgoing follow dates, sent-request records and public-profile
access. The intent map is in `instagram-search-intents.md`; public WhatsApp
coverage is a separate, explicitly authorized search launch.

## Delivery states

- IMPLEMENTATION READY: only after repository, browser and hosted-preview checks.
- PRODUCTION VERIFIED: only after owner merge/deployment and live revalidation.
- GOOGLE INDEX STATUS VERIFIED: only with URL Inspection/account evidence.
- TRAFFIC RECOVERY OBSERVED: only with completed-period Search Console results.

The pre-change rollback reference is the audited main SHA above. No merge,
production deployment, DNS or account setting change is authorized by this work.
