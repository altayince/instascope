import { expect, it } from "vitest";
import { articles, type Article } from "../../src/lib/articles";
import { publicPaths, privatePaths } from "../../src/lib/public-paths";
import {
  whatsappGuideCatalog,
  whatsappGuides,
  whatsappProducts,
  whatsappPublicPaths,
} from "../../src/lib/whatsapp/public-content";

const expectedGuides = [
  "export-whatsapp-chat",
  "analyze-group-chat",
  "chat-activity-heatmap",
  "message-and-media-statistics",
  "word-and-emoji-analysis",
  "compare-chat-exports",
  "backup-and-restore-chat-snapshots",
  "create-whatsapp-wrapped",
  "chat-export-not-working",
  "chat-analysis-privacy",
];
const instagramTargets = [
  "how-to-see-when-someone-followed-you-on-instagram",
  "how-to-see-when-you-followed-someone-on-instagram",
  "how-to-view-instagram-profiles-without-an-account",
  "instagram-sent-follow-requests",
  "how-to-analyze-instagram-data-download",
];
function internalTarget(href: string) {
  expect(href).toMatch(/^\/(?!\/)/);
  const url = new URL(href, "https://instascope.me");
  expect(publicPaths, href).toContain(url.pathname);
  expect(privatePaths, href).not.toContain(url.pathname);
  expect(url.search).not.toMatch(/participant|username|snapshot|message/);
}
function substantive(article: Article) {
  expect(article.title.length).toBeGreaterThan(15);
  expect(article.description.length).toBeGreaterThan(50);
  expect(article.sections.length).toBeGreaterThanOrEqual(3);
  expect(article.sections[0].paragraphs.join(" ").length).toBeGreaterThan(160);
  const copy = article.sections
    .flatMap((section) => section.paragraphs)
    .join(" ");
  expect(copy.length).toBeGreaterThan(900);
  expect(copy).toMatch(/browser|local/i);
  const headings = article.sections.map((section) => section.heading);
  expect(new Set(headings).size).toBe(headings.length);
  for (const section of article.sections) {
    expect(section.paragraphs.length).toBeGreaterThan(0);
    if (section.steps) {
      expect(section.steps.length).toBeGreaterThan(1);
      for (const step of section.steps) expect(step.length).toBeGreaterThan(10);
    }
    if (section.table) {
      expect(section.table.columns.length).toBeGreaterThan(1);
      expect(section.table.rows.length).toBeGreaterThan(0);
      for (const row of section.table.rows) {
        expect(row).toHaveLength(section.table.columns.length);
        for (const value of row) expect(value.trim().length).toBeGreaterThan(0);
      }
    }
    for (const link of section.links ?? []) internalTarget(link.href);
  }
  for (const link of article.links) internalTarget(link.href);
  if (article.primaryAction) internalTarget(article.primaryAction.href);
  for (const key of article.related) internalTarget(`/${key}/`);
}

it("registers exactly ten distinct public WhatsApp guide intents alongside four products and a hub", () => {
  expect(Object.keys(whatsappGuides).sort()).toEqual(
    [...expectedGuides].sort(),
  );
  expect(whatsappPublicPaths).toHaveLength(15);
  expect(new Set(whatsappPublicPaths).size).toBe(15);
  expect(publicPaths).toHaveLength(46);
  expect(new Set(publicPaths).size).toBe(publicPaths.length);
  for (const key of ["title", "description"] as const) {
    const values = [
      ...Object.values(whatsappGuides),
      ...Object.values(whatsappProducts),
    ].map((item) => item[key]);
    expect(new Set(values).size).toBe(values.length);
  }
  for (const slug of expectedGuides) {
    expect(whatsappGuideCatalog[`whatsapp/guides/${slug}`]).toEqual({
      href: `/whatsapp/guides/${slug}/`,
      title: whatsappGuides[slug].title,
    });
    expect(publicPaths).toContain(`/whatsapp/guides/${slug}/`);
  }
});

it.each(expectedGuides)(
  "guide %s has substantive, unique copy, usable steps/tables and real product links",
  (slug) => {
    const article = whatsappGuides[slug];
    substantive(article);
    expect(article.primaryAction).toBeDefined();
    expect(Object.values(whatsappProducts).map((item) => item.path)).toContain(
      article.primaryAction!.href,
    );
    const firstParagraph = article.sections[0].paragraphs[0];
    expect(
      Object.values(whatsappGuides).filter(
        (guide) => guide.sections[0].paragraphs[0] === firstParagraph,
      ),
    ).toHaveLength(1);
    expect(article.related.length).toBeGreaterThan(0);
  },
);

it.each(instagramTargets)(
  "strengthened Instagram guide %s preserves its URL and valid contextual targets",
  (slug) => {
    expect(publicPaths).toContain(`/${slug}/`);
    substantive(articles[slug]);
  },
);

it("keeps the existing export guide, opposite follow-date direction and private workspace policies distinct", () => {
  expect(publicPaths).toContain("/how-to-download-instagram-followers-data/");
  expect(publicPaths).toContain(
    "/how-to-see-when-you-followed-someone-on-instagram/",
  );
  expect(publicPaths).toContain(
    "/how-to-see-when-someone-followed-you-on-instagram/",
  );
  for (const path of privatePaths) expect(publicPaths).not.toContain(path);
  expect(publicPaths).toContain("/whatsapp/chat-vault/");
  expect(publicPaths.every((path) => !/[?#]/.test(path))).toBe(true);
});
