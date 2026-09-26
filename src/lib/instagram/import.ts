import { Unzip, UnzipInflate, strFromU8 } from "fflate";
import { deduplicate } from "./normalize";
import { detectKind, ImportError, parseHtml, parseJson } from "./parsers";
import type { Dataset, ParsedPart } from "./types";

export const LIMITS = { upload: 100 * 1024 * 1024, entry: 20 * 1024 * 1024, expanded: 60 * 1024 * 1024, entries: 10000, files: 200 };
export type InputFile = { name: string; bytes: Uint8Array };
function parseText(name: string, bytes: Uint8Array): ParsedPart[] {
  if (bytes.byteLength > LIMITS.entry) throw new ImportError("A relationship file exceeds 20 MB. Request a smaller export.");
  const text = strFromU8(bytes).replace(/^\uFEFF/, "");
  return /\.json$/i.test(name) ? parseJson(text, detectKind(name)) : parseHtml(text, detectKind(name));
}
export function parseZip(bytes: Uint8Array): ParsedPart[] {
  // The end-of-central-directory record is mandatory in a complete, single-volume ZIP.
  // ZIP64 and multipart archives are deliberately unsupported in this bounded MVP.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new ImportError("This ZIP is incomplete. Download it again or select the extracted JSON files.");
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 || view.getUint16(end + 10, true) === 65535 || view.getUint32(end + 16, true) + view.getUint32(end + 12, true) !== end) {
    throw new ImportError("Multipart and ZIP64 archives are not supported. Extract and select the Followers and Following JSON files.");
  }
  const parts: ParsedPart[] = [];
  let expanded = 0, entries = 0;
  let failure: Error | undefined;
  let completed = 0, relevant = 0;
  const unzip = new Unzip(file => {
    if (++entries > LIMITS.entries) throw new ImportError("This ZIP contains too many files. Export only Followers and Following.");
    if (!detectKind(file.name)) return; // Never inflate media or unrelated personal data.
    relevant++;
    if (file.originalSize !== undefined && file.originalSize > LIMITS.entry) throw new ImportError("A relationship file exceeds the 20 MB safety limit.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (failure) return;
      if (error) { failure = new ImportError("The ZIP is damaged or uses unsupported compression. Extract JSON files and try again."); return; }
      size += chunk.length; expanded += chunk.length;
      if (size > LIMITS.entry || expanded > LIMITS.expanded) {
        file.terminate(); failure = new ImportError("This ZIP expands beyond the safety limit. Export only Followers and Following."); return;
      }
      chunks.push(chunk);
      if (final) {
        const combined = new Uint8Array(size);
        let offset = 0;
        for (const value of chunks) { combined.set(value, offset); offset += value.length; }
        try { parts.push(...parseText(file.name, combined)); completed++; } catch (error) { failure = error as Error; }
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    // Feed bounded compressed chunks so inflated output is checked incrementally.
    for (let offset = 0; offset < bytes.length; offset += 1024) {
      unzip.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
      if (failure) throw failure;
    }
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError("This ZIP could not be read. Download a fresh Instagram export or select the extracted JSON files.");
  }
  if (completed !== relevant || entries !== view.getUint16(end + 10, true)) throw new ImportError("This ZIP is incomplete. Download it again.");
  return parts;
}
export function importDataset(files: InputFile[]): Dataset {
  if (!files.length) throw new ImportError("Select your Instagram ZIP, or both Followers and Following files.");
  if (files.length > LIMITS.files || files.reduce((sum, file) => sum + file.bytes.length, 0) > LIMITS.upload) throw new ImportError("Upload up to 100 MB and 200 files. Request only Followers and Following to reduce the size.");
  const parts: ParsedPart[] = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      if (file.bytes[0] !== 80 || file.bytes[1] !== 75) throw new ImportError("This file is not a valid ZIP archive.");
      parts.push(...parseZip(file.bytes));
    } else if (/\.(json|html?)$/i.test(file.name)) parts.push(...parseText(file.name, file.bytes));
    else throw new ImportError("Unsupported file type. Choose an Instagram ZIP, JSON, or HTML export.");
  }
  for (const kind of ["followers", "following"] as const) {
    if (!parts.some(part => part.kind === kind)) throw new ImportError(`Missing ${kind === "followers" ? "Followers" : "Following"} data. Select both lists together, or upload an export ZIP containing Followers and Following. Choose the All time date range in Instagram.`);
  }
  const html = files.some(file => /\.html?$/i.test(file.name));
  return {
    followers: deduplicate(parts.filter(part => part.kind === "followers").flatMap(part => part.accounts)),
    following: deduplicate(parts.filter(part => part.kind === "following").flatMap(part => part.accounts)),
    metadata: { parsedAt: Date.now(), sourceFormat: files.some(file => /\.zip$/i.test(file.name)) ? "zip" : html ? "html" : "json", warnings: ["Results reflect the lists in this export. Use an All time export for complete relationships.", ...(html ? ["HTML timestamps are not interpreted; date sorting is available for JSON exports."] : [])] },
  };
}
