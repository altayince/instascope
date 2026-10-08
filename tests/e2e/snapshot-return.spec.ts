import { expect, test } from "@playwright/test";
import { original, newer, upload, save, savedRecords } from "../helpers/vault";

test("saved snapshot survives reload and is compared only after explicit chronology", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page);
  await save(page, "2024-01-15");
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toContainText("Snapshot saved locally · 15 Jan 2024");
  const raw = await savedRecords(page);
  expect(raw[0].exportDate).toBe("2024-01-15");
  expect(JSON.stringify(raw)).not.toMatch(
    /timestamp|href|connections|warnings|sourceFormat/,
  );
  await page.reload();
  await expect(
    page.getByText(/1 saved local snapshot · Latest: 15 Jan 2024/),
  ).toBeVisible();
  await expect(
    page.getByText(/Nothing is compared automatically/),
  ).toBeVisible();
  await upload(page, newer);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots" })
    .click();
  const choice = page.getByRole("region", {
    name: "Compare with saved snapshot",
  });
  const compare = choice.getByRole("button", {
    name: "Compare with saved snapshot",
  });
  const sameAccount = choice.getByRole("checkbox");
  await expect(compare).toBeDisabled();
  await choice.getByLabel("Date of current export").fill("2025-01-15");
  await expect(compare).toBeDisabled();
  await expect(page.getByText(/Follower change:/)).toHaveCount(0);
  for (const [date, message] of [
    ["", "Enter a valid date for the current export."],
    ["2024-01-14", "must be later than the saved snapshot date"],
    ["2024-01-15", "must be later than the saved snapshot date"],
  ]) {
    await choice.getByLabel("Date of current export").fill(date);
    await sameAccount.check();
    await expect(compare).toBeEnabled();
    await compare.click();
    await expect(choice).toContainText(message);
    await expect(page.getByText(/Follower change:/)).toHaveCount(0);
  }
  await choice.getByLabel("Date of current export").fill("2025-01-15");
  await sameAccount.check();
  await compare.click();
  await expect(page.locator(".snapshot-status")).toContainText(
    "Saved local older snapshot",
  );
  await expect(page.locator(".snapshot-status")).toContainText(
    "You entered 2025-01-15",
  );
  await expect(page.getByText(/Follower change: -1/)).toBeVisible();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped" })
    .click();
  await expect(
    page.getByRole("button", { name: "Since my last snapshot" }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Save a local snapshot" })
    .getByRole("link", { name: "Open Vault" })
    .click();
  await page
    .getByRole("button", { name: "Delete 15 Jan 2024", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete snapshot", exact: true })
    .click();
  expect(await savedRecords(page)).toEqual([]);
  await page
    .getByRole("link", { name: "Compare with a current export" })
    .click();
  await expect(page.locator(".snapshot-status")).not.toContainText(
    "Saved local older snapshot",
  );
  await expect(page.getByLabel("Upload older snapshot")).toBeAttached();
});

test("same-date saved copy can be replaced while manual older uploads remain distinct", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page);
  await save(page, "2024-01-15");
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toContainText("Snapshot saved locally");
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await expect(page.getByText(/1 saved local snapshot/)).toBeVisible();
  await upload(page, newer);
  await save(page, "2024-01-15");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace snapshot", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await savedRecords(page))[0].followers).toEqual([
    "alice",
    "new.follower",
  ]);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots" })
    .click();
  await expect(
    page.getByRole("region", { name: "Compare with saved snapshot" }),
  ).toContainText("I confirm this export is from the same Instagram account");
  await upload(page, original, "Upload older snapshot");
  await expect(page.locator(".snapshot-status")).toContainText(
    "Manually uploaded older snapshot",
  );
  await expect(page.locator(".snapshot-status")).not.toContainText(
    "You entered",
  );
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await page
    .locator(".snapshot-return")
    .getByRole("link", { name: "Snapshot Vault", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete 15 Jan 2024", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete snapshot", exact: true })
    .click();
  expect(await savedRecords(page)).toEqual([]);
  await expect(
    page.getByRole("status").filter({ hasText: "Saved snapshot deleted" }),
  ).toBeVisible();
});
