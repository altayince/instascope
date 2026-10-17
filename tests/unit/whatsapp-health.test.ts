import { expect, it, vi } from "vitest";
import { checkWhatsAppRelease } from "../../scripts/whatsapp-health.mjs";
import { whatsappPublicPaths as whatsappPaths } from "../../src/lib/whatsapp/public-content";

const origin = "https://instascope.test";
const production = "https://instascope.me";
const markup = (path: string, robots = "index, follow") => `<html><head>
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${production}${path}">
  <link rel="stylesheet" href="/_next/static/release.css">
  <script src="/_next/static/release.js"></script>
  </head><body>A synthetic release page</body></html>`;
const robots = `User-Agent: *
Allow: /
Disallow: /api/
Sitemap: ${production}/sitemap.xml`;
const sitemap = `<urlset>${["/", "/followers-analyzer/", ...whatsappPaths]
  .map((path) => `<url><loc>${production}${path}</loc></url>`)
  .join("")}</urlset>`;
type Resource = {
  body: string;
  type: string;
  status?: number;
  headers?: Record<string, string>;
};

function site(overrides: Record<string, Partial<Resource>> = {}) {
  const resources: Record<string, Resource> = {
    ...Object.fromEntries(
      ["/", "/followers-analyzer/", ...whatsappPaths].map((path) => [
        path,
        { body: markup(path), type: "text/html" },
      ]),
    ),
    "/robots.txt": { body: robots, type: "text/plain" },
    "/sitemap.xml": { body: sitemap, type: "application/xml" },
    "/_next/static/release.js": {
      body: "console.info('synthetic');",
      type: "text/javascript",
    },
    "/_next/static/release.css": {
      body: "body { color: black; }",
      type: "text/css",
    },
  };
  return vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    const resource = { ...resources[path], ...overrides[path] };
    return new Response(resource.body ?? "Not found", {
      status: resource.status ?? (resources[path] ? 200 : 404),
      headers: { "content-type": resource.type, ...resource.headers },
    });
  });
}

it("opt-in release smoke checks every published WhatsApp route, indexing and deduplicated same-origin assets", async () => {
  const fetcher = site();
  const result = await checkWhatsAppRelease(origin, fetcher);
  expect(result.ready).toBe(true);
  expect(result.pages.map((page) => page.path)).toEqual([
    "/",
    "/followers-analyzer/",
    ...whatsappPaths,
  ]);
  expect(result.assets).toHaveLength(2);
  for (const [input, options] of fetcher.mock.calls) {
    expect(new URL(String(input)).origin).toBe(origin);
    expect(String(input)).not.toMatch(/\/api\/|instagram\.com/);
    expect(options).toMatchObject({
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "manual",
    });
  }
});

it.each(whatsappPaths)(
  "fails when required route %s is missing",
  async (path) => {
    const result = await checkWhatsAppRelease(
      origin,
      site({ [path]: { status: 404 } }),
    );
    expect(result.ready).toBe(false);
    expect(result.pages.find((page) => page.path === path)?.valid).toBe(false);
  },
);

it.each([
  ["/whatsapp/", markup("/whatsapp/", "noindex, nofollow")],
  ["/whatsapp/wrapped/", markup("/whatsapp/wrapped/", "noindex, follow")],
  ["/", markup("/", "noindex, nofollow")],
  [
    "/followers-analyzer/",
    markup("/followers-analyzer/").replace(
      production,
      "https://preview.invalid",
    ),
  ],
])("rejects unsafe page metadata at %s", async (path, body) => {
  expect(
    (await checkWhatsAppRelease(origin, site({ [path]: { body } }))).ready,
  ).toBe(false);
});

it.each(["/", "/whatsapp/", "/whatsapp/chat-vault/"])(
  "rejects an indexing-blocking production response header at %s",
  async (path) => {
    expect(
      (
        await checkWhatsAppRelease(
          origin,
          site({
            [path]: { headers: { "x-robots-tag": "noindex" } },
          }),
        )
      ).ready,
    ).toBe(false);
  },
);

it.each(["/", "/whatsapp/"])(
  "rejects production robots blocking %s",
  async (path) => {
    const body = `${robots}\nDisallow: ${path}`;
    expect(
      (await checkWhatsAppRelease(origin, site({ "/robots.txt": { body } })))
        .ready,
    ).toBe(false);
  },
);

it("handles CRLF robots rules without overlooking a WhatsApp block", async () => {
  const body = `${robots}\nDisallow: /whatsapp/`.replaceAll("\n", "\r\n");
  expect(
    (await checkWhatsAppRelease(origin, site({ "/robots.txt": { body } })))
      .ready,
  ).toBe(false);
});

it.each([
  "<urlset></urlset>",
  sitemap.replace(
    "</urlset>",
    `<url><loc>${production}/whatsapp/</loc></url></urlset>`,
  ),
  sitemap.replace(production, "https://preview.invalid"),
])("rejects an empty, duplicate or nonproduction sitemap", async (body) => {
  expect(
    (await checkWhatsAppRelease(origin, site({ "/sitemap.xml": { body } })))
      .ready,
  ).toBe(false);
});

it.each([
  ["/_next/static/release.css", { status: 404 }],
  [
    "/_next/static/release.js",
    { type: "text/html", body: "<!doctype html><html>Fallback</html>" },
  ],
  [
    "/_next/static/release.js",
    { type: "text/javascript", body: "<!doctype html><html>Fallback</html>" },
  ],
] as const)(
  "rejects missing or fallback static assets at %s",
  async (path, resource) => {
    expect(
      (await checkWhatsAppRelease(origin, site({ [path]: resource }))).ready,
    ).toBe(false);
  },
);

it("does not contact untrusted external asset hosts", async () => {
  const fetcher = site({
    "/whatsapp/": {
      body: markup("/whatsapp/").replace(
        "/_next/static/release.js",
        "https://untrusted.invalid/remote.js",
      ),
    },
  });
  const result = await checkWhatsAppRelease(origin, fetcher);
  expect(result.ready).toBe(false);
  expect(result.assets).toContainEqual({
    path: "invalid_asset",
    status: null,
    valid: false,
  });
  expect(
    fetcher.mock.calls.every(
      ([input]) => new URL(String(input)).origin === origin,
    ),
  ).toBe(true);
});

it("fails safely for unavailable requests without exposing exception data", async () => {
  const result = await checkWhatsAppRelease(
    origin,
    vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("private infrastructure failure")),
  );
  expect(result.ready).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private infrastructure");
});

it("rejects redirects instead of silently passing a login or fallback destination", async () => {
  expect(
    (
      await checkWhatsAppRelease(
        origin,
        site({
          "/whatsapp/chat-analyzer/": {
            status: 302,
            headers: { location: "/" },
          },
        }),
      )
    ).ready,
  ).toBe(false);
});
