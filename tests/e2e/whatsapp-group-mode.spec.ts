import { expect, test, type Page } from "@playwright/test";
import type { ChatVaultSnapshot } from "../../src/lib/whatsapp/chat-vault";
import {
  groupPrivateMarker,
  syntheticGroupChat,
  syntheticGroupLabel,
} from "../helpers/whatsapp-group";

const enabled = process.env.EXPECT_WHATSAPP === "true";
const savedRows = (page: Page) =>
  page.getByRole("article", { name: "Saved chat snapshot", exact: true });
const overview = (page: Page) =>
  page.getByRole("region", { name: "Filtered chat overview", exact: true });

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

async function navigate(
  page: Page,
  name: "Wrapped" | "Chat Analyzer" | "Chat Vault",
) {
  const destination = {
    Wrapped: { path: "/whatsapp/wrapped/", mode: "wrapped" },
    "Chat Analyzer": { path: "/whatsapp/chat-analyzer/", mode: "analyzer" },
    "Chat Vault": { path: "/whatsapp/chat-vault/", mode: "vault" },
  }[name];
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name, exact: true })
    .click();
  await expect(page).toHaveURL(new URL(destination.path, page.url()).href);
  await expect(page.locator("main[data-whatsapp-mode]")).toHaveAttribute(
    "data-whatsapp-mode",
    destination.mode,
  );
}

async function acceptGroup(page: Page, participants: number, days = 3) {
  await expect(page.locator("main[data-whatsapp-mode]")).toHaveAttribute(
    "data-whatsapp-mode",
    "analyzer",
  );
  const input = page.getByLabel("Upload WhatsApp chat export", { exact: true });
  await expect(input).toBeEnabled();
  await input.setInputFiles({
    name: "synthetic-group.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(syntheticGroupChat(participants, days)),
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
    overview(page)
      .locator(".wa-stat")
      .filter({ has: page.getByText("Exported messages", { exact: true }) })
      .locator("strong"),
  ).toHaveText(String(participants * days * 2));
}

async function save(page: Page) {
  await page
    .getByRole("button", { name: "Save to Chat Vault", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to Chat Vault" }),
  ).toBeVisible();
}

async function stored(page: Page) {
  return page.evaluate(
    () =>
      new Promise<ChatVaultSnapshot[]>((resolve, reject) => {
        const request = indexedDB.open("instascope:whatsapp-chat-vault", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("snapshots", "readonly");
          const records = transaction.objectStore("snapshots").getAll();
          transaction.oncomplete = () => {
            db.close();
            resolve(records.result);
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
  );
}

async function backup(page: Page) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Chat Vault backup", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("whatsapp-chat-vault-v1.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test.describe("WhatsAppScope deliberate group flow", () => {
  test.skip(!enabled, "WhatsApp requires an explicit dev preview build.");

  for (const participants of [3, 8, 24]) {
    test(`${participants}-label tied group stays complete and private from import through restored Vault comparison`, async ({
      page,
    }) => {
      const requests: { url: string; method: string; body: string | null }[] =
        [];
      page.on("request", (request) =>
        requests.push({
          url: request.url(),
          method: request.method(),
          body: request.postData(),
        }),
      );
      await page.goto("/whatsapp/chat-analyzer/");
      await acceptGroup(page, participants);
      await expect(page.locator(".wa-current-chat")).toContainText(
        `${participants} participant labels`,
      );
      const ranking = page.locator(".wa-participants");
      const seen: string[] = [];
      for (let start = 0; start < participants; start += 8) {
        const count = Math.min(8, participants - start);
        const rows = ranking.locator(".wa-participant-row");
        await expect(rows).toHaveCount(count);
        const expected = Array.from({ length: count }, (_, index) =>
          syntheticGroupLabel(start + index, participants),
        );
        await expect(
          rows.locator(".wa-participant-label span[title]"),
        ).toHaveText(expected);
        seen.push(...expected);
        for (const row of await rows.all()) {
          await expect(row.locator(".wa-participant-avatar")).toHaveText("01");
          await expect(row).toContainText(`${participants} labels tied`);
          await expect(
            row.locator(".wa-participant-label strong"),
          ).toContainText(`${(100 / participants).toFixed(1)}%`);
        }
        if (start === 0 && participants > 8)
          await expect(ranking).toContainText(
            `${participants - 8} additional labels not displayed`,
          );
        if (start === 0 && participants === 24)
          await ranking.screenshot({
            path: test.info().outputPath("group-analyzer.png"),
          });
        await fits(page);
        if (start + count < participants)
          await ranking
            .getByRole("button", { name: "Next participants", exact: true })
            .click();
      }
      expect(new Set(seen).size).toBe(participants);
      await expect(
        page.getByRole("region", { name: "Rhythm & Dynamics", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading").filter({
          hasText: /reply time|response time|group leader|popularity/i,
        }),
      ).toHaveCount(0);
      await save(page);

      await navigate(page, "Wrapped");
      const deck = page.getByRole("region", {
        name: "WhatsApp Wrapped",
        exact: true,
      });
      await deck
        .getByRole("group", { name: "Choose a Wrapped card", exact: true })
        .getByRole("button", { name: /The contributors/ })
        .click();
      const card = deck.locator('[data-story-id="participant-counts"]');
      await expect(card).toHaveAttribute("data-story-mode", "group");
      await expect(card).toHaveAttribute("data-story-kind", "ranking");
      await expect(card).not.toContainText(groupPrivateMarker);
      await expect(
        deck.getByRole("button", { name: "Download PNG", exact: true }),
      ).toBeEnabled();
      await expect(
        deck.getByRole("checkbox", {
          name: "Include word-based insights in Wrapped",
          exact: true,
        }),
      ).not.toBeChecked();
      await fits(page);
      if (participants === 24)
        await card.screenshot({
          path: test.info().outputPath("group-wrapped.png"),
        });

      await navigate(page, "Chat Analyzer");
      await acceptGroup(page, participants + 1, 4);
      await save(page);
      await navigate(page, "Chat Vault");
      await expect(savedRows(page)).toHaveCount(2);
      const snapshots = await stored(page);
      expect(
        snapshots.map((item) => item.totals.participants).sort((a, b) => a - b),
      ).toEqual([participants, participants + 1]);
      expect(JSON.stringify(snapshots)).not.toMatch(
        /SYNTHETIC_GROUP_PRIVATE|participant-\d|displayName|participantId|fingerprint|conversationId/,
      );
      const raw = await backup(page);
      expect(raw.toString("utf8")).not.toContain(groupPrivateMarker);
      expect(JSON.parse(raw.toString("utf8")).snapshots).toHaveLength(2);
      for (let index = 0; index < 2; index++) {
        await savedRows(page)
          .first()
          .getByRole("button", {
            name: "Delete snapshot",
            exact: true,
          })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", {
            name: "Delete snapshot",
            exact: true,
          })
          .click();
        await expect(savedRows(page)).toHaveCount(1 - index);
      }
      await page
        .getByLabel("Import Chat Vault backup", { exact: true })
        .setInputFiles({
          name: "whatsapp-chat-vault-v1.json",
          mimeType: "application/json",
          buffer: raw,
        });
      const dialog = page.getByRole("dialog", {
        name: "Import Chat Vault backup?",
        exact: true,
      });
      await expect(dialog).toContainText("2 new");
      expect(await stored(page)).toEqual([]);
      await dialog
        .getByRole("button", { name: "Confirm import", exact: true })
        .click();
      await expect(savedRows(page)).toHaveCount(2);
      const restored = await stored(page);
      expect(restored.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        snapshots.sort((a, b) => a.id.localeCompare(b.id)),
      );
      const earlier = snapshots.find(
        (item) => item.totals.participants === participants,
      )!;
      const later = snapshots.find(
        (item) => item.totals.participants === participants + 1,
      )!;
      await page
        .getByRole("combobox", { name: "First snapshot", exact: true })
        .selectOption(earlier.id);
      await page
        .getByRole("combobox", { name: "Second snapshot", exact: true })
        .selectOption(later.id);
      const compare = page.getByRole("button", {
        name: "Compare snapshots",
        exact: true,
      });
      await expect(compare).toBeDisabled();
      await page
        .getByRole("checkbox", {
          name: "I confirm these snapshots describe the same conversation.",
          exact: true,
        })
        .check();
      await compare.click();
      const result = page.getByRole("region", {
        name: "Snapshot comparison",
        exact: true,
      });
      await expect(result).toBeVisible();
      const participantRow = result.getByRole("row", {
        name: /^Exported participant labels/,
      });
      await expect(participantRow.getByRole("cell")).toHaveText([
        String(participants),
        String(participants + 1),
        "+1",
      ]);
      await expect(
        result.getByRole("heading", {
          name: "Conversation Pulse",
          exact: true,
        }),
      ).toBeVisible();
      await expect(result).toContainText("full-export snapshot");
      await result
        .getByText("Comparison methodology and limits", { exact: true })
        .click();
      await expect(result).toContainText(
        "do not identify people or prove who joined or left",
      );
      await expect(result).not.toContainText(
        /\b(?:\d+|two|three) (?:people|members|participants) (?:joined|left)\b/i,
      );
      await expect(result).not.toContainText(groupPrivateMarker);
      await fits(page);
      if (participants === 24)
        await result.screenshot({
          path: test.info().outputPath("group-comparison.png"),
        });
      expect(JSON.stringify(await stored(page))).not.toContain(
        groupPrivateMarker,
      );
      expect(
        await page.evaluate(() =>
          JSON.stringify({ ...localStorage, ...sessionStorage }),
        ),
      ).not.toContain(groupPrivateMarker);
      expect(
        requests.filter((request) => !["GET", "HEAD"].includes(request.method)),
      ).toEqual([]);
      expect(
        requests.every(
          (request) => new URL(request.url).origin === "http://127.0.0.1:3000",
        ),
      ).toBe(true);
      expect(JSON.stringify(requests)).not.toContain(groupPrivateMarker);
    });
  }
});
