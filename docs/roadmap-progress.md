# Current product progress

Production: https://instascope.me. This status supersedes the stale V2 checklist;
[Roadmap V3](PRODUCT_ROADMAP_V3.md) remains the relationship-review direction.
The roadmap/specification documents retain their original planning context.
Continue to follow [WORKFLOW.md](../WORKFLOW.md) for any resumed work.

## Completed within the current product scope

| Earlier milestone | Current implementation and evidence |
| --- | --- |
| M0–M7: baseline, domain, SEO, demo, homepage, guides | Implemented through INS-9–24 and subsequent V3 refinements. Production domain/indexing corrections include INS-27. |
| M8: Wrapped stories | Aggregate 1080 × 1920 stories, InstaScope attribution, individual PNG downloads and native sharing (INS-64), with optional supported mutual-origin and saved-history stories (INS-94/102). |
| M9: public-profile acquisition | Independent public-photo viewer, isolated rate-limited Worker and graceful upstream failure (INS-72/74/76/82). Lookup is best-effort; local enhancement does not recover an original HD source. |
| M10: manual review | Broader Cleaner review, persistent local Review Memory and Watch Circle (INS-100), without automatic Instagram actions. |
| M11: archive health | Export Doctor reports factual source/date coverage and optional-list states (INS-106/108), without asserting export completeness. |
| M12–M13: local snapshots/history | IndexedDB Vault with private backups (INS-90), observed account history and recorded mutual origins (INS-94/96), plus Circle Pulse (INS-102). Saved points are observations, not continuous history. |
| M14: aggregate analytics | INS-110 / PR #111 implements first-party aggregate analytics. INS-134 / merged PR #135 (`cb0a780`) adds bounded attribution and once-per-Document entries; its Worker-first rollout/legacy verification is complete. INS-146 preserves that existing collector and exact client envelope in the WhatsAppScope static release; no Worker redeployment. See [analytics deployment evidence](ANALYTICS.md#production-deployment-and-preview-isolation). |
| M15: indexing preparation | Production canonicals, robots, sitemap and public metadata are implemented. The live checks below confirm the previously blocked public crawling configuration. Search Console ownership/submission and actual indexing are separate external actions. |
| M16 (partial): existing trust surfaces | Privacy page, independent-tool disclosure and a public GitHub reporting form are present. Additional About/Contact/Terms pages are deferred. |

The current workspace also includes fictional demos, a private Dashboard,
supported optional connection lists and two verified Archive Extras categories.
See [archive support](archive-support.md) and [the extras audit](ARCHIVE_EXTRAS_AUDIT.md)
for their precise data semantics.

INS-112 adds two small local utilities: full filtered account-list CSV downloads
and an optional calendar file after a successful real snapshot save.
[Utility behavior](PRODUCT_UTILITIES.md) documents their scope. The production
audit below predates deployment of these additions.

## Intentionally deferred

- Further feature expansion, UI redesign and changes to analytics architecture.
- Bulk Wrapped pack export and optional public-profile metadata beyond the
  verified photo; current single-card download/share and photo viewer remain useful.
- Additional trust pages without verified owner/business details, new SEO pages
  without observed demand, and growth changes based on unavailable Search Console evidence.

## Outside the current product design

Instagram credentials/login, accounts, cloud sync/archive uploads, automatic
Instagram actions and private-content bypasses are excluded from the current
browser-local relationship-review product.

## Evidence required before future work or broader claims

- Stable identity/rename detection needs verified target-account IDs that persist
  across repeated exports; current comparisons use normalized usernames.
  [Identity audit](IDENTITY_FEASIBILITY.md).
- Requested export range and additional datasets need verified source structure
  and safe semantics. Received requests, Favorites, muted accounts and removed
  followers were not found in the two inspected archives; activity documents were
  not accepted as relationship membership. Do not infer their availability.
- One JSON capture and one HTML capture have been audited locally. A repeated
  historical export series, alternate/localized formats and physical
  iPhone/Android/Safari behavior remain unverified. Synthetic fixtures and browser
  emulation do not establish those claims.
- M17's final growth/launch audit is not complete: physical-device behavior,
  actual search indexing and future upstream photo availability cannot be certified
  from local checks. Preserve the working product while collecting that evidence.

## Live audit — 13 October 2026

Read-only public requests confirmed: homepage and Privacy return 200 with
instascope.me canonicals and `index, follow`; Vault returns 200 with its canonical
and `noindex, follow`. Robots allows `/`, excludes `/api/` and references the
production sitemap; the sitemap returns 200 with 31 URLs. HTTP redirects to HTTPS
with 301. Public-photo health reports configured/enabled infrastructure with the
browser binding; this does not contact Instagram or guarantee a lookup result.

Privacy compiles `/api/events`. Analytics GET returns 405 (`Allow: POST`); POST of
the unknown `readiness_probe` event returns 400 with `no-store` and `noindex`.
The rejected probe writes no metric and verifies routing/bindings, not durable
ingestion, user authenticity or event totals. No account settings, deployment,
bindings or plans were changed for this audit.

The 27 September localhost/noindex/empty-sitemap baseline is historical and has
been corrected in the current deployment. The Windows static-export RSC-path
normalizer remains part of the build; see [deployment](deployment.md).
