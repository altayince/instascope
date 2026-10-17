import { expect, test, type Page } from "@playwright/test";
import { collectEvents } from "../helpers/analytics";
import { analyzeWhatsApp, createWhatsAppDemo } from "../../src/lib/whatsapp";

const expectedDemo = analyzeWhatsApp(createWhatsAppDemo());
const stepNames = [
  "Open a local export",
  "Explore the recorded facts",
  "Make your own Wrapped",
];
const steps = (page: Page) =>
  page.getByRole("navigation", { name: "How InstaScope works", exact: true });
const navigation = (page: Page) =>
  page.getByRole("navigation", { name: "Main navigation", exact: true });
const loadedChat = (page: Page) => page.locator(".wa-current-chat");

async function darkAndFits(page: Page) {
  // As in the shared visual suite, paint WebKit's background tab before
  // inspecting computed styles; retain exact color and overflow assertions.
  await page.screenshot({ scale: "css", animations: "disabled" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(9, 11, 10)",
  );
  await expect(page.locator("body")).toHaveCSS("color", "rgb(244, 246, 242)");
  await expect(page.locator("body")).not.toContainText(/WhatsAppScope/i);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

async function overview(page: Page) {
  await navigation(page)
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await expect(steps(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await collectEvents(page);
});

test("WhatsApp direct entry, refresh and platform switching retain the shared dark theme and a factual demo preview", async ({
  page,
}) => {
  const errors: string[] = [];
  const failedAssets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/_next/static/") && response.status() >= 400)
      failedAssets.push(response.url());
  });
  await page.goto("/whatsapp/");
  await expect(
    page.getByRole("button", { name: "Try a fictional demo", exact: true }),
  ).toBeEnabled();
  const preview = page.getByRole("region", {
    name: "Recorded chat facts",
    exact: true,
  });
  await expect(
    preview.getByText("Demo data · Fictional example", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText("InstaScope / WhatsApp", { exact: true }),
  ).toBeVisible();
  for (const [label, count] of [
    ["Exported messages", expectedDemo.totals.messages],
    ["Active dates", expectedDemo.totals.activeDays],
    ["Participant labels", expectedDemo.totals.participants],
    ["Media markers", expectedDemo.totals.mediaMessages],
  ] as const) {
    await expect(
      preview
        .locator(".wa-stat")
        .filter({ has: page.getByText(label, { exact: true }) })
        .locator("strong"),
    ).toHaveText(String(count));
  }
  await expect(preview.locator("button, a")).toHaveCount(0);
  await expect(
    page.locator(".wa-hero-art, .wa-art-heading, .wa-art-footer"),
  ).toHaveCount(0);
  await expect(preview).not.toContainText("01 / 03");
  await expect(loadedChat(page)).toHaveCount(0);
  await darkAndFits(page);
  await page.reload();
  await expect(preview).toBeVisible();
  await darkAndFits(page);
  const selector = page.locator(".social-switcher");
  await selector.locator("summary").click();
  await selector.getByRole("link", { name: /^Instagram/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".site-header")).toHaveAttribute(
    "data-platform",
    "instagram",
  );
  await darkAndFits(page);
  await selector.locator("summary").click();
  await selector.getByRole("link", { name: /^WhatsApp/ }).click();
  await expect(page).toHaveURL(/\/whatsapp\/$/);
  await expect(preview).toBeVisible();
  await darkAndFits(page);
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

for (const [index, route] of [
  "/whatsapp/",
  "/whatsapp/chat-analyzer/",
  "/whatsapp/wrapped/",
].entries()) {
  test(`landing step ${index + 1} with no chat provides an accessible import/demo entry`, async ({
    page,
  }) => {
    await page.goto("/whatsapp/");
    const action = steps(page).getByRole("link", {
      name: new RegExp(stepNames[index]),
    });
    if (index > 0)
      await expect(action).toContainText("Import a chat or try the demo");
    await action.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${route}#wa-import-title$`));
    await expect(page.locator("#wa-import-title")).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Open chat export", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Try the fictional demo", exact: true }),
    ).toBeEnabled();
    await expect(loadedChat(page)).toHaveCount(0);
    await expect(page.locator(".wa-wrapped")).toHaveCount(0);
    await darkAndFits(page);
    await page
      .getByRole("button", { name: "Try the fictional demo", exact: true })
      .click();
    await expect(loadedChat(page)).toContainText("24 messages");
    if (index === 2) {
      await expect(
        page.getByRole("button", { name: "Download PNG", exact: true }),
      ).toBeEnabled();
    } else {
      await expect(
        page
          .locator(".wa-stat")
          .filter({
            has: page.getByText("Exported messages", { exact: true }),
          })
          .locator("strong"),
      ).toHaveText("24");
    }
  });
}

for (const source of ["demo", "imported"] as const) {
  test(`all landing steps preserve the ${source} chat instead of replacing it with preview data`, async ({
    page,
  }) => {
    await page.goto("/whatsapp/");
    if (source === "demo") {
      await page
        .getByRole("button", { name: "Try a fictional demo", exact: true })
        .click();
    } else {
      await page
        .getByLabel("Upload WhatsApp chat export", { exact: true })
        .setInputFiles({
          name: "synthetic-landing.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(
            [
              "14/03/2026, 09:00 - Synthetic A: First synthetic message",
              "14/03/2026, 09:01 - Synthetic B: Second synthetic message",
              "15/03/2026, 10:00 - Synthetic A: Third synthetic message",
              "15/03/2026, 10:01 - Synthetic B: Fourth synthetic message",
            ].join("\n"),
          ),
        });
      await page
        .getByRole("button", {
          name: "Confirm format and open chat",
          exact: true,
        })
        .click();
    }
    await expect(page).toHaveURL(/\/whatsapp\/chat-analyzer\/$/);
    const count = source === "demo" ? 24 : 4;
    const heading =
      source === "demo" ? "Fictional demo chat" : "Chat loaded locally";
    await expect(loadedChat(page)).toContainText(heading);
    await expect(loadedChat(page)).toContainText(`${count} messages`);
    const original = (await loadedChat(page).textContent())!;
    await overview(page);
    await expect(
      page
        .locator(".wa-hero")
        .getByRole("button", { name: "Try a fictional demo", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name: "Continue to Chat Analyzer",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".wa-landing-preview .wa-stat-featured strong"),
    ).toHaveText("24");

    await steps(page)
      .getByRole("link", { name: new RegExp(stepNames[0]) })
      .click();
    await expect(page.locator("#wa-import-title")).toBeFocused();
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Open another chat export", exact: true })
      .click();
    await chooser; // Opening the picker does not replace the accepted chat.
    await expect(loadedChat(page)).toHaveText(original);

    await steps(page)
      .getByRole("link", { name: new RegExp(stepNames[1]) })
      .click();
    await expect(page).toHaveURL(/\/whatsapp\/chat-analyzer\/$/);
    await expect(loadedChat(page)).toHaveText(original);
    await expect(
      page
        .locator(".wa-stat")
        .filter({ has: page.getByText("Exported messages", { exact: true }) })
        .locator("strong"),
    ).toHaveText(String(count));
    await overview(page);

    await steps(page)
      .getByRole("link", { name: new RegExp(stepNames[2]) })
      .click();
    await expect(page).toHaveURL(/\/whatsapp\/wrapped\/$/);
    await expect(loadedChat(page)).toHaveText(original);
    await expect(
      page.getByRole("button", { name: "Download PNG", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".wa-story-value strong")).toHaveText(
      String(count),
    );
    await overview(page);
    await expect(loadedChat(page)).toHaveText(original);
    await darkAndFits(page);
  });
}
