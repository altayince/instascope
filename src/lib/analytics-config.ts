/** Only a same-origin path can be compiled into the client. Empty opts out. */
export function analyticsEndpoint(
  configured: string | undefined,
  production = false,
): string {
  if (configured === undefined) return production ? "/api/events" : "";
  return /^\/(?!\/)[a-z0-9/_-]+$/i.test(configured) ? configured : "";
}
