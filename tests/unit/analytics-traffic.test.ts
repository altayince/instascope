import { describe, expect, it } from "vitest";
import {
  trafficSources,
  webdriverHints,
} from "../../src/lib/analytics-context";
import {
  classifyTrafficSource,
  classifyWebdriverHint,
} from "../../src/lib/analytics-traffic";

describe("bounded referrer classification", () => {
  it.each([
    ["", "none"],
    ["https://google.com/", "google"],
    ["https://www.google.com/search?q=synthetic-private-query", "google"],
    ["https://google.de/", "google"],
    ["https://google.co.uk/", "google"],
    ["https://news.google.co.uk/", "google"],
    ["https://WWW.GOOGLE.COM/", "google"],
    ["http://google.com:8080/private/path#synthetic-fragment", "google"],
    ["https://www.google.com./", "google"],
    ["https://google.com.au/", "google"],
    ["https://google.co.jp/", "google"],
    ["https://google.com.br/", "google"],
    ["https://google.cat/", "google"],
    ["https://google.co.zw/", "google"],
    ["https://bing.com/", "bing"],
    ["https://www.bing.com/search?q=synthetic-private-query", "bing"],
    ["https://cn.bing.com/", "bing"],
    ["https://duckduckgo.com/", "search_other"],
    ["https://html.duckduckgo.com/", "search_other"],
    [
      "https://search.yahoo.com/search?p=synthetic-private-query",
      "search_other",
    ],
    ["https://search.yahoo.co.jp/", "search_other"],
    ["https://yandex.com/", "search_other"],
    ["https://yandex.ru/", "search_other"],
    ["https://yandex.by/", "search_other"],
    ["https://yandex.kz/", "search_other"],
    ["https://yandex.uz/", "search_other"],
    ["https://yandex.com.tr/", "search_other"],
    ["https://www.ecosia.org/", "search_other"],
    ["https://search.brave.com/", "search_other"],
    ["https://www.startpage.com/", "search_other"],
    ["https://www.qwant.com/", "search_other"],
    [
      "https://synthetic-external.test/private/path?query=private#fragment",
      "external",
    ],
    ["https://mail.yahoo.com/", "external"],
    ["https://brave.com/", "external"],
    ["https://127.0.0.1/", "external"],
    ["https://[::1]/", "external"],
    ["https://instascope.me/", "same_site"],
    ["https://www.instascope.me/private?query=synthetic-private", "same_site"],
    ["http://INSTASCOPE.ME:3000/", "same_site"],
  ] as const)("reduces %s to %s", (referrer, expected) => {
    expect(classifyTrafficSource(referrer)).toBe(expected);
  });

  it.each([
    "https://google.com.synthetic-external.test/",
    "https://google.co.uk.synthetic-external.test/",
    "https://evilgoogle.com/",
    "https://google.synthetic-external.test/",
    "https://google.not-a-country/",
    "https://google.zip/",
    "https://google.com@synthetic-external.test/",
    "https://synthetic-external.test/google.com?q=https://google.de/",
    "https://bing.com.synthetic-external.test/",
    "https://evilbing.com/",
    "https://search.yahoo.com.synthetic-external.test/",
    "https://duckduckgo.com.synthetic-external.test/",
    "https://evilduckduckgo.com/",
    "https://search.brave.com.synthetic-external.test/",
    "https://instascope.me.synthetic-external.test/",
    "https://evilinstascope.me/",
  ])("does not trust lookalike or misleading hosts: %s", (referrer) => {
    expect(classifyTrafficSource(referrer)).toBe("external");
  });

  it.each(
    [
      undefined,
      null,
      false,
      0,
      {},
      [],
      {
        toString: () => {
          throw new Error("Must not coerce private input");
        },
      },
      " ",
      "synthetic malformed referrer",
      "/relative/path?private=synthetic",
      "//google.com/",
      "https:google.com",
      "https://",
      "https://[invalid]/",
      "https://google.com:invalid/",
      "about:blank",
      "file:///private/path",
      "data:text/plain,synthetic-private",
      "javascript:synthetic()",
      "ftp://google.com/private",
    ].map((referrer) => ({ referrer })),
  )("uses unknown for unexpected or unparseable input %#", ({ referrer }) => {
    expect(classifyTrafficSource(referrer)).toBe("unknown");
  });

  it("returns only the exact seven categories and no URL material", () => {
    expect(trafficSources).toEqual([
      "google",
      "bing",
      "search_other",
      "external",
      "same_site",
      "none",
      "unknown",
    ]);
    for (const referrer of [
      "https://google.com/private?synthetic-secret=query#fragment",
      "https://synthetic-private.test/private?synthetic-secret=query#fragment",
      "",
      "synthetic malformed input",
    ]) {
      const result = classifyTrafficSource(referrer);
      expect(trafficSources).toContain(result);
      expect(result).not.toMatch(
        /synthetic|private|secret|query|fragment|[/:?#]/,
      );
    }
  });
});

describe("bounded webdriver hint", () => {
  it.each([
    [true, "yes"],
    [false, "no"],
    [undefined, "unknown"],
    [null, "unknown"],
    ["true", "unknown"],
    ["false", "unknown"],
    [1, "unknown"],
    [0, "unknown"],
    [{}, "unknown"],
  ] as const)("reduces only booleans to yes/no: %#", (value, expected) => {
    expect(classifyWebdriverHint(value)).toBe(expected);
    expect(webdriverHints).toContain(classifyWebdriverHint(value));
  });
});
