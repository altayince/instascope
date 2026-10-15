import { isProductEvent, type ProductEvent } from "./analytics-events";
import { analyticsEndpoint } from "./analytics-config";
import type { TrafficContext } from "./analytics-context";
import {
  classifyTrafficSource,
  classifyWebdriverHint,
} from "./analytics-traffic";
export { events, type ProductEvent } from "./analytics-events";

// Retain only bounded categories in weak document memory. Neither the referrer
// nor any identifier is stored, and SPA navigation retains this document's entry.
const documentContexts = new WeakMap<Document, Readonly<TrafficContext>>();
const observedDocuments = new WeakSet<Document>();

function documentTrafficContext(doc: Document): Readonly<TrafficContext> {
  const existing = documentContexts.get(doc);
  if (existing) return existing;
  let source: TrafficContext["source"] = "unknown";
  let webdriver: TrafficContext["webdriver"] = "unknown";
  try {
    source = classifyTrafficSource(doc.referrer);
  } catch {
    // Restricted or unavailable browser properties reduce to a bounded unknown.
  }
  try {
    webdriver = classifyWebdriverHint(navigator.webdriver);
  } catch {
    // Read no other navigator properties for attribution or automation hints.
  }
  const context = Object.freeze({ source, webdriver });
  documentContexts.set(doc, context);
  return context;
}

export function track(event: ProductEvent) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !isProductEvent(event)
  )
    return;
  // No free-form metadata, usernames, filenames, counts, URL, or archive data accepted.
  try {
    if (event === "document_entry_observed") {
      if (observedDocuments.has(document)) return;
      observedDocuments.add(document);
    }
    // Capture even while DNT or configuration suppresses delivery. These flags
    // must not change which document entry later product events are attributed to.
    const context = documentTrafficContext(document);
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
      body: JSON.stringify({
        event,
        source: context.source,
        webdriver: context.webdriver,
      }),
      keepalive: true,
      redirect: "error",
    }).catch(() => {});
  } catch {
    // Diagnostics, browser policy and network errors must never break the product.
  }
}

/** Observe JS execution once per document, including StrictMode and remounts. */
export function observeDocumentEntry() {
  track("document_entry_observed");
}

// Dataset objects only, held weakly in this document's memory. This avoids route
// remount/StrictMode duplication for presentation events, without an identifier,
// persistent analytics state, or suppressing later imports and explicit actions.
const presentations = new WeakMap<object, Set<ProductEvent>>();
export function trackOnce(event: ProductEvent, scope: object) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !isProductEvent(event)
  )
    return;
  let seen = presentations.get(scope);
  if (!seen) {
    seen = new Set();
    presentations.set(scope, seen);
  }
  if (seen.has(event)) return;
  seen.add(event);
  track(event);
}
