import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { analyticsEndpoint } from "@/lib/analytics-config";
import { Breadcrumbs } from "@/components/structured-data";
export const metadata: Metadata = pageMetadata(
  "Privacy",
  "How InstaScope processes your export locally and keeps account data out of analytics.",
  "/privacy/",
);
export default function Privacy() {
  return (
    <main id="main" className="prose">
      <Breadcrumbs name="Privacy" path="/privacy/" />
      <span className="eyebrow">YOUR DATA STAYS YOURS</span>
      <h1>Privacy, in plain language.</h1>
      <h2>Your archive stays in your browser.</h2>
      <p>
        ZIP, JSON and HTML files are processed on your device. The analyzer does
        not upload them, store them on a server, or save the raw archive in
        browser storage. Current results stay in this tab’s memory until you
        clear active data, reload, or close the tab.
      </p>
      <h2>Snapshot Vault stays in this browser.</h2>
      <p>
        If you choose “Save snapshot”, InstaScope stores only follower and
        following usernames plus the export date you enter and local snapshot
        metadata (an ID, format version and time saved) in this browser’s
        IndexedDB site storage. It does not save the raw ZIP, private connection
        lists, relationship timestamps, messages, media, passwords or session
        cookies. No Vault data is stored on InstaScope servers. You can browse,
        replace or delete saved snapshots in Snapshot Vault. Deleting saved
        history does not clear the active export; clearing active data does not
        delete saved history.
      </p>
      <p>
        An older single saved snapshot is automatically migrated once. Its
        original local copy is kept for compatibility with an older deployment
        until you delete that snapshot or all saved history. Clearing
        browser/site data may remove your Vault. There is no cloud backup.
        “Export Vault backup” downloads a private JSON file containing
        usernames; keep it safe. Import validates and previews this specific
        backup format before you confirm a local merge. Existing dates are kept.
      </p>
      <p>
        Circle Pulse summarizes saved Vault snapshots locally, independently of
        your active export. Make sure the selected saved records belong to the
        same Instagram account. For a two-snapshot comparison, choose the
        snapshots and confirm the dates and that both exports belong to the same
        Instagram account. InstaScope does not automatically verify account
        identity. Saved totals describe individual exports, not continuous
        monitoring or a complete relationship history.
      </p>
      <p>
        Account history is derived locally from usernames in saved snapshots.
        Mutual Origins compares both recorded relationship dates in the active
        export, in memory. These dates and results are not uploaded or added to
        Vault storage. Snapshot presence does not establish exact event times;
        recorded dates may reflect refollows rather than uninterrupted
        following.
      </p>
      <p>
        Circle Pulse retention, stable membership, reappearance and state-change
        summaries exist only in memory. They are not stored in Vault, added to
        backups or sent to analytics. Optional saved-history Wrapped cards use
        only aggregate facts after you choose to include them, without usernames
        or private-list data. Observed presence does not prove uninterrupted
        following or what happened between saved exports.
      </p>
      <h2>Review Memory is private and local.</h2>
      <p>
        Keep, Reviewed, Watch and optional private notes are decisions you
        enter, stored in a separate IndexedDB database in this browser.
        Usernames, notes, flags and watch targets are not uploaded or sent to
        analytics. They survive new imports and clearing active data. Clearing
        Review Memory does not delete Snapshot Vault; deleting snapshots does
        not delete Review Memory. Clearing browser/site data may remove both.
      </p>
      <p>
        Watch Circle compares the local export with a strictly earlier readable
        saved snapshot only after you provide the export date and confirm the
        same Instagram account. InstaScope cannot verify account identity.
        Differences are observations, not live monitoring, notifications, exact
        change times or evidence of intent.
      </p>
      <p>
        Review Memory has its own private JSON backup containing usernames,
        flags and notes. It is downloaded and imported locally, with a preview
        before confirmation. Existing local records and notes are kept, even if
        an incoming backup is newer. There is no automatic or cloud backup.
        Fictional demo memory is held in this tab’s memory only and never
        overwrites your real decisions.
      </p>
      <h2>No Instagram credentials.</h2>
      <p>
        We do not ask for a password or session cookie. No Instagram account
        connection is required.
      </p>
      <h2>You choose what to share.</h2>
      <p>
        Wrapped images contain aggregate relationship statistics and dates, not
        individual usernames. Pending requests, close friends, blocked or
        restricted accounts, story visibility lists and your unfollow history
        stay local and are excluded from Wrapped images. “Download CSV” contains
        the full filtered account list, including other pages, with profile URLs
        and recorded calendar dates where available. Cleaner’s selected CSV
        contains only the accounts you select. These files are created in your
        browser; keep them private unless you choose to share them. Review flags
        and private notes never enter Wrapped, shared images or any account CSV.
        Opening a profile takes you to Instagram, which has its own privacy
        practices.
      </p>
      <h2>A calendar event, without notifications from us.</h2>
      <p>
        After saving a real snapshot, you can download a calendar file to remind
        yourself to export fresh Instagram data and return. It contains a generic
        event and future calendar date, with no usernames, snapshot counts,
        notes or archive contents. Its random calendar-event identifier stays
        only in the temporary offer and downloaded file; it is not a tracking
        identifier. InstaScope stores no reminder and sends nothing to a calendar
        service or analytics. Import the file and choose any alert in your own
        calendar. InstaScope sends no notification.
      </p>
      <h2>Product events, without your social graph.</h2>
      <p
        data-analytics-endpoint={analyticsEndpoint(
          process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
        )}
      >
        {analyticsEndpoint(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT)
          ? "This deployment sends an allowlisted product event, a coarse referring-source category and a webdriver automation hint to a same-origin analytics endpoint. The collector stores these with a coarse server-side automation hint and a count of one. The source is classified once per browser document and held only in memory as you navigate within the site. It stores no raw referrers, referring hostnames or URLs, search queries, page URLs or paths, User-Agent strings, IP addresses in analytics, archive data, filenames, usernames, follower/following counts, notes, review flags, watch targets or snapshot dates. There are no analytics cookies, session IDs, persistent anonymous IDs or fingerprints, and no analytics state is saved in browser storage. Do Not Track disables remote delivery. Analytics failure never blocks the tools."
          : "Remote product analytics is not enabled on this deployment. Event names are emitted locally within the page for development diagnostics."}{" "}
        The event collector uses a connecting IP only temporarily for rate
        limiting and does not write it or user agents to analytics storage or
        intentional request logs. Hosting and security infrastructure can
        receive normal request information such as your IP address when you
        visit the site.
      </p>
      {analyticsEndpoint(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) && (
        <>
          <p>
            A Google-family referrer does not prove a Google Web Search or Google
            Search Console click. The category &ldquo;none&rdquo; means no referrer
            was visible; apps, browsers and privacy settings can hide it, so this
            does not prove direct traffic. The webdriver hint comes only from
            your browser&apos;s automation flag. A &ldquo;yes&rdquo; value is strong
            automation evidence; &ldquo;no&rdquo; does not prove a human. The
            server briefly checks the normal User-Agent header for obvious
            automation signs and keeps only &ldquo;automation&rdquo;,
            &ldquo;browserish&rdquo; or &ldquo;unknown&rdquo;. A
            &ldquo;browserish&rdquo; value does not prove a human. These hints can
            be spoofed and are not fingerprints.
          </p>
          <p>
            The document_entry_observed event means client JavaScript ran for one
            browser document. It is sent at most once for that document, including
            navigation within the site; a full reload can count again. It does
            not count unique visitors, users, sessions or Search Console clicks.
            Historical events without a source category are pre-audit data; they
            cannot be attributed to a source later.
          </p>
        </>
      )}
      <h2>Public photo lookup is separate.</h2>
      <p>
        {process.env.NEXT_PUBLIC_PROFILE_ENDPOINT
          ? "The username you explicitly submit is sent to a separate public-photo lookup service. If a photo is available, your browser loads it from Instagram’s image servers."
          : "Public-photo lookup is not configured on this deployment."}{" "}
        It has no access to your uploaded export. Restricted content is never
        bypassed.
      </p>
      <h2>Photo enhancement happens on your device.</h2>
      <p>
        Optional AI super resolution runs in a browser worker on your device.
        Model and runtime files are downloaded from InstaScope when needed; the
        photo is not uploaded to an AI service for enhancement. The model
        estimates detail and can change facial features. An enhanced PNG is not
        Instagram&apos;s original HD photo. You choose whether to save or share
        it.
      </p>
      <h2>Problem reports are public.</h2>
      <p>
        The footer&apos;s Report a problem link opens GitHub in a new tab.
        Reports there are public. Describe the tool, file format and steps using
        fictional examples. Do not attach your export, saved snapshot,
        credentials or screenshots that expose personal accounts.
      </p>
    </main>
  );
}
