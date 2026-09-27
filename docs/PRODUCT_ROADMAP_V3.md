# InstaScope — Product Direction & Growth Roadmap V3

> **Product:** InstaScope  
> **Production:** https://instascope.me  
> **Primary product idea:** A private Instagram relationship review tool built from the user's own Instagram export.  
> **Growth model:** Search traffic → useful relationship review → repeat snapshots → shareable results.

---

# 1. Product Positioning

InstaScope should not be positioned mainly as an unfollower checker.

The product should feel like:

> **Your Instagram relationships, reviewed in one place.**

Alternative consumer-facing positioning:

> **See how your Instagram circle changed, what is still pending, and what deserves a second look.**

Supporting ideas:

- relationship history
- account review
- circle cleanup
- old connections
- pending requests
- follower changes
- mutuals and one-way follows
- private connection lists
- shareable relationship stories

Avoid technical language such as:

- data decoder
- export parser
- JSON analyzer
- relationship graph

Those concepts can exist internally, but they should not lead the consumer-facing product.

---

# 2. Product Hierarchy

## Acquisition tools

These bring users in from Google.

### A. Not Following Back

Keep it.

Purpose:

- capture high-intent Google searches
- provide an immediate familiar result
- introduce the broader InstaScope relationship review

It is an acquisition feature, not the whole product.

After the result, surface:

- Pending Requests
- Relationship Timeline
- Unfollow History
- Compare Snapshots
- InstaCleaner
- Wrapped

---

### B. Followers Analyzer

Keep as the base overview.

It should answer:

- followers
- following
- mutuals
- one-way relationships
- fans
- relationship dates when available

Use it as the central dashboard, not the main differentiator.

---

### C. Profile Picture Viewer

Keep as a low-friction Google acquisition tool.

It does not define InstaScope.

After a successful lookup, cross-sell the private relationship tools.

---

# 3. Core Differentiators

These features should become more prominent than Not Following Back.

## A. Pending Requests Review

Show sent follow requests recorded in the export.

Useful views:

- all requests
- 30+ days
- 90+ days
- 365+ days
- unknown age

Positioning:

> **See the follow requests you sent and forgot about.**

Important:

- do not claim they are still pending today
- clearly say the result reflects the uploaded export
- let users open profiles and manually review

---

## B. Relationship Timeline

Turn recorded follower/following dates into an understandable history.

Useful views:

- oldest current follows
- newest current follows
- relationships by year
- relationships by month
- follower vs following timeline
- accounts behind each period

Positioning:

> **See when your current Instagram circle was built.**

Possible hooks:

- Who have you followed the longest?
- Which year shaped your Instagram circle?
- Which old connections are still around?

Do not claim historical follower totals unless supported by snapshots.

---

## C. Unfollow History

Use Instagram's own recently-unfollowed data when present.

Positioning:

> **Review the accounts you recently unfollowed.**

Important:

This is the user's own unfollow action history.

Do not describe it as people who unfollowed the user.

---

## D. Snapshot Comparison

This should become one of the strongest reasons to return to InstaScope.

Compare an older export with a newer export.

Show:

- added followers
- missing followers
- newly followed
- no longer followed
- new mutuals
- lost mutuals
- follower delta
- following delta

Positioning:

> **See what changed in your Instagram circle since your last snapshot.**

This is a retention feature, not only a utility.

Encourage users to return later with another export.

---

# 4. InstaCleaner → Relationship Review

Do not present Cleaner only as:

> people who do not follow you back

Turn it into a broader manual review workflow.

Suggested positioning:

> **Review your Instagram circle before deciding who stays.**

Potential review groups:

- one-way follows
- old follows
- recent follows
- pending requests
- recently unfollowed records
- mutuals
- manually selected accounts

Useful workflow:

```text
Upload export
    ↓
Review signals
    ↓
Add accounts to review list
    ↓
Open profiles for context
    ↓
Make decisions manually on Instagram
```

Never automatically mass-unfollow.

Do not assign fake quality, inactivity, or desirability scores.

The tool should provide context, not judgment.

---

# 5. Homepage Direction

Homepage should no longer visually imply that InstaScope is mainly a follower-back checker.

Primary message should communicate:

- review your Instagram relationships
- see relationship history
- compare changes over time
- review pending and old connections
- no Instagram password
- browser-local archive analysis

Suggested hero direction:

> **Your Instagram circle, with context.**

Supporting copy:

> Review old connections, pending requests, follower changes and the relationships behind your Instagram export. No Instagram password required.

Primary CTA:

> **Review my Instagram**

Secondary CTA:

> Try demo

---

# 6. Homepage Feature Order

Recommended order:

1. Relationship Overview
2. Pending Requests
3. Relationship Timeline
4. Compare Snapshots
5. InstaCleaner / Relationship Review
6. Unfollow History
7. Instagram Wrapped
8. Not Following Back
9. Profile Picture Viewer

Not Following Back should remain highly discoverable for SEO, but it should not define the entire homepage.

---

# 7. Existing SEO Pages

Keep current acquisition pages.

Do not remove or redirect them unless Search Console data later justifies it.

Keep:

```text
/not-following-back/
/followers-analyzer/
/following-analyzer/
/instagram-cleaner/
/snapshot-comparison/
/instagram-wrapped/
/profile-picture-viewer/
/how-to-download-instagram-followers-data/
```

Existing Google-oriented pages can continue targeting familiar search language.

The broader product experience should then reveal the stronger relationship-review features.

---

# 8. New SEO Opportunities From Existing Features

Do not build dozens of pages.

Create or strengthen only pages where a real product already exists.

Priority opportunities:

```text
/pending-follow-requests/
/relationship-timeline/
/unfollow-history/
/snapshot-comparison/
```

Potential search themes:

### Pending Requests

- instagram sent follow requests
- see follow requests sent on instagram
- old instagram follow requests
- instagram pending requests export

### Relationship Timeline

- oldest instagram follows
- who did i follow first on instagram
- instagram following history
- instagram relationship history

### Unfollow History

- recently unfollowed instagram
- see accounts i unfollowed on instagram
- instagram unfollow history

### Snapshot Comparison

- compare instagram followers
- instagram follower changes
- who disappeared from my followers
- compare instagram exports

Do not force pages for queries that have no real user value.

---

# 9. Wrapped V2 Direction

Wrapped should become a relationship story, not just a statistics card.

Current raw counts are useful but not enough to drive sharing.

Potential story themes:

## My Instagram Circle

- followers
- following
- mutual percentage
- one-way relationships

## My Instagram Timeline

- oldest recorded follow
- newest recorded follow
- peak relationship year
- number of dated relationships

## Since My Last Snapshot

- follower delta
- new followers
- missing followers
- new mutuals

## Instagram Archaeology

- years of recorded relationships
- oldest surviving connections
- old follows still present
- relationship eras

Rules:

- no usernames by default
- no private lists
- no fake yearly statistics
- use only facts supported by the export
- branded for discovery
- optimized for 1080 × 1920 stories

M8 should be redesigned around these stories before implementation continues.

---

# 10. Return Usage

The strongest repeat-use loop should be:

```text
First export
    ↓
Review current circle
    ↓
Save local snapshot
    ↓
Return later
    ↓
Upload newer export
    ↓
See what changed
    ↓
Generate updated Wrapped
```

InstaScope should gradually become more valuable when the same user returns.

---

# 11. Product Principles

## Context over judgment

Do not tell users who they should unfollow.

Give them useful signals and let them decide.

## History over static counts

Follower counts are easy to obtain.

Changes, dates, old relationships and snapshots are more interesting.

## Review over automation

The product helps users inspect and understand their circle.

It does not control their Instagram account.

## Privacy over convenience hacks

No Instagram password.

No private API credential collection.

No raw archive upload for the core product.

## Real findings over fake insights

Do not invent:

- stalkers
- secret admirers
- inactive-user scores
- private visitors
- relationship intent
- reasons someone followed or unfollowed

---

# 12. Development Priority From Current State

The project has completed M0–M7.

Google indexing preparation has also been completed separately.

Do not immediately continue the old M8 implementation.

Use this order instead:

```text
V3.1  Reposition homepage around relationship review
V3.2  Promote Pending Requests, Timeline and Unfollow History
V3.3  Redesign InstaCleaner as broader Relationship Review
V3.4  Strengthen SEO landing pages for existing differentiated tools
V3.5  Redesign Wrapped V2 around relationship stories
V3.6  Resume Wrapped implementation
V3.7  Improve snapshot return loop
V3.8  Optimize based on real Search Console data
```

---

# 13. What Not To Do

Do not:

- remove Not Following Back just because it is not the differentiator
- make InstaScope depend on Instagram login
- turn the product into a generic analytics dashboard
- add AI summaries without clear user value
- build dozens of speculative SEO pages
- add automatic mass unfollow
- assign fake social scores
- chase private-profile or profile-visitor claims
- continue old M8 blindly without updating its product direction

---

# 14. Definition of Success

A new user may arrive because they searched:

> who doesn't follow me back on Instagram

But they should leave thinking:

> **I can actually review my Instagram relationships here.**

The ideal journey:

```text
Google search
    ↓
Familiar utility
    ↓
Upload export
    ↓
Immediate result
    ↓
Discover pending / old / changed relationships
    ↓
Review circle
    ↓
Save or return later
    ↓
Compare a newer snapshot
    ↓
Share a relationship story
```

The product should not be remembered as another unfollower checker.

It should be remembered as:

> **The place where you review your Instagram circle and how it changed.**
