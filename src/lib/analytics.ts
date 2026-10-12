import { isProductEvent, type ProductEvent } from "./analytics-events";
import { analyticsEndpoint } from "./analytics-config";
export { events, type ProductEvent } from "./analytics-events";

export function track(event: ProductEvent) {
  if (typeof window === "undefined" || !isProductEvent(event)) return;
  // No free-form metadata, usernames, filenames, counts, URL, or archive data accepted.
  try {
    window.dispatchEvent(
      new CustomEvent("instascope:event", { detail: { event } }),
    );
    const endpoint = analyticsEndpoint(
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
    );
    if (
      navigator.doNotTrack === "1" ||
      navigator.doNotTrack === "yes" ||
      !endpoint
    )
      return;
    void fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
      redirect: "error",
    }).catch(() => {});
  } catch {
    // Diagnostics, browser policy and network errors must never break the product.
  }
}

// Dataset objects only, held weakly in this document's memory. This avoids route
// remount/StrictMode duplication for presentation events, without an identifier,
// persistent analytics state, or suppressing later imports and explicit actions.
const presentations = new WeakMap<object, Set<ProductEvent>>();
export function trackOnce(event: ProductEvent, scope: object) {
  if (typeof window === "undefined" || !isProductEvent(event)) return;
  let seen = presentations.get(scope);
  if (!seen) {
    seen = new Set();
    presentations.set(scope, seen);
  }
  if (seen.has(event)) return;
  seen.add(event);
  track(event);
}
