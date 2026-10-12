import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsEndpoint } from "../../src/lib/analytics-config";
import { events, isProductEvent } from "../../src/lib/analytics-events";
import { track, trackOnce } from "../../src/lib/analytics";

const fetcher = vi.fn<typeof fetch>();
let localEvents: unknown[];

beforeEach(() => {
  const browser = new EventTarget();
  localEvents = [];
  browser.addEventListener("instascope:event", (event) => {
    localEvents.push((event as CustomEvent).detail);
  });
  vi.stubGlobal("window", browser);
  vi.stubGlobal("navigator", { doNotTrack: "0" });
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "/api/events");
  fetcher.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("event-only client analytics", () => {
  it("has a unique restrained allowlist and rejects unknown or non-string events", () => {
    expect(events).toHaveLength(26);
    expect(new Set(events).size).toBe(events.length);
    for (const event of events) expect(isProductEvent(event)).toBe(true);
    for (const invalid of ["synthetic.private", "", {}, null, undefined, 1]) {
      expect(isProductEvent(invalid)).toBe(false);
      track(invalid as never);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(localEvents).toEqual([]);
  });

  it("transmits only the event with omitted credentials/referrer and no redirects", () => {
    track("parser_started");
    expect(localEvents).toEqual([{ event: "parser_started" }]);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/events", {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: '{"event":"parser_started"}',
      keepalive: true,
      redirect: "error",
    });
  });

  it("does not accept metadata in its typed API or serialize runtime extra arguments", () => {
    // @ts-expect-error The public contract accepts one event and no metadata.
    track("parser_started", { username: "synthetic.private", count: 12 });
    expect(fetcher.mock.calls[0][1]?.body).toBe('{"event":"parser_started"}');
    expect(localEvents).toEqual([{ event: "parser_started" }]);
  });

  it.each(["1", "yes"])("DNT=%s prevents remote delivery", (doNotTrack) => {
    vi.stubGlobal("navigator", { doNotTrack });
    track("parser_succeeded");
    expect(fetcher).not.toHaveBeenCalled();
    expect(localEvents).toEqual([{ event: "parser_succeeded" }]);
  });

  it.each([
    undefined,
    "",
    "off",
    "https://instascope.me/api/events",
    "https://analytics.workers.dev/api/events",
    "//external.test/events",
    "api/events",
    "/api/events?username=synthetic.private",
    "/api/events#private",
    "/../events",
    "/%2f%2fexternal.test",
    "/\\external.test/events",
  ])("missing/invalid endpoint %s prevents remote delivery", (endpoint) => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", endpoint);
    track("parser_started");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not throw on synchronous, rejected or unsuccessful requests", async () => {
    fetcher.mockImplementationOnce(() => {
      throw new Error("Synthetic unavailable fetch");
    });
    expect(() => track("parser_started")).not.toThrow();
    fetcher.mockRejectedValueOnce(new Error("Synthetic network failure"));
    expect(() => track("parser_succeeded")).not.toThrow();
    await Promise.resolve();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect(() => track("results_viewed")).not.toThrow();
    expect(localEvents).toHaveLength(3);
  });

  it("does not send or mark presentation events on the server", () => {
    const dataset = {};
    vi.stubGlobal("window", undefined);
    expect(() => track("landing_viewed")).not.toThrow();
    trackOnce("results_viewed", dataset);
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubGlobal("window", new EventTarget());
    trackOnce("results_viewed", dataset);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("guards only presentation events per object, retaining separate imports and repeated actions", () => {
    const dataset = {};
    trackOnce("results_viewed", dataset);
    trackOnce("results_viewed", dataset);
    trackOnce("wrapped_generated", dataset);
    trackOnce("wrapped_generated", dataset);
    trackOnce("results_viewed", {});
    track("parser_started");
    track("parser_started");
    expect(localEvents).toEqual([
      { event: "results_viewed" },
      { event: "wrapped_generated" },
      { event: "results_viewed" },
      { event: "parser_started" },
      { event: "parser_started" },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});

it("production endpoint defaults and preview opt-in reuse a same-origin contract", () => {
  expect(analyticsEndpoint(undefined, true)).toBe("/api/events");
  expect(analyticsEndpoint(undefined, false)).toBe("");
  expect(analyticsEndpoint("/api/events", false)).toBe("/api/events");
  expect(analyticsEndpoint("/api/private-events", true)).toBe(
    "/api/private-events",
  );
  for (const value of [
    "",
    "off",
    "https://external.test/events",
    "//external.test/events",
  ])
    expect(analyticsEndpoint(value, true)).toBe("");
});
