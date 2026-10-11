import { expect, test, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { upload, savedRecords, seedRecords } from "../helpers/vault";
import type { ReviewMemoryRecord } from "../../src/lib/review-memory";

const accounts = [
  "sample.keep",
  "sample.reviewed",
  "sample.watch",
  "sample.unmarked",
];
const entry = (value: string) => ({
  string_list_data: [{ value, timestamp: 1704067200 }],
});
const file = (name: string, value: unknown) => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(value)),
});
const files = [
  file("followers_1.json", [entry("sample.reviewed")]),
  file("following.json", { relationships_following: accounts.map(entry) }),
];
const row = (page: Page, username: string) =>
  page.locator(".accounts li").filter({
    has: page.getByRole("button", {
      name: `Inspect relationship with @${username}`,
      exact: true,
    }),
  });
const editor = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("region", { name: "Review memory", exact: true });
async function open(page: Page, username: string) {
  await page
    .locator(".accounts")
    .getByRole("button", {
      name: `Inspect relationship with @${username}`,
      exact: true,
    })
    .click();
  await expect(
    editor(page).getByRole("button", { name: "Keep", exact: true }),
  ).toBeEnabled();
}
async function close(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close relationship details" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function flag(
  page: Page,
  label: "Keep" | "Reviewed" | "Watch",
  state = "true",
) {
  const toggle = editor(page).getByRole("button", { name: label, exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", state);
  await expect(editor(page)).toContainText(
    "Review memory saved in this browser.",
  );
}
async function readMemory(page: Page): Promise<ReviewMemoryRecord[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("instascope:review-memory", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("records", "readonly");
          const read = transaction.objectStore("records").getAll();
          transaction.oncomplete = () => {
            db.close();
            resolve(read.result);
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
  );
}
async function mark(
  page: Page,
  username: string,
  label: "Keep" | "Reviewed" | "Watch",
) {
  await open(page, username);
  await flag(page, label);
  await close(page);
}
async function selectMemoryFilter(filters: Locator, name: string) {
  await filters.getByRole("button", { name, exact: true }).click();
  await expect(
    filters.getByRole("button", { name, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("drawer keeps independent decisions and exact private notes locally, guards unsaved edits and confirms account clearing", async ({
  page,
}) => {
  await page.goto("/following-analyzer/");
  await upload(page, files);
  await seedRecords(page, [
    {
      id: "memory-ui-vault",
      version: 1,
      createdAt: 1,
      exportDate: "2025-01-15",
      followers: ["sample.keep"],
      following: ["sample.keep"],
    },
  ]);
  const snapshots = await savedRecords(page);
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(
      `${request.url()} ${request.postData() ?? ""} ${request.headers().referer ?? ""}`,
    ),
  );
  await open(page, "sample.keep");
  await flag(page, "Keep");
  await flag(page, "Reviewed");
  await flag(page, "Watch");
  const note = "  synthetic-private-note-do-not-transmit\nKeep this spacing.  ";
  await editor(page).getByLabel("Private note", { exact: true }).fill(note);
  await expect(
    editor(page).getByLabel("Private note", { exact: true }),
  ).toHaveAttribute("maxlength", "500");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close relationship details" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Discard the unsaved note?",
  );
  await expect(
    page.getByRole("button", { name: "Continue editing", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    editor(page).getByLabel("Private note", { exact: true }),
  ).toBeFocused();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Open full Relationship Timeline" })
    .click();
  await expect(
    page.getByRole("button", { name: "Discard note and continue" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue editing", exact: true })
    .click();
  await editor(page)
    .getByRole("button", { name: "Save note", exact: true })
    .click();
  await expect(
    editor(page).getByText("Unsaved note", { exact: true }),
  ).toHaveCount(0);
  await expect(
    editor(page).getByRole("button", { name: "Save note", exact: true }),
  ).toBeDisabled();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.contains(document.activeElement)),
    ).toBe(true);
  }
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await close(page);
  await expect(row(page, "sample.keep").locator(".account-memory")).toHaveText(
    "Watching",
  );
  await expect(row(page, "sample.keep").locator(".account-memory")).toHaveCount(
    1,
  );
  const persisted = await readMemory(page);
  expect(persisted[0]).toMatchObject({
    username: "sample.keep",
    keep: true,
    reviewed: true,
    watch: true,
    note,
  });
  expect(requests.join("\n")).not.toContain(
    "synthetic-private-note-do-not-transmit",
  );
  expect(requests.join("\n")).not.toContain("sample.keep");
  await page.reload();
  await upload(page, files);
  await open(page, "sample.keep");
  for (const name of ["Keep", "Reviewed", "Watch"])
    await expect(
      editor(page).getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  await expect(
    editor(page).getByLabel("Private note", { exact: true }),
  ).toHaveValue(note);
  await expect(
    editor(page).getByRole("button", { name: "Save note", exact: true }),
  ).toBeDisabled();
  await editor(page)
    .getByRole("button", { name: "Clear account memory", exact: true })
    .click();
  await expect(editor(page)).toContainText(
    "Clear this account’s review memory?",
  );
  await editor(page)
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(await readMemory(page)).toEqual(persisted);
  await editor(page)
    .getByRole("button", { name: "Clear account memory", exact: true })
    .click();
  await editor(page)
    .getByRole("button", { name: "Clear this account’s memory", exact: true })
    .click();
  await expect(editor(page)).toContainText(
    "Account review memory cleared in this browser.",
  );
  expect(await readMemory(page)).toEqual([]);
  expect(await savedRecords(page)).toEqual(snapshots);
});

test("Cleaner memory filters keep intentional choices visible and selections and CSV independent", async ({
  page,
}) => {
  await page.goto("/instagram-cleaner/");
  await upload(page, files);
  const cleaner = page.getByRole("region", {
    name: "Relationship Review",
    exact: true,
  });
  await cleaner
    .getByRole("group", { name: "Review signals", exact: true })
    .getByRole("button", { name: "All following 4", exact: true })
    .click();
  await mark(page, "sample.keep", "Keep");
  await mark(page, "sample.reviewed", "Reviewed");
  await mark(page, "sample.watch", "Watch");
  await page
    .getByRole("checkbox", { name: "Select sample.unmarked", exact: true })
    .check();
  await expect(cleaner.locator(".review-memory-summary")).toContainText(
    "2 without Keep or Reviewed in this view · 1 kept intentionally",
  );
  const filters = cleaner.getByRole("group", {
    name: "Review memory filters",
    exact: true,
  });
  await expect(
    filters.getByRole("button", { name: "All", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(cleaner.locator(".accounts li")).toHaveCount(4);
  await expect(row(page, "sample.keep")).toContainText("Kept intentionally");
  await selectMemoryFilter(filters, "Unreviewed");
  await expect(cleaner.locator(".accounts li")).toHaveCount(3);
  await expect(row(page, "sample.keep")).toBeVisible();
  await selectMemoryFilter(filters, "Reviewed");
  await expect(cleaner.locator(".accounts li")).toHaveCount(1);
  await expect(row(page, "sample.reviewed")).toBeVisible();
  await selectMemoryFilter(filters, "Keep");
  await expect(cleaner.locator(".accounts li")).toHaveCount(1);
  await expect(row(page, "sample.keep")).toBeVisible();
  await selectMemoryFilter(filters, "Watching");
  await expect(cleaner.locator(".accounts li")).toHaveCount(1);
  await expect(row(page, "sample.watch")).toBeVisible();
  await cleaner
    .getByRole("button", { name: "Show review list", exact: true })
    .click();
  await expect(cleaner.locator(".accounts li")).toHaveCount(0);
  await selectMemoryFilter(filters, "All");
  await expect(cleaner.locator(".accounts li")).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: "Select sample.unmarked", exact: true }),
  ).toBeChecked();
  const download = page.waitForEvent("download");
  await cleaner
    .getByRole("button", { name: "Export selected CSV", exact: true })
    .click();
  const csv = readFileSync((await (await download).path())!, "utf8");
  expect(csv).toBe(
    "username,profile_url\nsample.unmarked,https://www.instagram.com/sample.unmarked/",
  );
  expect(csv).not.toMatch(/keep|reviewed|watch|note/);
  await page.reload();
  await upload(page, files);
  await expect(row(page, "sample.keep")).toContainText("Kept intentionally");
  await expect(
    page.getByRole("checkbox", { name: "Select sample.keep", exact: true }),
  ).not.toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("fictional review memory is editable without changing durable real decisions", async ({
  page,
}) => {
  await page.goto("/following-analyzer/");
  await upload(page, files);
  await mark(page, "sample.keep", "Keep");
  const real = await readMemory(page);
  await page
    .getByRole("button", {
      name: "Clear active data & start over",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search accounts", exact: true })
    .fill("demo.oneway.0001");
  await open(page, "demo.oneway.0001");
  await expect(editor(page)).toContainText(
    "Demo data · Fictional review memory",
  );
  await expect(
    editor(page).getByRole("button", { name: "Keep", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    editor(page).getByRole("button", { name: "Watch", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await editor(page)
    .getByRole("button", { name: "Reviewed", exact: true })
    .click();
  await expect(
    editor(page).getByRole("button", { name: "Reviewed", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await editor(page)
    .getByLabel("Private note", { exact: true })
    .fill("Fictional note, never written to the real database.");
  await editor(page)
    .getByRole("button", { name: "Save note", exact: true })
    .click();
  await expect(
    editor(page).getByText("Unsaved note", { exact: true }),
  ).toHaveCount(0);
  await expect(editor(page)).toContainText(
    "Fictional review memory updated for this demo.",
  );
  await expect(
    page.getByRole("dialog").locator('a[href*="instagram.com"]'),
  ).toHaveCount(0);
  await close(page);
  expect(await readMemory(page)).toEqual(real);
  await page
    .getByRole("button", { name: "Use my own export", exact: true })
    .click();
  await upload(page, files);
  await expect(row(page, "sample.keep")).toContainText("Kept intentionally");
  expect(await readMemory(page)).toEqual(real);
});

test("review flags and a private note cannot change aggregate Wrapped story output", async ({
  page,
}) => {
  await page.goto("/instagram-wrapped/");
  await upload(page, files);
  const wrapped = page.getByRole("region", {
    name: "Instagram relationship stories",
    exact: true,
  });
  const card = wrapped.locator(".wrapped-card");
  await expect(card).toBeVisible();
  const originalText = await card.innerText();
  async function downloadStory() {
    const button = wrapped.getByRole("button", {
      name: "Download my Wrapped",
      exact: true,
    });
    await expect(button).toBeEnabled();
    const pending = page.waitForEvent("download");
    await button.click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("instascope-wrapped.png");
    const png = readFileSync((await download.path())!);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1920);
    return png;
  }
  const originalPng = await downloadStory();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await page.getByRole("button", { name: /^Following 4\b/ }).click();
  await open(page, "sample.keep");
  await flag(page, "Keep");
  await flag(page, "Reviewed");
  await flag(page, "Watch");
  const privateNote = "synthetic-private-review-memory-never-share-9137";
  await editor(page)
    .getByLabel("Private note", { exact: true })
    .fill(privateNote);
  await editor(page)
    .getByRole("button", { name: "Save note", exact: true })
    .click();
  await expect(
    editor(page).getByText("Unsaved note", { exact: true }),
  ).toHaveCount(0);
  expect(await readMemory(page)).toEqual([
    expect.objectContaining({
      username: "sample.keep",
      keep: true,
      reviewed: true,
      watch: true,
      note: privateNote,
    }),
  ]);
  await close(page);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped", exact: true })
    .click();
  await expect(card).toHaveText(originalText, { useInnerText: true });
  await expect(wrapped).not.toContainText(privateNote);
  await expect(wrapped).not.toContainText("sample.keep");
  expect((await downloadStory()).equals(originalPng)).toBe(true);
});

test("unavailable local storage keeps factual Cleaner results visible and does not imply unreviewed decisions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, version) {
      if (name === "instascope:review-memory")
        throw new DOMException(
          "Synthetic unavailable storage",
          "SecurityError",
        );
      return open.call(this, name, version);
    };
  });
  await page.goto("/instagram-cleaner/");
  await upload(page, files);
  const cleaner = page.getByRole("region", {
    name: "Relationship Review",
    exact: true,
  });
  await expect(cleaner).toContainText(
    "these filters do not assume accounts are unreviewed.",
  );
  for (const name of ["All", "Unreviewed", "Reviewed", "Keep", "Watching"])
    await expect(
      cleaner
        .getByRole("group", { name: "Review memory filters", exact: true })
        .getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await expect(cleaner.locator(".accounts li")).toHaveCount(3);
  await page
    .locator(".accounts")
    .getByRole("button", {
      name: "Inspect relationship with @sample.keep",
      exact: true,
    })
    .click();
  await expect(editor(page)).toContainText("Browser storage is unavailable.");
  await expect(
    editor(page).getByRole("button", { name: "Keep", exact: true }),
  ).toBeDisabled();
  await close(page);
});

test("corrupt review memory pauses inferred filters and supports explicit per-account repair", async ({
  page,
}) => {
  await page.goto("/instagram-cleaner/");
  await upload(page, files);
  await mark(page, "sample.keep", "Keep");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("instascope:review-memory", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction("records", "readwrite");
          transaction
            .objectStore("records")
            .put({ username: "sample.keep", keep: "unsupported" });
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
  );
  await page.reload();
  await upload(page, files);
  const cleaner = page.getByRole("region", {
    name: "Relationship Review",
    exact: true,
  });
  await expect(cleaner).toContainText(
    "memory filters are paused until unreadable records are cleared or restored",
  );
  await expect(
    cleaner
      .getByRole("group", { name: "Review memory filters", exact: true })
      .getByRole("button", { name: "Unreviewed", exact: true }),
  ).toBeDisabled();
  await page
    .locator(".accounts")
    .getByRole("button", {
      name: "Inspect relationship with @sample.keep",
      exact: true,
    })
    .click();
  const corrupt = await readMemory(page);
  await expect(
    editor(page).getByRole("button", { name: "Keep", exact: true }),
  ).toBeEnabled();
  await editor(page).getByRole("button", { name: "Keep", exact: true }).click();
  await expect(editor(page)).toContainText(
    "Some Review Memory cannot be read. It was not overwritten.",
  );
  await expect(
    editor(page).getByRole("button", { name: "Keep", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(await readMemory(page)).toEqual(corrupt);
  await close(page);
  await mark(page, "sample.watch", "Watch");
  const withUnrelated = await readMemory(page);
  expect(withUnrelated).toHaveLength(2);
  expect(
    withUnrelated.find((record) => record.username === "sample.keep"),
  ).toEqual(corrupt[0]);
  expect(
    withUnrelated.find((record) => record.username === "sample.watch"),
  ).toMatchObject({ username: "sample.watch", watch: true });
  await open(page, "sample.keep");
  await editor(page)
    .getByRole("button", { name: "Clear account memory", exact: true })
    .click();
  await editor(page)
    .getByRole("button", { name: "Clear this account’s memory", exact: true })
    .click();
  await expect(editor(page)).toContainText(
    "Account review memory cleared in this browser.",
  );
  await close(page);
  await expect(
    cleaner
      .getByRole("group", { name: "Review memory filters", exact: true })
      .getByRole("button", { name: "Unreviewed", exact: true }),
  ).toBeEnabled();
  const repaired = await readMemory(page);
  expect(repaired).toHaveLength(1);
  expect(repaired[0]).toMatchObject({ username: "sample.watch", watch: true });
});
