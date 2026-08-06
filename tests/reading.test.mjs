import test from "node:test";
import assert from "node:assert/strict";
import {
  filterReadingTexts,
  normalizeReadingTexts,
  splitReadingSentences,
  tokenizeReadingRussian,
} from "../src/core/reading.js";

test("reading sentence splitter keeps clickable sentence-ending punctuation", () => {
  assert.deepEqual(splitReadingSentences("Это дом. Кто там? Хорошо!"), [
    { text: "Это дом.", content: "Это дом", punctuation: "." },
    { text: "Кто там?", content: "Кто там", punctuation: "?" },
    { text: "Хорошо!", content: "Хорошо", punctuation: "!" },
  ]);
  assert.deepEqual(splitReadingSentences("Без точки"), [
    { text: "Без точки", content: "Без точки", punctuation: "" },
  ]);
});

test("reading normalization preserves supplied content and aligns translations", () => {
  const [article] = normalizeReadingTexts([{
    id: "one",
    level: "A1",
    category: "life",
    categoryZh: "生活",
    title: "Дом",
    body: "Это дом. Он новый.\n\nМы живём здесь.",
    translation: "这是房子。它是新的。\n\n我们住在这里。",
  }]);
  assert.equal(article.id, "one");
  assert.equal(article.category, "life");
  assert.equal(article.categoryZh, "生活");
  assert.equal(article.paragraphs.length, 2);
  assert.equal(article.paragraphs[0].sentences[0].zh, "这是房子。");
  assert.equal(article.paragraphs[0].sentences[1].zh, "它是新的。");
  assert.equal(article.fullTranslation, "这是房子。它是新的。\n\n我们住在这里。");
});

test("reading filters only by CEFR level while retaining category audit fields", () => {
  const texts = [
    { id: "a", level: "A1", category: "life", title: "A", body: "Текст." },
    { id: "b", level: "A1", category: "science", title: "B", body: "Наука." },
    { id: "c", level: "B2", category: "science", title: "C", body: "Факт." },
  ];
  const a1 = filterReadingTexts(texts, "A1");
  assert.deepEqual(a1.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(a1.map((item) => item.category), ["life", "science"]);
  assert.deepEqual(filterReadingTexts(texts, "全部").map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(filterReadingTexts([], "A1"), []);
});

test("reading tokenizer preserves spaces and exposes only Russian words as tokens", () => {
  assert.deepEqual(tokenizeReadingRussian("Это — дом."), [
    { text: "Это", isRussian: true },
    { text: " — ", isRussian: false },
    { text: "дом", isRussian: true },
    { text: ".", isRussian: false },
  ]);
});
