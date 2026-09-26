import { events } from "../src/lib/analytics";
type Env = {
  EVENTS: {
    writeDataPoint: (data: { blobs: string[]; doubles: number[] }) => void;
  };
  RATE_LIMITER: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
};
export async function handleAnalytics(
  request: Request,
  env: Env,
): Promise<Response> {
  const reply = (status: number) =>
    new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return reply(405);
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    return reply(403);
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    return reply(415);
  if (!env.RATE_LIMITER || !env.EVENTS) return reply(503);
  if (
    !(
      await env.RATE_LIMITER.limit({
        key: request.headers.get("CF-Connecting-IP") ?? "unknown",
      })
    ).success
  )
    return reply(429);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  let text = "",
    size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 100) {
      await reader.cancel();
      return reply(413);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    const payload = JSON.parse(text);
    if (
      !payload ||
      typeof payload !== "object" ||
      Object.keys(payload).length !== 1 ||
      !events.includes(payload.event)
    )
      return reply(400);
    env.EVENTS.writeDataPoint({ blobs: [payload.event], doubles: [1] });
    return reply(204);
  } catch {
    return reply(400);
  }
}
const worker = { fetch: handleAnalytics };
export default worker;
