import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import {
  htmlConnectionDocument,
  htmlLabelRecord,
  syntheticHtmlConnections,
  syntheticHtmlCore,
} from "../helpers/html-connection-export";

async function uploadHtml(
  page: Page,
  optional: Record<string, string> = syntheticHtmlConnections,
  zip = true,
) {
  const entries = Object.entries({ ...syntheticHtmlCore, ...optional });
  const files = zip
    ? [
        {
          name: "synthetic-meta-html.zip",
          mimeType: "application/zip",
          buffer: Buffer.from(
            zipSync(
              Object.fromEntries(
                entries.map(([name, text]) => [
                  `connections/followers_and_following/${name}`,
                  strToU8(text),
                ]),
              ),
            ),
          ),
        },
      ]
    : entries.map(([name, text]) => ({
        name,
        mimeType: "text/html",
        buffer: Buffer.from(text),
      }));
  await page
    .getByLabel("Upload Instagram export", { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
  await expect(
    page.getByRole("button", { name: "Clear active data & start over" }),
  ).toBeVisible();
}

test("nested Meta HTML ZIP preserves optional privacy identities, dates and event records", async ({
  page,
}) => {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" ||
      new URL(request.url()).origin !== "http://127.0.0.1:3000"
    )
      unexpected.push(request.url());
  });
  await page.goto("/connection-privacy/");
  await uploadHtml(page);
  const privacy = page.getByRole("region", {
    name: "Connection privacy dashboard",
  });
  for (const [label, prefix] of [
    ["Close friends", "closefriend"],
    ["Blocked accounts", "blocked"],
    ["Restricted accounts", "restricted"],
    ["Story hidden from", "hidden"],
  ] as const) {
    const tab = privacy.getByRole("button", { name: new RegExp(`${label} 2`) });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    await expect(privacy.locator(".accounts li")).toHaveCount(2);
    const dated = privacy
      .locator(".accounts li")
      .filter({ hasText: `@synthetic.${prefix}.dated` });
    await expect(dated).toContainText("Jan 2, 2025");
    await expect(
      dated.getByRole("link", {
        name: `Open synthetic.${prefix}.dated on Instagram`,
      }),
    ).toHaveAttribute(
      "href",
      `https://www.instagram.com/synthetic.${prefix}.dated/`,
    );
    await expect(
      privacy
        .locator(".accounts li")
        .filter({ hasText: `@synthetic.${prefix}.undated` }),
    ).toContainText("Date unavailable");
    await expect(privacy).not.toContainText(
      /Could not read|Not included|synthetic\.display\.name|synthetic\.navigation|synthetic\.footer/,
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Pending requests", exact: true })
    .click();
  const pending = page.getByRole("region", { name: "Pending request review" });
  await expect(pending.locator(".accounts li")).toHaveCount(2);
  await expect(
    pending.getByText("@synthetic.request.dated", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Your unfollow history", exact: true })
    .click();
  const history = page.getByRole("region", { name: "Your unfollow history" });
  await expect(history.locator(".accounts li")).toHaveCount(2);
  await expect(history.locator(".accounts li").first()).toContainText(
    "Jan 3, 2025",
  );
  await expect(history.locator(".accounts li").last()).toContainText(
    "Jan 2, 2025",
  );
  expect(unexpected).toEqual([]);
});

test("direct nested HTML files retain split followers and following dates", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await uploadHtml(page, syntheticHtmlConnections, false);
  await expect(page.getByRole("button", { name: /Followers 2/ })).toBeVisible();
  await expect(page.locator(".accounts li")).toHaveCount(2);
  await expect(
    page
      .locator(".accounts li")
      .filter({ hasText: "@synthetic.follower.dated" }),
  ).toContainText("Jan 1, 2025");
  await page.getByRole("button", { name: /Following 1/ }).click();
  await expect(page.locator(".accounts li")).toHaveCount(1);
  await expect(page.locator(".accounts li")).toContainText("Jan 4, 2025");
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "Connection privacy", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Close friends 2/ }),
  ).toBeVisible();
  await expect(
    page.getByText("@synthetic.closefriend.dated", { exact: true }),
  ).toBeVisible();
});

test("HTML privacy lists keep available-empty, unsupported and missing distinct", async ({
  page,
}) => {
  await page.goto("/connection-privacy/");
  await uploadHtml(page, {
    "close_friends.html": syntheticHtmlConnections["close_friends.html"],
    "blocked_profiles.html": htmlConnectionDocument([
      htmlLabelRecord(
        [["Name", "synthetic.not.an.identity"]],
        "Jan 02, 2025 1:05 pm",
      ),
    ]),
    "restricted_profiles.html": htmlConnectionDocument(
      [],
      "Restricted profiles",
    ).replace("</main>", "<p>No accounts</p></main>"),
  });
  const privacy = page.getByRole("region", {
    name: "Connection privacy dashboard",
  });
  await privacy.getByRole("button", { name: /Restricted accounts 0/ }).click();
  await expect(privacy.getByText("0 accounts", { exact: true })).toBeVisible();
  await privacy.getByRole("button", { name: /Blocked accounts/ }).click();
  await expect(privacy.getByRole("status")).toContainText(
    "Could not read this list",
  );
  await expect(privacy.locator(".accounts")).toHaveCount(0);
  await expect(privacy).not.toContainText("@synthetic.not.an.identity");
  await privacy.getByRole("button", { name: /Story hidden from/ }).click();
  await expect(privacy.getByRole("status")).toContainText("Not included");
  await expect(privacy.locator(".accounts")).toHaveCount(0);
});
