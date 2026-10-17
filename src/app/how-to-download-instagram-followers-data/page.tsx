import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/structured-data";
import { articles } from "@/lib/articles";
export const metadata: Metadata = pageMetadata(
  "How to download Instagram followers data on iPhone, Android and desktop",
  "Choose Followers and Following, All time and JSON for an Instagram overview. Include optional connection categories for requests, privacy lists and your own unfollow history.",
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
      <h1>Download your Instagram followers data.</h1>
      <p>
        Request your own export in Instagram, then choose the downloaded file
        here for local analysis. Instagram’s menu names and positions vary by
        app version and language; look for information export in Meta Accounts
        Center rather than relying on an exact button label.
      </p>
      <p>
        <strong>Already have your export?</strong>{" "}
        <Link href="/followers-analyzer/">Analyze it with InstaScope.</Link>
      </p>
      <p>
        For relationship analysis, include{" "}
        <strong>Followers and Following</strong>, choose{" "}
        <strong>All time</strong> when available, and prefer{" "}
        <strong>JSON</strong>. Open the ZIP locally; InstaScope does not need
        your photos, messages or Instagram password to compare these lists.
      </p>
      <nav aria-label="Export guide sections">
        <ul>
          <li>
            <a href="#iphone">iPhone</a>
          </li>
          <li>
            <a href="#android">Android</a>
          </li>
          <li>
            <a href="#desktop">Desktop</a>
          </li>
          <li>
            <a href="#export-settings">Choose the right export settings</a>
          </li>
          <li>
            <a href="#file-formats">JSON, HTML and split files</a>
          </li>
          <li>
            <a href="#category-coverage">Which categories do I need?</a>
          </li>
        </ul>
      </nav>
      <section id="iphone">
        <h2>iPhone</h2>
        <p>
          Open your profile in the Instagram app, open its menu or settings,
          then find <strong>Accounts Center</strong>. Continue with the shared
          export settings below. Use Instagram itself if it asks you to confirm
          your identity; never enter your Instagram password in InstaScope.
        </p>
        <p>
          When the export is ready, save the ZIP to a location you can find in
          Files. In InstaScope’s file chooser, browse to that location and
          select the ZIP. You do not need to unzip it first.
        </p>
      </section>
      <section id="android">
        <h2>Android</h2>
        <p>
          In the Instagram app, open your profile menu, find settings and
          <strong> Accounts Center</strong>, then follow the export settings
          below. If a label differs, look for information and permissions or
          search settings for export or download.
        </p>
        <p>
          Save the completed ZIP on your device. When InstaScope opens the file
          chooser, look in Downloads or the folder selected by your browser.
          Select the ZIP as a file, rather than choosing a photo or screenshot
          of its contents.
        </p>
      </section>
      <section id="desktop">
        <h2>Desktop</h2>
        <p>
          Open Instagram’s website and its settings menu, then find
          <strong> Accounts Center</strong>. Choose the Instagram profile whose
          relationships you want to analyze if several profiles are linked.
        </p>
        <p>
          After requesting the export with the settings below, download the
          ready ZIP. Use InstaScope’s file button or drag the ZIP into the
          upload area. If your browser extracted it automatically, select all
          followers parts and the following file together instead.
        </p>
      </section>
      <section id="export-settings">
        <h2>Choose the right export settings</h2>
        <p>
          <strong>Followers and Following · All time · JSON</strong>
        </p>
        <p>
          Followers and Following are enough for the basic overview. To review
          sent requests, privacy lists or your own unfollow history, include
          those optional connection categories too.
        </p>
        <ol>
          <li>
            Open <strong>Your information and permissions</strong>, then choose
            the option to export or download your information.
          </li>
          <li>Select your Instagram profile and export to your device.</li>
          <li>
            Choose the option to customize or select specific information and
            include <strong>Followers and Following</strong>.
          </li>
          <li>
            Set the date range to <strong>All time</strong> and the format to{" "}
            <strong>JSON</strong>. Supported HTML records also work; their
            visible dates have no source timezone.
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
          These choices keep the input focused on relationships. Media is not
          needed for the analyzer. All time avoids intentionally excluding older
          entries; it is not a guarantee that the export is identical to your
          account’s live state when you open it.
        </p>
        <p>
          Preparation is handled by Instagram. Return to its export area to
          check availability; InstaScope cannot speed it up or retrieve it for
          you.
        </p>
      </section>
      <section id="file-formats">
        <h2>JSON, HTML and split follower files</h2>
        <p>
          JSON is recommended for structured records and timestamp precision.
          HTML is useful when you also want to browse the export yourself.
          InstaScope supports recognized relationship records in either format;
          it does not require you to convert one into the other.
        </p>
        <div
          className="article-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Instagram export formats"
        >
          <table>
            <caption>What InstaScope reads from your chosen format</caption>
            <thead>
              <tr>
                <th scope="col">Format</th>
                <th scope="col">Accounts and dates</th>
                <th scope="col">What to select</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">JSON</th>
                <td>
                  Supported usernames and usable numeric timestamps; dates
                  display in UTC. Missing dates remain unavailable.
                </td>
                <td>All followers parts and following.json, or their ZIP.</td>
              </tr>
              <tr>
                <th scope="row">HTML</th>
                <td>
                  Supported profile links and visible recorded dates. The source
                  does not supply a timezone.
                </td>
                <td>All followers parts and following.html, or their ZIP.</td>
              </tr>
              <tr>
                <th scope="row">ZIP</th>
                <td>
                  A container, not a third record format. Recognized JSON/HTML
                  files are read locally; unrelated media is not analyzed.
                </td>
                <td>The original ZIP downloaded from Instagram.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Common names include <code>followers_1.json</code>,{" "}
          <code>followers_2.json</code> and <code>following.json</code>, often
          inside a <code>followers_and_following</code> folder. HTML exports use
          corresponding <code>.html</code> files. Folder depth and the number of
          parts can vary. If you select extracted files, include every followers
          part together with Following in one import.
        </p>
        <p>
          <strong>Synthetic example:</strong> one follower part contains
          sample.cedar and sample.fern; a second contains sample.oak. Selecting
          only the first supplies two followers, not three. Including all parts
          restores the available coverage. Duplicate usernames are counted once;
          an omitted username is not evidence that someone unfollowed you.
        </p>
      </section>
      <section id="category-coverage">
        <h2>Choose categories for the question you want to answer</h2>
        <p>
          Check the categories offered for your Instagram profile. Names and
          grouping can vary, and an All time request does not guarantee that
          every optional category or every historical event will be available.
        </p>
        <div
          className="article-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Instagram export category coverage"
        >
          <table>
            <caption>
              Required core lists and optional connection records
            </caption>
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Include</th>
                <th scope="col">Next tool</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Who follows back?</th>
                <td>Both Followers and Following</td>
                <td>
                  <Link href="/followers-analyzer/">Followers Analyzer</Link>
                </td>
              </tr>
              <tr>
                <th scope="row">When was a relationship recorded?</th>
                <td>The same core lists, with usable source dates</td>
                <td>
                  <Link href="/relationship-timeline/">
                    Relationship Timeline
                  </Link>
                </td>
              </tr>
              <tr>
                <th scope="row">Which requests were sent?</th>
                <td>
                  The optional pending/sent follow-request category plus both
                  core lists
                </td>
                <td>
                  <Link href="/pending-follow-requests/">Pending Requests</Link>
                </td>
              </tr>
              <tr>
                <th scope="row">Whom did I recently unfollow?</th>
                <td>
                  The optional recently-unfollowed category plus both core lists
                </td>
                <td>
                  <Link href="/unfollow-history/">Unfollow History</Link>
                </td>
              </tr>
              <tr>
                <th scope="row">Which privacy lists were supplied?</th>
                <td>
                  Relevant close-friends, blocked, restricted or
                  story-visibility categories plus both core lists
                </td>
                <td>
                  <Link href="/connection-privacy/">Connection Privacy</Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          A missing optional list is reported as not included; an explicitly
          empty supported list can correctly contain zero accounts. An
          unreadable category needs attention before you interpret it. Do not
          treat these three situations as the same result.
        </p>
      </section>
      <p>
        Do not send your password or archive to anyone. You only need to choose
        the file locally on this site.
      </p>
      <Link className="button primary" href="/followers-analyzer/">
        I have my export
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
        Explore <Link href="/pending-follow-requests/">sent requests</Link>,{" "}
        <Link href="/relationship-timeline/">recorded relationship dates</Link>
        {" and "}
        <Link href="/unfollow-history/">accounts you recently unfollowed</Link>.
        The timeline uses dates attached to current connections; it is not a
        record of past follower totals.
      </p>
      <p>
        If the download is damaged, download it again. If the menus have
        changed, consult{" "}
        <a href="https://help.instagram.com/181231772500920">
          Instagram’s official information export help
        </a>
        . Meta describes information downloads as an{" "}
        <a href="https://about.fb.com/news/2023/10/manage-your-information-across-apps/">
          Accounts Center feature
        </a>
        .
      </p>
      <p>
        <Link href="/not-following-back/">
          Have both lists? See who does not follow you back.
        </Link>
      </p>
      <p>
        If InstaScope reports a missing list, check that both Followers and
        Following were included. Date-limited exports can leave out older
        relationships and produce misleading results. Empty lists are accepted
        when the export explicitly contains them.
      </p>
      <nav aria-label="Understanding your export">
        <h2>Understand your export</h2>
        <ul>
          {Object.entries(articles).map(([slug, article]) => (
            <li key={slug}>
              <Link href={`/${slug}/`}>{article.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
