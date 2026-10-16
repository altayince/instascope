/** The only attribution dimensions allowed in the client analytics envelope. */
export const trafficSources = [
  "google",
  "bing",
  "search_other",
  "external",
  "same_site",
  "none",
  "unknown",
] as const;
export const webdriverHints = ["yes", "no", "unknown"] as const;
export type TrafficSource = (typeof trafficSources)[number];
export type WebdriverHint = (typeof webdriverHints)[number];
export type TrafficContext = {
  source: TrafficSource;
  webdriver: WebdriverHint;
};

export const isTrafficSource = (value: unknown): value is TrafficSource =>
  typeof value === "string" &&
  trafficSources.some((source) => source === value);
export const isWebdriverHint = (value: unknown): value is WebdriverHint =>
  typeof value === "string" && webdriverHints.some((hint) => hint === value);
