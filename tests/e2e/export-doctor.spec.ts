import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import {
  htmlConnectionDocument,
  htmlLabelRecord,
  syntheticHtmlCore,
  syntheticHtmlConnections,
} from "../helpers/html-connection-export";

const record = (value: string, timestamp?: number) => ({
  string_list_data: [{ value, timestamp }],
});
const jsonFiles = {
  "followers_1.json": [
    record("synthetic.doctor.mutual", 1735689600),
    record("synthetic.doctor.unknown"),
  ],
  "followers_2.json": [
    record("synthetic.doctor.mutual", 1735776000),
    record("synthetic.doctor.earliest", 1546300800),
  ],
  "following.json": [
    record("synthetic.doctor.mutual", 1704067200),
    record("synthetic.doctor.outgoing"),
  ],
  "pending_follow_requests.json": [],
  "close_friends.json": [
    {
      label_values: [{ label: "Username", value: "synthetic.doctor.private" }],
    },
  ],
  "restricted_profiles.json": [{ unrecognized_record: true }],
  "hide_story_from.json": [],
  "recently_unfollowed_profiles.json": [
    record("synthetic.doctor.unfollow", 1704067200),
  ],
};

async function upload(page: Page, files: Record<string, string>, zip = true) {
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(
      zip
        ? {
            name: "synthetic-2020-01-01.zip",
            mimeType: "application/zip",
            buffer: Buffer.from(
              zipSync(
                Object.fromEntries(
                  Object.entries(files).map(([name, text]) => [
                    name,
                    strToU8(text),
                  ]),
                ),
              ),
            ),
          }
        : Object.entries(files).map(([name, text]) => ({
            name,
            mimeType: name.endsWith(".json") ? "application/json" : "text/html",
            buffer: Buffer.from(text),
          })),
    );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your circle, at a glance.",
  );
}
const status = (page: Page) =>
  page.getByRole("region", { name: "Export status", exact: true });
const doctor = (page: Page) =>
  page.getByRole("region", { name: "Export Doctor", exact: true });
async function details(page: Page) {
  await status(page).getByText("View export details", { exact: true }).click();
  await expect(doctor(page)).toBeVisible();
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("Doctor explains split JSON sources, dates and optional states without exposing identities", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:3000")
      requests.push(request.url());
  });
  await page.addInitScript(() => {
    const captured: unknown[] = [];
    Object.assign(window, { doctorEvents: captured });
    window.addEventListener("instascope:event", (event) =>
      captured.push((event as CustomEvent).detail),
    );
  });
  await page.goto("/dashboard/");
  await expect(status(page)).toHaveCount(0);
  await upload(page, {
    ...Object.fromEntries(
      Object.entries(jsonFiles).map(([name, data]) => [
        name,
        JSON.stringify(data),
      ]),
    ),
    "index.html": "<p>Unrelated export index</p>",
    "media/synthetic-photo.txt": "Unused media placeholder",
    "readme.txt": "Unrelated file",
    "empty-directory/": "",
  });
  await expect(status(page)).toContainText("Core relationships ready");
  await expect(status(page)).toContainText("66.7%");
  await expect(status(page)).toContainText("4 of 8");
  await details(page);
  const report = doctor(page);
  await expect(report.locator('[data-doctor-core="followers"]')).toContainText(
    "3",
  );
  await expect(report).toContainText("2 follower files");
  await expect(report).toContainText("JSON");
  await expect(report).toContainText("ZIP");
  await expect(
    report
      .locator("dl > div")
      .filter({ has: page.getByText("Ignored files", { exact: true }) })
      .locator("dd"),
  ).toHaveText("3");
  await expect(
    report.locator('[data-doctor-category="pendingRequests"]'),
  ).toContainText("Included · 0 records");
  await expect(
    report.locator('[data-doctor-category="blocked"]'),
  ).toContainText("Not included");
  await expect(
    report.locator('[data-doctor-category="restricted"]'),
  ).toContainText("Could not read");
  await expect(report).toContainText("2 of 4");
  await expect(report).toContainText(
    "Requested export range cannot be verified",
  );
  await expect(report).toContainText("generation");
  await expect(report).not.toContainText("2020-01-01");
  await expect(report).not.toContainText("synthetic.doctor.");
  await expect(report).not.toContainText("synthetic-photo.txt");
  await fits(page);
  const events = await page.evaluate(
    () => (window as unknown as { doctorEvents: unknown[] }).doctorEvents,
  );
  expect(events.length).toBeGreaterThan(0);
  for (const event of events)
    expect(Object.keys(event as object)).toEqual(["event"]);
  expect(requests).toEqual([]);
  await page.reload();
  await expect(status(page)).toHaveCount(0);
});

test("Doctor preserves real-structure HTML availability and timezone-unknown date coverage", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await upload(page, { ...syntheticHtmlCore, ...syntheticHtmlConnections });
  await expect(status(page)).toContainText("50%");
  await expect(status(page)).toContainText("6 of 8");
  await details(page);
  const report = doctor(page);
  await expect(report).toContainText("HTML");
  await expect(report).toContainText("2 follower files");
  await expect(report).toContainText("timezone");
  for (const kind of [
    "closeFriends",
    "blocked",
    "restricted",
    "hideStoryFrom",
    "pendingRequests",
    "recentlyUnfollowed",
  ])
    await expect(
      report.locator(`[data-doctor-category="${kind}"]`),
    ).toContainText("Included · 2 records");
  for (const kind of ["recentFollowRequests", "removedSuggestions"])
    await expect(
      report.locator(`[data-doctor-category="${kind}"]`),
    ).toContainText("Not included");
  await fits(page);
  await page
    .locator('.dashboard-tool-card[href="/connection-privacy/"]')
    .click();
  const privacy = page.getByRole("region", {
    name: "Connection privacy dashboard",
  });
  await expect(
    privacy.getByRole("button", { name: /Close friends 2/ }),
  ).toBeVisible();
  await expect(privacy).not.toContainText("Could not read");
  await page.getByRole("link", { name: "Export Doctor", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/#export-doctor$/);
  await expect(status(page)).toBeVisible();
});

test("Doctor distinguishes mixed loose input and usable dates from zero coverage", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await upload(
    page,
    {
      "followers.json": JSON.stringify([record("synthetic.doctor.undated")]),
      "following.html":
        '<h1>Following</h1><main><section><a href="https://www.instagram.com/synthetic.doctor.undated/">synthetic.doctor.undated</a></section></main>',
    },
    false,
  );
  await expect(status(page)).toContainText("0%");
  await details(page);
  const report = doctor(page);
  await expect(report).toContainText("JSON");
  await expect(report).toContainText("HTML");
  await expect(report).toContainText("No usable recorded dates");
  await expect(
    report.locator('[data-doctor-capability="mutualOrigins"]'),
  ).toContainText("Unavailable");
  await expect(
    report.locator('[data-doctor-capability="connectionPrivacy"]'),
  ).toContainText("Unavailable");
  await expect(
    report.locator('[data-doctor-category="pendingRequests"]'),
  ).not.toContainText("0 records");
  await fits(page);
});

test("Doctor displays only consistent scoped HTML generation minutes", async ({
  page,
}) => {
  const generated = (html: string, minute: string) =>
    html.replace(
      "<body>",
      `<body><header class="_as-_ _a70a"><div class="_a70d"><aside class="_aoaa" role="contentinfo">Generated by Fictional owner on <time datetime="${minute}">Synthetic generation minute</time></aside></div></header>`,
    );
  await page.goto("/dashboard/");
  const files = { ...syntheticHtmlCore, ...syntheticHtmlConnections };
  await upload(
    page,
    Object.fromEntries(
      Object.entries(files).map(([name, html]) => [
        name,
        generated(html, "2025-01-15T12:34Z"),
      ]),
    ),
  );
  await details(page);
  await expect(
    doctor(page).locator('time[datetime="2025-01-15T12:34Z"]'),
  ).toContainText("UTC");
  await expect(doctor(page)).toContainText(
    "Generation time recorded in 9 HTML files",
  );
  await expect(doctor(page)).toContainText("whole ZIP");
  await expect(doctor(page)).not.toContainText("Fictional owner");
  await page.reload();
  await upload(
    page,
    Object.fromEntries(
      Object.entries(syntheticHtmlCore).map(([name, html], index) => [
        name,
        generated(
          html,
          index === 1 ? "2025-01-15T12:35Z" : "2025-01-15T12:34Z",
        ),
      ]),
    ),
  );
  await details(page);
  await expect(doctor(page).locator("time")).toHaveCount(0);
  await expect(doctor(page)).toContainText("different generation times");
  await fits(page);
});

test("Doctor demo is fictional and partial-export examples do not replace complete demo tools", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(
    page.getByText("Demo data · Fictional example", { exact: true }),
  ).toBeVisible();
  await expect(status(page)).toContainText("96.9%");
  await expect(status(page)).toContainText("8 of 8");
  await details(page);
  await expect(doctor(page)).toContainText("JSON");
  await expect(doctor(page)).toContainText("3 follower files");
  const activeReport = doctor(page).locator(":scope > .export-doctor-sections");
  await expect(
    activeReport.locator('[data-doctor-category="recentFollowRequests"]'),
  ).toContainText("Included · 3 records");
  await expect(
    activeReport.locator('[data-doctor-category="removedSuggestions"]'),
  ).toContainText("Included · 4 records");
  await doctor(page)
    .getByText("See a fictional partial export", { exact: true })
    .click();
  const example = page.getByRole("region", {
    name: "Fictional partial export",
    exact: true,
  });
  await expect(example).toBeVisible();
  await expect(
    example.locator('[data-doctor-category="blocked"]'),
  ).toContainText("Included · 0 records");
  await expect(
    example.locator('[data-doctor-category="pendingRequests"]'),
  ).toContainText("Not included");
  await expect(
    example.locator('[data-doctor-category="restricted"]'),
  ).toContainText("Could not read");
  await expect(
    example.locator('[data-doctor-category="recentFollowRequests"]'),
  ).toContainText("Not included");
  await expect(
    example.locator('[data-doctor-category="removedSuggestions"]'),
  ).toContainText("Included · 0 records");
  await fits(page);
  await page
    .locator('.dashboard-tool-card[href="/connection-privacy/"]')
    .click();
  const privacy = page.getByRole("region", {
    name: "Connection privacy dashboard",
  });
  for (const [label, count] of [
    ["Close friends", 8],
    ["Blocked accounts", 4],
    ["Restricted accounts", 3],
    ["Story hidden from", 5],
  ] as const)
    await expect(
      privacy.getByRole("button", { name: new RegExp(`${label} ${count}`) }),
    ).toBeVisible();
});

test("Doctor keeps Archive Extras separate from pending, privacy and unfollow history", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await upload(page, {
    "followers.json": "[]",
    "following.json": "[]",
    "recent_follow_requests.json": JSON.stringify([
      {
        timestamp: 1735689600,
        media: [],
        fbid: "12345678901234567",
        label_values: [{ label: "Username", value: "synthetic.doctor.recent" }],
      },
    ]),
    "removed_suggestions.html": htmlConnectionDocument([
      htmlLabelRecord(
        [["Username", "synthetic.doctor.suggestion"]],
        "Jan 02, 2025 1:05 pm",
      ),
    ]),
  });
  await expect(status(page)).toContainText("2 of 8");
  await details(page);
  const report = doctor(page);
  for (const kind of ["recentFollowRequests", "removedSuggestions"])
    await expect(
      report.locator(`[data-doctor-category="${kind}"]`),
    ).toContainText("Included · 1 record");
  for (const capability of ["recentSentRequests", "removedSuggestions"])
    await expect(
      report.locator(`[data-doctor-capability="${capability}"]`),
    ).toContainText("Included · 1 record");
  for (const capability of ["pendingRequests", "unfollowHistory"])
    await expect(
      report.locator(`[data-doctor-capability="${capability}"]`),
    ).toContainText("Not included");
  await expect(
    report.locator('[data-doctor-capability="connectionPrivacy"]'),
  ).toContainText("0 of 4 lists readable");
  await expect(
    report.locator('[data-doctor-capability="relationshipDates"]'),
  ).toContainText("No usable recorded dates");
  await expect(report).toContainText("not removed followers");
  await expect(report).not.toContainText("synthetic.doctor.");
  await expect(report).not.toContainText("12345678901234567");
  await fits(page);

  await page.reload();
  await upload(page, {
    "followers.json": "[]",
    "following.json": "[]",
    "recent_follow_requests.json": "{",
    "removed_suggestions.json": "[]",
  });
  await expect(status(page)).toContainText("1 of 8");
  await details(page);
  await expect(
    doctor(page).locator('[data-doctor-category="recentFollowRequests"]'),
  ).toContainText("Could not read");
  await expect(
    doctor(page).locator('[data-doctor-category="removedSuggestions"]'),
  ).toContainText("Included · 0 records");
  await expect(
    doctor(page).locator('[data-doctor-capability="pendingRequests"]'),
  ).toContainText("Not included");
  await fits(page);
});
