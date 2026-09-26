import { readdir, readFile, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

// Next's Windows exporter can retain backslashes in RSC segment filenames.
// Materialize the dotted URLs requested by the router in the deployable output,
// not just the preview server. No-op for correctly emitted Linux exports.
// Upstream: https://github.com/vercel/next.js/issues/92339
export async function normalizeStaticSegments(directory) {
  let copied = 0;
  async function flatten(segmentRoot, current, destination) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const source = join(current, entry.name);
      if (entry.isDirectory()) await flatten(segmentRoot, source, destination);
      else if (entry.isFile() && entry.name.endsWith(".txt")) {
        const name = relative(segmentRoot, source).split(sep).join(".");
        const target = `${destination}.${name}`;
        try {
          await copyFile(source, target, constants.COPYFILE_EXCL);
          copied++;
        } catch (error) {
          if (
            error.code !== "EEXIST" ||
            !(await readFile(source)).equals(await readFile(target))
          )
            throw error;
        }
      }
    }
  }
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = join(directory, entry.name);
    if (entry.name.startsWith("__next.")) await flatten(child, child, child);
    else copied += await normalizeStaticSegments(child);
  }
  return copied;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(
    `Static RSC paths normalized: ${await normalizeStaticSegments(resolve("out"))}`,
  );
}
