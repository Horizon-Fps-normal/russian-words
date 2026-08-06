import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const LOOKUP_PATH = "src/data/open-russian-lookup.json";
const WORK_DIR = "../codex_shit/lookup-gloss-quality-v2";
const PAGE_CACHE_PATH = `${WORK_DIR}/ruwiktionary-pages.json`;
const DEFINITION_PATH = `${WORK_DIR}/ruwiktionary-definitions.json`;
const BATCH_SIZE = 500;
const WORKERS = Number(process.env.WIKTIONARY_WORKERS || 3);
const REQUEST_DELAY_MS = Number(process.env.WIKTIONARY_DELAY_MS || 120);
const MAX_RETRIES = Number(process.env.WIKTIONARY_MAX_RETRIES || 6);
const LIMIT = Number(process.env.WIKTIONARY_LIMIT || 0);
const USER_AGENT = "RussianWords/0.2 (offline dictionary quality audit)";
const SPECIAL_EXPORT_URL = "https://ru.wiktionary.org/wiki/Special:Export";
const API_BASES = String(process.env.WIKTIONARY_API_BASES || "https://ru.wiktionary.org/w/api.php,https://ru.m.wiktionary.org/w/api.php")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  try {
    await rename(temporary, path);
  } catch (error) {
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
    let message;
    try {
      message = JSON.parse(line.replace(/^\uFEFF/, ""));
    } catch {
      console.warn(`HTTP helper returned invalid JSON: ${line.slice(0, 200)}`);
      return;
    }
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
    request(url, options = {}) {
      if (closedError) return Promise.reject(closedError);
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        child.stdin.write(`${JSON.stringify({ id, url: String(url), ...options })}\n`, "utf8", (error) => {
          if (!error) return;
          pending.delete(id);
          reject(error);
        });
      });
    },
    close() {
      lines.close();
      child.stdin.end();
    },
  };
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
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
    return [word, {
      title: page?.title || word,
      redirect: "",
      missing: !page?.content,
      wikitext: page?.content || "",
    }];
  }));
}

function apiUrl(words, apiBase) {
  const url = new URL(apiBase);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", words.join("|"));
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("maxlag", "5");
  return url;
}

function canonicalTitle(value) {
  return String(value || "").normalize("NFC").toLocaleLowerCase("ru-RU");
}

function contentOf(page) {
  return page?.revisions?.[0]?.slots?.main?.content
    ?? page?.revisions?.[0]?.slots?.main?.["*"]
    ?? page?.revisions?.[0]?.["*"]
    ?? null;
}

function mapBatchResponse(payload, requestedWords) {
  const query = payload?.query || {};
  const titleAliases = new Map();
  for (const item of [...(query.normalized || []), ...(query.redirects || [])]) {
    titleAliases.set(canonicalTitle(item.from), canonicalTitle(item.to));
  }
  const resolveTitle = (title) => {
    let current = canonicalTitle(title);
    const seen = new Set();
    while (titleAliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = titleAliases.get(current);
    }
    return current;
  };
  const pages = new Map((query.pages || []).map((page) => [canonicalTitle(page.title), page]));
  return Object.fromEntries(requestedWords.map((word) => {
    const target = resolveTitle(word);
    const page = pages.get(target) || pages.get(canonicalTitle(word));
    const content = contentOf(page);
    return [word, {
      title: page?.title || word,
      redirect: target !== canonicalTitle(word) ? page?.title || target : "",
      missing: !content,
      wikitext: content || "",
    }];
  }));
}

async function requestBatch(helper, words) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const body = await helper.request(SPECIAL_EXPORT_URL, {
        method: "Post",
        timeoutSec: 120,
        headers: { "User-Agent": USER_AGENT },
        body: { pages: words.join("\n"), curonly: "1" },
      });
      return mapExportResponse(body, words);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      const delay = Math.min(20_000, 600 * (2 ** attempt)) + Math.floor(Math.random() * 200);
      console.warn(`Wiktionary batch failed (${error.message}); retrying in ${delay}ms`);
      await wait(delay);
    }
  }
  throw new Error(`Wiktionary batch failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

const LABELS = new Map([
  ["авиац.", "авиационное"], ["анат.", "анатомическое"], ["бран.", "бранное"],
  ["биол.", "биологическое"], ["вульг.", "вульгарное"], ["детск.", "детское"],
  ["диал.", "диалектное"], ["жарг.", "жаргонное"], ["ласк.", "ласкательное"],
  ["ирон.", "ироническое"], ["истор.", "историческое"], ["книжн.", "книжное"],
  ["мат.", "математическое"],
  ["неодобр.", "неодобрительное"], ["неол.", "неологизм"], ["обл.", "областное"],
  ["офиц.", "официальное"], ["п.", "переносное"], ["перен.", "переносное"],
  ["поэт.", "поэтическое"], ["полит.", "политическое"], ["предик.", "предикативное"],
  ["пренебр.", "пренебрежительное"],
  ["прост.", "просторечное"], ["разг.", "разговорное"], ["редк.", "редкое"],
  ["сниж.", "сниженное"], ["спец.", "специальное"], ["устар.", "устаревшее"],
  ["фам.", "фамильярное"], ["хим.", "химическое"], ["шутл.", "шутливое"],
  ["эвф.", "эвфемизм"],
]);

function removeBalancedTemplates(text, names) {
  let output = text;
  for (let start = output.indexOf("{{"); start >= 0; start = output.indexOf("{{", start + 2)) {
    let depth = 0;
    let end = -1;
    for (let index = start; index < output.length - 1; index += 1) {
      const pair = output.slice(index, index + 2);
      if (pair === "{{") { depth += 1; index += 1; }
      else if (pair === "}}") {
        depth -= 1;
        index += 1;
        if (depth === 0) { end = index + 1; break; }
      }
    }
    if (end < 0) break;
    const name = output.slice(start + 2, end - 2).split("|", 1)[0].trim().toLocaleLowerCase("ru-RU");
    if (names.has(name)) {
      output = `${output.slice(0, start)}${output.slice(end)}`;
      start = Math.max(-1, start - 2);
    }
  }
  return output;
}

function renderTemplate(body) {
  const parts = body.split("|").map((part) => part.trim());
  const name = parts.shift()?.toLocaleLowerCase("ru-RU") || "";
  const lexicalParts = parts.filter((part) => part
    && !/^[a-z-]{2,8}$/i.test(part)
    && !/^(?:lang|state|состояние|nocat|помета)\s*=/i.test(part));
  const referencedWord = lexicalParts[0] || "";
  const explicitExplanation = lexicalParts.length > 1 ? lexicalParts.at(-1) : "";
  if (["уменьш.", "уменьш", "уменьшительно-ласкательное"].includes(name)) {
    return `уменьшительная форма слова ${referencedWord}`;
  }
  if (["умласк.", "умласк"].includes(name)) {
    return `уменьшительно-ласкательная форма слова ${referencedWord}`;
  }
  if (["ласк.", "ласк", "ласкательное"].includes(name)) {
    return `ласкательная форма слова ${referencedWord}`;
  }
  if (["увелич.", "увелич"].includes(name)) {
    return `увеличительная форма слова ${referencedWord}`;
  }
  if (["уничиж.", "уничиж"].includes(name)) {
    return `уничижительная форма слова ${referencedWord}`;
  }
  if (["отн.", "относ.", "относительное"].includes(name)) {
    return `относящийся к ${referencedWord}`;
  }
  if (["свойство", "качество"].includes(name)) {
    return explicitExplanation || `свойство, обозначаемое словом ${referencedWord}`;
  }
  if (["действие", "процесс"].includes(name)) {
    return `действие или процесс по значению глагола ${referencedWord}`;
  }
  if (LABELS.has(name)) return `${LABELS.get(name)}: `;
  if (["дееприч.", "деепричастие"].includes(name)) return `деепричастная форма глагола ${referencedWord}`;
  if (["прич.", "причастие"].includes(name)) return `причастная форма глагола ${referencedWord}`;
  if (["мн.", "множественное число"].includes(name)) return `форма множественного числа слова ${referencedWord}`;
  if (name === "помета") return `${parts.filter((part) => part && !part.includes("=")).join(", ")}: `;
  if (["lang", "l", "m"].includes(name)) return parts.filter((part) => part && !/^[a-z-]{2,8}$/i.test(part) && !part.includes("=")).at(-1) || "";
  return parts.filter((part) => part && !part.includes("=") && !/^[a-z-]{2,8}$/i.test(part)).at(-1) || "";
}

export function wikitextToPlainDefinition(wikitext) {
  const text = String(wikitext || "").replace(/<!--[^]*?-->/g, "").normalize("NFC");
  const redirect = text.match(/^\s*#(?:redirect|перенаправление)\s*\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/i);
  if (redirect) return { definitionRu: "", redirect: redirect[1].trim() };

  const russianStart = text.search(/^=+\s*\{\{-ru-\}\}\s*=+\s*$/m);
  if (russianStart < 0) return { definitionRu: "", redirect: "" };
  const afterStart = text.slice(russianStart);
  const nextLanguage = afterStart.slice(afterStart.indexOf("\n") + 1).search(/^=[^=\n].*?=\s*$/m);
  const russian = nextLanguage >= 0 ? afterStart.slice(0, afterStart.indexOf("\n") + 1 + nextLanguage) : afterStart;
  const sections = [...russian.matchAll(/^={3,5}\s*Значение\s*={3,5}\s*$/gmi)];
  const senses = [];
  for (const section of sections) {
    const bodyStart = section.index + section[0].length;
    const rest = russian.slice(bodyStart);
    const end = rest.search(/^={3,5}[^=].*?={3,5}\s*$/m);
    const body = end >= 0 ? rest.slice(0, end) : rest;
    const normalizedBody = body.replace(/^#\s*\{\{значение\s*\r?\n([^]*?)^\}\}\s*$/gm, (_, templateBody) => {
      const definition = templateBody.match(/^\s*\|\s*определение\s*=\s*(.*?)\s*$/m)?.[1] || "";
      const labels = templateBody.match(/^\s*\|\s*пометы\s*=\s*(.*?)\s*$/m)?.[1] || "";
      return definition ? `# ${labels} ${definition}` : "";
    });
    for (const line of normalizedBody.split(/\r?\n/)) {
      if (!/^#(?![:*#])/.test(line)) continue;
      let sense = line.replace(/^#\s*/, "");
      sense = removeBalancedTemplates(sense, new Set(["пример", "example", "нужен перевод"]));
      sense = sense
        .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
        .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
        .replace(/'''?/g, "")
        .replace(/<ref\b[^>]*>[^]*?<\/ref>|<ref\b[^>]*\/>/gi, "")
        .replace(/<[^>]+>/g, "");
      for (let pass = 0; pass < 5 && /\{\{[^{}]*\}\}/.test(sense); pass += 1) {
        sense = sense.replace(/\{\{([^{}]*)\}\}/g, (_, bodyText) => renderTemplate(bodyText));
      }
      sense = sense
        .replace(/\{\{|\}\}/g, "")
        .replace(/\s+/g, " ")
        .replace(/\s+([,;:.])/g, "$1")
        .trim()
        .replace(/[.;,\s]+$/, "");
      if (sense && !/^[-—?]+$/.test(sense) && !senses.includes(sense)) senses.push(sense);
      if (senses.length >= 5) break;
    }
    if (senses.length >= 5) break;
  }
  return { definitionRu: senses.join("; ").slice(0, 1200), redirect: "" };
}

await mkdir(WORK_DIR, { recursive: true });
const entries = JSON.parse(await readFile(LOOKUP_PATH, "utf8"));
const allWords = [...new Set(entries.map((entry) => entry.word))];
const words = LIMIT > 0 ? allWords.slice(0, LIMIT) : allWords;
const pageCache = await readJson(PAGE_CACHE_PATH, {});
const pendingWords = words.filter((word) => !Object.hasOwn(pageCache, word));
const batches = [];
for (let index = 0; index < pendingWords.length; index += BATCH_SIZE) batches.push(pendingWords.slice(index, index + BATCH_SIZE));
console.log(`Russian Wiktionary: ${pendingWords.length} uncached words in ${batches.length} batches`);

const helpers = Array.from({ length: Math.max(1, WORKERS) }, (_, index) => ({
  helper: createHttpHelper(),
  apiBase: API_BASES[index % API_BASES.length],
}));
let cursor = 0;
let completed = 0;
let persist = Promise.resolve();
try {
  await Promise.all(helpers.map(async ({ helper }, workerIndex) => {
    while (true) {
      const batchIndex = cursor;
      cursor += 1;
      if (batchIndex >= batches.length) return;
      const batch = batches[batchIndex];
      Object.assign(pageCache, await requestBatch(helper, batch));
      completed += batch.length;
      persist = persist.then(() => writeJsonAtomic(PAGE_CACHE_PATH, pageCache));
      await persist;
      console.log(`Russian Wiktionary: ${completed}/${pendingWords.length}`);
      await wait(REQUEST_DELAY_MS);
    }
  }));
} finally {
  helpers.forEach(({ helper }) => helper.close());
}

const definitions = {};
const cachedPageByTitle = new Map(Object.values(pageCache)
  .filter((page) => page?.title)
  .map((page) => [canonicalTitle(page.title), page]));
let found = 0;
let parsed = 0;
let redirects = 0;
for (const word of words) {
  const page = pageCache[word];
  if (!page || page.missing || !page.wikitext) continue;
  found += 1;
  let result = wikitextToPlainDefinition(page.wikitext);
  const redirect = page.redirect || result.redirect || "";
  let referenceTitle = page.title;
  if (!result.definitionRu && redirect) {
    const targetPage = cachedPageByTitle.get(canonicalTitle(redirect));
    if (targetPage?.wikitext) {
      const targetResult = wikitextToPlainDefinition(targetPage.wikitext);
      if (targetResult.definitionRu) {
        result = targetResult;
        referenceTitle = targetPage.title;
      }
    }
  }
  if (redirect) redirects += 1;
  if (result.definitionRu) parsed += 1;
  definitions[word] = {
    definitionRu: result.definitionRu,
    redirect,
    title: page.title,
    reference: `https://ru.wiktionary.org/wiki/${encodeURIComponent(referenceTitle)}`,
  };
}
await writeJsonAtomic(DEFINITION_PATH, definitions);
console.log(JSON.stringify({ total: words.length, pagesFound: found, definitionsParsed: parsed, redirects, missingPages: words.length - found }, null, 2));
