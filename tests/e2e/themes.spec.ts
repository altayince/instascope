import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { collectEvents, productEvents } from "../helpers/analytics";

type Theme = "light" | "dark";
const toggle = (page: Page) =>
  page.getByRole("switch", { name: "Dark mode", exact: true });
const palettes = {
  light: { background: "rgb(250, 249, 245)", ink: "rgb(38, 59, 48)" },
  dark: { background: "rgb(9, 11, 10)", ink: "rgb(244, 246, 242)" },
};

async function appearance(page: Page, theme: Theme) {
  // WebKit may defer computed styles until a background page has painted.
  await page.screenshot({ scale: "css", animations: "disabled" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    palettes[theme].background,
  );
  await expect(page.locator("body")).toHaveCSS("color", palettes[theme].ink);
  await expect(page.locator("body")).toHaveCSS("color-scheme", theme);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

async function selectTheme(page: Page, theme: Theme) {
  await expect(toggle(page)).toBeEnabled();
  if (
    (await toggle(page).getAttribute("aria-checked")) !==
    String(theme === "dark")
  ) {
    await toggle(page).evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await toggle(page).click();
  }
  await expect(toggle(page)).toHaveAttribute(
    "aria-checked",
    String(theme === "dark"),
  );
  await appearance(page, theme);
}

async function switchPlatform(page: Page, platform: "Instagram" | "WhatsApp") {
  const selector = page.locator(".social-switcher");
  await selector.locator("summary").click();
  await selector
    .getByRole("link", { name: new RegExp(`^${platform}`) })
    .click();
  await expect(page.locator(".site-header")).toHaveAttribute(
    "data-platform",
    platform.toLowerCase(),
  );
}

test.beforeEach(async ({ page }) => {
  await collectEvents(page);
});

test("first visit is Light even with a dark OS preference; invalid saved values stay Light", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await appearance(page, "light");
  await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
  expect(
    await page.evaluate(() => localStorage.getItem("instascope-theme")),
  ).toBeNull();
  await page.evaluate(() => localStorage.setItem("instascope-theme", "system"));
  await page.reload();
  await appearance(page, "light");
});

test("stored Dark is painted before React hydration without a Light frame", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("instascope-theme", "dark");
    const frames: string[] = [];
    Object.assign(window, { themePaints: frames });
    const sample = () => {
      if (document.body) {
        const background = getComputedStyle(document.body).backgroundColor;
        if (background !== "rgba(0, 0, 0, 0)") frames.push(background);
      }
      if (frames.length < 10) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  // The allowlisted pre-paint script must work independently of Next's runtime.
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/privacy/");
  await appearance(page, "dark");
  await expect(toggle(page)).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { themePaints: string[] }).themePaints.length,
      ),
    )
    .toBeGreaterThan(0);
  const frames = await page.evaluate(
    () => (window as unknown as { themePaints: string[] }).themePaints,
  );
  expect(frames.every((color) => color === palettes.dark.background)).toBe(
    true,
  );
});

test("JavaScript-disabled visitors get readable default Light", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.route("**/api/events", (route) => route.abort());
  try {
    await page.goto(new URL("/privacy/", baseURL!).href);
    await appearance(page, "light");
    await expect(page.locator("main h1")).toBeVisible();
    await expect(toggle(page)).toBeDisabled();
  } finally {
    await context.close();
  }
});

test("blocked appearance storage falls back safely and does not disable the control", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "instascope-theme")
        throw new DOMException("Blocked", "SecurityError");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "instascope-theme")
        throw new DOMException("Blocked", "SecurityError");
      return set.call(this, key, value);
    };
  });
  await page.goto("/");
  await appearance(page, "light");
  await selectTheme(page, "dark");
  await selectTheme(page, "light");
  await selectTheme(page, "dark");
  await page.reload();
  await appearance(page, "light");
  expect(errors).toEqual([]);
});

test("keyboard appearance changes persist across reload, platforms and history without telemetry", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/");
  await expect(toggle(page)).toBeEnabled();
  await appearance(page, "light");
  const eventsBefore = await productEvents(page);
  await toggle(page).focus();
  await page.keyboard.press("Space");
  await appearance(page, "dark");
  await expect(toggle(page)).toBeFocused();
  await expect(toggle(page)).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Enter");
  await appearance(page, "light");
  await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
  expect(await productEvents(page)).toEqual(eventsBefore);
  await selectTheme(page, "dark");
  expect(
    await page.evaluate(() => localStorage.getItem("instascope-theme")),
  ).toBe("dark");
  await page.reload();
  await appearance(page, "dark");
  await switchPlatform(page, "WhatsApp");
  await appearance(page, "dark");
  await page.goBack();
  await expect(page.locator(".site-header")).toHaveAttribute(
    "data-platform",
    "instagram",
  );
  await appearance(page, "dark");
  await page.goForward();
  await appearance(page, "dark");
  await selectTheme(page, "light");
  await switchPlatform(page, "Instagram");
  await appearance(page, "light");
  expect(
    await page.evaluate(() => localStorage.getItem("instascope-theme")),
  ).toBe("light");
  const returning = await context.newPage();
  await collectEvents(returning);
  await returning.goto(new URL("/profile-picture-viewer/", baseURL!).href);
  await appearance(returning, "light");
  await expect(toggle(returning)).toBeEnabled();
  await returning.close();
});

test("theme changes preserve Instagram list filters, dataset and exported Wrapped artwork", async ({
  page,
}) => {
  await page.goto("/followers-analyzer/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const search = page.getByRole("searchbox", {
    name: "Search accounts",
    exact: true,
  });
  await search.fill("demo.fan.0001");
  await page
    .getByRole("combobox", { name: "Sort accounts", exact: true })
    .selectOption("oldest");
  const accounts = page.locator(".accounts");
  await expect(accounts).toContainText("demo.fan.0001");
  const original = (await accounts.textContent())!;
  for (const theme of ["dark", "light"] as const) {
    await selectTheme(page, theme);
    await expect(search).toHaveValue("demo.fan.0001");
    await expect(
      page.getByRole("combobox", { name: "Sort accounts", exact: true }),
    ).toHaveValue("oldest");
    await expect(accounts).toHaveText(original);
  }
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped", exact: true })
    .click();
  const download = page.getByRole("button", {
    name: "Download my Wrapped",
    exact: true,
  });
  await expect(download).toBeEnabled();
  const pngs: Buffer[] = [];
  for (const theme of ["light", "dark"] as const) {
    await selectTheme(page, theme);
    await download.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    const received = page.waitForEvent("download");
    await download.click();
    pngs.push(await readFile((await (await received).path())!));
  }
  expect(pngs[1]).toEqual(pngs[0]);
});

test("both themes keep WhatsApp source, filters, chart values and Wrapped PNG unchanged", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const failedAssets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/_next/static/") && response.status() >= 400)
      failedAssets.push(response.url());
  });
  await page.goto("/whatsapp/chat-analyzer/");
  await page
    .getByLabel("Upload WhatsApp chat export", { exact: true })
    .setInputFiles({
      name: "synthetic-theme.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        [
          "14/03/2026, 09:00 - Synthetic A: A fictional message",
          "14/03/2026, 10:00 - Synthetic B: <Media omitted>",
          "15/03/2026, 09:00 - Synthetic A: Another fictional message",
          "15/03/2026, 11:00 - Synthetic B: A final fictional message",
        ].join("\n"),
      ),
    });
  await page
    .getByRole("button", { name: "Confirm format and open chat", exact: true })
    .click();
  const doctor = page.getByRole("region", {
    name: "Chat Export Doctor",
    exact: true,
  });
  await expect(doctor).toBeVisible();
  const source = (await doctor.textContent())!;
  const banner = (await page.locator(".wa-current-chat").textContent())!;
  const participant = page.getByRole("combobox", {
    name: "Participant",
    exact: true,
  });
  await participant.selectOption({ label: "Synthetic A" });
  const count = page
    .getByRole("region", { name: "Filtered chat overview", exact: true })
    .locator(".wa-stat")
    .filter({ has: page.getByText("Exported messages", { exact: true }) })
    .locator("strong");
  for (const theme of ["light", "dark"] as const) {
    await selectTheme(page, theme);
    await expect(count).toHaveText("2");
    await expect(doctor).toHaveText(source);
    await expect(page.locator(".wa-current-chat")).toHaveText(banner);
    await expect(participant.locator("option:checked")).toHaveText(
      "Synthetic A",
    );
    await expect(page.locator(".wa-heatmap-table")).toBeVisible();
    await expect(page.locator(".wa-chart-track i").first()).toHaveCSS(
      "background-color",
      theme === "light" ? "rgb(48, 91, 64)" : "rgb(139, 216, 178)",
    );
    await info.attach(`whatsapp-analyzer-${theme}`, {
      body: await page.screenshot({ scale: "css", animations: "disabled" }),
      contentType: "image/png",
    });
  }
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Wrapped", exact: true })
    .click();
  const download = page.getByRole("button", {
    name: "Download PNG",
    exact: true,
  });
  await expect(download).toBeEnabled();
  const pngs: Buffer[] = [];
  for (const theme of ["light", "dark"] as const) {
    await selectTheme(page, theme);
    await download.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    const received = page.waitForEvent("download");
    await download.click();
    pngs.push(await readFile((await (await received).path())!));
  }
  expect(pngs[1]).toEqual(pngs[0]);
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
