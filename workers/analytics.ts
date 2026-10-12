import { isProductEvent } from "../src/lib/analytics-events";

export type AnalyticsEnv = {
  EVENTS?: {
    writeDataPoint: (data: { blobs: string[]; doubles: number[] }) => void;
  };
  RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
};
const maximumBodyBytes = 100;
const reply = (status: number) =>
  new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      ...(status === 405 ? { Allow: "POST" } : {}),
    },
  });

export async function handleAnalytics(
  request: Request,
  env: AnalyticsEnv,
): Promise<Response> {
  if (request.method !== "POST") return reply(405);
  const url = new URL(request.url);
  if (request.headers.get("Origin") !== url.origin) return reply(403);
  // Fetch Metadata is a small noise filter, not browser authentication. Keep
  // older browsers that omit these headers compatible; never fingerprint them.
  const site = request.headers.get("Sec-Fetch-Site"),
    mode = request.headers.get("Sec-Fetch-Mode"),
    destination = request.headers.get("Sec-Fetch-Dest");
  if (
    (site !== null && site !== "same-origin") ||
    (mode !== null && mode !== "cors" && mode !== "same-origin") ||
    (destination !== null && destination !== "empty")
  )
    return reply(403);
  if (url.pathname !== "/api/events" || url.search) return reply(400);
  if (
    request.headers
      .get("Content-Type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    return reply(415);
  // Defense in depth: the client normally avoids making a DNT request at all.
  if (request.headers.get("DNT") === "1") return reply(204);
  const length = request.headers.get("Content-Length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) return reply(400);
    if (Number(length) > maximumBodyBytes) return reply(413);
  }
  if (
    typeof env.RATE_LIMITER?.limit !== "function" ||
    typeof env.EVENTS?.writeDataPoint !== "function"
  )
    return reply(503);
  try {
    // This transient key is used only by the native limiter. It is never written
    // to Analytics Engine, included in a response, or intentionally logged.
    if (
      !(
        await env.RATE_LIMITER.limit({
          key: request.headers.get("CF-Connecting-IP") ?? "unknown",
        })
      ).success
    )
      return reply(429);
  } catch {
    return reply(503);
  }
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    reader = request.body?.getReader();
  } catch {
    return reply(400);
  }
  if (!reader) return reply(400);
  let text = "",
    size = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBodyBytes) {
        void reader.cancel().catch(() => {});
        return reply(413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return reply(400);
  } finally {
    reader.releaseLock();
  }
  try {
    JSON.parse(text);
  } catch {
    return reply(400);
  }
  // A narrow JSON envelope also rejects duplicate raw "event" keys, which
  // JSON.parse alone would silently collapse. The client emits plain ASCII names.
  const match = /^\s*\{\s*"event"\s*:\s*"([a-z_]+)"\s*\}\s*$/.exec(text);
  if (!match || !isProductEvent(match[1])) return reply(400);
  try {
    // No index, request metadata, account data, or identifier is persisted.
    env.EVENTS.writeDataPoint({ blobs: [match[1]], doubles: [1] });
    return reply(204);
  } catch {
    return reply(503);
  }
}
const worker = { fetch: handleAnalytics };
export default worker;
