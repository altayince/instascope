import { extractZipBlob } from "../instagram/zip";
import { LIMITS } from "../instagram/limits";
import {
  connectionCategories,
  type FacebookDataset,
  type FacebookFormat,
} from "./types";
import {
  detectFacebookConnection,
  emptyCoverage,
  FacebookImportError,
  parseFacebookConnections,
} from "./parsers";

export function validateFacebookFile(file: { name: string; size: number }) {
  if (!/\.zip$/i.test(file.name) || !file.size || file.size > LIMITS.upload)
    throw new FacebookImportError(
      "Choose one Facebook JSON or HTML ZIP up to 2 GB. Request Connections > Friends in your export.",
    );
}
/** Only allowlisted connection files are decompressed. No raw fields retained. */
export async function importFacebook(
  file: Blob & { name: string },
): Promise<FacebookDataset> {
  validateFacebookFile(file);
  try {
    const stats = { ignoredFiles: 0 };
    const files = await extractZipBlob(
      file,
      { expanded: 0 },
      stats,
      detectFacebookConnection,
    );
    if (!files.length)
      throw new FacebookImportError(
        "No supported Facebook friend files found. Request a JSON or HTML export containing Connections > Friends.",
      );
    const categories = Object.fromEntries(
      connectionCategories.map((key) => [key, emptyCoverage()]),
    ) as FacebookDataset["categories"];
    const seen = new Set<string>();
    let format: FacebookFormat | undefined;
    for (const source of files) {
      const detected = detectFacebookConnection(source.name)!;
      if ((format && format !== detected.format) || seen.has(detected.category))
        throw new FacebookImportError(
          "Choose one export representation. Repeated categories or mixed JSON/HTML files cannot be combined safely.",
        );
      format = detected.format;
      seen.add(detected.category);
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(source.bytes);
      } catch {
        categories[detected.category] = emptyCoverage("unsupported");
        continue;
      }
      categories[detected.category] = parseFacebookConnections(
        text,
        detected.category,
        detected.format,
      );
    }
    return { format: format!, categories, ignoredFiles: stats.ignoredFiles };
  } catch (error) {
    if (error instanceof FacebookImportError) throw error;
    // Shared ZIP errors contain Instagram-specific guidance. Never forward raw errors.
    throw new FacebookImportError(
      "The ZIP is damaged, unsupported or exceeds a safety limit. Use a fresh single-part, unencrypted ZIP containing Facebook Friends (20 MB per supported file; 60 MB expanded; 10,000 entries). ZIP64 is unsupported.",
    );
  }
}
