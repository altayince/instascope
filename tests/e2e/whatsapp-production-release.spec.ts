import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFile } from "node:fs/promises";
import {
  collectEvents,
  eventCount,
  isSafeDocumentEntryRequest,
  productEvents,
} from "../helpers/analytics";

// Actual browser imports and explicit saves produce both comparison records.
// No domain projections, seeded IndexedDB records, or private source fixtures.
function chat(later = false) {
  return [
    { day: 1, hour: 8, count: 4 },
    { day: 2, hour: 20, count: 4 },
    ...(later ? [{ day: 3, hour: 12, count: 16 }] : []),
  ]
    .flatMap(({ day, hour, count }) =>
      Array.from({ length: count }, (_, minute) => {
        const text =
          day === 1 && minute === 0
            ? "<Media omitted>"
            : `SYNTHETIC_RELEASE_PRIVATE_BODY https://synthetic-release-private.invalid/secret`;
        return `0${day}/01/2024, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} - SYNTHETIC_RELEASE_PRIVATE_LABEL_${minute % 2}: ${text}`;
      }),
    )
    .join("\n");
}

const navigation = (page: Page) =>
  page.getByRole("navigation", { name: "Main navigation", exact: true });
const rows = (page: Page) =>
  page.getByRole("article", { name: "Saved chat snapshot", exact: true });

for (const source of ["demo", "import"] as const) {
  test(`Doctor stays compact after ${source} with keyboard-accessible facts on Analyzer and Wrapped`, async ({
    page,
  }) => {
    await collectEvents(page);
    await page.goto("/whatsapp/chat-analyzer/");
    if (source === "demo") {
      await page
        .getByRole("button", { name: "Try the fictional demo", exact: true })
        .click();
    } else {
      await page
        .getByLabel("Upload WhatsApp chat export", { exact: true })
        .setInputFiles({
          name: "synthetic-coverage.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(chat()),
        });
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
    for (const mode of ["Chat Analyzer", "Wrapped"] as const) {
      if (mode === "Wrapped") {
        await navigation(page)
          .getByRole("link", { name: mode, exact: true })
          .click();
        await expect(
          page.getByRole("region", { name: "WhatsApp Wrapped", exact: true }),
        ).toBeVisible();
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
        ).toHaveText(source === "demo" ? "24" : "8");
      }
      const doctor = page.getByRole("region", {
        name: "Chat Export Doctor",
        exact: true,
      });
      const disclosure = doctor.locator(".wa-doctor-disclosure");
      const summary = disclosure.locator("summary");
      await expect(
        doctor.getByText("Supported", { exact: true }),
      ).toBeVisible();
      await expect(
        doctor.getByText(
          /timestamp-shaped records inspected.*participant labels/,
        ),
      ).toBeVisible();
      await expect(disclosure).not.toHaveAttribute("open");
      await expect(
        doctor.getByText("Timestamp wrapper", { exact: true }),
      ).toBeHidden();
      await expect(
        doctor.getByRole("heading", {
          name: "Source limitations",
          exact: true,
        }),
      ).toBeHidden();
      const compactHeight = (await doctor.boundingBox())!.height;
      expect(compactHeight).toBeLessThan(360);
      await expect(summary).toHaveAccessibleName(
        "Format details and source limitations",
      );
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(summary).toBeFocused();
      for (const label of [
        "Timestamp wrapper",
        "Confirmed date order",
        "Year width",
        "Clock style",
        "Source time precision",
        "Timestamp-shaped records inspected",
        "Participant labels found",
        "Unsupported-looking records",
        "Unclassified marker-like records",
        "Ignored preamble lines",
        "Ignored non-TXT ZIP files",
      ]) {
        await expect(doctor.getByText(label, { exact: true })).toBeVisible();
      }
      for (const title of [
        "Recognized event types",
        "Recognized localized markers",
        "Source limitations",
      ]) {
        await expect(
          doctor.getByRole("heading", { name: title, exact: true }),
        ).toBeVisible();
      }
      await expect(
        doctor.locator(".wa-doctor-limitations li").first(),
      ).toBeVisible();
      expect((await doctor.boundingBox())!.height).toBeGreaterThan(
        compactHeight + 300,
      );
      await summary.focus();
      await page.keyboard.press("Space");
      await expect(disclosure).not.toHaveAttribute("open");
      await expect(summary).toBeFocused();
      await expect(
        doctor.getByText("Supported", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
    // A rejected replacement must keep the accepted chat and its disclosure;
    // a successful replacement (including demo) starts compact again.
    const doctor = page.getByRole("region", {
      name: "Chat Export Doctor",
      exact: true,
    });
    const disclosure = doctor.locator(".wa-doctor-disclosure");
    await disclosure.locator("summary").click();
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles({
        name: "unsupported.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(
          "13/10/6, 9:00 - Synthetic: unsupported year width",
        ),
      });
    const detection = page.getByRole("region", {
      name: "Detected export format",
      exact: true,
    });
    await expect(
      detection.getByText("Unsupported", { exact: true }),
    ).toBeVisible();
    await expect(
      detection.getByText("Timestamp wrapper", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Confirm format and open chat",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(disclosure).toHaveAttribute("open", "");
    if (source === "demo") {
      await page
        .getByRole("button", { name: "Try the fictional demo", exact: true })
        .click();
    } else {
      await page
        .getByLabel("Upload WhatsApp chat export", { exact: true })
        .setInputFiles({
          name: "synthetic-replacement.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(chat(true)),
        });
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
    await expect(disclosure).not.toHaveAttribute("open");
    await expect(doctor.getByText("Supported", { exact: true })).toBeVisible();
  });
}

async function importAndSave(page: Page, later = false) {
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles({
      name: "SYNTHETIC_RELEASE_PRIVATE_FILENAME.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(chat(later)),
    });
  await expect(
    page.getByRole("region", { name: "Detected export format", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Export date/time format", { exact: true })
    .selectOption("dmy-24h");
  await page
    .getByRole("button", { name: "Confirm format and open chat", exact: true })
    .click();
  await expect(
    page
      .locator(".wa-stat")
      .filter({ has: page.getByText("Exported messages", { exact: true }) })
      .locator("strong"),
  ).toHaveText(later ? "24" : "8");
  await page
    .getByRole("button", { name: "Save to Chat Vault", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to Chat Vault" }),
  ).toBeVisible();
}

function expectPortraitPng(bytes: Buffer | Uint8Array) {
  const image = Buffer.from(bytes);
  expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(image.readUInt32BE(16)).toBe(1080);
  expect(image.readUInt32BE(20)).toBe(1920);
}

test("intentional release supports real local imports, Wrapped downloads, saved snapshots and Compare/Pulse", async ({
  page,
}) => {
  const delivered = await collectEvents(page);
  const privacy = await page.request.get("/privacy/");
  const analyticsEnabled = /data-analytics-endpoint="\/api\/events"/.test(
    await privacy.text(),
  );
  if (process.env.EXPECT_INDEXABLE === "true")
    expect(analyticsEnabled).toBe(true);
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    requests.push(`${request.url()} ${request.postData() ?? ""}`);
    expect(url.origin).toBe("http://127.0.0.1:3000");
    if (!["GET", "HEAD"].includes(request.method()))
      expect(isSafeDocumentEntryRequest(request)).toBe(true);
  });
  expect((await page.goto("/whatsapp/chat-analyzer/"))?.status()).toBe(200);
  await expect(
    page.getByLabel("Upload WhatsApp chat export", { exact: true }),
  ).toBeEnabled();
  await expect.poll(() => eventCount(page, "document_entry_observed")).toBe(1);
  await importAndSave(page);
  await navigation(page)
    .getByRole("link", { name: "Chat Vault", exact: true })
    .click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("8 messages");

  await navigation(page)
    .getByRole("link", { name: "Chat Analyzer", exact: true })
    .click();
  await importAndSave(page, true);
  await navigation(page)
    .getByRole("link", { name: "Wrapped", exact: true })
    .click();
  const deck = page.getByRole("region", {
    name: "WhatsApp Wrapped",
    exact: true,
  });
  const pngAction = deck.getByRole("button", {
    name: "Download PNG",
    exact: true,
  });
  await expect(pngAction).toBeEnabled();
  const receivedPng = page.waitForEvent("download");
  await pngAction.click();
  const png = await receivedPng;
  expect(png.suggestedFilename()).toMatch(/^instascope-whatsapp-[a-z-]+\.png$/);
  expectPortraitPng(await readFile((await png.path())!));

  const receivedZip = page.waitForEvent("download");
  await deck
    .getByRole("button", { name: "Export full deck", exact: true })
    .click();
  const archive = await receivedZip;
  expect(archive.suggestedFilename()).toBe(
    "instascope-whatsapp-wrapped-deck.zip",
  );
  const cards = unzipSync(await readFile((await archive.path())!));
  expect(Object.keys(cards).length).toBeGreaterThanOrEqual(2);
  expect(Object.keys(cards).length).toBeLessThanOrEqual(12);
  for (const [name, bytes] of Object.entries(cards)) {
    expect(name).toMatch(/^\d{2}-[a-z-]+\.png$/);
    expectPortraitPng(bytes);
  }

  await navigation(page)
    .getByRole("link", { name: "Chat Vault", exact: true })
    .click();
  await expect(rows(page)).toHaveCount(2);
  expect(await productEvents(page)).toEqual(["document_entry_observed"]);
  await expect.poll(() => delivered.length).toBe(analyticsEnabled ? 1 : 0);
  expect((await page.reload())?.status()).toBe(200);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).filter({ hasText: "8 messages" })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "24 messages" })).toHaveCount(1);
  await expect.poll(() => eventCount(page, "document_entry_observed")).toBe(1);

  await page
    .getByRole("combobox", { name: "First snapshot", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("combobox", { name: "Second snapshot", exact: true })
    .selectOption({ index: 2 });
  await page
    .getByRole("checkbox", {
      name: "I confirm these snapshots describe the same conversation.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Compare snapshots", exact: true })
    .click();
  const comparison = page.getByRole("region", {
    name: "Snapshot comparison",
    exact: true,
  });
  await expect(comparison).toBeVisible();
  await expect(
    comparison.getByRole("heading", {
      name: "Conversation Pulse",
      exact: true,
    }),
  ).toBeVisible();
  const totals = comparison.getByRole("row", { name: /^Exported messages/ });
  await expect(totals).toContainText("8");
  await expect(totals).toContainText("24");
  await expect(totals).toContainText("+16");
  await expect(comparison).not.toContainText("SYNTHETIC_RELEASE_PRIVATE");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    process.env.EXPECT_INDEXABLE === "false"
      ? "noindex, nofollow"
      : "index, follow",
  );
  expect(await productEvents(page)).toEqual(["document_entry_observed"]);
  await expect
    .poll(() => delivered)
    .toEqual(
      analyticsEnabled
        ? ["document_entry_observed", "document_entry_observed"]
        : [],
    );
  expect(requests.join("\n")).not.toMatch(
    /SYNTHETIC_RELEASE_PRIVATE|synthetic-release-private|secret/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
