# Search readiness

Production builds use the official origin https://instascope.me for canonical, OpenGraph, Twitter and sitemap URLs. Every public page has a unique title/description and social preview image. Preview/unconfigured builds remain noindex and emit an empty sitemap. CI tests the configured production build; `NEXT_PUBLIC_PREVIEW=true` overrides inherited production configuration.

Structured data describes only observable product facts: WebSite on the homepage, WebApplication on tool pages, and BreadcrumbList matching visible breadcrumbs. No reviews, ratings, organization identity or user counts are invented. Sources: [Schema.org WebApplication](https://schema.org/WebApplication) and [Google breadcrumb guidance](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb). This markup does not promise rich-result eligibility or rankings.

The Playwright SEO audit visits every sitemap URL, checks uniqueness, response codes, canonical/OG consistency, indexability, visible breadcrumbs and parseable structured data. A separate route sweep checks assets, layout and one H1. Do not submit to Search Console until the deployed production audit in M15 passes. At M2 implementation time the existing live deployment still served older metadata; configuring local output alone does not prove live indexing readiness.
