import { describe, expect, it } from "vitest";
import { accountCsv } from "../../src/lib/account-csv";
import { account } from "../../src/lib/instagram/normalize";
import type { Account } from "../../src/lib/instagram/types";

const header = "username,profile_url,recorded_date";
const day = Date.UTC(2025, 0, 3, 0, 15) / 1000;

describe("account CSV", () => {
  it("exports recorded calendar dates and leaves unavailable dates blank", () => {
    expect(
      accountCsv([
        account("sample.json", day)!,
        account("sample.html", day, "minute-without-timezone")!,
        account("sample.unknown")!,
      ]),
    ).toBe(
      [
        header,
        "sample.json,https://www.instagram.com/sample.json/,2025-01-03",
        "sample.html,https://www.instagram.com/sample.html/,2025-01-03",
        "sample.unknown,https://www.instagram.com/sample.unknown/,",
      ].join("\n"),
    );
  });

  it("never supplies an Instagram URL for deleted or fictional accounts", () => {
    const deleted = "__deleted__bcdefghijabcdefgh";
    expect(accountCsv([account(deleted, day)!])).toBe(
      `${header}\n${deleted},,2025-01-03`,
    );
    expect(accountCsv([account("demo.example", day)!], true)).toBe(
      `${header}\ndemo.example,,2025-01-03`,
    );
  });

  it("preserves the full supplied order and distinct history records", () => {
    const entries = Array.from({ length: 73 }, (_, index) =>
      account(`sample.${String(index).padStart(3, "0")}`, day + index * 86400)!,
    ).reverse();
    entries.push(account("sample.072", day)!);
    const before = [...entries];
    const rows = accountCsv(entries).split("\n");
    expect(rows).toHaveLength(75);
    expect(rows[1]).toBe(
      "sample.072,https://www.instagram.com/sample.072/,2025-03-16",
    );
    expect(rows.at(-1)).toBe(
      "sample.072,https://www.instagram.com/sample.072/,2025-01-03",
    );
    expect(entries).toEqual(before);
  });

  it("only exports the three account fields, even when extra private fields exist", () => {
    const entry = {
      ...account("sample.private", day)!,
      note: "private synthetic note",
      watch: true,
      keep: true,
      reviewed: true,
      importDate: "2026-10-13",
      snapshotDate: "2025-12-01",
    };
    expect(accountCsv([entry])).toBe(
      `${header}\nsample.private,https://www.instagram.com/sample.private/,2025-01-03`,
    );
  });

  it("escapes commas, quotes and line breaks without losing field contents", () => {
    const entry: Account = {
      username: 'synthetic,"quoted"\nname',
      href: "https://www.instagram.com/synthetic/?value=one,two",
    };
    expect(accountCsv([entry])).toBe(
      `${header}\n"synthetic,""quoted""\nname","https://www.instagram.com/synthetic/?value=one,two",`,
    );
  });

  it("keeps invalid dates blank and supports an empty result", () => {
    const entries = [NaN, Infinity, 1e30].map((timestamp) => ({
      ...account("sample.invalid")!,
      timestamp,
    }));
    expect(accountCsv(entries).split("\n").slice(1)).toEqual(
      Array(3).fill(
        "sample.invalid,https://www.instagram.com/sample.invalid/,",
      ),
    );
    expect(accountCsv([])).toBe(header);
  });
});
