import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="prose">
      <h1>This connection is missing.</h1>
      <p>We couldn’t find that page.</p>
      <Link className="button primary" href="/">
        Back to InstaScope
      </Link>
    </main>
  );
}
