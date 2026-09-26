import { zipSync, strToU8 } from "fflate";
import { closeSync, openSync, writeSync } from "node:fs";

// Construct a ZIP with a sparse stored media payload. Fixtures contain no user data.
export function largeExportParts(padding = 110 * 1024 * 1024) {
  const mediaName = "media/unrelated.bin";
  const bytes = zipSync(
    {
      [mediaName]: new Uint8Array(),
      "connections/followers_and_following/followers_1.json": strToU8(
        '[{"title":"","media_list_data":[],"string_list_data":[{"href":"https://www.instagram.com/example.friend/","value":"example.friend","timestamp":1609459200}]}]',
      ),
      "connections/followers_and_following/following.json": strToU8(
        '{"relationships_following":[{"title":"example.friend","string_list_data":[{"href":"https://www.instagram.com/_u/example.friend","timestamp":1609459200}]}]}',
      ),
    },
    { level: 0 },
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const split = 30 + view.getUint16(26, true) + view.getUint16(28, true);
  const end = bytes.length - 22,
    directory = view.getUint32(end + 16, true);
  view.setUint32(18, padding, true);
  view.setUint32(22, padding, true);
  // Its CRC is intentionally irrelevant: the media file must never be decoded.
  let cursor = directory;
  for (let index = 0; index < 3; index++) {
    if (index === 0) {
      view.setUint32(cursor + 20, padding, true);
      view.setUint32(cursor + 24, padding, true);
    } else
      view.setUint32(
        cursor + 42,
        view.getUint32(cursor + 42, true) + padding,
        true,
      );
    cursor +=
      46 +
      view.getUint16(cursor + 28, true) +
      view.getUint16(cursor + 30, true) +
      view.getUint16(cursor + 32, true);
  }
  view.setUint32(end + 16, directory + padding, true);
  return {
    prefix: bytes.slice(0, split),
    suffix: bytes.slice(split),
    padding,
    size: bytes.length + padding,
  };
}
export function writeLargeExport(path: string) {
  const { prefix, suffix, padding } = largeExportParts();
  const file = openSync(path, "w");
  try {
    writeSync(file, prefix, 0, prefix.length, 0);
    writeSync(file, suffix, 0, suffix.length, prefix.length + padding);
  } finally {
    closeSync(file);
  }
}
