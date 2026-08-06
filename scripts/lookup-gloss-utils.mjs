export const LOOKUP_REQUIRED_FIELDS = ["meaning", "meaningEn"];

export function cleanGloss(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\n+/g, "；")
    .replace(/\s+/g, " ")
    .replace(/\s*([,;，；])\s*/g, "$1 ")
    .trim()
    .replace(/[；;,，]\s*$/, "");
}

export function auditLookup(entries) {
  const report = {
    total: Array.isArray(entries) ? entries.length : 0,
    missingMeaning: 0,
    missingMeaningEn: 0,
    meaningWithoutHan: 0,
    invalidRussianAsMeaning: 0,
    invalidRussianAsMeaningEn: 0,
    duplicateIds: 0,
    duplicateWords: 0,
  };
  const ids = new Set();
  const words = new Set();
  for (const entry of entries || []) {
    const meaning = cleanGloss(entry?.meaning);
    const meaningEn = cleanGloss(entry?.meaningEn);
    const russian = cleanGloss(entry?.word).toLocaleLowerCase("ru-RU");
    if (!meaning) report.missingMeaning += 1;
    if (meaning && !/\p{Script=Han}/u.test(meaning)) report.meaningWithoutHan += 1;
    if (!meaningEn) report.missingMeaningEn += 1;
    if (meaning && meaning.toLocaleLowerCase("ru-RU") === russian) report.invalidRussianAsMeaning += 1;
    if (meaningEn && meaningEn.toLocaleLowerCase("ru-RU") === russian) report.invalidRussianAsMeaningEn += 1;
    if (ids.has(entry?.id)) report.duplicateIds += 1;
    else ids.add(entry?.id);
    if (words.has(russian)) report.duplicateWords += 1;
    else words.add(russian);
  }
  report.valid = report.total > 0
    && LOOKUP_REQUIRED_FIELDS.every((field) => report[field === "meaning" ? "missingMeaning" : "missingMeaningEn"] === 0)
    && report.meaningWithoutHan === 0
    && report.invalidRussianAsMeaning === 0
    && report.invalidRussianAsMeaningEn === 0
    && report.duplicateIds === 0
    && report.duplicateWords === 0;
  return report;
}

export function makeMarkedBatch(items) {
  return items.map((item, index) => `[[${index}]] ${item}`).join("\n");
}

export function parseMarkedTranslation(text, expectedCount) {
  const normalized = String(text ?? "").replace(/\r/g, "");
  const marker = /\[\[\s*(\d+)\s*\]\]\s*/g;
  const matches = [...normalized.matchAll(marker)];
  if (matches.length !== expectedCount) {
    throw new Error(`Translation marker mismatch: expected ${expectedCount}, received ${matches.length}`);
  }
  const output = Array(expectedCount);
  for (let position = 0; position < matches.length; position += 1) {
    const current = matches[position];
    const index = Number(current[1]);
    if (!Number.isInteger(index) || index < 0 || index >= expectedCount || output[index] !== undefined) {
      throw new Error(`Invalid or duplicate translation marker: [[${current[1]}]]`);
    }
    const start = current.index + current[0].length;
    const end = matches[position + 1]?.index ?? normalized.length;
    output[index] = cleanGloss(normalized.slice(start, end));
  }
  const blankIndex = output.findIndex((value) => !value);
  if (blankIndex >= 0) throw new Error(`Translation response contains a blank gloss at marker [[${blankIndex}]]`);
  return output;
}

export function buildBatches(items, makeUrl, maxUrlLength = 3800) {
  const batches = [];
  let current = [];
  for (const item of items) {
    const candidate = [...current, item];
    if (current.length && makeUrl(makeMarkedBatch(candidate.map((entry) => entry.text))).href.length > maxUrlLength) {
      batches.push(current);
      current = [item];
    } else {
      current = candidate;
    }
    if (makeUrl(makeMarkedBatch(current.map((entry) => entry.text))).href.length > maxUrlLength) {
      throw new Error(`Single translation input exceeds URL limit: ${item.text.slice(0, 80)}`);
    }
  }
  if (current.length) batches.push(current);
  return batches;
}
