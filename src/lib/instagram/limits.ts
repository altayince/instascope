import { ImportError } from "./errors";

export const LIMITS = {
  upload: 2 * 1024 * 1024 * 1024,
  entry: 20 * 1024 * 1024,
  expanded: 60 * 1024 * 1024,
  directory: 8 * 1024 * 1024,
  entries: 10000,
  files: 200,
};

export function validateSelection(
  files: readonly { name: string; size: number }[],
) {
  if (!files.length)
    throw new ImportError(
      "Select your Instagram ZIP, or both Followers and Following files.",
    );
  if (
    files.length > LIMITS.files ||
    files.reduce((sum, file) => sum + file.size, 0) > LIMITS.upload
  )
    throw new ImportError(
      "Select up to 2 GB and 200 files. For larger exports, select only the Followers and Following files.",
    );
  for (const file of files) {
    if (!/\.(zip|json|html?)$/i.test(file.name))
      throw new ImportError(
        "Unsupported file type. Choose an Instagram ZIP, JSON, or HTML export.",
      );
    if (!/\.zip$/i.test(file.name) && file.size > LIMITS.entry)
      throw new ImportError(
        "A relationship file exceeds the 20 MB safety limit.",
      );
  }
}
