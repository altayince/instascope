import { expect, type Page, type Request } from "@playwright/test";
import { events } from "../../src/lib/analytics-events";
import {
  trafficSources,
  webdriverHints,
} from "../../src/lib/analytics-context";

/** Keep archive privacy assertions strict around the bounded collector envelope. */
export function isSafeAnalyticsRequest(
  request: Request,
  origin = "http://127.0.0.1:3000",
) {
  const url = new URL(request.url());
  if (url.origin !== origin || url.pathname !== "/api/events") return false;
  expect(url.search).toBe("");
  expect(request.method()).toBe("POST");
  const body = request.postDataJSON() as {
    event?: unknown;
    source?: unknown;
    webdriver?: unknown;
  };
  expect(Object.keys(body).sort()).toEqual(["event", "source", "webdriver"]);
  expect(events).toContain(body.event);
  expect(trafficSources).toContain(body.source);
  expect(webdriverHints).toContain(body.webdriver);
  // Unintercepted requests can expose an absent header as an empty string in
  // browser instrumentation. Either representation carries no private value.
  expect(request.headers().cookie ?? "").toBe("");
  expect(request.headers().referer ?? "").toBe("");
  return true;
}

export async function collectEvents(page: Page, status = 204, dnt = "0") {
  const requests: string[] = [];
  await page.addInitScript((setting) => {
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      value: setting,
    });
    const local: string[] = [];
    Object.assign(window, { productEvents: local });
    window.addEventListener("instascope:event", (event) =>
      local.push((event as CustomEvent).detail.event),
    );
  }, dnt);
  await page.route("**/api/events", async (route) => {
    const request = route.request();
    expect(isSafeAnalyticsRequest(request, new URL(page.url()).origin)).toBe(
      true,
    );
    requests.push((request.postDataJSON() as { event: string }).event);
    await route.fulfill({ status, headers: { "Cache-Control": "no-store" } });
  });
  return requests;
}

export async function productEvents(page: Page) {
  return page.evaluate(
    () => (window as unknown as { productEvents: string[] }).productEvents,
  );
}

export async function eventCount(page: Page, event: string) {
  return (await productEvents(page)).filter((value) => value === event).length;
}
