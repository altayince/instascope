import { expect, it, vi } from "vitest";
import { checkProfileInfrastructure } from "../../scripts/profile-health.mjs";
it("production smoke checks both static build wiring and Worker configuration without querying Instagram", async () => {
  for (const [endpoint, healthStatus, ready] of [
    ["/api/profile-picture", "ready", true],
    ["", "ready", false],
    ["/api/profile-picture", "disabled", false],
    ["/api/profile-picture", "not_configured", false],
  ] as const) {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(`<form data-profile-endpoint="${endpoint}"></form>`),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            service: "instascope-profile-picture",
            status: healthStatus,
            configured: healthStatus !== "not_configured",
            enabled: healthStatus === "ready",
          },
          { status: healthStatus === "ready" ? 200 : 503 },
        ),
      );
    expect(
      (await checkProfileInfrastructure("https://instascope.test", fetcher))
        .ready,
    ).toBe(ready);
    expect(fetcher.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://instascope.test/profile-picture-viewer/",
      "https://instascope.test/api/profile-picture/health",
    ]);
  }
});
it("smoke reports missing routes and safely rejects invalid or failing health responses", async () => {
  for (const response of [
    new Response("Not found", { status: 404 }),
    Response.json({ service: "another-service", status: "ready" }),
    Response.json(null),
  ]) {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          '<form data-profile-endpoint="/api/profile-picture"></form>',
        ),
      )
      .mockResolvedValueOnce(response);
    expect(
      (await checkProfileInfrastructure("https://instascope.test", fetcher))
        .ready,
    ).toBe(false);
  }
  expect(
    (
      await checkProfileInfrastructure(
        "https://instascope.test",
        vi.fn<typeof fetch>().mockRejectedValue(new Error("internal details")),
      )
    ).worker,
  ).toBe("unreachable");
});
