import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsEndpoint } from "../../src/lib/analytics-config";
import { events, isProductEvent } from "../../src/lib/analytics-events";
import {
  observeDocumentEntry,
  track,
  trackOnce,
} from "../../src/lib/analytics";

const fetcher = vi.fn<typeof fetch>();
let localEvents: unknown[];
let syntheticDocument: { referrer: string };

beforeEach(() => {
  const browser = new EventTarget();
  localEvents = [];
  browser.addEventListener("instascope:event", (event) => {
    localEvents.push((event as CustomEvent).detail);
  });
  vi.stubGlobal("window", browser);
  syntheticDocument = { referrer: "" };
  vi.stubGlobal("document", syntheticDocument);
  vi.stubGlobal("navigator", { doNotTrack: "0", webdriver: false });
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "/api/events");
  fetcher.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("bounded client analytics", () => {
  it("has a unique restrained allowlist and rejects unknown or non-string events", () => {
    expect(events).toHaveLength(27);
    expect(new Set(events).size).toBe(events.length);
    for (const event of events) expect(isProductEvent(event)).toBe(true);
    for (const invalid of ["synthetic.private", "", {}, null, undefined, 1]) {
      expect(isProductEvent(invalid)).toBe(false);
      track(invalid as never);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(localEvents).toEqual([]);
  });

  it("transmits the exact bounded envelope with omitted credentials/referrer and no redirects", () => {
    track("parser_started");
    expect(localEvents).toEqual([{ event: "parser_started" }]);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/events", {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: '{"event":"parser_started","source":"none","webdriver":"no"}',
      keepalive: true,
      redirect: "error",
    });
  });

  it("does not accept metadata in its typed API or serialize runtime extra arguments", () => {
    // @ts-expect-error The public contract accepts one event and no metadata.
    track("parser_started", { username: "synthetic.private", count: 12 });
    expect(fetcher.mock.calls[0][1]?.body).toBe(
      '{"event":"parser_started","source":"none","webdriver":"no"}',
    );
    expect(localEvents).toEqual([{ event: "parser_started" }]);
  });

  it.each(["1", "yes"])("DNT=%s prevents remote delivery", (doNotTrack) => {
    vi.stubGlobal("navigator", { doNotTrack });
    track("parser_succeeded");
    expect(fetcher).not.toHaveBeenCalled();
    expect(localEvents).toEqual([{ event: "parser_succeeded" }]);
  });

  it.each([
    [true, "yes"],
    [false, "no"],
    [undefined, "unknown"],
    [null, "unknown"],
    ["true", "unknown"],
  ])(
    "derives the webdriver hint only from navigator.webdriver: %#",
    (webdriver, expected) => {
      vi.stubGlobal("navigator", { doNotTrack: "0", webdriver });
      track("profile_search");
      expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({
        event: "profile_search",
        source: "none",
        webdriver: expected,
      });
    },
  );

  it.each([
    [
      "https://www.google.de/search?q=synthetic-private-search#private",
      "google",
    ],
    [
      "https://synthetic-private-host.test/private/path?q=private#fragment",
      "external",
    ],
    ["https://instascope.me/private/path?q=private", "same_site"],
  ])(
    "never includes a referrer, hostname, URL, query, or UA in a payload: %#",
    (referrer, source) => {
      syntheticDocument.referrer = referrer;
      const readUserAgent = vi.fn(() => {
        throw new Error("UA must not be read");
      });
      vi.stubGlobal("navigator", {
        doNotTrack: "0",
        webdriver: true,
        get userAgent() {
          return readUserAgent();
        },
      });
      track("profile_search");
      expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({
        event: "profile_search",
        source,
        webdriver: "yes",
      });
      expect(fetcher.mock.calls[0][1]?.body).not.toMatch(
        /synthetic|private|https|query|fragment/,
      );
      expect(readUserAgent).not.toHaveBeenCalled();
      expect(localEvents).toEqual([{ event: "profile_search" }]);
    },
  );

  it("captures referrer and webdriver once for the whole document, including SPA events", () => {
    const readReferrer = vi.fn(
      () => "https://news.google.co.uk/private?q=synthetic",
    );
    const readWebdriver = vi.fn(() => true);
    vi.stubGlobal("document", {
      get referrer() {
        return readReferrer();
      },
    });
    vi.stubGlobal("navigator", {
      doNotTrack: "0",
      get webdriver() {
        return readWebdriver();
      },
    });
    track("profile_search");
    readReferrer.mockReturnValue("https://synthetic-external.test/");
    readWebdriver.mockReturnValue(false);
    track("profile_failed");
    track("parser_started");
    expect(readReferrer).toHaveBeenCalledTimes(1);
    expect(readWebdriver).toHaveBeenCalledTimes(1);
    expect(
      fetcher.mock.calls.map(([, request]) =>
        JSON.parse(request?.body as string),
      ),
    ).toEqual([
      { event: "profile_search", source: "google", webdriver: "yes" },
      { event: "profile_failed", source: "google", webdriver: "yes" },
      { event: "parser_started", source: "google", webdriver: "yes" },
    ]);
  });

  it.each(["DNT", "disabled endpoint"])(
    "captures context even when the first event is suppressed by %s",
    (suppression) => {
      syntheticDocument.referrer = "https://www.bing.com/private?q=synthetic";
      if (suppression === "DNT")
        vi.stubGlobal("navigator", { doNotTrack: "1", webdriver: true });
      else vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "off");
      track("profile_search");
      expect(fetcher).not.toHaveBeenCalled();
      syntheticDocument.referrer = "https://synthetic-external.test/";
      vi.stubGlobal("navigator", { doNotTrack: "0", webdriver: false });
      vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "/api/events");
      track("profile_failed");
      expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({
        event: "profile_failed",
        source: "bing",
        webdriver: suppression === "DNT" ? "yes" : "no",
      });
    },
  );

  it("captures a fresh source and webdriver hint for a new document", () => {
    syntheticDocument.referrer = "https://www.google.com/";
    track("parser_started");
    vi.stubGlobal("document", { referrer: "https://www.qwant.com/" });
    vi.stubGlobal("navigator", { doNotTrack: "0", webdriver: true });
    track("parser_started");
    expect(
      fetcher.mock.calls.map(([, request]) =>
        JSON.parse(request?.body as string),
      ),
    ).toEqual([
      { event: "parser_started", source: "google", webdriver: "no" },
      { event: "parser_started", source: "search_other", webdriver: "yes" },
    ]);
  });

  it("reduces an inaccessible referrer to unknown without discarding the webdriver hint", () => {
    vi.stubGlobal("document", {
      get referrer() {
        throw new Error("Synthetic restricted referrer");
      },
    });
    track("parser_started");
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({
      event: "parser_started",
      source: "unknown",
      webdriver: "no",
    });
  });

  it("reduces an inaccessible webdriver flag to unknown without discarding the source", () => {
    syntheticDocument.referrer = "https://www.google.de/";
    vi.stubGlobal("navigator", {
      doNotTrack: "0",
      get webdriver() {
        throw new Error("Synthetic restricted webdriver");
      },
    });
    track("parser_started");
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({
      event: "parser_started",
      source: "google",
      webdriver: "unknown",
    });
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

describe("document entry observation", () => {
  it("keeps direct allowlisted calls subject to the same document guard", () => {
    track("document_entry_observed");
    observeDocumentEntry();
    track("document_entry_observed");
    expect(localEvents).toEqual([{ event: "document_entry_observed" }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("emits once across repeated initializers, StrictMode, remounts, and SPA transitions", () => {
    syntheticDocument.referrer = "https://www.google.de/private?q=synthetic";
    observeDocumentEntry();
    observeDocumentEntry();
    syntheticDocument.referrer = "https://instascope.me/next-spa-route/";
    observeDocumentEntry();
    track("parser_started");
    expect(localEvents).toEqual([
      { event: "document_entry_observed" },
      { event: "parser_started" },
    ]);
    expect(
      fetcher.mock.calls.map(([, request]) =>
        JSON.parse(request?.body as string),
      ),
    ).toEqual([
      { event: "document_entry_observed", source: "google", webdriver: "no" },
      { event: "parser_started", source: "google", webdriver: "no" },
    ]);
  });

  it("emits again for a full reload represented by a new document", () => {
    observeDocumentEntry();
    vi.stubGlobal("document", { referrer: "https://www.bing.com/" });
    observeDocumentEntry();
    observeDocumentEntry();
    expect(localEvents).toEqual([
      { event: "document_entry_observed" },
      { event: "document_entry_observed" },
    ]);
    expect(
      fetcher.mock.calls.map(([, request]) =>
        JSON.parse(request?.body as string),
      ),
    ).toEqual([
      { event: "document_entry_observed", source: "none", webdriver: "no" },
      { event: "document_entry_observed", source: "bing", webdriver: "no" },
    ]);
  });

  it.each(["1", "yes"])(
    "suppresses remote observation under DNT=%s and does not retry it",
    (doNotTrack) => {
      syntheticDocument.referrer = "https://www.google.de/";
      vi.stubGlobal("navigator", { doNotTrack, webdriver: true });
      observeDocumentEntry();
      vi.stubGlobal("navigator", { doNotTrack: "0", webdriver: false });
      syntheticDocument.referrer = "https://www.bing.com/";
      observeDocumentEntry();
      expect(fetcher).not.toHaveBeenCalled();
      expect(localEvents).toEqual([{ event: "document_entry_observed" }]);
      track("profile_search");
      expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({
        event: "profile_search",
        source: "google",
        webdriver: "yes",
      });
    },
  );

  it("keeps preview/local delivery disabled through the existing endpoint configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", undefined);
    observeDocumentEntry();
    observeDocumentEntry();
    expect(fetcher).not.toHaveBeenCalled();
    expect(localEvents).toEqual([{ event: "document_entry_observed" }]);
  });

  it("does not use browser storage or cookies for attribution or duplicate guards", () => {
    const accessStorage = vi.fn(() => {
      throw new Error("Analytics must not use browser storage");
    });
    const storage = {
      getItem: accessStorage,
      setItem: accessStorage,
      removeItem: accessStorage,
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("indexedDB", { open: accessStorage });
    Object.defineProperty(syntheticDocument, "cookie", {
      get: accessStorage,
      set: accessStorage,
    });
    observeDocumentEntry();
    observeDocumentEntry();
    track("profile_search");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(accessStorage).not.toHaveBeenCalled();
  });

  it("is safe during SSR without marking a document observed", () => {
    const browser = window;
    vi.stubGlobal("window", undefined);
    expect(() => observeDocumentEntry()).not.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubGlobal("window", browser);
    observeDocumentEntry();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(localEvents).toEqual([{ event: "document_entry_observed" }]);
  });

  it("requires a browser document without marking presentation events on an incomplete server global", () => {
    const dataset = {};
    vi.stubGlobal("document", undefined);
    expect(() => track("parser_started")).not.toThrow();
    expect(() => trackOnce("results_viewed", dataset)).not.toThrow();
    expect(() => observeDocumentEntry()).not.toThrow();
    expect(localEvents).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubGlobal("document", syntheticDocument);
    trackOnce("results_viewed", dataset);
    observeDocumentEntry();
    expect(fetcher).toHaveBeenCalledTimes(2);
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
