import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import {
  htmlConnectionDocument,
  htmlLabelRecord,
} from "../helpers/html-connection-export";

const deleted = "__deleted__abcdefghijabcdefg";
const jsonRecord = (username: string, timestamp?: number) => ({
  timestamp,
  label_values: [{ label: "Username", value: username }],
});
const jsonCore = {
  "followers_1.json": JSON.stringify([
    { string_list_data: [{ value: "synthetic.core", timestamp: 1735689600 }] },
  ]),
  "following.json": JSON.stringify({
    relationships_following: [
      {
        title: "synthetic.core",
        string_list_data: [
          {
            href: "https://www.instagram.com/synthetic.core/",
            timestamp: 1735689600,
          },
        ],
      },
    ],
  }),
  "pending_follow_requests.json": JSON.stringify([
    jsonRecord("synthetic.pending", 1735689600),
  ]),
  "recently_unfollowed_profiles.json": JSON.stringify([
    jsonRecord("synthetic.unfollow", 1735689600),
  ]),
};
const htmlList = (prefix: string) =>
  htmlConnectionDocument([
    htmlLabelRecord(
      [["Username", `synthetic.${prefix}.dated`]],
      "Jan 02, 2025 1:05 pm",
    ),
    htmlLabelRecord([["Username", `synthetic.${prefix}.undated`]]),
    htmlLabelRecord([["Username", deleted]], "Jan 01, 2025 12:00 am"),
    htmlLabelRecord(
      [["Username", `synthetic.${prefix}.dated`]],
      "Jan 02, 2025 1:05 pm",
    ),
  ]);
const htmlCore = {
  "followers_1.html": htmlConnectionDocument(
    [
      '<section><a href="https://www.instagram.com/synthetic.core/">synthetic.core</a><div>Jan 01, 2025 12:00 am</div></section>',
    ],
    "Followers",
  ),
  "following.html": htmlConnectionDocument(
    [
      '<section><h2>synthetic.core</h2><a href="https://www.instagram.com/synthetic.core/">Profile</a><div>Jan 01, 2025 12:00 am</div></section>',
    ],
    "Following",
  ),
  "pending_follow_requests.html": htmlConnectionDocument([
    htmlLabelRecord(
      [["Username", "synthetic.pending"]],
      "Jan 01, 2025 12:00 am",
    ),
  ]),
  "recently_unfollowed_profiles.html": htmlConnectionDocument([
    htmlLabelRecord(
      [["Username", "synthetic.unfollow"]],
      "Jan 01, 2025 12:00 am",
    ),
  ]),
};
const requestReview = (page: Page) =>
  page.getByRole("region", { name: "Pending request review" });
const suggestionReview = (page: Page) =>
  page.getByRole("region", {
    name: "Removed profile suggestions",
    exact: true,
  });
async function upload(page: Page, files: Record<string, string>, zip = false) {
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(
      zip
        ? {
            name: "synthetic-archive-extras.zip",
            mimeType: "application/zip",
            buffer: Buffer.from(
              zipSync(
                Object.fromEntries(
                  Object.entries(files).map(([name, text]) => [
                    `connections/followers_and_following/${name}`,
                    strToU8(text),
                  ]),
                ),
              ),
            ),
          }
        : Object.entries(files).map(([name, text]) => ({
            name,
            mimeType: name.endsWith("json") ? "application/json" : "text/html",
            buffer: Buffer.from(text),
          })),
    );
  await expect(
    page.getByRole("button", { name: "Clear active data & start over" }),
  ).toBeVisible();
}
async function openSuggestions(page: Page) {
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Your unfollow history", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Your unfollow history", exact: true })
      .locator(".accounts li"),
  ).toHaveCount(1);
  await page.locator(".archive-extra-details > summary").click();
  await expect(suggestionReview(page)).toBeVisible();
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

for (const format of ["JSON", "HTML"] as const) {
  test(`${format} archive extras remain separate from pending and unfollow records`, async ({
    page,
  }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== "http://127.0.0.1:3000")
        externalRequests.push(request.url());
    });
    await page.goto("/pending-follow-requests/");
    const records = (prefix: string) =>
      JSON.stringify([
        jsonRecord(`synthetic.${prefix}.dated`, 1735823100),
        jsonRecord(`synthetic.${prefix}.undated`),
        jsonRecord(deleted, 1735689600),
        jsonRecord(`synthetic.${prefix}.dated`, 1735823100),
      ]);
    await upload(
      page,
      format === "JSON"
        ? {
            ...jsonCore,
            "recent_follow_requests.json": records("recent"),
            "removed_suggestions.json": records("suggestion"),
          }
        : {
            ...htmlCore,
            "recent_follow_requests.html": htmlList("recent"),
            "removed_suggestions.html": htmlList("suggestion"),
          },
      format === "HTML",
    );
    const requests = requestReview(page);
    await expect(
      requests.getByRole("combobox", { name: "Request records" }),
    ).toHaveValue("pendingRequests");
    await expect(requests.locator(".accounts li")).toHaveCount(1);
    await expect(
      requests.getByRole("combobox", { name: "Request age" }),
    ).toBeVisible();
    await requests
      .getByRole("combobox", { name: "Request records" })
      .selectOption("recentFollowRequests");
    await expect(
      requests.getByRole("heading", {
        name: "Recent sent requests",
        exact: true,
      }),
    ).toBeVisible();
    await expect(requests.locator(".accounts li")).toHaveCount(3);
    await expect(requests).toContainText("do not distinguish which happened");
    await expect(
      requests.getByRole("combobox", { name: "Request age" }),
    ).toHaveCount(0);
    await expect(requests.locator(".selection-bar")).toHaveCount(0);
    await expect(
      requests
        .locator(".accounts li")
        .filter({ hasText: "@synthetic.recent.dated" }),
    ).toContainText("Jan 2, 2025");
    await expect(
      requests
        .locator(".accounts li")
        .filter({ hasText: "@synthetic.recent.undated" }),
    ).toContainText("Date unavailable");
    await expect(
      requests.getByRole("link", {
        name: "Open synthetic.recent.dated on Instagram",
      }),
    ).toHaveAttribute(
      "href",
      "https://www.instagram.com/synthetic.recent.dated/",
    );
    const deletedRequest = requests
      .locator(".accounts li")
      .filter({ hasText: "Deleted account" });
    await expect(deletedRequest.getByRole("link")).toHaveCount(0);
    await expect(deletedRequest).not.toContainText(deleted);
    await expect(requests).not.toContainText("days since recorded request");
    await fits(page);

    await openSuggestions(page);
    const suggestions = suggestionReview(page);
    await expect(suggestions.locator(".accounts li")).toHaveCount(3);
    await expect(suggestions).toContainText("does not mean you unfollowed");
    await expect(
      suggestions.getByRole("link", {
        name: "Open synthetic.suggestion.dated on Instagram",
      }),
    ).toHaveAttribute(
      "href",
      "https://www.instagram.com/synthetic.suggestion.dated/",
    );
    await expect(
      suggestions
        .locator(".accounts li")
        .filter({ hasText: "Deleted account" })
        .getByRole("link"),
    ).toHaveCount(0);
    await suggestions
      .getByRole("button", {
        name: "Inspect relationship with @synthetic.suggestion.dated",
        exact: true,
      })
      .click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("button", { name: "Context", exact: true }).click();
    await expect(drawer).toContainText("Removed profile suggestion record");
    await expect(drawer).not.toContainText(
      "You unfollowed this account in export history",
    );
    await drawer
      .getByRole("button", { name: "Close relationship details" })
      .click();
    await fits(page);
    expect(externalRequests).toEqual([]);
  });
}

for (const state of ["empty", "missing", "unsupported"] as const) {
  test(`archive extras ${state} state remains distinct`, async ({ page }) => {
    await page.goto("/pending-follow-requests/");
    const value =
      state === "empty"
        ? "[]"
        : JSON.stringify([
            {
              label_values: [
                { label: "Name", value: "synthetic.display.only" },
              ],
            },
          ]);
    await upload(page, {
      ...jsonCore,
      ...(state === "missing"
        ? {}
        : {
            "recent_follow_requests.json": value,
            "removed_suggestions.json": value,
          }),
    });
    const requests = requestReview(page);
    await requests
      .getByRole("combobox", { name: "Request records" })
      .selectOption("recentFollowRequests");
    if (state === "empty") {
      await expect(
        requests.getByText("0 records", { exact: true }),
      ).toBeVisible();
      await expect(requests.getByRole("status")).toHaveCount(0);
    } else {
      await expect(requests.getByRole("status")).toContainText(
        state === "missing" ? "Not included" : "Could not read this list",
      );
      await expect(requests.locator(".account-list")).toHaveCount(0);
    }
    await openSuggestions(page);
    const suggestions = suggestionReview(page);
    if (state === "empty") {
      await expect(
        suggestions.getByText("0 accounts", { exact: true }),
      ).toBeVisible();
      await expect(suggestions.getByRole("status")).toHaveCount(0);
      await expect(
        page.locator(".archive-extra-details > summary"),
      ).toContainText("Included · 0 accounts");
    } else {
      await expect(suggestions.getByRole("status")).toContainText(
        state === "missing" ? "Not included" : "Could not read this list",
      );
      await expect(suggestions.locator(".account-list")).toHaveCount(0);
    }
    await fits(page);
  });
}

test("fictional archive extras remain local and absent from Wrapped share output", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.assign(window, { archiveExtrasDrawnTexts: texts });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof original>
    ) {
      texts.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.goto("/pending-follow-requests/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".demo-notice")).toContainText(
    "Demo data · Fictional example",
  );
  const requests = requestReview(page);
  await expect(requests.locator(".accounts li")).toHaveCount(3);
  await requests
    .getByRole("combobox", { name: "Request records" })
    .selectOption("recentFollowRequests");
  await expect(requests.locator(".accounts li")).toHaveCount(3);
  await expect(
    requests.getByText("@demo.recentrequest.0001", { exact: true }),
  ).toBeVisible();
  await expect(requests.locator(".accounts a")).toHaveCount(0);
  await fits(page);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Your unfollow history", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Your unfollow history", exact: true })
      .locator(".accounts li"),
  ).toHaveCount(2);
  await page.locator(".archive-extra-details > summary").click();
  const suggestions = suggestionReview(page);
  await expect(suggestions.locator(".accounts li")).toHaveCount(4);
  await expect(
    suggestions.getByText("@demo.suggestion.0001", { exact: true }),
  ).toBeVisible();
  await expect(suggestions.locator(".accounts a")).toHaveCount(0);
  await fits(page);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped", exact: true })
    .click();
  await expect(page.locator(".wrapped-card")).toContainText(
    "DEMO DATA · FICTIONAL EXAMPLE",
  );
  await expect(page.locator(".wrapped-card")).not.toContainText(
    /demo\.(recentrequest|suggestion)\.|recent sent requests|removed profile suggestions/i,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Wrapped" }).click();
  await download;
  const texts = await page.evaluate(
    () =>
      (window as unknown as { archiveExtrasDrawnTexts: string[] })
        .archiveExtrasDrawnTexts,
  );
  expect(texts.join(" ")).not.toMatch(
    /demo\.(recentrequest|suggestion)\.|recent sent requests|removed profile suggestions/i,
  );
});
