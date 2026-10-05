import { afterEach, expect, it, vi } from "vitest";
import {
  extractPublicImage,
  handleProfile,
} from "../../workers/profile-picture";
import {
  profileEndpoint,
  profileErrorMessage,
  verifiedPublicImageUrl,
} from "../../src/lib/profile-lookup";
const limiter = { limit: vi.fn(async () => ({ success: true })) };
const browser = {
  quickAction: vi.fn(async () =>
    Response.json({
      success: true,
      result: "<html>Log in</html>",
      meta: {
        status: 200,
        finalUrl: "https://www.instagram.com/sample.account/",
      },
    }),
  ),
};
const env = {
  RATE_LIMITER: limiter,
  ENABLE_PUBLIC_LOOKUP: "true",
  BROWSER: browser,
};
const request = (query = "username=sample.account") =>
  new Request(`https://instascope.test/api/profile-picture?${query}`);
// Synthetic fields follow the observed public HTML, including decimal/hex entities.
const html =
  '<meta property="og:image" content="https://scontent-synthetic.cdninstagram.com/photo.jpg?a=1&amp;b=2"><meta property="og:title" content="Sample (&#064;sample.account) &#x2022; Instagram photos and videos"><meta property="og:url" content="https://www.instagram.com/sample.account/">';
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("reads current public OpenGraph structure and legacy title-only metadata", () => {
  expect(extractPublicImage(html, "sample.account")).toBe(
    "https://scontent-synthetic.cdninstagram.com/photo.jpg?a=1&b=2",
  );
  expect(
    extractPublicImage(
      html.replace(/<meta property="og:url"[^>]+>/, ""),
      "sample.account",
    ),
  ).not.toBeNull();
  expect(
    extractPublicImage(
      html.replace("sample.account)", "someone.else)"),
      "sample.account",
    ),
  ).toBeNull();
  expect(
    extractPublicImage(
      html.replace(
        "https://www.instagram.com/sample.account/",
        "https://www.instagram.com/another.account/",
      ),
      "sample.account",
    ),
  ).toBeNull();
  expect(
    extractPublicImage(
      html.replace(
        "https://www.instagram.com/sample.account/",
        "https://evil.test/sample.account/",
      ),
      "sample.account",
    ),
  ).toBeNull();
  expect(
    extractPublicImage(
      html +
        '<meta property="og:image" content="https://a.fbcdn.net/other.jpg">',
      "sample.account",
    ),
  ).toBeNull();
  expect(
    extractPublicImage(
      '<meta property="og:title" content="Instagram"><meta property="og:image" content="https://a.fbcdn.net/logo.jpg">',
      "sample.account",
    ),
  ).toBeNull();
});
it.each([
  "http://a.fbcdn.net/photo.jpg",
  "https://cdninstagram.com.evil.test/photo.jpg",
  "https://evilcdninstagram.com/photo.jpg",
  "https://127.0.0.1/photo.jpg",
  "https://u:p@a.fbcdn.net/photo.jpg",
  "https://a.fbcdn.net:8443/photo.jpg",
  "data:image/png;base64,AA==",
])(
  "rejects untrusted photo destination %s in both shared and HTML validation",
  (url) => {
    expect(verifiedPublicImageUrl(url)).toBeNull();
    expect(
      extractPublicImage(
        html.replace(/https:\/\/scontent-synthetic[^\"]+/, url),
        "sample.account",
      ),
    ).toBeNull();
  },
);
it("health exposes only readiness and never contacts Instagram or consumes the rate limiter", async () => {
  const fetcher = vi.fn<typeof fetch>();
  for (const [config, status, expected] of [
    [{}, 503, "not_configured"],
    [{ RATE_LIMITER: limiter, BROWSER: browser }, 503, "disabled"],
    [
      { RATE_LIMITER: limiter, ENABLE_PUBLIC_LOOKUP: "true" },
      503,
      "not_configured",
    ],
    [env, 200, "ready"],
  ] as const) {
    const response = await handleProfile(
      new Request("https://instascope.test/api/profile-picture/health"),
      config,
      fetcher,
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      service: "instascope-profile-picture",
      status: expected,
      configured: !!config.RATE_LIMITER && !!config.BROWSER,
      browserConfigured: !!config.BROWSER,
      enabled: config.ENABLE_PUBLIC_LOOKUP === "true",
      capability: "public-html-best-effort",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  expect(fetcher).not.toHaveBeenCalled();
  expect(limiter.limit).not.toHaveBeenCalled();
  expect(browser.quickAction).not.toHaveBeenCalled();
});
it("invalid inputs, paths, disabled lookup and missing/broken limiter never reach the upstream", async () => {
  const fetcher = vi.fn<typeof fetch>();
  for (const query of [
    "",
    "username=bad%20name",
    "username=https://evil.test/",
    "username=p",
    `username=${"a".repeat(201)}`,
  ])
    expect((await handleProfile(request(query), env, fetcher)).status).toBe(
      400,
    );
  expect(
    (
      await handleProfile(
        new Request(
          "https://test/api/profile-picture-extra?username=sample.account",
        ),
        env,
        fetcher,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await handleProfile(
        new Request(request().url, { method: "POST" }),
        env,
        fetcher,
      )
    ).status,
  ).toBe(405);
  expect((await handleProfile(request(), {}, fetcher)).status).toBe(503);
  expect(
    (await handleProfile(request(), { RATE_LIMITER: limiter }, fetcher)).status,
  ).toBe(503);
  const response = await handleProfile(
    request(),
    {
      ...env,
      RATE_LIMITER: {
        limit: async () => {
          throw new Error("secret infrastructure failure");
        },
      },
    },
    fetcher,
  );
  expect(await response.json()).toMatchObject({ code: "service_unavailable" });
  expect(fetcher).not.toHaveBeenCalled();
});
it("builds a fixed credential-free Instagram request and returns only verified photo data", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
  const response = await handleProfile(
    request("username=%40Sample.Account"),
    env,
    fetcher,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    username: "sample.account",
    imageUrl: "https://scontent-synthetic.cdninstagram.com/photo.jpg?a=1&b=2",
  });
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://www.instagram.com/sample.account/",
  );
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    redirect: "manual",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty("Cookie");
  expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
});
it.each([
  [302, 404, "profile_unavailable"],
  [403, 404, "profile_unavailable"],
  [404, 404, "profile_unavailable"],
  [429, 429, "instagram_rate_limited"],
  [503, 502, "upstream_unavailable"],
])("classifies upstream status %i safely", async (status, expected, code) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response("", {
      status,
      headers: {
        "content-type": "text/html",
        location: "https://evil.test/",
      },
    }),
  );
  const response = await handleProfile(request(), env, fetcher);
  expect(response.status).toBe(expected);
  expect(await response.json()).toMatchObject({ code });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("handles login HTML, non-HTML responses, oversized bodies and network failures safely", async () => {
  for (const upstream of [
    new Response("<html>Log in to Instagram</html>", {
      headers: { "content-type": "text/html" },
    }),
    new Response("{}", { headers: { "content-type": "application/json" } }),
  ]) {
    const response = await handleProfile(
      request(),
      env,
      vi.fn<typeof fetch>().mockResolvedValue(upstream),
    );
    expect(response.status).toBe(404);
  }
  const large = new Response("x".repeat(2 * 1024 * 1024 + 1), {
    headers: { "content-type": "text/html" },
  });
  expect(
    (
      await handleProfile(
        request(),
        env,
        vi.fn<typeof fetch>().mockResolvedValue(large),
      )
    ).status,
  ).toBe(502);
  const response = await handleProfile(
    request(),
    env,
    vi.fn<typeof fetch>().mockRejectedValue(new Error("private exception")),
  );
  expect(await response.text()).not.toContain("private exception");
});
it("enforces the eight-second upstream timeout", async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    );
  const pending = handleProfile(request(), env, fetcher);
  await vi.advanceTimersByTimeAsync(8000);
  const response = await pending;
  expect(response.status).toBe(504);
  expect(await response.json()).toMatchObject({ code: "lookup_timeout" });
});
it("enables the production endpoint at build time, allows explicit disable and rejects external configuration", () => {
  expect(profileEndpoint(undefined, true)).toBe("/api/profile-picture");
  expect(profileEndpoint(undefined, false)).toBe("");
  expect(profileEndpoint("", true)).toBe("");
  expect(profileEndpoint("//evil.test/api", true)).toBe("");
  expect(profileEndpoint("https://evil.test/api", true)).toBe("");
  expect(profileEndpoint("/api/profile-picture", false)).toBe(
    "/api/profile-picture",
  );
  expect(profileErrorMessage("raw backend error", 503)).not.toContain(
    "raw backend error",
  );
});
