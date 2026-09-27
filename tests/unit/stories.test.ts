import { describe, expect, it } from "vitest";
import { account } from "../../src/lib/instagram/normalize";
import type { Dataset } from "../../src/lib/instagram/types";
import {
  analyze,
  compareSnapshots,
} from "../../src/lib/analysis/relationships";
import { buildStories } from "../../src/lib/analysis/stories";

const date = (value: string) => Date.parse(`${value}T00:00:00Z`) / 1000;
const dataset = (
  following: Dataset["following"],
  followers = following,
): Dataset => ({
  followers,
  following,
  metadata: { parsedAt: Date.now(), sourceFormat: "test", warnings: [] },
});

describe("Wrapped relationship stories", () => {
  it("offers only a factual circle story without usable dates or comparison", () => {
    const current = dataset(
      [account("private.one")!],
      [account("private.two")!],
    );
    const stories = buildStories(analyze(current), current, null);
    expect(stories.map((story) => story.id)).toEqual(["circle"]);
    expect(stories[0].heroValue).toBe("0%");
    expect(JSON.stringify(stories)).not.toMatch(/private\.one|private\.two/);
  });

  it("uses a count instead of an undefined percentage when following is empty", () => {
    const current = dataset([], [account("only.follower")!]);
    const [circle] = buildStories(analyze(current), current, null);
    expect(circle.heroValue).toBe("1");
    expect(circle.heroLabel).toBe("followers recorded in this export");
  });

  it("adds dated timeline and multi-year archaeology without claiming continuity", () => {
    const current = dataset([
      account("old.one", date("2020-01-01"))!,
      account("old.two", date("2020-08-01"))!,
      account("new.one", date("2023-02-03"))!,
      account("unknown")!,
    ]);
    const stories = buildStories(analyze(current), current, null);
    expect(stories.map((story) => story.id)).toEqual([
      "circle",
      "timeline",
      "archaeology",
    ]);
    expect(stories[1].facts).toContainEqual({
      value: "1",
      label: "current follows without dates",
    });
    expect(stories[2].heroValue).toBe("2020");
    expect(stories[2].facts).toContainEqual({
      value: "2",
      label: "current follows recorded that year",
    });
    expect(JSON.stringify(stories)).not.toMatch(/old\.one|old\.two|new\.one/);
    expect(stories[1].note).toMatch(/do not prove continuous following/);
  });

  it("adds comparison only with two snapshots and excludes private lists", () => {
    const older = dataset([account("a")!, account("b")!], [account("a")!]);
    const newer = dataset([account("a")!, account("c")!], [account("c")!]);
    newer.connections = {
      pendingRequests: {
        status: "available",
        accounts: [account("private.request")!],
      },
    } as Dataset["connections"];
    const stories = buildStories(
      analyze(newer),
      newer,
      compareSnapshots(older, newer),
    );
    expect(stories.map((story) => story.id)).toEqual(["circle", "changes"]);
    expect(stories[1].heroValue).toBe("0");
    expect(stories[1].facts).toContainEqual({
      value: "1",
      label: "missing followers",
    });
    expect(JSON.stringify(stories)).not.toMatch(/private\.request|"a"|"b"|"c"/);
  });
});
