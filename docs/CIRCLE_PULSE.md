# Circle Pulse

Circle Pulse is a private section of `/snapshot-vault/#circle-pulse`. It derives
observations from the existing browser-local Vault V1 records. There is no new
route, account system, cloud service, persistence schema or dependency.

## Sources and readable history

`relationshipHistoryIndex` validates records with the existing Vault validator,
normalizes identities and orders readable snapshots by export date, then ID.
Unreadable records are skipped and disclosed, never represented as empty
snapshots. Corrupt records remain stored until the owner explicitly removes
them. The storage layer already filters corrupt records; Circle Pulse therefore
also carries the provider's skipped-record count into its summary.

Only Followers and Following membership is available in Vault. Optional privacy
lists, relationship dates, messages, notes and review flags are not analysis
inputs. Usernames are the identity key: a differently named account is a
different identity. No rename or account-owner inference is performed.

Make sure selected saved exports belong to one Instagram account. Circle Pulse
does not include the active export and cannot verify account identity. Existing
active-export/saved-history comparisons still require their explicit same-account
confirmation and date validation.

## Definitions

- **Stable followers:** a username is in Followers in every selected readable
  snapshot.
- **Stable following:** a username is in Following in every selected readable
  snapshot.
- **Stable mutuals:** a username is in both lists in every selected readable
  snapshot.
- **Stable state:** one non-absent relationship state in every selected readable
  snapshot. Stable list membership can exist even when the other membership
  changes; it is distinct from a stable relationship state.
- **State change:** the relationship state differs between two adjacent readable
  snapshots. States are Mutual, Follows you, You follow and Absent. Each adjacent
  transition counts once, including entry into or out of Absent. Groups are zero,
  one and two or more observed changes; there is no score or judgment.
- **Reappeared:** present, absent in at least one subsequent selected snapshot,
  then present again. Any non-absent state counts as presence. Leading absence
  followed by first presence is not reappearance. Trailing absence without a
  later presence is not reappearance. The list shows first/latest present dates,
  bounded absent observations and the latest selected saved state.
- **Absent:** absent from both Followers and Following in that readable snapshot.
  It says nothing about deletion, blocking, intent or activity between exports.

Two readable snapshots are needed for stable/change/retention facts. Three are
needed for reappearance. A shorter range shows that limit instead of a fake zero.

## Retention

Follower retention between first selected snapshot A and last selected snapshot B:

`|A.followers ∩ B.followers| / |A.followers| × 100`

Following retention uses the same formula with Following. Both numerator and
denominator are shown with the export dates. Displayed percentages use one
decimal place; the underlying percentage is not prematurely rounded.

An empty first list has no percentage, rather than an invented 0% or 100%.
Accounts that disappeared in an intermediate snapshot but are present in B count
as retained. Retention compares endpoints; it never claims continuous presence.
Drilldowns separate first-snapshot usernames still present from those missing in
the last snapshot.

## Range and latest interval

The default is all readable snapshots. Start and end controls select an inclusive
range. Unknown IDs, equal endpoints, reversed chronology or an invalid date order
are rejected; the previous valid range remains displayed. Selections are not
persisted. Metrics, limits and account observations recompute for that range.

Latest interval uses the two latest readable snapshots **inside the selected
range**. It reuses `compareSnapshots` for new/missing Followers, Following and
Mutuals. Total state changes are the union of changed membership usernames, so a
username changing both lists counts once. All facts are bounded by export dates,
not exact event times.

## Architecture and performance

`src/lib/analysis/circle-pulse.ts` is a pure analysis module. It consumes an
existing normalized history index and returns a summary, selected index and
per-account metadata map. `circleAccountSummary` reuses the same accumulation
rules for an already loaded account's history; Drawers do not recompute every
account's aggregate analysis.

The accumulator visits present usernames once per snapshot using Sets/Maps.
Absent runs are counted at their boundaries, without scanning the entire username
union at every snapshot. Work is proportional to total recorded memberships plus
distinct usernames and the two latest snapshot comparisons. Memory consists of
the existing readable index, one metadata accumulator per identity and observed
absent intervals; no full username-by-snapshot matrix is built.

React stores the loaded derived model, range controls and a selected account,
without persisting them. Drilldowns show 25 rows at a time, locally search and
sort the selected group, and use the existing accessible Relationship Drawer.
Range validation avoids a redundant full aggregate pass. Derived models are
invalidated when saved-history metadata changes. A revision token also prevents
old indexes resurfacing after deletion and restoration of the same metadata.
Storage-read failures invalidate displayed cached facts. When storage recovers,
Wrapped requires fresh confirmation before adding saved-history cards again.
Obsolete indexes and derived models are released on source changes.

A local synthetic Node run with 24 snapshots, 100,000 distinct usernames and
3,588,000 membership entries took about 1.29 seconds to validate/index and
0.61 seconds for Pulse. Heap after garbage collection increased from about
173 MiB indexed to 195 MiB with Pulse. Peak process RSS was about 536 MiB,
including the input arrays, runtime and harness; transient memory is substantial.
These are one desktop measurement, not a mobile/Safari guarantee or a hard
performance limit. No browser username-by-snapshot matrix is allocated.

## Dashboard, Drawer and Watch Circle

Dashboard adds at most two supported facts inside its existing Vault entry.
These facts describe saved Vault history only, independent of the active export.
No matching username or active-export identity shortcut attaches it to saved
records. Insufficient or unreadable history shows an honest limited/error state.

The shared Drawer has a saved-only mode for Circle Pulse rows. It labels the
latest selected saved state, observed presence, stable state, changes and
reappearance. It does not fabricate an active Dataset, include active optional
context or edit Review Memory. Demo/deleted accounts keep the existing external
link restrictions. Active-export Drawers gain a compact History summary only
after the existing source/revision/confirmation guards allow history.

Watch Circle remains explicitly user-selected. Circle Pulse never adds watch
targets or changes flags/notes. Watch rows still use their existing guarded
comparison and shared active-export Drawer.

## Wrapped

Two optional story types are added, after the user chooses to load saved stories:

- **Stable Core:** aggregate mutual membership in every readable saved snapshot;
  needs at least two snapshots and a nonzero stable-mutual count.
- **Still Here:** first-to-latest follower retention; needs at least two snapshots
  and a nonempty first follower list. The card keeps the correct retained/total
  counts and identifies saved-snapshot context.

Real data requires explicit confirmation that the saved snapshots belong to the
same Instagram account. This confirmation does not claim to verify account
identity or automatically join the active export. Existing export stories stay
unchanged unless the owner chooses to add saved-history cards. Saved-story
confirmation resets on saved-history revisions.

Only summary counts and range dates enter these stories. No usernames, notes,
watch flags or optional private-category values enter cards/canvas/shared PNGs.
Endpoint retention is explicitly distinguished from uninterrupted following.

## Demo

The four existing in-memory fictional Vault snapshots are used; real Vault is
never read by demo analysis. Core export totals and all four saved snapshot
Follower/Following totals are preserved. `demo.mutual.0200` is absent only in
April and present in January, July and October, demonstrating reappearance.
Other examples retain their existing history: stable mutual
`demo.mutual.0100`, stable incoming `demo.fan.0200`, stable outgoing
`demo.oneway.0100`, changing/latest-absent `demo.oneway.0001` and incoming-to-mutual
`demo.fan.0001`. Small deterministic fictional replacements balance the counts.

The core uploaded demo and saved Vault history are separate teaching examples;
the latter is not reconstructed from the active example. Demo profile rows never
link to Instagram. Real Vault/Review Memory and backup controls remain isolated.

## Privacy, backups and limitations

No archive, credential, username, date, transition or retention value is sent to
a new service or telemetry endpoint. Circle Pulse summaries and metadata exist
only in memory; they are not written to IndexedDB, Review Memory or backups.
Vault V1 fields and `instascope-snapshot-vault` V1 backup format are unchanged.
Restore recomputes intelligence from the readable restored memberships.

These observations cannot establish exact events, reasons for changes, live
status, uninterrupted following, historical totals between exports, renames,
account deletion, friendship quality, loyalty or interest. Browser memory and
device speed still limit extremely large histories. No continuous monitoring or
notifications are introduced. Public SEO URLs, titles, H1s, metadata, canonical,
sitemap and environment-based indexing are unchanged.
