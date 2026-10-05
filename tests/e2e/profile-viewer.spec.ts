import { expect, test, type Page } from "@playwright/test";
const endpoint = "**/api/profile-picture?*";
const imageUrl = "https://scontent-synthetic.cdninstagram.com/photo.png";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=",
  "base64",
);
async function open(page: Page) {
  await page.goto("/profile-picture-viewer/");
  await expect(page.locator(".profile-viewer form")).toHaveAttribute(
    "data-profile-endpoint",
    "/api/profile-picture",
  );
}
async function submit(page: Page, value = "@Sample.Account") {
  await page.getByLabel("Instagram username or profile URL").fill(value);
  await page
    .getByRole("button", { name: "View public photo", exact: true })
    .click();
}
const alert = (page: Page) => page.getByRole("main").getByRole("alert");

test("deployment fallback is safe when the build is unconfigured or its API route is missing", async ({
  page,
}) => {
  let calls = 0;
  await page.route(endpoint, (route) => {
    calls++;
    return route.fulfill({
      status: 404,
      contentType: "text/html",
      body: "Not found",
    });
  });
  await page.goto("/profile-picture-viewer/");
  const configured = !!(await page
    .locator(".profile-viewer form")
    .getAttribute("data-profile-endpoint"));
  await submit(
    page,
    "https://www.instagram.com/SAMPLE.ACCOUNT/?igsh=synthetic",
  );
  await expect(alert(page)).toContainText("not available on this deployment");
  expect(calls).toBe(configured ? 1 : 0);
  await expect(page.locator(".photo-preview")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open @sample.account on Instagram" }),
  ).toHaveAttribute("href", "https://www.instagram.com/sample.account/");
});

test("configured same-origin lookup displays a verified photo and keeps preview controls usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const events: string[] = [];
    Object.assign(window, { profileEvents: events });
    window.addEventListener("instascope:event", (event) =>
      events.push((event as CustomEvent).detail.event),
    );
  });
  await page.route(endpoint, (route) => {
    const request = route.request();
    expect(new URL(request.url()).searchParams.get("username")).toBe(
      "sample.account",
    );
    expect(request.headers()).not.toHaveProperty("cookie");
    expect(request.headers()).not.toHaveProperty("referer");
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "sample.account", imageUrl }),
    });
  });
  await page.route(imageUrl, (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await open(page);
  await submit(page);
  const photo = page.getByRole("img", {
    name: "Public profile photo for sample.account",
  });
  await expect(photo).toBeVisible();
  expect((await photo.boundingBox())!.width).toBeGreaterThan(200);
  await expect(
    page.getByText("Enlarging the preview does not add detail.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      photo.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByLabel("Circular preview").check();
  await expect(page.locator(".photo-preview")).toHaveClass(/circle/);
  await page.getByRole("slider", { name: "Zoom" }).press("ArrowRight");
  await expect(photo).toHaveCSS("transform", "matrix(1.1, 0, 0, 1.1, 0, 0)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => (window as unknown as { profileEvents: string[] }).profileEvents,
    ),
  ).toContain("profile_succeeded");
});

for (const [status, code, message] of [
  [503, "service_not_configured", "not available on this deployment"],
  [503, "lookup_disabled", "currently disabled"],
  [404, "profile_unavailable", "verifiable public profile photo"],
  [429, "request_rate_limited", "Too many requests"],
  [429, "service_rate_limited", "temporarily at capacity"],
  [429, "instagram_rate_limited", "Instagram is temporarily limiting"],
  [503, "service_unavailable", "temporarily unavailable"],
  [502, "upstream_unavailable", "Instagram is temporarily unavailable"],
] as const) {
  test(`safe lookup error: ${code}`, async ({ page }) => {
    await page.route(endpoint, (route) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ code, error: "raw internal secret details" }),
      }),
    );
    await open(page);
    await submit(page);
    await expect(alert(page)).toContainText(message);
    await expect(alert(page)).not.toContainText("raw internal");
    await expect(page.locator(".photo-preview")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "View public photo", exact: true }),
    ).toBeEnabled();
  });
}
test("invalid usernames never trigger lookup", async ({ page }) => {
  let calls = 0;
  await page.route(endpoint, (route) => {
    calls++;
    return route.abort();
  });
  await open(page);
  for (const input of [
    "bad name",
    "https://evil.test/profile",
    "https://instagram.com/p/synthetic/",
    "a".repeat(31),
  ]) {
    await submit(page, input);
    await expect(alert(page)).toContainText("Enter an Instagram username");
  }
  expect(calls).toBe(0);
});
test("lookup timeout re-enables the form and does not show a photo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    AbortSignal.timeout = (duration: number) => {
      Object.assign(window, { profileTimeout: duration });
      return timeout(50);
    };
  });
  await page.route(endpoint, () => {});
  await open(page);
  await submit(page);
  await expect(alert(page)).toContainText("lookup timed out");
  expect(
    await page.evaluate(
      () => (window as unknown as { profileTimeout: number }).profileTimeout,
    ),
  ).toBe(12000);
  await expect(
    page.getByRole("button", { name: "View public photo", exact: true }),
  ).toBeEnabled();
});
test("untrusted image hosts, credentialed URLs and mismatched identities are rejected before any photo request", async ({
  page,
}) => {
  let photoRequests = 0;
  await page.route("https://evil.test/**", (route) => {
    photoRequests++;
    return route.abort();
  });
  await open(page);
  for (const data of [
    { username: "sample.account", imageUrl: "https://evil.test/photo.jpg" },
    {
      username: "sample.account",
      imageUrl: "https://u:p@a.fbcdn.net/photo.jpg",
    },
    {
      username: "sample.account",
      imageUrl: "https://a.fbcdn.net:8443/photo.jpg",
    },
    { username: "someone.else", imageUrl },
  ]) {
    await page.route(endpoint, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      }),
    );
    await submit(page);
    await expect(alert(page)).toContainText("response could not be verified");
    await expect(page.locator(".photo-preview")).toHaveCount(0);
    await page.unroute(endpoint);
  }
  expect(photoRequests).toBe(0);
});
test("image load failures clear the preview and report failure without a success event", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const events: string[] = [];
    Object.assign(window, { profileEvents: events });
    window.addEventListener("instascope:event", (event) =>
      events.push((event as CustomEvent).detail.event),
    );
  });
  await page.route(endpoint, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "sample.account", imageUrl }),
    }),
  );
  await page.route(imageUrl, (route) => route.abort());
  await open(page);
  await submit(page);
  await expect(alert(page)).toContainText("photo is no longer available");
  await expect(page.locator(".photo-preview")).toHaveCount(0);
  const events = await page.evaluate(
    () => (window as unknown as { profileEvents: string[] }).profileEvents,
  );
  expect(events).toContain("profile_failed");
  expect(events).not.toContain("profile_succeeded");
});
