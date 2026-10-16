import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { pruneUnreleasedPlatforms } from "../../scripts/prune-unreleased-platforms.mjs";

const temporaryExports: string[] = [];

async function syntheticExport() {
  const output = await mkdtemp(join(tmpdir(), "instascope-platform-output-"));
  temporaryExports.push(output);
  for (const [path, contents] of [
    ["index.html", "Instagram home"],
    ["followers-analyzer/index.html", "Instagram analyzer"],
    ["_next/static/demo.js", "Shared assets"],
    ["whatsappish/index.html", "Unrelated route"],
    ["whatsapp/index.html", "WhatsApp home"],
    ["whatsapp/chat-analyzer/index.html", "WhatsApp analyzer"],
    ["whatsapp/wrapped/index.html", "WhatsApp Wrapped"],
    ["whatsapp/__next._tree.txt", "Synthetic RSC"],
  ]) {
    const target = join(output, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return output;
}

afterEach(async () => {
  for (const directory of temporaryExports.splice(0)) {
    const target = resolve(directory);
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith("instascope-platform-output-")
    )
      throw new Error("Temporary export cleanup escaped its test directory.");
    await rm(target, { recursive: true, force: true });
  }
});

async function expectInstagramPreserved(output: string) {
  expect(await readFile(join(output, "index.html"), "utf8")).toBe(
    "Instagram home",
  );
  expect(
    await readFile(join(output, "followers-analyzer/index.html"), "utf8"),
  ).toBe("Instagram analyzer");
  expect(await readFile(join(output, "_next/static/demo.js"), "utf8")).toBe(
    "Shared assets",
  );
  expect(await readFile(join(output, "whatsappish/index.html"), "utf8")).toBe(
    "Unrelated route",
  );
}

it.each([
  ["false", "true"],
  ["true", "false"],
  [undefined, "true"],
])(
  "removes disabled WhatsApp exports (%s, preview %s) and preserves Instagram",
  async (requested, preview) => {
    const output = await syntheticExport();
    expect(
      await pruneUnreleasedPlatforms(output, {
        environment: {
          NODE_ENV: "production",
          NEXT_PUBLIC_WHATSAPP_ENABLED: requested,
          NEXT_PUBLIC_PREVIEW: preview,
        },
        localBranch: "feature/INS-114-whatsappscope-foundation",
      }),
    ).toBe(true);
    await expect(access(join(output, "whatsapp"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expectInstagramPreserved(output);
  },
);

it("retains WhatsApp HTML and RSC artifacts in an enabled non-main preview", async () => {
  const output = await syntheticExport();
  expect(
    await pruneUnreleasedPlatforms(output, {
      environment: {
        NODE_ENV: "production",
        NEXT_PUBLIC_WHATSAPP_ENABLED: "true",
        NEXT_PUBLIC_PREVIEW: "true",
        GITHUB_BASE_REF: "dev",
        CF_PAGES_BRANCH: "dev",
      },
      localBranch: "feature/INS-114-whatsappscope-foundation",
    }),
  ).toBe(false);
  for (const path of [
    "whatsapp/index.html",
    "whatsapp/chat-analyzer/index.html",
    "whatsapp/wrapped/index.html",
    "whatsapp/__next._tree.txt",
  ])
    await expect(access(join(output, path))).resolves.toBeUndefined();
  await expectInstagramPreserved(output);
});

it.each([
  ["unknown branch", "", {}],
  ["local main branch", "main", {}],
  ["Pages main branch", "feature/task", { CF_PAGES_BRANCH: "main" }],
  ["Workers main branch", "feature/task", { WORKERS_CI_BRANCH: "main" }],
  ["PR targeting main", "feature/task", { GITHUB_BASE_REF: "main" }],
  ["GitHub main ref", "feature/task", { GITHUB_REF_NAME: "refs/heads/main" }],
])(
  "removes WhatsApp exports for %s despite preview opt-in",
  async (_label, localBranch, branchEnvironment) => {
    const output = await syntheticExport();
    expect(
      await pruneUnreleasedPlatforms(output, {
        environment: {
          NODE_ENV: "production",
          NEXT_PUBLIC_WHATSAPP_ENABLED: "true",
          NEXT_PUBLIC_PREVIEW: "true",
          ...branchEnvironment,
        },
        localBranch,
      }),
    ).toBe(true);
    await expect(access(join(output, "whatsapp"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expectInstagramPreserved(output);
  },
);
