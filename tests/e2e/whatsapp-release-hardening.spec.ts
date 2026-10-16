import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.EXPECT_WHATSAPP === "true";
const chat = [
  "14/06/2026, 09:00 - Synthetic A: A fictional first message",
  "15/06/2026, 10:00 - Synthetic B: A fictional second message",
].join("\n");
const file = (text = chat) => ({
  name: "synthetic-release-chat.txt",
  mimeType: "text/plain",
  buffer: Buffer.from(text),
});
const picker = (page: Page) =>
  page.getByLabel("Upload WhatsApp chat export", { exact: true });
const navigation = (page: Page) =>
  page.getByRole("navigation", { name: "Main navigation", exact: true });
const importAlert = (page: Page) => page.getByRole("main").getByRole("alert");
const messageCount = (page: Page) =>
  page
    .locator(".wa-stat")
    .filter({
      has: page.getByText("Exported messages", { exact: true }),
    })
    .locator("strong");

async function inspect(page: Page, text = chat) {
  await expect(picker(page)).toBeEnabled();
  await picker(page).setInputFiles(file(text));
  await expect(
    page.getByRole("region", { name: "Detected export format", exact: true }),
  ).toBeVisible();
}

async function confirm(page: Page) {
  await page
    .getByLabel("Export date/time format", { exact: true })
    .selectOption("dmy-24h");
  await page
    .getByRole("button", {
      name: "Confirm format and open chat",
      exact: true,
    })
    .click();
}

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

test.describe("WhatsAppScope release boundaries", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");

  test("wrong, empty, oversized and unsupported imports recover without replacing the accepted source", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await expect(picker(page)).toBeEnabled();
    for (const [invalid, explanation] of [
      [
        { ...file(), name: "synthetic-wrong.json" },
        /file type is unsupported/i,
      ],
      [file(""), /file is empty/i],
      [{ ...file(), buffer: Buffer.from([0xff, 0xff]) }, /not valid UTF-8/i],
    ] as const) {
      await picker(page).setInputFiles(invalid);
      await expect(importAlert(page)).toContainText(explanation);
      await expect(picker(page)).toBeEnabled();
      await expect(messageCount(page)).toHaveCount(0);
      await fits(page);
    }
    // Exercise the real size guard without sending a large fixture through the
    // automation protocol or changing the browser's File implementation.
    await picker(page).evaluate((element) => {
      const input = element as HTMLInputElement;
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(
          [new Uint8Array(20 * 1024 * 1024 + 1)],
          "synthetic-oversized.txt",
          { type: "text/plain" },
        ),
      );
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(importAlert(page)).toContainText("20 MB safety limit");
    await expect(picker(page)).toBeEnabled();
    await inspect(page);
    await confirm(page);
    await expect(messageCount(page)).toHaveText("2");
    const doctor = page.getByRole("region", {
      name: "Chat Export Doctor",
      exact: true,
    });
    const originalDoctor = await doctor.textContent();

    await inspect(page, "Not a timestamped chat export");
    await expect(
      page.getByRole("button", {
        name: "Confirm format and open chat",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(messageCount(page)).toHaveText("2");
    await page
      .getByRole("button", { name: "Cancel import", exact: true })
      .click();

    await inspect(
      page,
      "14/06/2026, 09:00 - A fictional senderless system event",
    );
    await confirm(page);
    await expect(importAlert(page)).toContainText(
      "system events but no sender messages",
    );
    await expect(importAlert(page)).toContainText(
      "current chat is still available",
    );
    await expect(messageCount(page)).toHaveText("2");
    await expect(doctor).toHaveText(originalDoctor!);

    await inspect(
      page,
      "16/06/2026, 11:00 - Synthetic Solo: One fictional message",
    );
    await confirm(page);
    await expect(messageCount(page)).toHaveText("1");
    await expect(importAlert(page)).toHaveCount(0);
    await expect(page.locator(".wa-recorded-times")).toContainText(
      "0 d 0 h 0 min",
    );
    await fits(page);
  });

  test("a pending overview import may finish on another tool without redirecting the current route", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const probe = { held: false, released: false, completed: false };
      Object.assign(window, { waReleaseImport: probe });
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        postMessage(message: unknown) {
          if (
            message &&
            typeof message === "object" &&
            "format" in message &&
            "files" in message
          ) {
            probe.held = true;
            Object.assign(window, {
              releaseWaImport: () => {
                probe.released = true;
                super.postMessage(message);
              },
            });
            this.addEventListener(
              "message",
              () => {
                probe.completed = true;
              },
              { once: true },
            );
          } else super.postMessage(message);
        }
      } as typeof Worker;
    });
    await page.goto("/whatsapp/");
    await inspect(page);
    await confirm(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { waReleaseImport: { held: boolean } })
              .waReleaseImport.held,
        ),
      )
      .toBe(true);
    await navigation(page)
      .getByRole("link", { name: "Wrapped", exact: true })
      .click();
    await expect(page).toHaveURL(/\/whatsapp\/wrapped\/$/);
    await expect(page.locator("main")).toHaveAttribute(
      "data-whatsapp-mode",
      "wrapped",
    );
    await page.evaluate(() =>
      (window as unknown as { releaseWaImport: () => void }).releaseWaImport(),
    );
    await expect(
      page.getByRole("region", { name: "WhatsApp Wrapped", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".wa-current-chat")).toContainText("2 messages");
    await expect(page).toHaveURL(/\/whatsapp\/wrapped\/$/);
    await expect(
      navigation(page).getByRole("link", { name: "Wrapped", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await fits(page);
    await navigation(page)
      .getByRole("link", { name: "Chat Analyzer", exact: true })
      .click();
    await expect(messageCount(page)).toHaveText("2");
    await expect(
      page.getByRole("region", { name: "Chat Export Doctor", exact: true }),
    ).toBeVisible();
    await fits(page);
  });

  test("direct routes, browser history, refresh and invalid routes preserve deliberate ephemeral navigation", async ({
    page,
    request,
  }) => {
    await page.goto("/whatsapp/");
    await inspect(page);
    await confirm(page);
    await expect(page).toHaveURL(/\/whatsapp\/chat-analyzer\/$/);
    await expect(messageCount(page)).toHaveText("2");
    await navigation(page)
      .getByRole("link", { name: "Wrapped", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "WhatsApp Wrapped", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/whatsapp\/chat-analyzer\/$/);
    await expect(messageCount(page)).toHaveText("2");
    await expect(
      navigation(page).getByRole("link", {
        name: "Chat Analyzer",
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    await page.goForward();
    await expect(page).toHaveURL(/\/whatsapp\/wrapped\/$/);
    await expect(
      page.getByRole("region", { name: "WhatsApp Wrapped", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("region", { name: "WhatsApp Wrapped", exact: true }),
    ).toHaveCount(0);
    await expect(picker(page)).toBeEnabled();
    await expect(
      navigation(page).getByRole("link", { name: "Wrapped", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await fits(page);
    for (const path of [
      "/whatsapp/",
      "/whatsapp/chat-analyzer/",
      "/whatsapp/wrapped/",
      "/whatsapp/chat-vault/",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
      await expect(
        navigation(page).locator('a[aria-current="page"]'),
      ).toHaveAttribute("href", path);
      await fits(page);
    }
    expect((await request.get("/whatsapp/not-a-tool/")).status()).toBe(404);
  });
});
