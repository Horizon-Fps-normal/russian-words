import { mkdir, readFile, writeFile } from "node:fs/promises";

const SOURCES = [
  { file: "others.csv", pos: "其他", limit: 3500 },
  { file: "nouns.csv", pos: "名词", limit: 12000 },
  { file: "verbs.csv", pos: "动词", limit: 7000 },
  { file: "adjectives.csv", pos: "形容词", limit: 7000 },
];

const BASE_URL = "https://raw.githubusercontent.com/Badestrand/russian-dictionary/master/";
const VOWELS = /[аеёиоуыэюяАЕЁИОУЫЭЮЯ]/;
const CHINESE_GLOSSES = JSON.parse(await readFile("src/data/russian-chinese-core.json", "utf8"));

function parseTsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split("\t");
  return lines.map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function normalizeStress(text) {
  return String(text || "")
    .replace(/([аеёиоуыэюяАЕЁИОУЫЭЮЯ])'/g, "$1\u0301")
    .replace(/'/g, "")
    .trim();
}

function levelForRank(rank) {
  if (rank <= 1000) return "A1";
  if (rank <= 3000) return "A2";
  if (rank <= 8000) return "B1";
  if (rank <= 15000) return "B2";
  return "C1";
}

function cleanTranslation(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s*;\s*/g, "；")
    .trim();
}

const imported = [];
const seen = new Set();

for (const source of SOURCES) {
  const response = await fetch(`${BASE_URL}${source.file}`);
  if (!response.ok) throw new Error(`Unable to download ${source.file}: ${response.status}`);
  const rows = parseTsv(await response.text());
  rows.slice(0, source.limit).forEach((row, index) => {
    const bare = row.bare?.trim();
    if (!bare || seen.has(bare) || !/[А-Яа-яЁё]/.test(bare)) return;
    seen.add(bare);
    const accented = normalizeStress(row.accented || bare);
    imported.push({
      id: `openrussian-${imported.length + 1}`,
      word: bare,
      stressed: accented,
      meaning: CHINESE_GLOSSES[bare] || "",
      meaningEn: cleanTranslation(row.translations_en),
      level: levelForRank(index + 1),
      pos: source.pos,
      example: "",
      translation: "",
      collocations: [],
      forms: accented,
      source: CHINESE_GLOSSES[bare] ? "OpenRussian + 核心中文释义" : "OpenRussian",
    });
  });
}

await mkdir("src/data", { recursive: true });
await writeFile("src/data/open-russian-lookup.json", `${JSON.stringify(imported)}\n`, "utf8");
console.log(`Imported ${imported.length} OpenRussian lookup entries.`);
