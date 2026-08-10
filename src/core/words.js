import { LEVEL_ORDER } from "./constants.js";
import { normalizeRussian } from "./russian.js";

const RUSSIAN_WORD_SOURCE = "[А-Яа-яЁё\\u0300\\u0301]+(?:-[А-Яа-яЁё\\u0300\\u0301]+)*";
const RUSSIAN_WORD_PATTERN = new RegExp(`^${RUSSIAN_WORD_SOURCE}$`, "u");
const RUSSIAN_WORD_CAPTURE = new RegExp(`(${RUSSIAN_WORD_SOURCE})`, "gu");
const RUSSIAN_WORD_GLOBAL = new RegExp(RUSSIAN_WORD_SOURCE, "gu");

function exampleIndex(examples) {
  const index = new Map();
  for (const [key, value] of Object.entries(examples || {})) index.set(normalizeRussian(key), value);
  return index;
}

function mergeWords(localWords, lookupWords, examples, studyOnly) {
  const byWord = new Map();
  for (const source of [localWords || [], lookupWords || []]) {
    for (const word of source) {
      if (!word || !word.word || (studyOnly && !word.meaning)) continue;
      const key = normalizeRussian(word.word);
      if (!byWord.has(key)) byWord.set(key, { ...word });
    }
  }
  const indexedExamples = exampleIndex(examples);
  return [...byWord.values()].map((word) => {
    const example = indexedExamples.get(normalizeRussian(word.word));
    if (!example) return word;
    return {
      ...word,
      example: studyOnly ? (example.ru || word.example) : (word.example || example.ru),
      translation: studyOnly ? (example.zh || word.translation) : (word.translation || example.zh),
    };
  });
}

export function buildStudyPool(localWords, lookupWords, examples, rankedStudyWords) {
  if (Array.isArray(rankedStudyWords) && rankedStudyWords.length) {
    const localByWord = new Map((localWords || []).map((word) => [normalizeRussian(word.word), word]));
    const lookupByWord = new Map((lookupWords || []).map((word) => [normalizeRussian(word.word), word]));
    const indexedExamples = exampleIndex(examples);
    return rankedStudyWords.map((ranked) => {
      const local = localByWord.get(normalizeRussian(ranked.word));
      const lookup = lookupByWord.get(normalizeRussian(ranked.lookupWord || ranked.word));
      const word = { ...(lookup || {}), ...ranked, ...(local || {}) };
      const distinctSense = String(ranked.id || "").startsWith("core5000-");
      word.id = distinctSense ? ranked.id : (local?.id || ranked.id);
      word.studyRank = ranked.studyRank;
      word.meaning = distinctSense ? ranked.meaning : (local?.meaning || ranked.meaning);
      const example = indexedExamples.get(normalizeRussian(word.word));
      if (example) {
        word.example = example.ru || word.example;
        word.translation = example.zh || word.translation;
      }
      return word;
    }).sort((a, b) => a.studyRank - b.studyRank);
  }
  return mergeWords(localWords, lookupWords, examples, true).sort((a, b) =>
    (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99));
}

export function buildDictionary(localWords, lookupWords, examples) {
  return mergeWords(localWords, lookupWords, examples, false);
}

export function searchDictionary(words, query, level = "all") {
  const needle = normalizeRussian(query);
  return (words || []).filter((word) => {
    if (level !== "all" && word.level !== level) return false;
    if (!needle) return true;
    return [word.word, word.stressed, word.meaning, word.meaningEn, word.level]
      .some((field) => normalizeRussian(field).includes(needle));
  });
}

export function paginateItems(items, requestedPage = 1, requestedPageSize = 60) {
  const collection = Array.isArray(items) ? items : [];
  const parsedPageSize = Number(requestedPageSize);
  const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.floor(parsedPageSize) : 60;
  const totalPages = Math.max(1, Math.ceil(collection.length / pageSize));
  const parsedPage = Number(requestedPage);
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(parsedPage) ? Math.floor(parsedPage) : 1));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, collection.length);
  return {
    items: collection.slice(start, end),
    page,
    pageSize,
    totalItems: collection.length,
    totalPages,
    start,
    end,
  };
}

export function splitRussianText(value) {
  return String(value ?? "").split(RUSSIAN_WORD_CAPTURE).filter(Boolean).map((text) => ({
    text,
    isRussian: RUSSIAN_WORD_PATTERN.test(text),
  }));
}

function collectRussianForms(value, forms) {
  if (typeof value === "string") {
    for (const token of value.match(RUSSIAN_WORD_GLOBAL) || []) forms.add(token);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectRussianForms(item, forms));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectRussianForms(item, forms));
  }
}

/** Maps both dictionary lemmas and grammar-table inflections back to a word entry. */
export function buildExampleWordIndex(words, grammar) {
  const index = new Map();
  for (const word of words || []) {
    if (!word?.word) continue;
    const key = normalizeRussian(word.word);
    const existing = index.get(key);
    if (!existing || (!existing.meaning && word.meaning)) index.set(key, word);
    const stressedKey = normalizeRussian(word.stressed);
    if (stressedKey && !index.has(stressedKey)) index.set(stressedKey, word);
  }
  for (const [lemma, entry] of Object.entries(grammar || {})) {
    const word = index.get(normalizeRussian(lemma));
    if (!word) continue;
    const forms = new Set();
    collectRussianForms(entry, forms);
    for (const form of forms) {
      const key = normalizeRussian(form);
      if (key && !index.has(key)) index.set(key, word);
    }
  }
  return index;
}
