import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.EXPECT_WHATSAPP === "true";
const bodyMarker = "SYNTHETICBODYMUSTSTAYLOCALABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Synthetic text only; the 600/601-second endpoints and URL question mark are deliberate.
const twoPersonChat = [
  "14/06/2026, 08:00:00 - Synthetic A: apple apple? 😀",
  "14/06/2026, 08:00:30 - Synthetic A: banana apple??",
  "14/06/2026, 08:01:00 - Synthetic B: banana banana 😀😀",
  "14/06/2026, 08:03:00 - Synthetic senderless system notice?",
  "14/06/2026, 08:10:00 - Synthetic A: image omitted",
  "14/06/2026, 08:10:01 - Synthetic B: https://example.invalid/?synthetic=1",
  "15/06/2026, 09:00:00 - Synthetic B: pear pear?",
  "15/06/2026, 09:01:00 - Synthetic A: pear apple",
].join("\n");

const longParticipant = `Synthetic C ${"LongExportedLabel".repeat(12)}`;
const longWord = "a".repeat(40);
const repeated = (word: string, count: number) =>
  Array.from({ length: count }, () => word).join(" ");
const groupChat = [
  `16/06/2026, 08:00 - Synthetic A: ${repeated("apricot", 20)}`,
  `16/06/2026, 08:01 - Synthetic B: ${repeated("banana", 20)}`,
  `16/06/2026, 08:02 - ${longParticipant}: ${repeated(longWord, 20)}`,
  `16/06/2026, 08:03 - Synthetic A: ${repeated("apricot", 20)}`,
].join("\n");
const paginationLabels = Array.from(
  { length: 10 },
  (_, index) => `Synthetic Paginated ${String(index).padStart(2, "0")}`,
);
const paginatedChat = paginationLabels
  .map(
    (label, index) =>
      `19/06/2026, 08:${String(index).padStart(2, "0")} - ${label}: orchard orchard`,
  )
  .join("\n");

const content = (page: Page) =>
  page.getByRole("region", { name: "Message Patterns & Content", exact: true });
const patterns = (page: Page) =>
  content(page).getByTestId("wa-content-patterns");
const media = (page: Page) => content(page).getByTestId("wa-content-media");
const words = (page: Page) => content(page).getByTestId("wa-content-words");
const globalFacts = (page: Page) =>
  patterns(page).locator(
    ".wa-message-content-pattern-summaries, .wa-message-content-pattern-bottom",
  );
const filters = (page: Page) =>
  page.getByRole("region", { name: "Analysis filters", exact: true });

async function acceptChat(page: Page, text = twoPersonChat) {
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles({
      name: "synthetic-content-chat.txt",
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
  await expect(
    page.getByRole("region", { name: "Detected export format", exact: true }),
  ).toHaveCount(0);
  await expect(content(page)).toBeVisible();
}

async function fact(scope: Locator, label: string, value: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const term = scope
    .locator("dt")
    .filter({ hasText: new RegExp(`^${escaped}$`) });
  await expect(term).toHaveCount(1);
  await expect(term.locator("xpath=following-sibling::dd[1]")).toHaveText(
    value,
  );
}

async function counts(
  scope: Locator,
  name: string,
  entries: [string, number][],
) {
  const list = scope.getByRole("list", { name, exact: true });
  await expect(list.getByRole("listitem").locator("span")).toHaveText(
    entries.map(([label]) => label),
  );
  await expect(list.getByRole("listitem").locator("strong")).toHaveText(
    entries.map(([, count]) => String(count)),
  );
}

async function disclose(page: Page, scope: Locator, label: string) {
  const summary = scope.getByText(label, { exact: true });
  const details = summary.locator("..");
  if ((await details.getAttribute("open")) === null) {
    await summary.focus();
    await page.keyboard.press("Enter");
  }
  await expect(details).toHaveAttribute("open", "");
  return details;
}

async function participant(page: Page, scope: Locator, label: string) {
  const row = scope
    .locator(".wa-message-content-participant-rows > details")
    .filter({
      has: page.getByText(label, { exact: true }),
    });
  await expect(row).toHaveCount(1);
  if ((await row.getAttribute("open")) === null)
    await row.locator("summary").click();
  await expect(row).toHaveAttribute("open", "");
  return row;
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

async function cloudValues(page: Page, entries: [string, number][]) {
  await disclose(page, words(page), "Read word cloud values");
  await counts(
    words(page).getByTestId("wa-content-word-cloud-values"),
    "Word cloud words and counts",
    entries,
  );
}

test.describe("WhatsAppScope local Message Patterns & Content", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");

  test("two-person counts, run distribution, rolling ties, structural exclusions and local cloud values are factual", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    for (const [label, value] of [
      ["Total runs", "5"],
      ["Median run length", "1"],
      ["Longest run", "2"],
      ["Maximum messages in a rolling 10-minute window", "4"],
      ["Messages containing at least one literal ?", "4"],
      ["Total ? occurrences", "5"],
      ["Share of selected participant messages", "57.1%"],
      ["Eligible text messages", "6"],
      ["Median message length", "14"],
      ["P25 / P75 length", "11 / 15.5"],
      ["Median word units per eligible text message", "2"],
    ])
      await fact(globalFacts(page), label, value);
    await counts(patterns(page), "Run-length distribution counts", [
      ["1", 3],
      ["2", 2],
      ["3–5", 0],
      ["6–10", 0],
      ["11+", 0],
    ]);
    await expect(
      patterns(page)
        .getByRole("list", {
          name: "Recorded message bounds within maximum burst windows",
          exact: true,
        })
        .getByRole("listitem"),
    ).toHaveText([
      "2026-06-14 08:00:00 to 2026-06-14 08:10:00",
      "2026-06-14 08:00:30 to 2026-06-14 08:10:01",
    ]);
    await expect(patterns(page)).toContainText(
      "2 maximizing recorded windows (tied)",
    );
    await counts(media(page), "Media marker counts", [
      ["Images", 1],
      ["Videos", 0],
      ["Audio / voice", 0],
      ["Stickers", 0],
      ["GIFs", 0],
      ["Documents", 0],
      ["Unspecified", 0],
    ]);
    await counts(media(page), "Top supported emoji and occurrence counts", [
      ["😀", 3],
    ]);
    await counts(words(page), "Top words and occurrence counts", [
      ["apple", 4],
      ["banana", 3],
      ["pear", 3],
    ]);
    await expect(words(page)).toContainText("10 eligible words.");
    await expect(
      words(page).getByTestId("wa-content-word-cloud"),
    ).toHaveAttribute("aria-hidden", "true");
    await cloudValues(page, [
      ["apple", 4],
      ["banana", 3],
      ["pear", 3],
    ]);

    await disclose(page, patterns(page), "Read participant message patterns");
    const a = await participant(page, patterns(page), "Synthetic A");
    await fact(a, "Run count", "3");
    await fact(a, "Highest recorded 10-minute message burst", "3");
    await fact(a, "Messages containing a question mark", "2");
    await fact(a, "Share of this label's selected messages", "50%");
    const b = await participant(page, patterns(page), "Synthetic B");
    await fact(b, "Run count", "2");
    await fact(b, "Median run length", "1.5");
    await fact(b, "Highest recorded 10-minute message burst", "2");
    await fact(b, "Median message length (code points)", "16");
    await disclose(page, media(page), "Read participant media & emoji");
    const aMedia = await participant(page, media(page), "Synthetic A");
    await counts(aMedia, "Synthetic A: media marker counts", [
      ["Images", 1],
      ["Videos", 0],
      ["Audio / voice", 0],
      ["Stickers", 0],
      ["GIFs", 0],
      ["Documents", 0],
      ["Unspecified", 0],
    ]);
    await counts(aMedia, "Synthetic A: top emoji occurrence counts", [
      ["😀", 1],
    ]);
    await disclose(page, words(page), "Read participant words");
    const bWords = await participant(page, words(page), "Synthetic B");
    await counts(bWords, "Synthetic B: top words and counts", [
      ["banana", 2],
      ["pear", 2],
    ]);
    await expect(content(page)).not.toContainText("https://example.invalid");
    await expect(content(page)).not.toContainText("apple apple? 😀");
    await fits(page);
  });

  test("date and participant filters recompute every content group, empty subsets are unavailable, and reset restores counts", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    await range(page, "2026-06-15", "2026-06-15");
    for (const [label, value] of [
      ["Total runs", "2"],
      ["Longest run", "1"],
      ["Maximum messages in a rolling 10-minute window", "2"],
      ["Messages containing at least one literal ?", "1"],
      ["Total ? occurrences", "1"],
      ["Share of selected participant messages", "50%"],
      ["Eligible text messages", "2"],
      ["Median message length", "10"],
    ])
      await fact(globalFacts(page), label, value);
    await counts(media(page), "Media marker counts", [
      ["Images", 0],
      ["Videos", 0],
      ["Audio / voice", 0],
      ["Stickers", 0],
      ["GIFs", 0],
      ["Documents", 0],
      ["Unspecified", 0],
    ]);
    await expect(media(page)).toContainText(
      "No supported emoji in the selected records.",
    );
    await counts(words(page), "Top words and occurrence counts", [["pear", 3]]);
    await cloudValues(page, [["pear", 3]]);
    await selectParticipant(page, "Synthetic A");
    for (const [label, value] of [
      ["Total runs", "1"],
      ["Maximum messages in a rolling 10-minute window", "1"],
      ["Messages containing at least one literal ?", "0"],
      ["Share of selected participant messages", "0%"],
      ["Eligible text messages", "1"],
      ["Median message length", "10"],
    ])
      await fact(globalFacts(page), label, value);
    await expect(content(page)).toContainText(
      "Runs describe only the selected label's matching subsequence",
    );
    await expect(
      words(page).getByRole("list", {
        name: "Top words and occurrence counts",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(words(page).getByTestId("wa-content-word-cloud")).toHaveCount(
      0,
    );
    await disclose(page, words(page), "Read participant words");
    const a = await participant(page, words(page), "Synthetic A");
    await expect(a.getByTestId("wa-content-comparison")).toContainText(
      "The participant filter removes the other labels.",
    );
    await range(page, "2026-06-20", "2026-06-20");
    for (const [label, value] of [
      ["Total runs", "0"],
      ["Median run length", "Unavailable"],
      ["Longest run", "Unavailable"],
      ["Maximum messages in a rolling 10-minute window", "0"],
      ["Messages containing at least one literal ?", "0"],
      ["Share of selected participant messages", "Unavailable"],
      ["Eligible text messages", "0"],
      ["Median message length", "Unavailable"],
    ])
      await fact(globalFacts(page), label, value);
    await expect(content(page)).toContainText(
      "No participant messages match these filters.",
    );
    await expect(words(page)).toContainText(
      "No eligible top words for a word cloud.",
    );
    await fits(page);
    await filters(page)
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    await fact(globalFacts(page), "Total runs", "5");
    await fact(
      globalFacts(page),
      "Maximum messages in a rolling 10-minute window",
      "4",
    );
    await counts(words(page), "Top words and occurrence counts", [
      ["apple", 4],
      ["banana", 3],
      ["pear", 3],
    ]);
    await counts(media(page), "Top supported emoji and occurrence counts", [
      ["😀", 3],
    ]);
    await expect(filters(page).getByRole("status")).toHaveText(
      "Showing: All time · Everyone",
    );
    await fits(page);
  });

  test("specific year and month choices select the lexical and pattern population", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(
      page,
      [
        "14/06/2025, 08:00 - Synthetic A: kiwi kiwi? 😀",
        "14/06/2026, 08:00 - Synthetic A: plum plum",
        "15/07/2026, 08:00 - Synthetic B: berry berry??",
      ].join("\n"),
    );
    await filters(page)
      .getByRole("combobox", { name: "Date filter", exact: true })
      .selectOption({ label: "Specific year" });
    await filters(page)
      .getByRole("combobox", { name: "Year", exact: true })
      .selectOption("2026");
    await fact(globalFacts(page), "Total runs", "2");
    await fact(globalFacts(page), "Total ? occurrences", "2");
    await counts(words(page), "Top words and occurrence counts", [
      ["berry", 2],
      ["plum", 2],
    ]);
    await expect(media(page)).toContainText(
      "No supported emoji in the selected records.",
    );
    await filters(page)
      .getByRole("combobox", { name: "Date filter", exact: true })
      .selectOption({ label: "Specific month" });
    await filters(page)
      .getByRole("combobox", { name: "Month", exact: true })
      .selectOption("2026-06");
    await fact(globalFacts(page), "Total runs", "1");
    await fact(globalFacts(page), "Total ? occurrences", "0");
    await fact(globalFacts(page), "Eligible text messages", "1");
    await counts(words(page), "Top words and occurrence counts", [["plum", 2]]);
    await cloudValues(page, [["plum", 2]]);
    await fits(page);
  });

  test("group rates use normalized smoothed frequencies, long labels and forty-code-point words fit, and unavailable states are explicit", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page, groupChat);
    await fact(globalFacts(page), "Total runs", "4");
    await fact(
      globalFacts(page),
      "Maximum messages in a rolling 10-minute window",
      "4",
    );
    await counts(words(page), "Top words and occurrence counts", [
      ["apricot", 40],
      [longWord, 20],
      ["banana", 20],
    ]);
    await cloudValues(page, [
      ["apricot", 40],
      [longWord, 20],
      ["banana", 20],
    ]);
    await disclose(page, words(page), "Read participant words");
    const a = await participant(page, words(page), "Synthetic A");
    const comparison = a.getByTestId("wa-content-comparison");
    const row = comparison.getByRole("row").filter({
      has: page.getByRole("rowheader", { name: "apricot", exact: true }),
    });
    await expect(row.getByRole("cell")).toHaveText([
      "40",
      "0",
      "987.8",
      "12.2",
      "81×",
    ]);
    const long = await participant(page, words(page), longParticipant);
    await counts(long, `${longParticipant}: top words and counts`, [
      [longWord, 20],
    ]);
    const longRow = long
      .getByTestId("wa-content-comparison")
      .getByRole("row")
      .filter({
        has: page.getByRole("rowheader", { name: longWord, exact: true }),
      });
    await expect(longRow.getByRole("cell")).toHaveText([
      "20",
      "0",
      "976.19",
      "8.2",
      "119.1×",
    ]);
    await fits(page);
    await selectParticipant(page, longParticipant);
    const participantFilter = filters(page).getByRole("combobox", {
      name: "Participant",
      exact: true,
    });
    await participantFilter.focus();
    await expect(participantFilter).toBeFocused();
    await fits(page);
    await disclose(page, words(page), "Read participant words");
    const filteredLong = await participant(page, words(page), longParticipant);
    await expect(
      filteredLong.getByTestId("wa-content-comparison"),
    ).toContainText("The participant filter removes the other labels.");
    await fact(globalFacts(page), "Total runs", "1");
    await fits(page);

    await acceptChat(page);
    await disclose(page, words(page), "Read participant words");
    const insufficient = await participant(page, words(page), "Synthetic A");
    await expect(
      insufficient.getByTestId("wa-content-comparison"),
    ).toContainText("each need at least 20 eligible words");
    await acceptChat(
      page,
      `18/06/2026, 08:00 - Synthetic Solo: ${repeated("apricot", 20)}`,
    );
    await disclose(page, words(page), "Read participant words");
    const solo = await participant(page, words(page), "Synthetic Solo");
    await expect(solo.getByTestId("wa-content-comparison")).toContainText(
      "At least two participant labels are needed",
    );
    await acceptChat(
      page,
      [
        `18/06/2026, 08:00 - Synthetic A: ${repeated("sharedword", 20)}`,
        `18/06/2026, 08:01 - Synthetic B: ${repeated("sharedword", 20)}`,
      ].join("\n"),
    );
    await disclose(page, words(page), "Read participant words");
    const equalRates = await participant(page, words(page), "Synthetic A");
    await expect(equalRates.getByTestId("wa-content-comparison")).toHaveText(
      "Comparison is available. No words meet the comparison thresholds.",
    );
    await fits(page);
  });

  test("each participant disclosure pages bounded rows and preserves access to exact aggregates", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page, paginatedChat);
    await fact(globalFacts(page), "Total runs", "10");
    await fact(
      globalFacts(page),
      "Maximum messages in a rolling 10-minute window",
      "10",
    );
    for (const [scope, kind] of [
      [patterns(page), "message patterns"],
      [media(page), "media & emoji"],
      [words(page), "words"],
    ] as const) {
      const disclosure = await disclose(
        page,
        scope,
        `Read participant ${kind}`,
      );
      const summaries = disclosure.locator(
        ".wa-message-content-participant-rows > details > summary",
      );
      await expect(summaries).toHaveText(paginationLabels.slice(0, 8));
      const previous = disclosure.getByRole("button", {
        name: `Previous ${kind} participants`,
        exact: true,
      });
      const next = disclosure.getByRole("button", {
        name: `Next ${kind} participants`,
        exact: true,
      });
      await expect(previous).toBeDisabled();
      await next.click();
      await expect(summaries).toHaveText(paginationLabels.slice(8));
      await expect(next).toBeDisabled();
      const last = await participant(page, scope, paginationLabels[9]);
      if (kind === "message patterns") {
        await fact(last, "Run count", "1");
        await fact(last, "Highest recorded 10-minute message burst", "1");
      } else if (kind === "words") {
        await counts(last, `${paginationLabels[9]}: top words and counts`, [
          ["orchard", 2],
        ]);
      } else {
        await expect(last).toContainText("Media markers: 0");
      }
      await previous.click();
      await expect(summaries).toHaveText(paginationLabels.slice(0, 8));
      await fits(page);
    }
  });

  test("missing emoji capability remains unavailable for populated and empty selections", async ({
    page,
  }) => {
    // The importer runs in a dedicated worker: simulate the same missing native
    // capability in local page and worker bundles, without changing product code.
    await page.addInitScript(() =>
      Object.defineProperty(Intl, "Segmenter", {
        value: undefined,
        configurable: true,
      }),
    );
    await page.route("**/_next/static/**/*.js", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: `Object.defineProperty(Intl,"Segmenter",{value:undefined,configurable:true});\n${await response.text()}`,
      });
    });
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    await expect(media(page)).toContainText(
      "Unavailable. Supported emoji grapheme extraction is not available in this browser",
    );
    await expect(
      media(page).getByRole("list", {
        name: "Top supported emoji and occurrence counts",
        exact: true,
      }),
    ).toHaveCount(0);
    await counts(words(page), "Top words and occurrence counts", [
      ["apple", 4],
      ["banana", 3],
      ["pear", 3],
    ]);
    await range(page, "2026-06-20", "2026-06-20");
    await expect(media(page)).toContainText(
      "Unavailable. Supported emoji grapheme extraction is not available in this browser",
    );
    await expect(media(page)).not.toContainText(
      "No supported emoji in the selected records.",
    );
    await fits(page);
  });

  test("methodology is keyboard-readable and states the exact definitions and unavailable inferences", async ({
    page,
  }) => {
    await page.goto("/whatsapp/chat-analyzer/");
    await acceptChat(page);
    const methodology = await disclose(
      page,
      content(page),
      "How Message Patterns & Content is calculated",
    );
    for (const explanation of [
      /participant switch ends a run/i,
      /no gap threshold/i,
      /600 recorded seconds/i,
      /including both endpoints/i,
      /candidate ends at each distinct recorded message time/i,
      /literal ASCII \?/i,
      /including inside URLs/i,
      /Unicode code points/i,
      /linear interpolation/i,
      /no language detection/i,
      /Turkish, German and English stopword/i,
      /\(occurrences \+ 0\.5\).*\(eligible words \+ 1\)/i,
      /at least 20 eligible words/i,
      /at least three occurrences/i,
      /Sentiment, intent, personality, relationship quality/i,
      /read or seen data/i,
      /never message samples/i,
    ])
      await expect(methodology).toContainText(explanation);
    await fits(page);
  });

  test("content stays local without reparsing, network, analytics, URL state, storage or transcripts, while source Doctor and Wrapped remain unchanged", async ({
    page,
  }) => {
    const requests: { url: string; method: string; body: string | null }[] = [];
    await page.addInitScript(() => {
      const metrics = {
        parseRequests: 0,
        events: [] as unknown[],
        storageWrites: [] as { key: string; value: string }[],
        databaseWrites: [] as { store: string; value: unknown }[],
        databaseOpens: [] as string[],
      };
      Object.assign(window, { waContentMetrics: metrics });
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
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        metrics.storageWrites.push({ key, value });
        originalSetItem.call(this, key, value);
      };
      const originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (
        value: unknown,
        key?: IDBValidKey,
      ) {
        metrics.databaseWrites.push({ store: this.name, value });
        return key === undefined
          ? originalPut.call(this, value)
          : originalPut.call(this, value, key);
      };
      const originalAdd = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (
        value: unknown,
        key?: IDBValidKey,
      ) {
        metrics.databaseWrites.push({ store: this.name, value });
        return key === undefined
          ? originalAdd.call(this, value)
          : originalAdd.call(this, value, key);
      };
      const originalOpen = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (name: string, version?: number) {
        metrics.databaseOpens.push(name);
        return version === undefined
          ? originalOpen.call(this, name)
          : originalOpen.call(this, name, version);
      };
      window.addEventListener("instascope:event", (event) =>
        metrics.events.push((event as CustomEvent).detail),
      );
    });
    page.on("request", (request) =>
      requests.push({
        url: request.url(),
        method: request.method(),
        body: request.postData(),
      }),
    );
    const metrics = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              waContentMetrics: {
                parseRequests: number;
                events: unknown[];
                storageWrites: { key: string; value: string }[];
                databaseWrites: { store: string; value: unknown }[];
                databaseOpens: string[];
              };
            }
          ).waContentMetrics,
      );
    const assertDatabasePrivacy = (
      observed: Awaited<ReturnType<typeof metrics>>,
    ) => {
      // Shared Instagram providers read these databases and migrate an empty
      // legacy store. No other database or put/add payload is allowed.
      for (const name of observed.databaseOpens) {
        expect([
          "instascope:review-memory",
          "instascope:snapshot-vault",
        ]).toContain(name);
      }
      for (const write of observed.databaseWrites) {
        expect(write).toEqual({
          store: "metadata",
          value: { key: "legacy-v1-migrated", complete: true },
        });
      }
    };
    await page.goto("/whatsapp/chat-analyzer/");
    await page.waitForLoadState("networkidle");
    const onArrival = await metrics();
    await acceptChat(
      page,
      twoPersonChat.replace("apple apple? 😀", `${bodyMarker} apple apple? 😀`),
    );
    await page.waitForLoadState("networkidle");
    const before = await metrics();
    expect(before.parseRequests).toBe(1);
    expect(before.storageWrites).toEqual(onArrival.storageWrites);
    assertDatabasePrivacy(onArrival);
    assertDatabasePrivacy(before);
    const beforeRequests = [...requests];
    const doctor = page.getByRole("region", {
      name: "Chat Export Doctor",
      exact: true,
    });
    const doctorBefore = (await doctor.textContent())!;
    const bannerBefore = (await page
      .locator(".wa-current-chat")
      .textContent())!;
    await cloudValues(page, [
      ["apple", 4],
      ["banana", 3],
      ["pear", 3],
    ]);
    await range(page, "2026-06-15", "2026-06-15");
    await fact(globalFacts(page), "Eligible text messages", "2");
    await selectParticipant(page, "Synthetic A");
    await fact(globalFacts(page), "Total runs", "1");
    await expect(doctor).toHaveText(doctorBefore);
    await expect(page.locator(".wa-current-chat")).toHaveText(bannerBefore);
    await expect(content(page)).not.toContainText(bodyMarker);
    await expect(content(page)).not.toContainText("https://example.invalid");
    await expect(content(page)).not.toContainText("pear apple");
    await expect(content(page).locator("a[href^='http']")).toHaveCount(0);
    expect(requests).toEqual(beforeRequests);
    const afterFilters = await metrics();
    expect(afterFilters.parseRequests).toBe(1);
    expect(afterFilters.events).toEqual([]);
    expect(afterFilters.storageWrites).toEqual(before.storageWrites);
    assertDatabasePrivacy(afterFilters);
    expect(page.url()).toBe("http://127.0.0.1:3000/whatsapp/chat-analyzer/");
    expect(
      requests.filter(
        ({ url, method, body }) =>
          method === "POST" ||
          (new URL(url).origin !== "http://127.0.0.1:3000" &&
            !url.startsWith("blob:")) ||
          `${url}${body ?? ""}`.includes(bodyMarker),
      ),
    ).toEqual([]);

    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Wrapped", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "WhatsApp Wrapped", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".wa-story-value > strong")).toHaveText("7");
    await expect(page.locator(".wa-current-chat")).toHaveText(bannerBefore);
    await expect(
      page.getByRole("region", { name: "Chat Export Doctor", exact: true }),
    ).toHaveText(doctorBefore);
    await expect(content(page)).toHaveCount(0);
    const afterWrapped = await metrics();
    expect(afterWrapped.parseRequests).toBe(1);
    expect(afterWrapped.events).toEqual([]);
    expect(afterWrapped.storageWrites).toEqual(before.storageWrites);
    assertDatabasePrivacy(afterWrapped);
    const recordedPayloads = JSON.stringify({
      events: afterWrapped.events,
      storageWrites: afterWrapped.storageWrites,
      databaseWrites: afterWrapped.databaseWrites,
      networkPayloads: requests.map(({ url, body }) => ({
        query: new URL(url).search,
        body,
      })),
    });
    for (const privateValue of [
      bodyMarker,
      "Synthetic A",
      "Synthetic B",
      "apple",
      "banana",
      "pear",
      "https://example.invalid/?synthetic=1",
    ]) {
      expect(recordedPayloads).not.toContain(privateValue);
    }
    expect(
      requests.filter(
        ({ url, method, body }) =>
          method === "POST" ||
          (new URL(url).origin !== "http://127.0.0.1:3000" &&
            !url.startsWith("blob:")) ||
          `${url}${body ?? ""}`.includes(bodyMarker),
      ),
    ).toEqual([]);
    await fits(page);
  });
});
