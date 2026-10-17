import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import {
  normalizeTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "../../src/lib/appearance";

describe("prepaint appearance preference", () => {
  for (const [stored, expected] of [
    [null, "light"],
    ["light", "light"],
    ["dark", "dark"],
    ["system", "light"],
    ["DARK", "light"],
    ['dark\" onclick="bad()', "light"],
  ]) {
    it(`uses ${expected} for stored ${JSON.stringify(stored)}`, () => {
      const attributes: Record<string, string> = {};
      const reads: string[] = [];
      runInNewContext(THEME_INIT_SCRIPT, {
        localStorage: {
          getItem(key: string) {
            reads.push(key);
            return stored;
          },
        },
        document: {
          documentElement: {
            setAttribute: (key: string, value: string) => {
              attributes[key] = value;
            },
          },
        },
      });
      expect(reads).toEqual([THEME_STORAGE_KEY]);
      expect(attributes).toEqual({ "data-theme": expected });
      expect(normalizeTheme(stored)).toBe(expected);
    });
  }

  it("falls back to light when accessing storage throws", () => {
    const attributes: Record<string, string> = {};
    runInNewContext(THEME_INIT_SCRIPT, {
      get localStorage() {
        throw new Error("blocked");
      },
      document: {
        documentElement: {
          setAttribute: (key: string, value: string) => {
            attributes[key] = value;
          },
        },
      },
    });
    expect(attributes).toEqual({ "data-theme": "light" });
  });
});
