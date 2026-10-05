import { expect, it, vi } from "vitest";
import {
  extractPublicImage,
  handleProfile,
} from "../../workers/profile-picture";
import { handleAnalytics } from "../../workers/analytics";
const limiter = { limit: async () => ({ success: true }) };
it("accepts only verified public CDN photos", () => {
  const html =
    '<meta property="og:title" content="Alice (@alice) • Instagram"><meta property="og:image" content="https://scontent.cdninstagram.com/photo.jpg?a=1&amp;b=2">';
  expect(extractPublicImage(html, "alice")).toBe(
    "https://scontent.cdninstagram.com/photo.jpg?a=1&b=2",
  );
  expect(extractPublicImage(html, "bob")).toBeNull();
  expect(
    extractPublicImage(
      html.replace("scontent.cdninstagram.com", "evil.test"),
      "alice",
    ),
  ).toBeNull();
});
it("fails closed, limits requests and never follows login redirects", async () => {
  const request = new Request(
    "https://instascope.test/api/profile-picture?username=alice",
  );
  expect((await handleProfile(request, { RATE_LIMITER: limiter })).status).toBe(
    503,
  );
  expect(
    (
      await handleProfile(request, {
        RATE_LIMITER: { limit: async () => ({ success: false }) },
        ENABLE_PUBLIC_LOOKUP: "true",
      })
    ).status,
  ).toBe(429);
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: "/accounts/login" },
    }),
  );
  expect(
    (
      await handleProfile(
        request,
        { RATE_LIMITER: limiter, ENABLE_PUBLIC_LOOKUP: "true" },
        fetcher,
      )
    ).status,
  ).toBe(503);
  expect(fetcher.mock.calls[0][1]?.redirect).toBe("manual");
});
it("returns a public photo when independently available", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        '<meta property="og:title" content="Alice (@alice)"><meta property="og:image" content="https://a.fbcdn.net/photo.jpg">',
        { headers: { "content-type": "text/html" } },
      ),
    );
  const response = await handleProfile(
    new Request("https://test/api/profile-picture?username=alice"),
    { RATE_LIMITER: limiter, ENABLE_PUBLIC_LOOKUP: "true" },
    fetcher,
  );
  expect(response.status).toBe(200);
  expect((await response.json()).imageUrl).toBe(
    "https://a.fbcdn.net/photo.jpg",
  );
});
it("analytics accepts event names only and rejects private metadata", async () => {
  const writeDataPoint = vi.fn();
  const env = { EVENTS: { writeDataPoint }, RATE_LIMITER: limiter };
  const request = (payload: unknown) =>
    new Request("https://test/api/events", {
      method: "POST",
      headers: { Origin: "https://test", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  expect(
    (await handleAnalytics(request({ event: "parser_succeeded" }), env)).status,
  ).toBe(204);
  expect(writeDataPoint).toHaveBeenCalledWith({
    blobs: ["parser_succeeded"],
    doubles: [1],
  });
  expect(
    (
      await handleAnalytics(
        request({ event: "parser_succeeded", username: "private" }),
        env,
      )
    ).status,
  ).toBe(400);
  expect(
    (await handleAnalytics(request({ event: "private_user_name" }), env))
      .status,
  ).toBe(400);
  expect(
    (await handleAnalytics(request({ event: "a".repeat(300) }), env)).status,
  ).toBe(413);
  expect(writeDataPoint).toHaveBeenCalledTimes(1);
});
