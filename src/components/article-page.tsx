import Link from "next/link";
import { articles, type Article } from "@/lib/articles";
import { Breadcrumbs } from "./structured-data";

export function ArticlePage({
  slug,
  article,
}: {
  slug: string;
  article: Article;
}) {
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
        <h2>More export guides</h2>
        <ul>
          {Object.entries(articles)
            .filter(([path]) => path !== slug)
            .map(([path, guide]) => (
              <li key={path}>
                <Link href={`/${path}/`}>{guide.title}</Link>
              </li>
            ))}
        </ul>
      </nav>
    </main>
  );
}
