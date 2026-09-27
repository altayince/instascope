import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/structured-data";
export const metadata: Metadata = pageMetadata(
  "Download your Instagram followers data",
  "Choose an All time Followers and Following export for accurate local Instagram analysis.",
  "/how-to-download-instagram-followers-data/",
);
export default function Guide() {
  return (
    <main id="main" className="prose">
      <Breadcrumbs
        name="Export guide"
        path="/how-to-download-instagram-followers-data/"
      />
      <span className="eyebrow">START WITH YOUR OWN DATA</span>
      <h1>Your export is the key.</h1>
      <p>
        Instagram’s menu names can vary by app version. Look for your
        information export in Meta Accounts Center.
      </p>
      <ol>
        <li>
          Open Instagram settings, then <strong>Accounts Center</strong>.
        </li>
        <li>
          Open <strong>Your information and permissions</strong>, then choose
          the option to export or download your information.
        </li>
        <li>Select your Instagram profile and export to your device.</li>
        <li>
          Choose specific information and include{" "}
          <strong>Followers and Following</strong>.
        </li>
        <li>
          Set the date range to <strong>All time</strong> and the format to{" "}
          <strong>JSON</strong>. HTML is also supported, with fewer date
          details.
        </li>
        <li>
          Request the export and download the ZIP when Instagram makes it
          available.
        </li>
        <li>
          Upload the ZIP to InstaScope. If you extract it first, select all
          followers files and the following file together.
        </li>
      </ol>
      <p>
        Do not send your password or archive to anyone. You only need to choose
        the file locally on this site.
      </p>
      <Link className="button primary" href="/followers-analyzer/">
        I have my export →
      </Link>
      <h2>Something missing?</h2>
      <p>
        For pending requests, connection privacy and your own unfollow history,
        include the corresponding connection categories offered in your export:
        sent follow requests, close friends, blocked and restricted profiles,
        story visibility, and recently-unfollowed profiles. Upload these files
        together with Followers and Following, or choose the complete ZIP.
        Unavailable categories stay marked as missing; they are never assumed to
        be empty. JSON is recommended for request ages and the date timeline.
      </p>
      <p>
        If InstaScope reports a missing list, check that both Followers and
        Following were included. Date-limited exports can leave out older
        relationships and produce misleading results. Empty lists are accepted
        when the export explicitly contains them.
      </p>
    </main>
  );
}
