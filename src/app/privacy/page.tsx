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
      <h2>Saved snapshots are your choice.</h2>
      <p>
        If you choose “Save this snapshot for next time”, InstaScope stores only
        follower and following usernames plus the export date you enter in this
        browser’s site storage. It does not save the ZIP, other connection lists
        or relationship dates. You can replace or delete the saved snapshot in
        the workspace. Clearing browser/site data may also remove it. Nothing is
        compared with a later export until you choose the older snapshot and
        confirm the dates.
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
    </main>
  );
}
