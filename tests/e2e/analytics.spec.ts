import { expect, test } from "@playwright/test";
import { collectEvents, eventCount, productEvents } from "../helpers/analytics";
import { newer, upload, save, savedRecords } from "../helpers/vault";

test("real import events count once per attempt and analytics failure never blocks results", async ({
  page,
  context,
}) => {
  const delivered = await collectEvents(page, 503);
  await context.addCookies([
    {
      name: "synthetic-existing-cookie",
      value: "private",
      url: "http://127.0.0.1:3000",
    },
  ]);
  await page.goto("/followers-analyzer/");
  await upload(page);
  await expect(page.locator(".stats-grid")).toBeVisible();
  for (const event of ["parser_started", "parser_succeeded", "results_viewed"])
    await expect.poll(() => eventCount(page, event)).toBe(1);
  expect(await eventCount(page, "landing_viewed")).toBe(0);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Relationship timeline", exact: true })
    .click();
  await expect(
    page.getByRole("region", {
      name: "Relationship date timeline",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await page.getByLabel("Search accounts").fill("alice");
  expect(await eventCount(page, "results_viewed")).toBe(1);
  expect(await eventCount(page, "landing_viewed")).toBe(0);
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await upload(page);
  for (const event of ["parser_started", "parser_succeeded", "results_viewed"])
    await expect.poll(() => eventCount(page, event)).toBe(2);
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles({
      name: "followers.json",
      mimeType: "application/json",
      buffer: Buffer.from("{malformed"),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "JSON file is damaged" }),
  ).toBeVisible();
  await expect.poll(() => eventCount(page, "parser_failed")).toBe(1);
  expect(await eventCount(page, "parser_started")).toBe(3);
  expect(await eventCount(page, "parser_succeeded")).toBe(2);
  expect(await eventCount(page, "results_viewed")).toBe(2);
  await page.goto("/privacy/");
  const configured = !!(await page
    .locator("[data-analytics-endpoint]")
    .getAttribute("data-analytics-endpoint"));
  if (configured) expect(delivered).toContain("parser_failed");
  else expect(delivered).toEqual([]);
  expect((await context.cookies()).map((cookie) => cookie.name)).toEqual([
    "synthetic-existing-cookie",
  ]);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        /analytics|session|visitor|tracking/i.test(key),
      ),
    ),
  ).toEqual([]);
});

test("demo activation is explicit and cannot inflate real import, comparison or Wrapped outcomes", async ({
  page,
}) => {
  await collectEvents(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Try demo", exact: true })
    .first()
    .click();
  await expect(page.locator(".demo-notice")).toBeVisible();
  await expect.poll(() => eventCount(page, "demo_started")).toBe(1);
  expect(await eventCount(page, "landing_viewed")).toBe(1);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Wrapped" }).click();
  await download;
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots", exact: true })
    .click();
  await expect(page.locator(".snapshot-status")).toContainText(
    "Fictional older snapshot",
  );
  for (const event of [
    "parser_started",
    "parser_succeeded",
    "results_viewed",
    "comparison_started",
    "comparison_succeeded",
    "wrapped_generated",
    "wrapped_downloaded",
    "wrapped_shared",
  ])
    expect(await eventCount(page, event)).toBe(0);
  expect(await eventCount(page, "landing_viewed")).toBe(1);
  expect(await eventCount(page, "demo_started")).toBe(1);
});

test("real Wrapped deck is counted once while intentional downloads and successful shares repeat", async ({
  page,
}) => {
  await collectEvents(page);
  await page.addInitScript(() => {
    Object.assign(window, { syntheticShareCancelled: false });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        if (
          (window as unknown as { syntheticShareCancelled: boolean })
            .syntheticShareCancelled
        )
          throw new DOMException("Synthetic cancellation", "AbortError");
      },
    });
  });
  await page.goto("/instagram-wrapped/");
  await upload(page);
  await expect(
    page.getByRole("button", { name: "Download my Wrapped" }),
  ).toBeEnabled();
  expect(await eventCount(page, "wrapped_generated")).toBe(1);
  for (let index = 0; index < 2; index++) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download my Wrapped" }).click();
    await download;
  }
  await page
    .getByRole("button", { name: "Share my card", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Card handed" }),
  ).toBeVisible();
  expect(await eventCount(page, "wrapped_downloaded")).toBe(2);
  expect(await eventCount(page, "wrapped_shared")).toBe(1);
  await page.evaluate(() => {
    (
      window as unknown as { syntheticShareCancelled: boolean }
    ).syntheticShareCancelled = true;
  });
  await page
    .getByRole("button", { name: "Share my card", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sharing cancelled" }),
  ).toBeVisible();
  expect(await eventCount(page, "wrapped_shared")).toBe(1);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped", exact: true })
    .click();
  await expect(page.locator(".wrapped-card")).toBeVisible();
  expect(await eventCount(page, "wrapped_generated")).toBe(1);
  expect(await eventCount(page, "results_viewed")).toBe(1);
});

test("manual older import counts parsing and one comparison without another active-result event", async ({
  page,
}) => {
  await collectEvents(page);
  await page.goto("/snapshot-comparison/");
  await upload(page, newer, "Upload newer snapshot");
  await upload(page, undefined, "Upload older snapshot");
  await expect(page.locator(".snapshot-status")).toContainText(
    "Manually uploaded older snapshot",
  );
  for (const event of [
    "comparison_started",
    "comparison_succeeded",
    "results_viewed",
  ])
    await expect.poll(() => eventCount(page, event)).toBe(1);
  expect(await eventCount(page, "parser_started")).toBe(2);
  expect(await eventCount(page, "parser_succeeded")).toBe(2);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots", exact: true })
    .click();
  await expect(page.locator(".snapshot-status")).toContainText(
    "Manually uploaded older snapshot",
  );
  expect(await eventCount(page, "comparison_succeeded")).toBe(1);
});

test("saved snapshot actions emit names only after successful storage and accepted comparison", async ({
  page,
}) => {
  await collectEvents(page, 503);
  await page.goto("/followers-analyzer/");
  await upload(page);
  await save(page, "2024-01-15");
  await expect.poll(() => eventCount(page, "snapshot_saved")).toBe(1);
  expect(await savedRecords(page)).toHaveLength(1);
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await upload(page, newer);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots", exact: true })
    .click();
  const choice = page.getByRole("region", {
    name: "Compare with saved snapshot",
  });
  await choice.getByLabel("Date of current export").fill("2025-01-15");
  await choice.getByRole("checkbox").check();
  await choice
    .getByRole("button", { name: "Compare with saved snapshot" })
    .click();
  await expect(page.locator(".snapshot-status")).toContainText(
    "Saved local older snapshot",
  );
  expect(await eventCount(page, "comparison_started")).toBe(1);
  expect(await eventCount(page, "comparison_succeeded")).toBe(1);
  expect(await savedRecords(page)).toHaveLength(1);
  await page
    .getByRole("region", { name: "Save a local snapshot" })
    .getByRole("link", { name: "Open Vault", exact: true })
    .click();
  await expect.poll(() => eventCount(page, "snapshot_vault_opened")).toBe(1);
  expect(await eventCount(page, "snapshot_saved")).toBe(1);
});

test("DNT keeps real import and local diagnostics usable while preventing every remote event", async ({
  page,
}) => {
  const delivered = await collectEvents(page, 204, "1");
  await page.goto("/followers-analyzer/");
  await upload(page);
  await expect(page.locator(".stats-grid")).toBeVisible();
  expect(await eventCount(page, "parser_succeeded")).toBe(1);
  expect(await eventCount(page, "results_viewed")).toBe(1);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Pending requests", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Pending request review" }),
  ).toBeVisible();
  expect(delivered).toEqual([]);
  expect(await productEvents(page)).toContain("pending_requests_opened");
});
