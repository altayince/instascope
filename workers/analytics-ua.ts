export type UserAgentHint = "automation" | "browserish" | "unknown";

// Coarse evidence only: these explicit crawler/headless/client identifiers take
// precedence over browser-like tokens. Never retain, log, or return the raw UA.
const automationTokens =
  /bot\b|crawler|spider|headlesschrome|playwright|puppeteer|selenium|\bcurl\b|\bwget\b|python-requests|go-http-client/i;

/** Pure transient reduction; neither browserish nor an unflagged UA proves a human. */
export function classifyUserAgent(userAgent: string | null): UserAgentHint {
  if (!userAgent) return "unknown";
  if (automationTokens.test(userAgent)) return "automation";
  // Require a conventional browser shape. Unrecognized nonempty UAs stay unknown;
  // no browser brand, version, device, or operating-system dimension is produced.
  if (
    /^Mozilla\/5\.0\b/i.test(userAgent) &&
    /\b(?:AppleWebKit|Gecko)\//i.test(userAgent)
  )
    return "browserish";
  return "unknown";
}
