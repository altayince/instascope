// Public static release checks only; never imports a chat or contacts Instagram.
import { whatsappPublicPaths } from "../src/lib/whatsapp/public-content.ts";
const productionOrigin = "https://instascope.me";
const paths = ["/", "/followers-analyzer/", ...whatsappPublicPaths];

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map(
    (match) =>
      Object.fromEntries(
        [...match[1].matchAll(/([^\s=]+)\s*=\s*(["'])(.*?)\2/g)].map(
          ([, key, , value]) => [key.toLowerCase(), value],
        ),
      ),
  );
}

export async function checkWhatsAppRelease(origin, fetcher = fetch) {
  const requestedOrigin = new URL(origin).origin;
  const assets = new Map();
  const request = async (path) => {
    try {
      const response = await fetcher(new URL(path, origin), {
        signal: AbortSignal.timeout(15000),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        redirect: "manual",
      });
      return {
        status: response.status,
        headers: response.headers,
        text: await response.text(),
      };
    } catch {
      return null;
    }
  };
  const pages = [];
  for (const path of paths) {
    const response = await request(path);
    const html = response?.text ?? "";
    const robots = tags(html, "meta")
      .find((tag) => tag.name?.toLowerCase() === "robots")
      ?.content?.toLowerCase();
    const canonical = tags(html, "link").find(
      (tag) => tag.rel?.toLowerCase() === "canonical",
    )?.href;
    const directives = new Set(robots?.split(/\s*,\s*/));
    const scripts = tags(html, "script").filter((tag) => tag.src);
    const styles = tags(html, "link").filter(
      (tag) => tag.rel?.toLowerCase() === "stylesheet" && tag.href,
    );
    for (const [references, kind] of [
      [scripts, "script"],
      [styles, "style"],
    ])
      for (const tag of references) assets.set(tag.src || tag.href, kind);
    pages.push({
      path,
      status: response?.status ?? null,
      robots: robots ?? null,
      canonical: canonical ?? null,
      valid:
        response?.status === 200 &&
        response.headers.get("content-type")?.includes("text/html") &&
        directives.has("index") &&
        directives.has("follow") &&
        !directives.has("noindex") &&
        !directives.has("nofollow") &&
        canonical === `${productionOrigin}${path}` &&
        !/(?:noindex|nofollow|none)/i.test(
          response.headers.get("x-robots-tag") ?? "",
        ) &&
        scripts.length > 0 &&
        styles.length > 0,
    });
  }

  const robotsResponse = await request("/robots.txt");
  const robotsText = robotsResponse?.text ?? "";
  const disallowed = [
    ...robotsText.matchAll(/^Disallow:[\t ]*(\S*)[\t ]*\r?$/gim),
  ].map((match) => match[1]);
  const robots = {
    status: robotsResponse?.status ?? null,
    valid:
      robotsResponse?.status === 200 &&
      /^User-agent:\s*\*\s*$/im.test(robotsText) &&
      /^Allow:\s*\/\s*$/im.test(robotsText) &&
      disallowed.every((path) => !path || path === "/api/") &&
      robotsText.includes(`Sitemap: ${productionOrigin}/sitemap.xml`),
  };
  const sitemapResponse = await request("/sitemap.xml");
  const sitemapText = sitemapResponse?.text ?? "";
  const urls = [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => match[1],
  );
  const sitemap = {
    status: sitemapResponse?.status ?? null,
    valid:
      sitemapResponse?.status === 200 &&
      paths.every((path) => urls.includes(`${productionOrigin}${path}`)) &&
      new Set(urls).size === urls.length &&
      urls.every((url) => url.startsWith(`${productionOrigin}/`)),
  };
  const checkedAssets = [];
  for (const [reference, kind] of assets) {
    let url;
    try {
      url = new URL(reference, origin);
    } catch {
      // Invalid or external assets must fail without contacting another host.
    }
    const response =
      url?.origin === requestedOrigin ? await request(url) : null;
    const body = response?.text ?? "";
    const type = response?.headers.get("content-type") ?? "";
    checkedAssets.push({
      path: url?.origin === requestedOrigin ? url.pathname : "invalid_asset",
      status: response?.status ?? null,
      valid:
        response?.status === 200 &&
        (kind === "style"
          ? type.includes("text/css")
          : /javascript/.test(type)) &&
        !/^\s*(?:<!doctype\s+html|<html\b)/i.test(body),
    });
  }
  return {
    ready:
      pages.every((page) => page.valid) &&
      robots.valid &&
      sitemap.valid &&
      checkedAssets.every((asset) => asset.valid),
    pages,
    robots,
    sitemap,
    assets: checkedAssets,
  };
}
