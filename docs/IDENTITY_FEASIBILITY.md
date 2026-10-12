# Stable identity feasibility

INS-106 keeps account comparison based on normalized usernames. The inspected
Instagram exports do not provide enough verified stable target-account identity
information for safe rename detection. No identity heuristic or storage change
is introduced.

## Evidence inspected locally

The audit used a real JSON export dated September 26, 2026 and a real HTML export
dated September 27, 2026. Both contain Followers, Following and all six supported
optional connection categories. These dates identify the supplied archives; they
are not inferred archive-generation timestamps.

All eight supported relationship files in each archive were inspected locally.
A bounded supplementary metadata scan inspected 241 JSON text documents and 245
HTML documents. One oversized, unrelated text document per archive was excluded
from that supplementary scan. This is evidence about the inspected formats,
not a claim about every Instagram export or every private archive document.

Archives, usernames, account IDs, owner names and source snippets were not
committed, uploaded, or copied into fixtures or this document. Local audit output
contains only field names, source types, counts and verification booleans.

## Current account identity

The importer normalizes and deduplicates usernames through
`src/lib/instagram/normalize.ts`. `Account` contains username, profile href and
optional recorded-date semantics, without a stable account-ID field. Relationship
analysis and saved snapshots compare normalized usernames. The profile URL is a
username-based destination, not independent stable identity evidence.

An explicit `Username` in an optional labelled record is authoritative. A display
`Name`, URL, record timestamp, array position or similar-looking username cannot
establish a rename. Existing deleted-account placeholders remain separate
internal identities and non-linkable account rows.

## Verified field structures

| Category            | JSON fields observed                                                             | HTML fields observed                                   | Stable target-ID evidence     |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------- |
| Followers           | `title`, `media_list_data`, `string_list_data` with `href`, `value`, `timestamp` | Profile anchor and visible recorded date               | No separate ID field observed |
| Following           | `title`, `string_list_data` with `href`, `timestamp`                             | Account heading, profile URL and visible recorded date | No separate ID field observed |
| Pending requests    | `timestamp`, `media`, `fbid`, `label_values`                                     | Labelled account table and visible recorded date       | JSON `fbid` candidate only    |
| Close friends       | Same optional JSON structure                                                     | Same labelled-table structure                          | JSON `fbid` candidate only    |
| Blocked accounts    | Same optional JSON structure                                                     | Same labelled-table structure                          | JSON `fbid` candidate only    |
| Restricted accounts | Same optional JSON structure                                                     | Same labelled-table structure                          | JSON `fbid` candidate only    |
| Story hidden from   | Same optional JSON structure                                                     | Same labelled-table structure                          | JSON `fbid` candidate only    |
| Recently unfollowed | Same optional JSON structure                                                     | Same labelled-table structure                          | JSON `fbid` candidate only    |

Optional labelled records provide `Username`, `Name` and `URL` in JSON. HTML
records always supplied `Username` in the inspected files; `Name` and `URL` were
sometimes omitted. URL values can be absent, stale or non-Instagram destinations.
The HTML optional records do not expose an `fbid` field, account-ID label or
corresponding numeric account-ID attribute.

## The `fbid` candidate

Every inspected optional JSON record contains a nonempty, 17-digit string named
`fbid`. Those values were distinct within this JSON archive. This is a real
candidate field, so the conclusion is **not** that exports contain no IDs.

It does not pass the identity gate:

- It is absent from the inspected Followers and Following JSON records.
- The inspected HTML relationship records have no corresponding field.
- The field name and proximity to a username do not prove whether it identifies
  the Instagram target account, a relationship record or another Meta object.
- Only one JSON archive is available. Optional usernames do not repeat across
  categories in that archive, so neither cross-category consistency nor
  persistence across repeated JSON exports could be tested.
- Uniqueness in one archive establishes no cross-export stability or rename
  behavior.

The importer does not promote `fbid` into `Account`, Doctor provenance, saved
snapshots or Review Memory. Existing JSON parsing intentionally continues using
the exported username and relationship date.

## Deleted-account sentinels

The observed placeholder pattern matches the existing strict detector:
`^__deleted__[a-j]{17}$`. The two distinct deleted placeholders observed in the
JSON archive also appear unchanged in the HTML archive.

That is a limited cross-format observation about deleted placeholders. It is not
a normal-account ID persistence test. The suffix has not been decoded or proven
to identify an active account; its alphabet and length do not establish a
documented numeric-account encoding. It cannot support active-account rename
detection or resurrect a usable profile link. Counts, relationship analysis and
the existing deleted-account display/link safeguards remain unchanged.

## Export range and generation evidence

No trustworthy requested-range field was verified in the supported JSON files
or the inspected HTML interface metadata. An oldest recorded date, record count,
filename, filesystem date or successful import does not prove an All time
request. Export Doctor leaves the requested range unknown and retains the
recommendation to request All time.

The real HTML files do contain verifiable **file-generation** evidence:

```text
header._as-_._a70a
  > div._a70d
    > aside._aoaa[role="contentinfo"]
      > time[datetime]
```

The aside labels generation, with owner text discarded. Its `datetime` has the
format `YYYY-MM-DDTHH:mmZ`: an explicit UTC minute, unlike timezone-free HTML
relationship dates. All eight successfully parsed relationship files agree on
one generation minute. The larger HTML document scan contains two generation
minutes, one minute apart, so agreement among recognized files does not prove one
exact generation instant for the entire ZIP.

Import provenance may retain the strictly validated generation minute observed
in successfully parsed, recognized HTML files, their checked/dated file counts
and agreement status. Conflicting values do not produce a single generation
time. Unrecognized or localized generation markup without verified semantics
remains unverified. The inspected JSON relationship files provide no equivalent
generation field.

This is distinct from recorded relationship timestamps, browser import time,
ZIP/file modification times and a user-supplied Snapshot Vault date. It must not
be used to confirm active-export/Vault account identity or automatically date a
saved snapshot. Generation observation is scoped to recognized HTML source
files, not advertised as a verified whole-archive generation date.

## Decision and future gate

Outcome B: keep username-based comparison. Rename-aware comparison is not safely
supported by the current evidence. Do not merge accounts using username
similarity, display names, URL guesses, timestamps or decoded placeholder
guesses.

Reconsider only after an identifier is verified as the target-account ID,
covers a useful portion of ordinary core relationships, persists across repeated
exports and has no account collisions. Any future extension must also account
for HTML support, backward-compatible username-only snapshots and the existing
local-data privacy commitments. This PR makes no Vault or Review Memory schema
or backup-format changes.
