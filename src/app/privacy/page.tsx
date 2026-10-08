import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
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
        Nothing is compared automatically. Choose the snapshots and confirm the
        dates and that both exports belong to the same Instagram account.
        InstaScope does not automatically verify account identity. Saved totals
        describe individual exports, not continuous monitoring or a complete
        relationship history.
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
        stay local and are excluded from Wrapped images. Cleaner and
        request-review CSV files contain the accounts you select; keep them
        private unless you choose to share them. Opening a profile takes you to
        Instagram, which has its own privacy practices.
      </p>
      <h2>Product events, without your social graph.</h2>
      <p>
        {process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT
          ? "This deployment sends event names such as parser_succeeded to a same-origin analytics endpoint. It sends no archive contents, filenames, usernames, counts, or persistent identifiers. Do Not Track disables delivery."
          : "Remote product analytics is not enabled on this deployment. Event names are emitted locally within the page for development diagnostics."}{" "}
        Hosting infrastructure can receive normal request information such as
        your IP address when you visit the site.
      </p>
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
