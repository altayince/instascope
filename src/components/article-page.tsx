import Link from "next/link";
import type { Article } from "@/lib/articles";
import { guides } from "@/lib/guides";
import { productionOrigin } from "@/lib/site-config";
import { ActionLink } from "./actions";
import { Breadcrumbs, StructuredData } from "./structured-data";

export function ArticlePage({
  slug,
  article,
  catalog = guides,
  hub = { href: "/guides/", label: "Browse all guides by topic" },
  exportGuide = {
    href: "/how-to-download-instagram-followers-data/",
    label: "Get the right Instagram export",
  },
  eyebrow = "UNDERSTAND YOUR EXPORT",
}: {
  slug: string;
  article: Article;
  catalog?: Record<string, { href: string; title: string }>;
  hub?: { href: string; label: string };
  exportGuide?: { href: string; label: string };
  eyebrow?: string;
}) {
  const related = [...new Set(article.related)]
    .filter((id) => id !== slug && Object.hasOwn(catalog, id))
    .slice(0, 5);
  const path = `/${slug}/`;
  return (
    <main id="main" className="prose">
      <Breadcrumbs name={article.title} path={path} />
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.description,
          url: `${productionOrigin}${path}`,
          mainEntityOfPage: `${productionOrigin}${path}`,
        }}
      />
      <article>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{article.title}</h1>
        <p>{article.description}</p>
        {article.primaryAction && (
          <ActionLink variant="primary" href={article.primaryAction.href}>
            {article.primaryAction.label}
          </ActionLink>
        )}
        {article.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.steps && (
              <ol>
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            {section.table && (
              <div
                className="article-table-scroll"
                tabIndex={0}
                role="region"
                aria-label={`${section.heading} table`}
              >
                <table>
                  <caption>{section.heading}</caption>
                  <thead>
                    <tr>
                      {section.table.columns.map((column) => (
                        <th scope="col" key={column}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, index) => (
                      <tr key={index}>
                        {row.map((cell, column) => (
                          <td key={column}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {section.links && (
              <ul>
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            )}
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
            <Link href={exportGuide.href}>{exportGuide.label}</Link>
          </p>
        </nav>
        {article.sources && (
          <section aria-label="Sources">
            <h2>Sources</h2>
            <ul>
              {article.sources.map((source) => (
                <li key={source.href}>
                  <a href={source.href}>{source.label}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <nav aria-label="Related guides">
        <h2>Related guides</h2>
        <ul>
          {related.map((id) => (
            <li key={id}>
              <Link href={catalog[id].href}>{catalog[id].title}</Link>
            </li>
          ))}
        </ul>
        <p>
          <Link href={hub.href}>{hub.label}</Link>
        </p>
      </nav>
    </main>
  );
}
