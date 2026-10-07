import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/structured-data";
import { guideGroups, guides } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Guides",
  "Practical InstaScope guides for follower relationships, recorded dates, snapshot changes, Instagram exports and public profile photos.",
  "/guides/",
);

export default function GuidesPage() {
  return (
    <main id="main" className="prose guides-hub">
      <Breadcrumbs name="Guides" path="/guides/" />
      <span className="eyebrow">UNDERSTAND YOUR RECORDS</span>
      <h1>InstaScope guides</h1>
      <p>
        Start with the question you want to answer. These guides explain which
        records you need, where to find the right tool and what the data cannot
        tell you.
      </p>
      <nav aria-label="Guide topics">
        <ul className="guide-topic-links">
          {guideGroups.map((group) => (
            <li key={group.id}>
              <a href={`#${group.id}`}>{group.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      {guideGroups.map((group) => (
        <section
          id={group.id}
          key={group.id}
          aria-labelledby={`${group.id}-heading`}
        >
          <h2 id={`${group.id}-heading`}>{group.title}</h2>
          <p>{group.description}</p>
          <ul className="guide-directory">
            {group.slugs.map((slug) => (
              <li key={slug}>
                <h3>
                  <Link href={guides[slug].href}>{guides[slug].title}</Link>
                </h3>
                <p>{guides[slug].description}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
