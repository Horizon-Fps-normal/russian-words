// 从 openrussian.org 抓取学习池名词/形容词的变格表与动词的变位表
// 用法: node scripts/fetch-grammar.mjs [--limit N]
import { readFile, writeFile } from "node:fs/promises";

const LOOKUP_PATH = "src/data/open-russian-lookup.json";
const GRAMMAR_PATH = "src/data/russian-grammar.json";
const CONCURRENCY = 5;
const RETRIES = 4;

const CASES = {
  nominative: "主格",
  genitive: "属格",
  dative: "与格",
  accusative: "宾格",
  instrumental: "工具格",
  prepositional: "前置格",
};

const lookup = JSON.parse(await readFile(LOOKUP_PATH, "utf8"));
const targets = [
  ...lookup
    .filter((word) => word.meaning && ["名词", "形容词", "动词"].includes(word.pos))
    .map((word) => ({ word: word.word, pos: word.pos })),
  // 人称代词与疑问代词的变格
  ...[["я", "代词"], ["ты", "代词"], ["он", "代词"], ["она", "代词"], ["оно", "代词"], ["мы", "代词"], ["вы", "代词"], ["они", "代词"], ["кто", "代词"], ["что", "代词"]].map(([word, pos]) => ({ word, pos })),
];

const limitArg = process.argv.findIndex((a) => a === "--limit");
if (limitArg !== -1) targets.splice(Number(process.argv[limitArg + 1]));

let existing = {};
try {
  existing = JSON.parse(await readFile(GRAMMAR_PATH, "utf8"));
} catch {
  // First run.
}

function tableHtml(html) {
  const tables = [];
  let rest = html;
  let start = rest.indexOf("<table");
  while (start !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = start; i < rest.length; i += 1) {
      if (rest.startsWith("<table", i)) depth += 1;
      else if (rest.startsWith("</table>", i)) {
        depth -= 1;
        if (depth === 0) {
          end = i + "</table>".length;
          break;
        }
      }
    }
    if (end === -1) break;
    tables.push(rest.slice(start, end));
    rest = rest.slice(end);
    start = rest.indexOf("<table");
  }
  return tables;
}

function parseDeclension(table) {
  const hasCaseRows = /nominative|genitive|dative|accusative|instrumental|prepositional/.test(table);
  if (!hasCaseRows) return null;
  const rows = [];
  const rowRegex = /<tr><th>[\s\S]*?<span class="long">([a-z]+)<\/span><\/th>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRegex.exec(table)) !== null) {
    // 按 <td> 边界切分，每个单元格内可能含多个变体（用 / 连接）
    const cells = [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((cell) => [...cell[1].matchAll(/<p class="native">([^<]+)<\/p>/g)].map((c) => c[1]).join(" / "))
      .filter(Boolean);
    if (cells.length) rows.push({ case: m[1], cells });
  }
  if (!rows.length) return null;
  // 列数决定形态:1列=单数名词,2列=名词(单/复数),4列=形容词(性/数)
  const cellCount = rows[0].cells.length;
  const columns = cellCount === 1 ? ["singular"] : cellCount === 2 ? ["singular", "plural"] : ["masculine", "feminine", "neuter", "plural"];
  return { columns, rows };
}

function parseConjugation(html) {
  const cellForms = (rowHtml) =>
    [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((cell) => {
        const text = cell[1].replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
        const match = text.match(/class="native">([^<]+)</);
        if (match) return match[1].trim();
        // 完成体动词的现在时列为 "-" 占位
        return text === "-" ? "-" : "";
      })
      .filter((cell) => cell !== "");

  const result = {};
  for (const table of tableHtml(html)) {
    const isPresentTable = /<th[^>]*>.*Present/i.test(table);
    const isFutureOnlyTable = !isPresentTable && /<th[^>]*>.*Future/i.test(table) && /<tr><th class="native">(я|ты|он)/.test(table);
    if (isPresentTable || isFutureOnlyTable) {
      const persons = [];
      const rowRegex = /<tr><th class="native">([^<]+)<\/th>([\s\S]*?)<\/tr>/g;
      let m;
      while ((m = rowRegex.exec(table)) !== null) {
        const cells = cellForms(m[2]);
        if (cells.length >= 1) persons.push({ person: m[1], cells });
      }
      if (persons.length) {
        // 未完成体: Present/Future 两列; 完成体: Present 列为 "-", 变位形式在 Future 列
        if (isFutureOnlyTable) {
          result.future = Object.fromEntries(persons.map((p) => [p.person, p.cells[0]]));
        } else {
          const present = persons[0]?.cells[0] !== "-" ? persons[0]?.cells[0] : null;
          const future = persons[0]?.cells[1] && persons[0]?.cells[1] !== "-" ? persons[0]?.cells[1] : null;
          if (present || future) {
            const presentMap = {};
            const futureMap = {};
            for (const p of persons) {
              if (present && p.cells[0] !== "-") presentMap[p.person] = p.cells[0];
              if (future && p.cells[1] && p.cells[1] !== "-") futureMap[p.person] = p.cells[1];
            }
            if (Object.keys(presentMap).length) result.present = presentMap;
            if (Object.keys(futureMap).length) result.future = futureMap;
          }
        }
      }
    } else if (/<th[^>]*>.*Past/i.test(table)) {
      const past = {};
      const rowRegex = /<tr><th>([a-z]+)<\/th>([\s\S]*?)<\/tr>/g;
      let m;
      while ((m = rowRegex.exec(table)) !== null) {
        const forms = cellForms(m[2]);
        if (forms.length) past[m[1]] = forms.join(" / ");
      }
      if (Object.keys(past).length) result.past = past;
    } else if (/<th[^>]*>.*Imperative/i.test(table)) {
      const imperative = {};
      const rowRegex = /<tr><th class="native">([^<]+)<\/th>([\s\S]*?)<\/tr>/g;
      let m;
      while ((m = rowRegex.exec(table)) !== null) {
        const forms = cellForms(m[2]);
        if (forms.length) imperative[m[1]] = forms.join(" / ");
      }
      if (Object.keys(imperative).length) result.imperative = imperative;
    }
  }
  return Object.keys(result).length ? result : null;
}

async function fetchGrammar(word) {
  const url = `https://openrussian.org/ru/${encodeURIComponent(word)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return fetchGrammar(word);
  }
  if (!response.ok) return null;
  return response.text();
}

// 已完成的不重抓; 但完成体动词(无现在时/将来时数据)与代词需要重新抓取
const pending = targets.filter(({ word, pos }) => {
  const entry = existing[word];
  if (!entry) return true;
  if (pos === "代词" && entry.type !== "pronoun") return true;
  if (pos === "动词" && !entry.conjugation?.present && !entry.conjugation?.future) return true;
  return false;
});
console.log(`Total targets: ${targets.length}, already fetched: ${targets.length - pending.length}, to fetch: ${pending.length}`);

let index = 0;
let done = 0;
let found = 0;

async function worker() {
  while (index < pending.length) {
    const { word, pos } = pending[index];
    index += 1;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        const html = await fetchGrammar(word);
        if (html) {
          const entry = { type: pos === "名词" ? "noun" : pos === "形容词" ? "adjective" : pos === "代词" ? "pronoun" : "verb" };
          if (pos !== "动词") {
            const declension = parseDeclension(html);
            if (declension) entry.declension = declension;
          } else {
            const conjugation = parseConjugation(html);
            if (conjugation) entry.conjugation = conjugation;
          }
          if (entry.declension || entry.conjugation) {
            existing[word] = entry;
            found += 1;
          }
        }
        break;
      } catch {
        if (attempt < RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        }
      }
    }
    done += 1;
    if (done % 40 === 0) {
      console.log(`Progress: ${done}/${pending.length}, grammar found: ${found}`);
      await writeFile(GRAMMAR_PATH, `${JSON.stringify(existing)}\n`, "utf8");
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
await writeFile(GRAMMAR_PATH, `${JSON.stringify(existing)}\n`, "utf8");
console.log(`Done. Total grammar entries: ${Object.keys(existing).length}`);
