import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/structured-data";
import { articles } from "@/lib/articles";
export const metadata: Metadata = pageMetadata(
  "How to download Instagram followers data on iPhone, Android and desktop",
  "Find the Instagram export on your device, choose Followers and Following, All time and JSON, then analyze the ZIP locally with InstaScope.",
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
