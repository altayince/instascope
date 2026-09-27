import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tools, type ToolSlug } from "@/lib/site";
import { Workspace } from "@/components/workspace";
import { ProfileViewer } from "@/components/profile-viewer";
export function generateStaticParams() {
  return Object.keys(tools).map((tool) => ({ tool }));
}
export const dynamicParams = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params,
    config = tools[tool as ToolSlug];
  if (!config) return {};
  return {
    title: config.name,
    description: config.description,
    alternates: { canonical: `/${tool}/` },
    openGraph: {
      title: `${config.name} | InstaScope`,
      description: config.description,
      url: `/${tool}/`,
    },
  };
}
export default async function ToolPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params,
    config = tools[tool as ToolSlug];
  if (!config) notFound();
  return (
    <main id="main">
      <section className="tool-hero">
        <Link className="eyebrow" href="/">
          INSTASCOPE / {config.name.toUpperCase()}
        </Link>
        <h1>{config.title}</h1>
        <p>{config.description}</p>
        <span className="pill">No Instagram password required</span>
      </section>
      {config.mode === "profile" ? (
        <ProfileViewer />
      ) : (
        <Workspace
          key={tool}
          mode={config.mode}
          initialCategory={config.category}
        />
      )}
      <section className="faq">
        <h2>A little more clarity.</h2>
        <details open>
          <summary>{config.question}</summary>
          <p>{config.answer}</p>
        </details>
        <details>
          <summary>What happens to my data?</summary>
          <p>
            Your archive stays in this browser’s memory. Clear it or close the
            tab to remove it. Public-photo searches, when enabled, send the
            entered username to our separate lookup service.
          </p>
        </details>
        {config.mode !== "profile" && (
          <details>
            <summary>How do I get the right export?</summary>
            <p>
              Choose Followers and Following with the All time date range in
              Instagram’s Accounts Center. JSON is recommended.{" "}
              Include the relevant optional connection categories for requests,
              privacy lists and your own unfollow history.{" "}
              <Link href="/how-to-download-instagram-followers-data/">
                Read the export guide →
              </Link>
            </p>
          </details>
        )}
      </section>
      <nav className="related-tools" aria-label="Related tools">
        <h3>Keep exploring</h3>
        {Object.entries(tools)
          .filter(([slug]) => slug !== tool)
          .map(([slug, value]) => (
            <Link key={slug} href={`/${slug}/`}>
              {value.name}
            </Link>
          ))}
      </nav>
    </main>
  );
}
