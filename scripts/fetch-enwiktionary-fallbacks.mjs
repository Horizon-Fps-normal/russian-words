import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const LOOKUP_PATH = "src/data/open-russian-lookup.json";
const RU_DEFINITIONS_PATH = "../codex_shit/lookup-gloss-quality-v2/ruwiktionary-definitions.json";
const WIKDICT_PATH = "src/data/wikdict-russian-chinese.json";
const OVERRIDES_PATH = "src/data/russian-gloss-overrides.json";
const WORK_DIR = "../codex_shit/lookup-gloss-quality-v2";
const PAGE_CACHE_PATH = `${WORK_DIR}/enwiktionary-pages.json`;
const DEFINITION_PATH = `${WORK_DIR}/enwiktionary-definitions.json`;
const SPECIAL_EXPORT_URL = "https://en.wiktionary.org/wiki/Special:Export";
const USER_AGENT = "RussianWords/0.2 (offline dictionary quality audit)";
const BATCH_SIZE = 500;
const MAX_RETRIES = 5;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return fallback; throw error; }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  try { await rename(temporary, path); }
  catch (error) {
    if (error?.code !== "EEXIST" && error?.code !== "EPERM") throw error;
    await writeFile(path, `${JSON.stringify(value)}\n`, "utf8");
  }
}

function createHttpHelper() {
  const child = spawn("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", "scripts/translation-helper.ps1",
  ], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  let sequence = 0;
  let closedError = null;
  lines.on("line", (line) => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line.replace(/^\uFEFF/, "")); }
    catch { console.warn(`HTTP helper returned invalid JSON: ${line.slice(0, 200)}`); return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (!message.ok) request.reject(new Error(`HTTP ${message.status || 0}: ${message.error || "request failed"}`));
    else request.resolve(message.body);
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => console.warn(`HTTP helper: ${chunk.trim()}`));
  child.on("error", (error) => {
    closedError = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  });
  child.on("exit", (code) => {
    closedError ||= new Error(`HTTP helper exited with code ${code}`);
    for (const request of pending.values()) request.reject(closedError);
    pending.clear();
  });
  return {
    request(url, options) {
      if (closedError) return Promise.reject(closedError);
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        child.stdin.write(`${JSON.stringify({ id, url, ...options })}\n`, "utf8", (error) => {
          if (!error) return;
          pending.delete(id);
          reject(error);
        });
      });
    },
    close() { lines.close(); child.stdin.end(); },
  };
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function canonicalTitle(value) {
  return String(value || "").normalize("NFC").toLocaleLowerCase("ru-RU");
}

function mapExportResponse(xml, requestedWords) {
  const pages = new Map();
  for (const match of String(xml || "").matchAll(/<page>([^]*?)<\/page>/g)) {
    const block = match[1];
    const title = decodeXml(block.match(/<title>([^]*?)<\/title>/)?.[1] || "").normalize("NFC");
    const content = decodeXml(block.match(/<text\b[^>]*>([^]*?)<\/text>/)?.[1] || "");
    if (title) pages.set(canonicalTitle(title), { title, content });
  }
  return Object.fromEntries(requestedWords.map((word) => {
    const page = pages.get(canonicalTitle(word));
    return [word, { title: page?.title || word, missing: !page?.content, wikitext: page?.content || "" }];
  }));
}

async function requestBatch(helper, words) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const xml = await helper.request(SPECIAL_EXPORT_URL, {
        method: "Post",
        timeoutSec: 120,
        headers: { "User-Agent": USER_AGENT },
        body: { pages: words.join("\n"), curonly: "1" },
      });
      return mapExportResponse(xml, words);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      await wait(Math.min(20_000, 750 * (2 ** attempt)));
    }
  }
  throw new Error(`English Wiktionary export failed: ${lastError?.message}`);
}

function removeBalancedTemplates(text, names) {
  let output = text;
  for (let start = output.indexOf("{{"); start >= 0; start = output.indexOf("{{", start + 2)) {
    let depth = 0;
    let end = -1;
    for (let index = start; index < output.length - 1; index += 1) {
      const pair = output.slice(index, index + 2);
      if (pair === "{{") { depth += 1; index += 1; }
      else if (pair === "}}") {
        depth -= 1; index += 1;
        if (depth === 0) { end = index + 1; break; }
      }
    }
    if (end < 0) break;
    const name = output.slice(start + 2, end - 2).split("|", 1)[0].trim().toLowerCase();
    if (names.has(name)) { output = `${output.slice(0, start)}${output.slice(end)}`; start = Math.max(-1, start - 2); }
  }
  return output;
}

function renderTemplate(body) {
  const parts = body.split("|").map((part) => part.trim());
  const name = parts.shift()?.toLowerCase() || "";
  if (["lb", "label", "context", "qualifier", "q"].includes(name)) {
    return `(${parts.filter((part) => part && part !== "ru" && !part.includes("=")).join(", ")}) `;
  }
  if (["inflection of", "infl of", "form of"].includes(name)) {
    const lemma = parts.find((part) => part && part !== "ru" && !part.includes("=")) || "";
    return `inflected form of ${lemma}`;
  }
  if (["alternative form of", "alternative spelling of", "misspelling of", "synonym of"].includes(name)) {
    const lemma = parts.find((part) => part && part !== "ru" && !part.includes("=")) || "";
    return `${name} ${lemma}`;
  }
  if (["gloss", "non-gloss definition", "n-g"].includes(name)) return parts.filter((part) => part && !part.includes("=")).join("; ");
  const namedMeaning = parts.find((part) => /^t=/.test(part))?.slice(2);
  if (namedMeaning) return namedMeaning;
  return parts.filter((part) => part && part !== "ru" && !part.includes("=")).at(-1) || "";
}

function parseEnglishDefinition(wikitext) {
  const text = String(wikitext || "").replace(/<!--[^]*?-->/g, "").normalize("NFC");
  const redirect = text.match(/^\s*#redirect\s*\[\[([^\]|#]+)/i)?.[1]?.trim() || "";
  if (redirect) return { definitionEn: "", redirect };
  const start = text.search(/^==\s*Russian\s*==\s*$/mi);
  if (start < 0) return { definitionEn: "", redirect: "" };
  const after = text.slice(start);
  const nextLanguage = after.slice(after.indexOf("\n") + 1).search(/^==[^=\n].*?==\s*$/m);
  const russian = nextLanguage >= 0 ? after.slice(0, after.indexOf("\n") + 1 + nextLanguage) : after;
  const senses = [];
  for (const line of russian.split(/\r?\n/)) {
    if (!/^#(?![:*#])/.test(line)) continue;
    let sense = removeBalancedTemplates(line.replace(/^#\s*/, ""), new Set(["quote", "quote-book", "quote-journal", "ux", "uxi", "usex"]));
    sense = sense
      .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
      .replace(/'''?/g, "")
      .replace(/<ref\b[^>]*>[^]*?<\/ref>|<ref\b[^>]*\/>/gi, "")
      .replace(/<[^>]+>/g, "");
    for (let pass = 0; pass < 6 && /\{\{[^{}]*\}\}/.test(sense); pass += 1) {
      sense = sense.replace(/\{\{([^{}]*)\}\}/g, (_, body) => renderTemplate(body));
    }
    sense = sense.replace(/\{\{|\}\}/g, "").replace(/\s+/g, " ").trim().replace(/[.;,\s]+$/, "");
    if (sense && !senses.includes(sense)) senses.push(sense);
    if (senses.length >= 5) break;
  }
  return { definitionEn: senses.join("; ").slice(0, 700), redirect: "" };
}

await mkdir(WORK_DIR, { recursive: true });
const [entries, ruDefinitions, wikdict, overrides, pageCache] = await Promise.all([
  readJson(LOOKUP_PATH, []), readJson(RU_DEFINITIONS_PATH, {}), readJson(WIKDICT_PATH, {}),
  readJson(OVERRIDES_PATH, {}), readJson(PAGE_CACHE_PATH, {}),
]);
const words = entries
  .filter((entry) => !String(entry.source || "").includes("核心中文释义"))
  .filter((entry) => !overrides[entry.word])
  .filter((entry) => !ruDefinitions[entry.word]?.definitionRu)
  .filter((entry) => !wikdict[entry.word.toLocaleLowerCase("ru-RU")])
  .map((entry) => entry.word);
const pending = words.filter((word) => !Object.hasOwn(pageCache, word));
const batches = [];
for (let index = 0; index < pending.length; index += BATCH_SIZE) batches.push(pending.slice(index, index + BATCH_SIZE));
console.log(`English Wiktionary fallback: ${pending.length} uncached words in ${batches.length} batches`);
const helper = createHttpHelper();
try {
  let completed = 0;
  for (const batch of batches) {
    Object.assign(pageCache, await requestBatch(helper, batch));
    completed += batch.length;
    await writeJsonAtomic(PAGE_CACHE_PATH, pageCache);
    console.log(`English Wiktionary fallback: ${completed}/${pending.length}`);
  }
} finally { helper.close(); }

const pageByTitle = new Map(Object.values(pageCache).filter((page) => page?.title).map((page) => [canonicalTitle(page.title), page]));
const definitions = {};
let pagesFound = 0;
let parsed = 0;
let redirects = 0;
for (const word of words) {
  const page = pageCache[word];
  if (!page?.wikitext) continue;
  pagesFound += 1;
  let result = parseEnglishDefinition(page.wikitext);
  let referenceTitle = page.title;
  if (result.redirect) {
    redirects += 1;
    const target = pageByTitle.get(canonicalTitle(result.redirect));
    if (target?.wikitext) { result = parseEnglishDefinition(target.wikitext); referenceTitle = target.title; }
  }
  if (!result.definitionEn) continue;
  parsed += 1;
  definitions[word] = {
    definitionEn: result.definitionEn,
    reference: `https://en.wiktionary.org/wiki/${encodeURIComponent(referenceTitle)}#Russian`,
  };
}
await writeJsonAtomic(DEFINITION_PATH, definitions);
console.log(JSON.stringify({ requested: words.length, pagesFound, definitionsParsed: parsed, redirects }, null, 2));
