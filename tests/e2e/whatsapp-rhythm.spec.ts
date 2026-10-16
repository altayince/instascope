import { expect, test, type Locator, type Page } from "@playwright/test";
import { isSafeDocumentEntryRequest } from "../helpers/analytics";

const enabled = process.env.EXPECT_WHATSAPP === "true";
const bodyMarker = "SYNTHETIC_RHYTHM_BODY_MUST_STAY_LOCAL";

// Synthetic records only. The 30-minute session boundary, 5-minute rapid
// boundary and 6-hour long-gap boundary are deliberate; senderless events do
// not bridge the 31-minute participant-message interval.
const twoPersonChat = [
  `14/06/2026, 08:00:00 - Synthetic A: ${bodyMarker}`,
  "14/06/2026, 08:00:30 - Synthetic B: Synthetic second message",
  "14/06/2026, 08:01:00 - Synthetic B: Same sender again",
  "14/06/2026, 08:06:00 - Synthetic A: Five-minute transition",
  "14/06/2026, 08:36:00 - Synthetic B: Thirty-minute transition",
  "14/06/2026, 08:50:00 - Synthetic system event without a sender.",
  "14/06/2026, 09:07:00 - Synthetic A: New recorded session",
  "14/06/2026, 15:07:00 - Synthetic B: Exactly six hours",
  "14/06/2026, 15:08:00 - Synthetic A: One-minute transition",
  "14/06/2026, 22:08:00 - Synthetic B: Seven-hour gap",
  "14/06/2026, 22:14:00 - Synthetic A: Six-minute transition",
  "15/06/2026, 07:00:00 - Synthetic B: First message inside date subset",
  "15/06/2026, 07:00:00 - Synthetic A: Equal recorded timestamp",
].join("\n");

const longParticipant = `Synthetic C ${"LongExportedLabel".repeat(12)}`;
const groupChat = [
  "16/06/2026, 08:00 - Synthetic A: Group start",
  "16/06/2026, 08:01 - Synthetic B: Next group label",
  `16/06/2026, 08:04 - ${longParticipant}: Third group label`,
  "16/06/2026, 08:09 - Synthetic A: Five-minute switch",
  "16/06/2026, 08:40 - Synthetic B: Second session",
  `16/06/2026, 14:40 - ${longParticipant}: Six-hour gap`,
  "16/06/2026, 14:41 - Synthetic A: One-minute switch",
  `16/06/2026, 15:12 - ${longParticipant}: Fourth session`,
  "16/06/2026, 15:13 - Synthetic B: Another one-minute switch",
  "16/06/2026, 21:13 - Synthetic A: Another six-hour gap",
  `16/06/2026, 21:14 - ${longParticipant}: Final date switch`,
  "17/06/2026, 05:14 - Synthetic B: Eight-hour gap",
].join("\n");

const paginationLabels = Array.from(
  { length: 10 },
  (_, index) => `Synthetic Paginated ${String(index).padStart(2, "0")}`,
);
const paginatedChat = paginationLabels
  .map(
    (label, index) =>
      `19/06/2026, 08:${String(index).padStart(2, "0")} - ${label}: Synthetic group record`,
  )
  .join("\n");

const filters = (page: Page) =>
  page.getByRole("region", { name: "Analysis filters", exact: true });
const rhythm = (page: Page) =>
  page.getByRole("region", { name: "Rhythm & Dynamics", exact: true });
const overview = (page: Page) =>
  page.getByRole("region", { name: "Filtered chat overview", exact: true });
const participantTable = (page: Page) =>
  rhythm(page).getByRole("table", {
    name: "Participant rhythm in the selected dates",
    exact: true,
  });

async function acceptChat(page: Page, text = twoPersonChat) {
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles({
      name: "synthetic-rhythm-chat.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(text),
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
  await expect(rhythm(page)).toBeVisible();
}

async function summary(page: Page, label: string, value: string) {
  const term = rhythm(page)
    .locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) });
  await expect(term).toHaveCount(1);
  await expect(term.locator("xpath=following-sibling::dd[1]")).toHaveText(
    value,
  );
}

async function messageCount(page: Page, count: number) {
  await expect(
    overview(page)
      .locator(".wa-stat")
      .filter({ has: page.getByText("Exported messages", { exact: true }) })
      .locator("strong"),
  ).toHaveText(String(count));
}

function participantRow(page: Page, label: string) {
  return participantTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) });
}

async function rowValues(row: Locator, values: string[]) {
  const cells = row.getByRole("cell");
  for (let index = 0; index < values.length; index++) {
    await expect(cells.nth(index)).toHaveText(values[index]);
  }
}

async function distribution(page: Page, counts: number[]) {
  const list = rhythm(page).getByRole("list", {
    name: "Transition delay counts",
    exact: true,
  });
  await assertDelayCounts(page, list, counts);
}

async function assertDelayCounts(page: Page, list: Locator, counts: number[]) {
  const labels = [
    "Under 1 minute",
    "1 minute to under 5 minutes",
    "5 minutes to under 30 minutes",
    "30 minutes to under 6 hours",
    "6 hours or more",
  ];
  await expect(list.getByRole("listitem")).toHaveCount(labels.length);
  for (let index = 0; index < labels.length; index++) {
    const item = list.getByRole("listitem").filter({
      has: page.getByText(labels[index], { exact: true }),
    });
    await expect(item.locator("strong")).toHaveText(String(counts[index]));
  }
}

async function range(page: Page, from: string, to: string) {
  await filters(page)
    .getByRole("combobox", { name: "Date filter", exact: true })
    .selectOption({ label: "Custom date range" });
  await filters(page).getByLabel("From date", { exact: true }).fill(from);
  await filters(page).getByLabel("To date", { exact: true }).fill(to);
}

async function selectParticipant(page: Page, label: string) {
  await filters(page)
    .getByRole("combobox", { name: "Participant", exact: true })
    .selectOption({ label });
}

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

test.describe("WhatsAppScope factual conversation rhythm", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");

  test("two-person timing uses participant adjacency and documented session, rapid and long-gap boundaries", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    await messageCount(page, 12);
    for (const [label, value] of [
      ["Recorded sessions", "5"],
      ["Median messages per session", "2"],
      ["Longest session by messages", "5 messages"],
      ["Longest session by recorded span", "36 min"],
      ["Qualifying long gaps", "3"],
      ["Median qualifying gap", "7 h"],
      ["Longest qualifying gap", "8 h 46 min"],
      ["Participant transitions", "10"],
      ["Median transition delay", "18 min"],
      ["P25 transition delay", "2 min"],
      ["P75 transition delay", "4 h 37 min 45 s"],
      ["Rapid transitions", "4"],
    ]) {
      await summary(page, label, value);
    }
    await distribution(page, [2, 1, 2, 2, 3]);
    await rowValues(participantRow(page, "Synthetic A"), [
      "2",
      "0",
      "5 (tied)",
      "5 min",
      "1 min",
      "6 min",
      "3",
      "60%",
    ]);
    await rowValues(participantRow(page, "Synthetic B"), [
      "3",
      "3",
      "5 (tied)",
      "6 h",
      "30 min",
      "7 h",
      "1",
      "20%",
    ]);
    await expect(rhythm(page)).toContainText(/equal timestamps/i);
    await expect(rhythm(page)).not.toContainText(bodyMarker);
    await fits(page);
  });

  test("group next-sender counts remain factual, exact ties are explicit and long participant labels fit", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page, groupChat);
    await summary(page, "Recorded sessions", "6");
    await summary(page, "Median messages per session", "2");
    await summary(page, "Longest session by messages", "4 messages");
    await summary(page, "Longest session by recorded span", "9 min");
    await summary(page, "Qualifying long gaps", "3");
    await summary(page, "Median qualifying gap", "6 h");
    await summary(page, "Longest qualifying gap", "8 h");
    await summary(page, "Participant transitions", "11");
    await summary(page, "Rapid transitions", "6");
    await distribution(page, [0, 5, 1, 2, 3]);
    await expect(participantTable(page).getByRole("rowheader")).toHaveCount(3);
    for (const label of ["Synthetic A", "Synthetic B", longParticipant]) {
      const cells = participantRow(page, label).getByRole("cell");
      await expect(cells.nth(0)).toHaveText("2 (tied)");
      await expect(cells.nth(1)).toHaveText("1 (tied)");
      await expect(cells.nth(6)).toHaveText("2 (tied)");
    }
    await expect(
      participantRow(page, "Synthetic A").getByRole("cell").nth(2),
    ).toHaveText("3");
    await expect(
      participantRow(page, "Synthetic B").getByRole("cell").nth(2),
    ).toHaveText("4 (tied)");
    await expect(
      participantRow(page, longParticipant).getByRole("cell").nth(2),
    ).toHaveText("4 (tied)");
    await expect(
      participantRow(page, "Synthetic A").getByRole("cell").nth(3),
    ).toHaveText("5 min");
    await expect(
      participantRow(page, "Synthetic B").getByRole("cell").nth(3),
    ).toHaveText("16 min");
    await expect(
      participantRow(page, longParticipant).getByRole("cell").nth(3),
    ).toHaveText("17 min");
    await expect(
      participantRow(page, "Synthetic A").getByRole("cell").nth(7),
    ).toHaveText("66.7%");
    for (const label of ["Synthetic B", longParticipant]) {
      await expect(
        participantRow(page, label).getByRole("cell").nth(7),
      ).toHaveText("50% (tied)");
    }
    await expect(
      rhythm(page).getByRole("heading", {
        name: /winner|fastest|most caring|chemistry|response time|reply time/i,
      }),
    ).toHaveCount(0);
    await fits(page);

    await acceptChat(page, paginatedChat);
    await summary(page, "Recorded sessions", "1");
    await summary(page, "Participant transitions", "9");
    await expect(participantTable(page).getByRole("rowheader")).toHaveText(
      paginationLabels.slice(0, 8),
    );
    const previous = rhythm(page).getByRole("button", {
      name: "Previous rhythm participants",
      exact: true,
    });
    const next = rhythm(page).getByRole("button", {
      name: "Next rhythm participants",
      exact: true,
    });
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(participantTable(page).getByRole("rowheader")).toHaveText(
      paginationLabels.slice(8),
    );
    await expect(next).toBeDisabled();
    await expect(previous).toBeEnabled();
    for (const label of paginationLabels.slice(8)) {
      await rowValues(participantRow(page, label), [
        "0 (tied)",
        "0 (tied)",
        "1 (tied)",
        "1 min (tied)",
        "1 min (tied)",
        "1 min (tied)",
        "1 (tied)",
        "100% (tied)",
      ]);
      await expect(
        participantRow(page, label).getByRole("cell").nth(2),
      ).toHaveAttribute(
        "aria-label",
        `${label}: Next-sender transitions: 1 (tied)`,
      );
    }
    await fits(page);
    await previous.click();
    await expect(participantTable(page).getByRole("rowheader")).toHaveText(
      paginationLabels.slice(0, 8),
    );
    await fits(page);
  });

  test("date boundaries recompute inside the subset, one label disables dynamics, and empty dates and reset are honest", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    await range(page, "2026-06-15", "2026-06-15");
    await messageCount(page, 2);
    await summary(page, "Recorded sessions", "1");
    await summary(page, "Median messages per session", "2");
    await summary(page, "Longest session by recorded span", "0 s");
    await summary(page, "Qualifying long gaps", "0");
    await summary(page, "Median qualifying gap", "Unavailable");
    await summary(page, "Participant transitions", "1");
    await summary(page, "Median transition delay", "0 s");
    await summary(page, "Rapid transitions", "1");
    await distribution(page, [1, 0, 0, 0, 0]);
    await expect(
      participantRow(page, "Synthetic B").getByRole("cell").nth(0),
    ).toHaveText("1");
    await expect(
      participantRow(page, "Synthetic B").getByRole("cell").nth(1),
    ).toHaveText("0 (tied)");

    await selectParticipant(page, "Synthetic A");
    await messageCount(page, 1);
    await expect(rhythm(page)).toContainText(
      "Conversation-relative dynamics are unavailable with one participant selected.",
    );
    await expect(rhythm(page)).toContainText("Select Everyone");
    await expect(participantTable(page)).toHaveCount(0);
    await expect(
      rhythm(page)
        .locator("dt")
        .filter({ hasText: /^Recorded sessions$/ }),
    ).toHaveCount(0);
    await expect(
      rhythm(page).getByRole("list", {
        name: "Transition delay counts",
        exact: true,
      }),
    ).toHaveCount(0);
    await fits(page);

    await selectParticipant(page, "Everyone");
    await messageCount(page, 2);
    await summary(page, "Recorded sessions", "1");
    await summary(page, "Participant transitions", "1");
    await range(page, "2026-06-20", "2026-06-20");
    await messageCount(page, 0);
    await summary(page, "Recorded sessions", "0");
    await summary(page, "Median messages per session", "Unavailable");
    await summary(page, "Longest session by messages", "Unavailable");
    await summary(page, "Qualifying long gaps", "0");
    await summary(page, "Participant transitions", "0");
    await summary(page, "Median transition delay", "Unavailable");
    await summary(page, "Rapid transitions", "0");
    await expect(participantTable(page)).toHaveCount(0);
    await fits(page);

    await filters(page)
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    await messageCount(page, 12);
    await summary(page, "Recorded sessions", "5");
    await summary(page, "Participant transitions", "10");
    await expect(filters(page).getByRole("status")).toHaveText(
      "Showing: All time · Everyone",
    );
    await acceptChat(
      page,
      "18/06/2026, 10:00 - Synthetic Replacement: One accepted record",
    );
    await messageCount(page, 1);
    await summary(page, "Recorded sessions", "1");
    await summary(page, "Longest session by messages", "1 message");
    await summary(page, "Participant transitions", "0");
    await summary(page, "Median transition delay", "Unavailable");
    await rowValues(participantRow(page, "Synthetic Replacement"), [
      "1",
      "0",
      "0",
      "Unavailable",
      "Unavailable",
      "Unavailable",
      "0",
      "Unavailable",
    ]);
    await expect(filters(page).getByRole("status")).toHaveText(
      "Showing: All time · Everyone",
    );
    await fits(page);
  });

  test("methodology and per-participant distributions are keyboard-readable with truthful wall-clock limitations", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    const disclosure = rhythm(page).getByText(
      "How Rhythm & Dynamics is calculated",
      { exact: true },
    );
    await disclosure.focus();
    await page.keyboard.press("Enter");
    const methodology = rhythm(page)
      .locator("details")
      .filter({
        has: page.getByText("How Rhythm & Dynamics is calculated", {
          exact: true,
        }),
      });
    await expect(methodology).toHaveAttribute("open", "");
    await expect(methodology).toContainText(/greater than 30 minutes/i);
    await expect(methodology).toContainText(/at least 6 hours/i);
    await expect(methodology).toContainText(
      /(?:at most|no more than|≤|<=) 5 minutes/i,
    );
    await expect(methodology).toContainText(/same(?: \d+-minute)? session/i);
    await expect(methodology).toContainText(
      /consecutive participant messages/i,
    );
    await expect(methodology).toContainText(/system events/i);
    await expect(methodology).toContainText(/wall-clock/i);
    await expect(methodology).toContainText(/timezone/i);
    await expect(methodology).toContainText(
      /(?:linear interpolation|linearly interpolated)/i,
    );
    await expect(methodology).toContainText(/read.*seen|seen.*read/i);
    await expect(methodology).toContainText(/reply-to|real repl|replies/i);
    await expect(methodology).toContainText(/(?:elsewhere|complete)/i);
    await expect(methodology).toContainText(/(?:inside|within).*selected/i);
    await expect(methodology).toContainText(/(?:under|less than) 1 minute/i);
    await expect(methodology).toContainText(/(?:under|less than) 5 minutes/i);
    await expect(methodology).toContainText(/(?:under|less than) 30 minutes/i);
    await expect(methodology).toContainText(/(?:under|less than) 6 hours/i);
    await expect(methodology).toContainText(/6 hours or more|6\+ hours/i);

    for (const label of [
      "Started recorded sessions",
      "Silence breakers",
      "Next-sender transitions",
      "Median delay",
      "P25 delay",
      "P75 delay",
      "Rapid transitions",
      "Rapid share",
    ]) {
      await expect(
        participantTable(page).getByRole("columnheader", {
          name: label,
          exact: true,
        }),
      ).toHaveCount(1);
    }
    const delayCounts = participantRow(page, "Synthetic A").getByText(
      "Read delay counts",
      { exact: true },
    );
    await delayCounts.focus();
    await page.keyboard.press("Enter");
    const participantDistribution = participantRow(page, "Synthetic A").locator(
      "details",
    );
    await expect(participantDistribution).toHaveAttribute("open", "");
    await assertDelayCounts(
      page,
      participantDistribution.getByRole("list", {
        name: "Synthetic A: transition delay counts",
        exact: true,
      }),
      [1, 1, 2, 1, 0],
    );
    await fits(page);
  });

  test("rhythm filters keep source Doctor and Wrapped facts, and never reparse, persist, emit telemetry or send source data", async ({
    page,
  }) => {
    const outgoing: string[] = [];
    const documentEntries: string[] = [];
    await page.addInitScript(() => {
      const metrics = {
        parseRequests: 0,
        events: [] as unknown[],
        storageWrites: [] as { key: string; value: string }[],
      };
      Object.assign(window, { waRhythmMetrics: metrics });
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
          ) {
            metrics.parseRequests++;
          }
          if (Array.isArray(options)) super.postMessage(message, options);
          else super.postMessage(message, options);
        }
      } as typeof Worker;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        metrics.storageWrites.push({ key, value });
        originalSetItem.call(this, key, value);
      };
      window.addEventListener("instascope:event", (event) =>
        metrics.events.push((event as CustomEvent).detail),
      );
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      const documentEntry = isSafeDocumentEntryRequest(request);
      if (documentEntry) documentEntries.push(request.postData()!);
      if (
        (!["GET", "HEAD"].includes(request.method()) && !documentEntry) ||
        request.url().includes(bodyMarker) ||
        (url.origin !== "http://127.0.0.1:3000" && url.protocol !== "blob:")
      ) {
        outgoing.push(request.url());
      }
    });
    await page.goto("/whatsapp/chat-analyzer/");
    const metrics = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              waRhythmMetrics: {
                parseRequests: number;
                events: unknown[];
                storageWrites: { key: string; value: string }[];
              };
            }
          ).waRhythmMetrics,
      );
    const onArrival = await metrics();
    await acceptChat(page);
    const before = await metrics();
    expect(before.parseRequests).toBe(1);
    expect(before.events).toEqual([{ event: "document_entry_observed" }]);
    expect(before.storageWrites).toEqual(onArrival.storageWrites);
    const doctor = page.getByRole("region", {
      name: "Chat Export Doctor",
      exact: true,
    });
    const doctorBefore = (await doctor.textContent())!;
    const bannerBefore = (await page
      .locator(".wa-current-chat")
      .textContent())!;
    await range(page, "2026-06-15", "2026-06-15");
    await summary(page, "Recorded sessions", "1");
    await selectParticipant(page, "Synthetic A");
    await messageCount(page, 1);
    await expect(doctor).toHaveText(doctorBefore);
    await expect(page.locator(".wa-current-chat")).toHaveText(bannerBefore);
    await expect(rhythm(page)).not.toContainText(bodyMarker);
    await selectParticipant(page, "Everyone");
    await summary(page, "Participant transitions", "1");
    const afterFilters = await metrics();
    expect(afterFilters.parseRequests).toBe(1);
    expect(afterFilters.events).toEqual(before.events);
    expect(afterFilters.storageWrites).toEqual(before.storageWrites);
    expect(page.url()).not.toContain("Synthetic");
    expect(outgoing).toEqual([]);
    expect(documentEntries.length).toBeLessThanOrEqual(1);

    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Wrapped", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "WhatsApp Wrapped", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".wa-story-value > strong")).toHaveText("12");
    await expect(page.locator(".wa-current-chat")).toHaveText(bannerBefore);
    await expect(
      page.getByRole("region", { name: "Chat Export Doctor", exact: true }),
    ).toHaveText(doctorBefore);
    await expect(rhythm(page)).toHaveCount(0);
    const afterWrapped = await metrics();
    expect(afterWrapped.parseRequests).toBe(1);
    expect(afterWrapped.events).toEqual(before.events);
    expect(afterWrapped.storageWrites).toEqual(before.storageWrites);
    expect(outgoing).toEqual([]);
    expect(documentEntries.length).toBeLessThanOrEqual(1);
    expect(
      afterWrapped.storageWrites.some(
        ({ key, value }) =>
          /whatsapp|rhythm|filter/i.test(key) ||
          value.includes(bodyMarker) ||
          /Synthetic [AB]/.test(value),
      ),
    ).toBe(false);
    await fits(page);
  });
});
