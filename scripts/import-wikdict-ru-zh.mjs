import { readFile, writeFile } from "node:fs/promises";

const SOURCE_DIR = process.env.WIKDICT_DIR || "../codex_shit/wikdict-ru-zh/wikdict-ru-zh";
const OUTPUT_PATH = process.env.WIKDICT_OUTPUT || "src/data/wikdict-russian-chinese.json";

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

export function extractChineseGloss(html) {
  const candidates = [];
  const leafDiv = /<div(?:\s[^>]*)?>([^<>]*)<\/div>/gi;
  for (const match of String(html || "").matchAll(leafDiv)) {
    let value = decodeEntities(match[1])
      .replace(/\([^)]*[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][^)]*\)/g, "")
      .replace(/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+\)?$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[，,；;\s]+$/, "");
    if (!/\p{Script=Han}/u.test(value)) continue;
    if (value.length > 120) continue;
    if (!candidates.includes(value)) candidates.push(value);
  }
  if (!candidates.length) return "";
  // Keep distinct senses here. The rebuild step converts them to simplified
  // Chinese and then removes traditional/simplified duplicates.
  return candidates.join("；");
}

function parseIndex(indexBuffer, dictionaryBuffer) {
  const output = {};
  let cursor = 0;
  while (cursor < indexBuffer.length) {
    const terminator = indexBuffer.indexOf(0, cursor);
    if (terminator < 0 || terminator + 9 > indexBuffer.length) break;
    const word = indexBuffer.subarray(cursor, terminator).toString("utf8").normalize("NFC");
    const offset = indexBuffer.readUInt32BE(terminator + 1);
    const size = indexBuffer.readUInt32BE(terminator + 5);
    const html = dictionaryBuffer.subarray(offset, offset + size).toString("utf8");
    const meaning = extractChineseGloss(html);
    if (word && meaning) output[word.toLocaleLowerCase("ru-RU")] = {
      meaning,
      reference: `https://www.wikdict.com/ru-zh/${encodeURIComponent(word)}`,
    };
    cursor = terminator + 9;
  }
  return output;
}

const [indexBuffer, dictionaryBuffer] = await Promise.all([
  readFile(`${SOURCE_DIR}/stardict.idx`),
  readFile(`${SOURCE_DIR}/stardict.dict`),
]);
const entries = parseIndex(indexBuffer, dictionaryBuffer);
await writeFile(OUTPUT_PATH, `${JSON.stringify(entries)}\n`, "utf8");
console.log(`Imported ${Object.keys(entries).length} Russian-Chinese WikDict entries to ${OUTPUT_PATH}`);
