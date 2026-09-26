import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { it, expect } from "vitest";
import { normalizeStaticSegments } from "../../scripts/normalize-static-segments.mjs";

it("normalizes nested Windows RSC segments without altering existing flat outputs", async () => {
  const root = resolve("test-results", `segments-${randomUUID()}`);
  const segment = join(root, "example", "__next.$d$tool", "nested");
  await mkdir(segment, { recursive: true });
  await writeFile(join(segment, "__PAGE__.txt"), "synthetic RSC");
  const flat = join(root, "example", "__next._tree.txt");
  await writeFile(flat, "tree");
  expect(await normalizeStaticSegments(root)).toBe(1);
  expect(
    await readFile(
      join(root, "example", "__next.$d$tool.nested.__PAGE__.txt"),
      "utf8",
    ),
  ).toBe("synthetic RSC");
  expect(await readFile(flat, "utf8")).toBe("tree");
  expect(await normalizeStaticSegments(root)).toBe(0);
  await writeFile(
    join(root, "example", "__next.$d$tool.nested.__PAGE__.txt"),
    "conflict",
  );
  await expect(normalizeStaticSegments(root)).rejects.toThrow();
});
