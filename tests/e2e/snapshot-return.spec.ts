import { expect, test, type Page } from "@playwright/test";
import { SNAPSHOT_KEY } from "../../src/lib/snapshot-storage";

const original = [
  "tests/fixtures/followers_1.json",
  "tests/fixtures/following.json",
];
const newer = [
  {
    name: "followers.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        { string_list_data: [{ value: "alice" }] },
        { string_list_data: [{ value: "new.follower" }] },
      ]),
    ),
  },
  {
    name: "following.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        relationships_following: [
          { title: "alice", string_list_data: [{ value: "alice" }] },
          { title: "new.follow", string_list_data: [{ value: "new.follow" }] },
        ],
      }),
    ),
  },
];

async function upload(
  page: Page,
  label: string,
  files: typeof newer | typeof original,
) {
  await page
    .getByLabel(label, { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
}

test("saved snapshot survives reload and is compared only after explicit chronology", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page, "Upload Instagram export", original);
  const saver = page.getByRole("region", { name: "Save a local snapshot" });
  await saver.getByLabel("Date this export represents").fill("2024-01-15");
  await saver
    .getByRole("button", { name: "Save this snapshot for next time" })
    .click();
  await expect(saver).toContainText("Saved local snapshot · 2024-01-15");
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    SNAPSHOT_KEY,
  );
  expect(raw).toContain('"exportDate":"2024-01-15"');
  expect(raw).not.toMatch(/timestamp|href|connections|warnings|sourceFormat/);

  await page.reload();
  await expect(
    page.getByText("Saved local snapshot · 2024-01-15"),
  ).toBeVisible();
  await expect(
    page.getByText("Nothing is compared automatically."),
  ).toBeVisible();
  await upload(page, "Upload Instagram export", newer);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots" })
    .click();
  const choice = page.getByRole("region", {
    name: "Compare with saved snapshot",
  });
  await expect(choice).toBeVisible();
  const compare = choice.getByRole("button", {
    name: "Compare with saved snapshot",
  });
  const sameAccount = choice.getByRole("checkbox", {
    name: "I confirm this export is from the same Instagram account as the saved snapshot.",
  });
  await expect(compare).toBeDisabled();
  await choice.getByLabel("Date of current export").fill("2025-01-15");
  await expect(compare).toBeDisabled();
  await expect(page.getByText(/Follower change:/)).toHaveCount(0);
  await sameAccount.check();
  await expect(compare).toBeEnabled();
  await choice.getByLabel("Date of current export").fill("");
  await compare.click();
  await expect(choice).toContainText("Enter a valid date for the current export.");
  await choice.getByLabel("Date of current export").fill("2024-01-14");
  await compare.click();
  await expect(choice).toContainText(
    "must be later than the saved snapshot date",
  );
  await choice.getByLabel("Date of current export").fill("2024-01-15");
  await compare.click();
  await expect(choice).toContainText(
    "must be later than the saved snapshot date",
  );
  await expect(page.getByText(/Follower change:/)).toHaveCount(0);
  await choice.getByLabel("Date of current export").fill("2025-01-15");
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
    .getByRole("button", { name: "Delete saved snapshot" })
    .click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SNAPSHOT_KEY),
  ).toBeNull();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots" })
    .click();
  await expect(page.locator(".snapshot-status")).not.toContainText(
    "Saved local older snapshot",
  );
  await expect(page.getByLabel("Upload older snapshot")).toBeAttached();
});

test("saved copy can be replaced and a manually uploaded older file stays distinct", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page, "Upload Instagram export", original);
  const saver = page.getByRole("region", { name: "Save a local snapshot" });
  await saver.getByLabel("Date this export represents").fill("2024-01-15");
  await saver
    .getByRole("button", { name: "Save this snapshot for next time" })
    .click();
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await expect(
    page.getByText("Saved local snapshot · 2024-01-15"),
  ).toBeVisible();
  await upload(page, "Upload Instagram export", newer);
  await saver.getByLabel("Date this export represents").fill("2025-01-15");
  await saver.getByRole("button", { name: "Replace saved snapshot" }).click();
  await expect(saver).toContainText("Saved local snapshot · 2025-01-15");
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Compare snapshots" })
    .click();
  await expect(
    page.getByRole("region", { name: "Compare with saved snapshot" }),
  ).toContainText("I confirm this export is from the same Instagram account");
  await upload(page, "Upload older snapshot", original);
  await expect(page.locator(".snapshot-status")).toContainText(
    "Manually uploaded older snapshot",
  );
  await expect(page.locator(".snapshot-status")).not.toContainText(
    "You entered 2025-01-15",
  );
  await page
    .getByRole("button", { name: "Clear active data & start over" })
    .click();
  await page.getByRole("button", { name: "Delete saved snapshot" }).click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SNAPSHOT_KEY),
  ).toBeNull();
  await expect(
    page.getByText("Saved snapshot deleted from this browser."),
  ).toBeVisible();
});
