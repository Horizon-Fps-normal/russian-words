import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { auditLookup, buildBatches, cleanGloss, makeMarkedBatch, parseMarkedTranslation } from "./lookup-gloss-utils.mjs";

const LOOKUP_PATH = "src/data/open-russian-lookup.json";
const WORK_DIR = "../codex_shit/lookup-glosses";
const CACHE_PATH = `${WORK_DIR}/translation-cache-v1.json`;
const CANDIDATE_PATH = `${WORK_DIR}/open-russian-lookup.completed.json`;
const OVERRIDES_PATH = "src/data/russian-gloss-overrides.json";
const ENDPOINT = process.env.TRANSLATE_ENDPOINT || "https://translate.googleapis.com/translate_a/single";
const MAX_URL_LENGTH = Number(process.env.TRANSLATE_MAX_URL_LENGTH || 3800);
const REQUEST_DELAY_MS = Number(process.env.TRANSLATE_DELAY_MS || 350);
const MAX_RETRIES = Number(process.env.TRANSLATE_MAX_RETRIES || 6);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
    } catch (error) {
      console.warn(`PowerShell helper returned invalid JSON: ${line.slice(0, 200)}`);
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
  child.stderr.on("data", (chunk) => console.warn(`PowerShell helper: ${chunk.trim()}`));
  child.on("error", (error) => {
    closedError = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  });
  child.on("exit", (code) => {
    closedError ||= new Error(`PowerShell translation helper exited with code ${code}`);
    for (const request of pending.values()) request.reject(closedError);
    pending.clear();
  });

  return {
    request(url) {
      if (closedError) return Promise.reject(closedError);
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        child.stdin.write(`${JSON.stringify({ id, url: url.href })}\n`, "utf8", (error) => {
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
  url.searchParams.set("q", text);
  return url;
}

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

function responseText(payload) {
  if (!Array.isArray(payload?.[0])) throw new Error("Unexpected translation response shape");
  return payload[0].map((segment) => String(segment?.[0] || "")).join("");
}

async function requestBatch(translator, source, target, batch) {
  const marked = makeMarkedBatch(batch.map((entry) => entry.text));
  const url = translationUrl(source, target, marked);
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const translatedText = responseText(await translator.request(url));
      try {
        return parseMarkedTranslation(translatedText, batch.length);
      } catch (error) {
        throw new Error(`${error.message}; response=${JSON.stringify(translatedText.slice(0, 600))}`);
      }
    } catch (error) {
      lastError = error;
      if (/Translation (marker mismatch|response contains a blank gloss)/.test(error.message) && batch.length > 1) {
        const middle = Math.ceil(batch.length / 2);
        console.warn(`${source}->${target} marker alignment failed; splitting ${batch.length} items into smaller batches`);
        const left = await requestBatch(translator, source, target, batch.slice(0, middle));
        const right = await requestBatch(translator, source, target, batch.slice(middle));
        return [...left, ...right];
      }
      if (/Translation (marker mismatch|response contains a blank gloss)/.test(error.message) && batch.length === 1) {
        const directText = cleanGloss(responseText(await translator.request(translationUrl(source, target, batch[0].text))));
        if (directText) {
          console.warn(`${source}->${target} used an unmarked retry for ${batch[0].text}`);
          return [directText];
        }
      }
      if (attempt === MAX_RETRIES) break;
      const delay = Math.min(30_000, 750 * (2 ** attempt)) + Math.floor(Math.random() * 250);
      console.warn(`${source}->${target} batch failed (${error.message}); retrying in ${delay}ms`);
      await wait(delay);
    }
  }
  throw new Error(`${source}->${target} failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

function appendSource(entry, label) {
  const sources = String(entry.source || "OpenRussian").split(" + ");
  if (!sources.includes(label)) sources.push(label);
  entry.source = sources.join(" + ");
}

async function translateMissing(translators, entries, cache, { source, target, selectText, assign, sourceLabel }) {
  const pending = [];
  for (const entry of entries) {
    const text = cleanGloss(selectText(entry));
    if (!text) continue;
    const key = `${source}->${target}\u0000${text}`;
    if (cache[key]) {
      assign(entry, cleanGloss(cache[key]));
      appendSource(entry, sourceLabel);
    } else {
      pending.push({ entry, text, key });
    }
  }
  const batches = buildBatches(pending, (text) => translationUrl(source, target, text), MAX_URL_LENGTH);
  console.log(`${source}->${target}: ${pending.length} uncached items in ${batches.length} batches`);
  let completed = 0;
  let cursor = 0;
  let persist = Promise.resolve();
  const runWorker = async (translator) => {
    while (true) {
      const batchIndex = cursor;
      cursor += 1;
      if (batchIndex >= batches.length) return;
      const batch = batches[batchIndex];
      const translated = await requestBatch(translator, source, target, batch);
      translated.forEach((gloss, index) => {
        const item = batch[index];
        const cleaned = cleanGloss(gloss);
        if (!cleaned || cleaned.toLocaleLowerCase("ru-RU") === item.entry.word.toLocaleLowerCase("ru-RU")) {
          throw new Error(`Rejected empty/self translation for ${item.entry.word}: ${cleaned}`);
        }
        cache[item.key] = cleaned;
        assign(item.entry, cleaned);
        appendSource(item.entry, sourceLabel);
      });
      completed += batch.length;
      persist = persist.then(() => writeJsonAtomic(CACHE_PATH, cache));
      await persist;
      console.log(`${source}->${target}: ${completed}/${pending.length}`);
      await wait(REQUEST_DELAY_MS);
    }
  };
  await Promise.all(translators.map(runWorker));
}

await mkdir(WORK_DIR, { recursive: true });
const entries = JSON.parse(await readFile(LOOKUP_PATH, "utf8"));
const cache = await readJson(CACHE_PATH, {});
const overrides = await readJson(OVERRIDES_PATH, {});
const translators = Array.from({ length: Number(process.env.TRANSLATE_WORKERS || 3) }, () => createPowerShellTranslator());

try {
  await translateMissing(translators, entries, cache, {
    source: "ru",
    target: "en",
    selectText: (entry) => entry.meaningEn ? "" : entry.word,
    assign: (entry, gloss) => { entry.meaningEn = gloss; },
    sourceLabel: "Google Translate machine gloss (ru→en)",
  });

  await translateMissing(translators, entries, cache, {
    source: "en",
    target: "zh-CN",
    selectText: (entry) => entry.meaning ? "" : entry.meaningEn,
    assign: (entry, gloss) => { entry.meaning = gloss; },
    sourceLabel: "Google Translate machine gloss (en→zh-CN)",
  });

  await translateMissing(translators, entries, cache, {
    source: "ru",
    target: "zh-CN",
    selectText: (entry) => /\p{Script=Han}/u.test(entry.meaning || "") ? "" : entry.word,
    assign: (entry, gloss) => { entry.meaning = gloss; },
    sourceLabel: "Google Translate machine gloss (ru→zh-CN fallback)",
  });

  for (const entry of entries) {
    const override = overrides[entry.word];
    if (!override) continue;
    entry.meaning = cleanGloss(override.meaning);
    entry.meaningEn = cleanGloss(override.meaningEn);
    appendSource(entry, "Russian Wiktionary curated gloss (CC BY-SA)");
    entry.glossReference = override.reference;
  }

  const report = auditLookup(entries);
  await writeJsonAtomic(CANDIDATE_PATH, entries);
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) throw new Error(`Candidate failed integrity audit; kept at ${CANDIDATE_PATH}`);
  await writeJsonAtomic(LOOKUP_PATH, entries);
  console.log(`Completed lookup written to ${LOOKUP_PATH}`);
} finally {
  translators.forEach((translator) => translator.close());
}
