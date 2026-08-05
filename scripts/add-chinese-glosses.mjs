// 把 russian-chinese-extra.json 的中文释义合并进 open-russian-lookup.json
// 用法: node scripts/add-chinese-glosses.mjs
import { readFile, writeFile } from "node:fs/promises";

const LOOKUP_PATH = "src/data/open-russian-lookup.json";
const EXTRA_PATH = "src/data/russian-chinese-extra.json";

const lookup = JSON.parse(await readFile(LOOKUP_PATH, "utf8"));
const extra = JSON.parse(await readFile(EXTRA_PATH, "utf8"));

let added = 0;
let missing = 0;
for (const word of lookup) {
  const meaning = extra[word.word];
  if (!meaning) continue;
  if (!word.meaning) {
    word.meaning = meaning;
    word.source = "OpenRussian + 核心中文释义";
    added += 1;
  } else if (word.meaning !== meaning) {
    missing += 1;
  }
}

await writeFile(LOOKUP_PATH, `${JSON.stringify(lookup)}\n`, "utf8");
console.log(`Merged ${added} Chinese glosses into ${LOOKUP_PATH}. Conflicts skipped: ${missing}`);
