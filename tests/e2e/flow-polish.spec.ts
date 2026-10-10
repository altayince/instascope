import { expect, test, type Page } from "@playwright/test";
import { seedRecords, savedRecords, upload } from "../helpers/vault";
import type { VaultSnapshot } from "../../src/lib/snapshot-vault";

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

test("import feedback is indeterminate and stays local until real parsing finishes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (...args) {
      window.setTimeout(() => Reflect.apply(send, this, args), 1200);
    };
  });
  await page.goto("/followers-analyzer/");
  await upload(page);
  const importing = page.locator(".upload[aria-busy='true']");
  await expect(importing.getByRole("heading")).toHaveText(
    "Reading your export locally…",
  );
  await expect(importing.getByRole("status")).toContainText(
    "Preparing your relationship workspace",
  );
  await expect(importing.getByRole("status")).toContainText(
    "Your files stay on this device.",
  );
  await expect(importing.getByRole("status")).not.toContainText("%");
  await expect(importing.getByRole("progressbar")).toHaveCount(0);
  await expect(
    importing.getByRole("button", { name: "Processing in your browser…" }),
  ).toBeDisabled();
  await expect(
    importing.getByRole("button", { name: "Try demo", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /^Followers 3 / }),
  ).toBeVisible();
  await expect(page.locator(".upload-progress")).toHaveCount(0);
  await fits(page);
});

test("Cleaner keeps the review shortlist reachable while switching compact signals", async ({
  page,
}) => {
  await page.goto("/instagram-cleaner/");
  await upload(page);
  const review = page.getByRole("region", { name: "Relationship Review" });
  const toolbar = review.locator(".review-toolbar");
  await expect(toolbar).toContainText("0 accounts selected");
  await review
    .getByRole("checkbox", { name: "Select one.way", exact: true })
    .check();
  await expect(toolbar).toContainText("1 account selected");
  await review.getByRole("button", { name: /^All following 4/ }).click();
  await expect(toolbar).toContainText("1 account selected");
  const selected = toolbar.getByRole("button", {
    name: "Show review list",
    exact: true,
  });
  await selected.focus();
  await selected.press("Enter");
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(review.locator(".accounts > li")).toHaveCount(1);
  await expect(
    review.getByRole("checkbox", { name: "Select one.way", exact: true }),
  ).toBeChecked();
  await expect(
    review.getByRole("button", { name: "Export selected CSV" }),
  ).toBeEnabled();
  await expect(
    review.getByRole("group", { name: "Review signals" }).getByRole("button"),
  ).toHaveCount(8);
  await review
    .getByRole("button", { name: /^Pending requests Not included/ })
    .click();
  await expect(review.getByRole("status")).toContainText("Not included");
  await expect(toolbar).toContainText("1 account selected");
  await selected.click();
  await expect(review.locator(".accounts > li")).toHaveCount(1);
  await fits(page);
});

const snapshots: VaultSnapshot[] = [
  {
    id: "polish-first",
    version: 1,
    exportDate: "2025-01-15",
    createdAt: 1,
    followers: ["sample.one", "sample.two"],
    following: ["sample.one"],
  },
  {
    id: "polish-second",
    version: 1,
    exportDate: "2025-04-15",
    createdAt: 2,
    followers: ["sample.one", "sample.three"],
    following: ["sample.one", "sample.three"],
  },
];

test("Vault explains its empty state and separates comparison, backup and deletion actions", async ({
  page,
}) => {
  await page.goto("/snapshot-vault/");
  await expect(
    page.getByRole("heading", { name: "No snapshots saved yet.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Upload an export in Dashboard",
      exact: true,
    }),
  ).toHaveAttribute("href", "/dashboard/");
  await expect(
    page.getByRole("button", { name: "Export Vault backup", exact: true }),
  ).toBeDisabled();
  await seedRecords(page, snapshots);
  await page.reload();
  await expect(page.locator(".vault-overview")).toContainText("15 Apr 2025");
  await expect(page.locator(".vault-overview")).toContainText(
    "Choose two saved dates",
  );
  await expect(page.locator(".vault-row h3")).toHaveText([
    "15 Apr 2025",
    "15 Jan 2025",
  ]);
  await expect(page.locator(".vault-trend circle")).toHaveCount(4);
  await expect(page.locator(".vault-history")).toContainText(
    "not continuous monitoring",
  );
  const compare = page.getByRole("button", {
    name: "Compare saved snapshots",
    exact: true,
  });
  await expect(compare).toHaveClass(/primary/);
  await page
    .getByLabel("Older snapshot", { exact: true })
    .selectOption("polish-first");
  await page
    .getByLabel("Newer snapshot", { exact: true })
    .selectOption("polish-second");
  await expect(compare).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "These exports are from the same Instagram account.",
      exact: true,
    })
    .check();
  await compare.click();
  await expect(
    page.getByRole("region", { name: "Snapshot comparison results" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export Vault backup", exact: true }),
  ).toHaveClass(/secondary/);
  const deletion = page
    .locator(".vault-danger-zone")
    .getByRole("button", { name: "Delete all saved snapshots", exact: true });
  await expect(deletion).toHaveClass(/danger/);
  await deletion.click();
  const dialog = page.getByRole("dialog", {
    name: "Delete all saved snapshots?",
  });
  await expect(
    dialog.getByRole("button", { name: "Delete all snapshots", exact: true }),
  ).toHaveClass(/danger/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(deletion).toBeFocused();
  expect(await savedRecords(page)).toEqual(snapshots);
  await fits(page);
});

test("Vault demo stays fictional and leaves real saved history untouched", async ({
  page,
}) => {
  await page.goto("/snapshot-vault/");
  await seedRecords(page, snapshots);
  await page.goto("/snapshot-vault/?demo=true");
  await expect(page.getByText(/Demo data · Fictional history/)).toBeVisible();
  await expect(page.locator(".vault-row")).toHaveCount(4);
  await expect(page.locator(".vault-overview")).toContainText("15 Oct 2025");
  await expect(
    page.getByRole("button", { name: "Export Vault backup", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Delete all saved snapshots",
      exact: true,
    }),
  ).toBeDisabled();
  expect(await savedRecords(page)).toEqual(snapshots);
  await fits(page);
});
