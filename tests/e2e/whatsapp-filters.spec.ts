import { expect, test, type Locator, type Page } from "@playwright/test";
import { isSafeDocumentEntryRequest } from "../helpers/analytics";

const enabled = process.env.EXPECT_WHATSAPP === "true";

// Synthetic source evidence only. Includes a leap date, both year boundaries,
// attributable call/media records, and call/system records without a sender.
const syntheticChat = [
  "28/12/2023, 23:00 - Synthetic A: First recorded message",
  "31/12/2023, 23:00 - Synthetic B: End of year",
  "01/01/2024, 00:00 - Synthetic A: New year",
  "28/02/2024, 08:00 - Synthetic A: Before leap day",
  "29/02/2024, 08:00 - Synthetic A: <Media omitted>",
  "29/02/2024, 09:00 - Synthetic B: https://example.invalid/synthetic 🙂",
  "29/02/2024, 10:00 - Synthetic A: [Anruf]",
  "29/02/2024, 11:00 - [Anruf]",
  "01/03/2024, 08:00 - Synthetic B: March message",
  "02/03/2024, 08:00 - Synthetic A: Final range boundary",
  "02/03/2024, 09:00 - Messages are encrypted.",
  "31/12/2024, 23:00 - Synthetic B: Another year boundary",
  "01/01/2025, 00:00 - Synthetic A: A new calendar year",
  "03/01/2025, 17:00 - Synthetic B: Final recorded message",
].join("\n");

const textFile = (text = syntheticChat) => ({
  name: "synthetic-filter-chat.txt",
  mimeType: "text/plain",
  buffer: Buffer.from(text),
});

const filters = (page: Page) =>
  page.getByRole("region", { name: "Analysis filters", exact: true });
const overview = (page: Page) =>
  page.getByRole("region", { name: "Filtered chat overview", exact: true });
const heatmap = (page: Page) =>
  page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Activity by recorded weekday and hour",
      exact: true,
    }),
  });

async function stat(page: Page, label: string, value: string) {
  const record = overview(page)
    .locator(".wa-stat")
    .filter({ has: page.getByText(label, { exact: true }) });
  await expect(record.locator("strong")).toHaveText(value);
}

async function chartValue(panel: Locator, label: string, value: number) {
  await expect(
    panel.locator(".wa-chart-column").filter({ hasText: label }),
  ).toHaveAttribute("title", `${label}: ${value} messages`);
}

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

async function acceptChat(page: Page, text = syntheticChat) {
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles(textFile(text));
  await expect(
    page.getByRole("region", { name: "Detected export format" }),
  ).toBeVisible();
  await page
    .getByLabel("Export date/time format", { exact: true })
    .selectOption("dmy-24h");
  await page
    .getByRole("button", { name: "Confirm format and open chat" })
    .click();
  await expect(filters(page)).toBeVisible();
}

async function selectDateFilter(page: Page, label: string) {
  await filters(page)
    .getByRole("combobox", { name: "Date filter", exact: true })
    .selectOption({ label });
}

async function range(page: Page, from: string, to: string) {
  await selectDateFilter(page, "Custom date range");
  await filters(page).getByLabel("From date", { exact: true }).fill(from);
  await filters(page).getByLabel("To date", { exact: true }).fill(to);
}

test.describe("WhatsAppScope local analysis filters", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");

  test("all-time, year and month filters recompute existing charts and reset to the full source", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    await expect(filters(page).getByRole("status")).toHaveText(
      "Showing: All time · Everyone",
    );
    await stat(page, "Exported messages", "12");
    await stat(page, "Active dates", "10");
    await stat(page, "Messages per active date", "1.2");
    await stat(page, "Recognized media messages", "1");
    await stat(page, "Link occurrences", "1");
    await stat(page, "Recognized call events", "2");
    await chartValue(page.locator(".wa-years-panel"), "2023", 2);
    await chartValue(page.locator(".wa-years-panel"), "2024", 8);
    await chartValue(page.locator(".wa-years-panel"), "2025", 2);

    await selectDateFilter(page, "Specific year");
    await filters(page)
      .getByRole("combobox", { name: "Year", exact: true })
      .selectOption("2024");
    await stat(page, "Exported messages", "8");
    await stat(page, "Active dates", "6");
    await expect(page.locator(".wa-years-panel .wa-chart-column")).toHaveCount(
      1,
    );
    await chartValue(page.locator(".wa-years-panel"), "2024", 8);
    await expect(filters(page).getByRole("status")).toContainText("2024");

    await selectDateFilter(page, "Specific month");
    await filters(page)
      .getByRole("combobox", { name: "Month", exact: true })
      .selectOption("2024-02");
    await stat(page, "Exported messages", "4");
    await stat(page, "Active dates", "2");
    await stat(page, "Messages per active date", "2");
    await expect(page.locator(".wa-months-panel .wa-chart-column")).toHaveCount(
      1,
    );
    await chartValue(page.locator(".wa-months-panel"), "Feb 2024", 4);
    await chartValue(page.locator(".wa-hours-panel"), "08:00", 2);
    await chartValue(page.locator(".wa-hours-panel"), "09:00", 1);
    await chartValue(page.locator(".wa-hours-panel"), "10:00", 1);
    await expect(page.locator(".wa-calendar-month")).toHaveText(
      "February 2024",
    );
    await expect(
      page.getByRole("gridcell", {
        name: /29 February 2024: 3 exported messages/,
      }),
    ).toBeVisible();
    await fits(page);

    await filters(page).getByRole("button", { name: "Reset filters" }).click();
    await expect(filters(page).getByRole("status")).toHaveText(
      "Showing: All time · Everyone",
    );
    await stat(page, "Exported messages", "12");
    await expect(page.locator(".wa-years-panel .wa-chart-column")).toHaveCount(
      3,
    );
    await fits(page);
  });

  test("inclusive date and participant filters preserve attribution limits, streaks and message-gap semantics", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    const doctor = page.getByRole("region", { name: "Chat Export Doctor" });
    const originalDoctor = (await doctor.textContent())!;
    const originalBanner = (await page
      .locator(".wa-current-chat")
      .textContent())!;
    await range(page, "2024-02-28", "2024-03-02");
    await stat(page, "Exported messages", "6");
    await stat(page, "Active dates", "4");
    await expect(page.locator(".wa-small-facts")).toContainText("4 dates");
    await expect(page.locator(".wa-recorded-times")).toContainText(
      "2024-02-28",
    );
    await expect(page.locator(".wa-recorded-times")).toContainText(
      "2024-03-02",
    );

    await filters(page)
      .getByRole("combobox", { name: "Participant", exact: true })
      .selectOption({ label: "Synthetic A" });
    await stat(page, "Exported messages", "4");
    await stat(page, "Active dates", "3");
    await stat(page, "Recognized media messages", "1");
    await stat(page, "Link occurrences", "0");
    await stat(page, "Recognized call events", "1");
    await expect(overview(page)).toContainText(/attributable.*participant/i);
    await expect(page.locator(".wa-participant-row")).toHaveCount(1);
    await expect(page.locator(".wa-participant-row")).toContainText(
      "Synthetic A",
    );
    const smallFacts = page.locator(".wa-small-facts");
    await expect(smallFacts).toContainText(
      "Longest consecutive run of this participant’s active dates",
    );
    await expect(smallFacts).toContainText("2 dates");
    await expect(smallFacts).toContainText(
      "Longest recorded interval between this participant’s messages",
    );
    await expect(smallFacts).toContainText("46 h 0 min");
    await expect(smallFacts).toContainText(
      "not conversation silence or other participants’ activity",
    );
    await expect(
      page
        .locator(".wa-extra-counts > div")
        .filter({ hasText: "Recorded system events" })
        .locator("dd"),
    ).toHaveText("0");

    await filters(page)
      .getByRole("combobox", { name: "Participant", exact: true })
      .selectOption({ label: "Synthetic B" });
    await stat(page, "Exported messages", "2");
    await stat(page, "Recognized media messages", "0");
    await stat(page, "Link occurrences", "1");
    await stat(page, "Recognized call events", "0");
    await chartValue(page.locator(".wa-hours-panel"), "09:00", 1);
    await chartValue(page.locator(".wa-hours-panel"), "08:00", 1);
    await expect(doctor).toHaveText(originalDoctor);
    await expect(page.locator(".wa-current-chat")).toHaveText(originalBanner);
    await fits(page);

    await filters(page).getByRole("button", { name: "Reset filters" }).click();
    await filters(page)
      .getByRole("combobox", { name: "Participant", exact: true })
      .selectOption({ label: "Synthetic A" });
    await stat(page, "Exported messages", "7");
    await stat(page, "Recognized call events", "1");
    await expect(doctor).toHaveText(originalDoctor);
  });

  test("weekday-hour heatmap exposes exact 7 by 24 wall-clock counts and keyboard-readable values", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    await selectDateFilter(page, "Specific month");
    await filters(page)
      .getByRole("combobox", { name: "Month", exact: true })
      .selectOption("2024-02");
    const matrix = heatmap(page);
    await expect(matrix.getByRole("cell")).toHaveCount(7 * 24);
    for (const [weekday, hour, count] of [
      ["Wednesday", "08", 1],
      ["Thursday", "08", 1],
      ["Thursday", "09", 1],
      ["Thursday", "10", 1],
      ["Thursday", "11", 0],
      ["Monday", "00", 0],
      ["Sunday", "23", 0],
    ] as const) {
      const label = `${weekday}, ${hour}:00: ${count} exported participant messages`;
      await expect(
        matrix.getByRole("cell", { name: label, exact: true }),
      ).toHaveAttribute("title", label);
    }
    await expect(matrix).toContainText(/recorded|wall-clock/i);
    await expect(matrix).toContainText("without an inferred timezone");
    await expect(matrix).toContainText("they do not show online presence");
    const readValues = matrix.getByText("Read weekday and hour values", {
      exact: true,
    });
    await readValues.focus();
    await page.keyboard.press("Enter");
    await expect(matrix.locator("details")).toHaveAttribute("open", "");
    await expect(matrix.locator("details")).toContainText("Thursday");
    await expect(matrix.locator("details")).toContainText("08:00");
    await fits(page);

    await filters(page)
      .getByRole("combobox", { name: "Participant", exact: true })
      .selectOption({ label: "Synthetic A" });
    await expect(
      matrix.getByRole("cell", {
        name: "Thursday, 09:00: 0 exported participant messages",
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(
      matrix.getByRole("cell", {
        name: "Thursday, 10:00: 1 exported participant messages",
        exact: true,
      }),
    ).toHaveCount(1);
    await fits(page);
  });

  test("invalid and empty ranges are honest and a single inclusive leap date remains valid", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    await range(page, "2024-03-02", "2024-02-28");
    await expect(page.locator(".wa-filter-error")).toBeVisible();
    await expect(overview(page)).toHaveCount(0);

    await range(page, "2024-02-29", "2024-02-29");
    await expect(page.locator(".wa-filter-error")).toHaveCount(0);
    await stat(page, "Exported messages", "3");
    await stat(page, "Active dates", "1");
    await stat(page, "Recognized call events", "2");
    await fits(page);

    await range(page, "2024-04-01", "2024-04-30");
    await stat(page, "Exported messages", "0");
    await stat(page, "Active dates", "0");
    await stat(page, "Messages per active date", "Unavailable");
    await expect(
      page
        .locator(".wa-recorded-times > div")
        .filter({
          has: page.getByText("Observed span in written clock values", {
            exact: true,
          }),
        })
        .locator("dd"),
    ).toHaveText("Unavailable");
    const unavailable = overview(page).locator(".wa-stat-unavailable");
    expect(
      await unavailable.evaluate(
        (element) =>
          element.getBoundingClientRect().height <=
          parseFloat(getComputedStyle(element).fontSize) * 1.5,
      ),
    ).toBe(true);
    await stat(page, "Recognized call events", "0");
    await expect(
      page.getByRole("heading", {
        name: "No exported messages match these filters.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(filters(page).getByRole("status")).toContainText("2024-04");
    await expect(page.locator(".wa-current-chat")).toContainText("12 messages");
    await fits(page);
    await filters(page).getByRole("button", { name: "Reset filters" }).click();
    await stat(page, "Exported messages", "12");
  });

  test("filtering never reparses or transmits the source, and Wrapped continues to use the accepted source", async ({
    page,
  }) => {
    const outgoing: string[] = [];
    const documentEntries: string[] = [];
    await page.addInitScript(() => {
      const metrics = { parseRequests: 0 };
      Object.assign(window, {
        waFilterWorkerMetrics: metrics,
        waFilterEvents: [],
      });
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        postMessage(
          message: unknown,
          options?: Transferable[] | StructuredSerializeOptions,
        ) {
          if (
            message &&
            typeof message === "object" &&
            "format" in message &&
            "files" in message
          )
            metrics.parseRequests++;
          if (Array.isArray(options)) super.postMessage(message, options);
          else super.postMessage(message, options);
        }
      } as typeof Worker;
      window.addEventListener("instascope:event", (event) =>
        (
          window as unknown as { waFilterEvents: unknown[] }
        ).waFilterEvents.push((event as CustomEvent).detail),
      );
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      const documentEntry = isSafeDocumentEntryRequest(request);
      if (documentEntry) documentEntries.push(request.postData()!);
      if (
        (!["GET", "HEAD"].includes(request.method()) && !documentEntry) ||
        (url.origin !== "http://127.0.0.1:3000" && url.protocol !== "blob:")
      )
        outgoing.push(request.url());
    });
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    const parseRequests = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              waFilterWorkerMetrics: { parseRequests: number };
            }
          ).waFilterWorkerMetrics.parseRequests,
      );
    expect(await parseRequests()).toBe(1);
    const doctor = page.getByRole("region", { name: "Chat Export Doctor" });
    const doctorBefore = (await doctor.textContent())!;
    await range(page, "2024-02-29", "2024-02-29");
    await filters(page)
      .getByRole("combobox", { name: "Participant", exact: true })
      .selectOption({ label: "Synthetic A" });
    await stat(page, "Exported messages", "2");
    expect(await parseRequests()).toBe(1);
    await expect(doctor).toHaveText(doctorBefore);
    expect(page.url()).not.toContain("Synthetic");
    expect(outgoing).toEqual([]);
    expect(documentEntries.length).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((key) =>
          /whatsapp|chat|filter/i.test(key),
        ),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { waFilterEvents: unknown[] }).waFilterEvents,
      ),
    ).toEqual([{ event: "document_entry_observed" }]);

    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Wrapped", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "WhatsApp Wrapped" }),
    ).toBeVisible();
    await expect(page.locator(".wa-current-chat")).toContainText("12 messages");
    await expect(page.locator(".wa-story")).toHaveAttribute(
      "data-story-id",
      "words",
    );
    await page
      .getByRole("group", { name: "Choose a Wrapped card", exact: true })
      .getByRole("button", { name: /The conversation/ })
      .click();
    await expect(page.locator(".wa-story-value > strong")).toHaveText("12");
    await expect(filters(page)).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Chat Export Doctor" }),
    ).toHaveText(doctorBefore);
    expect(await parseRequests()).toBe(1);
    expect(documentEntries.length).toBeLessThanOrEqual(1);
    expect(outgoing).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { waFilterEvents: unknown[] }).waFilterEvents,
      ),
    ).toEqual([{ event: "document_entry_observed" }]);
    await fits(page);
  });

  test("a failed or cancelled replacement preserves filters while an accepted replacement resets them", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    await selectDateFilter(page, "Specific month");
    await filters(page)
      .getByRole("combobox", { name: "Month", exact: true })
      .selectOption("2024-02");
    await filters(page)
      .getByRole("combobox", { name: "Participant", exact: true })
      .selectOption({ label: "Synthetic A" });
    await stat(page, "Exported messages", "3");
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .setInputFiles(textFile("This is synthetic unsupported input."));
    const detection = page.getByRole("region", {
      name: "Detected export format",
    });
    await expect(
      detection.getByText("Unsupported", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm format and open chat" }),
    ).toBeDisabled();
    await stat(page, "Exported messages", "3");
    await expect(
      filters(page).getByRole("combobox", { name: "Month", exact: true }),
    ).toHaveValue("2024-02");
    await expect(
      filters(page).getByRole("combobox", { name: "Participant", exact: true }),
    ).toHaveValue(/participant-/);
    await page
      .getByRole("button", { name: "Cancel import", exact: true })
      .click();
    await stat(page, "Exported messages", "3");
    await acceptChat(
      page,
      "15/06/2026, 09:00 - Synthetic Replacement: First\n16/06/2026, 10:00 - Synthetic Replacement: Second",
    );
    await expect(filters(page).getByRole("status")).toHaveText(
      "Showing: All time · Everyone",
    );
    await stat(page, "Exported messages", "2");
    await stat(page, "Active dates", "2");
    await expect(
      filters(page).getByRole("combobox", { name: "Participant", exact: true }),
    ).toHaveValue("");
    await expect(
      filters(page).getByRole("combobox", { name: "Participant", exact: true }),
    ).not.toContainText("Synthetic A");
    await fits(page);
  });
});
