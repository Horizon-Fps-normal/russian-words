import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [core, importedExamples, overrides] = await Promise.all([
  readFile(new URL("../src/data/russian-core-5000.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../src/data/russian-examples.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../src/data/russian-example-overrides.json", import.meta.url), "utf8").then(JSON.parse),
]);

const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300\u0301]/gu, "")
  .replaceAll("ё", "е")
  .toLocaleLowerCase("ru-RU");

const mergedExamples = { ...importedExamples, ...overrides };

test("core example coverage is substantially expanded", () => {
  const exampleKeys = new Set(Object.keys(mergedExamples).map(normalize));
  const covered = core.filter((item) => exampleKeys.has(normalize(item.word))).length;
  assert.ok(covered >= 1_870, `expected at least 1870 covered core words, got ${covered}`);
});

test("imported Tatoeba examples retain sentence-level attribution and valid bilingual text", () => {
  const imported = Object.values(importedExamples).filter((item) => item.source === "Tatoeba CC BY 2.0 FR");
  assert.equal(imported.length, 1_571);
  assert.equal(new Set(imported.map((item) => item.ru)).size, imported.length);

  for (const item of imported) {
    assert.match(item.ru, /[А-Яа-яЁё]/u);
    assert.match(item.zh, /[\u3400-\u9fff]/u);
    assert.match(item.sourceUrl, /^https:\/\/tatoeba\.org\/en\/sentences\/show\/\d+$/u);
    assert.ok(Number.isInteger(item.sentenceId));
    assert.ok(Number.isInteger(item.translationId));
  }
});

test("known high-frequency gaps have reviewed local examples", () => {
  for (const word of ["кинотеатр", "театр", "курить", "сигарета", "опасный"]) {
    assert.ok(overrides[word], `${word} is missing a reviewed example`);
    assert.match(overrides[word].ru, /[А-Яа-яЁё]/u);
    assert.match(overrides[word].zh, /[\u3400-\u9fff]/u);
  }
});
