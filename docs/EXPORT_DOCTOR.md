# Export Doctor

INS-106 adds factual diagnostics for the active export. The compact Dashboard
summary opens a native details disclosure; workspace tools link back to it.
Doctor does not rate an export, infer completeness or prevent core use because
an optional list is absent.

## Architecture and provenance

The existing bounded importer gathers aggregate facts while discovering and
parsing files. ZIP directory entries are visited once; unrelated regular files
are counted without reading or inflating their contents. Directory entries are
excluded from ignored-file counts. Loose files and the synchronous and browser
Blob ZIP adapters feed the same assembly path.

`Dataset.metadata.importProvenance` contains transport/content-format counts,
recognized/ignored file counts and ten fixed relationship-category counters:
source, JSON, HTML, parsed, unsupported and skipped files. It contains no filenames,
paths, usernames, IDs or raw metadata. A combined JSON document can supply two
core categories while still counting as one recognized source file.

`exportDoctor(dataset)` is a pure analysis function. It uses normalized records
and these import-time facts; it does not open an archive or read storage. Old or
programmatically constructed datasets without provenance show source counts as
not recorded rather than estimating them.

## Core lists and split files

Core Followers and Following must still parse successfully before an import is
accepted. Existing hard failures and safety limits remain intact. Multiple
recognized core files are combined and reported as such; supported numeric
suffixes and normalization/deduplication are unchanged. Source-file counts are
independent from final account counts: duplicates do not inflate relationship
counts or date coverage.

## Recorded dates

Each core list reports total normalized records, records with a usable date and
their percentage. An empty list has no percentage; it is not labelled 100% dated.
A nonempty undated list has 0% coverage. Missing and malformed dates remain
unknown.

Coverage separately counts JSON instants and HTML calendar minutes without a
timezone. HTML minutes are not promoted to exact UTC events. Existing priority
rules for duplicate JSON/HTML records remain unchanged. Recorded dates do not
prove a first-ever follow, uninterrupted membership, removed relationships or
historical follower totals.

## Optional lists

The eight optional categories retain their semantics:

- **Available:** included and safely parsed. A valid empty list displays
  `Included · 0 records`.
- **Missing:** not included. No account count is implied.
- **Unsupported:** present but not completely readable. No account count or
  partial list is presented as complete.

If one file in a split optional category is unsupported, the category remains
unsupported. Later files skipped by the existing importer are counted as skipped;
they are not claimed to have parsed successfully. Missing optional data is a
neutral limitation, not an export failure.

INS-108 adds **Recent sent-request records** (`recentFollowRequests`) and
**Removed suggestions** (`removedSuggestions`) to the same optional-state and
aggregate source-file reporting. Recent sent-request records are separate from
pending requests: the export groups sent requests that were confirmed or
deleted, without identifying the outcome for each account. Removed suggestions
are profiles removed from suggestions, not removed followers. Their recorded
dates do not establish the exact time of an action. Neither category extends
the four Connection Privacy lists or the core Followers/Following date coverage.

## Analysis availability

Core Circle is ready for an accepted dataset, including explicitly empty lists.
Timeline requires at least one usable core date. Mutual Origins requires a
current mutual with usable dates in both directions. Pending Requests and Unfollow
History require an available respective category, including available-empty.
Connection Privacy is full, partial or unavailable according to how many of its
four categories were safely read, not how many accounts they contain.
Recent sent-request and removed-suggestion availability each require their own
available category, including an explicitly empty one; they cannot enable Pending
Requests or Unfollow History. Unknown or unreadable extras have no record count.

Wrapped date availability follows existing product gates: following-date stories
need a following date; the mutual-origin story needs at least ten dated mutuals.
Doctor does not promise every Wrapped story and does not include optional/private
lists in shared output. Vault-only capabilities are not inferred from one export.

## Requested range and generation time

The inspected real JSON and HTML files do not provide a verified requested range.
Doctor says the range cannot be verified. All time remains a recommendation;
neither relationship age, volume nor a filename establishes that it was selected.

The inspected HTML export has a specific Meta generation header:
`header._a70a aside._aoaa[role=contentinfo]`, generation-labelled text and exactly
one `time[datetime]` with a UTC `YYYY-MM-DDTHH:mmZ` minute. The importer reads only
this verified structure from the existing parsed tree and validates the calendar
value strictly. The owner text is discarded. Unrelated time nodes, unknown labels,
unqualified or malformed times remain unverified.

Only consistent observations in successfully parsed recognized HTML files are
reported, with their file scope and UTC-minute precision. Different generation
minutes across selected files suppress the date instead of choosing one. Even a
consistent observation is not a claim about the generation time of every entry
in a whole ZIP or a mixed selection. The inspected whole HTML archive contains
more than one generation minute; its supported connection files agree.

JSON files currently contribute no verified generation observation. ZIP/OS file
timestamps, import time, relationship timestamps, upload filename dates and
user-entered Vault export dates never become a generation date. See
[Identity feasibility](IDENTITY_FEASIBILITY.md) for the local audit and rename
decision.

## Privacy, demo and performance

Doctor provenance and reports stay with the active in-memory dataset. They are
not sent to analytics and are not serialized into Vault snapshots, Vault backups
or Review Memory. Clearing/reloading the active dataset removes them. No backend,
credentials, cloud storage or dependency is added.

The existing complete tool demo is preserved. Its fictional JSON ZIP provenance
shows split follower files and high but incomplete date coverage. A separately
labelled partial-export illustration demonstrates available-empty, missing and
unsupported categories without replacing any active demo tool data or reading
real files/storage.

Report derivation is linear in normalized relationship records and is memoized
per active dataset in Dashboard. Archive discovery counters reuse the existing
directory pass and retain only bounded aggregate categories. HTML generation
observations reuse the parsed HTML tree; media and ignored files are not loaded.
