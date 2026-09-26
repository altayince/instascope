import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "What’s new",
  alternates: { canonical: "/changelog/" },
};
const changes = [
  {
    issue: 6,
    title:
      "Add pending requests, privacy lists, unfollow history and relationship timeline",
    summary:
      "Review sent requests with dated age filters, inspect private connection lists, explore your own recently-unfollowed records, and group relationship dates by year or month. A new Wrapped card shares aggregate following dates. Missing optional lists are distinguished from empty lists, and all archive analysis stays local.",
  },
  {
    issue: 4,
    title:
      "Validate current Instagram exports and support large archives safely",
    summary:
      "Large media-rich ZIP exports now load through selective local reads. Relationship files retain strict size limits and gain CRC integrity checks. Current JSON export counts and account membership were verified against a real export locally.",
  },
  {
    issue: 1,
    title: "Build privacy-first InstaScope MVP and INS repository workflow",
    summary:
      "Local ZIP, JSON and HTML analysis; searchable relationships; manual Cleaner review lists; snapshot comparison; Wrapped image export; dedicated tool pages and isolated public-photo integration.",
  },
].slice(0, 10);
export default function Changelog() {
  return (
    <main id="main" className="prose">
      <h1>What’s new / Neler değişti?</h1>
      {changes.map((change) => (
        <article key={change.issue}>
          <h2>
            INS-{change.issue} · {change.title}
          </h2>
          <p>{change.summary}</p>
        </article>
      ))}
    </main>
  );
}
