import { Inflate, strFromU8 } from "fflate";
import { detectKind, ImportError } from "./parsers";
import { LIMITS } from "./limits";

export type ZipDirectory = { offset: number; size: number; count: number };
export type ZipEntry = {
  name: string;
  flags: number;
  method: number;
  crc: number;
  packed: number;
  unpacked: number;
  offset: number;
};
export type ImportBudget = { expanded: number };
const invalid = () =>
  new ImportError(
    "This ZIP is damaged or incomplete. Download it again or select the extracted Followers and Following files.",
  );
const unsupported = () =>
  new ImportError(
    "Encrypted, multipart and ZIP64 archives are not supported. Extract and select the Followers and Following JSON files.",
  );
const viewOf = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
export const ZIP_TAIL_BYTES = 65557;

// Layouts follow PKWARE APPNOTE 4.3.7, 4.3.12 and 4.3.16. Only single-disk ZIP32.
export function locateDirectory(
  tail: Uint8Array,
  totalSize: number,
): ZipDirectory {
  const view = viewOf(tail);
  for (let i = tail.length - 22; i >= 0; i--) {
    if (
      view.getUint32(i, true) !== 0x06054b50 ||
      i + 22 + view.getUint16(i + 20, true) !== tail.length
    )
      continue;
    const count = view.getUint16(i + 10, true),
      size = view.getUint32(i + 12, true),
      offset = view.getUint32(i + 16, true);
    if (
      view.getUint16(i + 4, true) ||
      view.getUint16(i + 6, true) ||
      count === 65535 ||
      size === 0xffffffff ||
      offset === 0xffffffff
    )
      throw unsupported();
    if (
      view.getUint16(i + 8, true) !== count ||
      offset + size !== totalSize - tail.length + i
    )
      throw invalid();
    if (count > LIMITS.entries || size > LIMITS.directory)
      throw new ImportError(
        "The ZIP index exceeds the safety limit. Export only Followers and Following.",
      );
    return { offset, size, count };
  }
  throw invalid();
}

export function relevantEntries(
  bytes: Uint8Array,
  directory: ZipDirectory,
): ZipEntry[] {
  if (bytes.length !== directory.size) throw invalid();
  const view = viewOf(bytes),
    entries: ZipEntry[] = [];
  const names = new Set<string>();
  let cursor = 0;
  for (let i = 0; i < directory.count; i++) {
    if (
      cursor + 46 > bytes.length ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw invalid();
    const nameLength = view.getUint16(cursor + 28, true),
      extraLength = view.getUint16(cursor + 30, true),
      commentLength = view.getUint16(cursor + 32, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length) throw invalid();
    const name = strFromU8(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    const entry = {
      name,
      flags: view.getUint16(cursor + 8, true),
      method: view.getUint16(cursor + 10, true),
      crc: view.getUint32(cursor + 16, true),
      packed: view.getUint32(cursor + 20, true),
      unpacked: view.getUint32(cursor + 24, true),
      offset: view.getUint32(cursor + 42, true),
    };
    if (
      view.getUint16(cursor + 34, true) ||
      [entry.packed, entry.unpacked, entry.offset].includes(0xffffffff)
    )
      throw unsupported();
    if (entry.offset + 30 > directory.offset) throw invalid();
    if (detectKind(name)) {
      if ((entry.flags & 0x2041) !== 0 || ![0, 8].includes(entry.method))
        throw unsupported();
      const normalizedPath = name.replaceAll("\\", "/").toLowerCase();
      if (names.has(normalizedPath))
        throw new ImportError(
          "The ZIP contains duplicate relationship filenames. Extract a fresh export and try again.",
        );
      names.add(normalizedPath);
      entries.push(entry);
    }
    cursor = next;
  }
  if (cursor !== bytes.length) throw invalid();
  return entries;
}

export function reserveEntry(entry: ZipEntry, budget: ImportBudget) {
  if (entry.packed > LIMITS.entry || entry.unpacked > LIMITS.entry)
    throw new ImportError(
      "A relationship file exceeds the 20 MB safety limit.",
    );
  if (budget.expanded + entry.unpacked > LIMITS.expanded)
    throw new ImportError(
      "The selected files expand beyond the 60 MB safety limit. Export only Followers and Following.",
    );
  budget.expanded += entry.unpacked;
}

export function localHeaderLength(
  header: Uint8Array,
  entry: ZipEntry,
  directoryOffset: number,
): number {
  if (header.length !== 30) throw invalid();
  const view = viewOf(header);
  if (
    view.getUint32(0, true) !== 0x04034b50 ||
    view.getUint16(6, true) !== entry.flags ||
    view.getUint16(8, true) !== entry.method
  )
    throw invalid();
  if (
    !(entry.flags & 8) &&
    (view.getUint32(14, true) !== entry.crc ||
      view.getUint32(18, true) !== entry.packed ||
      view.getUint32(22, true) !== entry.unpacked)
  )
    throw invalid();
  const length = 30 + view.getUint16(26, true) + view.getUint16(28, true);
  if (entry.offset + length + entry.packed > directoryOffset) throw invalid();
  return length;
}

export function verifyLocalName(header: Uint8Array, entry: ZipEntry) {
  const length = viewOf(header).getUint16(26, true);
  if (strFromU8(header.subarray(30, 30 + length)) !== entry.name)
    throw invalid();
}

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function decodeEntry(packed: Uint8Array, entry: ZipEntry): Uint8Array {
  if (packed.length !== entry.packed) throw invalid();
  // Never allocate based on an unbounded or unverified expansion size.
  if (entry.unpacked > LIMITS.entry || packed.length > LIMITS.entry)
    throw new ImportError(
      "A relationship file exceeds the 20 MB safety limit.",
    );
  let output: Uint8Array;
  if (entry.method === 0) output = packed;
  else {
    output = new Uint8Array(entry.unpacked);
    let size = 0;
    const inflate = new Inflate((chunk) => {
      if (size + chunk.length > output.length) throw invalid();
      output.set(chunk, size);
      size += chunk.length;
    });
    try {
      if (!packed.length) throw invalid();
      for (let offset = 0; offset < packed.length; offset += 1024)
        inflate.push(
          packed.subarray(offset, offset + 1024),
          offset + 1024 >= packed.length,
        );
    } catch {
      throw invalid();
    }
    if (size !== output.length) throw invalid();
  }
  if (output.length !== entry.unpacked || crc32(output) !== entry.crc)
    throw new ImportError(
      "A relationship file failed the ZIP integrity check. Download the export again.",
    );
  return output;
}

export function extractZip(bytes: Uint8Array, budget: ImportBudget) {
  const directory = locateDirectory(
    bytes.subarray(Math.max(0, bytes.length - ZIP_TAIL_BYTES)),
    bytes.length,
  );
  return relevantEntries(
    bytes.subarray(directory.offset, directory.offset + directory.size),
    directory,
  ).map((entry) => {
    reserveEntry(entry, budget);
    const length = localHeaderLength(
      bytes.subarray(entry.offset, entry.offset + 30),
      entry,
      directory.offset,
    );
    verifyLocalName(bytes.subarray(entry.offset, entry.offset + length), entry);
    const data = bytes.subarray(
      entry.offset + length,
      entry.offset + length + entry.packed,
    );
    return { name: entry.name, bytes: decodeEntry(data, entry) };
  });
}

export async function extractZipBlob(file: Blob, budget: ImportBudget) {
  const read = async (start: number, end: number) =>
    new Uint8Array(await file.slice(start, end).arrayBuffer());
  const directory = locateDirectory(
    await read(Math.max(0, file.size - ZIP_TAIL_BYTES), file.size),
    file.size,
  );
  const entries = relevantEntries(
    await read(directory.offset, directory.offset + directory.size),
    directory,
  );
  const files: { name: string; bytes: Uint8Array }[] = [];
  // Sequential reads keep peak memory bounded independently of archive size.
  for (const entry of entries) {
    reserveEntry(entry, budget);
    const length = localHeaderLength(
      await read(entry.offset, entry.offset + 30),
      entry,
      directory.offset,
    );
    verifyLocalName(await read(entry.offset, entry.offset + length), entry);
    files.push({
      name: entry.name,
      bytes: decodeEntry(
        await read(entry.offset + length, entry.offset + length + entry.packed),
        entry,
      ),
    });
  }
  return files;
}
