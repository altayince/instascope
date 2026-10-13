import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import sharp from "sharp";

const enabled = process.env.EXPECT_WHATSAPP === "true";

// These computed colours come from the original InstaScope styles at 4163a28.
// Pin actual controls as well as comparing platforms, so two changed palettes
// cannot pass merely because they match one another.
const ink = "rgb(38, 59, 48)";
const muted = "rgb(101, 113, 104)";
const line = "rgb(225, 229, 220)";
const white = "rgb(255, 255, 255)";
const focus = "rgb(102, 137, 53)";
const navActive = "rgb(234, 240, 223)";
const chartOne = "rgb(48, 91, 64)";
const chartTwo = "rgb(162, 105, 50)";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function expectBase(page: Page) {
  // Check the painted page margin, away from WebKit's native corner overlay.
  // Canvas ancestors can report default computed values despite correct paint.
  const background = await sharp(await page.screenshot())
    .extract({ left: 10, top: 10, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  expect(Array.from(background)).toEqual([250, 249, 245, 255]);
  expect(
    await page
      .locator("html")
      .evaluate((node) =>
        getComputedStyle(node).getPropertyValue("--paper").trim(),
      ),
  ).toBe("#faf9f5");
  await expect(page.locator("main h1")).toHaveCSS("color", ink);
  await expect(page.locator("main p").first()).toHaveCSS("color", muted);
  await expect(page.locator(".site-header")).toHaveCSS(
    "border-bottom-color",
    line,
  );
}

async function expectFocus(page: Page, control: Locator) {
  await page.keyboard.press("Tab");
  await control.focus();
  await expect(control).toBeFocused();
  await expect(control).toHaveCSS("outline-color", focus);
  await expect(control).toHaveCSS("outline-style", "solid");
  await expect(control).toHaveCSS("outline-width", "3px");
  await expect(control).toHaveCSS("outline-offset", "4px");
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
      "box-shadow",
      "outline-color",
      "accent-color",
      "fill",
      "stroke",
    ];
    return Array.from(
      document.querySelectorAll(
        "main, main *, footer, footer *, .product-navigation, .product-navigation *",
      ),
      (node) => ({
        tag: node.tagName,
        class: node.getAttribute("class"),
        styles: [null, "::before", "::after"].map((pseudo) => {
          const style = getComputedStyle(node, pseudo);
          return Object.fromEntries(
            properties.map((property) => [
              property,
              style.getPropertyValue(property),
            ]),
          );
        }),
      }),
    );
  });
}

async function captureContent(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const geometry = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      main: bounds("main"),
      footer: bounds("footer"),
      scale: devicePixelRatio,
    };
  });
  // Capture from one document origin, then crop. Locator screenshots scroll
  // large elements differently when their ancestor changes; at mobile DPR that
  // changes raster rounding even when all document bounds are identical.
  const png = await page.screenshot({
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    // Chromium can paint this offscreen fixed link into oversized captures.
    style: ".skip-link { visibility: hidden !important; }",
  });
  const size = await sharp(png).metadata();
  const crop = (box: typeof geometry.main) => {
    const left = Math.floor(box.x * geometry.scale);
    const top = Math.floor(box.y * geometry.scale);
    return sharp(png)
      .extract({
        left,
        top,
        width:
          Math.min(
            size.width!,
            Math.ceil((box.x + box.width) * geometry.scale),
          ) - left,
        height:
          Math.min(
            size.height!,
            Math.ceil((box.y + box.height) * geometry.scale),
          ) - top,
      })
      .png()
      .toBuffer();
  };
  const [main, footer] = await Promise.all([
    crop(geometry.main),
    crop(geometry.footer),
  ]);
  return { main, footer, geometry };
}

function pixelDifference(left: Buffer, right: Buffer) {
  if (left.equals(right)) return 0;
  let changed = 0;
  for (let index = 0; index < left.length; index += 4) {
    if (
      Math.abs(left[index] - right[index]) > 3 ||
      Math.abs(left[index + 1] - right[index + 1]) > 3 ||
      Math.abs(left[index + 2] - right[index + 2]) > 3 ||
      Math.abs(left[index + 3] - right[index + 3]) > 3
    )
      changed++;
  }
  return changed;
}

async function expectLegacyAppearance(page: Page, info: TestInfo) {
  const shell = page.locator(".platform-shell");
  if (!(await shell.count())) return; // Default production uses the legacy shell.
  await expect(shell).toHaveAttribute("data-platform", "instagram");
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.mouse.move(0, 0);
  const current = await captureContent(page);
  const currentStyles = await appearance(page);

  // Keep the exact same content and header nodes, removing only the preview
  // ancestor. This recreates the disabled shell's content CSS ancestry without
  // rebuilding, changing data, or letting header branding affect the comparison.
  await shell.evaluate((node) =>
    node.replaceWith(...Array.from(node.childNodes)),
  );
  const legacy = await captureContent(page);
  const [main, mainReference, footer, footerReference] = await Promise.all(
    [current.main, legacy.main, current.footer, legacy.footer].map((png) =>
      sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ),
  );
  expect(mainReference.info).toEqual(main.info);
  expect(footerReference.info).toEqual(footer.info);
  const differences = {
    main: pixelDifference(main.data, mainReference.data),
    footer: pixelDifference(footer.data, footerReference.data),
  };
  // Reparenting can change isolated antialiasing at mobile DPR. Allow only a
  // 3/255 channel noise floor and at most 200 pixels / 0.001% above it. All
  // computed colours, dimensions and document geometry remain exact below.
  const mainMatches =
    differences.main <= 200 &&
    differences.main / (main.info.width * main.info.height) <= 0.00001;
  const footerMatches =
    differences.footer <= 200 &&
    differences.footer / (footer.info.width * footer.info.height) <= 0.00001;
  await info.attach("pixel-comparison", {
    body: JSON.stringify(differences),
    contentType: "application/json",
  });
  await info.attach("original-palette-main", {
    body: current.main,
    contentType: "image/png",
  });
  if (!mainMatches || !footerMatches) {
    await info.attach("legacy-main-reference", {
      body: legacy.main,
      contentType: "image/png",
    });
    await info.attach("preview-footer", {
      body: current.footer,
      contentType: "image/png",
    });
    await info.attach("legacy-footer-reference", {
      body: legacy.footer,
      contentType: "image/png",
    });
  }
  expect(legacy.geometry).toEqual(current.geometry);
  expect(await appearance(page)).toEqual(currentStyles);
  expect(
    mainMatches,
    "main pixels and dimensions match legacy appearance",
  ).toBe(true);
  expect(
    footerMatches,
    "footer pixels and dimensions match legacy appearance",
  ).toBe(true);
}

test("Instagram landing retains original cards, buttons, hover and focus colours", async ({
  page,
}, info) => {
  await page.goto("/");
  const primary = page.locator(".hero-actions .primary");
  const secondary = page.locator(".hero-actions .secondary");
  await expect(secondary).toBeEnabled();
  await expectBase(page);
  await expect(primary).toHaveCSS("background-color", ink);
  await expect(primary).toHaveCSS("color", white);
  await expect(secondary).toHaveCSS("background-color", white);
  await expect(secondary).toHaveCSS("border-color", "rgb(185, 197, 184)");
  await expect(page.locator(".hero-copy .pill")).toHaveCSS(
    "background-color",
    "rgb(238, 241, 231)",
  );
  await expect(page.locator(".hero-copy .pill i")).toHaveCSS(
    "background-color",
    "rgb(89, 129, 85)",
  );
  await expect(page.locator(".result-preview")).toHaveCSS(
    "background-color",
    "rgb(238, 242, 231)",
  );
  await expect(page.locator(".upload")).toHaveCSS(
    "background-color",
    "rgb(241, 244, 235)",
  );
  await expect(page.locator(".upload")).toHaveCSS(
    "border-color",
    "rgb(181, 196, 168)",
  );
  await expect(page.locator(".feature-card.followers-analyzer")).toHaveCSS(
    "background-color",
    "rgb(240, 241, 232)",
  );
  await expect(page.locator(".feature-card.instagram-cleaner")).toHaveCSS(
    "background-color",
    "rgb(243, 236, 227)",
  );
  await expect(page.locator(".feature-card.instagram-wrapped")).toHaveCSS(
    "background-color",
    "rgb(238, 234, 241)",
  );
  await expect(page.locator(".intro-line .eyebrow")).toHaveCSS("color", muted);
  await primary.hover();
  await expect(primary).toHaveCSS("background-color", "rgb(60, 82, 66)");
  await secondary.hover();
  await expect(secondary).toHaveCSS("background-color", "rgb(241, 244, 236)");
  await expect(secondary).toHaveCSS("border-color", ink);
  await expectFocus(page, primary);
  await expectLegacyAppearance(page, info);
});

test("Instagram demo dashboard retains original insight card and navigation colours", async ({
  page,
}, info) => {
  await page.goto("/dashboard/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const insight = page.locator(".insight-card").first();
  await expect(insight).toBeVisible();
  await expectBase(page);
  await expect(insight).toHaveCSS("background-color", "rgb(237, 243, 227)");
  await expect(insight).toHaveCSS("border-color", "rgb(212, 222, 199)");
  await expect(page.locator(".dashboard-metrics > div").first()).toHaveCSS(
    "background-color",
    white,
  );
  const current = page.locator('.product-navigation > a[aria-current="page"]');
  await expect(current).toHaveCSS("background-color", navActive);
  await expect(current).toHaveCSS("color", ink);
  await insight.hover();
  await expect(insight).toHaveCSS("background-color", "rgb(232, 240, 218)");
  await expect(insight).toHaveCSS("border-color", "rgb(115, 132, 92)");
  await expectLegacyAppearance(page, info);
});

test("Instagram demo Vault retains original chart, summary, checkbox and menu colours", async ({
  page,
}, info) => {
  await page.goto("/snapshot-vault/?demo=true");
  await expect(page.locator(".vault-row")).toHaveCount(4);
  await expect(page.locator(".pulse-facts")).toBeVisible();
  await expectBase(page);
  await expect(page.locator(".vault-overview")).toHaveCSS(
    "background-color",
    "rgb(238, 242, 231)",
  );
  await expect(page.locator(".vault-overview")).toHaveCSS(
    "border-color",
    "rgb(214, 223, 203)",
  );
  await expect(page.locator(".pulse-facts")).toHaveCSS(
    "background-color",
    "rgb(238, 242, 231)",
  );
  await expect(page.locator(".pulse-facts")).toHaveCSS("border-color", line);
  await expect(page.locator(".vault-followers-point").first()).toHaveCSS(
    "fill",
    chartOne,
  );
  await expect(page.locator(".vault-following-point").first()).toHaveCSS(
    "fill",
    chartTwo,
  );
  await expect(page.locator(".vault-trend-grid").first()).toHaveCSS(
    "stroke",
    line,
  );
  await expect(page.locator('input[type="checkbox"]').first()).toHaveCSS(
    "accent-color",
    ink,
  );
  const summary = page.locator('.tool-menu[data-active="true"] > summary');
  await expect(summary).toHaveCSS("background-color", navActive);
  await expect(summary).toHaveCSS("color", ink);
  await summary.click();
  await expect(
    page.locator('.tool-menu-links a[aria-current="page"]'),
  ).toHaveCSS("background-color", "rgb(238, 242, 231)");
  await page.keyboard.press("Escape");
  await expectFocus(page, summary);
  await expectLegacyAppearance(page, info);
});

test("Instagram analyzer retains original active tool tab colours", async ({
  page,
}, info) => {
  await page.goto("/followers-analyzer/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.locator(".stats-grid")).toBeVisible();
  const current = page.locator('.tool-tabs a[aria-current="page"]');
  await expect(current).toHaveCSS("background-color", ink);
  await expect(current).toHaveCSS("color", white);
  await expectLegacyAppearance(page, info);
});

test("WhatsApp demo uses the same original control, panel, chart and focus colours", async ({
  page,
}) => {
  test.skip(!enabled, "WhatsApp requires an explicit preview build.");
  await page.goto("/whatsapp/chat-analyzer/");
  await page.getByRole("button", { name: "Try the fictional demo" }).click();
  await expect(page.locator(".wa-stat").first()).toBeVisible();
  await expectBase(page);
  await expect(page.locator(".wa-workspace .primary").first()).toHaveCSS(
    "background-color",
    ink,
  );
  await expect(page.locator(".wa-panel").first()).toHaveCSS(
    "background-color",
    white,
  );
  await expect(page.locator(".wa-panel").first()).toHaveCSS(
    "border-color",
    line,
  );
  await expect(page.locator(".wa-stat-featured")).toHaveCSS(
    "background-color",
    ink,
  );
  await expect(page.locator(".wa-chart-track i").first()).toHaveCSS(
    "background-color",
    chartOne,
  );
  await expect(page.locator(".wa-participant-track i").first()).toHaveCSS(
    "background-color",
    chartOne,
  );
  await expect(
    page
      .locator(".wa-participant-row")
      .nth(1)
      .locator(".wa-participant-track i"),
  ).toHaveCSS("background-color", chartTwo);
  const current = page.locator('.product-navigation > a[aria-current="page"]');
  await expect(current).toHaveCSS("background-color", navActive);
  await expect(current).toHaveCSS("color", ink);
  await expectFocus(
    page,
    page.getByLabel("Export date/time format", { exact: true }),
  );
});
