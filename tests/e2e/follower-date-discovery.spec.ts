import { expect, test, type Page } from "@playwright/test";

const followerTimeline = "/relationship-timeline/?direction=followers";
async function upload(page: Page) {
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      {
        name: "followers_1.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify([
            {
              string_list_data: [
                { value: "sample.new", timestamp: 1735689600 },
              ],
            },
            {
              string_list_data: [
                { value: "sample.old", timestamp: 1577836800 },
              ],
            },
            { string_list_data: [{ value: "sample.unknown" }] },
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
                string_list_data: [
                  { value: "sample.outgoing", timestamp: 1672531200 },
                ],
              },
            ],
          }),
        ),
      },
    ]);
}

test("homepage makes incoming follower dates discoverable and demo opens in that direction", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator(".feature-grid .relationship-timeline");
  await expect(card).toContainText("When did someone follow me?");
  await expect(card).toContainText("earliest recorded followers");
  await expect(card).toContainText("where available");
  await expect(card).toHaveAttribute("href", followerTimeline);
  await card.click();
  await expect(
    page.getByRole("heading", {
      name: "When did someone follow me?",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.getByLabel("Relationship direction")).toHaveValue(
    "followers",
  );
  await expect(page.locator(".demo-notice")).toBeVisible();
  await expect(page.getByLabel("Sort accounts")).toHaveValue("oldest");
  await expect(
    page.getByRole("option", {
      name: "Oldest recorded followers",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(page.locator(".accounts li").first()).toContainText("demo.");
  await expect(page.locator('.accounts a[href*="instagram.com"]')).toHaveCount(
    0,
  );
});

test("Followers explains dates, labels sorting by direction and leads into the same dataset's timeline", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await upload(page);
  await expect(page.locator(".list-heading")).toContainText(
    "Search for a username",
  );
  await expect(page.locator(".list-heading")).toContainText(
    "missing dates stay unavailable",
  );
  const sort = page.getByLabel("Sort accounts");
  await sort.selectOption({ label: "Oldest recorded followers" });
  await expect(page.locator(".accounts li").first()).toContainText(
    "@sample.old",
  );
  await expect(page.locator(".accounts li").last()).toContainText(
    "Date unavailable",
  );
  await sort.selectOption({ label: "Newest recorded followers" });
  await expect(page.locator(".accounts li").first()).toContainText(
    "@sample.new",
  );
  await expect(page.locator(".accounts li").last()).toContainText(
    "Date unavailable",
  );
  await page.getByRole("button", { name: /Following 1/ }).click();
  await expect(sort.locator('option[value="newest"]')).toHaveText(
    "Recently followed",
  );
  await expect(
    page.getByRole("link", { name: "Explore follower dates", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Followers 3/ }).click();
  await page
    .getByRole("link", { name: "Explore follower dates", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp("/relationship-timeline/\\?direction=followers$"),
  );
  await expect(page.getByLabel("Relationship direction")).toHaveValue(
    "followers",
  );
  await expect(
    page.getByRole("button", {
      name: "2020: 1 dated relationships",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".accounts li")).toHaveCount(3);
  await page
    .getByRole("searchbox", { name: "Search accounts" })
    .fill("sample.old");
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.locator(".accounts li")).toContainText("Jan 1, 2020");
  await page.getByRole("searchbox", { name: "Search accounts" }).fill("");
  await page.getByRole("button", { name: "Date unavailable (1)" }).click();
  await expect(page.locator(".accounts li")).toContainText("@sample.unknown");
  await expect(page.locator(".accounts li")).toContainText("Date unavailable");
  await page.getByLabel("Relationship direction").selectOption("following");
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.locator(".accounts li")).toContainText("@sample.outgoing");
  await page.getByLabel("Relationship direction").selectOption("followers");
  await expect(page.locator(".accounts li")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("guide opens follower Timeline before upload, with canonical URL and no parameterized sitemap entry", async ({
  page,
  request,
}) => {
  await page.goto("/how-to-see-when-someone-followed-you-on-instagram/");
  const cta = page
    .getByRole("navigation", { name: "Put this guide into practice" })
    .getByRole("link")
    .first();
  await expect(cta).toHaveAttribute("href", followerTimeline);
  await cta.click();
  await upload(page);
  await expect(page.getByLabel("Relationship direction")).toHaveValue(
    "followers",
  );
  await expect(page.getByLabel("Sort accounts")).toHaveValue("oldest");
  await expect(page.locator(".accounts li").first()).toContainText(
    "@sample.old",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://instascope.me/relationship-timeline/",
  );
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(
    "<loc>https://instascope.me/relationship-timeline/</loc>",
  );
  expect(sitemap).not.toContain("?direction=");
  // Same-path query navigation must reset entry direction, including back/forward.
  const historyMenu = page
    .getByRole("navigation", { name: "Main navigation" })
    .locator('details[data-section="history"]');
  await historyMenu.locator("summary").click();
  await historyMenu
    .getByRole("link", { name: "Relationship timeline", exact: true })
    .click();
  await expect(page.getByLabel("Relationship direction")).toHaveValue(
    "following",
  );
  await page.goBack();
  await expect(page.getByLabel("Relationship direction")).toHaveValue(
    "followers",
  );
  await page.goForward();
  await expect(page.getByLabel("Relationship direction")).toHaveValue(
    "following",
  );
  await page.goto("/relationship-timeline/?direction=invalid");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.getByLabel("Relationship direction")).toHaveValue(
    "following",
  );
});
