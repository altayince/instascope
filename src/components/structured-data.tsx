import Link from "next/link";
import { breadcrumbData } from "@/lib/seo";
export function StructuredData({ value }: { value: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(value).replaceAll("<", "\\u003c"),
      }}
    />
  );
}
export function Breadcrumbs({ name, path }: { name: string; path: string }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <ol>
          <li>
            <Link href="/">InstaScope</Link>
          </li>
          <li aria-current="page">{name}</li>
        </ol>
      </nav>
      <StructuredData value={breadcrumbData(name, path)} />
    </>
  );
}
