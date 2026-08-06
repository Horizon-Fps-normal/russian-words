import test from "node:test";
import assert from "node:assert/strict";
import { basicExpansionReadingTexts } from "../src/data/reading-texts-basic-expansion.js";

const hasRussian = (value) => /[А-Яа-яЁё]/u.test(String(value || ""));
const hasHan = (value) => /\p{Script=Han}/u.test(String(value || ""));
const endsAsSentence = (value) => /[.!?…。！？》”]$/u.test(String(value || "").trim());

test("basic expansion contains exactly five A1, five A2 and five B1 readings", () => {
  assert.equal(basicExpansionReadingTexts.length, 15);
  const counts = Object.groupBy(basicExpansionReadingTexts, ({ level }) => level);
  assert.deepEqual(
    Object.fromEntries(Object.entries(counts).map(([level, articles]) => [level, articles.length])),
    { A1: 5, A2: 5, B1: 5 },
  );
});

test("basic expansion IDs, sources and bilingual sentence contracts are valid", () => {
  const ids = basicExpansionReadingTexts.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, "duplicate reading ID");

  for (const article of basicExpansionReadingTexts) {
    assert.ok(article.id && article.title && article.titleZh);
    assert.equal(article.kind, "adapted-summary");
    assert.ok(article.category && article.categoryZh);
    assert.ok(article.author && article.license);
    assert.match(article.source, /^据.+改写/u);
    assert.doesNotThrow(() => new URL(article.sourceUrl));
    assert.match(article.sourceUrl, /^https:\/\//u);
    assert.ok(Number.isInteger(article.estimatedMinutes) && article.estimatedMinutes >= 1);
    assert.equal(article.paragraphs.length, 1);

    const paragraph = article.paragraphs[0];
    assert.ok(paragraph.sentences.length >= 6 && paragraph.sentences.length <= 9);
    assert.equal(paragraph.ru, paragraph.sentences.map(({ ru }) => ru).join(" "));
    assert.equal(paragraph.zh, paragraph.sentences.map(({ zh }) => zh).join(""));

    for (const sentence of paragraph.sentences) {
      assert.ok(hasRussian(sentence.ru), `${article.id}: missing Russian`);
      assert.ok(hasHan(sentence.zh), `${article.id}: missing Chinese`);
      assert.ok(endsAsSentence(sentence.ru), `${article.id}: Russian punctuation`);
      assert.ok(endsAsSentence(sentence.zh), `${article.id}: Chinese punctuation`);
    }
  }
});

test("basic expansion uses researched authoritative sources and varied subjects", () => {
  const domains = new Set(basicExpansionReadingTexts.map(({ sourceUrl }) => new URL(sourceUrl).hostname));
  assert.ok(domains.size >= 8);
  const categories = new Set(basicExpansionReadingTexts.map(({ category }) => category));
  ["life", "news", "science", "humor", "civics", "literature"].forEach((category) => assert.ok(categories.has(category)));
});
