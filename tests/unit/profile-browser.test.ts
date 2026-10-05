import { afterEach, expect, it, vi } from "vitest";
import {
  extractPublicImage,
  handleProfile,
  type ProfileEnv,
} from "../../workers/profile-picture";

const username = "sample.account";
const profile = `https://www.instagram.com/${username}/`;
const html =
  '<meta property="og:title" content="Example (&#064;sample.account)"><meta property="og:url" content="https://www.instagram.com/sample.account/"><meta property="og:image" content="https://synthetic.cdninstagram.com/photo.jpg">';
const request = () =>
  new Request(
    `https://instascope.test/api/profile-picture?username=${username}`,
  );
const blocked = () =>
  vi.fn<typeof fetch>().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: "https://www.instagram.com/accounts/login/" },
    }),
  );
const publicPage = (result = html, finalUrl = profile, status = 200) =>
  Response.json({ success: true, result, meta: { status, finalUrl } });
const config = (
  response: () => Promise<Response> = async () => publicPage(),
) => ({
  ENABLE_PUBLIC_LOOKUP: "true",
  RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
  BROWSER: { quickAction: vi.fn(response) },
});
afterEach(() => vi.useRealTimers());

it("prefers the explicit avatar URL on a matching public JSON record without inventing resolution", () => {
  const avatar = "https://synthetic.cdninstagram.com/profile.jpg?size=150";
  const script = (data: unknown) =>
    `<script type="application/json">${JSON.stringify(data)}</script>`;
  const matching = {
    require: [{ data: { user: { username, profile_pic_url: avatar } } }],
  };
  expect(extractPublicImage(html + script(matching), username)).toBe(avatar);
  expect(
    extractPublicImage(
      html + script({ username: "another.account", profile_pic_url: avatar }),
      username,
    ),
  ).toBe("https://synthetic.cdninstagram.com/photo.jpg");
  expect(
    extractPublicImage(
      html +
        script({ username, profile_pic_url: "https://evil.test/profile.jpg" }),
      username,
    ),
  ).toBe("https://synthetic.cdninstagram.com/photo.jpg");
  expect(
    extractPublicImage(
      html +
        script(matching) +
        script({
          username,
          profile_pic_url: "https://synthetic.cdninstagram.com/ambiguous.jpg",
        }),
      username,
    ),
  ).toBe("https://synthetic.cdninstagram.com/photo.jpg");
  expect(
    extractPublicImage(
      html + '<script type="application/json">malformed</script>',
      username,
    ),
  ).toBe("https://synthetic.cdninstagram.com/photo.jpg");
  expect(extractPublicImage(script(matching), username)).toBeNull();
});

it("falls back to an isolated public browser document and returns the verified image", async () => {
  const env = config();
  const response = await handleProfile(request(), env, blocked());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    username,
    imageUrl: "https://synthetic.cdninstagram.com/photo.jpg",
  });
  const [action, options] = env.BROWSER.quickAction.mock
    .calls[0] as unknown as [
    string,
    Parameters<NonNullable<ProfileEnv["BROWSER"]>["quickAction"]>[1],
  ];
  expect(action).toBe("content");
  expect(options.url).toBe(profile);
  expect(options.setJavaScriptEnabled).toBe(false);
  expect(options.gotoOptions).toMatchObject({
    waitUntil: "domcontentloaded",
    referrerPolicy: "no-referrer",
  });
  expect(options.gotoOptions.timeout).toBeGreaterThan(0);
  expect(options.gotoOptions.timeout).toBeLessThanOrEqual(8000);
  expect(Object.keys(options).sort()).toEqual([
    "allowRequestPattern",
    "gotoOptions",
    "setJavaScriptEnabled",
    "url",
  ]);
  const allowed = new RegExp(options.allowRequestPattern[0]);
  expect(allowed.test(profile)).toBe(true);
  for (const url of [
    "https://www.instagram.com/accounts/login/",
    "https://www.instagram.com/sampleXaccount/",
    `${profile}?redirect=elsewhere`,
    "https://evil.test/",
    "https://www.instagram.com/api/v1/",
    "https://www.instagram.com/other/",
  ])
    expect(allowed.test(url)).toBe(false);
  expect(env.RATE_LIMITER.limit.mock.calls).toEqual([
    [{ key: "unknown" }],
    [{ key: "profile-browser" }],
  ]);
});

it("keeps direct public HTML working without opening a browser", async () => {
  const env = config();
  const response = await handleProfile(
    request(),
    env,
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(html, { headers: { "content-type": "text/html" } }),
      ),
  );
  expect(response.status).toBe(200);
  expect(env.BROWSER.quickAction).not.toHaveBeenCalled();
  expect(env.RATE_LIMITER.limit).toHaveBeenCalledTimes(1);
});

it("uses the browser when direct HTML is a login page, without following its redirect", async () => {
  const env = config();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response("<title>Instagram login</title>", {
      headers: { "content-type": "text/html" },
    }),
  );
  expect((await handleProfile(request(), env, fetcher)).status).toBe(200);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1]?.redirect).toBe("manual");
});

it.each([
  [
    "wrong profile",
    html.replaceAll("sample.account", "another.account"),
    profile,
    200,
  ],
  [
    "untrusted CDN",
    html.replace("synthetic.cdninstagram.com", "evil.test"),
    profile,
    200,
  ],
  ["login page", "<title>Log in</title>", profile, 200],
  ["login redirect", html, "https://www.instagram.com/accounts/login/", 200],
  ["external redirect", html, "https://evil.test/", 200],
  ["restricted upstream", html, profile, 403],
])(
  "rejects browser %s without returning an image",
  async (_label, result, url, status) => {
    const response = await handleProfile(
      request(),
      config(async () => publicPage(result, url, status)),
      blocked(),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "profile_unavailable",
    });
  },
);

it("fails safely for missing browser configuration, provider capacity and malformed or oversized responses", async () => {
  expect(
    (
      await handleProfile(
        request(),
        { RATE_LIMITER: config().RATE_LIMITER, ENABLE_PUBLIC_LOOKUP: "true" },
        blocked(),
      )
    ).status,
  ).toBe(503);
  for (const [makeResponse, expected] of [
    [() => new Response("unavailable", { status: 503 }), 503],
    [() => Response.json({ success: false }, { status: 429 }), 429],
    [() => Response.json({ success: false }, { status: 400 }), 404],
    [
      () =>
        new Response("not JSON", {
          headers: { "content-type": "application/json" },
        }),
      503,
    ],
    [() => Response.json({ success: true, result: html }), 404],
    [
      () =>
        new Response("x".repeat(2 * 1024 * 1024 + 1), {
          headers: { "content-type": "application/json" },
        }),
      503,
    ],
  ] as const) {
    const response = await handleProfile(
      request(),
      config(async () => makeResponse()),
      blocked(),
    );
    expect(response.status).toBe(expected);
    expect(await response.text()).not.toContain("imageUrl");
  }
  const response = await handleProfile(
    request(),
    config(async () => {
      throw new Error("secret browser exception");
    }),
    blocked(),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret browser exception");
});

it("does not open a browser when disabled, invalid, rate limited or rejected by the shared browser budget", async () => {
  const env = config();
  expect(
    (
      await handleProfile(
        request(),
        { ...env, ENABLE_PUBLIC_LOOKUP: "false" },
        blocked(),
      )
    ).status,
  ).toBe(503);
  expect(
    (
      await handleProfile(
        new Request("https://test/api/profile-picture?username=bad%20name"),
        env,
        blocked(),
      )
    ).status,
  ).toBe(400);
  env.RATE_LIMITER.limit.mockResolvedValueOnce({ success: false });
  expect((await handleProfile(request(), env, blocked())).status).toBe(429);
  env.RATE_LIMITER.limit
    .mockResolvedValueOnce({ success: true })
    .mockResolvedValueOnce({ success: false });
  const shared = await handleProfile(request(), env, blocked());
  expect(shared.status).toBe(429);
  expect(await shared.json()).toMatchObject({ code: "service_rate_limited" });
  expect(env.BROWSER.quickAction).not.toHaveBeenCalled();
  for (const status of [429, 503]) {
    await handleProfile(
      request(),
      env,
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status })),
    );
    expect(env.BROWSER.quickAction).not.toHaveBeenCalled();
  }
});

it.each(["browser", "budget"])(
  "bounds the %s operation by the existing total eight-second timeout",
  async (operation) => {
    vi.useFakeTimers();
    const env = config(() => new Promise<Response>(() => {}));
    if (operation === "budget")
      env.RATE_LIMITER.limit
        .mockResolvedValueOnce({ success: true })
        .mockImplementationOnce(
          () => new Promise<{ success: boolean }>(() => {}),
        );
    const pending = handleProfile(request(), env, blocked());
    await vi.advanceTimersByTimeAsync(8000);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: "lookup_timeout" });
  },
);
