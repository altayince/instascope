import Link from "next/link";
import { toolContent } from "@/lib/tool-content";
import type { ToolSlug } from "@/lib/site";
export function ToolExplainer({ slug }: { slug: ToolSlug }) {
  const content = toolContent[slug];
  if (!content) return null;
  return (
    <div className="tool-explainer">
      {content.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p className="notice">
        {content.guide && (
          <>
            <Link href={content.guide.href}>{content.guide.label}</Link>
            {" · "}
          </>
        )}
        <Link href="/how-to-download-instagram-followers-data/">
          Get your Instagram export
        </Link>
        {" · "}
        <Link href="/privacy/">Read how your data is handled</Link>
        {" · "}
        <a href="#tool">Back to the tool</a>
      </p>
    </div>
  );
}
