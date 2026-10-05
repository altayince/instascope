// Configuration readiness only; this check never calls Instagram or sends a username.
export async function checkProfileInfrastructure(origin, fetcher = fetch) {
  const options = () => ({
    signal: AbortSignal.timeout(15000),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "manual",
  });
  let endpoint = "";
  try {
    const page = await fetcher(
      new URL("/profile-picture-viewer/", origin),
      options(),
    );
    const html = await page.text();
    const value = html.match(/data-profile-endpoint="([^"]*)"/)?.[1] ?? "";
    if (page.ok && /^\/(?!\/)[a-z0-9/_-]+$/i.test(value)) endpoint = value;
    const response = await fetcher(
      new URL(`${endpoint || "/api/profile-picture"}/health`, origin),
      options(),
    );
    if (!response.headers.get("content-type")?.includes("application/json"))
      return {
        frontendEndpoint: endpoint || null,
        worker: "route_not_configured",
        ready: false,
      };
    const health = await response.json();
    if (
      !health ||
      typeof health !== "object" ||
      Array.isArray(health) ||
      health.service !== "instascope-profile-picture" ||
      !["ready", "disabled", "not_configured"].includes(health.status)
    )
      return {
        frontendEndpoint: endpoint || null,
        worker: "invalid_health_response",
        ready: false,
      };
    return {
      frontendEndpoint: endpoint || null,
      worker: health.status,
      ready:
        !!endpoint &&
        response.status === 200 &&
        health.status === "ready" &&
        health.configured === true &&
        health.browserConfigured === true &&
        health.enabled === true,
      upstream: "not_checked_public_html_is_best_effort",
    };
  } catch {
    return {
      frontendEndpoint: endpoint || null,
      worker: "unreachable",
      ready: false,
    };
  }
}
