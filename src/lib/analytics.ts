export const events = [
  "dashboard_opened",
  "landing_viewed",
  "parser_started",
  "parser_succeeded",
  "parser_failed",
  "results_viewed",
  "cleaner_opened",
  "wrapped_generated",
  "wrapped_downloaded",
  "wrapped_shared",
  "comparison_started",
  "comparison_succeeded",
  "profile_search",
  "profile_succeeded",
  "profile_failed",
] as const;
export type ProductEvent = (typeof events)[number];
export function track(event: ProductEvent) {
  if (typeof window === "undefined" || !events.includes(event)) return;
  // No free-form metadata, usernames, filenames, counts, URL, or archive data accepted.
  window.dispatchEvent(
    new CustomEvent("instascope:event", { detail: { event } }),
  );
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  if (
    navigator.doNotTrack === "1" ||
    !endpoint ||
    !/^\/(?!\/)[a-z0-9/_-]+$/i.test(endpoint)
  )
    return;
  void fetch(endpoint, {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {});
}
