import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const exportFiles = (followers: unknown[], following: unknown[]) => [
  {
    name: "followers.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(followers)),
  },
  {
    name: "following.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ relationships_following: following })),
  },
];
const follower = (name: string) => ({ string_list_data: [{ value: name }] });
const following = (name: string, timestamp?: number) => ({
  title: name,
  string_list_data: [{ value: name, ...(timestamp ? { timestamp } : {}) }],
});
async function upload(
  page: Page,
  files: ReturnType<typeof exportFiles>,
  label: string,
) {
  await page
    .getByLabel(label, { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
}

test("Wrapped omits date and change stories when records cannot support them", async ({
  page,
}) => {
  await page.goto("/instagram-wrapped/");
  await upload(
    page,
    exportFiles([follower("private.fan")], [following("private.follow")]),
    "Upload Instagram export",
  );
  const picker = page.getByRole("group", { name: "Wrapped stories" });
  await expect(picker.getByRole("button")).toHaveCount(1);
  await expect(picker.getByRole("button", { name: "My circle" })).toBeVisible();
  await expect(page.locator(".wrapped-card")).not.toContainText("private.");
  await expect(page.locator(".wrapped-card")).toContainText(
    "not live Instagram",
  );
});

test("Wrapped browses factual dated and comparison stories and exports private portrait PNGs", async ({
  page,
}) => {
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
  await page.goto("/instagram-wrapped/");
  await upload(
    page,
    exportFiles(
      [follower("private.common"), follower("private.added")],
      [
        following("private.common", 1577836800),
        following("private.new", 1672531200),
        following("private.undated"),
      ],
    ),
    "Upload Instagram export",
  );
  const picker = page.getByRole("group", { name: "Wrapped stories" });
  await expect(picker.getByRole("button")).toHaveCount(3);
  await picker.getByRole("button", { name: "Instagram archaeology" }).click();
  await expect(page.locator(".wrapped-card")).toContainText("2020");
  await page
    .getByRole("link", { name: "Compare snapshots", exact: true })
    .first()
    .click();
  await upload(
    page,
    exportFiles(
      [follower("private.common"), follower("private.missing")],
      [
        following("private.common", 1577836800),
        following("private.old", 1609459200),
      ],
    ),
    "Upload older snapshot",
  );
  await expect(page.getByText(/Follower change: \+0/)).toBeVisible();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped" })
    .click();
  await expect(picker.getByRole("button")).toHaveCount(4);
  for (const name of [
    "My circle",
    "My following dates",
    "Instagram archaeology",
    "Since my last snapshot",
  ]) {
    await picker.getByRole("button", { name, exact: true }).click();
    expect(
      await page
        .locator(".wrapped-card")
        .evaluate((card) => {
          const bounds = card.getBoundingClientRect();
          const last = card.querySelector("small")!.getBoundingClientRect();
          const content = card.querySelectorAll(
            "h2, p, .wrapped-hero, .wrapped-facts, small",
          );
          return (
            last.bottom <= bounds.bottom - 8 &&
            [...content].every(
              (part) => part.scrollWidth <= part.clientWidth + 1,
            )
          );
        }),
      name,
    ).toBe(true);
  }
  await picker.getByRole("button", { name: "Since my last snapshot" }).click();
  const preview = page.locator(".wrapped-card");
  await expect(preview).toContainText("added followers");
  await expect(preview.locator(".wrapped-facts strong").first()).toHaveText(
    "1",
  );
  await expect(preview).not.toContainText("private.");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Wrapped" }).click();
  const saved = await event;
  expect(saved.suggestedFilename()).toBe("instascope-changes.png");
  const png = readFileSync((await saved.path())!);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  const drawn = await page.evaluate(
    () => (window as unknown as { drawnTexts: string[] }).drawnTexts,
  );
  expect(drawn.join(" ")).toContain("added followers");
  expect(drawn.join(" ")).not.toMatch(/private\.|pending|blocked|restricted/i);
});
