// Shared semantic event allowlist. track() accepts no metadata or identity fields.
export const events = [
  "document_entry_observed",
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
  "snapshot_saved",
  "snapshot_vault_opened",
  "watch_circle_opened",
  "review_memory_used",
  "circle_pulse_opened",
  "export_doctor_opened",
  "demo_started",
  "pending_requests_opened",
  "connection_privacy_opened",
  "timeline_opened",
  "unfollow_history_opened",
] as const;

export type ProductEvent = (typeof events)[number];

export function isProductEvent(value: unknown): value is ProductEvent {
  return typeof value === "string" && events.some((event) => event === value);
}
