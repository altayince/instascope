import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { syntheticConnections } from "../helpers/connection-export";

async function upload(
  page: Page,
  optional: Record<string, unknown> = syntheticConnections,
) {
  const zip = zipSync({
    "followers.json": strToU8(
      JSON.stringify([
        {
          string_list_data: [{ value: "follower.only", timestamp: 1672531200 }],
        },
      ]),
    ),
    "following.json": strToU8(
      JSON.stringify([
        { string_list_data: [{ value: "follow.old", timestamp: 1704067200 }] },
        { string_list_data: [{ value: "follow.new", timestamp: 1736467200 }] },
        { string_list_data: [{ value: "follow.undated" }] },
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(optional)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => [
          `connections/${name}`,
          strToU8(JSON.stringify(value)),
        ]),
    ),
  });
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles({
      name: "synthetic-insights.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zip),
    });
  await expect(
    page.getByRole("button", { name: "Clear data & start over" }),
  ).toBeVisible();
}
async function goToTool(page: Page, name: string) {
  const link = page
    .locator(".tool-tabs")
    .getByRole("link", { name, exact: true });
  await link.click();
  await expect(link).toHaveAttribute("aria-current", "page");
}
test("an export leads from a familiar result to pending requests, dated connections and own unfollows", async ({
  page,
}) => {
  await page.goto("/not-following-back/");
  await upload(page);
  const next = page.getByRole("region", {
    name: "Explore more from this export",
  });
  await expect(next).toContainText("3 sent requests recorded in this export");
  await expect(next).toContainText("3 current connections have recorded dates");
  await expect(next).toContainText("2 recent unfollow actions by you");
  await next.getByRole("link", { name: /Pending requests/ }).click();
  await expect(page).toHaveURL(/pending-follow-requests\/$/);
  await expect(
    page.getByRole("region", { name: "Pending request review" }),
  ).toContainText("Requests listed as pending in this export");
  await goToTool(page, "Relationship timeline");
  await expect(
    page.getByRole("region", { name: "Relationship date timeline" }),
  ).toContainText("not historical follower totals");
  await goToTool(page, "Your unfollow history");
  await expect(
    page.getByRole("region", { name: "Your unfollow history" }),
  ).toContainText("It does not identify people who unfollowed you");
  await page.getByRole("button", { name: "Clear data & start over" }).click();
  await page.goto("/followers-analyzer/");
  await upload(page, {});
  await expect(
    page.getByRole("region", { name: "Explore more from this export" }),
  ).toContainText("Not included in this export");
  await page
    .getByRole("region", { name: "Explore more from this export" })
    .getByRole("link", { name: "Check what to include in your export" })
    .click();
  await expect(page).toHaveURL(/how-to-download-instagram-followers-data\/$/);
  await expect(page.locator("#export-settings")).toContainText(
    "optional connection categories",
  );
});
test("pending requests have explicit ages, filters, persistent manual review and CSV", async ({
  page,
}) => {
  await page.goto("/pending-follow-requests/");
  await upload(page);
  await page.getByLabel("Age reference date (UTC)").fill("2025-01-15");
  await expect(page.getByText("380 days since recorded request")).toBeVisible();
  await expect(page.getByText("5 days since recorded request")).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Select request.old", exact: true })
    .check();
  await page.getByLabel("Request age", { exact: true }).selectOption("365");
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.getByText("@request.old", { exact: true })).toBeVisible();
  await page.getByLabel("Request age", { exact: true }).selectOption("unknown");
  await expect(
    page.getByText("@request.undated", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected CSV" }).click();
  const result = readFileSync((await (await event).path())!, "utf8");
  expect(result).toContain(
    "request.old,https://www.instagram.com/request.old/",
  );
  expect(result).not.toContain("request.undated");
  await page.getByLabel("Request age", { exact: true }).selectOption("all");
  await page.getByLabel("Age reference date (UTC)").fill("2023-01-01");
  await expect(
    page.getByText("Age unavailable for this reference date"),
  ).toHaveCount(2);
});
test("privacy categories distinguish absent, empty and unsupported while history describes own actions", async ({
  page,
}) => {
  await page.goto("/connection-privacy/");
  await upload(page, {
    ...syntheticConnections,
    "blocked_profiles.json": [
      { label_values: [{ label: "Name", value: "not.an.identity" }] },
    ],
    "hide_story_from.json": undefined,
  });
  await expect(
    page.getByRole("button", { name: /Close friends 1/ }),
  ).toBeVisible();
  await expect(page.getByText("@close.friend", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Restricted accounts 0/ }).click();
  await expect(page.getByText("0 accounts", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Blocked accounts/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Could not read this list" }),
  ).toBeVisible();
  await expect(page.getByText("@not.an.identity")).toHaveCount(0);
  await goToTool(page, "Your unfollow history");
  await expect(
    page.getByText(/It does not identify people who unfollowed you/),
  ).toBeVisible();
  await expect(page.getByText("2 records", { exact: true })).toBeVisible();
  await expect(page.locator(".accounts li").first()).toContainText(
    "Jan 10, 2025",
  );
  await page.getByLabel("Search accounts").fill("unfollow.again");
  await expect(page.locator(".accounts li")).toHaveCount(2);
  await page.getByRole("button", { name: "Clear data & start over" }).click();
  await upload(page, {});
  await expect(page.getByText("Not included", { exact: true })).toBeVisible();
  await goToTool(page, "Connection privacy");
  await expect(
    page.getByRole("button", { name: /Close friends.*Not included/ }),
  ).toBeVisible();
  await expect(page.locator(".accounts")).toHaveCount(0);
  await goToTool(page, "Pending requests");
  await expect(page.getByText("Not included", { exact: true })).toBeVisible();
});
test("timeline filters real export dates and exports an aggregate-only story with no private data requests", async ({
  page,
}) => {
  const requests: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" || !r.url().startsWith("http://127.0.0.1:3000"))
      requests.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.assign(window, { drawnTexts: texts });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof original>
    ) {
      texts.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.goto("/relationship-timeline/");
  await upload(page);
  await expect(
    page.getByText(
      "2 of 3 relationships have a recorded date; 1 dates unavailable.",
      { exact: false },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "2024: 1 dated relationships", exact: true })
    .click();
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.getByText("@follow.old", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Date unavailable (1)" }).click();
  await expect(
    page.getByText("@follow.undated", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Group dates by").selectOption("month");
  await expect(
    page.getByRole("button", {
      name: "2025-01: 1 dated relationships",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Relationship direction").selectOption("followers");
  await expect(
    page.getByRole("button", {
      name: "2023-01: 1 dated relationships",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await goToTool(page, "My Wrapped");
  await page
    .getByRole("button", { name: "My following dates", exact: true })
    .click();
  const card = page.locator(".wrapped-card");
  await expect(card).toContainText("2024-01-01");
  await expect(card).toContainText("2025-01-10");
  await expect(card).toContainText("do not prove continuous following");
  await expect(card).not.toContainText("request.old");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Wrapped" }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe("instascope-timeline.png");
  const png = readFileSync((await download.path())!);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  const drawn = await page.evaluate(
    () => (window as unknown as { drawnTexts: string[] }).drawnTexts,
  );
  expect(drawn).toContain("2024-01-01");
  expect(drawn.join(" ")).not.toMatch(
    /request\.|close\.friend|blocked\.person|story\.hidden|unfollow\.again|follow\.old/,
  );
  expect(drawn.join(" ")).not.toMatch(
    /pending|blocked|restricted|Close friends/i,
  );
  await page.getByRole("button", { name: "Clear data & start over" }).click();
  await expect(page.locator(".wrapped-card")).toHaveCount(0);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
