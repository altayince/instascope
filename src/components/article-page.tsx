import Link from "next/link";
import type { Article } from "@/lib/articles";
import { guides } from "@/lib/guides";
import { Breadcrumbs } from "./structured-data";

export function ArticlePage({
  slug,
  article,
}: {
  slug: string;
  article: Article;
}) {
  const related = [...new Set(article.related)]
    .filter((id) => id !== slug && Object.hasOwn(guides, id))
    .slice(0, 5);
  return (
    <main id="main" className="prose">
      <Breadcrumbs name={article.title} path={`/${slug}/`} />
      <article>
        <span className="eyebrow">UNDERSTAND YOUR EXPORT</span>
        <h1>{article.title}</h1>
        <p>{article.description}</p>
        {article.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
        <nav aria-label="Put this guide into practice">
          <h2>Put it into practice</h2>
          <ul>
            {article.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
          <p>
            <Link href="/how-to-download-instagram-followers-data/">
              Get the right Instagram export
            </Link>
          </p>
        </nav>
      </article>
      <nav aria-label="Related guides">
        <h2>Related guides</h2>
        <ul>
          {related.map((id) => (
            <li key={id}>
              <Link href={guides[id].href}>{guides[id].title}</Link>
            </li>
          ))}
        </ul>
        <p>
          <Link href="/guides/">Browse all guides by topic</Link>
        </p>
      </nav>
    </main>
  );
}
