import test from "node:test";
import assert from "node:assert/strict";
import russianPhrases, { PHRASE_CATEGORIES } from "../src/data/russian-phrases.js";

test("offline phrasebook contains 320 complete bilingual entries", () => {
  assert.equal(russianPhrases.length, 320);
  assert.equal(new Set(russianPhrases.map((item) => item.id)).size, russianPhrases.length);
  assert.equal(new Set(russianPhrases.map((item) => item.phrase.toLocaleLowerCase("ru-RU"))).size, russianPhrases.length);
  assert.deepEqual([...new Set(russianPhrases.map((item) => item.category))], PHRASE_CATEGORIES);

  for (const item of russianPhrases) {
    assert.ok(item.phrase.trim(), `${item.id} is missing a Russian phrase`);
    assert.ok(item.meaning.trim(), `${item.id} is missing a Chinese meaning`);
    assert.match(item.exampleRu, /[А-Яа-яЁё]/u, `${item.id} is missing a Russian example`);
    assert.match(item.exampleZh, /[\u3400-\u9fff]/u, `${item.id} is missing a Chinese translation`);
    assert.ok(item.note.trim(), `${item.id} is missing a usage note`);
    assert.ok(["A1", "A2", "B1", "B2"].includes(item.level), `${item.id} has an unsupported level`);
  }
});

test("phrasebook covers the requested not-only-but-also pattern and substantial groups", () => {
  const notOnly = russianPhrases.find((item) => item.phrase.includes("не только"));
  assert.ok(notOnly);
  assert.match(notOnly.meaning, /不仅/);
  assert.match(notOnly.exampleRu, /не только.+но и/u);

  for (const category of PHRASE_CATEGORIES) {
    assert.ok(russianPhrases.filter((item) => item.category === category).length >= 16, `${category} is too small`);
  }
});
