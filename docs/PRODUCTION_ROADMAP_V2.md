# InstaScope — Production, Growth & Traffic Roadmap

> **Project:** InstaScope  
> **Production domain:** `https://instascope.me`  
> **Primary goal:** Build a trustworthy Instagram utility product and deliberately create repeatable traffic loops.  
> **Execution:** One milestone at a time. Validate before moving on.

---

# 0. Agent Rules

The repository already contains a working product.

Do not rewrite stable core functionality.

For every milestone:

1. Inspect current code first.
2. Implement only the current milestone.
3. Run:
   - typecheck
   - lint
   - unit tests
   - relevant Playwright tests
   - production build
4. Fix regressions.
5. Commit the completed milestone separately.
6. Then continue.

Do not push broken code to `main`.

Do not return only a plan.

Implement.

---

# 1. Product Positioning

InstaScope should be:

> A fast, privacy-first Instagram utility suite that analyzes a user's own Instagram export locally in the browser and provides selected public-profile tools without requiring Instagram login.

Core principles:

- no Instagram password
- no Instagram account connection
- archive analysis stays browser-local
- no archive upload to a server
- no automatic mass unfollow
- no private-content bypass
- no fake “profile visitors” / “stalker” claims
- truthful snapshot wording
- useful mobile UX
- low infrastructure cost
- strong organic-search acquisition
- shareable outputs that can bring new users back to InstaScope

---

# 2. Production Domain

Official production domain:

```text
https://instascope.me
```

Production environment:

```text
NEXT_PUBLIC_SITE_URL=https://instascope.me
```

Use the production domain for:

- canonical URLs
- sitemap
- OpenGraph
- structured data
- share-card branding
- public absolute links

Do not expose `workers.dev` as canonical production.

---

# 3. Growth Model

Traffic should come from multiple loops.

## Loop A — Search traffic

Example searches:

```text
who doesn't follow me back on instagram
instagram followers analyzer
instagram unfollowers without password
instagram following analyzer
instagram profile picture viewer
instagram followers json
how to analyze instagram data export
```

These searches should land directly on useful InstaScope pages.

## Loop B — Viral sharing

Wrapped / story cards include:

```text
Made with InstaScope
instascope.me
```

Shared cards can generate direct visits.

## Loop C — Public-profile tools

Public profile tools can attract visitors who do not yet have an Instagram export.

Those users should then discover:

- Followers Analyzer
- Not Following Back
- Cleaner
- Wrapped

## Loop D — Return usage

Local snapshots create a reason to return later.

Example:

```text
Upload this month's export
→ compare with previous snapshot
```

This is retention rather than acquisition, but improves product value and sharing.

---

# 4. Milestone 0 — Baseline Validation

Run:

```text
typecheck
lint
unit tests
Playwright
production build
```

Verify:

```text
/
 /followers-analyzer/
 /not-following-back/
 /following-analyzer/
 /instagram-cleaner/
 /snapshot-comparison/
 /instagram-wrapped/
 /profile-picture-viewer/
 /privacy/
 /how-to-download-instagram-followers-data/
 /changelog/
 /robots.txt
 /sitemap.xml
```

Check:

- broken routes
- console errors
- missing assets
- mobile issues
- archive network leakage
- parser regressions

Commit:

```text
chore: validate production baseline
```

---

# 5. Milestone 1 — Production Domain + Public UI Cleanup

## Production domain

Apply:

```text
NEXT_PUBLIC_SITE_URL=https://instascope.me
```

Verify:

- canonical tags
- sitemap
- robots
- OpenGraph URLs
- metadata URLs

## Remove visible upward-right arrows

Remove visible symbols such as:

```text
↗
↗︎
```

from links site-wide.

Do not replace them with another emoji.

Use semantic accessibility markup when necessary instead of visible decorative glyphs.

Check:

- header
- footer
- cards
- related tools
- article links
- documentation links
- profile links

## Navigation

Main tools must be easily discoverable:

```text
Followers Analyzer
Not Following Back
Following Analyzer
InstaCleaner
Compare Snapshots
Instagram Wrapped
Profile Picture Viewer
```

Commit:

```text
feat: prepare instascope.me production shell
```

---

# 6. Milestone 2 — Search Engine Readiness

This milestone must happen early.

The site should become technically ready for indexing before traffic work begins.

## 6.1 Canonical URLs

Every indexable page must point to:

```text
https://instascope.me/...
```

Never:

```text
workers.dev
localhost
preview URLs
```

## 6.2 Robots

Production robots must:

- allow intended public pages
- reference production sitemap

Preview/staging should remain non-indexed where practical.

## 6.3 Sitemap

Include only:

- canonical
- real
- indexable
- production URLs

Exclude:

- staging
- preview
- duplicate variants
- parameterized states
- noindex pages

## 6.4 Metadata

Each major page needs:

- unique title
- unique description
- canonical
- OpenGraph title
- OpenGraph description
- OpenGraph URL

## 6.5 Structured data

Use only accurate structured data.

Potentially:

```text
WebSite
WebApplication / SoftwareApplication
BreadcrumbList
FAQPage only if visibly rendered and appropriate
```

Do not invent:

- reviews
- ratings
- user count
- company details

## 6.6 Heading structure

Every primary landing page:

- one H1
- useful H2 sections
- sensible H3 structure

Do not use headings only for visual styling.

## Acceptance criteria

- production site is technically safe for indexing
- no staging URL leaks
- no duplicate canonical problems
- sitemap is clean
- robots is correct

Commit:

```text
feat: prepare search engine indexing
```

---

# 7. Milestone 3 — High-Intent SEO Landing Pages

This is a direct traffic-acquisition milestone.

Do not wait until the end of the roadmap.

The goal is to rank for searches that indicate a user already wants the exact utility InstaScope provides.

---

## 7.1 Not Following Back

Route:

```text
/not-following-back/
```

Primary intent:

```text
who doesn't follow me back on instagram
```

Suggested title:

```text
Who Doesn't Follow Me Back on Instagram? | InstaScope
```

Include useful sections:

- What this tool shows
- How it works
- Why Instagram password is not required
- What “not following back” means
- Difference between current one-way follow and snapshot-based change
- What InstaScope cannot prove
- Privacy
- How to get Instagram export
- FAQ
- Related tools

Keep tool near the top.

---

## 7.2 Followers Analyzer

Route:

```text
/followers-analyzer/
```

Target intent:

```text
instagram followers analyzer
instagram follower analysis
instagram followers export analyzer
```

Suggested title:

```text
Instagram Followers Analyzer — Private & No Login | InstaScope
```

Explain:

- followers
- following
- mutuals
- fans
- one-way follows
- local browser processing
- export requirements

---

## 7.3 Following Analyzer

Route:

```text
/following-analyzer/
```

Target:

```text
instagram following analyzer
analyze who i follow on instagram
```

Suggested title:

```text
Instagram Following Analyzer — No Login | InstaScope
```

---

## 7.4 InstaCleaner

Route:

```text
/instagram-cleaner/
```

Target:

```text
instagram following cleaner
instagram unfollow cleaner
clean instagram following list
```

Suggested title:

```text
Instagram Following Cleaner — No Password | InstaScope
```

Clearly state:

- manual review only
- no automatic unfollow
- no Instagram credentials

---

## 7.5 Snapshot Comparison

Route:

```text
/snapshot-comparison/
```

Target:

```text
compare instagram followers
instagram follower changes
instagram unfollowers between exports
```

Suggested title:

```text
Compare Instagram Followers Over Time | InstaScope
```

Explain:

- two snapshots
- new/missing accounts
- snapshot limitations
- not continuous tracking

---

## 7.6 Wrapped

Route:

```text
/instagram-wrapped/
```

Target:

```text
instagram wrapped
instagram follower stats
instagram year stats
```

Suggested title:

```text
Instagram Wrapped — Your Follower Stats | InstaScope
```

---

## 7.7 Profile Picture Viewer

Route:

```text
/profile-picture-viewer/
```

Target:

```text
instagram profile picture viewer
instagram profile picture full size
instagram pfp viewer
```

Suggested title:

```text
Instagram Profile Picture Viewer — Full Size | InstaScope
```

Do not promise private/restricted access.

## Acceptance criteria

Each page:

- answers a real search intent
- has unique copy
- has unique metadata
- avoids keyword stuffing
- contains meaningful content
- links to related tools
- keeps the utility high on the page

Commit:

```text
feat: build high-intent seo landing pages
```

---

# 8. Milestone 4 — Demo Mode

Traffic is wasted if a visitor cannot experience the product immediately.

Add:

```text
Upload Instagram export

or

Try demo
```

Demo data must be fictional.

Include:

- followers
- following
- mutuals
- not following back
- fans
- timestamps
- enough accounts for sorting/search/pagination

Support demo use in:

- Followers Analyzer
- Not Following Back
- Following Analyzer
- Cleaner
- Wrapped

Provide two fictional snapshots for comparison.

Clearly label:

```text
Demo data
```

Commit:

```text
feat: add interactive demo mode
```

---

# 9. Milestone 5 — Homepage Acquisition & Conversion

Homepage must turn incoming search/direct visitors into product users.

## Hero

Communicate immediately:

- Instagram relationship analysis
- no password
- local browser processing
- free

## Result preview

Example fictional preview:

```text
1,284 Followers
932 Following
742 Mutuals
190 Don't follow you back
```

Label as demo.

## All Tools grid

Show:

```text
Followers Analyzer
Not Following Back
Following Analyzer
InstaCleaner
Compare Snapshots
Instagram Wrapped
Profile Picture Viewer
```

Differentiate:

```text
Uses your Instagram export
```

and:

```text
Public profile tool
```

## Internal acquisition links

Homepage should link prominently to the strongest search-intent pages.

Priority:

1. Not Following Back
2. Followers Analyzer
3. Profile Picture Viewer
4. Cleaner
5. Snapshot Comparison
6. Wrapped

Commit:

```text
feat: improve homepage acquisition flow
```

---

# 10. Milestone 6 — Small SEO Content Cluster

Build a small set of useful informational pages to attract long-tail search traffic.

Recommended:

```text
/how-to-see-who-doesnt-follow-you-back-on-instagram/
/instagram-unfollowers-without-password/
/is-instagram-follower-tracker-safe/
/how-to-analyze-instagram-data-download/
/instagram-followers-json-explained/
```

Each page must:

- answer a real question
- be genuinely useful
- link naturally to a relevant InstaScope tool
- avoid duplicated copy
- avoid fake dates
- avoid keyword stuffing
- avoid unsupported Instagram claims

Do not create 100 thin pages.

Quality > quantity.

Commit:

```text
feat: add initial organic traffic content
```

---

# 11. Milestone 7 — Export Guide Acquisition

Improve:

```text
/how-to-download-instagram-followers-data/
```

This page can itself acquire search traffic.

Structure:

```text
iPhone
Android
Desktop
```

Highlight:

```text
Followers and Following
All time
JSON
```

Add contextual CTAs:

```text
Already have your export?
Analyze it with InstaScope.
```

Use resilient instructions because Instagram UI labels may change.

Commit:

```text
feat: improve instagram export guide
```

---

# 12. Milestone 8 — Wrapped V2 Viral Traffic Loop

Wrapped is not only a product feature.

It is an acquisition loop.

Upgrade to multiple story cards.

Suggested slides:

```text
Overview
Mutuals
One-way follows
Relationship age
Since previous snapshot
```

Export:

```text
Download current slide
Download story pack
Share
```

Size:

```text
1080 × 1920
```

Every exported card should include tasteful branding:

```text
Made with InstaScope
instascope.me
```

No `workers.dev`.

No usernames by default.

The branding should be visible enough to drive discovery but not ruin the card.

Commit:

```text
feat: launch wrapped viral sharing
```

---

# 13. Milestone 9 — Public Profile Viewer Traffic Loop

The public-profile viewer can attract users who do not yet have an export.

Keep it isolated from archive analysis.

Requirements:

- public information only
- no Instagram login
- no cookies
- no restricted-content bypass
- rate limiting
- graceful failure

Validate:

- public account
- nonexistent username
- invalid username
- login redirect
- 429
- timeout
- missing image
- invalid CDN

Copy:

> InstaScope shows the profile photo when Instagram makes it publicly available.

If reliable public metadata is available from the same response, optionally show:

- display name
- bio
- posts
- followers
- following

Do not turn this into mass scraping.

## Cross-sell

After successful lookup, naturally surface:

```text
Want to analyze your own Instagram followers?
Try Followers Analyzer
```

and:

```text
See who doesn't follow you back
```

Commit:

```text
feat: activate public profile acquisition
```

---

# 14. Milestone 10 — InstaCleaner Upgrade

Add manual review workflow.

Review states:

```ts
type ReviewState = "unreviewed" | "keep" | "cleanup";
```

UI:

```text
Keep
Cleanup candidate
Open Instagram
Next
```

Progress:

```text
47 / 216 reviewed
```

Bulk selection:

```text
Select this page
Select all filtered results
```

Follow-age filters:

```text
Any time
> 1 year
> 2 years
> 5 years
```

No automatic unfollow.

Commit:

```text
feat: add cleaner review workflow
```

---

# 15. Milestone 11 — Archive Health Report

After import show useful diagnostics:

```text
Format: JSON
Followers files: 2
Following files: 1
Timestamps available: 98%
Followers: 1,842
Following: 1,211
```

Warnings should be accurate.

Do not invent completeness certainty.

Commit:

```text
feat: add archive health report
```

---

# 16. Milestone 12 — Local Snapshot Vault

Retention feature.

Allow explicit:

```text
Save this snapshot on this device
```

Store normalized data only.

Prefer IndexedDB.

Do not store:

- raw ZIP
- unrelated archive content
- passwords
- tokens
- cookies

Actions:

```text
Compare
Rename
Delete
Clear all
```

Display:

> Saved only on this device.

Commit:

```text
feat: add local snapshot vault
```

---

# 17. Milestone 13 — History & Timeline

Use saved snapshots.

Show:

- follower count
- following count
- mutual count
- not-following-back count
- net changes

Clearly say:

> Based on snapshots saved on this device.

Do not imply continuous monitoring.

Commit:

```text
feat: add local relationship history
```

---

# 18. Milestone 14 — Privacy-Safe Analytics

We need to know which acquisition channels and pages actually work.

Never send:

- usernames
- archive contents
- follower lists
- filenames
- relationship graphs
- private data

Track simple event names.

Page events:

```text
view_home
view_followers_analyzer
view_not_following_back
view_following_analyzer
view_cleaner
view_snapshot_comparison
view_wrapped
view_profile_picture_viewer
view_export_guide
```

Conversion events:

```text
demo_started
parser_started
parser_succeeded
results_viewed
cleaner_opened
snapshot_saved
comparison_succeeded
wrapped_generated
wrapped_downloaded
wrapped_shared
profile_search
profile_succeeded
```

This lets us later answer:

```text
Which landing page gets traffic?
Which page converts?
Which tool gets used?
Which share loop works?
```

Commit:

```text
feat: add privacy-safe growth analytics
```

---

# 19. Milestone 15 — Search Console / Indexing Readiness

Do not submit to Google before this milestone passes.

Verify:

- production domain works
- HTTPS works
- no `workers.dev` canonical
- robots correct
- sitemap correct
- major pages indexable
- no accidental noindex
- metadata unique
- structured data valid
- no broken links
- mobile UX acceptable

Prepare clear URLs for submission:

```text
https://instascope.me/
https://instascope.me/not-following-back/
https://instascope.me/followers-analyzer/
https://instascope.me/profile-picture-viewer/
https://instascope.me/instagram-cleaner/
https://instascope.me/snapshot-comparison/
https://instascope.me/instagram-wrapped/
https://instascope.me/how-to-download-instagram-followers-data/
```

Commit:

```text
chore: prepare google indexing launch
```

---

# 20. Milestone 16 — Trust Pages

Ensure:

```text
/about/
/contact/
/terms/
/privacy/
```

Optional:

```text
/report-an-issue/
```

Do not invent business details.

Commit:

```text
feat: add public trust pages
```

---

# 21. Milestone 17 — Final Growth Launch Audit

Before serious promotion, inspect the whole public site.

## Search repository for

```text
TODO
FIXME
placeholder
example.com
localhost
workers.dev
lorem
INS-
```

Review all public-facing occurrences.

## Technical

Check:

- every public route
- console errors
- hydration
- asset loading
- internal links
- canonical
- robots
- sitemap
- OG
- favicon

## Mobile

Test:

- iPhone Safari
- Android Chrome
- upload
- Cleaner
- Wrapped
- dialogs
- profile lookup

## Traffic / conversion

Verify a new user can travel:

```text
Google landing page
      ↓
understands utility
      ↓
tries demo or uploads archive
      ↓
gets result
      ↓
discovers related tools
      ↓
shares Wrapped or returns later
```

Commit:

```text
chore: complete growth launch audit
```

---

# 22. Traffic Priorities

When choosing between optional work, use this order.

## Highest acquisition potential

```text
1. Not Following Back landing page
2. Followers Analyzer
3. Profile Picture Viewer
4. Export guide / how-to pages
5. Instagram Wrapped sharing
6. Following Analyzer
7. Cleaner
8. Snapshot Comparison
```

This order is about acquisition potential, not product importance.

Do not remove or neglect retention features.

---

# 23. What Not To Do For Traffic

Do not chase traffic by building deceptive features.

Avoid:

- who stalks my Instagram
- profile visitors
- secret admirers
- private account viewer
- private stories
- private posts
- guaranteed private PFP access
- fake inactivity scores
- automatic mass unfollow

Do not create:

- thousands of thin SEO pages
- keyword-stuffed titles
- hidden text
- copied content
- fake reviews
- fake user counts
- fake “updated today” claims

Traffic obtained by destroying trust is not useful traffic.

---

# 24. Later Growth Experiments

After Search Console data exists, optimize based on actual impressions.

Possible future tests:

- alternative page titles
- stronger internal links
- richer FAQs
- more useful examples
- query-specific content expansions
- higher-converting CTA copy
- additional high-intent articles only when Search Console shows demand

Do not guess forever.

Use actual search data.

---

# 25. Milestone Order Summary

```text
M0  Baseline validation
M1  instascope.me production + remove ↗ arrows
M2  Search engine readiness
M3  High-intent SEO landing pages
M4  Demo Mode
M5  Homepage acquisition/conversion
M6  Small SEO content cluster
M7  Export guide acquisition
M8  Wrapped viral traffic loop
M9  Public profile viewer acquisition
M10 Cleaner upgrade
M11 Archive health report
M12 Local snapshot vault
M13 History / timeline
M14 Privacy-safe growth analytics
M15 Search Console / indexing readiness
M16 Trust pages
M17 Final growth launch audit
```

Traffic acquisition is intentionally built into the roadmap early rather than added as an afterthought.

---

# 26. Definition of Success

Desired acquisition loop:

```text
User searches Google
        ↓
lands on a highly relevant InstaScope page
        ↓
immediately understands the value
        ↓
tries demo or uses the tool
        ↓
discovers additional tools
        ↓
shares a branded Wrapped card
        ↓
new visitor sees instascope.me
```

Desired retention loop:

```text
User analyzes export
        ↓
saves snapshot locally
        ↓
returns with later export
        ↓
compares changes
        ↓
uses InstaScope again
```

The product should feel:

- legitimate
- useful
- fast
- polished
- privacy-first
- mobile-friendly
- search-friendly
- shareable
- not spammy
- not deceptive

---

# 27. Final Instruction to the Coding Agent

Inspect the current repository and project documentation before changing code.

The code is the source of truth if documentation is stale.

Implement one milestone at a time.

After each milestone:

```text
validate
test
build
commit
```

Then continue.

Official production domain:

```text
https://instascope.me
```

Traffic acquisition is a first-class product requirement.

Build search traffic, sharing traffic, public-tool traffic, and return usage deliberately.

Do not sacrifice privacy or truthfulness for traffic.
