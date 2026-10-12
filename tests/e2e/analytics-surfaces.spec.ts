import { expect, test } from "@playwright/test";
import { collectEvents, eventCount } from "../helpers/analytics";
import { save, seedRecords, upload } from "../helpers/vault";
import {
  memoryRecord,
  readReviewMemory,
  seedReviewMemory,
} from "../helpers/review-memory";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Watch visibility and successful manual Review Memory writes have separate aggregate events", async ({
  page,
}) => {
  await collectEvents(page);
  await page.goto("/dashboard/");
  await seedReviewMemory(page, [memoryRecord("alice", { watch: true })]);
  await page.reload();
  await upload(page);
  const watch = page.getByRole("region", { name: "Watch Circle", exact: true });
  await expect(watch).toContainText("1 watched account");
  expect(
    await watch.evaluate(
      (node) => node.getBoundingClientRect().top >= innerHeight,
    ),
  ).toBe(true);
  expect(await eventCount(page, "watch_circle_opened")).toBe(0);
  expect(await eventCount(page, "review_memory_used")).toBe(0);
  await watch.scrollIntoViewIfNeeded();
  await expect.poll(() => eventCount(page, "watch_circle_opened")).toBe(1);

  await watch.getByText("Review watched accounts", { exact: true }).click();
  await watch.getByRole("button", { name: "@alice", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const editor = dialog.getByRole("region", {
    name: "Review memory",
    exact: true,
  });
  const keep = editor.getByRole("button", { name: "Keep", exact: true });
  await expect(keep).toBeEnabled();
  const note = "Synthetic private reminder: never send this note.";
  await editor.getByLabel("Private note", { exact: true }).fill(note);
  expect(await eventCount(page, "review_memory_used")).toBe(0);
  await editor.getByRole("button", { name: "Save note", exact: true }).click();
  await expect.poll(() => eventCount(page, "review_memory_used")).toBe(1);
  await expect(
    editor.getByRole("button", { name: "Save note", exact: true }),
  ).toBeDisabled();
  await keep.click();
  await expect(keep).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => eventCount(page, "review_memory_used")).toBe(2);
  expect(await readReviewMemory(page)).toEqual([
    expect.objectContaining({
      username: "alice",
      watch: true,
      keep: true,
      note,
    }),
  ]);
  await dialog
    .getByRole("button", { name: "Close relationship details" })
    .click();
  expect(await eventCount(page, "watch_circle_opened")).toBe(1);

  // Saving changes the Vault revision and remounts WatchCircleContents. That
  // refresh must not count another opening of this same embedded surface.
  await save(page, "2025-01-15");
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toContainText("Snapshot saved locally");
  await watch.scrollIntoViewIfNeeded();
  await expect(watch).toContainText("1 watched account");
  expect(await eventCount(page, "watch_circle_opened")).toBe(1);
  expect(await eventCount(page, "review_memory_used")).toBe(2);
});

test("Export Doctor counts its first explicit opening, not nested demo toggles or reopening", async ({
  page,
}) => {
  await collectEvents(page);
  await page.goto("/dashboard/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const status = page.getByRole("region", {
    name: "Export status",
    exact: true,
  });
  const details = status.getByText("View export details", { exact: true });
  await expect(status).toBeVisible();
  expect(await eventCount(page, "export_doctor_opened")).toBe(0);
  await details.click();
  const doctor = page.getByRole("region", {
    name: "Export Doctor",
    exact: true,
  });
  await expect(doctor).toBeVisible();
  await expect.poll(() => eventCount(page, "export_doctor_opened")).toBe(1);
  const partial = doctor.getByText("See a fictional partial export", {
    exact: true,
  });
  await partial.click();
  await expect(
    doctor.getByRole("heading", {
      name: "Fictional partial export",
      exact: true,
    }),
  ).toBeVisible();
  await partial.click();
  await details.click();
  await expect(doctor).not.toBeVisible();
  await details.click();
  await expect(doctor).toBeVisible();
  expect(await eventCount(page, "export_doctor_opened")).toBe(1);
  expect(await eventCount(page, "demo_started")).toBe(1);
  expect(await eventCount(page, "parser_succeeded")).toBe(0);
});

test("Circle Pulse visibility is guarded while deliberate real Vault comparisons remain repeatable", async ({
  page,
}) => {
  await collectEvents(page);
  await page.goto("/snapshot-vault/");
  await seedRecords(page, [
    {
      id: "analytics-first",
      version: 1,
      exportDate: "2025-01-15",
      createdAt: 1,
      followers: ["alice"],
      following: ["alice"],
    },
    {
      id: "analytics-second",
      version: 1,
      exportDate: "2025-04-15",
      createdAt: 2,
      followers: ["alice", "synthetic.incoming"],
      following: ["alice"],
    },
  ]);
  await page.reload();
  const pulse = page.getByRole("region", { name: "Circle Pulse", exact: true });
  await expect(pulse).toContainText("2 readable snapshots");
  await pulse.scrollIntoViewIfNeeded();
  await expect.poll(() => eventCount(page, "circle_pulse_opened")).toBe(1);
  await pulse
    .getByRole("button", { name: "Retention details", exact: true })
    .click();
  await pulse.getByLabel("Account group").selectOption("followers-missing");
  expect(await eventCount(page, "circle_pulse_opened")).toBe(1);
  expect(await eventCount(page, "comparison_started")).toBe(0);
  await page
    .getByLabel("Older snapshot", { exact: true })
    .selectOption("analytics-first");
  await page
    .getByLabel("Newer snapshot", { exact: true })
    .selectOption("analytics-second");
  await page
    .getByRole("checkbox", {
      name: "These exports are from the same Instagram account.",
    })
    .check();
  const compare = page.getByRole("button", {
    name: "Compare saved snapshots",
    exact: true,
  });
  for (let attempt = 1; attempt <= 2; attempt++) {
    await compare.click();
    await expect(
      page.getByRole("region", { name: "Snapshot comparison results" }),
    ).toBeVisible();
    await expect
      .poll(() => eventCount(page, "comparison_started"))
      .toBe(attempt);
    await expect
      .poll(() => eventCount(page, "comparison_succeeded"))
      .toBe(attempt);
  }
  await pulse.scrollIntoViewIfNeeded();
  expect(await eventCount(page, "circle_pulse_opened")).toBe(1);
  expect(await eventCount(page, "snapshot_vault_opened")).toBe(1);
});
