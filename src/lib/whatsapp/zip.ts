import { Inflate } from "fflate";
import { WhatsAppImportError } from "./errors";
import { WHATSAPP_LIMITS } from "./limits";

type Directory = { offset: number; size: number; count: number };
type Entry = {
  name: Uint8Array;
  flags: number;
  method: number;
  crc: number;
  packed: number;
  unpacked: number;
  offset: number;
};
export type WhatsAppZipResult = {
  bytes: Uint8Array;
  ignoredAttachments: number;
};
const TAIL_BYTES = 65557;
const viewOf = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const invalid = () =>
  new WhatsAppImportError(
    "zip-invalid",
    "This ZIP is damaged or incomplete. Export the chat again or choose the extracted chat TXT file.",
  );
const unsupported = () =>
  new WhatsAppImportError(
    "zip-unsupported",
    "Encrypted, multipart, ZIP64 and unsupported chat compression are not supported. Choose the extracted chat TXT file.",
  );

// Single-disk ZIP32 layouts: PKWARE APPNOTE sections 4.3.7, 4.3.12 and 4.3.16.
function locateDirectory(tail: Uint8Array, totalSize: number): Directory {
  const view = viewOf(tail);
  let sawUnsupported = false;
  for (let position = tail.length - 22; position >= 0; position--) {
    if (
      view.getUint32(position, true) !== 0x06054b50 ||
      position + 22 + view.getUint16(position + 20, true) !== tail.length
    )
      continue;
    const count = view.getUint16(position + 10, true),
      size = view.getUint32(position + 12, true),
      offset = view.getUint32(position + 16, true);
    if (
      view.getUint16(position + 4, true) ||
      view.getUint16(position + 6, true) ||
      count === 65535 ||
      size === 0xffffffff ||
      offset === 0xffffffff
    ) {
      sawUnsupported = true;
      continue;
    }
    if (
      view.getUint16(position + 8, true) !== count ||
      offset + size !== totalSize - tail.length + position
    )
      continue;
    if (
      count > WHATSAPP_LIMITS.zipEntries ||
      size > WHATSAPP_LIMITS.directoryBytes
    )
      throw new WhatsAppImportError(
        "limit",
        "The ZIP index exceeds the safety limit. Export the chat without media and try again.",
      );
    return { offset, size, count };
  }
  throw sawUnsupported ? unsupported() : invalid();
}

function verifyExtraFields(bytes: Uint8Array, start: number, end: number) {
  if (end > bytes.length) throw invalid();
  const view = viewOf(bytes);
  for (let extra = start; extra < end;) {
    if (extra + 4 > end) throw invalid();
    if (view.getUint16(extra, true) === 1) throw unsupported();
    extra += 4 + view.getUint16(extra + 2, true);
    if (extra > end) throw invalid();
  }
}

function textEntry(
  bytes: Uint8Array,
  directory: Directory,
): { entry: Entry; ignoredAttachments: number } {
  if (bytes.length !== directory.size) throw invalid();
  const view = viewOf(bytes);
  const entries: Entry[] = [];
  let cursor = 0,
    ignoredAttachments = 0;
  for (let index = 0; index < directory.count; index++) {
    if (
      cursor + 46 > bytes.length ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw invalid();
    const nameLength = view.getUint16(cursor + 28, true),
      extraLength = view.getUint16(cursor + 30, true),
      commentLength = view.getUint16(cursor + 32, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length || !nameLength) throw invalid();
    const entry: Entry = {
      name: bytes.subarray(cursor + 46, cursor + 46 + nameLength),
      flags: view.getUint16(cursor + 8, true),
      method: view.getUint16(cursor + 10, true),
      crc: view.getUint32(cursor + 16, true),
      packed: view.getUint32(cursor + 20, true),
      unpacked: view.getUint32(cursor + 24, true),
      offset: view.getUint32(cursor + 42, true),
    };
    if (
      view.getUint16(cursor + 34, true) ||
      [entry.packed, entry.unpacked, entry.offset].includes(0xffffffff) ||
      entry.flags & 0x2041
    )
      throw unsupported();
    if (entry.offset + 30 > directory.offset) throw invalid();
    verifyExtraFields(
      bytes,
      cursor + 46 + nameLength,
      cursor + 46 + nameLength + extraLength,
    );
    const attributes = view.getUint32(cursor + 38, true),
      unixType = (attributes >>> 16) & 0xf000;
    const lastNameByte = entry.name[entry.name.length - 1];
    const isDirectory =
      lastNameByte === 47 ||
      lastNameByte === 92 ||
      (attributes & 0x10) !== 0 ||
      unixType === 0x4000;
    // Only the ASCII extension matters: filenames are not decoded, exposed or extracted.
    const isText =
      entry.name.length >= 4 &&
      entry.name[entry.name.length - 4] === 46 &&
      Array.from(entry.name.subarray(-3)).every(
        (byte, position) => (byte | 32) === [116, 120, 116][position],
      );
    if (!isDirectory && isText) {
      if (![0, 8].includes(entry.method) || unixType === 0xa000)
        throw unsupported();
      entries.push(entry);
    } else if (!isDirectory) ignoredAttachments++;
    cursor = next;
  }
  if (cursor !== bytes.length) throw invalid();
  if (entries.length > 1)
    throw new WhatsAppImportError(
      "zip-ambiguous",
      "This ZIP contains more than one TXT file. Choose the extracted chat TXT file; the importer will not guess which chat to use.",
    );
  if (!entries.length)
    throw new WhatsAppImportError(
      "zip-missing-chat",
      "This ZIP contains no chat TXT file. Export one WhatsApp chat or choose its extracted TXT file.",
    );
  const entry = entries[0];
  if (
    entry.packed > WHATSAPP_LIMITS.textBytes ||
    entry.unpacked > WHATSAPP_LIMITS.textBytes
  )
    throw new WhatsAppImportError(
      "limit",
      "The chat TXT file exceeds the 20 MB safety limit. Export a smaller chat and try again.",
    );
  return { entry, ignoredAttachments };
}

function headerLength(
  header: Uint8Array,
  entry: Entry,
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
    entry.flags & 8 &&
    (view.getUint32(14, true) ||
      view.getUint32(18, true) ||
      view.getUint32(22, true))
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

function verifyName(header: Uint8Array, entry: Entry) {
  const view = viewOf(header),
    nameLength = view.getUint16(26, true),
    extraEnd = 30 + nameLength + view.getUint16(28, true);
  if (
    nameLength !== entry.name.length ||
    !entry.name.every((byte, index) => header[30 + index] === byte)
  )
    throw invalid();
  if (header.length !== extraEnd) throw invalid();
  verifyExtraFields(header, 30 + nameLength, extraEnd);
}

/** ZIP32 data descriptors may include the optional signature. Both forms are checked. */
function verifyDescriptor(bytes: Uint8Array, entry: Entry) {
  if (bytes.length < 12) throw invalid();
  const view = viewOf(bytes);
  const matches = (offset: number) =>
    view.getUint32(offset, true) === entry.crc &&
    view.getUint32(offset + 4, true) === entry.packed &&
    view.getUint32(offset + 8, true) === entry.unpacked;
  if (matches(0)) return;
  if (
    bytes.length >= 16 &&
    view.getUint32(0, true) === 0x08074b50 &&
    matches(4)
  )
    return;
  throw invalid();
}

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
export function whatsappCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function decode(packed: Uint8Array, entry: Entry): Uint8Array {
  if (packed.length !== entry.packed) throw invalid();
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
      // Small pushes bound transient inflate output even for forged expansion metadata.
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
  if (output.length !== entry.unpacked || whatsappCrc32(output) !== entry.crc)
    throw new WhatsAppImportError(
      "zip-integrity",
      "The chat failed the ZIP integrity check. Export it again or choose the extracted TXT file.",
    );
  return output;
}

/** Reads the bounded index and selected text record. No attachment is decompressed. */
export async function extractWhatsAppZip(
  file: Blob,
): Promise<WhatsAppZipResult> {
  const read = async (start: number, end: number) =>
    new Uint8Array(await file.slice(start, end).arrayBuffer());
  const directory = locateDirectory(
    await read(Math.max(0, file.size - TAIL_BYTES), file.size),
    file.size,
  );
  const { entry, ignoredAttachments } = textEntry(
    await read(directory.offset, directory.offset + directory.size),
    directory,
  );
  const length = headerLength(
    await read(entry.offset, entry.offset + 30),
    entry,
    directory.offset,
  );
  verifyName(await read(entry.offset, entry.offset + length), entry);
  const payloadStart = entry.offset + length,
    payloadEnd = payloadStart + entry.packed;
  if (entry.flags & 8)
    verifyDescriptor(
      await read(payloadEnd, Math.min(payloadEnd + 16, directory.offset)),
      entry,
    );
  return {
    bytes: decode(await read(payloadStart, payloadEnd), entry),
    ignoredAttachments,
  };
}
