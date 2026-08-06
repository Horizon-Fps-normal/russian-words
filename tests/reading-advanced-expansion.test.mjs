import test from "node:test";
import assert from "node:assert/strict";

import { READING_TEXTS_ADVANCED_EXPANSION } from "../src/data/reading-texts-advanced-expansion.js";

const RU_END = /[.!?…]$/u;
const ZH_END = /[。！？…]$/u;

test("advanced expansion contains the requested B2 and C1 collection", () => {
  assert.equal(READING_TEXTS_ADVANCED_EXPANSION.length, 15);
  assert.equal(READING_TEXTS_ADVANCED_EXPANSION.filter(({ level }) => level === "B2").length, 7);
  assert.equal(READING_TEXTS_ADVANCED_EXPANSION.filter(({ level }) => level === "C1").length, 8);
});

test("advanced expansion follows the reading field contract", () => {
  const ids = new Set();

  for (const item of READING_TEXTS_ADVANCED_EXPANSION) {
    for (const field of [
      "id", "title", "titleZh", "level", "kind", "category", "categoryZh",
      "author", "source", "sourceUrl", "license",
    ]) {
      assert.equal(typeof item[field], "string", `${item.id || "unknown"}: ${field} must be a string`);
      assert.ok(item[field].trim(), `${item.id || "unknown"}: ${field} must not be empty`);
    }

    assert.ok(!ids.has(item.id), `duplicate id: ${item.id}`);
    ids.add(item.id);
    assert.ok(["B2", "C1"].includes(item.level), `${item.id}: invalid level`);
    assert.ok(["adapted-summary", "public-domain"].includes(item.kind), `${item.id}: invalid kind`);
    assert.ok(Number.isInteger(item.estimatedMinutes) && item.estimatedMinutes > 0, `${item.id}: invalid reading time`);
    assert.doesNotThrow(() => new URL(item.sourceUrl), `${item.id}: invalid source URL`);
    assert.ok(item.source.includes("据"), `${item.id}: source must explicitly identify its basis`);
    assert.ok(item.source.includes("改写") || item.source.includes("重新叙写"), `${item.id}: source must state that it is adapted`);
    assert.ok(Array.isArray(item.paragraphs) && item.paragraphs.length > 0, `${item.id}: missing paragraphs`);
  }
});

test("every article has 7-12 punctuated Russian sentences with complete Chinese translations", () => {
  for (const item of READING_TEXTS_ADVANCED_EXPANSION) {
    const sentences = item.paragraphs.flatMap((entry) => entry.sentences);
    assert.ok(sentences.length >= 7 && sentences.length <= 12, `${item.id}: expected 7-12 sentences`);

    for (const entry of item.paragraphs) {
      assert.equal(entry.ru, entry.sentences.map(({ ru }) => ru).join(" "), `${item.id}: paragraph Russian mismatch`);
      assert.equal(entry.zh, entry.sentences.map(({ zh }) => zh).join(""), `${item.id}: paragraph Chinese mismatch`);

      for (const [index, sentence] of entry.sentences.entries()) {
        assert.equal(typeof sentence.ru, "string", `${item.id} sentence ${index}: missing Russian`);
        assert.equal(typeof sentence.zh, "string", `${item.id} sentence ${index}: missing Chinese`);
        assert.ok(sentence.ru.trim().length >= 20, `${item.id} sentence ${index}: Russian sentence is too short`);
        assert.ok(sentence.zh.trim().length >= 8, `${item.id} sentence ${index}: Chinese translation is too short`);
        assert.match(sentence.ru, RU_END, `${item.id} sentence ${index}: Russian punctuation missing`);
        assert.match(sentence.zh, ZH_END, `${item.id} sentence ${index}: Chinese punctuation missing`);
        assert.notEqual(sentence.ru, sentence.zh, `${item.id} sentence ${index}: translation was not supplied`);
      }
    }
  }
});
