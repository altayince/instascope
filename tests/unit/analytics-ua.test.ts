import { describe, expect, it } from "vitest";
import { classifyUserAgent } from "../../workers/analytics-ua";

describe("transient coarse User-Agent classification", () => {
  it.each([
    "Googlebot/2.1 (+https://google.test/bot)",
    "Bingbot/2.0 synthetic",
    "synthetic CRAWLER/1.0",
    "synthetic spider/1.0",
    "Mozilla/5.0 (Synthetic) AppleWebKit/537.36 HeadlessChrome/123.0 Safari/537.36",
    "Mozilla/5.0 (Synthetic) AppleWebKit/537.36 Playwright/1.0",
    "Puppeteer synthetic",
    "Selenium synthetic",
    "curl/8.0",
    "Wget/1.0",
    "python-requests/2.0",
    "Go-http-client/1.1",
    "synthetic bot",
  ])("finds an explicit automation identifier in %s", (userAgent) => {
    expect(classifyUserAgent(userAgent)).toBe("automation");
  });

  it.each([
    "Mozilla/5.0 (Synthetic) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
    "Mozilla/5.0 (Synthetic) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Synthetic) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
  ])(
    "reduces a conventional browser-shaped UA to browserish: %s",
    (userAgent) => {
      expect(classifyUserAgent(userAgent)).toBe("browserish");
    },
  );

  it.each([
    null,
    "",
    " ",
    "synthetic client",
    "Mozilla/5.0",
    "AppleWebKit/537.36",
  ])("keeps absent or unrecognized input unknown: %s", (userAgent) => {
    expect(classifyUserAgent(userAgent)).toBe("unknown");
  });
});
