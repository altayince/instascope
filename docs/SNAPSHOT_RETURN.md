# Local snapshot return loop

The current export stays in tab memory. Saving a snapshot is optional and writes one versioned record to this browser's site storage: the date entered by the user plus normalized follower and following usernames. The raw ZIP, profile URLs, relationship timestamps, pending requests, privacy lists, recent unfollow records, warnings and demo data are never persisted by this feature.

On a later visit, the saved snapshot is shown but never compared automatically. The user uploads a current export, enters its date and explicitly chooses the saved record as older. The current date must be later than the saved date. A manually uploaded older file remains a separate choice and is labeled as such. Import time is never treated as an export date. The user remains responsible for selecting exports from the same account.

Saving again replaces the previous local record. The workspace provides a Delete saved snapshot control; Clear active data removes only tab-memory analysis and leaves the saved record available for a return visit. Clearing browser/site data may remove it as well. The saved record is used only for local comparison and can be discarded without affecting the original export files on the user's device.
