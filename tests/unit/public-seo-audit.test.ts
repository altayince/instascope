import { expect, it, vi } from "vitest";
import {
  auditPublicSeo,
  crawlAllowed,
  inspectSeoHtml,
} from "../../scripts/audit-public-seo.mjs";

const origin = "https://instascope.test";
const production = "https://instascope.me";
const paths = ["/", "/whatsapp/", "/whatsapp/chat-vault/"];
const internalPaths = ["/dashboard/"];
const copy =
  "Analyze an exported conversation privately in your browser. This public introduction explains the available tools and their limitations. No chat messages, participant names or private snapshot records are required to read this page.";
const markup = (path: string, mode = "production") => {
  const description = `Public introduction to ${path}: ${copy}`;
  return `<html><head><title>Distinct title ${path}</title>
    <meta name="description" content="${description}">
    <meta name="robots" content="${mode === "preview" ? "noindex, nofollow" : internalPaths.includes(path) ? "noindex, follow" : "index, follow"}">
    <link rel="canonical" href="${production}${path}">
    <meta property="og:title" content="Distinct title ${path}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${production}${path}">
    <meta property="og:image" content="${production}/opengraph-image.png">
    <link rel="stylesheet" href="/_next/static/app.css">
    <script src="/_next/static/app.js"></script>
    <script type="application/ld+json">{"@type":"WebPage","url":"${production}${path}"}</script>
    </head><body><main id="intro"><h1>Distinct heading ${path}</h1><p>${copy}</p>
    ${paths.map((link) => `<a href="${link}#intro">Explore ${link}</a>`).join("")}
    <a href="/dashboard/">Private workspace</a></main></body></html>`;
};
type Resource = {
  body: string;
  status?: number;
  type?: string;
  headers?: Record<string, string>;
};
function site(
  mode = "production",
  overrides: Record<string, Partial<Resource>> = {},
) {
  const resources: Record<string, Resource> = {
    ...Object.fromEntries(
      [...paths, ...internalPaths].map((path) => [
        path,
        { body: markup(path, mode), type: "text/html" },
      ]),
    ),
    "/robots.txt": {
      body: `User-agent: *\n${mode === "production" ? "Allow: /\nDisallow: /api/" : "Disallow: /"}\nSitemap: ${production}/sitemap.xml`,
      type: "text/plain",
    },
    "/sitemap.xml": {
      body: `<urlset>${(mode === "production" ? paths : []).map((path) => `<url><loc>${production}${path}</loc></url>`).join("")}</urlset>`,
      type: "application/xml",
    },
    "/_next/static/app.js": {
      body: "/* synthetic */",
      type: "text/javascript",
    },
    "/_next/static/app.css": { body: "body{color:black}", type: "text/css" },
    "/opengraph-image.png": { body: "synthetic image", type: "image/png" },
  };
  return vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    const resource = { ...resources[path], ...overrides[path] };
    return new Response(resource.body ?? "Missing", {
      status: resource.status ?? (resources[path] ? 200 : 404),
      headers: {
        "content-type": resource.type ?? "text/plain",
        ...resource.headers,
      },
    });
  });
}
const options = { paths, internalPaths };

it.each(["production", "preview"])(
  "audits the exact public/private %s matrix without browser execution or external requests",
  async (mode) => {
    const fetcher = site(mode);
    const result = await auditPublicSeo(origin, { ...options, fetcher, mode });
    expect(result.failures).toEqual([]);
    expect(result.ready).toBe(true);
    expect(result.pages).toHaveLength(paths.length + internalPaths.length);
    expect(result.sitemap.urls).toEqual(
      mode === "production" ? paths.map((path) => production + path) : [],
    );
    expect(result.assets).toHaveLength(3);
    expect(
      fetcher.mock.calls.filter(([url]) =>
        String(url).endsWith("/_next/static/app.js"),
      ),
    ).toHaveLength(1);
    for (const [input, init] of fetcher.mock.calls) {
      expect(new URL(String(input)).origin).toBe(origin);
      expect(String(input)).not.toContain("/api/");
      expect(init).toMatchObject({
        method: "GET",
        credentials: "omit",
        redirect: "manual",
        referrerPolicy: "no-referrer",
      });
    }
  },
);

it.each([
  [
    "canonical",
    markup("/whatsapp/").replace(
      `href="${production}/whatsapp/"`,
      'href="https://preview.workers.dev/whatsapp/"',
    ),
  ],
  [
    "robots_meta",
    markup("/whatsapp/").replace(
      'content="index, follow"',
      'content="noindex, nofollow"',
    ),
  ],
  [
    "googlebot_meta",
    markup("/whatsapp/").replace(
      "</head>",
      '<meta name="googlebot" content="noindex"></head>',
    ),
  ],
  [
    "initial_content_missing",
    markup("/whatsapp/").replace(
      /<main[\s\S]*<\/main>/,
      "<main><h1>Distinct heading /whatsapp/</h1><script>Private app content only</script></main>",
    ),
  ],
  [
    "private_sentinel_in_html",
    markup("/whatsapp/").replace("</main>", "SYNTHETIC_SEO_PRIVATE</main>"),
  ],
  [
    "structured_data_invalid",
    markup("/whatsapp/").replace('"@type":"WebPage"', '"@type":broken'),
  ],
  [
    "broken_fragment_target",
    markup("/whatsapp/").replace("/#intro", "/#missing"),
  ],
] as const)(
  "fails on %s without reporting the page body",
  async (code, body) => {
    const result = await auditPublicSeo(origin, {
      ...options,
      fetcher: site("production", { "/whatsapp/": { body } }),
    });
    expect(result.ready).toBe(false);
    expect(result.failures).toContainEqual({ path: "/whatsapp/", code });
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_SEO_PRIVATE");
  },
);

it.each([
  ["/whatsapp/", { status: 302, headers: { location: "/" } }, "page_status"],
  [
    "/whatsapp/",
    { headers: { "x-robots-tag": "googlebot: noindex" } },
    "robots_header",
  ],
  [
    "/_next/static/app.js",
    { body: "<!doctype html>Fallback", type: "text/javascript" },
    "essential_asset",
  ],
  [
    "/whatsapp/__seo-audit-unknown__/",
    { status: 200, body: markup("/whatsapp/") },
    "unknown_route_must_404",
  ],
  [
    "/sitemap.xml",
    {
      body: `<urlset><loc>${production}/</loc><loc>${production}/</loc></urlset>`,
    },
    "duplicate_sitemap_url",
  ],
  [
    "/robots.txt",
    {
      body: `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${production}/sitemap.xml\nUser-agent: Googlebot\nDisallow: /`,
    },
    "crawl_policy_googlebot",
  ],
] as const)("rejects %s resource failure %s", async (path, resource, code) => {
  const result = await auditPublicSeo(origin, {
    ...options,
    fetcher: site("production", { [path]: resource }),
  });
  expect(result.ready).toBe(false);
  expect(result.failures.some((failure) => failure.code === code)).toBe(true);
});

it("fails a missing public route instead of silently pruning the inventory", async () => {
  const result = await auditPublicSeo(origin, {
    ...options,
    fetcher: site("preview", { "/whatsapp/chat-vault/": { status: 404 } }),
    mode: "preview",
  });
  expect(result.failures).toContainEqual({
    path: "/whatsapp/chat-vault/",
    code: "page_status",
  });
});

it("allows a noindex client-only private workspace while retaining its canonical and privacy checks", async () => {
  const body = markup("/dashboard/").replace(
    /<main[\s\S]*<\/main>/,
    "<main></main>",
  );
  const result = await auditPublicSeo(origin, {
    ...options,
    fetcher: site("production", { "/dashboard/": { body } }),
  });
  expect(result.failures).toEqual([]);
  const wronglyPublic = body.replace(
    'content="noindex, follow"',
    'content="index, follow"',
  );
  expect(
    (
      await auditPublicSeo(origin, {
        ...options,
        fetcher: site("production", { "/dashboard/": { body: wronglyPublic } }),
      })
    ).failures,
  ).toContainEqual({ path: "/dashboard/", code: "robots_meta" });
});

it("never follows external scripts and keeps request concurrency bounded", async () => {
  const source = site("production", {
    "/whatsapp/": {
      body: markup("/whatsapp/").replace(
        "/_next/static/app.js",
        "https://external.invalid/remote.js",
      ),
    },
  });
  let running = 0,
    peak = 0;
  const fetcher: typeof fetch = async (...args) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 1));
    try {
      return await source(...args);
    } finally {
      running--;
    }
  };
  const result = await auditPublicSeo(origin, {
    ...options,
    fetcher,
    concurrency: 2,
  });
  expect(result.failures).toContainEqual({
    path: "untrusted_asset",
    code: "essential_asset",
  });
  expect(peak).toBeLessThanOrEqual(2);
  expect(
    source.mock.calls.every(([url]) => new URL(String(url)).origin === origin),
  ).toBe(true);
});

it("fails oversized or unavailable responses without exposing exception contents", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("secret source filename"));
  const result = await auditPublicSeo(origin, { ...options, fetcher });
  expect(result.ready).toBe(false);
  expect(JSON.stringify(result)).not.toContain("secret source filename");
  const oversized = site("production", {
    "/whatsapp/": { headers: { "content-length": String(9 * 1024 * 1024) } },
  });
  expect(
    (await auditPublicSeo(origin, { ...options, fetcher: oversized })).failures,
  ).toContainEqual({ path: "/whatsapp/", code: "page_status" });
});

it("reads entities, meaningful initial content and exact schema without executing scripts", () => {
  const page = inspectSeoHtml(
    markup("/whatsapp/").replace("Distinct heading", "Chat &amp; export"),
  );
  expect(page.h1).toEqual(["Chat & export /whatsapp/"]);
  expect(page.mainText).not.toContain("@type");
  expect(page.canonical).toEqual([production + "/whatsapp/"]);
});

it("evaluates specific crawler groups, wildcard paths and longest allow rules", () => {
  const rules =
    "User-agent: *\nDisallow: /\nAllow: /public/\nDisallow: /*?private=*\nUser-agent: Googlebot\nAllow: /\nDisallow: /api/";
  expect(crawlAllowed(rules, "/", "*")).toBe(false);
  expect(crawlAllowed(rules, "/public/page/", "*")).toBe(true);
  expect(crawlAllowed(rules, "/?private=synthetic", "*")).toBe(false);
  expect(crawlAllowed(rules, "/", "googlebot")).toBe(true);
  expect(crawlAllowed(rules, "/api/events", "googlebot")).toBe(false);
});
