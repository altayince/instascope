import { afterEach, describe, expect, it, vi } from "vitest";
import { events } from "../../src/lib/analytics-events";
import { handleAnalytics, type AnalyticsEnv } from "../../workers/analytics";

const endpoint = "https://instascope.test/api/events";
const payload = JSON.stringify({ event: "parser_started" });
function configured() {
  return {
    EVENTS: {
      writeDataPoint:
        vi.fn<(point: { blobs: string[]; doubles: number[] }) => void>(),
    },
    RATE_LIMITER: {
      limit: vi.fn<(options: { key: string }) => Promise<{ success: boolean }>>(
        async () => ({ success: true }),
      ),
    },
  };
}
function request(
  body: BodyInit | null = payload,
  overrides: RequestInit & { duplex?: "half" } = {},
  url = endpoint,
) {
  const headers = new Headers({
    Origin: "https://instascope.test",
    "Content-Type": "application/json",
  });
  new Headers(overrides.headers).forEach((value, name) =>
    headers.set(name, value),
  );
  return new Request(url, {
    method: "POST",
    body,
    ...overrides,
    headers,
  });
}
async function status(
  input: Request,
  expected: number,
  env: AnalyticsEnv = configured(),
) {
  const response = await handleAnalytics(input, env);
  expect(response.status).toBe(expected);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  expect(await response.text()).toBe("");
  return response;
}
afterEach(() => vi.restoreAllMocks());

describe("first-party aggregate analytics Worker", () => {
  it.each(events)("stores only the event and count for %s", async (event) => {
    const env = configured();
    await status(request(JSON.stringify({ event })), 204, env);
    expect(env.EVENTS.writeDataPoint.mock.calls).toEqual([
      [{ blobs: [event], doubles: [1] }],
    ]);
  });

  it("allows JSON whitespace without accepting duplicate raw keys", async () => {
    const env = configured();
    await status(request(' \n { "event" : "parser_started" } \t '), 204, env);
    await status(
      request('{"event":"parser_started","event":"parser_succeeded"}'),
      400,
      env,
    );
    expect(env.EVENTS.writeDataPoint).toHaveBeenCalledTimes(1);
  });

  it.each([
    "null",
    "[]",
    "{}",
    '"parser_started"',
    '{"event":["parser_started"]}',
    '{"event":null}',
    '{"event":1}',
    '{"event":true}',
    '{"event":"unknown_event"}',
    '{"event":"parser_started","username":"synthetic.private"}',
    '{"other":"parser_started"}',
    '{"event":"parser_started",}',
    '{"event":"parser_started"',
    '\u00a0{"event":"parser_started"}',
  ])("rejects malformed or non-allowlisted envelopes: %s", async (body) => {
    const env = configured();
    await status(request(body), 400, env);
    expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it.each(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"])(
    "rejects %s without CORS widening",
    async (method) => {
      const env = configured();
      const response = await status(request(null, { method }), 405, env);
      expect(response.headers.get("Allow")).toBe("POST");
      expect(env.RATE_LIMITER.limit).not.toHaveBeenCalled();
      expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
    },
  );

  it.each([
    "https://other.test",
    "https://instascope.test.evil.test",
    "http://instascope.test",
    "https://preview.instascope.test",
    "null",
    "",
  ])("rejects a nonmatching Origin %s", async (origin) => {
    const env = configured();
    await status(request(payload, { headers: { Origin: origin } }), 403, env);
    expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("requires Origin even when browser metadata says same-origin", async () => {
    const input = request(payload, {
      headers: { "Sec-Fetch-Site": "same-origin" },
    });
    input.headers.delete("Origin");
    await status(input, 403);
  });

  it.each<Record<string, string>>([
    { "Sec-Fetch-Site": "cross-site" },
    { "Sec-Fetch-Site": "same-site" },
    { "Sec-Fetch-Site": "none" },
    { "Sec-Fetch-Mode": "navigate" },
    { "Sec-Fetch-Mode": "no-cors" },
    { "Sec-Fetch-Dest": "document" },
    { "Sec-Fetch-Dest": "image" },
  ])("rejects incompatible Fetch Metadata %j", async (headers) => {
    const env = configured();
    await status(request(payload, { headers }), 403, env);
    expect(env.RATE_LIMITER.limit).not.toHaveBeenCalled();
    expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("accepts normal browser metadata and omitted legacy metadata", async () => {
    const env = configured();
    await status(
      request(payload, {
        headers: {
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Dest": "empty",
        },
      }),
      204,
      env,
    );
    await status(request(), 204, env);
    expect(env.EVENTS.writeDataPoint).toHaveBeenCalledTimes(2);
  });

  it.each([
    "https://instascope.test/api/events/",
    "https://instascope.test/api/events-other",
    "https://instascope.test/api/events?username=synthetic.private",
  ])("rejects endpoint aliases or query metadata: %s", async (url) => {
    await status(request(payload, {}, url), 400);
  });

  it.each([
    "text/plain",
    "application/jsonp",
    "application/json-extra",
    "application/json, text/plain",
    "",
  ])("requires exact JSON media type: %s", async (contentType) => {
    await status(
      request(payload, { headers: { "Content-Type": contentType } }),
      415,
    );
  });

  it("accepts the JSON media type with a charset parameter", async () => {
    await status(
      request(payload, {
        headers: { "Content-Type": "Application/JSON; charset=utf-8" },
      }),
      204,
    );
  });

  it("honors DNT before reading, limiting, or storing an event", async () => {
    const env = configured();
    await status(request(payload, { headers: { DNT: "1" } }), 204, env);
    expect(env.RATE_LIMITER.limit).not.toHaveBeenCalled();
    expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
    await status(request(payload, { headers: { DNT: "1" } }), 204, {});
  });

  it("caps declared body size without reading it or consuming a rate token", async () => {
    const env = configured();
    await status(
      request(payload, { headers: { "Content-Length": "101" } }),
      413,
      env,
    );
    expect(env.RATE_LIMITER.limit).not.toHaveBeenCalled();
    expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it.each(["-1", "not-a-number", "1.5"])(
    "rejects malformed Content-Length %s",
    async (length) => {
      await status(
        request(payload, { headers: { "Content-Length": length } }),
        400,
      );
    },
  );

  it("allows 100 bytes and rejects 101 regardless of a false small length", async () => {
    const env = configured();
    const hundred = payload.padEnd(100, " ");
    await status(request(hundred), 204, env);
    await status(
      request(`${hundred} `, { headers: { "Content-Length": "1" } }),
      413,
      env,
    );
    expect(env.EVENTS.writeDataPoint).toHaveBeenCalledTimes(1);
  });

  it("limits chunked bodies by UTF-8 bytes and cancels oversized input", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode(payload),
      encoder.encode("\u00a0".repeat(40)),
    ];
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk) controller.enqueue(chunk);
      },
      cancel,
    });
    const env = configured();
    await status(request(stream, { duplex: "half" }), 413, env);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("preserves valid input split across stream chunks", async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(payload);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 11));
        controller.enqueue(bytes.slice(11));
        controller.close();
      },
    });
    await status(request(stream, { duplex: "half" }), 204);
  });

  it("rejects missing bodies, read failures, and malformed UTF-8 without throwing", async () => {
    const env = configured();
    await status(request(null), 400, env);
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("synthetic unreadable body"));
      },
    });
    await status(request(broken, { duplex: "half" }), 400, env);
    await status(request(new Uint8Array([0xff, 0xfe])), 400, env);
    expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("rejects an already locked body instead of throwing", async () => {
    const input = request();
    const reader = input.body!.getReader();
    const env = configured();
    try {
      await status(input, 400, env);
      expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
    } finally {
      reader.releaseLock();
    }
  });

  it("returns 503 for missing or invalid methods on infrastructure bindings", async () => {
    const env = configured();
    for (const bindings of [
      {},
      { EVENTS: env.EVENTS },
      { RATE_LIMITER: env.RATE_LIMITER },
      { ...env, EVENTS: {} },
      { ...env, RATE_LIMITER: {} },
    ])
      await status(request(), 503, bindings as AnalyticsEnv);
    expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("rate limits with a transient edge IP key but never stores it", async () => {
    const env = configured();
    const headers = {
      "CF-Connecting-IP": "192.0.2.10",
      "User-Agent": "synthetic browser",
      Cookie: "synthetic=private",
      Referer: "https://instascope.test/private-context/",
    };
    await status(request(payload, { headers }), 204, env);
    expect(env.RATE_LIMITER.limit).toHaveBeenCalledWith({ key: "192.0.2.10" });
    expect(env.EVENTS.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["parser_started"],
      doubles: [1],
    });
    env.RATE_LIMITER.limit.mockResolvedValueOnce({ success: false });
    await status(request(payload, { headers }), 429, env);
    expect(env.EVENTS.writeDataPoint).toHaveBeenCalledTimes(1);
  });

  it("uses a shared fallback rate key when no edge IP is supplied", async () => {
    const env = configured();
    await status(request(), 204, env);
    expect(env.RATE_LIMITER.limit).toHaveBeenCalledWith({ key: "unknown" });
  });

  it("isolates binding failures as 503 and never logs request data", async () => {
    const log = vi.spyOn(console, "log"),
      warn = vi.spyOn(console, "warn"),
      error = vi.spyOn(console, "error");
    const env = configured();
    env.RATE_LIMITER.limit.mockRejectedValueOnce(
      new Error("synthetic limiter unavailable"),
    );
    await status(request(), 503, env);
    expect(env.EVENTS.writeDataPoint).not.toHaveBeenCalled();
    env.EVENTS.writeDataPoint.mockImplementationOnce(() => {
      throw new Error("synthetic writer unavailable");
    });
    await status(request(), 503, env);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
