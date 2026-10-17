// Read-only GET/static-output audit. No browser, analytics, Instagram or Google requests.
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseDocument } from "htmlparser2";
import { findAll, textContent } from "domutils";
import { publicPaths, privatePaths } from "../src/lib/public-paths.ts";

const production = "https://instascope.me";
const tags = (root, name) =>
  findAll((node) => node.name === name, root.children ?? []);
const clean = (value) => value.replace(/\s+/g, " ").trim();
const hidden = new Set(["script", "style", "template", "noscript"]);
const visibleText = (node) =>
  node.type === "text"
    ? node.data
    : hidden.has(node.name) ||
        node.attribs?.hidden !== undefined ||
        node.attribs?.["aria-hidden"] === "true"
      ? ""
      : (node.children ?? []).map(visibleText).join(" ");
const forbiddenOrigin = /(?:localhost|127\.0\.0\.1|workers\.dev|pages\.dev)/i;
const blocked = /\b(?:noindex|nofollow|none)\b/i;

export function inspectSeoHtml(html) {
  const document = parseDocument(html);
  const meta = tags(document, "meta");
  const values = (name) =>
    meta
      .filter(
        (node) =>
          (node.attribs.name ?? node.attribs.property)?.toLowerCase() === name,
      )
      .map((node) => node.attribs.content ?? "");
  const main = tags(document, "main")[0];
  const schemas = tags(document, "script").filter(
    (node) => node.attribs.type === "application/ld+json",
  );
  return {
    title: tags(document, "title").map((node) => clean(textContent(node))),
    h1: tags(document, "h1").map((node) => clean(visibleText(node))),
    description: values("description"),
    robots: values("robots"),
    googlebot: values("googlebot"),
    canonical: tags(document, "link")
      .filter((node) => node.attribs.rel === "canonical")
      .map((node) => node.attribs.href),
    ogUrl: values("og:url"),
    ogTitle: values("og:title"),
    ogDescription: values("og:description"),
    ogImage: values("og:image"),
    mainText: main ? clean(visibleText(main)) : "",
    links: tags(document, "a")
      .map((node) => node.attribs.href)
      .filter(Boolean),
    ids: findAll((node) => Boolean(node.attribs?.id), document.children).map(
      (node) => node.attribs.id,
    ),
    assets: [
      ...tags(document, "script")
        .filter((node) => node.attribs.src)
        .map((node) => ({ reference: node.attribs.src, kind: "script" })),
      ...tags(document, "link")
        .filter((node) => node.attribs.rel === "stylesheet")
        .map((node) => ({ reference: node.attribs.href, kind: "style" })),
      ...tags(document, "img")
        .filter(
          (node) =>
            node.attribs.src && !/^(?:data|blob):/.test(node.attribs.src),
        )
        .map((node) => ({ reference: node.attribs.src, kind: "image" })),
      ...values("og:image").map((reference) => ({ reference, kind: "image" })),
    ],
    structuredData: schemas.map((node) => textContent(node)),
  };
}

function robotsRules(text) {
  const groups = [];
  let group;
  for (const line of text.split(/\r?\n/)) {
    const match = line
      .replace(/#.*/, "")
      .match(/^\s*(user-agent|allow|disallow)\s*:\s*(.*?)\s*$/i);
    if (!match) continue;
    const key = match[1].toLowerCase(),
      value = match[2];
    if (key === "user-agent") {
      if (!group || group.rules.length) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (group && value)
      group.rules.push({ allow: key === "allow", pattern: value });
  }
  return groups;
}

export function crawlAllowed(text, path, agent = "googlebot") {
  const groups = robotsRules(text);
  const specific = groups.filter((group) => group.agents.includes(agent));
  const relevant = specific.length
    ? specific
    : groups.filter((group) => group.agents.includes("*"));
  const rules = relevant
    .flatMap((group) => group.rules)
    .filter(({ pattern }) => {
      const end = pattern.endsWith("$");
      const escaped = (end ? pattern.slice(0, -1) : pattern)
        .split("*")
        .map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      return new RegExp(`^${escaped}${end ? "$" : ""}`).test(path);
    })
    .sort(
      (a, b) =>
        b.pattern.length - a.pattern.length ||
        Number(b.allow) - Number(a.allow),
    );
  return rules[0]?.allow ?? true;
}

async function mapLimit(items, limit, work) {
  const results = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const next = index++;
        results[next] = await work(items[next]);
      }
    }),
  );
  return results;
}

async function limitedBody(response, maxBytes = 8 * 1024 * 1024) {
  if (Number(response.headers.get("content-length") ?? 0) > maxBytes)
    throw new Error("Oversized response");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Oversized response");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}

/** Does not print source contents, supplied sentinels or untrusted exceptions. */
export async function auditPublicSeo(
  origin,
  {
    fetcher = fetch,
    paths = publicPaths,
    internalPaths = privatePaths,
    mode = "production",
    concurrency = 4,
    sentinels = ["SYNTHETIC_SEO_PRIVATE"],
  } = {},
) {
  const base = new URL(origin).origin;
  if (!["production", "preview"].includes(mode))
    throw new Error("Choose production or preview");
  const limit = Math.max(1, Math.min(6, Number(concurrency) || 4));
  const cache = new Map();
  const request = (path) => {
    const url = new URL(path, base);
    if (
      url.origin !== base ||
      url.pathname.startsWith("/api/") ||
      url.username ||
      url.password
    )
      return Promise.resolve({
        status: 0,
        headers: new Headers(),
        body: "",
        error: "untrusted_target",
      });
    url.hash = "";
    if (!cache.has(url.href))
      cache.set(
        url.href,
        (async () => {
          try {
            const response = await fetcher(url, {
              method: "GET",
              credentials: "omit",
              referrerPolicy: "no-referrer",
              redirect: "manual",
              signal: AbortSignal.timeout(15000),
            });
            return {
              status: response.status,
              headers: response.headers,
              body: await limitedBody(response),
            };
          } catch {
            return {
              status: 0,
              headers: new Headers(),
              body: "",
              error: "request_failed_or_oversized",
            };
          }
        })(),
      );
    return cache.get(url.href);
  };
  const failures = [];
  const fail = (path, code) => failures.push({ path, code });
  const metadata = new Map();
  const unique = { title: new Map(), description: new Map(), h1: new Map() };
  const assets = new Map();
  const links = [];
  const pages = await mapLimit(
    [...paths, ...internalPaths],
    limit,
    async (path) => {
      const response = await request(path);
      const data = inspectSeoHtml(response.body);
      metadata.set(path, data);
      const publicPage = paths.includes(path);
      const expectedRobots =
        mode === "preview"
          ? "noindex, nofollow"
          : publicPage
            ? "index, follow"
            : "noindex, follow";
      const startFailures = [];
      const check = (valid, code) => {
        if (!valid) startFailures.push(code);
      };
      check(response.status === 200, "page_status");
      check(
        response.headers.get("content-type")?.includes("text/html"),
        "page_content_type",
      );
      check(
        data.canonical.length === 1 && data.canonical[0] === production + path,
        "canonical",
      );
      check(
        data.robots.length === 1 &&
          data.robots[0].toLowerCase() === expectedRobots,
        "robots_meta",
      );
      if (mode === "production" && publicPage) {
        check(
          !blocked.test(response.headers.get("x-robots-tag") ?? ""),
          "robots_header",
        );
        check(
          data.googlebot.every((value) => !blocked.test(value)),
          "googlebot_meta",
        );
      }
      for (const key of ["title", "description", "h1"]) {
        if (key === "h1" && !publicPage) continue;
        const values = data[key];
        check(
          values.length === 1 &&
            values[0].length >= (key === "description" ? 35 : 6),
          `${key}_missing_or_duplicated`,
        );
        if (publicPage && values.length === 1) {
          if (unique[key].has(values[0])) check(false, `${key}_not_unique`);
          else unique[key].set(values[0], path);
        }
      }
      if (publicPage)
        check(data.mainText.length >= 180, "initial_content_missing");
      if (publicPage) {
        check(
          data.ogUrl.length === 1 && data.ogUrl[0] === production + path,
          "opengraph_url",
        );
        check(
          data.ogTitle.length === 1 && data.ogTitle[0].length > 5,
          "opengraph_title",
        );
        check(
          data.ogDescription.length === 1 &&
            data.ogDescription[0] === data.description[0],
          "opengraph_description",
        );
        check(
          data.ogImage.length === 1 &&
            data.ogImage[0].startsWith(production + "/"),
          "opengraph_image",
        );
        check(data.structuredData.length > 0, "structured_data_missing");
      }
      check(
        !forbiddenOrigin.test(
          JSON.stringify([
            data.canonical,
            data.ogUrl,
            data.ogImage,
            data.structuredData,
          ]),
        ),
        "nonproduction_seo_url",
      );
      check(
        sentinels.every((sentinel) => !response.body.includes(sentinel)),
        "private_sentinel_in_html",
      );
      for (const schema of data.structuredData) {
        try {
          JSON.parse(schema);
        } catch {
          check(false, "structured_data_invalid");
        }
      }
      for (const item of data.assets) assets.set(item.reference, item.kind);
      for (const href of data.links) links.push({ source: path, href });
      for (const code of startFailures) fail(path, code);
      return {
        path,
        status: response.status,
        canonical: data.canonical[0] ?? null,
        robots: data.robots[0] ?? null,
        initialTextCharacters: data.mainText.length,
        valid: startFailures.length === 0,
      };
    },
  );

  const [robotsResponse, sitemapResponse] = await mapLimit(
    ["/robots.txt", "/sitemap.xml"],
    limit,
    request,
  );
  const robotsText = robotsResponse.body;
  if (robotsResponse.status !== 200) fail("/robots.txt", "robots_status");
  if (!/^User-agent:\s*\*\s*$/im.test(robotsText))
    fail("/robots.txt", "wildcard_agent_missing");
  if (!robotsText.includes(`Sitemap: ${production}/sitemap.xml`))
    fail("/robots.txt", "sitemap_reference");
  for (const path of paths)
    for (const agent of ["googlebot", "*"])
      if (crawlAllowed(robotsText, path, agent) !== (mode === "production"))
        fail(path, `crawl_policy_${agent}`);
  if (crawlAllowed(robotsText, "/api/events"))
    fail("/robots.txt", "api_exclusion_missing");
  const sitemapDoc = parseDocument(sitemapResponse.body, { xmlMode: true });
  const sitemapUrls = tags(sitemapDoc, "loc").map(textContent);
  const expectedUrls =
    mode === "production" ? paths.map((path) => production + path) : [];
  if (sitemapResponse.status !== 200) fail("/sitemap.xml", "sitemap_status");
  if (new Set(sitemapUrls).size !== sitemapUrls.length)
    fail("/sitemap.xml", "duplicate_sitemap_url");
  if (
    JSON.stringify([...sitemapUrls].sort()) !==
    JSON.stringify([...expectedUrls].sort())
  )
    fail("/sitemap.xml", "sitemap_inventory_mismatch");

  const edges = new Map(paths.map((path) => [path, new Set()]));
  const linkTargets = new Map();
  for (const { source, href } of links) {
    let url;
    try {
      url = new URL(href, production + source);
    } catch {
      fail(source, "invalid_anchor");
      continue;
    }
    if (url.origin !== production) continue;
    if (url.pathname.startsWith("/api/")) {
      fail(source, "api_anchor");
      continue;
    }
    if (paths.includes(url.pathname)) edges.get(source)?.add(url.pathname);
    const target = url.pathname + url.search;
    linkTargets.set(target, url);
    if (url.hash && metadata.has(url.pathname)) {
      try {
        if (
          !metadata
            .get(url.pathname)
            .ids.includes(decodeURIComponent(url.hash.slice(1)))
        )
          fail(source, "broken_fragment_target");
      } catch {
        fail(source, "invalid_fragment_target");
      }
    }
  }
  await mapLimit([...linkTargets.keys()], limit, async (path) => {
    if ((await request(path)).status !== 200)
      fail(path.split("?")[0], "internal_link_status");
  });
  const reached = new Set(["/"]);
  for (const path of reached)
    for (const destination of edges.get(path) ?? []) reached.add(destination);
  for (const path of paths)
    if (!reached.has(path)) fail(path, "orphan_public_page");
  const assetResults = await mapLimit(
    [...assets],
    limit,
    async ([reference, kind]) => {
      let url;
      try {
        url = new URL(reference, production);
      } catch {
        /* fail without contacting untrusted targets */
      }
      const safe = url?.origin === production;
      const path = safe ? url.pathname + url.search : "untrusted_asset";
      const response = safe ? await request(path) : null;
      const type = response?.headers.get("content-type") ?? "";
      const validType =
        kind === "script"
          ? /javascript/.test(type)
          : kind === "style"
            ? type.includes("text/css")
            : type.startsWith("image/");
      const valid =
        response?.status === 200 &&
        validType &&
        !/^\s*(?:<!doctype\s+html|<html\b)/i.test(response.body);
      if (!valid) fail(path, "essential_asset");
      if (mode === "production" && !crawlAllowed(robotsText, path))
        fail(path, "asset_crawl_block");
      return { path, kind, status: response?.status ?? null, valid };
    },
  );
  for (const path of [
    "/__seo-audit-unknown__/",
    "/whatsapp/__seo-audit-unknown__/",
  ])
    if ((await request(path)).status !== 404)
      fail(path, "unknown_route_must_404");
  for (const path of [
    "/",
    "/whatsapp/chat-analyzer/",
    "/whatsapp/chat-vault/",
  ]) {
    if (!paths.includes(path)) continue;
    const response = await request(`${path}?seo-audit=synthetic`);
    const data = inspectSeoHtml(response.body);
    if (
      response.status !== 200 ||
      data.canonical.length !== 1 ||
      data.canonical[0] !== production + path
    )
      fail(path, "parameter_canonical");
  }
  return {
    ready: failures.length === 0,
    mode,
    origin: base,
    publicCount: paths.length,
    pages,
    sitemap: { status: sitemapResponse.status, urls: sitemapUrls },
    assets: assetResults,
    requestCount: cache.size,
    failures,
  };
}

export async function staticFetcher(directory) {
  const root = resolve(directory);
  const headerRules = [];
  try {
    let current;
    for (const line of (
      await readFile(resolve(root, "_headers"), "utf8")
    ).split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (!/^\s/.test(line)) {
        current = { pattern: line.trim(), headers: new Headers() };
        headerRules.push(current);
      } else if (current) {
        const pair = line.trim().match(/^([^:]+):\s*(.*)$/);
        if (pair) current.headers.append(pair[1], pair[2]);
      }
    }
  } catch {
    /* Static bundles without a headers file have no extra headers. */
  }
  const mime = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".xml": "application/xml",
    ".txt": "text/plain",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
  };
  return async (input) => {
    try {
      const url = new URL(input);
      let path = resolve(root, "." + decodeURIComponent(url.pathname));
      if (path !== root && !path.startsWith(root + sep))
        return new Response("Forbidden", { status: 403 });
      if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
      if ((await stat(path)).size > 8 * 1024 * 1024)
        return new Response("Too large", { status: 413 });
      const headers = new Headers({
        "content-type": mime[extname(path)] ?? "application/octet-stream",
      });
      for (const rule of headerRules) {
        const pattern = rule.pattern
          .split("*")
          .map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*");
        const target = rule.pattern.startsWith("http")
          ? url.href
          : url.pathname;
        if (new RegExp(`^${pattern}$`).test(target))
          for (const [name, value] of rule.headers) headers.append(name, value);
      }
      return new Response(await readFile(path), { headers });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  };
}

/** The output audit also rejects unregistered indexable HTML artifacts. */
export async function auditStaticOutput(directory, options = {}) {
  const root = resolve(directory);
  const result = await auditPublicSeo(production, {
    ...options,
    fetcher: await staticFetcher(root),
  });
  const expected = new Set([
    ...(options.paths ?? publicPaths),
    ...(options.internalPaths ?? privatePaths),
  ]);
  const visit = async (relative = "") => {
    for (const entry of await readdir(resolve(root, relative), {
      withFileTypes: true,
    })) {
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await visit(next);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
      const path =
        next === "index.html"
          ? "/"
          : next.endsWith("/index.html")
            ? `/${next.slice(0, -10)}`
            : `/${next}`;
      if (expected.has(path)) continue;
      const data = inspectSeoHtml(await readFile(resolve(root, next), "utf8"));
      if (!data.robots.some((value) => /\bnoindex\b/.test(value)))
        result.failures.push({ path, code: "unregistered_indexable_html" });
    }
  };
  await visit();
  result.ready = result.failures.length === 0;
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  const directory = args.includes("--static") ? value("--static") : null;
  const origin = directory ? production : args[0] || production;
  const options = {
    mode: args.includes("--mode") ? value("--mode") : "production",
  };
  const result = directory
    ? await auditStaticOutput(directory, options)
    : await auditPublicSeo(origin, options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 1;
}
