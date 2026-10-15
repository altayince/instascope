import { expect, test, type Page } from "@playwright/test";
import {
  createChatVaultSnapshot,
  validateChatVaultSnapshot,
  type ChatVaultSnapshot,
} from "../../src/lib/whatsapp/chat-vault";
import { parseWhatsApp } from "../../src/lib/whatsapp/parser";

const enabled = process.env.EXPECT_WHATSAPP === "true";
const database = "instascope:whatsapp-chat-vault";
const privateMarker = "SYNTHETIC_COMPARE_PRIVATE";
const ids = Array.from(
  { length: 5 },
  (_, index) => `${index + 1}1111111-1111-4111-8111-111111111111`,
);

// Only synthetic input is projected through the existing parser/analysis/V1
// boundary. Browser fixtures never duplicate the persisted aggregate schema.
function projected(
  index: number,
  days: { day: number; hour: number; messages: number }[],
  options: { callOnly?: boolean; partial?: boolean; mixed?: boolean } = {},
): ChatVaultSnapshot {
  const lines = days.flatMap(({ day, hour, messages }) =>
    Array.from({ length: messages }, (_, minute) => {
      const sender = options.callOnly ? 0 : minute % 2;
      const body = options.callOnly
        ? "[Anruf]"
        : `${privateMarker}_BODY fictional orchard meadow? https://synthetic-compare.invalid/private`;
      return `${String(day).padStart(2, "0")}/01/2024, ${String(hour).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")} - ${privateMarker}_PARTICIPANT_${sender}: ${body}`;
    }),
  );
  const dataset = parseWhatsApp(lines.join("\n"), "dmy-24h");
  if (options.partial) dataset.metadata.doctor.status = "partially-supported";
  if (options.mixed) dataset.metadata.timestampPrecision = "mixed";
  if (options.callOnly) dataset.messages[0].emoji = null;
  return createChatVaultSnapshot(dataset, {
    id: ids[index],
    createdAt: Date.UTC(2026, 0, index + 1),
  });
}

const base = projected(0, [
  { day: 1, hour: 8, messages: 4 },
  { day: 2, hour: 20, messages: 4 },
]);
const later = projected(1, [
  { day: 1, hour: 8, messages: 4 },
  { day: 2, hour: 20, messages: 4 },
  { day: 3, hour: 12, messages: 16 },
]);
const scaled = projected(2, [
  { day: 1, hour: 8, messages: 40 },
  { day: 2, hour: 20, messages: 40 },
]);
const limited = projected(
  3,
  [
    { day: 2, hour: 8, messages: 4 },
    { day: 3, hour: 12, messages: 12 },
  ],
  { partial: true, mixed: true },
);
const unavailable = projected(
  4,
  [
    { day: 1, hour: 8, messages: 4 },
    { day: 2, hour: 20, messages: 4 },
  ],
  { callOnly: true },
);

const first = (page: Page) =>
  page.getByRole("combobox", { name: "First snapshot", exact: true });
const second = (page: Page) =>
  page.getByRole("combobox", { name: "Second snapshot", exact: true });
const confirmation = (page: Page) =>
  page.getByRole("checkbox", {
    name: "I confirm these snapshots describe the same conversation.",
    exact: true,
  });
const compare = (page: Page) =>
  page.getByRole("button", { name: "Compare snapshots", exact: true });
const result = (page: Page) =>
  page.getByRole("region", { name: "Snapshot comparison", exact: true });
const pulse = (page: Page) =>
  result(page).getByRole("heading", {
    name: "Conversation Pulse",
    exact: true,
  });

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

async function seed(page: Page, snapshots: ChatVaultSnapshot[]) {
  for (const snapshot of snapshots)
    expect(validateChatVaultSnapshot(snapshot)).not.toBeNull();
  await page.evaluate(
    ({ database, snapshots }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("snapshots", { keyPath: "id" });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            transaction = db.transaction("snapshots", "readwrite"),
            store = transaction.objectStore("snapshots");
          store.clear();
          for (const snapshot of snapshots) store.add(snapshot);
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
    { database, snapshots },
  );
}

async function stored(page: Page) {
  return page.evaluate(
    (database) =>
      new Promise<ChatVaultSnapshot[]>((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            transaction = db.transaction("snapshots", "readonly"),
            read = transaction.objectStore("snapshots").getAll();
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
    database,
  );
}

async function removeSaved(page: Page, id: string) {
  await page.evaluate(
    ({ database, id }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            transaction = db.transaction("snapshots", "readwrite");
          transaction.objectStore("snapshots").delete(id);
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
    { database, id },
  );
}

async function open(page: Page, snapshots = [base, later]) {
  await page.goto("/whatsapp/chat-vault/");
  await seed(page, snapshots);
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Saved chat snapshot", exact: true }),
  ).toHaveCount(snapshots.length);
}

async function selectPair(page: Page, left = base.id, right = later.id) {
  await first(page).selectOption(left);
  await second(page).selectOption(right);
  await confirmation(page).check();
}

async function comparePair(page: Page, left = base.id, right = later.id) {
  await selectPair(page, left, right);
  await compare(page).click();
  await expect(result(page)).toBeVisible();
  await expect(pulse(page)).toBeVisible();
}

test.describe("WhatsAppScope saved aggregate comparison", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");

  test("requires two distinct saved snapshots and deliberate conversation confirmation", async ({
    page,
  }) => {
    await open(page, []);
    await expect(page.locator("main")).toContainText(
      /at least two.*snapshots/i,
    );
    await expect(result(page)).toHaveCount(0);
    await seed(page, [base]);
    await page.reload();
    await expect(page.locator("main")).toContainText(
      /at least two.*snapshots/i,
    );
    await expect(result(page)).toHaveCount(0);
    await seed(page, [base, later]);
    await page.reload();
    await first(page).selectOption(base.id);
    await second(page).selectOption(base.id);
    await expect(confirmation(page)).toBeDisabled();
    await expect(compare(page)).toBeDisabled();
    await second(page).selectOption(later.id);
    await expect(confirmation(page)).not.toBeChecked();
    await expect(compare(page)).toBeDisabled();
    await expect(page.locator("main")).toContainText(/cannot verify/i);
    await confirmation(page).check();
    await expect(compare(page)).toBeEnabled();
    await expect(result(page)).toHaveCount(0);
    await fits(page);
  });

  test("keyboard comparison shows factual context, Pulse and details without network or stored association", async ({
    page,
  }) => {
    await open(page);
    const before = await stored(page);
    const storageBefore = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }));
    const requests: { method: string; url: string; body: string | null }[] = [];
    page.on("request", (request) =>
      requests.push({
        method: request.method(),
        url: request.url(),
        body: request.postData(),
      }),
    );
    await first(page).selectOption(base.id);
    await second(page).selectOption(later.id);
    await confirmation(page).focus();
    await page.keyboard.press("Space");
    await compare(page).focus();
    await page.keyboard.press("Enter");
    await expect(result(page)).toBeVisible();
    await expect(
      result(page).getByRole("heading", {
        name: "Snapshot comparison",
        exact: true,
      }),
    ).toBeFocused();
    await expect(result(page)).toContainText("Earlier snapshot");
    await expect(result(page)).toContainText("Later snapshot");
    await expect(result(page)).toContainText("Comparable snapshots");
    await expect(pulse(page)).toBeVisible();
    await expect(result(page)).toContainText(/full.export aggregate/i);
    await expect(result(page)).toContainText(
      /not.*messages.*between|not.*period/i,
    );
    await expect(
      result(page).getByRole("row", { name: /^Exported messages/ }),
    ).toContainText("8");
    await expect(
      result(page).getByRole("row", { name: /^Exported messages/ }),
    ).toContainText("24");
    await expect(
      result(page).getByRole("row", { name: /^Exported messages/ }),
    ).toContainText("16");
    await expect(result(page)).not.toContainText(privateMarker);
    await fits(page);
    await page.screenshot({
      path: test.info().outputPath("chat-comparison.png"),
      fullPage: true,
    });
    expect(await stored(page)).toEqual(before);
    expect(
      await page.evaluate(() => ({
        local: { ...localStorage },
        session: { ...sessionStorage },
      })),
    ).toEqual(storageBefore);
    expect(
      requests.filter((request) => !["GET", "HEAD"].includes(request.method)),
    ).toEqual([]);
    expect(
      requests.every(
        (request) => new URL(request.url).origin === "http://127.0.0.1:3000",
      ),
    ).toBe(true);
    expect(JSON.stringify(requests)).not.toContain(privateMarker);
    for (const id of ids) expect(JSON.stringify(requests)).not.toContain(id);
    await result(page)
      .getByRole("button", { name: "Choose another pair", exact: true })
      .click();
    await expect(result(page)).toHaveCount(0);
    await expect(first(page)).toBeFocused();
    await expect(confirmation(page)).not.toBeChecked();
  });

  test("reversed selection is normalized to the same chronological comparison without modifying snapshots", async ({
    page,
  }) => {
    await open(page);
    const before = await stored(page);
    await comparePair(page, later.id, base.id);
    await expect(result(page)).toContainText(/reorder|ordered|chronological/i);
    const earlier = result(page)
      .getByText("Earlier snapshot", { exact: true })
      .locator("..");
    const newer = result(page)
      .getByText("Later snapshot", { exact: true })
      .locator("..");
    await expect(earlier).toContainText(/8 messages/);
    await expect(newer).toContainText(/24 messages/);
    const row = result(page).getByRole("row", { name: /^Exported messages/ });
    await expect(row).toContainText(/\+16/);
    expect(await stored(page)).toEqual(before);
    await fits(page);
  });

  test("coverage, partial-source and recorded-clock precision limitations appear before Pulse", async ({
    page,
  }) => {
    await open(page, [base, limited]);
    await comparePair(page, base.id, limited.id);
    const status = result(page).getByText("Comparable with limitations", {
      exact: true,
    });
    await expect(status).toBeVisible();
    await expect(result(page)).toContainText(/different.*start|start.*differ/i);
    await expect(result(page)).toContainText(/partial/i);
    await expect(result(page)).toContainText(/precision/i);
    expect(
      await status.evaluate((element) => {
        const heading = [...document.querySelectorAll("h3")].find(
          (node) => node.textContent === "Conversation Pulse",
        )!;
        return Boolean(
          element.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }),
    ).toBe(true);
    await fits(page);
  });

  test("larger exports use normalized activity shares and retain accessible exact heatmap values", async ({
    page,
  }) => {
    await open(page, [base, scaled]);
    await comparePair(page, base.id, scaled.id);
    await result(page).getByText("Activity timing", { exact: true }).click();
    await result(page)
      .getByText("Read hourly activity shares values", { exact: true })
      .click();
    await result(page)
      .getByText("Read weekday activity shares values", { exact: true })
      .click();
    const hours = result(page).getByRole("table", {
      name: "Hourly activity shares",
      exact: true,
    });
    const eight = hours.getByRole("row", { name: /^08:00/ });
    await expect(eight).toContainText(/50(?:\.0)?%/);
    await expect(eight).toContainText(/0(?:\.0)?\s*pp/);
    const weekdays = result(page).getByRole("table", {
      name: "Weekday activity shares",
      exact: true,
    });
    await expect(weekdays.getByRole("row", { name: /^Monday/ })).toContainText(
      /50(?:\.0)?%/,
    );
    const heatmap = result(page).getByRole("table", {
      name: /weekday.*hour.*share/i,
    });
    await expect(heatmap.locator("tbody tr")).toHaveCount(7);
    await expect(heatmap.locator("tbody td")).toHaveCount(168);
    await expect(heatmap.locator("td[aria-label]").first()).toHaveAttribute(
      "aria-label",
      /earlier|later/i,
    );
    await expect(
      heatmap.locator("tbody tr").first().locator("td").nth(8),
    ).toHaveAttribute(
      "aria-label",
      /earlier 4 \(50%\), later 40 \(50%\); difference 0 pp/,
    );
    const values = result(page)
      .locator("summary")
      .filter({ hasText: "Read weekday and hour comparison values" });
    await values.focus();
    await page.keyboard.press("Enter");
    await expect(values.locator("..")).toHaveAttribute("open", "");
    await expect(
      values
        .locator("..")
        .getByRole("listitem")
        .filter({ hasText: /earlier 4 \(50%\), later 40 \(50%\)/ }),
    ).toHaveCount(2);
    await fits(page);
  });

  test("zero-denominator distributions and missing text or emoji stay unavailable, with no invented Pulse", async ({
    page,
  }) => {
    const identical = {
      ...unavailable,
      id: base.id,
      createdAt: unavailable.createdAt + 1000,
    };
    await open(page, [unavailable, identical]);
    await comparePair(page, unavailable.id, identical.id);
    await expect(result(page)).toContainText(
      /no aggregate differences meet.*display rules/i,
    );
    await result(page)
      .getByText("Rhythm and dynamics", { exact: true })
      .click();
    await result(page)
      .getByText("Media and message patterns", { exact: true })
      .click();
    await result(page)
      .getByText("Read recognized media mix values", { exact: true })
      .click();
    const media = result(page).getByRole("table", {
      name: "Recognized media mix",
      exact: true,
    });
    await expect(media).toContainText("Unavailable");
    await expect(
      result(page).getByRole("row", { name: /^Supported emoji occurrences/ }),
    ).toContainText("Unavailable");
    await expect(
      result(page).getByRole("row", { name: /^Median text length/ }),
    ).toContainText("Unavailable");
    await expect(result(page)).not.toContainText(/NaN|Infinity/);
    await fits(page);
  });

  test("deleted selections invalidate visible results and a fresh compare cannot use a vanished snapshot", async ({
    page,
  }) => {
    await open(page, [base, later, scaled]);
    await comparePair(page);
    await seed(page, [
      base,
      { ...later, createdAt: later.createdAt + 1000 },
      scaled,
    ]);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(result(page)).toHaveCount(0);
    await expect(confirmation(page)).not.toBeChecked();
    await comparePair(page);
    await removeSaved(page, later.id);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(result(page)).toHaveCount(0);
    await expect(confirmation(page)).not.toBeChecked();
    await selectPair(page, base.id, scaled.id);
    await removeSaved(page, scaled.id);
    await compare(page).click();
    await expect(result(page)).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      /missing|removed|changed|no longer/i,
    );
    expect((await stored(page)).map((snapshot) => snapshot.id)).toEqual([
      base.id,
    ]);
  });

  test("storage becoming unavailable after load clears comparison safely and can recover", async ({
    page,
  }) => {
    await open(page);
    await comparePair(page);
    await page.evaluate(() => {
      const original = IDBFactory.prototype.open;
      Object.assign(window, { originalChatCompareOpen: original });
      IDBFactory.prototype.open = function () {
        throw new DOMException("Synthetic storage failure", "SecurityError");
      };
      window.dispatchEvent(new Event("focus"));
    });
    await expect(result(page)).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      /storage is unavailable/i,
    );
    await page.evaluate(() => {
      IDBFactory.prototype.open = (
        window as unknown as {
          originalChatCompareOpen: typeof IDBFactory.prototype.open;
        }
      ).originalChatCompareOpen;
      window.dispatchEvent(new Event("focus"));
    });
    await expect(first(page)).toBeEnabled();
    await expect(confirmation(page)).not.toBeChecked();
    await comparePair(page);
    await fits(page);
  });
});
