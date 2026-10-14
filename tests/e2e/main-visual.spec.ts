import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const mainUrl = process.env.MAIN_VISUAL_REFERENCE_URL!;
const identity = ".site-header > .brand, .social-switcher > summary.brand";
const cases = [
  { path: "/", state: "landing" },
  ...[
    "/dashboard/",
    "/followers-analyzer/",
    "/instagram-cleaner/",
    "/instagram-wrapped/",
    "/snapshot-vault/",
  ].flatMap((path) => [
    { path, state: "landing" },
    { path, state: "demo" },
  ]),
  ...[
    "/pending-follow-requests/",
    "/connection-privacy/",
    "/unfollow-history/",
    "/relationship-timeline/",
    "/snapshot-comparison/",
  ].map((path) => ({ path, state: "demo" })),
  {
    path: "/how-to-see-when-someone-followed-you-on-instagram/",
    state: "landing",
  },
  { path: "/privacy/", state: "landing" },
];

async function artifact(
  info: TestInfo,
  name: string,
  body: Buffer | string,
  contentType: "image/png" | "application/json",
) {
  const path = info.outputPath(
    `${name}.${contentType === "image/png" ? "png" : "json"}`,
  );
  await writeFile(path, body);
  await info.attach(name, { path, contentType });
}

async function ready(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.mouse.move(0, 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "the page fits the viewport",
  ).toBe(true);
}

async function open(page: Page, base: string, path: string, state: string) {
  await page.clock.setFixedTime(new Date("2026-10-14T12:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const destination =
    path === "/snapshot-vault/" && state === "demo"
      ? `${path}?demo=true`
      : path;
  expect((await page.goto(new URL(destination, base).href))!.status()).toBe(
    200,
  );
  await expect(page.locator("main h1")).toBeVisible();
  if (state === "demo" && path !== "/snapshot-vault/") {
    await page.getByRole("button", { name: "Try demo", exact: true }).click();
    await expect(page.locator(".demo-notice")).toBeVisible();
  }
  if (state === "demo" && path === "/snapshot-vault/")
    await expect(page.locator(".vault-row")).toHaveCount(4);
  if (state === "landing" && path === "/snapshot-vault/")
    await expect(
      page.getByText("No snapshots saved yet.", { exact: true }),
    ).toBeVisible();
  if (state === "demo" && path === "/instagram-wrapped/")
    await expect(
      page.getByRole("button", { name: "Download my Wrapped", exact: true }),
    ).toBeEnabled();
  await ready(page);
}

async function appearance(page: Page) {
  return page.evaluate(() => {
    const properties = [
      "color",
      "background-color",
      "background-image",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
      "border-style",
      "border-radius",
      "box-shadow",
      "outline-color",
      "outline-style",
      "outline-width",
      "outline-offset",
      "accent-color",
      "fill",
      "stroke",
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "line-height",
      "letter-spacing",
      "text-align",
      "text-decoration",
      "text-transform",
      "white-space",
      "display",
      "position",
      "padding",
      "margin",
      "gap",
      "grid-template-columns",
      "grid-template-rows",
      "flex",
      "flex-direction",
      "align-items",
      "justify-content",
      "overflow-x",
      "overflow-y",
      "opacity",
      "transform",
    ];
    return Array.from(document.querySelectorAll("body, body *"))
      .filter(
        (node) =>
          !node.matches("script, style") &&
          !node.closest(".social-switcher, .site-header > .brand"),
      )
      .map((node) => {
        const box = node.getBoundingClientRect();
        return {
          tag: node.tagName,
          class: node.getAttribute("class"),
          text: node.childElementCount ? null : node.textContent,
          bounds: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          },
          styles: [null, "::before", "::after"].map((pseudo) => {
            const style = getComputedStyle(node, pseudo);
            return Object.fromEntries(
              properties.map((property) => [
                property,
                style.getPropertyValue(property),
              ]),
            );
          }),
        };
      });
  });
}

async function compare(main: Page, dev: Page, info: TestInfo) {
  await Promise.all([ready(main), ready(dev)]);
  const [mainStyles, devStyles] = await Promise.all([
    appearance(main),
    appearance(dev),
  ]);
  const [mainIdentity, devIdentity] = await Promise.all([
    main.locator(identity).boundingBox(),
    dev.locator(identity).boundingBox(),
  ]);
  expect(mainIdentity).not.toBeNull();
  expect(devIdentity).not.toBeNull();
  const mask = {
    x: Math.floor(Math.min(mainIdentity!.x, devIdentity!.x)),
    y: Math.floor(Math.min(mainIdentity!.y, devIdentity!.y)),
    right: Math.ceil(
      Math.max(
        mainIdentity!.x + mainIdentity!.width,
        devIdentity!.x + devIdentity!.width,
      ),
    ),
    bottom: Math.ceil(
      Math.max(
        mainIdentity!.y + mainIdentity!.height,
        devIdentity!.y + devIdentity!.height,
      ),
    ),
  };
  for (const item of [main, dev]) {
    const navigation = (await item
      .locator(".product-navigation")
      .boundingBox())!;
    expect(
      mask.right <= navigation.x || mask.bottom <= navigation.y,
      "the identity mask cannot cover the header navigation",
    ).toBe(true);
  }
  const capture = async (page: Page) => {
    // The sole masked area is the top-left identity. Keep the complete header,
    // navigation, privacy note, content, skip link and footer in the comparison.
    await page.evaluate((box) => {
      const overlay = document.createElement("div");
      overlay.dataset.mainVisualIdentityMask = "true";
      Object.assign(overlay.style, {
        position: "absolute",
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.right - box.x}px`,
        height: `${box.bottom - box.y}px`,
        background: "#ff00ff",
        zIndex: "2147483647",
        pointerEvents: "none",
      });
      document.body.append(overlay);
    }, mask);
    const png = await page.screenshot({
      fullPage: true,
      scale: "css",
      animations: "disabled",
      caret: "hide",
    });
    await page
      .locator("[data-main-visual-identity-mask]")
      .evaluate((node) => node.remove());
    return png;
  };
  const [mainPng, devPng] = await Promise.all([capture(main), capture(dev)]);
  const [mainPixels, devPixels] = await Promise.all(
    [mainPng, devPng].map((png) =>
      sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ),
  );
  let changedPixels = 0;
  for (let index = 0; index < mainPixels.data.length; index += 4)
    if (
      mainPixels.data[index] !== devPixels.data[index] ||
      mainPixels.data[index + 1] !== devPixels.data[index + 1] ||
      mainPixels.data[index + 2] !== devPixels.data[index + 2] ||
      mainPixels.data[index + 3] !== devPixels.data[index + 3]
    )
      changedPixels++;
  await artifact(info, "current-main", mainPng, "image/png");
  await artifact(info, "proposed-dev", devPng, "image/png");
  await artifact(
    info,
    "comparison",
    JSON.stringify({
      changedPixels,
      mainDimensions: mainPixels.info,
      devDimensions: devPixels.info,
      comparedElements: mainStyles.length,
      mask,
    }),
    "application/json",
  );
  expect(
    devStyles,
    "all computed styles and geometry outside identity",
  ).toEqual(mainStyles);
  expect(devPixels.info, "complete page dimensions").toEqual(mainPixels.info);
  expect(changedPixels, "pixels outside the top-left identity").toBe(0);
}

test.describe("actual current main vs enabled dev", () => {
  for (const entry of cases)
    test(`${entry.path} ${entry.state} has exactly main's appearance`, async ({
      context,
      page,
      baseURL,
    }, info) => {
      const reference = await context.newPage();
      await Promise.all([
        open(reference, mainUrl, entry.path, entry.state),
        open(page, baseURL!, entry.path, entry.state),
      ]);
      await compare(reference, page, info);
    });

  test("header geometry and control hover/focus remain exactly main", async ({
    page,
    context,
    baseURL,
  }, info) => {
    const reference = await context.newPage();
    await Promise.all([
      open(reference, mainUrl, "/", "landing"),
      open(page, baseURL!, "/", "landing"),
    ]);
    const targets = [
      ".hero-actions .primary",
      ".hero-actions .secondary",
      ".product-navigation > a",
      ".tool-menu > summary",
    ];
    for (const selector of targets) {
      const controls = [reference, page].map((item) =>
        item.locator(selector).first(),
      );
      await Promise.all(controls.map((control) => control.hover()));
      const styles = await Promise.all(
        controls.map((control) =>
          control.evaluate((node) => {
            const style = getComputedStyle(node);
            return {
              color: style.color,
              background: style.backgroundColor,
              border: style.border,
              boxShadow: style.boxShadow,
            };
          }),
        ),
      );
      expect(styles[1], `${selector} hover`).toEqual(styles[0]);
      await Promise.all([
        reference.keyboard.press("Tab"),
        page.keyboard.press("Tab"),
      ]);
      await Promise.all(controls.map((control) => control.focus()));
      const focus = await Promise.all(
        controls.map((control) =>
          control.evaluate((node) => {
            const style = getComputedStyle(node);
            return { outline: style.outline, offset: style.outlineOffset };
          }),
        ),
      );
      expect(focus[1], `${selector} keyboard focus`).toEqual(focus[0]);
      expect(focus[0].outline).toContain("solid");
    }
    await compare(reference, page, info);
  });

  test("the existing Instagram Wrapped URL is preserved", async ({
    request,
  }) => {
    for (const base of [mainUrl, "http://127.0.0.1:3000"])
      expect(
        (await request.get(new URL("/wrapped/", base).href)).status(),
      ).toBe(404);
  });

  test("WhatsApp uses current main's rendered controls, surfaces and charts", async ({
    page,
    context,
    baseURL,
  }, info) => {
    const reference = await context.newPage();
    await Promise.all([
      open(reference, mainUrl, "/", "landing"),
      open(page, baseURL!, "/whatsapp/", "landing"),
    ]);
    const styles = (item: Page, selector: string, properties: string[]) =>
      item
        .locator(selector)
        .first()
        .evaluate((node, names) => {
          const style = getComputedStyle(node);
          return Object.fromEntries(
            names.map((name) => [name, style.getPropertyValue(name)]),
          );
        }, properties);
    for (const selector of ["body", ".site-header", ".header-note", ".primary"])
      expect(
        await styles(page, selector, [
          "color",
          "background-color",
          "border",
          "font-family",
          "box-shadow",
        ]),
        selector,
      ).toEqual(
        await styles(reference, selector, [
          "color",
          "background-color",
          "border",
          "font-family",
          "box-shadow",
        ]),
      );
    const white = (await styles(reference, ".secondary", ["background-color"]))[
      "background-color"
    ];
    const border = (
      await styles(reference, ".site-header", ["border-bottom-color"])
    )["border-bottom-color"];
    for (const selector of [".primary"]) {
      await Promise.all([
        reference.locator(selector).first().hover(),
        page.locator(selector).first().hover(),
      ]);
      expect(
        await styles(page, selector, ["color", "background-color", "border"]),
        `${selector} hover`,
      ).toEqual(
        await styles(reference, selector, [
          "color",
          "background-color",
          "border",
        ]),
      );
      await Promise.all([
        reference.keyboard.press("Tab"),
        page.keyboard.press("Tab"),
      ]);
      await Promise.all([
        reference.locator(selector).first().focus(),
        page.locator(selector).first().focus(),
      ]);
      expect(
        await styles(page, selector, ["outline", "outline-offset"]),
        `${selector} focus`,
      ).toEqual(
        await styles(reference, selector, ["outline", "outline-offset"]),
      );
    }
    await reference.close();
    await ready(page);
    await artifact(
      info,
      "whatsapp-current-main-controls",
      await page.screenshot({
        fullPage: true,
        scale: "css",
        animations: "disabled",
      }),
      "image/png",
    );
    const charts = await context.newPage();
    await Promise.all([
      open(charts, mainUrl, "/snapshot-vault/", "demo"),
      open(page, baseURL!, "/whatsapp/chat-analyzer/", "landing"),
    ]);
    await page
      .getByRole("button", { name: "Try the fictional demo", exact: true })
      .click();
    await expect(page.locator(".wa-stat").first()).toBeVisible();
    for (const [whatsapp, instagram] of [
      [".wa-chart-track i", ".vault-followers-point"],
      [".wa-participant-track i", ".vault-followers-point"],
      [
        ".wa-participant-row:nth-child(2) .wa-participant-track i",
        ".vault-following-point",
      ],
    ])
      expect(
        (await styles(page, whatsapp, ["background-color"]))[
          "background-color"
        ],
      ).toBe((await styles(charts, instagram, ["fill"])).fill);
    const surface = await styles(page, ".wa-panel", [
      "background-color",
      "border-color",
    ]);
    expect(surface["background-color"]).toBe(white);
    expect(surface["border-color"]).toBe(border);
    await ready(page);
    await artifact(
      info,
      "whatsapp-current-main-charts",
      await page.screenshot({
        fullPage: true,
        scale: "css",
        animations: "disabled",
      }),
      "image/png",
    );
    await Promise.all([
      open(charts, mainUrl, "/instagram-wrapped/", "demo"),
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Wrapped", exact: true })
        .click(),
    ]);
    await expect(
      page.getByRole("button", { name: "Share card", exact: true }),
    ).toBeEnabled();
    const whatsappShare = ".wa-export-actions > .secondary";
    const instagramShare = ".wrapped-actions > .secondary";
    expect(
      await styles(page, whatsappShare, [
        "color",
        "background-color",
        "border",
      ]),
    ).toEqual(
      await styles(charts, instagramShare, [
        "color",
        "background-color",
        "border",
      ]),
    );
    await Promise.all([
      charts.locator(instagramShare).hover(),
      page.locator(whatsappShare).hover(),
    ]);
    expect(
      await styles(page, whatsappShare, [
        "color",
        "background-color",
        "border",
      ]),
    ).toEqual(
      await styles(charts, instagramShare, [
        "color",
        "background-color",
        "border",
      ]),
    );
    await ready(page);
    await artifact(
      info,
      "whatsapp-current-main-wrapped",
      await page.screenshot({
        fullPage: true,
        scale: "css",
        animations: "disabled",
      }),
      "image/png",
    );
  });
});
