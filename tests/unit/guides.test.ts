import { expect, it } from "vitest";
import { articles } from "../../src/lib/articles";
import { guideGroups, guides } from "../../src/lib/guides";
import { publicPaths } from "../../src/lib/public-paths";

it("groups each educational destination once and only links public routes", () => {
  const ids = guideGroups.flatMap((group) => group.slugs);
  expect(new Set(ids).size).toBe(ids.length);
  expect([...ids].sort()).toEqual(Object.keys(guides).sort());
  expect(new Set(guideGroups.map((group) => group.id)).size).toBe(
    guideGroups.length,
  );
  for (const guide of Object.values(guides)) {
    expect(publicPaths).toContain(guide.href);
    expect(guide.title.length).toBeGreaterThan(10);
    expect(guide.description.length).toBeGreaterThan(30);
  }
});

it("curates every article without self links and preserves paired relationship intents", () => {
  for (const [slug, article] of Object.entries(articles)) {
    expect(article.related.length, slug).toBeGreaterThanOrEqual(3);
    expect(article.related.length, slug).toBeLessThanOrEqual(5);
    expect(new Set(article.related).size, slug).toBe(article.related.length);
    expect(article.related, slug).not.toContain(slug);
    for (const id of article.related)
      expect(Object.hasOwn(guides, id), `${slug}: ${id}`).toBe(true);
  }
  for (const [first, second] of [
    [
      "how-to-see-when-someone-followed-you-on-instagram",
      "how-to-find-oldest-instagram-followers",
    ],
    [
      "how-to-see-when-you-followed-someone-on-instagram",
      "oldest-instagram-follows",
    ],
    [
      "how-to-see-who-doesnt-follow-you-back-on-instagram",
      "how-to-see-who-follows-you-but-you-dont-follow-back-on-instagram",
    ],
    [
      "instagram-follower-changes",
      "can-you-see-who-unfollowed-you-on-instagram",
    ],
  ]) {
    expect(articles[first].related).toContain(second);
    expect(articles[second].related).toContain(first);
  }
});
