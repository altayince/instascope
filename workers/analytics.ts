import {
  isTrafficSource,
  isWebdriverHint,
  type TrafficSource,
  type WebdriverHint,
} from "../src/lib/analytics-context";
import { isProductEvent, type ProductEvent } from "../src/lib/analytics-events";
import { classifyUserAgent } from "./analytics-ua";

export type AnalyticsEnv = {
  EVENTS?: {
    writeDataPoint: (data: { blobs: string[]; doubles: number[] }) => void;
  };
  RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
};
const maximumBodyBytes = 100;
type Envelope = {
  event: ProductEvent;
  source: TrafficSource | "legacy";
  webdriver: WebdriverHint | "legacy";
};

function parseEnvelope(text: string): Envelope | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return;
  const fields = value as Record<string, unknown>;
  // Replace complete JSON strings before checking the original flat shape:
  // JSON.parse could otherwise hide a nested value overwritten by a duplicate.
  const tokens: string[] = [];
  const structure = text.replace(/"(?:\\.|[^"\\])*"/g, (token) => {
    tokens.push(token);
    return "s";
  });
  if (!/^\s*\{\s*s\s*:\s*s(?:\s*,\s*s\s*:\s*s)*\s*\}\s*$/.test(structure))
    return;
  // The validated shape has alternating key/value string tokens. Decode keys
  // before rejecting duplicates, including escaped aliases like "ev\u0065nt".
  const rawKeys = tokens
    .filter((_, index) => index % 2 === 0)
    .map((key) => JSON.parse(key) as string);
  if (new Set(rawKeys).size !== rawKeys.length) return;
  const keys = Object.keys(fields);
  if (!isProductEvent(fields.event)) return;
  if (keys.length === 1 && keys[0] === "event")
    return { event: fields.event, source: "legacy", webdriver: "legacy" };
  if (
    keys.length === 3 &&
    keys.every(
      (key) => key === "event" || key === "source" || key === "webdriver",
    ) &&
    isTrafficSource(fields.source) &&
    isWebdriverHint(fields.webdriver)
  )
    return {
      event: fields.event,
      source: fields.source,
      webdriver: fields.webdriver,
    };
}

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
  const envelope = parseEnvelope(text);
  if (!envelope) return reply(400);
  try {
    // No index, request metadata, account data, or identifier is persisted.
    env.EVENTS.writeDataPoint({
      blobs: [
        envelope.event,
        envelope.source,
        envelope.webdriver,
        classifyUserAgent(request.headers.get("User-Agent")),
      ],
      doubles: [1],
    });
    return reply(204);
  } catch {
    return reply(503);
  }
}
const worker = { fetch: handleAnalytics };
export default worker;
