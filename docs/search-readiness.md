# Search readiness

`src/lib/public-paths.ts` is the shared public URL inventory for sitemap, tests
and the read-only auditor. INS-154 retains the existing Instagram URLs and adds
the four released WhatsApp tool pages, `/whatsapp/guides/` and ten guides. It
changes public education and indexing, not private analysis or release gates.

| Surface                                | Production                                                                    | Preview / unknown context                |
| -------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| Published Instagram and WhatsApp pages | `index, follow`; self-canonical; in sitemap once                              | `noindex, nofollow`; empty sitemap       |
| `/dashboard/`, `/snapshot-vault/`      | `noindex, follow`; absent from sitemap                                        | `noindex, nofollow`; absent from sitemap |
| WhatsApp Chat Vault landing            | Public education is indexable; saved records remain local with no public URLs | `noindex, nofollow`                      |
| Missing/unreleased routes              | True 404 / existing release pruning                                           | True 404 / existing release pruning      |
| `robots.txt`                           | `User-agent: *`, `Allow: /`, `Disallow: /api/`                                | `User-agent: *`, `Disallow: /`           |

Both robots files reference `https://instascope.me/sitemap.xml`. Canonical,
OpenGraph, Twitter and sitemap URLs always use the official origin. Parameter
states canonicalize to their clean page URL; no private result, participant,
query state or stored snapshot enters the sitemap. Public pages have distinct
titles/descriptions and meaningful initial HTML. Existing Instagram social art
is preserved; WhatsApp uses its own self-hosted preview image.

Structured data describes observable product and visible content: WebSite,
WebApplication, BreadcrumbList, Article and visible FAQ where appropriate. No
invented reviews, ratings, user counts or organization identity. Markup does not
promise rich results. See [Google's structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

Run `node scripts/audit-public-seo.mjs --static out` after an explicit production
build; use `--mode preview` after `build:dev`. After owner deployment run the same
script with `https://instascope.me` instead of `--static out`, then
`node scripts/smoke-production.mjs https://instascope.me --require-profile --require-whatsapp --require-seo`.
CI runs static audits for both environments. The script makes bounded same-origin
GETs, executes no browser JavaScript and never sends synthetic analytics. Browser
suites separately exercise guide-to-tool paths, initial rendering, private
imports and mobile layouts.

The pre-change 17 October audit found all 31 existing public Instagram URLs
returning 200, index/follow and matching canonical/OG URLs; the sitemap and
referenced JS/CSS passed. This does not establish the cause of the owner's
reported zero-impression period or prove Google's selected canonical/index
state. Current `www` DNS and the publicly indexable Workers alias are hosting
hygiene gaps requiring owner review; neither is proven to explain that report.
No account setting, DNS record, deployment or collector is changed here.

Keep four separate outcomes: **IMPLEMENTATION READY**, **PRODUCTION VERIFIED**,
**GOOGLE INDEX STATUS VERIFIED**, **TRAFFIC RECOVERY OBSERVED**. Passing local
checks supports only the first. See the [German owner handoff](google-search-handoff.md)
for the prioritized URL-inspection queue, live evidence and rollback steps.
