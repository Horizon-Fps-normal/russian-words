import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { auditLookup, cleanGloss, makeMarkedBatch, parseMarkedTranslation } from "./lookup-gloss-utils.mjs";

const LOOKUP_PATH = "src/data/open-russian-lookup.json";
const WIKDICT_PATH = "src/data/wikdict-russian-chinese.json";
const WIKTIONARY_PATH = "../codex_shit/lookup-gloss-quality-v2/ruwiktionary-definitions.json";
const EN_WIKTIONARY_PATH = "../codex_shit/lookup-gloss-quality-v2/enwiktionary-definitions.json";
const OVERRIDES_PATH = "src/data/russian-gloss-overrides.json";
const WORK_DIR = "../codex_shit/lookup-gloss-quality-v2";
const CACHE_PATH = `${WORK_DIR}/translation-cache-v2.json`;
const LEGACY_CACHE_PATH = "../codex_shit/lookup-glosses/translation-cache-v1.json";
const CANDIDATE_PATH = `${WORK_DIR}/open-russian-lookup.reviewed.json`;
const ENDPOINT = process.env.TRANSLATE_ENDPOINT || "https://clients5.google.com/translate_a/t";
const MAX_URL_LENGTH = Number(process.env.TRANSLATE_MAX_URL_LENGTH || 3800);
const MAX_BATCH_CHARACTERS = Number(process.env.TRANSLATE_MAX_BATCH_CHARACTERS || 4800);
const REQUEST_DELAY_MS = Number(process.env.TRANSLATE_DELAY_MS || 300);
const MAX_RETRIES = Number(process.env.TRANSLATE_MAX_RETRIES || 6);
const WORKERS = Number(process.env.TRANSLATE_WORKERS || 3);
const APPLY = process.argv.includes("--apply");

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

function createPowerShellTranslator() {
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
      console.warn(`Translation helper returned invalid JSON: ${line.slice(0, 200)}`);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (!message.ok) request.reject(new Error(`HTTP ${message.status || 0}: ${message.error || "translation request failed"}`));
    else {
      try { request.resolve(JSON.parse(message.body)); }
      catch (error) { request.reject(new Error(`Invalid translation JSON body: ${error.message}`)); }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => console.warn(`Translation helper: ${chunk.trim()}`));
  child.on("error", (error) => {
    closedError = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  });
  child.on("exit", (code) => {
    closedError ||= new Error(`Translation helper exited with code ${code}`);
    for (const request of pending.values()) request.reject(closedError);
    pending.clear();
  });

  return {
    request(url, options = {}) {
      if (closedError) return Promise.reject(closedError);
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        child.stdin.write(`${JSON.stringify({ id, url: url.href, ...options })}\n`, "utf8", (error) => {
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

function translationUrl(source, target, text) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", source);
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  if (text !== undefined) url.searchParams.set("q", text);
  return url;
}

function buildPostBatches(items, maxCharacters = MAX_BATCH_CHARACTERS) {
  const batches = [];
  let current = [];
  for (const item of items) {
    const candidate = [...current, item];
    if (current.length && makeMarkedBatch(candidate.map((entry) => entry.text)).length > maxCharacters) {
      batches.push(current);
      current = [item];
    } else current = candidate;
    if (makeMarkedBatch(current.map((entry) => entry.text)).length > maxCharacters) {
      throw new Error(`Single translation input exceeds POST limit: ${item.text.slice(0, 80)}`);
    }
  }
  if (current.length) batches.push(current);
  return batches;
}

function responseText(payload) {
  if (Array.isArray(payload) && typeof payload[0] === "string") return payload.join("");
  if (!Array.isArray(payload?.[0])) throw new Error("Unexpected translation response shape");
  return payload[0].map((segment) => String(segment?.[0] || "")).join("");
}

async function requestBatch(translator, source, target, batch) {
  const marked = makeMarkedBatch(batch.map((entry) => entry.text));
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const translatedText = responseText(await translator.request(translationUrl(source, target), {
        method: "Post",
        timeoutSec: 90,
        body: { q: marked },
      }));
      try {
        return parseMarkedTranslation(translatedText, batch.length);
      } catch (error) {
        throw new Error(`${error.message}; response=${JSON.stringify(translatedText.slice(0, 600))}`);
      }
    } catch (error) {
      lastError = error;
      if (/Translation (marker mismatch|response contains a blank gloss)/.test(error.message) && batch.length > 1) {
        const middle = Math.ceil(batch.length / 2);
        const left = await requestBatch(translator, source, target, batch.slice(0, middle));
        const right = await requestBatch(translator, source, target, batch.slice(middle));
        return [...left, ...right];
      }
      if (/Translation (marker mismatch|response contains a blank gloss)/.test(error.message) && batch.length === 1) {
        const direct = cleanGloss(responseText(await translator.request(translationUrl(source, target), {
          method: "Post",
          timeoutSec: 90,
          body: { q: batch[0].text },
        })));
        if (direct) return [direct];
      }
      if (attempt === MAX_RETRIES) break;
      const delay = Math.min(30_000, 750 * (2 ** attempt)) + Math.floor(Math.random() * 250);
      console.warn(`${source}->${target} batch failed (${error.message}); retrying in ${delay}ms`);
      await wait(delay);
    }
  }
  throw new Error(`${source}->${target} failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

async function translateUnique(translators, cache, source, target, texts) {
  const unique = [...new Set(texts.map(cleanGloss).filter(Boolean))];
  const output = new Map();
  const pending = [];
  for (const text of unique) {
    const key = `${source}->${target}\u0000${text}`;
    if (cache[key]) output.set(text, cleanGloss(cache[key]));
    else pending.push({ text, key });
  }
  const batches = buildPostBatches(pending);
  console.log(`${source}->${target}: ${pending.length} uncached texts in ${batches.length} batches`);
  let cursor = 0;
  let completed = 0;
  let persist = Promise.resolve();
  await Promise.all(translators.map(async (translator) => {
    while (true) {
      const batchIndex = cursor;
      cursor += 1;
      if (batchIndex >= batches.length) return;
      const batch = batches[batchIndex];
      const translated = await requestBatch(translator, source, target, batch);
      translated.forEach((value, index) => {
        const item = batch[index];
        const gloss = cleanGloss(value);
        if (!gloss) throw new Error(`Rejected empty translation for ${item.text.slice(0, 80)}`);
        cache[item.key] = gloss;
        output.set(item.text, gloss);
      });
      completed += batch.length;
      persist = persist.then(() => writeJsonAtomic(CACHE_PATH, cache));
      await persist;
      if (completed % 250 < batch.length || completed === pending.length) console.log(`${source}->${target}: ${completed}/${pending.length}`);
      await wait(REQUEST_DELAY_MS);
    }
  }));
  for (const text of unique) {
    if (!output.has(text)) output.set(text, cleanGloss(cache[`${source}->${target}\u0000${text}`]));
  }
  return output;
}

function dedupeSegments(value) {
  const seen = new Set();
  let output = "";
  let separator = "";
  for (const token of String(value || "").split(/([；;，,、])/)) {
    if (/^[；;，,、]$/.test(token)) {
      separator = token === ";" ? "；" : token === "," ? "，" : token;
      continue;
    }
    const segment = token.trim();
    const key = segment.replace(/[\s、，,；;。.!！?？:：()（）【】]/g, "").toLocaleLowerCase("zh-CN");
    if (!segment || !key || seen.has(key)) continue;
    output += `${output ? separator || "；" : ""}${segment}`;
    separator = "";
    seen.add(key);
  }
  return output;
}

function cleanChineseGloss(value) {
  return dedupeSegments(cleanGloss(value)
    .replace(/^\s*(?:中文(?:翻译|译文)?|翻译)\s*[:：]\s*/i, "")
    .replace(/\[https?:\/\/[^\]]+\]/gi, "")
    .replace(/\s*\|\|\s*/g, "；")
    .replace(/\bsmb\.?\b/gi, "某人")
    .replace(/\bsth\.?\b/gi, "某事")
    .replace(/\bjoin\b/gi, "加入")
    .replace(/动词\s+to be/gi, "动词 быть")
    .replace(/(?:区域性|地方性)[:：]/g, "【方言】")
    .replace(/(?:俚语|行话)[:：]/g, "【俚语】")
    .replace(/(?:粗俗|庸俗)[:：]/g, "【粗俗】")
    .replace(/口语[:：]/g, "【口语】")
    .replace(/过时(?:的)?[:：]/g, "【旧】")
    .replace(/转义[:：]/g, "【转义】")
    .replace(/\s*([，；：、。])\s*/g, "$1")
    .replace(/(^|；)(?:那个|什么|某人|某物)[。.:：]\s*/g, "$1")
    .replace(/[.。\s]+$/, ""));
}

function hasChineseMeaning(value) {
  return /\p{Script=Han}/u.test(String(value || ""));
}

function usableWikdictMeaning(value) {
  return [...String(value || "").matchAll(/\p{Script=Han}/gu)].length >= 2;
}

function conciseDefinition(definition) {
  const value = cleanGloss(definition).slice(0, 280);
  const lastBoundary = Math.max(value.lastIndexOf(";"), value.lastIndexOf("。"));
  return value.length === 280 && lastBoundary > 140 ? value.slice(0, lastBoundary) : value;
}

function legacyMachineEnglish(entry, legacyCache = {}) {
  const source = String(entry.source || "");
  if (source.includes("machine gloss (ru→en)") || source.includes("direct Russian machine-assisted fallback gloss")) return true;
  const generated = cleanGloss(legacyCache[`ru->en\u0000${entry.word}`]);
  return Boolean(generated && generated.toLocaleLowerCase("en-US") === cleanGloss(entry.meaningEn).toLocaleLowerCase("en-US"));
}

function appendSource(entry, source) {
  entry.source = source;
}

await mkdir(WORK_DIR, { recursive: true });
const [entries, wikdict, wiktionary, enWiktionary, overrides, cache, legacyCache] = await Promise.all([
  readJson(LOOKUP_PATH, []),
  readJson(WIKDICT_PATH, {}),
  readJson(WIKTIONARY_PATH, {}),
  readJson(EN_WIKTIONARY_PATH, {}),
  readJson(OVERRIDES_PATH, {}),
  readJson(CACHE_PATH, {}),
  readJson(LEGACY_CACHE_PATH, {}),
]);
if (!entries.length) throw new Error("Lookup data is empty");

const machineEntries = entries.filter((entry) => !String(entry.source || "").includes("核心中文释义"));
const originalChineseById = new Map(entries.map((entry) => [entry.id, cleanChineseGloss(entry.meaning)]));
const definitionText = new Map();
const russianDefinitionById = new Map();
const englishWiktionaryText = new Map();
const wikdictText = new Map();
const fallbackText = new Map();
const directRussianFallbackText = new Map();
for (const entry of machineEntries) {
  if (overrides[entry.word]) continue;
  const direct = wikdict[entry.word.toLocaleLowerCase("ru-RU")]?.meaning;
  const definition = conciseDefinition(wiktionary[entry.word]?.definitionRu);
  const englishDefinition = cleanGloss(enWiktionary[entry.word]?.definitionEn).slice(0, 700);
  if (definition) russianDefinitionById.set(entry.id, definition);
  if (usableWikdictMeaning(direct)) wikdictText.set(entry.id, cleanGloss(direct));
  else if (definition) definitionText.set(entry.id, definition);
  else if (englishDefinition) englishWiktionaryText.set(entry.id, englishDefinition);
  else if (legacyMachineEnglish(entry, legacyCache)) directRussianFallbackText.set(entry.id, entry.word);
  else fallbackText.set(entry.id, cleanGloss(entry.meaningEn));
}

const translators = Array.from({ length: Math.max(1, WORKERS) }, () => createPowerShellTranslator());
try {
  const wikdictZh = await translateUnique(translators, cache, "zh-TW", "zh-CN", [...wikdictText.values()]);
  const definitionZh = await translateUnique(translators, cache, "ru", "zh-CN", [...definitionText.values()]);
  const englishWiktionaryZh = await translateUnique(translators, cache, "en", "zh-CN", [...englishWiktionaryText.values()]);
  const directRussianFallbackZh = await translateUnique(translators, cache, "ru", "zh-CN", [...directRussianFallbackText.values()]);
  const fallbackZh = await translateUnique(translators, cache, "en", "zh-CN", [...fallbackText.values()]);
  const englishDefinitionTexts = machineEntries
    .filter((entry) => legacyMachineEnglish(entry, legacyCache))
    .map((entry) => russianDefinitionById.get(entry.id))
    .filter(Boolean);
  const definitionEn = await translateUnique(translators, cache, "ru", "en", englishDefinitionTexts);

  const stats = { core: 0, overrides: 0, wikdict: 0, wiktionary: 0, englishWiktionary: 0, russianFallback: 0, englishFallback: 0, recovered: 0, englishRepaired: 0 };
  for (const entry of entries) {
    const repairEnglish = legacyMachineEnglish(entry, legacyCache);
    const override = overrides[entry.word];
    if (override) {
      entry.meaning = cleanChineseGloss(override.meaning);
      entry.meaningEn = cleanGloss(override.meaningEn);
      entry.glossReference = override.reference;
      appendSource(entry, "OpenRussian + manually reviewed Russian dictionary gloss");
      stats.overrides += 1;
      continue;
    }
    if (String(entry.source || "").includes("核心中文释义")) {
      entry.meaning = cleanChineseGloss(entry.meaning);
      stats.core += 1;
      continue;
    }
    if (wikdictText.has(entry.id)) {
      entry.meaning = cleanChineseGloss(wikdictZh.get(wikdictText.get(entry.id)));
      entry.glossReference = wikdict[entry.word.toLocaleLowerCase("ru-RU")].reference;
      appendSource(entry, "OpenRussian + WikDict Russian-Chinese gloss (CC BY-SA)");
      stats.wikdict += 1;
    } else if (definitionText.has(entry.id)) {
      entry.meaning = cleanChineseGloss(definitionZh.get(definitionText.get(entry.id)));
      entry.glossReference = wiktionary[entry.word].reference;
      appendSource(entry, "OpenRussian + Russian Wiktionary contextual definition (CC BY-SA) + machine-assisted Chinese gloss");
      stats.wiktionary += 1;
    } else if (englishWiktionaryText.has(entry.id)) {
      entry.meaning = cleanChineseGloss(englishWiktionaryZh.get(englishWiktionaryText.get(entry.id)));
      entry.glossReference = enWiktionary[entry.word].reference;
      appendSource(entry, "OpenRussian + English Wiktionary Russian definition (CC BY-SA) + machine-assisted Chinese gloss");
      if (repairEnglish) {
        entry.meaningEn = englishWiktionaryText.get(entry.id);
        stats.englishRepaired += 1;
      }
      stats.englishWiktionary += 1;
    } else if (directRussianFallbackText.has(entry.id)) {
      entry.meaning = cleanChineseGloss(directRussianFallbackZh.get(directRussianFallbackText.get(entry.id)) || originalChineseById.get(entry.id));
      appendSource(entry, "OpenRussian + direct Russian machine-assisted fallback gloss");
      stats.russianFallback += 1;
    } else {
      entry.meaning = cleanChineseGloss(fallbackZh.get(fallbackText.get(entry.id)) || entry.meaning);
      appendSource(entry, "OpenRussian + machine-assisted English fallback gloss");
      stats.englishFallback += 1;
    }
    if (repairEnglish && russianDefinitionById.has(entry.id)) {
      entry.meaningEn = cleanGloss(definitionEn.get(russianDefinitionById.get(entry.id)) || entry.meaningEn);
      stats.englishRepaired += 1;
    }
  }

  const invalidEntries = entries.filter((entry) => !hasChineseMeaning(entry.meaning));
  if (invalidEntries.length) {
    const recoveryRussian = await translateUnique(translators, cache, "ru", "zh-CN", invalidEntries.map((entry) => entry.word));
    const recoveryEnglish = await translateUnique(translators, cache, "en", "zh-CN", invalidEntries.map((entry) => entry.meaningEn));
    for (const entry of invalidEntries) {
      const candidates = [
        recoveryRussian.get(entry.word),
        recoveryEnglish.get(entry.meaningEn),
        originalChineseById.get(entry.id),
      ].map(cleanChineseGloss);
      const repaired = candidates.find(hasChineseMeaning);
      if (repaired) {
        entry.meaning = repaired;
        appendSource(entry, `${entry.source} + automatic missing-Chinese recovery`);
        stats.recovered += 1;
      }
    }
  }

  const report = auditLookup(entries);
  await writeJsonAtomic(CANDIDATE_PATH, entries);
  console.log(JSON.stringify({ ...report, ...stats }, null, 2));
  if (!report.valid) throw new Error(`Candidate failed integrity audit; kept at ${CANDIDATE_PATH}`);
  if (APPLY) {
    await writeJsonAtomic(LOOKUP_PATH, entries);
    console.log(`Reviewed lookup written to ${LOOKUP_PATH}`);
  } else {
    console.log(`Dry run complete. Candidate kept at ${CANDIDATE_PATH}; pass --apply to replace the app lookup.`);
  }
} finally {
  translators.forEach((translator) => translator.close());
}
