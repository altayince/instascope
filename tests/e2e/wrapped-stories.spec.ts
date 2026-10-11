import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { savedRecords, seedRecords } from "../helpers/vault";

const savedStorySnapshots = [
  {
    id: "story-first",
    version: 1,
    exportDate: "2025-01-15",
    createdAt: 1,
    followers: ["private.stable", "private.retained", "private.missing"],
    following: ["private.stable", "private.outgoing"],
  },
  {
    id: "story-middle",
    version: 1,
    exportDate: "2025-04-15",
    createdAt: 2,
    followers: ["private.stable"],
    following: ["private.stable", "private.outgoing"],
  },
  {
    id: "story-latest",
    version: 1,
    exportDate: "2025-10-15",
    createdAt: 3,
    followers: ["private.stable", "private.retained", "private.new"],
    following: ["private.stable", "private.outgoing"],
  },
];

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
  await expect(picker.getByRole("button")).toHaveCount(9);
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
  expect(colors.size).toBe(9);
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

test("saved Wrapped stories require explicit saved-account confirmation and stay independent of the active export", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.assign(window, { savedStoryTexts: texts });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof original>
    ) {
      texts.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.goto("/instagram-wrapped/");
  await seedRecords(page, savedStorySnapshots);
  await page.reload();
  const originalSaved = await savedRecords(page);
  await upload(
    page,
    exportFiles([follower("foreign.active")], [following("foreign.active")]),
    "Upload Instagram export",
  );
  const picker = page.getByRole("group", { name: "Wrapped stories" });
  await expect(picker.getByRole("button")).toHaveCount(2);
  const controls = page.locator(".wrapped-vault-stories");
  await controls.locator("summary").click();
  await expect(controls).toContainText(
    "Your active export is not included or matched",
  );
  const load = controls.getByRole("button", {
    name: "Load saved-snapshot stories",
    exact: true,
  });
  await expect(load).toBeDisabled();
  const confirmation = controls.getByRole("checkbox", {
    name: "I confirm these saved snapshots belong to the same Instagram account.",
  });
  await confirmation.check();
  await load.click();
  await expect(picker.getByRole("button")).toHaveCount(4);
  const preview = page.locator(".wrapped-card");
  await picker
    .getByRole("button", { name: "Stable Core", exact: true })
    .click();
  await expect(preview.locator(".wrapped-hero strong")).toHaveText("1");
  await expect(preview).toContainText("3");
  await expect(preview).toContainText("2025-01-15");
  await expect(preview).toContainText("2025-10-15");
  expect(
    await preview.evaluate((card) => {
      const rect = (selector: string) =>
        card.querySelector(selector)!.getBoundingClientRect();
      return (
        rect(".wrapped-facts").bottom <= rect(".wrapped-note").top &&
        rect(".wrapped-note").bottom <= rect("small").top &&
        rect("small").bottom <= card.getBoundingClientRect().bottom - 8 &&
        [
          ...card.querySelectorAll(
            "h2, p, .wrapped-hero, .wrapped-facts, small",
          ),
        ].every((element) => element.scrollWidth <= element.clientWidth + 1)
      );
    }),
  ).toBe(true);
  await picker.getByRole("button", { name: "Still Here", exact: true }).click();
  await expect(preview.locator(".wrapped-hero strong")).toHaveText("66.7%");
  await expect(preview).toContainText("2 of 3 first-snapshot followers");
  await expect(preview).toContainText("does not prove uninterrupted following");
  await expect(preview).not.toContainText("private.");
  await expect(preview).not.toContainText("foreign.");
  expect(
    await preview.evaluate((card) => {
      const rect = (selector: string) =>
        card.querySelector(selector)!.getBoundingClientRect();
      return (
        rect(".wrapped-facts").bottom <= rect(".wrapped-note").top &&
        rect(".wrapped-note").bottom <= rect("small").top &&
        rect("small").bottom <= card.getBoundingClientRect().bottom - 8 &&
        [
          ...card.querySelectorAll(
            "h2, p, .wrapped-hero, .wrapped-facts, small",
          ),
        ].every((element) => element.scrollWidth <= element.clientWidth + 1)
      );
    }),
  ).toBe(true);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Wrapped" }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe("instascope-still-here.png");
  const png = readFileSync((await download.path())!);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1920]);
  const texts = await page.evaluate(
    () => (window as unknown as { savedStoryTexts: string[] }).savedStoryTexts,
  );
  expect(texts.join(" ")).toContain("66.7%");
  expect(texts.join(" ")).not.toMatch(
    /private\.|foreign\.|blocked|restricted|private note/i,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await confirmation.uncheck();
  await expect(picker.getByRole("button")).toHaveCount(2);
  await confirmation.check();
  await expect(picker.getByRole("button")).toHaveCount(2);
  expect(await savedRecords(page)).toEqual(originalSaved);
});

test("fictional saved stories demonstrate two aggregate cards without reading or changing real Vault membership", async ({
  page,
}) => {
  await page.goto("/instagram-wrapped/");
  await seedRecords(page, savedStorySnapshots);
  await page.reload();
  const real = await savedRecords(page);
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const picker = page.getByRole("group", { name: "Wrapped stories" });
  await expect(picker.getByRole("button")).toHaveCount(9);
  // After demo begins, its explicit story loader must not read real members.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.openCursor;
    Object.assign(window, { savedStoryVaultReads: 0 });
    IDBObjectStore.prototype.openCursor = function (...args) {
      if (
        this.transaction.db.name === "instascope:snapshot-vault" &&
        this.name === "snapshots"
      )
        (window as unknown as { savedStoryVaultReads: number })
          .savedStoryVaultReads++;
      return original.apply(this, args as Parameters<typeof original>);
    };
  });
  const controls = page.locator(".wrapped-vault-stories");
  await controls.locator("summary").click();
  await expect(controls.getByRole("checkbox")).toHaveCount(0);
  await controls
    .getByRole("button", { name: "Load fictional saved stories", exact: true })
    .click();
  await expect(picker.getByRole("button")).toHaveCount(11);
  for (const name of ["Stable Core", "Still Here"]) {
    await picker.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".wrapped-card .wrapped-hero strong")).toHaveText(
      name === "Stable Core" ? "687" : "93.5%",
    );
    if (name === "Still Here")
      await expect(page.locator(".wrapped-card")).toContainText(
        "1,038 of 1,110 first-snapshot followers",
      );
    await expect(page.locator(".wrapped-card")).toContainText(
      "DEMO DATA · FICTIONAL EXAMPLE",
    );
    await expect(page.locator(".wrapped-card")).not.toContainText("demo.");
    await expect(page.locator(".wrapped-card")).not.toContainText("private.");
  }
  await expect(controls).toContainText("from 4 readable snapshots");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { savedStoryVaultReads: number })
          .savedStoryVaultReads,
    ),
  ).toBe(0);
  expect(await savedRecords(page)).toEqual(real);
});

test("saved cards disappear when Vault becomes unreadable and require fresh confirmation after recovery", async ({
  page,
}) => {
  await page.goto("/instagram-wrapped/");
  await seedRecords(page, savedStorySnapshots);
  await page.reload();
  await upload(
    page,
    exportFiles([follower("foreign.active")], [following("foreign.active")]),
    "Upload Instagram export",
  );
  const controls = page.locator(".wrapped-vault-stories");
  await controls.locator("summary").click();
  const confirm = controls.getByRole("checkbox");
  const load = controls.getByRole("button", {
    name: "Load saved-snapshot stories",
    exact: true,
  });
  await confirm.check();
  await load.click();
  const picker = page.getByRole("group", { name: "Wrapped stories" });
  await expect(picker.getByRole("button")).toHaveCount(4);
  await page.evaluate(() => {
    const original = IDBFactory.prototype.open;
    Reflect.set(window, "circlePulseNativeOpen", original);
    IDBFactory.prototype.open = function (
      ...args: Parameters<typeof original>
    ) {
      if (args[0] === "instascope:snapshot-vault")
        throw new DOMException(
          "Synthetic unavailable storage",
          "SecurityError",
        );
      return original.apply(this, args);
    };
    window.dispatchEvent(new Event("focus"));
  });
  await expect(picker.getByRole("button")).toHaveCount(2);
  await controls.locator("summary").click();
  await expect(controls.getByRole("alert")).toContainText(
    "Browser storage is unavailable",
  );
  await expect(load).toBeDisabled();
  await page.evaluate(() => {
    IDBFactory.prototype.open = Reflect.get(
      window,
      "circlePulseNativeOpen",
    ) as IDBFactory["open"];
    window.dispatchEvent(new Event("focus"));
  });
  await expect(controls.getByRole("alert")).toHaveCount(0);
  await controls.locator("summary").click();
  await expect(confirm).not.toBeChecked();
  await expect(load).toBeDisabled();
  await confirm.check();
  await load.click();
  await expect(picker.getByRole("button")).toHaveCount(4);
  expect(await savedRecords(page)).toHaveLength(3);
});
