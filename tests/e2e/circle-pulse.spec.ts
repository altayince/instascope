import { expect, test, type Page } from "@playwright/test";
import type { VaultSnapshot } from "../../src/lib/snapshot-vault";
import { savedRecords, seedRecords, upload } from "../helpers/vault";

const snapshot = (
  id: string,
  month: string,
  followers: string[],
  following: string[],
): VaultSnapshot => ({
  id,
  version: 1,
  exportDate: `2025-${month}-15`,
  createdAt: Number(month),
  followers,
  following,
});
const records = [
  snapshot(
    "first",
    "01",
    ["stable.mutual", "stable.fan", "reappeared", "missing"],
    ["stable.mutual", "stable.follow", "changing"],
  ),
  snapshot(
    "second",
    "04",
    ["stable.mutual", "stable.fan", "changing"],
    ["stable.mutual", "stable.follow", "changing"],
  ),
  snapshot(
    "third",
    "07",
    ["stable.mutual", "stable.fan", "reappeared", "changing", "new.fan"],
    ["stable.mutual", "stable.follow", "reappeared"],
  ),
  snapshot(
    "latest",
    "10",
    ["stable.mutual", "stable.fan", "reappeared", "new.fan"],
    ["stable.mutual", "stable.follow"],
  ),
];
async function seed(page: Page, values: unknown[] = records) {
  await page.goto("/snapshot-vault/");
  await expect(
    page.getByText("No snapshots saved yet.", { exact: true }),
  ).toBeVisible();
  await seedRecords(page, values);
  await page.reload();
}
const pulse = (page: Page) =>
  page.getByRole("region", { name: "Circle Pulse", exact: true });
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

test("Pulse derives factual metrics and latest interval from saved snapshots only", async ({
  page,
}) => {
  await seed(page);
  const section = pulse(page);
  await expect(
    section.getByText("15 Jan 2025 → 15 Oct 2025 · 4 readable snapshots", {
      exact: true,
    }),
  ).toBeVisible();
  for (const [fact, value] of [
    ["stable-mutuals", "1"],
    ["reappeared", "1"],
    ["changed", "4"],
    ["retention", "75.0%"],
  ])
    await expect(section.locator(`[data-pulse-fact="${fact}"] dd`)).toHaveText(
      value,
    );
  const interval = section.getByRole("region", { name: "Latest interval" });
  await expect(
    interval.getByText(
      "Observed between 15 Jul 2025 and 15 Oct 2025 snapshots",
    ),
  ).toBeVisible();
  for (const [label, value] of [
    ["New followers", "0"],
    ["Missing followers", "1"],
    ["New following", "0"],
    ["Missing following", "1"],
    ["State changes", "2"],
  ])
    await expect(
      interval
        .locator("dl > div")
        .filter({
          has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }),
        })
        .locator("dd"),
    ).toHaveText(value);
  await section
    .getByRole("button", { name: "Retention details", exact: true })
    .click();
  await expect(
    section.getByText(/3 of 4 from 15 Jan 2025 are present in 15 Oct 2025/),
  ).toBeVisible();
  await expect(
    section.getByText(/2 of 3 from 15 Jan 2025 are present in 15 Oct 2025/),
  ).toBeVisible();
  await section.getByLabel("Account group").selectOption("followers-missing");
  await expect(section.locator(".pulse-account-name")).toHaveText(["@missing"]);
  await fits(page);
});

test("range changes recompute locally; invalid ranges reject and two points cannot prove reappearance", async ({
  page,
}) => {
  await seed(page);
  const section = pulse(page);
  await expect(section.locator('[data-pulse-fact="retention"] dd')).toHaveText(
    "75.0%",
  );
  await section
    .getByRole("combobox", { name: "Start snapshot", exact: true })
    .selectOption("latest");
  await section
    .getByRole("button", { name: "Apply range", exact: true })
    .click();
  await expect(section.getByRole("alert")).toHaveText(
    "Choose at least two readable snapshots in chronological order.",
  );
  await expect(section.locator('[data-pulse-fact="retention"] dd')).toHaveText(
    "75.0%",
  );
  await section
    .getByRole("combobox", { name: "Start snapshot", exact: true })
    .selectOption("third");
  await section
    .getByRole("combobox", { name: "End snapshot", exact: true })
    .selectOption("second");
  await section
    .getByRole("button", { name: "Apply range", exact: true })
    .click();
  await expect(section.getByRole("alert")).toBeVisible();
  await section
    .getByRole("combobox", { name: "Start snapshot", exact: true })
    .selectOption("first");
  await section
    .getByRole("button", { name: "Apply range", exact: true })
    .click();
  await expect(
    section.getByText("15 Jan 2025 → 15 Apr 2025 · 2 readable snapshots", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(section.locator('[data-pulse-fact="retention"] dd')).toHaveText(
    "50.0%",
  );
  await expect(section.locator('[data-pulse-fact="reappeared"] dd')).toHaveText(
    "Needs 3 snapshots",
  );
  await section
    .getByRole("button", { name: "Reappeared", exact: true })
    .click();
  await expect(
    section.getByText(
      "Choose at least three readable snapshots to detect reappearance.",
    ),
  ).toBeVisible();
  await expect(section.locator(".pulse-account-name")).toHaveCount(0);
  await section
    .getByRole("button", { name: "All readable snapshots", exact: true })
    .click();
  await expect(section.locator('[data-pulse-fact="reappeared"] dd')).toHaveText(
    "1",
  );
  expect(
    (await savedRecords(page)).sort((a, b) => a.id.localeCompare(b.id)),
  ).toEqual([...records].sort((a, b) => a.id.localeCompare(b.id)));
});

test("saved-only drilldowns open the shared drawer with observed gaps and no active-export shortcut", async ({
  page,
}) => {
  await seed(page);
  const section = pulse(page);
  await expect(section.locator('[data-pulse-fact="reappeared"] dd')).toHaveText(
    "1",
  );
  await section
    .getByRole("button", { name: "Reappeared", exact: true })
    .click();
  await expect(
    section.getByText(
      "First present: 15 Jan 2025 · Latest present: 15 Oct 2025 · Absent: 15 Apr 2025",
    ),
  ).toBeVisible();
  const trigger = section.getByRole("button", {
    name: "@reappeared",
    exact: true,
  });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "@reappeared" });
  await expect(drawer).toBeVisible();
  const summary = drawer.getByRole("region", { name: "Saved history summary" });
  await expect(
    summary.getByText("3 of 4 readable snapshots", { exact: true }),
  ).toBeVisible();
  await expect(
    summary
      .locator("dl > div")
      .filter({
        has: page.locator("dt", { hasText: "Observed state changes" }),
      })
      .locator("dd"),
  ).toHaveText("3");
  await expect(
    summary.getByText(
      /Observed again in the 15 Jul 2025 snapshot after being absent/,
    ),
  ).toBeVisible();
  await expect(
    drawer.getByText("State in active export", { exact: true }),
  ).toHaveCount(0);
  await expect(
    drawer.getByRole("region", { name: "Review memory" }),
  ).toHaveCount(0);
  await expect(drawer.locator(".history-observations tbody tr")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await fits(page);
});

test("unreadable records are skipped and disclosed instead of creating false absence", async ({
  page,
}) => {
  await seed(page, [
    ...records,
    { ...records[0], id: "broken", exportDate: "2025-02-15", version: 7 },
  ]);
  const section = pulse(page);
  await expect(
    section.getByText(/1 unreadable saved record\(s\) skipped/),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(1);
  await expect(
    section.locator('[data-pulse-fact="stable-mutuals"] dd'),
  ).toHaveText("1");
  await expect(section.locator('[data-pulse-fact="reappeared"] dd')).toHaveText(
    "1",
  );
  expect((await savedRecords(page)).length).toBe(5);
});

test("Dashboard Pulse uses only Vault endpoints even with an unrelated active export", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("link", { name: "Back to Dashboard", exact: true })
    .click();
  await upload(page);
  await expect(
    page.getByRole("region", { name: "In this export", exact: true }),
  ).toBeVisible();
  const section = page.locator(".dashboard-vault-pulse");
  await expect(section).toContainText("75%");
  await expect(section).toContainText("1");
  await expect(section).toContainText(/active export is not included/i);
  await expect(section.getByRole("link")).toHaveAttribute(
    "href",
    "/snapshot-vault/#circle-pulse",
  );
  expect(
    (await savedRecords(page)).sort((a, b) => a.id.localeCompare(b.id)),
  ).toEqual([...records].sort((a, b) => a.id.localeCompare(b.id)));
});

test("limited history omits change facts; demo Pulse is deterministic and leaves real Vault untouched", async ({
  page,
}) => {
  await seed(page, [records[0]]);
  await expect(
    pulse(page).getByText(/Save at least two readable snapshots/),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Back to Dashboard", exact: true })
    .click();
  await expect(page.locator(".dashboard-pulse-facts")).toHaveCount(0);
  await page.getByRole("link", { name: "Open Vault", exact: true }).click();
  await page
    .getByRole("button", { name: "Try Vault demo", exact: true })
    .click();
  const section = pulse(page);
  await expect(
    section.getByText(/4 readable fictional snapshots/),
  ).toBeVisible();
  await expect(section.locator('[data-pulse-fact="reappeared"] dd')).toHaveText(
    "1",
  );
  const facts = await section.locator(".pulse-facts").innerText();
  await section
    .getByRole("button", { name: "Reappeared", exact: true })
    .click();
  await section
    .getByRole("button", { name: "@demo.mutual.0200", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "@demo.mutual.0200" });
  await expect(drawer).toContainText("Fictional");
  await expect(drawer.locator('a[href*="instagram.com"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await fits(page);
  await page.reload();
  await expect(pulse(page).locator(".pulse-facts")).toHaveText(
    facts.replace(/\s+/g, " ").trim(),
    { useInnerText: true },
  );
  expect(await savedRecords(page)).toEqual([records[0]]);
  await page.getByRole("button", { name: "Exit demo", exact: true }).click();
  await expect(
    pulse(page).getByText(/Save at least two readable snapshots/),
  ).toBeVisible();
});

test("deleting and restoring identical snapshot metadata recomputes changed saved records without a reload", async ({
  page,
}) => {
  await seed(page);
  const section = pulse(page);
  await expect(section.locator('[data-pulse-fact="retention"] dd')).toHaveText(
    "75.0%",
  );
  const history = page.getByRole("region", {
    name: "Account relationship history",
    exact: true,
  });
  await history.getByLabel("Search account history").fill("reappeared");
  await history
    .getByRole("button", { name: "Search history", exact: true })
    .click();
  await expect(history.locator(".history-observations tbody tr")).toHaveCount(
    4,
  );
  await expect(
    history.locator(".history-observations tbody tr").last().locator("td"),
  ).toHaveText("Follows you");

  await page
    .getByRole("button", { name: "Delete all saved snapshots", exact: true })
    .click();
  const deletion = page.getByRole("dialog", {
    name: "Delete all saved snapshots?",
    exact: true,
  });
  await deletion.getByLabel("Type DELETE to confirm").fill("DELETE");
  await deletion
    .getByRole("button", { name: "Delete all snapshots", exact: true })
    .click();
  await expect(deletion).toHaveCount(0);
  await expect(
    section.getByText(/Save at least two readable snapshots/),
  ).toBeVisible();
  await expect(section.locator(".pulse-facts")).toHaveCount(0);
  await expect(history.locator(".history-observations")).toHaveCount(0);
  expect(await savedRecords(page)).toEqual([]);

  const changed = records.map((record) =>
    record.id === "latest"
      ? { ...record, followers: ["stable.mutual"] }
      : record,
  );
  await page.getByLabel("Import Vault backup", { exact: true }).setInputFiles({
    name: "synthetic-circle-restored.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "instascope-snapshot-vault",
        version: 1,
        snapshots: changed,
      }),
    ),
  });
  const preview = page.getByLabel("Backup import preview", { exact: true });
  await expect(preview).toContainText("4 new snapshots");
  await preview
    .getByRole("button", { name: "Import snapshots", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Merge this Vault backup?",
    exact: true,
  });
  await confirmation
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(confirmation).toHaveCount(0);
  await expect(section.locator('[data-pulse-fact="retention"] dd')).toHaveText(
    "25.0%",
  );
  await expect(
    section.getByText(/15 Jan 2025.*15 Oct 2025.*4 readable snapshots/),
  ).toBeVisible();

  const restored = await savedRecords(page);
  const metadata = (values: VaultSnapshot[]) =>
    values
      .map(({ id, createdAt, exportDate }) => ({ id, createdAt, exportDate }))
      .sort((a, b) => a.id.localeCompare(b.id));
  expect(metadata(restored)).toEqual(metadata(records));
  expect(restored.find((record) => record.id === "latest")!.followers).toEqual([
    "stable.mutual",
  ]);
  // A previous search must not resurrect cached points when metadata repeats.
  await expect(history.locator(".history-observations")).toHaveCount(0);
  await history.getByLabel("Search account history").fill("reappeared");
  await history
    .getByRole("button", { name: "Search history", exact: true })
    .click();
  await expect(history.locator(".history-observations tbody tr")).toHaveCount(
    4,
  );
  await expect(
    history.locator(".history-observations tbody tr").last().locator("td"),
  ).toHaveText("Absent");

  await section
    .getByRole("button", { name: "Reappeared", exact: true })
    .click();
  await section
    .getByRole("button", { name: "@reappeared", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "@reappeared", exact: true });
  await expect(
    drawer.getByText("2 of 4 readable snapshots", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer
      .locator(".relationship-summary > div")
      .filter({
        has: page.locator("dt", { hasText: "Latest selected saved state" }),
      })
      .locator("dd"),
  ).toHaveText("Absent");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await fits(page);
});
