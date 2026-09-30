import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const exportFiles = (followers: unknown[], following: unknown[]) => [
  {
    name: "followers.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(followers)),
  },
  {
    name: "following.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ relationships_following: following })),
  },
];
const follower = (name: string) => ({ string_list_data: [{ value: name }] });
const following = (name: string, timestamp?: number) => ({
  title: name,
  string_list_data: [{ value: name, ...(timestamp ? { timestamp } : {}) }],
});
async function upload(
  page: Page,
  files: ReturnType<typeof exportFiles>,
  label: string,
) {
  await page
    .getByLabel(label, { exact: true })
    .and(page.locator(":enabled"))
    .setInputFiles(files);
}

test("Wrapped omits date and change stories when records cannot support them", async ({
  page,
}) => {
  await page.goto("/instagram-wrapped/");
  await upload(
    page,
    exportFiles([follower("private.fan")], [following("private.follow")]),
    "Upload Instagram export",
  );
  const picker = page.getByRole("group", { name: "Wrapped stories" });
  await expect(picker.getByRole("button")).toHaveCount(2);
  await expect(picker.getByRole("button", { name: "My circle" })).toBeVisible();
  await expect(page.locator(".wrapped-card")).not.toContainText("private.");
  await expect(page.locator(".wrapped-card")).toContainText(
    "not live Instagram",
  );
});

test("Wrapped browses factual dated and comparison stories and exports private portrait PNGs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.assign(window, { drawnTexts: texts });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof original>
    ) {
      texts.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.goto("/instagram-wrapped/");
  await upload(
    page,
    exportFiles(
      [follower("private.common"), follower("private.added")],
      [
        following("private.common", 1577836800),
        following("private.new", 1672531200),
        following("private.undated"),
      ],
    ),
    "Upload Instagram export",
  );
  const picker = page.getByRole("group", { name: "Wrapped stories" });
  await expect(picker.getByRole("button")).toHaveCount(6);
  await picker.getByRole("button", { name: "Instagram archaeology" }).click();
  await expect(page.locator(".wrapped-card")).toContainText("2020");
  await page
    .getByRole("link", { name: "Compare snapshots", exact: true })
    .first()
    .click();
  await upload(
    page,
    exportFiles(
      [follower("private.common"), follower("private.missing")],
      [
        following("private.common", 1577836800),
        following("private.old", 1609459200),
      ],
    ),
    "Upload older snapshot",
  );
  await expect(page.getByText(/Follower change: \+0/)).toBeVisible();
  await page
    .locator(".tool-tabs")
    .getByRole("link", { name: "My Wrapped" })
    .click();
  await expect(picker.getByRole("button")).toHaveCount(8);
  for (const name of [
    "My circle",
    "My social orbit",
    "My following dates",
    "Instagram archaeology",
    "My discovery month",
    "My time capsule",
    "Since my last snapshot",
    "Behind the number",
  ]) {
    await picker.getByRole("button", { name, exact: true }).click();
    expect(
      await page.locator(".wrapped-card").evaluate((card) => {
        const bounds = card.getBoundingClientRect();
        const last = card.querySelector("small")!.getBoundingClientRect();
        const content = card.querySelectorAll(
          "h2, p, .wrapped-hero, .wrapped-facts, small",
        );
        const rect = (selector: string) =>
          card.querySelector(selector)!.getBoundingClientRect();
        return (
          last.bottom <= bounds.bottom - 8 &&
          rect("h2").bottom <= rect(".wrapped-lead").top &&
          rect(".wrapped-lead").bottom <= rect(".wrapped-hero").top &&
          rect(".wrapped-facts").bottom <= rect(".wrapped-note").top &&
          rect(".wrapped-note").bottom <= last.top &&
          [...content].every((part) => part.scrollWidth <= part.clientWidth + 1)
        );
      }),
      name,
    ).toBe(true);
  }
  await picker.getByRole("button", { name: "Since my last snapshot" }).click();
  const preview = page.locator(".wrapped-card");
  await expect(preview).toContainText("added followers");
  await expect(preview.locator(".wrapped-facts strong").first()).toHaveText(
    "1",
  );
  await expect(preview).not.toContainText("private.");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Wrapped" }).click();
  const saved = await event;
  expect(saved.suggestedFilename()).toBe("instascope-changes.png");
  const png = readFileSync((await saved.path())!);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  const drawn = await page.evaluate(
    () => (window as unknown as { drawnTexts: string[] }).drawnTexts,
  );
  expect(drawn.join(" ")).toContain("added followers");
  expect(drawn.join(" ")).not.toMatch(/private\.|pending|blocked|restricted/i);
});

test("story navigation supports buttons, keyboard and mobile swipes without leaking demo identities", async ({
  page,
  isMobile,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:3000")) external.push(r.url());
  });
  await page.goto("/instagram-wrapped/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const card = page.locator(".wrapped-card");
  const picker = page.getByRole("group", { name: "Wrapped stories" });
  await expect(picker.getByRole("button")).toHaveCount(8);
  await expect(
    page.getByRole("button", { name: "Previous story" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next story" }).click();
  await expect(
    picker.getByRole("button", { name: "My social orbit" }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.focus();
  await card.press("ArrowRight");
  await expect(
    picker.getByRole("button", { name: "My following dates" }),
  ).toHaveAttribute("aria-pressed", "true");
  if (isMobile) {
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    const client = await page.context().newCDPSession(page);
    const y = box.y + box.height / 2;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width * 0.85, y }],
    });
    for (let step = 1; step <= 8; step++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: box.x + box.width * (0.85 - step * 0.08), y }],
      });
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(
      picker.getByRole("button", { name: "Instagram archaeology" }),
    ).toHaveAttribute("aria-pressed", "true");
    await client.detach();
  }
  const colors = new Set<string>();
  for (const button of await picker.getByRole("button").all()) {
    await button.click();
    await expect(card).toContainText("DEMO DATA · FICTIONAL EXAMPLE");
    await expect(card).not.toContainText("demo.");
    colors.add(
      await card.evaluate((node) => getComputedStyle(node).backgroundColor),
    );
    await expect(
      page.getByRole("button", { name: "Share my card" }),
    ).toBeEnabled();
  }
  expect(colors.size).toBe(8);
  await expect(page.getByRole("button", { name: "Next story" })).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(external).toEqual([]);
});

test("native sharing receives the selected portrait file during user activation, and cancellation stays local", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { shares: [] as unknown[], shareError: "" });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: ({ files }: ShareData) => files?.[0]?.type === "image/png",
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ files, title }: ShareData) => {
        const state = window as unknown as {
          shares: unknown[];
          shareError: string;
        };
        const file = files![0];
        state.shares.push({
          name: file.name,
          type: file.type,
          size: file.size,
          title,
          active: navigator.userActivation.isActive,
        });
        if (state.shareError)
          throw new DOMException("Synthetic share failure", state.shareError);
      },
    });
  });
  await page.goto("/instagram-wrapped/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page
    .getByRole("button", { name: "My discovery month", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Share my card", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Card handed" }),
  ).toBeVisible();
  const shares = await page.evaluate(
    () =>
      (
        window as unknown as {
          shares: {
            name: string;
            type: string;
            size: number;
            active: boolean;
          }[];
        }
      ).shares,
  );
  expect(shares).toHaveLength(1);
  expect(shares[0]).toMatchObject({
    name: "instascope-demo-discovery.png",
    type: "image/png",
    active: true,
  });
  expect(shares[0].size).toBeGreaterThan(10_000);
  const downloads: string[] = [];
  page.on("download", (d) => downloads.push(d.suggestedFilename()));
  await page.evaluate(() => {
    (window as unknown as { shareError: string }).shareError = "AbortError";
  });
  await page
    .getByRole("button", { name: "Share my card", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sharing cancelled" }),
  ).toBeVisible();
  expect(downloads).toEqual([]);
  await page.evaluate(() => {
    (window as unknown as { shareError: string }).shareError =
      "NotAllowedError";
  });
  await page
    .getByRole("button", { name: "Share my card", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sharing did not finish" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download my Wrapped" }),
  ).toBeEnabled();
  expect(downloads).toEqual([]);
});

test("unsupported file sharing downloads the current card without carrying the previous image", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    }),
  );
  await page.goto("/instagram-wrapped/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Behind the number", exact: true })
    .click();
  await page
    .getByRole("button", { name: "My time capsule", exact: true })
    .click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share my card" }).click();
  const saved = await event;
  expect(saved.suggestedFilename()).toBe("instascope-demo-timecapsule.png");
  const png = readFileSync((await saved.path())!);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1920]);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Add it to Instagram Stories or WhatsApp Status" }),
  ).toBeVisible();
});
