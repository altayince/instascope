export const profileMessages = {
  service_not_configured:
    "Public photo lookup is not available on this deployment. You can open the public profile on Instagram instead.",
  lookup_disabled:
    "Public photo lookup is currently disabled. You can open the profile on Instagram instead.",
  service_unavailable:
    "Public photo lookup is temporarily unavailable. Please try again later.",
  request_rate_limited: "Too many requests. Wait a minute before trying again.",
  service_rate_limited:
    "Public photo lookup has reached its shared request limit.",
  service_budget_limited:
    "Public photo lookup has reached its shared minute limit.",
  service_daily_limited:
    "Today's shared public-photo allowance has been used. It resets at midnight UTC.",
  instagram_rate_limited:
    "Instagram is temporarily limiting public lookups. Please try again later.",
  profile_unavailable:
    "Instagram did not provide a verifiable public profile photo. The account may be unavailable or access may be restricted. Try opening the profile on Instagram.",
  upstream_unavailable:
    "Instagram is temporarily unavailable for this lookup. Please try again later.",
  lookup_timeout: "The lookup timed out. Please try again later.",
  invalid_request:
    "Enter an Instagram username or a profile URL, not a post or story link.",
  method_not_allowed: "Only GET is supported.",
  route_not_found: "This lookup route is unavailable.",
} as const;
export type ProfileErrorCode = keyof typeof profileMessages;

// Retry-After is a standard delay or HTTP date, never arbitrary server copy.
export function profileRetrySeconds(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value) return null;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
          value,
        )
      ? Math.ceil((Date.parse(value) - now) / 1000)
      : NaN;
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 86400
    ? Math.ceil(seconds)
    : null;
}

export function profileRetryDelay(
  code: unknown,
  header: string | null,
  now = Date.now(),
): number {
  const provided = profileRetrySeconds(header, now);
  if (provided) return provided;
  if (code === "service_daily_limited") {
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    return Math.ceil((tomorrow.getTime() - now) / 1000);
  }
  return code === "service_rate_limited" ? 10 : 60;
}

export function verifiedPublicImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// NEXT_PUBLIC values are compiled into the static site, not read at request time.
export function profileEndpoint(
  configured: string | undefined,
  production: boolean,
): string {
  const endpoint = configured ?? (production ? "/api/profile-picture" : "");
  return /^\/(?!\/)[a-z0-9/_-]+$/i.test(endpoint) ? endpoint : "";
}

export function profileErrorMessage(code: unknown, status: number): string {
  if (typeof code === "string" && Object.hasOwn(profileMessages, code))
    return profileMessages[code as ProfileErrorCode];
  if (status === 429) return profileMessages.request_rate_limited;
  if (status === 404) return profileMessages.profile_unavailable;
  if (status === 503) return profileMessages.service_unavailable;
  return profileMessages.upstream_unavailable;
}
