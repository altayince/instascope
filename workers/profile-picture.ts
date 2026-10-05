import { parseDocument } from "htmlparser2";
import { findAll, textContent } from "domutils";
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
  BROWSER?: {
    quickAction: (
      action: "content",
      options: {
        url: string;
        allowRequestPattern: string[];
        setJavaScriptEnabled: false;
        gotoOptions: {
          timeout: number;
          waitUntil: "domcontentloaded";
          referrerPolicy: "no-referrer";
        };
      },
    ) => Promise<Response>;
  };
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
  const image = verifiedPublicImageUrl(images[0]);
  if (!image) return null;
  // Public server-rendered JSON can supply a larger avatar than og:image.
  // Accept only an unambiguous URL on a record identifying this same account;
  // do not execute scripts, call private APIs, or rewrite image dimensions.
  const avatars = new Set<string>();
  const scripts = findAll(
    (node) =>
      node.name === "script" && node.attribs.type === "application/json",
    document.children,
  );
  for (const script of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(textContent(script));
    } catch {
      continue;
    }
    const pending: unknown[] = [data];
    while (pending.length) {
      const node = pending.pop();
      if (!node || typeof node !== "object") continue;
      if (
        "username" in node &&
        normalizeUsername(node.username) === username &&
        "profile_pic_url" in node
      ) {
        const avatar = verifiedPublicImageUrl(node.profile_pic_url);
        if (avatar) avatars.add(avatar);
      }
      for (const child of Object.values(node)) {
        if (child && typeof child === "object") pending.push(child);
      }
    }
  }
  return avatars.size === 1 ? [...avatars][0] : image;
}

async function withAbort<T>(operation: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  let abort = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([operation, interrupted]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

async function readBounded(response: Response, signal: AbortSignal) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  while (true) {
    const { done, value } = await withAbort(reader.read(), signal);
    if (done) break;
    size += value.length;
    if (size > 2 * 1024 * 1024) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

const photoReply = (username: string, imageUrl: string) =>
  Response.json({ username, imageUrl }, { headers });

async function browserPhoto(
  username: string,
  env: ProfileEnv,
  signal: AbortSignal,
  deadline: number,
): Promise<Response> {
  const browser = env.BROWSER,
    limiter = env.RATE_LIMITER;
  if (!browser || typeof browser.quickAction !== "function" || !limiter)
    return reply(503, "service_not_configured");
  try {
    // Additional shared key limits browser usage per Cloudflare location.
    if (
      !(await withAbort(limiter.limit({ key: "profile-browser" }), signal))
        .success
    )
      return reply(429, "service_rate_limited");
    const url = `https://www.instagram.com/${username}/`;
    const response = await withAbort(
      browser.quickAction("content", {
        url,
        // Only this public document may load. Login/challenge redirects, scripts,
        // images and private API requests are not allowed; no cookies are supplied.
        allowRequestPattern: [
          `^${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        ],
        setJavaScriptEnabled: false,
        gotoOptions: {
          timeout: Math.max(1, deadline - Date.now()),
          waitUntil: "domcontentloaded",
          referrerPolicy: "no-referrer",
        },
      }),
      signal,
    );
    if (response.status === 429) return reply(429, "service_rate_limited");
    if (response.status === 400) return reply(404, "profile_unavailable");
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json")
    )
      return reply(503, "service_unavailable");
    const text = await readBounded(response, signal);
    if (text === null) return reply(503, "service_unavailable");
    const data: unknown = JSON.parse(text);
    if (
      !data ||
      typeof data !== "object" ||
      !("success" in data) ||
      data.success !== true ||
      !("result" in data) ||
      typeof data.result !== "string" ||
      !("meta" in data) ||
      !data.meta ||
      typeof data.meta !== "object" ||
      !("status" in data.meta) ||
      data.meta.status !== 200 ||
      !("finalUrl" in data.meta) ||
      data.meta.finalUrl !== url
    )
      return reply(404, "profile_unavailable");
    const image = extractPublicImage(data.result, username);
    return image
      ? photoReply(username, image)
      : reply(404, "profile_unavailable");
  } catch {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return reply(503, "service_unavailable");
  }
}
export async function handleProfile(
  request: Request,
  env: ProfileEnv,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "GET") return reply(405, "method_not_allowed");
  const url = new URL(request.url);
  const configured = typeof env.RATE_LIMITER?.limit === "function";
  const browserConfigured = typeof env.BROWSER?.quickAction === "function";
  const enabled = env.ENABLE_PUBLIC_LOOKUP === "true";
  if (url.pathname === "/api/profile-picture/health") {
    return Response.json(
      {
        service: "instascope-profile-picture",
        status:
          !configured || !browserConfigured
            ? "not_configured"
            : enabled
              ? "ready"
              : "disabled",
        configured: configured && browserConfigured,
        browserConfigured,
        enabled,
        capability: "public-html-best-effort",
      },
      {
        status: configured && browserConfigured && enabled ? 200 : 503,
        headers,
      },
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
  const deadline = Date.now() + 8000;
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
    if (!upstream.ok)
      return await browserPhoto(username, env, controller.signal, deadline);
    if (
      !upstream.headers.get("content-type")?.includes("text/html") ||
      !upstream.body
    )
      return reply(404, "profile_unavailable");
    const html = await readBounded(upstream, controller.signal);
    if (html === null) return reply(502, "upstream_unavailable");
    const imageUrl = extractPublicImage(html, username);
    if (!imageUrl)
      return await browserPhoto(username, env, controller.signal, deadline);
    return photoReply(username, imageUrl);
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
