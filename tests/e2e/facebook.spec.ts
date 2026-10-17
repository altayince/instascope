import { test, expect, type Page } from "@playwright/test";
import {
  syntheticFacebookZip,
  facebookZip,
  facebookHtml,
} from "../helpers/facebook-export";

const enabled = process.env.EXPECT_FACEBOOK === "true";
async function upload(page: Page, format: "json" | "html") {
  await page
    .getByLabel("Facebook JSON or HTML ZIP", { exact: true })
    .setInputFiles({
      name: "fictional-facebook.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(syntheticFacebookZip(format)),
    });
  await expect(
    page.getByRole("heading", { name: "Import coverage" }),
  ).toBeVisible();
}
test("Facebook release gate excludes production routes, menus and sitemap entries", async ({
  page,
  request,
}) => {
  const response = await request.get("/facebook/");
  expect(response.status()).toBe(enabled ? 200 : 404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "/facebook/",
  );
  await page.goto("/");
  const menu = page.locator(".social-switcher");
  if (enabled || (await menu.count())) await menu.locator("summary").click();
  if (enabled) {
    await menu.getByRole("link", { name: /^Facebook/ }).click();
    await expect(page.locator(".site-header")).toHaveAttribute(
      "data-platform",
      "facebook",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  } else
    await expect(menu.getByRole("link", { name: /^Facebook/ })).toHaveCount(0);
});
test.describe("Facebook Friends Explorer preview", () => {
  test.skip(!enabled, "Requires the unreleased Facebook preview build.");
  for (const format of ["json", "html"] as const)
    test(`${format} import, diagnostics, search, dates and themes work locally`, async ({
      page,
    }) => {
      const requests: string[] = [];
      page.on("request", (request) =>
        requests.push(request.url() + (request.postData() ?? "")),
      );
      await page.goto("/facebook/");
      await upload(page, format);
      await expect(page.locator(".fb-year li")).toHaveCount(3);
      await expect(
        page.getByRole("heading", { name: "2024", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(".fb-year li").filter({ hasText: "Deniz Örnek" }),
      ).toHaveCount(2);
      await expect(
        page
          .locator(".fb-coverage")
          .filter({ hasText: "Received friend requests" }),
      ).toContainText("Included · empty");
      await expect(
        page
          .locator(".fb-coverage")
          .filter({ hasText: "Removed friend records" }),
      ).toContainText("Not included");
      await page.getByLabel("Search names", { exact: true }).fill("deniz");
      await expect(page.locator(".fb-year li")).toHaveCount(2);
      await page
        .getByRole("combobox", { name: "Sort records", exact: true })
        .selectOption("oldest");
      await expect(page.locator(".fb-year li").first()).toContainText(
        "Source row 2",
      );
      await page.getByLabel("Search names", { exact: true }).fill("");
      if (format === "json")
        await page
          .getByRole("combobox", { name: "Date display timezone", exact: true })
          .selectOption("Europe/Istanbul");
      await expect(
        page.locator(".fb-year li").filter({ hasText: "Source row 1" }),
      ).toContainText("2024-01-01 · 13:00:00");
      await page
        .getByRole("combobox", { name: "Category", exact: true })
        .selectOption("received");
      await expect(
        page.getByText("The included category explicitly contains no records."),
      ).toBeVisible();
      await page
        .getByRole("combobox", { name: "Category", exact: true })
        .selectOption("removed");
      await expect(
        page.getByText("This category was not included in the export."),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Removal records do not establish who removed whom or why.",
        ),
      ).toBeVisible();
      await page
        .getByRole("combobox", { name: "Category", exact: true })
        .selectOption("rejected");
      await expect(page.locator(".fb-year li")).toContainText(
        "Date unavailable",
      );
      for (const theme of [true, false]) {
        await page.getByRole("switch", { name: "Dark mode" }).click();
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme",
          theme ? "dark" : "light",
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
      }
      expect(requests.join("\n")).not.toMatch(
        /Deniz|Mira|PRIVATE_SYNTHETIC_COOKIE|Rejected Example/,
      );
      expect(
        await page.evaluate(() => JSON.stringify(localStorage)),
      ).not.toMatch(/Deniz|Mira|Rejected Example/);
      await page.getByRole("button", { name: "Clear imported data" }).click();
      await expect(
        page.getByRole("heading", { name: "Import coverage" }),
      ).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Import coverage" }),
      ).toHaveCount(0);
    });
  test("HTML stays inert and malformed input recovers without stale results", async ({
    page,
  }) => {
    const attempted: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("private.invalid"))
        attempted.push(request.url());
    });
    await page.goto("/facebook/");
    const html = facebookHtml([
      {
        name: '<img src="https://private.invalid/name" onerror="window.fbExecuted=true">',
        date: "bad date",
      },
    ])
      .replace(
        "</head>",
        '<script>window.fbExecuted=true</script><link rel="stylesheet" href="https://private.invalid/style"></head>',
      )
      .replace("</main>", '<img src="https://private.invalid/image"></main>');
    await page
      .getByLabel("Facebook JSON or HTML ZIP", { exact: true })
      .setInputFiles({
        name: "fictional.zip",
        mimeType: "application/zip",
        buffer: Buffer.from(facebookZip({ "your_friends.html": html })),
      });
    await expect(page.locator(".fb-year li")).toContainText(
      '<img src="https://private.invalid/name"',
    );
    expect(
      await page.evaluate(() => Reflect.get(window, "fbExecuted")),
    ).toBeUndefined();
    expect(attempted).toEqual([]);
    await page
      .getByLabel("Facebook JSON or HTML ZIP", { exact: true })
      .setInputFiles({
        name: "broken.zip",
        mimeType: "application/zip",
        buffer: Buffer.from("not a zip"),
      });
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "damaged",
    );
    await expect(page.locator(".fb-year li")).toHaveCount(0);
    await upload(page, "json");
    await expect(page.locator(".fb-year li")).toHaveCount(3);
  });
  test("a pending import can be cancelled and a fresh one succeeds", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      let first = true;
      window.Worker = class extends NativeWorker {
        postMessage(
          message: unknown,
          options: Transferable[] | StructuredSerializeOptions = [],
        ) {
          if (first) {
            first = false;
            return;
          }
          if (Array.isArray(options)) super.postMessage(message, options);
          else super.postMessage(message, options);
        }
      };
    });
    await page.goto("/facebook/");
    await page
      .getByLabel("Facebook JSON or HTML ZIP", { exact: true })
      .setInputFiles({
        name: "fictional.zip",
        mimeType: "application/zip",
        buffer: Buffer.from(syntheticFacebookZip("json")),
      });
    await page.getByRole("button", { name: "Cancel import" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "cancelled",
    );
    await upload(page, "html");
    await expect(page.locator(".fb-year li")).toHaveCount(3);
  });
});
