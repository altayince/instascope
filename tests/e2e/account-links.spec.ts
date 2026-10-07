import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const files = [
  "tests/fixtures/followers_1.json",
  "tests/fixtures/following.json",
];
const deletedUsername = "__deleted__bcdefghijabcdefgh";

for (const route of ["pending-follow-requests", "instagram-cleaner"]) {
  test(`${route} review exports preserve demo and real profile link policies`, async ({
    page,
  }) => {
    await page.goto(`/${route}/`);
    await page.getByRole("button", { name: "Try demo", exact: true }).click();
    await expect(page.locator(".demo-notice")).toContainText(
      "Demo data · Fictional example",
    );
    await expect(
      page.locator('.accounts a[href*="instagram.com"]'),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Select this page" }).click();
    const demoDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export selected CSV" }).click();
    const demoFile = await demoDownload;
    expect(demoFile.suggestedFilename()).toBe(
      "instascope-demo-review-list.csv",
    );
    const demoCsv = readFileSync((await demoFile.path())!, "utf8");
    const demoRows = demoCsv.split("\n").slice(1);
    expect(demoRows).toHaveLength(route === "pending-follow-requests" ? 3 : 50);
    for (const row of demoRows) expect(row).toMatch(/^demo\.[a-z0-9.]+,$/);
    expect(demoCsv).not.toMatch(/https?:\/\//);
    await expect(page.locator(".account-list .list-caption")).toContainText(
      "Fictional accounts for demo review only",
    );

    await page
      .getByRole("button", { name: "Use my own export", exact: true })
      .click();
    const records = ["sample.active", deletedUsername].map((value) => ({
      string_list_data: [{ value }],
    }));
    await page
      .getByLabel("Upload Instagram export", { exact: true })
      .and(page.locator(":enabled"))
      .setInputFiles([
        {
          name: "followers_1.json",
          mimeType: "application/json",
          buffer: Buffer.from("[]"),
        },
        ...["following.json", "pending_follow_requests.json"].map((name) => ({
          name,
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(records)),
        })),
      ]);
    await expect(page.locator(".demo-notice")).toHaveCount(0);
    await expect(page.locator(".accounts li")).toHaveCount(2);
    await expect(page.locator(".account-list .list-caption")).toContainText(
      "Review manually on Instagram",
    );
    const active = page
      .locator(".accounts li")
      .filter({ hasText: "@sample.active" });
    await expect(
      active.getByRole("link", { name: "@sample.active", exact: true }),
    ).toHaveAttribute("href", "https://www.instagram.com/sample.active/");
    await expect(
      active.getByRole("link", { name: "Open sample.active on Instagram" }),
    ).toHaveAttribute("href", "https://www.instagram.com/sample.active/");
    await expect(
      page
        .locator(".accounts li")
        .filter({ hasText: "Deleted account" })
        .getByRole("link"),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Select this page" }).click();
    const realDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export selected CSV" }).click();
    const realFile = await realDownload;
    expect(realFile.suggestedFilename()).toBe("instascope-review-list.csv");
    const realCsv = readFileSync((await realFile.path())!, "utf8");
    expect(realCsv.split("\n").slice(1).sort()).toEqual(
      [
        `${deletedUsername},`,
        "sample.active,https://www.instagram.com/sample.active/",
      ].sort(),
    );
    expect(realCsv).not.toContain("demo.");
  });
}

test("real account rows link both the username and profile action", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);

  const row = page.locator(".accounts li").filter({ hasText: "@alice" });
  const expected = "https://www.instagram.com/alice/";

  await expect(
    row.getByRole("link", { name: "@alice", exact: true }),
  ).toHaveAttribute("href", expected);
  await expect(
    row.getByRole("link", { name: "Open alice on Instagram" }),
  ).toHaveAttribute("href", expected);
});

test("fictional demo usernames remain non-clickable", async ({ page }) => {
  await page.goto("/followers-analyzer/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page.getByRole("searchbox").fill("demo.mutual.0001");

  const row = page
    .locator(".accounts li")
    .filter({ hasText: "@demo.mutual.0001" });

  await expect(
    row.getByText("@demo.mutual.0001", { exact: true }),
  ).toBeVisible();
  await expect(row.getByRole("link")).toHaveCount(0);
  await expect(row.locator('a[href*="instagram.com"]')).toHaveCount(0);
});

test("deleted export accounts stay visible without profile links", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      {
        name: "followers_1.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify([
            { string_list_data: [{ value: deletedUsername, timestamp: 1 }] },
            { string_list_data: [{ value: "deleted.memories", timestamp: 2 }] },
          ]),
        ),
      },
      {
        name: "following.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            relationships_following: [
              {
                title: "",
                string_list_data: [{ value: deletedUsername, timestamp: 1 }],
              },
            ],
          }),
        ),
      },
    ]);

  const deletedRow = page
    .locator(".accounts li")
    .filter({ hasText: "Deleted account" });
  await expect(deletedRow).toBeVisible();
  await expect(deletedRow.getByRole("link")).toHaveCount(0);
  await expect(deletedRow.getByText("View profile")).toHaveCount(0);
  await expect(deletedRow).not.toContainText(deletedUsername);
  await expect(deletedRow.locator(".avatar")).toHaveText("DA");
  await expect(deletedRow.locator(".avatar").locator("a")).toHaveCount(0);

  const activeRow = page
    .locator(".accounts li")
    .filter({ hasText: "@deleted.memories" });
  const expected = "https://www.instagram.com/deleted.memories/";
  await expect(
    activeRow.getByRole("link", { name: "@deleted.memories" }),
  ).toHaveAttribute("href", expected);
  await expect(
    activeRow.getByRole("link", {
      name: "Open deleted.memories on Instagram",
    }),
  ).toHaveAttribute("href", expected);
});
