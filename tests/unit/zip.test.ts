import { describe, it, expect } from "vitest";
import { Zip, ZipDeflate, strToU8, zipSync } from "fflate";
import {
  importDataset,
  importFiles,
  type NamedBlob,
} from "../../src/lib/instagram/import";
import { LIMITS, validateSelection } from "../../src/lib/instagram/limits";
import { crc32 } from "../../src/lib/instagram/zip";
import { largeExportParts } from "../helpers/large-export";

const small = (level: 0 | 6 = 6) =>
  zipSync(
    { "followers.json": strToU8("[]"), "following.json": strToU8("[]") },
    { level },
  );
const asFile = (bytes: Uint8Array, name = "export.zip") =>
  new File([Uint8Array.from(bytes)], name);
const read = (bytes: Uint8Array) =>
  importDataset([{ name: "export.zip", bytes }]);
const directory = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(
    bytes.length - 6,
    true,
  );

describe("selective ZIP import", () => {
  it("reads less than 1 MB from a large media-rich file, never the whole archive", async () => {
    const { prefix, suffix, padding, size } = largeExportParts();
    let totalRead = 0;
    const file = {
      name: "large.zip",
      size,
      arrayBuffer() {
        throw new Error("Whole ZIP reads are forbidden");
      },
      slice(start: number, end: number) {
        expect(end - start).toBeLessThan(70000);
        totalRead += end - start;
        const output = new Uint8Array(end - start);
        for (const [bytes, offset] of [
          [prefix, 0],
          [suffix, prefix.length + padding],
        ] as const) {
          const from = Math.max(start, offset),
            to = Math.min(end, offset + bytes.length);
          if (to > from)
            output.set(
              bytes.subarray(from - offset, to - offset),
              from - start,
            );
        }
        return new Blob([output]);
      },
    } as unknown as NamedBlob;
    expect(size).toBeGreaterThan(100 * 1024 * 1024);
    const result = await importFiles([file]);
    expect(result.followers[0].username).toBe("example.friend");
    expect(result.following).toHaveLength(1);
    expect(result.metadata.sourceFormat).toBe("zip");
    expect(totalRead).toBeLessThan(1024 * 1024);
  });
  it.each([0, 6] as const)(
    "accepts stored/deflated ZIPs (level %i)",
    async (level) => {
      expect((await importFiles([asFile(small(level))])).followers).toEqual([]);
    },
  );
  it("checks CRC32 against an independent standard check value", () =>
    expect(crc32(strToU8("123456789"))).toBe(0xcbf43926));
  it("rejects altered payloads even when their JSON is still valid", async () => {
    const zip = zipSync(
      {
        "followers.json": strToU8('[{"string_list_data":[{"value":"alice"}]}]'),
        "following.json": strToU8("[]"),
      },
      { level: 0 },
    );
    const offset = new TextDecoder().decode(zip).indexOf("alice");
    zip[offset] = 98;
    expect(() => read(zip)).toThrow(/integrity/);
    await expect(importFiles([asFile(zip)])).rejects.toThrow(/integrity/);
  });
  it("rejects local/central filename disagreement", () => {
    const zip = small();
    zip[30] = 120;
    expect(() => read(zip)).toThrow(/damaged/);
  });
  it("rejects central/local size disagreement", () => {
    const zip = small();
    const view = new DataView(zip.buffer);
    view.setUint32(22, 1, true);
    expect(() => read(zip)).toThrow(/damaged/);
  });
  it("rejects a forged small expansion size with a data descriptor", () => {
    const zip = small();
    const view = new DataView(zip.buffer);
    const central = directory(zip);
    view.setUint16(6, 8, true);
    view.setUint16(central + 8, 8, true);
    view.setUint32(central + 24, 1, true);
    expect(() => read(zip)).toThrow(/damaged/);
  });
  it("rejects encrypted, ZIP64, multipart and unsupported compression", () => {
    const cases = [
      (v: DataView, c: number) => v.setUint16(c + 8, 1, true),
      (v: DataView, c: number) => v.setUint32(c + 24, 0xffffffff, true),
      (v: DataView, c: number) => v.setUint16(c + 34, 1, true),
      (v: DataView, c: number) => v.setUint16(c + 10, 99, true),
    ];
    for (const mutate of cases) {
      const zip = small();
      mutate(new DataView(zip.buffer), directory(zip));
      expect(() => read(zip)).toThrow(/not supported/);
    }
  });
  it("rejects forged index bounds and counts before parsing entries", async () => {
    const zip = small();
    const view = new DataView(zip.buffer);
    view.setUint32(zip.length - 6, 0xffff0000, true);
    await expect(importFiles([asFile(zip)])).rejects.toThrow(/damaged/);
    const count = small();
    const counts = new DataView(count.buffer);
    counts.setUint16(count.length - 14, 10001, true);
    counts.setUint16(count.length - 12, 10001, true);
    await expect(importFiles([asFile(count)])).rejects.toThrow(/safety limit/);
  });
  it("supports data descriptors from streaming ZIP writers", () => {
    const chunks: Uint8Array[] = [];
    const archive = new Zip((error, data) => {
      if (error) throw error;
      chunks.push(data);
    });
    for (const name of ["followers.json", "following.json"]) {
      const file = new ZipDeflate(name);
      archive.add(file);
      file.push(strToU8("[]"), true);
    }
    archive.end();
    const zip = new Uint8Array(
      chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
      zip.set(chunk, offset);
      offset += chunk.length;
    }
    expect(read(zip).following).toEqual([]);
  });
  it("retains HTML date precision context when HTML is inside ZIP", async () => {
    const html = strToU8(
      '<a href="https://www.instagram.com/example.friend/">friend</a>',
    );
    const zip = zipSync({ "followers.html": html, "following.html": html });
    expect(
      (await importFiles([asFile(zip)])).metadata.warnings.some((warning) =>
        warning.includes("HTML does not include a timezone"),
      ),
    ).toBe(true);
  });
  it("keeps strict limits for loose data and archive selection", () => {
    expect(() =>
      validateSelection([{ name: "export.zip", size: LIMITS.upload + 1 }]),
    ).toThrow(/2 GB/);
    expect(() =>
      validateSelection([{ name: "followers.json", size: LIMITS.entry + 1 }]),
    ).toThrow(/20 MB/);
    expect(() =>
      validateSelection(
        Array.from({ length: 201 }, () => ({ name: "x.zip", size: 1 })),
      ),
    ).toThrow(/200 files/);
  });
});
