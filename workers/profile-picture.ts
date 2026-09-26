import { parseDocument } from "htmlparser2";
import { findAll } from "domutils";
import { normalizeUsername } from "../src/lib/instagram/normalize";

export type ProfileEnv = {
  RATE_LIMITER: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
  ENABLE_PUBLIC_LOOKUP?: string;
};
const reply = (status: number, message: string) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
export function extractPublicImage(html: string, username: string): string | null {
  const document = parseDocument(html);
  const metas = findAll(node => node.name === "meta", document.children);
  const title = metas.find(node => node.attribs.property === "og:title")?.attribs.content ?? "";
  // Avoid returning the Instagram logo, login image, or a suggested account's photo.
  if (!title.toLowerCase().includes(`(@${username})`)) return null;
  const raw = metas.find(node => node.attribs.property === "og:image")?.attribs.content;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname) ? url.href : null;
  } catch { return null; }
}
export async function handleProfile(request: Request, env: ProfileEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== "GET") return reply(405, "Only GET is supported.");
  const input = new URL(request.url).searchParams.get("username");
  const username = normalizeUsername(input);
  if (!username || !input || input.length > 200) return reply(400, "Invalid Instagram username.");
  // Fail closed when the deployment does not provide the edge rate limiter.
  if (!env.RATE_LIMITER) return reply(503, "Photo lookup is not configured.");
  const limit = await env.RATE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
  if (!limit.success) return reply(429, "Wait a minute before trying again.");
  if (env.ENABLE_PUBLIC_LOOKUP !== "true") return reply(503, "Public lookup is not enabled.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetcher(`https://www.instagram.com/${username}/`, {
      headers: { "Accept": "text/html", "User-Agent": "InstaScope/0.1 (public profile preview)" },
      redirect: "manual", signal: controller.signal,
    });
    if (upstream.status === 429) return reply(429, "Instagram is temporarily limiting public lookups.");
    if (!upstream.ok || !upstream.headers.get("content-type")?.includes("text/html") || !upstream.body) return reply(502, "Instagram did not provide a public profile page.");
    const reader = upstream.body.getReader(); const decoder = new TextDecoder();
    let html = "", size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) { await reader.cancel(); return reply(502, "The public response could not be read safely."); }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    const imageUrl = extractPublicImage(html, username);
    if (!imageUrl) return reply(404, "No verifiable public profile photo is available.");
    return Response.json({ username, imageUrl }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return reply(502, "Public lookup is unavailable. Try again later."); }
  finally { clearTimeout(timer); }
}
// Cloudflare passes ExecutionContext as the third argument; do not confuse it with
// the injectable fetch implementation used by the unit tests.
const worker = { fetch: (request: Request, env: ProfileEnv) => handleProfile(request, env) };
export default worker;
