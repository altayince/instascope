import { expect, test } from "@playwright/test";

test("Followers renders valid dates and labels unusable source dates", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles([
      {
        name: "followers.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify([
            {
              string_list_data: [
                { value: "dated.follower", timestamp: 1609459200 },
              ],
            },
            { string_list_data: [{ value: "undated.follower" }] },
            {
              string_list_data: [
                {
                  value: "malformed.follower",
                  timestamp: "not-a-timestamp",
                },
              ],
            },
          ]),
        ),
      },
      {
        name: "following.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"relationships_following":[]}'),
      },
    ]);

  await expect(page.getByRole("button", { name: /Followers 3/ })).toBeVisible();

  const dated = page.locator(".accounts li").filter({
    hasText: "@dated.follower",
  });
  const undated = page.locator(".accounts li").filter({
    hasText: "@undated.follower",
  });
  const malformed = page.locator(".accounts li").filter({
    hasText: "@malformed.follower",
  });

  await expect(dated).toContainText("Jan 1, 2021");
  await expect(dated).not.toContainText("Date unavailable");
  await expect(undated).toContainText("Date unavailable");
  await expect(malformed).toContainText("Date unavailable");
});
