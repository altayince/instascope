import { parseDocument } from "htmlparser2";
import { findAll } from "domutils";
import { normalizeUsername } from "../src/lib/instagram/normalize";
import {
  profileMessages,
  verifiedPublicImageUrl,
  type ProfileErrorCode,
} from "../src/lib/profile-lookup";

export type ProfileEnv = {
  RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
  ENABLE_PUBLIC_LOOKUP?: string;
};
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};
const reply = (status: number, code: ProfileErrorCode) =>
  Response.json(
    { code, error: profileMessages[code] },
    {
      status,
      headers: {
        ...headers,
        ...(code === "request_rate_limited" ? { "Retry-After": "60" } : {}),
      },
    },
  );
export function extractPublicImage(
  html: string,
  username: string,
): string | null {
  const document = parseDocument(html);
  const metas = findAll((node) => node.name === "meta", document.children);
  const values = (property: string) =>
    metas
      .filter((node) => node.attribs.property?.toLowerCase() === property)
      .map((node) => node.attribs.content);
  const titles = values("og:title"),
    images = values("og:image"),
    urls = values("og:url");
  if (titles.length !== 1 || images.length !== 1 || urls.length > 1)
    return null;
  const title = titles[0] ?? "";
  // Avoid returning the Instagram logo, login image, or a suggested account's photo.
  if (!title.toLowerCase().includes(`(@${username})`)) return null;
  // Current public HTML also includes og:url. If present, it must identify the
  // requested profile; title-only legacy responses remain supported.
  if (urls.length) {
    try {
      if (
        new URL(urls[0]).protocol !== "https:" ||
        normalizeUsername(urls[0]) !== username
      )
        return null;
    } catch {
      return null;
    }
  }
  return verifiedPublicImageUrl(images[0]);
}
export async function handleProfile(
  request: Request,
  env: ProfileEnv,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "GET") return reply(405, "method_not_allowed");
  const url = new URL(request.url);
  const configured = typeof env.RATE_LIMITER?.limit === "function";
  const enabled = env.ENABLE_PUBLIC_LOOKUP === "true";
  if (url.pathname === "/api/profile-picture/health") {
    return Response.json(
      {
        service: "instascope-profile-picture",
        status: !configured ? "not_configured" : enabled ? "ready" : "disabled",
        configured,
        enabled,
        capability: "public-html-best-effort",
      },
      { status: configured && enabled ? 200 : 503, headers },
    );
  }
  if (url.pathname !== "/api/profile-picture")
    return reply(404, "route_not_found");
  const input = url.searchParams.get("username");
  const username = normalizeUsername(input);
  if (!username || !input || input.length > 200)
    return reply(400, "invalid_request");
  // Fail closed when the deployment does not provide the edge rate limiter.
  if (!configured || !env.RATE_LIMITER)
    return reply(503, "service_not_configured");
  if (!enabled) return reply(503, "lookup_disabled");
  try {
    const limit = await env.RATE_LIMITER.limit({
      key: request.headers.get("CF-Connecting-IP") ?? "unknown",
    });
    if (!limit.success) return reply(429, "request_rate_limited");
  } catch {
    return reply(503, "service_unavailable");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetcher(`https://www.instagram.com/${username}/`, {
      headers: {
        Accept: "text/html",
        "User-Agent": "InstaScope/0.1 (public profile preview)",
      },
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (upstream.status === 429) return reply(429, "instagram_rate_limited");
    if (upstream.status >= 500) return reply(502, "upstream_unavailable");
    if (
      !upstream.ok ||
      !upstream.headers.get("content-type")?.includes("text/html") ||
      !upstream.body
    )
      return reply(404, "profile_unavailable");
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let html = "",
      size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        return reply(502, "upstream_unavailable");
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    const imageUrl = extractPublicImage(html, username);
    if (!imageUrl) return reply(404, "profile_unavailable");
    return Response.json(
      { username, imageUrl },
      {
        headers,
      },
    );
  } catch {
    return reply(
      controller.signal.aborted ? 504 : 502,
      controller.signal.aborted ? "lookup_timeout" : "upstream_unavailable",
    );
  } finally {
    clearTimeout(timer);
  }
}
// Cloudflare passes ExecutionContext as the third argument; do not confuse it with
// the injectable fetch implementation used by the unit tests.
const worker = {
  fetch: (request: Request, env: ProfileEnv) => handleProfile(request, env),
};
export default worker;
