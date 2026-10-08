import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
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

async function checkFullscreenFit(page: Page) {
  const preview = page.locator(".photo-preview");
  const photo = preview.locator("img");
  // Exercise the real Fullscreen API, not a mocked fullscreen class/state.
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await expect
    .poll(() => preview.evaluate((node) => document.fullscreenElement === node))
    .toBe(true);
  await expect(preview).toHaveCSS("margin", "0px");
  await expect(preview).toHaveCSS("border-radius", "0px");
  await expect(photo).toHaveCSS("object-fit", "contain");
  await expect(photo).toHaveCSS("transform", "none");
  const bounds = await preview.evaluate((node) => {
    const frame = node.getBoundingClientRect();
    const image = node.querySelector("img")!.getBoundingClientRect();
    return {
      coversScreen:
        Math.abs(frame.left) < 2 &&
        Math.abs(frame.top) < 2 &&
        Math.abs(frame.width - innerWidth) < 2 &&
        Math.abs(frame.height - innerHeight) < 2,
      imageInsideFrame:
        image.left >= frame.left - 1 &&
        image.top >= frame.top - 1 &&
        image.right <= frame.right + 1 &&
        image.bottom <= frame.bottom + 1,
    };
  });
  expect(bounds).toEqual({ coversScreen: true, imageInsideFrame: true });
  await page.evaluate(() => document.exitFullscreen());
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement))
    .toBeNull();
}

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

for (const [shape, width, height] of [
  ["square", 1080, 1080],
  ["portrait", 400, 800],
  ["landscape", 800, 400],
] as const) {
  test(`fullscreen fits the complete ${shape} photo and preserves preview settings on exit`, async ({
    page,
  }) => {
    const photoBytes = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: "#b9d5c6",
      },
    })
      .png()
      .toBuffer();
    await page.route(endpoint, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ username: "sample.account", imageUrl }),
      }),
    );
    await page.route(imageUrl, (route) =>
      route.fulfill({ contentType: "image/png", body: photoBytes }),
    );
    await open(page);
    await submit(page);
    const preview = page.locator(".photo-preview");
    const photo = preview.locator("img");
    await expect
      .poll(() =>
        photo.evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBe(width);
    for (const zoom of [1, 3]) {
      await page.getByLabel("Circular preview").setChecked(zoom === 3);
      const slider = page.getByRole("slider", { name: "Zoom" });
      await slider.press(zoom === 3 ? "End" : "Home");
      const transform = `matrix(${zoom}, 0, 0, ${zoom}, 0, 0)`;
      await expect(photo).toHaveCSS("transform", transform);
      await checkFullscreenFit(page);
      await expect(preview).toHaveCSS(
        "border-radius",
        zoom === 3 ? "50%" : "0px",
      );
      await expect(photo).toHaveCSS("transform", transform);
      await expect(photo).toHaveAttribute("src", imageUrl);
      await expect(slider).toHaveValue(String(zoom));
    }
  });
}

for (const [status, code, message] of [
  [503, "service_not_configured", "not available on this deployment"],
  [503, "lookup_disabled", "currently disabled"],
  [404, "profile_unavailable", "verifiable public profile photo"],
  [429, "request_rate_limited", "Too many requests"],
  [429, "service_rate_limited", "shared request limit"],
  [429, "service_budget_limited", "shared minute limit"],
  [429, "service_daily_limited", "allowance has been used"],
  [429, "instagram_rate_limited", "Instagram is temporarily limiting"],
  [503, "service_unavailable", "temporarily unavailable"],
  [502, "upstream_unavailable", "Instagram is temporarily unavailable"],
] as const) {
  test(`safe lookup error: ${code}`, async ({ page }) => {
    if (status === 429) await page.clock.install();
    await page.route(endpoint, (route) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: status === 429 ? { "Retry-After": "10" } : {},
        body: JSON.stringify({ code, error: "raw internal secret details" }),
      }),
    );
    await open(page);
    await submit(page);
    await expect(alert(page)).toContainText(message);
    await expect(alert(page)).not.toContainText("raw internal");
    await expect(page.locator(".photo-preview")).toHaveCount(0);
    if (status === 429) {
      await expect(
        page.getByRole("button", { name: /Try again in/ }),
      ).toBeDisabled();
      await page.clock.runFor(61000);
      await expect(alert(page)).toContainText("You can try again now.");
    }
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

test("a daily allowance uses its reset countdown without the short-limit explanation", async ({
  page,
}) => {
  await page.clock.install();
  await page.route(endpoint, (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "Retry-After": "3600" },
      body: JSON.stringify({ code: "service_daily_limited" }),
    }),
  );
  await open(page);
  await submit(page);
  await expect(alert(page)).toContainText("Please try again in 3600 seconds.");
  await expect(alert(page)).toContainText("midnight UTC");
  await expect(alert(page)).not.toContainText("one lookup every 10 seconds");
  await page.clock.fastForward(3600000);
  await expect(
    page.getByRole("button", { name: "View public photo", exact: true }),
  ).toBeEnabled();
});

test("an image that never loads cannot leave the progress indicator stuck", async ({
  page,
}) => {
  await page.clock.install();
  await page.route(endpoint, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "sample.account", imageUrl }),
    }),
  );
  await page.route(imageUrl, () => {});
  await open(page);
  await submit(page);
  await expect(page.getByRole("status")).toContainText("Loading your photo");
  await page.clock.runFor(13000);
  await expect(alert(page)).toContainText("photo took too long to load");
  await expect(page.locator(".profile-loading")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View public photo", exact: true }),
  ).toBeEnabled();
});

test("visible progress lasts through lookup and image loading, without duplicate requests", async ({
  page,
}) => {
  let releaseLookup!: () => void;
  let releaseImage!: () => void;
  const pendingLookup = new Promise<void>((resolve) => {
    releaseLookup = resolve;
  });
  const pendingImage = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  let calls = 0;
  await page.route(endpoint, async (route) => {
    calls++;
    await pendingLookup;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "sample.account", imageUrl }),
    });
  });
  await page.route(imageUrl, async (route) => {
    await pendingImage;
    await route.fulfill({ contentType: "image/png", body: png });
  });
  await open(page);
  await submit(page);
  await expect(page.getByRole("status")).toContainText(
    "Finding the public photo",
  );
  await expect(page.locator(".profile-viewer")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Looking for photo…" }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Instagram username or profile URL"),
  ).toBeDisabled();
  await page
    .locator(".profile-viewer form")
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  expect(calls).toBe(1);
  releaseLookup();
  await expect(page.getByRole("status")).toContainText("Loading your photo");
  releaseImage();
  await expect(page.locator(".profile-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".profile-loading")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View public photo", exact: true }),
  ).toBeEnabled();
});

test("shared capacity countdown uses Retry-After and blocks a different profile until retry", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route(endpoint, (route) => {
    calls++;
    return route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "Retry-After": "7" },
      body: JSON.stringify({ code: "service_rate_limited" }),
    });
  });
  await open(page);
  await submit(page);
  await expect(alert(page)).toContainText("Please try again in 7 seconds.");
  await expect(alert(page)).toContainText("one lookup every 10 seconds");
  await page
    .getByLabel("Instagram username or profile URL")
    .fill("different.account");
  await page
    .locator(".profile-viewer form")
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  expect(calls).toBe(1);
  await page.clock.runFor(3000);
  await expect(
    page.getByRole("button", { name: "Try again in 4s" }),
  ).toBeDisabled();
  await page.clock.runFor(4000);
  await expect(
    page.getByRole("button", { name: "View public photo", exact: true }),
  ).toBeEnabled();
  expect(calls).toBe(1); // Expiry never triggers an automatic Instagram request.
  await submit(page, "different.account");
  expect(calls).toBe(2);
});

test("local AI inference produces a 128px PNG and preserves original comparison", async ({
  page,
}) => {
  let calls = 0;
  const modelRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/profile-ai/"))
      modelRequests.push(request.url());
  });
  const neuralPng = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#b9d5c6"/><circle cx="16" cy="16" r="10" fill="#ed9462"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  await page.route(endpoint, (route) => {
    calls++;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "sample.account", imageUrl }),
    });
  });
  await page.route(imageUrl, (route) =>
    route.fulfill({
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: neuralPng,
    }),
  );
  await open(page);
  await submit(page);
  await expect(page.getByText("Original public photo · 32 × 32")).toBeVisible();
  expect(modelRequests).toHaveLength(0);
  await page.getByRole("button", { name: "AI upscale 4×" }).click();
  await expect(page.getByText("AI-upscaled · 128 × 128")).toBeVisible({
    timeout: 20000,
  });
  const photo = page.locator(".photo-preview img");
  await expect(photo).toHaveAttribute("src", /^blob:/);
  expect(
    await photo.evaluate((node) => (node as HTMLImageElement).naturalWidth),
  ).toBe(128);
  await checkFullscreenFit(page);
  await expect(
    page.getByText("can change facial features", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Save upscaled PNG" }),
  ).toHaveAttribute("download", "instascope-sample.account-ai-128x128.png");
  expect(modelRequests.some((url) => url.endsWith(".onnx"))).toBe(true);
  expect(modelRequests.some((url) => url.endsWith(".wasm"))).toBe(true);
  for (const url of modelRequests)
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Save upscaled PNG" }).click();
  const downloaded = await downloading;
  const saved = await readFile((await downloaded.path())!);
  expect((await sharp(saved).metadata()).width).toBe(128);
  expect((await sharp(saved).metadata()).height).toBe(128);
  // The learned output must differ from simply resizing the source PNG.
  const naive = await sharp(neuralPng)
    .resize(128, 128)
    .removeAlpha()
    .raw()
    .toBuffer();
  const restored = await sharp(saved).removeAlpha().raw().toBuffer();
  let difference = 0;
  for (let i = 0; i < naive.length; i++)
    difference += Math.abs(restored[i] - naive[i]);
  expect(difference / naive.length).toBeGreaterThan(0.5);
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await expect(photo).toHaveAttribute("src", imageUrl);
  await page.getByRole("button", { name: "AI upscale 4×" }).click();
  await expect(photo).toHaveAttribute("src", /^blob:/);
  expect(calls).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

for (const fixture of [
  { name: "portrait-150", file: "portrait.svg", width: 150, height: 150 },
  { name: "portrait-320", file: "portrait.svg", width: 320, height: 320 },
  { name: "non-face-logo", file: "logo.svg", width: 48, height: 32 },
]) {
  test(`native learned output preserves ${fixture.name} source resolution`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    const source = await sharp(`tests/fixtures/profile/${fixture.file}`)
      .resize(fixture.width, fixture.height)
      .png()
      .toBuffer();
    const outgoing: string[] = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method()))
        outgoing.push(request.url());
    });
    await page.route(endpoint, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ username: "sample.account", imageUrl }),
      }),
    );
    await page.route(imageUrl, (route) =>
      route.fulfill({
        contentType: "image/png",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: source,
      }),
    );
    await open(page);
    await submit(page);
    await expect(
      page.getByText(
        `Original public photo · ${fixture.width} × ${fixture.height}`,
      ),
    ).toBeVisible();
    const started = Date.now();
    await page.getByRole("button", { name: "AI upscale 4×" }).click();
    await expect(
      page.getByText(
        `AI-upscaled · ${fixture.width * 4} × ${fixture.height * 4}`,
      ),
    ).toBeVisible({ timeout: 150000 });
    const elapsed = Date.now() - started;
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Save upscaled PNG" }).click();
    const downloaded = await downloadPromise;
    const output = await readFile((await downloaded.path())!);
    const metadata = await sharp(output).metadata();
    expect([metadata.width, metadata.height]).toEqual([
      fixture.width * 4,
      fixture.height * 4,
    ]);
    expect(metadata.width).not.toBe(1080);
    expect(outgoing).toEqual([]); // Photos never leave the browser for inference.
    await expect(
      page
        .getByText("Face-specific restoration is not available.", {
          exact: false,
        })
        .last(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await testInfo.attach("source.png", {
      body: source,
      contentType: "image/png",
    });
    await testInfo.attach("upscaled.png", {
      body: output,
      contentType: "image/png",
    });
    await testInfo.attach("timing.json", {
      body: Buffer.from(
        JSON.stringify(
          {
            fixture: fixture.name,
            project: testInfo.project.name,
            totalMs: elapsed,
            output: [metadata.width, metadata.height],
            note: "Local download included; device emulation is not physical phone measurement.",
          },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
    await page
      .locator(".photo-enhancement")
      .screenshot({ path: testInfo.outputPath("controls.png") });
    await page.getByRole("button", { name: "Original", exact: true }).click();
    await expect(page.locator(".photo-preview img")).toHaveAttribute(
      "src",
      imageUrl,
    );
  });
}

test("untrusted model bytes fail closed and leave the original available", async ({
  page,
}) => {
  await page.route(endpoint, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "sample.account", imageUrl }),
    }),
  );
  await page.route(imageUrl, (route) =>
    route.fulfill({
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: png,
    }),
  );
  await page.route("**/profile-ai/*.onnx", (route) =>
    route.fulfill({ body: "not the reviewed model" }),
  );
  await open(page);
  await submit(page);
  await page.getByRole("button", { name: "AI upscale 4×" }).click();
  await expect(page.getByRole("status")).toContainText(
    "AI enhancement is unavailable",
  );
  await expect(page.locator(".photo-preview img")).toHaveAttribute(
    "src",
    imageUrl,
  );
  await expect(
    page.getByRole("link", { name: "Save upscaled PNG" }),
  ).toHaveCount(0);
});

test("AI model loading can be cancelled while the original controls remain responsive", async ({
  page,
}) => {
  await page.route(endpoint, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "sample.account", imageUrl }),
    }),
  );
  await page.route(imageUrl, (route) =>
    route.fulfill({
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: png,
    }),
  );
  await page.route("**/profile-ai/*.onnx", () => {});
  await open(page);
  await submit(page);
  await page.getByRole("button", { name: "AI upscale 4×" }).click();
  await expect(page.getByRole("status")).toContainText("Loading the AI model");
  await page.getByLabel("Circular preview").check();
  await expect(page.locator(".photo-preview")).toHaveClass(/circle/);
  await page.getByRole("button", { name: "Cancel enhancement" }).click();
  await expect(
    page.getByRole("button", { name: "AI upscale 4×" }),
  ).toBeEnabled();
  await expect(page.locator(".photo-preview img")).toHaveAttribute(
    "src",
    imageUrl,
  );
  await expect(
    page.getByRole("link", { name: "Save upscaled PNG" }),
  ).toHaveCount(0);
});

test("a CDN that disallows enhancement still leaves the original photo usable", async ({
  page,
}) => {
  await page.route(endpoint, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "sample.account", imageUrl }),
    }),
  );
  await page.route(imageUrl, (route) =>
    route.fulfill({
      contentType: "image/png",
      headers: {
        "Access-Control-Allow-Origin": "https://different-origin.test",
      },
      body: png,
    }),
  );
  await open(page);
  await submit(page);
  await expect(page.getByText("Original public photo · 1 × 1")).toBeVisible();
  await page.getByRole("button", { name: "AI upscale 4×" }).click();
  await expect(page.getByRole("status")).toContainText(
    "AI enhancement is unavailable",
  );
  await expect(page.locator(".photo-preview img")).toHaveAttribute(
    "src",
    imageUrl,
  );
  await expect(page.getByText("Original public photo · 1 × 1")).toBeVisible();
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
