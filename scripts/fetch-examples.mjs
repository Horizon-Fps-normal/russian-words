// 从 openrussian.org 抓取学习池词条的例句（俄语原文），存为 russian-examples.json
// 用法: node scripts/fetch-examples.mjs [--limit N]
import { readFile, writeFile, mkdir } from "node:fs/promises";

const LOOKUP_PATH = "src/data/open-russian-lookup.json";
const EXAMPLES_PATH = "src/data/russian-examples.json";
const CONCURRENCY = 5;
const RETRIES = 4;

const lookup = JSON.parse(await readFile(LOOKUP_PATH, "utf8"));
const targets = lookup
  .filter((word) => word.meaning && !word.example)
  .map((word) => word.word);

const limitArg = process.argv.findIndex((a) => a === "--limit");
if (limitArg !== -1) targets.splice(Number(process.argv[limitArg + 1]));

let existing = {};
try {
  existing = JSON.parse(await readFile(EXAMPLES_PATH, "utf8"));
} catch {
  // First run.
}

function unescapeExample(raw) {
  try {
    return JSON.parse(`"${raw}"`).replace(/'/g, "");
  } catch {
    return raw.replace(/'/g, "");
  }
}

async function fetchExample(word) {
  const url = `https://openrussian.org/ru/${encodeURIComponent(word)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return fetchExample(word);
  }
  if (!response.ok) return null;
  const html = await response.text();
  const match = html.match(/exampleRu":\s*"([^"]+)/);
  if (!match) return null;
  const example = unescapeExample(match[1]).trim();
  return example.length >= 3 ? example : null;
}

const pending = targets.filter((word) => !existing[word]);
console.log(`Total targets: ${targets.length}, already fetched: ${targets.length - pending.length}, to fetch: ${pending.length}`);

let index = 0;
let done = 0;
let found = 0;

async function worker() {
  while (index < pending.length) {
    const word = pending[index];
    index += 1;
    let succeeded = false;
    for (let attempt = 0; attempt <= RETRIES && !succeeded; attempt += 1) {
      try {
        const example = await fetchExample(word);
        if (example) {
          existing[word] = { ru: example };
          found += 1;
        }
        succeeded = true;
      } catch {
        if (attempt < RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        }
      }
    }
    done += 1;
    if (done % 40 === 0) {
      console.log(`Progress: ${done}/${pending.length}, examples found: ${found}`);
      await writeFile(EXAMPLES_PATH, `${JSON.stringify(existing)}\n`, "utf8");
    }
    // 限速：避免触发站点限流
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
await writeFile(EXAMPLES_PATH, `${JSON.stringify(existing)}\n`, "utf8");
console.log(`Done. Total examples in ${EXAMPLES_PATH}: ${Object.keys(existing).length}`);
