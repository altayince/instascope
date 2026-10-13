# Local CSV and calendar utilities (INS-112)

These utilities support the existing relationship-review and snapshot-return
flows. They do not change parsing, relationship analysis, storage schemas,
analytics or Instagram account actions.

## Account-list CSV

**Download CSV (count)** downloads all rows in the current filtered and sorted
view, across pagination. It covers core relationship lists, Cleaner, Timeline,
comparison, optional connection lists, Mutual Origins, watched accounts and
Circle Pulse detail groups. Watch/Pulse downloads include the complete applicable
result set beyond their visible page. Empty views disable the download.

The UTF-8 CSV columns are `username,profile_url,recorded_date`. A usable source
relationship date on the normalized account row is written as `YYYY-MM-DD`,
using the product's existing calendar-date semantics. JSON dates use their UTC calendar label; HTML
dates keep the source calendar label and are not upgraded to a precise UTC
instant. Missing dates stay blank. Saved Watch/Pulse observations have no stored
relationship date, so their date cells stay blank.

Validated profile URLs are retained for real linkable accounts. Fictional demo
and deleted-account rows have blank URLs; deleted usernames keep the existing
normalized sentinel. No notes, review flags, watch metadata, observed changes,
private context or source filenames are added. Cleaner’s **Export selected CSV**
keeps its existing selection behavior and two-column format.

Files are generated and downloaded locally, without analytics or upload. A CSV
contains account data; keep it private unless you choose to share it. This utility
does not add CSV import support.

## Next Snapshot reminder

After a successful real snapshot save or confirmed replacement, the
**Next Snapshot reminder** offer lets the user choose **Add 30-day reminder**.
Demo data, canceled replacements and failed saves create no offer.

The actual local save day is captured after the storage commit. If the entered
export date is not later than that day and export date + 30 days is still strictly
future, the reminder uses that export-based date. Otherwise it uses actual save
day + 30 days. The displayed offer explains the date and basis; saved revision
timestamps are not treated as the actual save day. The temporary offer applies
to the successfully saved active dataset/export date.

The downloaded `.ics` contains one all-day event to export fresh Instagram data
and return to InstaScope, with a generic Snapshot Vault link. Its end date is
exclusive. It contains no alarm, usernames, counts, snapshot IDs, notes or archive
data. A random calendar UID is created for that offer and reused if downloaded
again; it exists only in component memory and the file, without persistence or
tracking. Nothing is sent to analytics or a calendar service.

InstaScope sends no notification. Importing the file and choosing any alert are
actions in the user’s calendar. Calendar-client import behavior and physical
mobile/Safari handling require device-specific validation; automated browser
downloads do not establish those claims.
