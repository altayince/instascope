import { describe, it, expect } from "vitest";
import { account } from "../../src/lib/instagram/normalize";
import type { Dataset } from "../../src/lib/instagram/types";
import { dashboardInsights } from "../../src/lib/analysis/dashboard-insights";
import { demoSnapshots, demoVaultSnapshots } from "../../src/lib/demo";

const day = (date: number, hour = 0) => Date.UTC(2021, 0, date, hour) / 1000;
const dataset: Dataset = {
  followers: [
    account("sample.they", day(1))!,
    account("sample.you", day(7))!,
    account("sample.same", day(3, 23), "minute-without-timezone")!,
    account("sample.unknown")!,
    account("sample.fan", day(8))!,
    account("SAMPLE.FAN", day(8))!,
  ],
  following: [
    account("sample.they", day(7))!,
    account("sample.you", day(1))!,
    account("sample.same", day(3, 1), "minute-without-timezone")!,
    account("sample.unknown", day(4))!,
    account("sample.outgoing")!,
  ],
  metadata: { sourceFormat: "test", parsedAt: 1, warnings: [] },
};

describe("Dashboard presentation insights", () => {
  it("uses normalized coverage and existing calendar-day origins, excluding unknown dates", () => {
    const before = structuredClone(dataset);
    const insights = dashboardInsights(dataset);
    expect(insights.find((i) => i.id === "follower-dates")).toMatchObject({
      value: "80%",
      description: expect.stringContaining("4 of 5 follower records"),
      href: "/relationship-timeline/?direction=followers",
    });
    expect(insights.find((i) => i.id === "mutual-origins")).toMatchObject({
      value: "33%",
      description: expect.stringContaining("1 of 3 dated mutuals"),
    });
    expect(insights.find((i) => i.id === "one-way-follows")?.value).toBe("1");
    expect(dataset).toEqual(before);
  });
  it("does not manufacture date or optional-category insights when unsupported", () => {
    const unknown: Dataset = {
      followers: [account("sample.unknown")!],
      following: [account("sample.unknown")!],
      metadata: dataset.metadata,
    };
    expect(dashboardInsights(unknown, 1)).toEqual([]);
    for (const status of ["missing", "unsupported"] as const) {
      unknown.connections = {
        pendingRequests: { status, accounts: [], message: "Unavailable" },
      } as Dataset["connections"];
      expect(dashboardInsights(unknown)).toEqual([]);
    }
    expect(
      dashboardInsights({ ...unknown, followers: [], following: [] }),
    ).toEqual([]);
  });
  it("limits cards, uses only available request records and never assumes saved-account identity or age", () => {
    const withRequests: Dataset = {
      ...dataset,
      connections: {
        pendingRequests: {
          status: "available",
          accounts: [
            account("sample.request.one")!,
            account("sample.request.two", day(1))!,
          ],
        },
      } as Dataset["connections"],
    };
    const insights = dashboardInsights(withRequests, 2);
    expect(insights).toHaveLength(4);
    expect(insights.find((i) => i.id === "sent-requests")).toMatchObject({
      value: "2",
      href: "/pending-follow-requests/",
    });
    expect(insights.find((i) => i.id === "saved-snapshots")).toMatchObject({
      value: "2",
      description: expect.stringContaining("nothing is matched automatically"),
      href: "/snapshot-vault/",
    });
    const output = JSON.stringify(insights);
    expect(output).not.toMatch(/sample\.|365|one year|previously mutual/i);
    expect(output).toContain("does not prove they are still pending");
  });
  it("keeps fictional snapshots explicitly separate and aggregate-only", () => {
    const insights = dashboardInsights(
      demoSnapshots().newer,
      demoVaultSnapshots().length,
    );
    expect(insights.find((i) => i.id === "saved-snapshots")).toMatchObject({
      label: "Fictional saved snapshots",
      value: "4",
      href: "/snapshot-vault/?demo=true",
    });
    expect(JSON.stringify(insights)).not.toMatch(
      /demo\.(?:mutual|fan|oneway|request|closefriend|blocked|restricted|hidden)/,
    );
  });
});
