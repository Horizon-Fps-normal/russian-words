import { mkdir, readFile, writeFile } from "node:fs/promises";
import { auditLookup, cleanGloss } from "./lookup-gloss-utils.mjs";

const LOOKUP_PATH = process.argv[2] || "src/data/open-russian-lookup.json";
const OUTPUT_DIR = "../codex_shit/lookup-gloss-quality-v2";
const REPORT_PATH = `${OUTPUT_DIR}/semantic-audit.json`;

const TRANSLITERATION = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const GENERIC_GLOSSES = new Set([
  "妈的", "东西", "某物", "某人",
]);
const SCAFFOLD_PATTERN = /(?:对应的简短英语|英文(?:意思|释义)是|这个词的形式|给出简短|中文翻译|译文如下|lang\s*=|state\s*=|\b(?:impfv|pfv|smb|sth)\b|participial form|adjective of|https?:\/\/|\|\|)/i;

function transliterateRussian(value) {
  return [...String(value || "").toLocaleLowerCase("ru-RU")]
    .map((character) => TRANSLITERATION[character] ?? character)
    .join("")
    .replace(/[^a-z]/g, "");
}

function normalizeLatin(value) {
  return String(value || "").toLocaleLowerCase("en-US").replace(/[^a-z]/g, "");
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function looksLikeRomanizedPlaceholder(entry) {
  const source = String(entry.source || "");
  if (!source.includes("machine gloss (ru→en)") && !source.includes("English fallback")) return false;
  const russian = transliterateRussian(entry.word);
  const english = normalizeLatin(entry.meaningEn);
  if (russian.length < 4 || english.length < 4 || /[ ,;:/()]/.test(entry.meaningEn)) return false;
  if (russian === english) return true;
  return Math.max(russian.length, english.length) >= 6 && editDistance(russian, english) <= 1;
}

function repeatedSegments(value) {
  const segments = String(value || "").split(/[，,；;、]/).map((part) => part.trim()).filter(Boolean);
  return new Set(segments).size < segments.length;
}

const entries = JSON.parse(await readFile(LOOKUP_PATH, "utf8"));
const integrity = auditLookup(entries);
const sourceCounts = {};
const meaningGroups = new Map();
const risks = [];
const metrics = {
  repeatedSegments: 0,
  romanizedEnglish: 0,
  genericChinese: 0,
  translationScaffolding: 0,
  veryShortChinese: 0,
  highDuplicateGroups: 0,
  entriesInHighDuplicateGroups: 0,
};

for (const entry of entries) {
  sourceCounts[entry.source] = (sourceCounts[entry.source] || 0) + 1;
  const meaning = cleanGloss(entry.meaning);
  if (!meaningGroups.has(meaning)) meaningGroups.set(meaning, []);
  meaningGroups.get(meaning).push(entry.word);
  const reasons = [];
  if (repeatedSegments(meaning)) { metrics.repeatedSegments += 1; reasons.push("repeated segments"); }
  if (looksLikeRomanizedPlaceholder(entry)) { metrics.romanizedEnglish += 1; reasons.push("English is Russian romanization"); }
  if (GENERIC_GLOSSES.has(meaning)) { metrics.genericChinese += 1; reasons.push("overly generic Chinese gloss"); }
  if (SCAFFOLD_PATTERN.test(meaning)) { metrics.translationScaffolding += 1; reasons.push("translation scaffolding leaked into gloss"); }
  const hanCount = [...meaning.matchAll(/\p{Script=Han}/gu)].length;
  if (hanCount <= 1 && /[,; ]/.test(entry.meaningEn) && entry.meaningEn.length >= 10) {
    metrics.veryShortChinese += 1;
    reasons.push("Chinese gloss is much shorter than the source senses");
  }
  if (reasons.length) risks.push({ word: entry.word, meaning, meaningEn: entry.meaningEn, pos: entry.pos, source: entry.source, reasons });
}

const duplicateGroups = [...meaningGroups.entries()]
  .filter(([meaning, words]) => meaning && words.length >= 3)
  .sort((left, right) => right[1].length - left[1].length)
  .map(([meaning, words]) => ({ meaning, count: words.length, words }));
metrics.highDuplicateGroups = duplicateGroups.length;
metrics.entriesInHighDuplicateGroups = duplicateGroups.reduce((sum, group) => sum + group.count, 0);

const report = {
  lookupPath: LOOKUP_PATH,
  integrity,
  metrics,
  sourceCounts,
  duplicateGroups,
  risks,
};
await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ lookupPath: LOOKUP_PATH, integrity, metrics, sourceCounts, riskRows: risks.length, reportPath: REPORT_PATH }, null, 2));
