// Import short Russian-Mandarin sentence pairs from a Tatoeba custom export.
// Existing examples are preserved. Newly selected pairs remain attributable by ID/URL.
// Usage: node scripts/import-tatoeba-examples.mjs --pairs file.tsv --opencc TSCharacters.txt --opencc-phrases TSPhrases.txt --limit 1200
import { readFile, writeFile } from "node:fs/promises";

const CORE_PATH = "src/data/russian-core-5000.json";
const EXAMPLES_PATH = "src/data/russian-examples.json";
const GRAMMAR_PATH = "src/data/russian-grammar.json";
const RUSSIAN_TOKEN = /[А-Яа-яЁё\u0300\u0301]+(?:-[А-Яа-яЁё\u0300\u0301]+)*/gu;

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const pairsPath = argument("--pairs");
const openccPath = argument("--opencc");
const openccPhrasesPath = argument("--opencc-phrases");
const requestedLimit = Number.parseInt(argument("--limit", "1200"), 10);
const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 1200;
if (!pairsPath) throw new Error("Missing --pairs path");

function normalizeRussian(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300\u0301]/g, "")
    .replaceAll("ё", "е")
    .toLocaleLowerCase("ru-RU");
}

function russianTokens(value) {
  return (String(value || "").match(RUSSIAN_TOKEN) || []).map(normalizeRussian);
}

function collectRussianForms(value, result) {
  if (typeof value === "string") {
    russianTokens(value).forEach((token) => result.add(token));
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectRussianForms(item, result));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectRussianForms(item, result));
  }
}

async function readOpenCcMapping(path) {
  if (!path) return new Map();
  const dictionary = await readFile(path, "utf8");
  const mapping = new Map();
  for (const line of dictionary.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [traditional, simplifiedValues] = line.split("\t");
    const simplified = simplifiedValues?.split(" ")[0];
    if (traditional && simplified) mapping.set(traditional, simplified);
  }
  return mapping;
}

async function traditionalToSimplifiedConverter(characterPath, phrasePath) {
  const [characterMapping, phraseMapping] = await Promise.all([
    readOpenCcMapping(characterPath),
    readOpenCcMapping(phrasePath),
  ]);
  const phraseEntries = [...phraseMapping.entries()].sort((a, b) => b[0].length - a[0].length);
  return (value) => {
    let converted = String(value || "");
    for (const [traditional, simplified] of phraseEntries) {
      if (converted.includes(traditional)) converted = converted.replaceAll(traditional, simplified);
    }
    return [...converted]
      .map((character) => characterMapping.get(character) || character)
      .join("")
      .replace(/跟著/g, "跟着")
      .replace(/穿著/g, "穿着")
      .replace(/著急/g, "着急")
      .replace(/闲置著/g, "闲置着")
      .replace(/背著/g, "背着")
      .replace(/睡著/g, "睡着");
  };
}

const blockedRussian = /(?:https?:|www\.|@|(?:секс|наркотик|героин|кокаин|хуй|бляд|суицид|труп|изнасил|казн|пистолет)\w*)/iu;
const blockedChinese = /(?:网址|毒品|海洛因|可卡因|自杀|强奸|死刑|尸体)/u;
const blockedNames = /(?:Том|Тони|Мэри|Мюриэл|Джон|Джек|Боб|Кен|Нэнси|Сьюзан|Билл|Майк|Кейт|Бетти)/u;

function usablePair(pair) {
  const tokens = russianTokens(pair.ru);
  return pair.ru.length >= 9
    && pair.ru.length <= 82
    && tokens.length >= 3
    && tokens.length <= 10
    && /[.!?…]$/u.test(pair.ru)
    && !/[.!?…]/u.test(pair.ru.slice(0, -1))
    && /\p{Script=Han}/u.test(pair.zh)
    && pair.zh.length >= 3
    && pair.zh.length <= 46
    && !/[A-Za-z]/u.test(pair.ru)
    && !/[A-Za-z]/u.test(pair.zh)
    && !/\s[А-ЯЁ][а-яё]/u.test(pair.ru)
    && !/[0-9０-９]/u.test(pair.ru)
    && !/[0-9０-９]/u.test(pair.zh)
    && !blockedRussian.test(pair.ru)
    && !blockedNames.test(pair.ru)
    && !blockedChinese.test(pair.zh)
    && !/\.{2,}|--|\*|[_<>]/u.test(pair.ru);
}

function chineseGlossMatches(translation, meaning) {
  return String(meaning || "")
    .replace(/（[^）]*）|【[^】]*】/gu, "")
    .split(/[；;，,、]/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => translation.includes(part));
}

function candidateScore(pair, directToken, word) {
  const tokens = russianTokens(pair.ru);
  let score = Math.abs(tokens.length - 5) * 7 + pair.ru.length * 0.08;
  if (!directToken) score += 18;
  if (chineseGlossMatches(pair.zh, word.meaning)) score -= 22;
  if (tokens.length === 3) score += 5;
  if (tokens[0] === normalizeRussian(word.word)) score -= 4;
  if (/^[—–-]|[;:]/u.test(pair.ru)) score += 12;
  if (/["«»]/u.test(pair.ru)) score += 5;
  return score;
}

const [core, existing, grammar, pairsText, toSimplified] = await Promise.all([
  readFile(CORE_PATH, "utf8").then(JSON.parse),
  readFile(EXAMPLES_PATH, "utf8").then(JSON.parse),
  readFile(GRAMMAR_PATH, "utf8").then(JSON.parse),
  readFile(pairsPath, "utf8"),
  traditionalToSimplifiedConverter(openccPath, openccPhrasesPath),
]);

const candidatesByToken = new Map();
for (const line of pairsText.split(/\r?\n/)) {
  if (!line) continue;
  const [sentenceId, ru, translationId, rawZh] = line.split("\t");
  if (!sentenceId || !ru || !translationId || !rawZh) continue;
  const pair = { sentenceId, ru: ru.trim(), translationId, zh: toSimplified(rawZh.trim()) };
  if (!usablePair(pair)) continue;
  for (const token of new Set(russianTokens(pair.ru))) {
    const entries = candidatesByToken.get(token) || [];
    entries.push(pair);
    candidatesByToken.set(token, entries);
  }
}

const existingKeys = new Set(Object.keys(existing).map(normalizeRussian));
const usedRussian = new Set(Object.values(existing).map((entry) => entry?.ru).filter(Boolean));
const addedWords = [];

for (const word of core) {
  if (addedWords.length >= limit) break;
  const normalizedWord = normalizeRussian(word.word);
  if (!normalizedWord || existingKeys.has(normalizedWord)) continue;

  const forms = new Set([normalizedWord, normalizeRussian(word.stressed)]);
  collectRussianForms(word.forms, forms);
  collectRussianForms(grammar[word.word] || grammar[normalizedWord], forms);
  forms.delete("");

  const rankedCandidates = [];
  const seenPairIds = new Set();
  for (const form of forms) {
    for (const pair of candidatesByToken.get(form) || []) {
      if (usedRussian.has(pair.ru) || seenPairIds.has(pair.sentenceId)) continue;
      seenPairIds.add(pair.sentenceId);
      rankedCandidates.push({ pair, score: candidateScore(pair, form === normalizedWord, word) });
    }
  }
  rankedCandidates.sort((a, b) => a.score - b.score || Number(a.pair.sentenceId) - Number(b.pair.sentenceId));
  const selected = rankedCandidates[0]?.pair;
  if (!selected) continue;

  existing[word.word] = {
    ru: selected.ru,
    zh: selected.zh,
    source: "Tatoeba CC BY 2.0 FR",
    sourceUrl: `https://tatoeba.org/en/sentences/show/${selected.sentenceId}`,
    sentenceId: Number(selected.sentenceId),
    translationId: Number(selected.translationId),
  };
  existingKeys.add(normalizedWord);
  usedRussian.add(selected.ru);
  addedWords.push({ rank: word.studyRank, word: word.word, ru: selected.ru, zh: selected.zh });
}

await writeFile(EXAMPLES_PATH, `${JSON.stringify(existing)}\n`, "utf8");
console.log(JSON.stringify({
  pairs: pairsText.split(/\r?\n/).filter(Boolean).length,
  usablePairs: [...candidatesByToken.values()].reduce((ids, entries) => {
    entries.forEach((entry) => ids.add(entry.sentenceId));
    return ids;
  }, new Set()).size,
  existingBefore: Object.keys(existing).length - addedWords.length,
  added: addedWords.length,
  totalExamples: Object.keys(existing).length,
  firstAdded: addedWords.slice(0, 25),
}, null, 2));
