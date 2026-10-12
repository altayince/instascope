import { expect, test, type Locator } from "@playwright/test";

async function expectAligned(navigation: Locator) {
  const items = await navigation
    .locator(":scope > a, :scope > details > summary")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        const text = [...element.childNodes].find(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        )!;
        const range = document.createRange();
        range.selectNodeContents(text);
        const textBounds = range.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          label: element.textContent?.trim(),
          top: bounds.top,
          bottom: bounds.bottom,
          height: bounds.height,
          textTop: textBounds.top,
          textBottom: textBounds.bottom,
          display: style.display,
          lineHeight: style.lineHeight,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
        };
      }),
    );
  expect(items.map((item) => item.label)).toEqual([
    "Dashboard",
    "Circle",
    "History",
    "Review",
    "Wrapped",
    "More",
  ]);
  // On mobile the six destinations form two rows. Compare each row's outer
  // bounds and text bounds: min-height alone did not catch the old baseline bug.
  for (const item of items) {
    expect(item.display, item.label).toBe("flex");
    expect(item.height, item.label).toBeGreaterThanOrEqual(44);
    expect(item.lineHeight, item.label).toBe(items[0].lineHeight);
    expect(item.paddingTop, item.label).toBe(items[0].paddingTop);
    expect(item.paddingBottom, item.label).toBe(items[0].paddingBottom);
    for (const peer of items.filter(
      (peer) => Math.abs(peer.top - item.top) <= 2,
    )) {
      for (const key of ["top", "bottom", "textTop", "textBottom"] as const)
        expect(
          Math.abs(item[key] - peer[key]),
          `${item.label}/${peer.label} ${key}`,
        ).toBeLessThanOrEqual(1.5);
    }
  }
}

test("header direct links and native menu triggers stay aligned in active sections", async ({
  page,
}) => {
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await page.goto("/");
  await expectAligned(navigation);
  await expect(
    navigation.locator('details[data-section="wrapped"]'),
  ).toHaveCount(0);
  await expect(
    navigation.getByRole("link", { name: "Wrapped", exact: true }),
  ).toHaveAttribute("href", "/instagram-wrapped/");

  await navigation.getByRole("link", { name: "Wrapped", exact: true }).click();
  await expect(page).toHaveURL(/\/instagram-wrapped\/$/);
  const wrapped = navigation.getByRole("link", {
    name: "Wrapped",
    exact: true,
  });
  await expect(wrapped).toHaveAttribute("aria-current", "page");
  await expectAligned(navigation);
  const wrappedActive = await wrapped.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    weight: getComputedStyle(element).fontWeight,
  }));

  const history = navigation.locator('details[data-section="history"]');
  await history.locator("summary").click();
  await history
    .getByRole("link", { name: "Relationship timeline", exact: true })
    .click();
  await expect(page).toHaveURL(/\/relationship-timeline\/$/);
  await expect(history).not.toHaveAttribute("open");
  await expect(history).toHaveAttribute("data-active", "true");
  await expect(wrapped).not.toHaveAttribute("aria-current");
  await expectAligned(navigation);
  expect(
    await history.locator("summary").evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      weight: getComputedStyle(element).fontWeight,
    })),
  ).toEqual(wrappedActive);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("header native disclosure keeps keyboard activation, Escape focus and mobile menu bounds", async ({
  page,
}) => {
  await page.goto("/");
  // Native summary activation works before hydration. Wait for the existing
  // client-ready control so the initial pathname effect has run before opening.
  await expect(
    page.getByRole("button", { name: "Try demo", exact: true }),
  ).toBeEnabled();
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  const history = navigation.locator('details[data-section="history"]');
  const summary = history.locator("summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(history).toHaveAttribute("open");
  await expectAligned(navigation);
  expect(
    await history.locator(".tool-menu-links").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth;
    }),
  ).toBe(true);
  const timeline = history.getByRole("link", {
    name: "Relationship timeline",
    exact: true,
  });
  await timeline.focus();
  await timeline.press("Escape");
  await expect(history).not.toHaveAttribute("open");
  await expect(summary).toBeFocused();

  await summary.press("Space");
  await expect(history).toHaveAttribute("open");
  await summary.press("Escape");
  await expect(history).not.toHaveAttribute("open");
  await expect(summary).toBeFocused();
  await summary.click();
  await expect(history).toHaveAttribute("open");
  await navigation.getByRole("link", { name: "Wrapped", exact: true }).click();
  await expect(page).toHaveURL(/\/instagram-wrapped\/$/);
  await expect(history).not.toHaveAttribute("open");
  await expectAligned(navigation);
});
