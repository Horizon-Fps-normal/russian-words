import test from "node:test";
import assert from "node:assert/strict";
import { readingTexts } from "../src/data/reading-texts.js";
import { auditReadingTexts, READING_CATEGORIES, READING_LEVELS } from "../scripts/reading-content-utils.mjs";

test("expanded reading library covers every difficulty with bilingual paragraphs", () => {
  const report = auditReadingTexts(readingTexts);
  assert.equal(report.total, 53);
  assert.equal(report.original, 18);
  assert.equal(report.publicDomain, 5);
  assert.equal(report.adaptedSummary, 30);
  READING_LEVELS.forEach((level) => assert.ok(report.levels[level] >= 3, `${level} coverage`));
  READING_CATEGORIES.forEach((category) => assert.ok(report.categories[category] >= 1, `${category} content presence`));
  assert.deepEqual(report.levels, { A1: 10, A2: 10, B1: 10, B2: 11, C1: 12 });
  assert.deepEqual(report.categories, { life: 9, news: 5, science: 12, humor: 4, civics: 7, literature: 9, media: 1, governance: 3, culture: 2, environment: 1 });
  assert.deepEqual(report.errors, []);
  assert.equal(report.valid, true);
});

test("politics lessons cover institutions, representation and public oversight neutrally", () => {
  const lessons = [
    readingTexts.find(({ id }) => id === "b1-city-council-meeting"),
    readingTexts.find(({ id }) => id === "c1-checks-balances-public-discussion"),
  ];
  assert.deepEqual(lessons.map(({ level }) => level), ["B1", "C1"]);
  assert.ok(lessons.every(({ kind, category, author, source }) => (
    kind === "original"
    && category === "civics"
    && author === "原创课文"
    && source.includes("原创教学文本")
  )));

  const russian = lessons.flatMap(({ paragraphs }) => paragraphs.flatMap(({ sentences }) => sentences.map(({ ru }) => ru))).join(" ");
  [
    /выбор/iu,
    /представител/iu,
    /проект/iu,
    /бюджет/iu,
    /голосован/iu,
    /контрол/iu,
    /сдержек и противовесов/iu,
    /надзор/iu,
    /компромисс/iu,
  ].forEach((term) => assert.match(russian, term));
});

test("public-domain excerpts retain explicit author, source URL and license", () => {
  const excerpts = readingTexts.filter(({ kind }) => kind === "public-domain");
  assert.ok(excerpts.every(({ author }) => /\(1[78]\d{2}[–-]1[89]\d{2}\)/u.test(author)));
  assert.ok(excerpts.every(({ sourceUrl }) => sourceUrl.startsWith("https://ru.wikisource.org/")));
  assert.ok(excerpts.every(({ license }) => license.includes("Public domain") && license.includes("CC BY-SA")));
});

test("web-sourced adaptations retain attribution without presenting copied text", () => {
  const adaptations = readingTexts.filter(({ kind }) => kind === "adapted-summary");
  assert.equal(adaptations.length, 30);
  assert.ok(adaptations.every(({ source, sourceUrl, license }) => (
    /据.+(?:改写|重述|叙写)/u.test(source)
    && sourceUrl.startsWith("https://")
    && /adapt(?:ed|ation)|summary|retelling|改写/i.test(license)
  )));
  assert.equal(new Set(adaptations.map(({ id }) => id)).size, adaptations.length);
});
