import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("fictional privacy lists are useful and stay out of Wrapped output", async ({
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
  await page.goto("/connection-privacy/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".demo-notice")).toContainText(
    "Demo data · Fictional example",
  );
  const privacy = page.getByRole("region", {
    name: "Connection privacy dashboard",
  });
  for (const [label, prefix, count] of [
    ["Close friends", "closefriend", 8],
    ["Blocked accounts", "blocked", 4],
    ["Restricted accounts", "restricted", 3],
    ["Story hidden from", "hidden", 5],
  ] as const) {
    const button = privacy.getByRole("button", {
      name: new RegExp(`${label} ${count}`),
    });
    await expect(button).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(privacy.locator(".accounts li")).toHaveCount(count);
    await expect(
      privacy.getByText(`@demo.${prefix}.0001`, { exact: true }),
    ).toBeVisible();
    await expect(privacy.locator(".demo-profile")).toHaveCount(count);
    await expect(privacy.locator('.accounts a[href*="instagram.com"]')).toHaveCount(0);
    await expect(privacy).not.toContainText("Not included");
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);

  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped" })
    .click();
  const preview = page.locator(".wrapped-card");
  await expect(preview).toContainText("DEMO DATA · FICTIONAL EXAMPLE");
  await expect(preview).not.toContainText(/demo\.(closefriend|blocked|restricted|hidden)\./);
  await expect(preview).not.toContainText(
    /close friends|blocked accounts|restricted accounts|story hidden from/i,
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Wrapped" }).click();
  const download = await downloadEvent;
  const png = readFileSync((await download.path())!);
  expect(png.readUInt32BE(16)).toBe(1080);
  const drawn = await page.evaluate(
    () => (window as unknown as { drawnTexts: string[] }).drawnTexts,
  );
  expect(drawn.join(" ")).not.toMatch(
    /demo\.(closefriend|blocked|restricted|hidden)\.|close friends|blocked accounts|restricted accounts|story hidden from/i,
  );
});
