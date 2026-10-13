import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { collectEvents, productEvents } from "../helpers/analytics";
import { newer, save, savedRecords, upload } from "../helpers/vault";

test.use({ timezoneId: "Europe/Berlin" });

async function downloadReminder(page: Page) {
  const received = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Add 30-day reminder", exact: true })
    .click();
  const file = await received;
  return {
    name: file.suggestedFilename(),
    content: await readFile((await file.path())!, "utf8"),
  };
}

function calendar(content: string, date: string, end: string) {
  expect(content).toContain("BEGIN:VCALENDAR\r\n");
  expect(content).toContain("VERSION:2.0\r\n");
  expect(content).toContain("BEGIN:VEVENT\r\n");
  expect(content).toContain(`DTSTART;VALUE=DATE:${date}\r\n`);
  expect(content).toContain(`DTEND;VALUE=DATE:${end}\r\n`);
  expect(content).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
  expect(content).toMatch(/UID:[^\r\n]+\r\n/);
  expect(content.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n")).toBe(true);
  expect(content.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  for (const line of content.split("\r\n"))
    expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  const unfolded = content.replace(/\r\n[ \t]/g, "");
  expect(unfolded).toContain(
    "SUMMARY:Export fresh Instagram data and return to InstaScope",
  );
  expect(unfolded).toContain("https://instascope.me/snapshot-vault/");
  expect(unfolded).not.toMatch(
    /VALARM|ATTENDEE|ORGANIZER|alice|bob|carol|username|followers|following/i,
  );
}

test("a successful recent snapshot offers a local full-day calendar event without new analytics or persistence", async ({
  page,
}) => {
  await collectEvents(page);
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00Z"));
  await page.goto("/followers-analyzer/");
  await upload(page);
  await expect(
    page.getByRole("button", { name: "Add 30-day reminder" }),
  ).toHaveCount(0);
  await save(page, "2026-10-10");
  const reminder = page.getByRole("region", { name: "Next Snapshot reminder" });
  await expect(reminder).toBeVisible();
  await expect(reminder).toContainText("30 days after this export date");
  await expect(reminder).toContainText("InstaScope sends no notification");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const records = await savedRecords(page);
  expect(records).toHaveLength(1);
  const events = await productEvents(page);
  const file = await downloadReminder(page);
  expect(file.name).toBe("instascope-next-snapshot-2026-11-09.ics");
  calendar(file.content, "20261109", "20261110");
  expect(file.content).not.toContain(records[0].id);
  expect(await savedRecords(page)).toEqual(records);
  expect(await productEvents(page)).toEqual(events);
  // Re-downloading this offer retains its calendar UID rather than producing
  // a second unrelated event. No reminder record is written into the Vault.
  expect((await downloadReminder(page)).content).toBe(file.content);
  expect(await savedRecords(page)).toEqual(records);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add 30-day reminder" }),
  ).toHaveCount(0);
  await page.goto("/privacy/");
  const privacy = page.getByRole("main");
  await expect(privacy).toContainText("full filtered account list");
  await expect(privacy).toContainText("Cleaner’s selected CSV");
  await expect(privacy).toContainText("any account CSV");
  await expect(privacy).toContainText("InstaScope stores no reminder");
  await expect(privacy).toContainText("InstaScope sends no notification");
});

test("old and future export dates use the actual local save day; cancelled replacement cannot offer a new reminder", async ({
  page,
}) => {
  await collectEvents(page);
  // UTC is still October 12; the user's local save day is October 13.
  await page.clock.setFixedTime(new Date("2026-10-12T23:30:00Z"));
  await page.goto("/followers-analyzer/");
  await upload(page);
  const saver = page.getByRole("region", { name: "Save a local snapshot" });
  const action = page.getByRole("button", {
    name: "Add 30-day reminder",
    exact: true,
  });
  const reminder = page.getByRole("region", { name: "Next Snapshot reminder" });
  await save(page, "2024-01-15");
  await expect(reminder).toContainText("today’s save");
  const old = await downloadReminder(page);
  expect(old.name).toBe("instascope-next-snapshot-2026-11-12.ics");
  calendar(old.content, "20261112", "20261113");
  const first = await savedRecords(page);
  await saver.getByLabel("Date this export represents").fill("2030-01-15");
  await expect(action).toHaveCount(0);
  await saver
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await expect(reminder).toContainText("today’s save");
  const future = await downloadReminder(page);
  calendar(future.content, "20261112", "20261113");
  expect(await savedRecords(page)).toHaveLength(2);
  // Another attempt for that same date must commit its confirmed replacement
  // before exposing an offer, even though the previous save succeeded.
  await saver
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(action).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(action).toHaveCount(0);
  expect(
    (await savedRecords(page)).find(
      (entry) => entry.exportDate === "2024-01-15",
    ),
  ).toEqual(first[0]);
  await saver
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace snapshot", exact: true })
    .click();
  await expect(action).toBeVisible();
  expect(await savedRecords(page)).toHaveLength(2);
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await upload(page, newer);
  await expect(action).toHaveCount(0);
  await save(page, "");
  await expect(saver).toContainText("valid");
  await expect(action).toHaveCount(0);
});

test("fictional demo and uncommitted real saves never offer a calendar download", async ({
  page,
}) => {
  await collectEvents(page);
  await page.goto("/followers-analyzer/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".demo-notice")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add 30-day reminder" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await upload(page);
  await save(page, "");
  await expect(
    page.getByRole("region", { name: "Save a local snapshot" }),
  ).toContainText("valid");
  await expect(
    page.getByRole("button", { name: "Add 30-day reminder" }),
  ).toHaveCount(0);
  expect(await savedRecords(page)).toEqual([]);
});
