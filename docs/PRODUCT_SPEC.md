# InstaScope — Codex Handoff / Product & Implementation Spec

> **Status:** Active product specification  
> **Role of this file:** Source of truth for Codex implementation  
> **Project:** InstaScope  
> **Last updated:** 2026-09-26

---

## 0. Codex Instructions — Read This First

Read this entire file before making changes.

Treat this document as the current product and implementation specification for InstaScope.

Your job is to:

1. Inspect the existing repository first.
2. Understand what already works.
3. Preserve working code where possible.
4. Fix concrete bugs before unnecessary rewrites.
5. Implement missing functionality in the priority order defined below.
6. Keep the architecture modular.
7. Run the application and tests after meaningful changes.
8. Fix build, runtime, type, lint, and test errors you introduce or uncover.
9. Do not stop after only describing what should be done.
10. Make the code changes.

Do **not** rebuild already-working functionality simply because you would design it differently.

If an architectural change is truly necessary, document the reason clearly.

---

# 1. Product Summary

**InstaScope** is a privacy-first Instagram data analysis website.

The core idea is simple:

> Users should be able to understand their Instagram follower/following data without giving InstaScope their Instagram password.

The primary workflow should rely on the user's **official Instagram data export**.

The user uploads Instagram ZIP / JSON / HTML export data.

Whenever technically possible:

- parsing happens locally in the browser;
- analysis happens locally in the browser;
- raw archive contents are not uploaded to our server;
- the user does not need an InstaScope account;
- the user does not give us an Instagram password;
- we do not ask the user for Instagram session cookies;
- we do not depend on fragile private Instagram APIs for the core analytics product.

This architecture is both a product feature and a marketing advantage.

Primary positioning:

> **Your Instagram data, actually useful. No login required.**

Alternative consumer-facing copy:

> **See who follows, unfollows, and ignores you — without giving anyone your Instagram password.**

The product should feel more like a fun social/detective tool than a boring enterprise analytics dashboard.

---

# 2. Product Structure

InstaScope is the main product.

It contains multiple tools/modules.

## 2.1 Core Modules

### A. Followers Analyzer

Analyze the user's Instagram export and calculate:

- followers
- following
- mutuals
- accounts the user follows that do not follow them back
- accounts following the user that the user does not follow back
- counts and ratios
- sortable/filterable account lists

Suggested labels:

- Followers
- Following
- Mutuals
- Not Following Back
- Fans / Follows You

Avoid ambiguous wording.

The UI should always make it obvious which direction the relationship goes.

---

### B. InstaCleaner

**InstaCleaner is NOT a separate product.**

It is a module inside InstaScope.

Purpose:

Help users review accounts they may want to manually unfollow or clean up.

Useful filters can include:

- Not following me back
- Mutuals
- Old follows
- Recently followed
- Custom search
- Selection state

The MVP should **not** automatically mass-unfollow users through unofficial Instagram automation.

Instead, users can:

- select accounts;
- inspect them;
- open profiles;
- export/select lists;
- manually decide what to do.

Possible later improvements can be explored only if they are reliable, compliant, and do not require unsafe account credential handling.

---

### C. Snapshot Comparison

The user should be able to compare two Instagram exports.

Normalize both archives into the same internal data model and calculate changes.

Examples:

- new followers
- lost followers
- newly followed accounts
- accounts no longer followed
- relationship changes
- follower count delta
- following count delta

Important:

An account being absent from one list does not always prove intent or causality.

UI wording should describe what changed in the available snapshots rather than making unsupported claims.

Example:

Good:

> Present in your older followers snapshot, absent in the newer one.

Avoid overclaiming:

> This person definitely unfollowed you at exactly this time.

---

### D. Instagram Wrapped

Generate an entertaining, visually strong summary from uploaded data.

The Wrapped experience is both:

1. a user feature;
2. a growth/distribution feature.

Potential cards:

- total followers
- total following
- mutuals
- not-following-back count
- fans count
- follower/following ratio
- oldest relationships where timestamps are available
- newest relationships where timestamps are available
- snapshot growth/loss stats if two archives are provided

The final result should be visually shareable.

A share/export card should include tasteful InstaScope branding such as:

> Made with InstaScope

The goal is for users to post results to Instagram Stories, TikTok, X, Reddit, WhatsApp, etc.

Never expose unnecessary personal account data on the share card.

Prefer aggregated statistics by default.

---

### E. Public Profile Picture Viewer

A separate InstaScope tool/landing page should allow a user to enter:

- `@username`
- `username`
- an Instagram profile URL

Goal:

Display the profile image at the best publicly available resolution and allow comfortable zoom/fullscreen viewing.

Important restrictions:

- Only work with information/assets that are publicly accessible.
- Do not attempt to access private posts, stories, hidden profile data, or other restricted content.
- Do not ask users for another person's credentials or session cookies.
- Do not claim that InstaScope can reveal private account content.
- If Instagram blocks reliable retrieval, fail gracefully instead of using brittle or unsafe hacks.

Potential UI:

- username input
- profile image preview
- larger image view
- zoom
- circular preview
- square preview
- clear error state

This feature may require a small server-side endpoint/proxy because direct browser requests can encounter CORS/rate-limit/platform restrictions.

Keep this feature architecturally separate from the archive analyzer so the core product remains functional even if Instagram changes public profile delivery.

---

# 3. Current State / Existing Prototype

There has already been an InstaScope prototype.

Reference prototype:

`https://instascope.eyarenyilmaz.chatgpt.site`

Known prior state:

- archive upload exists;
- follower/following lists exist;
- Cleaner functionality exists;
- two-archive comparison exists;
- Wrapped exists;
- these flows were reported working locally;
- a real-world Instagram archive compatibility pass still needs serious testing;
- the public profile-picture viewer is not yet implemented.

Codex must inspect the current repository and verify the actual present state rather than assuming this section is perfectly synchronized with the code.

If working implementations already exist, improve them rather than replacing them unnecessarily.

---

# 4. Core Architecture

The most important architectural decision is separation between:

1. file format parsing;
2. normalization;
3. analysis;
4. presentation.

Target conceptual pipeline:

```text
Instagram ZIP / JSON / HTML
            ↓
      Format Detector
            ↓
    Instagram Adapter(s)
            ↓
    Normalized Data Model
            ↓
      Analysis Engine
            ↓
 ┌─────────────┬────────────┬──────────────┐
 Dashboard     Cleaner      Wrapped
            ↓
     Snapshot Comparison
```

Do not tightly couple UI components to raw Instagram export paths.

Instagram can change export filenames, folders, or JSON structures.

If that happens, ideally only adapters/parsers should need changes.

---

# 5. Recommended Tech Stack

Prefer the existing repository's stack if it is already reasonable.

If the project is already Next.js/TypeScript, continue with it.

Preferred architecture for a fresh/missing layer:

- **Next.js**
- **TypeScript**
- **React**
- **Tailwind CSS**
- lightweight client-side state
- browser-native processing where possible

Avoid introducing large dependencies without a concrete reason.

Do not add a database to the MVP merely because dashboards often have databases.

The default assumption is:

> no user account + no database + no uploaded archive storage.

---

# 6. Normalized Internal Model

Raw Instagram data must be converted to a stable internal representation.

Example conceptual types:

```ts
export type InstagramAccount = {
  username: string;
  href?: string;
  timestamp?: number;
};

export type InstagramDataset = {
  followers: InstagramAccount[];
  following: InstagramAccount[];
  closeFriends?: InstagramAccount[];
  blocked?: InstagramAccount[];
  pendingRequests?: InstagramAccount[];
  metadata?: {
    parsedAt?: number;
    sourceFormat?: string;
  };
};
```

This is an example, not an immutable requirement.

The important property is that downstream code operates on normalized data instead of arbitrary raw Instagram JSON.

---

# 7. Parsing Strategy

Support Instagram exports defensively.

Potential inputs:

- ZIP
- JSON
- HTML
- nested directory structures

Implementation should:

1. detect the archive/file structure;
2. identify relevant Instagram export files;
3. parse them;
4. normalize account entries;
5. deduplicate safely;
6. handle missing optional files;
7. show useful errors.

Do not depend on one exact filename if multiple known variants can be supported.

Parsing errors should be actionable.

Bad:

> Something went wrong.

Better:

> InstaScope could not find follower/following data in this export. Make sure you uploaded the Instagram account-information export containing Followers and Following.

Never silently produce empty analytics when parsing failed.

---

# 8. Analysis Engine

Keep analysis logic independent from React components.

Prefer pure functions.

Conceptual functions:

```ts
getFollowers()
getFollowing()
getMutuals()
getNotFollowingBack()
getFans()
compareSnapshots()
getNewFollowers()
getLostFollowers()
getNewFollowing()
getRemovedFollowing()
```

Use normalized usernames.

At minimum:

- trim whitespace;
- normalize casing for comparison where appropriate;
- deduplicate repeated records;
- preserve display username where useful.

Do not perform O(n²) comparisons for large datasets when sets/maps solve the problem cleanly.

---

# 9. Privacy Requirements

Privacy is part of the product.

## Default behavior

Instagram exports should be processed locally in the browser whenever possible.

Raw user archives should not be transmitted to our backend merely for analytics.

The UI should clearly communicate this.

Suggested copy:

> Your archive is processed in your browser.

> We don't need your Instagram password.

Do not claim stronger privacy guarantees than the implementation actually provides.

If a future feature uploads any user data, the user experience and privacy copy must be updated accordingly.

---

# 10. Security Requirements

Treat uploaded archives as untrusted input.

Requirements:

- never execute archive contents;
- sanitize rendered strings;
- avoid arbitrary HTML injection;
- validate file types and structures;
- protect against decompression abuse where feasible;
- cap unreasonable file sizes;
- do not expose local file paths;
- do not log sensitive archive contents;
- do not ship raw archive data to analytics providers.

For HTML Instagram exports:

Parse needed values.

Do not simply inject user-provided HTML into the page.

---

# 11. Hosting / Cost Philosophy

The MVP should be extremely cheap to operate.

Target:

> Keep fixed infrastructure cost as close to zero as practical until real users arrive.

Preferred initial deployment direction:

- Cloudflare Pages or equivalent low-cost static hosting;
- Cloudflare Workers only where server-side functionality is genuinely needed;
- no database initially;
- no archive storage initially;
- browser-side archive parsing;
- privacy-friendly analytics;
- domain is expected to be the main unavoidable initial cost.

Budget philosophy:

- MVP target: roughly domain-level annual cost;
- early traffic target: close to €0–10/month infrastructure where practical;
- do not prematurely buy expensive hosting tiers;
- only add paid infrastructure when usage requires it.

Important:

Provider pricing changes.

Before final production deployment, verify current provider limits/pricing rather than hardcoding assumptions from this document.

---

# 12. Backend Philosophy

The archive analyzer should not require a backend.

Backend/serverless code is justified only for features that cannot reliably work browser-only.

Likely example:

- Public Profile Picture Viewer proxy/lookup endpoint

Do not turn that exception into a general monolithic backend.

Keep server-side code minimal.

---

# 13. Analytics

We need basic product analytics without compromising user archive privacy.

Track product-level events such as:

- landing page viewed
- archive parser started
- archive parser succeeded
- archive parser failed
- analyzer result viewed
- Cleaner opened
- Wrapped generated
- Wrapped shared/downloaded
- comparison started
- comparison succeeded
- profile viewer search attempted
- profile viewer succeeded/failed

Do **not** send:

- raw follower lists
- uploaded archive contents
- private usernames from the user's export
- sensitive Instagram archive data

Use aggregate event metadata only where necessary.

---

# 14. Growth / Distribution Strategy

Building the site is not enough.

Distribution must be treated as part of the product.

Primary acquisition channels:

1. Google / SEO
2. TikTok / Instagram Reels / YouTube Shorts
3. Reddit / communities
4. shareable Wrapped/result cards

---

# 15. SEO Strategy

Do not make InstaScope one homepage containing every tool.

Each high-intent use case should have a dedicated landing page.

Suggested routes:

```text
/
 /not-following-back
 /followers-analyzer
 /following-analyzer
 /instagram-cleaner
 /instagram-wrapped
 /profile-picture-viewer
```

Potential supporting informational pages:

```text
/how-to-see-who-doesnt-follow-you-back-on-instagram
/how-to-analyze-instagram-export-data
/how-to-download-instagram-followers-data
/is-instagram-follower-tracker-safe
```

Do not create hundreds of low-quality pages just for search engines.

Each page should provide actual value.

---

# 16. SEO Landing Page Requirements

Each main landing page should have:

- unique title
- unique meta description
- clear H1
- concise explanation
- direct tool CTA
- privacy/value proposition
- relevant FAQ
- internal links to related InstaScope tools
- structured metadata where appropriate
- canonical URL
- social sharing metadata
- fast loading
- mobile-first layout

Example intent:

## `/not-following-back`

Primary user question:

> Who doesn't follow me back on Instagram?

CTA:

> Upload Instagram Export

Support text:

> Analyze your own Instagram data without sharing your password.

---

# 17. Search Positioning

Potential search intent themes:

- who doesn't follow me back instagram
- instagram follower analyzer
- instagram unfollowers
- instagram cleaner
- instagram followers export analyzer
- instagram wrapped
- instagram profile picture viewer
- instagram following analyzer

Do not keyword-stuff.

Write pages for humans first.

---

# 18. Social Content Strategy

The product is highly demo-able.

Create short-form content showing an immediate result.

Example structure:

1. screen recording starts;
2. user uploads Instagram export;
3. InstaScope processes it;
4. dashboard appears;
5. reveal:
   - "337 accounts don't follow you back";
6. show privacy message:
   - "No Instagram password required."

Hooks can be playful, but claims must remain accurate.

The product should visually communicate value within seconds.

---

# 19. Reddit / Community Strategy

Community distribution should be transparent.

Do not pretend to be an unrelated user recommending our own product.

Useful positioning:

> I built a browser-based tool that analyzes Instagram's own export, so you don't have to give a follower-tracker app your Instagram password.

Relevant discussions may include:

- follower trackers
- unfollow tracking
- Instagram export analysis
- account privacy
- data export tools

The tool should solve the problem before promotion becomes the focus.

---

# 20. Viral Loop — Shareable Results

The Wrapped/result-card system should create a natural sharing loop.

Example result:

```text
2026 Instagram Wrapped

1,842 Followers
1,256 Following
473 Mutuals
221 Don't Follow You Back

Made with InstaScope
```

Users should be able to export/share a clean visual.

Privacy rule:

Do not put specific follower usernames on a public share card by default.

Aggregate statistics are safer and more shareable.

Potential later feature:

Allow users to customize which statistics are visible.

---

# 21. Product Tone

InstaScope should not feel like enterprise BI software.

Desired feeling:

- clean
- slightly playful
- curious
- social
- detective-like
- fast
- trustworthy

Avoid:

- fake hacker aesthetics;
- scammy "SEE WHO STALKS YOU!!!" claims;
- pretending Instagram exposes data that it does not;
- excessive neon/cyber visuals;
- cluttered dashboards.

Marketing can be fun without being deceptive.

---

# 22. MVP Definition

The first production-quality milestone should focus on the strongest core loop.

## MVP Core

User can:

1. open InstaScope;
2. upload an Instagram export;
3. successfully parse follower/following data;
4. see:
   - Followers
   - Following
   - Mutuals
   - Not Following Back
   - Fans
5. search/filter lists;
6. understand what each category means;
7. use the experience on mobile;
8. do this without Instagram login credentials.

This flow must be excellent before expanding endlessly.

---

# 23. Implementation Priority

## Priority 0 — Repository Inspection

Before coding:

- identify framework/version;
- identify existing routes;
- identify parsers;
- identify current normalized model;
- identify existing analyzer logic;
- identify existing Cleaner implementation;
- identify comparison implementation;
- identify Wrapped implementation;
- run project;
- run tests;
- note concrete failures.

Do not immediately refactor.

---

## Priority 1 — Core Archive Reliability

Make upload + parser robust.

Acceptance criteria:

- valid supported archive parses successfully;
- unsupported archive gets useful error;
- missing follower/following data gets useful error;
- app does not crash on malformed file;
- raw archive is not unnecessarily uploaded;
- parser output is normalized;
- duplicates do not corrupt counts;
- large normal personal archives remain usable.

---

## Priority 2 — Core Relationship Dashboard

Acceptance criteria:

- follower count is correct;
- following count is correct;
- mutual count is correct;
- not-following-back list is correct;
- fans list is correct;
- search works;
- lists are responsive;
- labels are unambiguous;
- loading/empty/error states are polished.

---

## Priority 3 — InstaCleaner

Acceptance criteria:

- Cleaner uses the normalized dataset;
- user can filter;
- user can select accounts;
- selection state is reliable;
- user can open relevant Instagram profiles;
- no unsupported automatic mass-unfollow behavior;
- no Instagram password is required.

---

## Priority 4 — Snapshot Comparison

Acceptance criteria:

- two archives can be loaded;
- older/newer datasets are clearly identified;
- changes are calculated correctly;
- unchanged relationships do not appear in change lists;
- duplicate entries do not create fake changes;
- wording does not overclaim causality;
- comparison remains responsive.

---

## Priority 5 — Wrapped

Acceptance criteria:

- summary cards use real parsed data;
- cards are mobile-friendly;
- export/share output looks intentional;
- branding is visible but not obnoxious;
- share image does not expose usernames by default;
- snapshot stats appear only when valid comparison data exists.

---

## Priority 6 — SEO Landing Pages

Implement dedicated routes for at least:

```text
/not-following-back
/followers-analyzer
/instagram-cleaner
/instagram-wrapped
/profile-picture-viewer
```

Acceptance criteria:

- unique metadata;
- useful copy;
- clear CTA;
- tool accessible without unnecessary navigation;
- mobile performance is good;
- pages internally link to related tools.

---

## Priority 7 — Public Profile Picture Viewer

Build independently from the archive parser.

First research the most reliable compliant implementation using publicly available Instagram profile assets.

Acceptance criteria:

- accepts username and common Instagram profile URL formats;
- normalizes input;
- displays public profile photo when reliably available;
- handles missing/nonexistent/private/restricted/rate-limited cases gracefully;
- never claims access to private content;
- does not ask for Instagram password/session cookie;
- backend endpoint, if required, is isolated and rate-limited;
- core archive analyzer still works if this feature breaks.

---

## Priority 8 — Analytics & Launch Readiness

Acceptance criteria:

- analytics contains no raw Instagram export data;
- core funnel events are visible;
- privacy copy matches actual behavior;
- OpenGraph metadata exists;
- favicon/app metadata exists;
- sitemap exists;
- robots configuration is intentional;
- no obvious console errors;
- production build succeeds.

---

# 24. Testing Strategy

## Unit Tests

Prioritize tests for:

- username normalization
- deduplication
- mutual calculation
- not-following-back calculation
- fans calculation
- snapshot diff
- timestamp handling
- parser adapters

Relationship math is simple enough that it should be heavily tested.

---

## Fixture Tests

Create sanitized fixture exports representing:

- normal JSON export;
- alternate filename structure;
- HTML export if supported;
- empty list;
- malformed archive;
- missing followers;
- missing following;
- duplicate usernames;
- changed snapshots.

Do not commit real personal Instagram archive data.

---

## E2E Tests

At minimum:

### Flow 1

Upload archive → dashboard → verify counts/lists.

### Flow 2

Upload archive → Cleaner → filter/select.

### Flow 3

Upload old + new archive → compare.

### Flow 4

Upload archive → Wrapped → export/share state.

### Flow 5

Invalid upload → useful error.

Profile viewer E2E can be separate because it depends on an external platform.

---

# 25. Real Archive Verification

This is important.

A parser that works only on synthetic fixtures is not enough.

Before calling archive support production-ready:

- test with a recent real Instagram export;
- confirm current filenames/structures;
- compare UI counts against source data;
- test at least one alternate export representation if possible.

Never commit the real archive into the repository.

Document format differences found during testing.

---

# 26. Performance

Follower datasets can contain thousands of entries.

Requirements:

- use Sets/Maps for relationship calculations;
- avoid unnecessary repeated parsing;
- memoize expensive derived data where useful;
- avoid rendering massive DOM lists naively;
- consider virtualization if list size justifies it;
- keep ZIP parsing off the critical UI path where practical;
- show progress/loading feedback for expensive parsing.

Do not optimize prematurely, but do not knowingly build O(n²) relationship analysis.

---

# 27. Mobile UX

Mobile is a primary target.

Assume many users discover InstaScope from:

- TikTok;
- Instagram;
- Reddit;
- Google on mobile.

Requirements:

- upload flow works on mobile browsers;
- cards fit narrow widths;
- tabs do not overflow badly;
- lists remain usable;
- buttons have good tap targets;
- Wrapped is designed for phone screens;
- landing-page CTA is visible quickly.

---

# 28. Error Handling

Errors should answer:

1. what happened?
2. what can the user do?

Examples:

### Archive missing data

> We found the Instagram export, but couldn't find Followers and Following data. Download an Instagram information export that includes Followers and Following, then try again.

### Unsupported format

> This Instagram export format isn't supported yet.

### Profile viewer failure

> InstaScope couldn't retrieve a public profile photo for this username right now.

Avoid exposing raw stack traces to users.

---

# 29. Accessibility

Baseline requirements:

- keyboard navigation;
- semantic controls;
- visible focus states;
- accessible labels;
- sufficient contrast;
- useful empty/loading/error text;
- icons are not the only source of meaning.

---

# 30. What NOT to Build Yet

Do not let scope explode.

Not required for initial launch:

- user accounts;
- paid subscriptions;
- social graph database;
- cloud archive storage;
- automatic Instagram login;
- automatic mass unfollow;
- scraping private posts;
- private story viewer;
- private-profile bypass;
- follower marketplace;
- botting;
- browser extension;
- mobile native app;
- AI wrapper features with no clear user value.

The product should first prove that people want the core tools.

---

# 31. Monetization

Initial product decision:

> Do not charge the user in the MVP.

The immediate goal is usage, distribution, SEO traction, and validation.

Do not block core results behind a paywall.

Monetization can be considered later after meaningful traffic exists.

Potential monetization work is deliberately outside the current implementation scope.

---

# 32. Launch Strategy

Do not wait for ten unfinished modules.

Recommended launch bundle:

### Must be excellent

1. Archive upload/parser
2. Followers Analyzer
3. Not Following Back
4. Mutuals
5. Fans

### Strong launch additions

6. InstaCleaner
7. Wrapped

### Traffic-focused tool

8. Profile Picture Viewer

### After launch

9. Snapshot comparison polish
10. Additional SEO content
11. viral/share iteration

If the existing code already has Cleaner/Comparison/Wrapped working, preserve and polish them rather than disabling them.

---

# 33. Launch Checklist

Before public launch:

- [ ] production build passes
- [ ] no critical console errors
- [ ] real Instagram export tested
- [ ] follower/following math verified
- [ ] malformed archive handled
- [ ] privacy copy is accurate
- [ ] no Instagram credentials requested
- [ ] mobile upload tested
- [ ] mobile dashboard tested
- [ ] Wrapped export tested
- [ ] sitemap generated
- [ ] metadata configured
- [ ] favicon configured
- [ ] analytics configured without leaking archive data
- [ ] landing pages indexed/indexable
- [ ] Search Console setup documented
- [ ] domain configured
- [ ] profile viewer failures degrade gracefully
- [ ] README contains local-development and deployment instructions

---

# 34. Definition of Success for v1

A user should be able to discover InstaScope from a search/social link and understand the product almost immediately.

Within a short session they should be able to:

1. understand that no Instagram password is required;
2. upload their export;
3. see an accurate relationship dashboard;
4. discover something interesting;
5. optionally clean/review their following;
6. optionally generate a shareable result;
7. want to return with a later snapshot.

The core user reaction should be:

> "Oh, this tells me exactly who follows me back without making me log into some shady tracker."

---

# 35. Product Principles

When making implementation decisions, prefer:

### 1. Trust over hacks

If a feature needs dubious credential/session handling, rethink it.

### 2. Browser-side over unnecessary backend

If it can safely happen locally, keep it local.

### 3. Useful over feature-heavy

One accurate relationship dashboard is worth more than ten unreliable tools.

### 4. Distribution-aware product design

SEO pages, Wrapped sharing, and social demos are part of the product.

### 5. Modular Instagram integration

Instagram can change external behavior.

Do not let that break the entire app.

### 6. Clear language over fake certainty

Show what the data proves.

Do not invent stalking/profile-viewer capabilities Instagram does not expose.

---

# 36. Suggested Repository Shape

Adapt to the existing project rather than forcing this exact structure.

Conceptually:

```text
src/
  app/
    page.tsx
    not-following-back/
    followers-analyzer/
    instagram-cleaner/
    instagram-wrapped/
    profile-picture-viewer/

  components/
    upload/
    dashboard/
    cleaner/
    comparison/
    wrapped/
    profile-viewer/

  lib/
    instagram/
      parsers/
        json/
        html/
        zip/
      normalize.ts
      types.ts

    analysis/
      relationships.ts
      compareSnapshots.ts
      wrapped.ts

    privacy/
    analytics/

  tests/
    fixtures/
    unit/
    e2e/
```

Again:

Do not move everything just to match this example if the current repository already has a sensible structure.

---

# 37. Suggested Initial Codex Work Session

After reading this file:

## Step 1

Run the repository.

Collect:

- build errors;
- type errors;
- runtime errors;
- failing tests.

## Step 2

Map the current architecture.

Identify which requirements in this document already exist.

## Step 3

Test the current archive parser.

Determine whether it supports a recent Instagram export structure.

## Step 4

Fix concrete correctness bugs.

Priority:

- parser correctness;
- relationship calculations;
- broken UI flows.

## Step 5

Complete the MVP acceptance criteria.

Do not jump to SEO polish if the core analyzer gives incorrect results.

## Step 6

Run:

- typecheck;
- lint;
- unit tests;
- production build;
- available E2E tests.

## Step 7

Update project documentation with:

- what changed;
- known limitations;
- how to run;
- how to test;
- what remains.

Then proceed to the next priority in this document.

---

# 38. Codex Behavior Rules

While implementing:

### Do

- inspect existing code first;
- make actual edits;
- test your edits;
- keep commits/changes coherent;
- reuse good existing components;
- write tests for relationship calculations;
- document unsupported Instagram formats;
- keep external Instagram dependencies isolated.

### Do not

- only give recommendations;
- rebuild everything from scratch without reason;
- add authentication just because it is common;
- add a database without a current need;
- upload user archives by default;
- ask for Instagram passwords;
- implement fake private-profile viewing;
- claim profile visitors can be identified from data that does not provide that information;
- add paid infrastructure prematurely;
- create hundreds of thin SEO pages;
- stop after the first compiling implementation if the acceptance criteria are still broken.

---

# 39. Immediate Product Priorities Summary

If there is any ambiguity, use this order:

```text
1. Correctness
2. Archive compatibility
3. Core follower analysis
4. Mobile usability
5. InstaCleaner
6. Snapshot comparison
7. Wrapped + sharing
8. SEO landing pages
9. Profile Picture Viewer
10. Analytics + launch polish
```

Exception:

If an existing later-stage module already works, do not remove it while focusing on earlier priorities.

---

# 40. Short Product Brief

**Name:** InstaScope

**Category:** Instagram utility / personal data analyzer

**Core input:** User's own Instagram data export

**Core output:** Actionable follower/following relationship analysis

**Primary differentiator:** No Instagram password required

**Privacy model:** Local/browser processing by default

**Business model at MVP:** Free

**Infrastructure philosophy:** Near-zero fixed cost

**Growth model:** SEO + short-form demos + communities + shareable Wrapped results

**Submodule:** InstaCleaner

**Additional acquisition tool:** Public Profile Picture Viewer

**Do not build:** Private-account bypass, credential scraping, automatic bot behavior

---

# 41. Final Instruction to Codex

This document is not a brainstorming note.

Use it as the active implementation specification.

Inspect the repository, compare the current application to this document, and continue from the current state.

Preserve working code.

Fix correctness issues first.

Then implement the missing requirements in priority order.

Run the application and tests.

Do not stop after writing an implementation plan.

**Make the code changes.**
