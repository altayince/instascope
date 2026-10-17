import { expect, test } from "@playwright/test";
import { whatsappPublicPaths } from "../../src/lib/whatsapp/public-content";
import { privatePaths } from "../../src/lib/public-paths";
import { inspectSeoHtml } from "../../scripts/audit-public-seo.mjs";
import { collectEvents } from "../helpers/analytics";

const production = "https://instascope.me";
const indexable = process.env.EXPECT_INDEXABLE !== "false";
const guidePaths = whatsappPublicPaths.filter(
  (path) =>
    path.startsWith("/whatsapp/guides/") && path !== "/whatsapp/guides/",
);

test("public WhatsApp initial HTML and private workspaces follow the production/preview search matrix", async ({
  request,
}) => {
  expect(whatsappPublicPaths).toHaveLength(15);
  expect(guidePaths).toHaveLength(10);
  const titles = new Set(),
    descriptions = new Set(),
    headings = new Set();
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => match[1],
  );
  for (const path of whatsappPublicPaths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    const document = inspectSeoHtml(html);
    expect(document.robots, path).toEqual([
      indexable ? "index, follow" : "noindex, nofollow",
    ]);
    expect(document.canonical, path).toEqual([production + path]);
    expect(document.ogUrl, path).toEqual([production + path]);
    expect(document.ogImage, path).toEqual([
      production + "/whatsapp-opengraph-image.png",
    ]);
    expect(document.title, path).toHaveLength(1);
    expect(document.description, path).toHaveLength(1);
    expect(document.h1, path).toHaveLength(1);
    expect(document.mainText.length, path).toBeGreaterThan(180);
    expect(titles.has(document.title[0]), path).toBe(false);
    expect(descriptions.has(document.description[0]), path).toBe(false);
    expect(headings.has(document.h1[0]), path).toBe(false);
    titles.add(document.title[0]);
    descriptions.add(document.description[0]);
    headings.add(document.h1[0]);
    const schema = document.structuredData.map((value) => JSON.parse(value));
    expect(
      schema
        .find((value) => value["@type"] === "BreadcrumbList")
        .itemListElement.at(-1).item,
    ).toBe(production + path);
    expect(document.structuredData.join(" ")).not.toMatch(
      /aggregateRating|reviewCount|workers\.dev|localhost|participantNames/,
    );
    if (guidePaths.includes(path))
      expect(schema.some((value) => value["@type"] === "Article")).toBe(true);
    expect(urls.filter((url) => url === production + path)).toHaveLength(
      indexable ? 1 : 0,
    );
    if (indexable)
      expect(response.headers()["x-robots-tag"] ?? "").not.toMatch(
        /noindex|nofollow|none/,
      );
  }
  for (const path of privatePaths) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(inspectSeoHtml(await response.text()).robots).toEqual([
      indexable ? "noindex, follow" : "noindex, nofollow",
    ]);
    expect(urls).not.toContain(production + path);
  }
  if (!indexable) expect(urls).toEqual([]);
  for (const path of [
    "/whatsapp/no-such-public-guide/",
    "/whatsapp/guides/no-such-guide/",
  ])
    expect((await request.get(path)).status()).toBe(404);
});

test("WhatsApp guides are navigable and readable before JavaScript, on desktop and mobile", async ({
  browser,
  baseURL,
}, testInfo) => {
  const context = await browser.newContext({
    ...testInfo.project.use,
    javaScriptEnabled: false,
    baseURL,
  });
  await context.route("**/api/events", (route) =>
    route.fulfill({ status: 204 }),
  );
  const page = await context.newPage();
  try {
    await page.goto("/whatsapp/guides/");
    await expect(page.locator("main h1")).toBeVisible();
    for (const path of guidePaths)
      await expect(
        page.locator(`main a[href="${path}"]`).first(),
      ).toBeVisible();
    await page.locator(`main a[href="${guidePaths[0]}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(guidePaths[0] + "$"));
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main")).toContainText(/browser|local/i);
    await expect(
      page.locator('main a[href="/whatsapp/chat-analyzer/"]').first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test("guide CTAs reach the existing tool and imported content never enters public metadata or URLs", async ({
  page,
  request,
}) => {
  await collectEvents(page);
  await page.goto("/whatsapp/guides/");
  await page
    .locator('main a[href="/whatsapp/guides/analyze-group-chat/"]')
    .first()
    .click();
  await page.locator('main a[href="/whatsapp/chat-analyzer/"]').first().click();
  await expect(page).toHaveURL(/\/whatsapp\/chat-analyzer\/$/);
  const metadataBefore = await page.locator("head").textContent();
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles({
      name: "synthetic-search.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "01/01/2024, 08:00 - SYNTHETIC_SEO_PRIVATE_A: SYNTHETIC_SEO_PRIVATE_BODY\n01/01/2024, 08:01 - SYNTHETIC_SEO_PRIVATE_B: Synthetic reply",
      ),
    });
  await page
    .getByLabel("Export date/time format", { exact: true })
    .selectOption("dmy-24h");
  await page
    .getByRole("button", { name: "Confirm format and open chat", exact: true })
    .click();
  await expect(
    page
      .locator(".wa-stat")
      .filter({ has: page.getByText("Exported messages", { exact: true }) })
      .locator("strong"),
  ).toHaveText("2");
  expect(await page.locator("head").textContent()).toBe(metadataBefore);
  expect(await page.locator("head").innerHTML()).not.toContain(
    "SYNTHETIC_SEO_PRIVATE",
  );
  expect(page.url()).not.toContain("SYNTHETIC_SEO_PRIVATE");
  for (const path of [
    "/whatsapp/chat-analyzer/",
    "/whatsapp/chat-vault/",
    "/sitemap.xml",
  ])
    expect(await (await request.get(path)).text()).not.toContain(
      "SYNTHETIC_SEO_PRIVATE",
    );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open chat export", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wa-current-chat")).toHaveCount(0);
  expect(
    await page
      .getByLabel("Upload WhatsApp chat export", { exact: true })
      .evaluate((input: HTMLInputElement) => input.files?.length),
  ).toBe(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    production + "/whatsapp/chat-analyzer/",
  );
});

for (const theme of ["light", "dark"] as const) {
  test(`all WhatsApp guides remain readable with accessible tables in ${theme}`, async ({
    page,
  }, testInfo) => {
    await collectEvents(page);
    await page.addInitScript(
      (value) => localStorage.setItem("instascope-theme", value),
      theme,
    );
    for (const path of guidePaths) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("main p").first()).toBeVisible();
      // Paint before reading computed styles in mobile WebKit.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const readability = await page.locator("main").evaluate((main) => {
        const rgba = (color: string) =>
          (color.match(/[\d.]+/g) ?? []).map(Number);
        const luminance = (color: number[]) =>
          color
            .slice(0, 3)
            .map((channel) => {
              const value = channel / 255;
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            })
            .reduce(
              (sum, value, index) =>
                sum + value * [0.2126, 0.7152, 0.0722][index],
              0,
            );
        const contrast = (element: Element) => {
          const ancestors: Element[] = [];
          for (
            let current: Element | null = element;
            current;
            current = current.parentElement
          )
            ancestors.unshift(current);
          let background = [255, 255, 255];
          for (const ancestor of ancestors) {
            const color = rgba(getComputedStyle(ancestor).backgroundColor);
            const alpha = color[3] ?? 1;
            background = background.map(
              (base, index) =>
                (color[index] ?? base) * alpha + base * (1 - alpha),
            );
          }
          const foreground = luminance(rgba(getComputedStyle(element).color));
          const behind = luminance(background);
          return (
            (Math.max(foreground, behind) + 0.05) /
            (Math.min(foreground, behind) + 0.05)
          );
        };
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          contrasts: [...main.querySelectorAll("h1, h2, p, th, td")]
            .filter((element) => element.getBoundingClientRect().width > 0)
            .map(contrast),
        };
      });
      expect(readability.overflow, path).toBe(false);
      for (const ratio of readability.contrasts)
        expect(ratio, `${path} text contrast`).toBeGreaterThanOrEqual(4.5);
      for (const region of await page.locator(".article-table-scroll").all()) {
        await expect(region).toHaveAttribute("role", "region");
        await expect(region).toHaveAttribute("tabindex", "0");
        await expect(region).toHaveAccessibleName(/table$/);
        await expect(region.locator("caption")).toBeVisible();
        await region.focus();
        await expect(region).toBeFocused();
        if (
          await region.evaluate(
            (element) => element.scrollWidth > element.clientWidth + 2,
          )
        ) {
          await page.keyboard.press("ArrowRight");
          await expect
            .poll(() => region.evaluate((element) => element.scrollLeft))
            .toBeGreaterThan(0);
        }
      }
      if (path === guidePaths[0]) {
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: "instant" }),
        );
        await testInfo.attach(`whatsapp-guide-${theme}`, {
          body: await page.screenshot({
            fullPage: true,
            animations: "disabled",
          }),
          contentType: "image/png",
        });
      }
    }
    for (const [name, path] of [
      ["hub", "/whatsapp/guides/"],
      ["tool", "/whatsapp/chat-analyzer/"],
    ] as const) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await testInfo.attach(`whatsapp-${name}-${theme}`, {
        body: await page.screenshot({ fullPage: true, animations: "disabled" }),
        contentType: "image/png",
      });
    }
  });
}
