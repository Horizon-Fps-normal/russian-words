import { execFileSync, spawn } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { makeMarkedBatch, parseMarkedTranslation } from "./lookup-gloss-utils.mjs";

const DB_PATH = process.env.ANKI_CORE5000_DB || process.argv[2];
const SQLITE_PATH = process.env.SQLITE3_PATH || "sqlite3";
const LOOKUP_PATH = "src/data/open-russian-lookup.json";
const OVERRIDES_PATH = "src/data/study-gloss-overrides.json";
const OUTPUT_PATH = "src/data/russian-core-5000.json";
const CACHE_PATH = "../codex_shit/anki-core5000-translation-cache.json";
const ENDPOINT = process.env.TRANSLATE_ENDPOINT || "https://clients5.google.com/translate_a/t";
const MAX_BATCH_CHARACTERS = Number(process.env.TRANSLATE_MAX_BATCH_CHARACTERS || 1200);
const REQUEST_DELAY_MS = Number(process.env.TRANSLATE_DELAY_MS || 250);
const WORKERS = Number(process.env.TRANSLATE_WORKERS || 3);

if (!DB_PATH) {
  throw new Error("Pass the extracted collection.anki21 path as the first argument or ANKI_CORE5000_DB");
}

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

function normalizeRussian(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300\u0301]/g, "")
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("ru-RU");
}

function wordCandidates(word) {
  const normalized = normalizeRussian(word);
  const output = [normalized, normalized.replace(/ё/g, "е")];
  for (const part of normalized.split(/\s*[,/]\s*/)) {
    output.push(part, part.replace(/ё/g, "е"));
  }
  return [...new Set(output.filter(Boolean))];
}

function levelForRank(rank) {
  if (rank <= 1000) return "A1";
  if (rank <= 2000) return "A2";
  if (rank <= 3500) return "B1";
  return "B2";
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
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (!message.ok) request.reject(new Error(`HTTP ${message.status || 0}: ${message.error || "translation failed"}`));
    else {
      try { request.resolve(JSON.parse(message.body)); }
      catch (error) { request.reject(error); }
    }
  });
  child.on("error", (error) => {
    closedError = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  });
  child.on("exit", (code) => {
    if (!closedError) closedError = new Error(`Translation helper exited with code ${code}`);
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

function translationUrl() {
  const url = new URL(ENDPOINT);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "zh-CN");
  url.searchParams.set("dt", "t");
  return url;
}

function responseText(payload) {
  if (Array.isArray(payload) && typeof payload[0] === "string") return payload.join("");
  if (!Array.isArray(payload?.[0])) throw new Error("Unexpected translation response shape");
  return payload[0].map((segment) => String(segment?.[0] || "")).join("");
}

function buildBatches(items) {
  const batches = [];
  let current = [];
  for (const item of items) {
    const candidate = [...current, item];
    if (current.length && makeMarkedBatch(candidate.map((entry) => entry.text)).length > MAX_BATCH_CHARACTERS) {
      batches.push(current);
      current = [item];
    } else current = candidate;
  }
  if (current.length) batches.push(current);
  return batches;
}

async function translateBatch(translator, batch) {
  const marked = makeMarkedBatch(batch.map((entry) => entry.text));
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const payload = await translator.request(translationUrl(), {
        method: "Post",
        timeoutSec: 90,
        body: { q: marked },
      });
      return parseMarkedTranslation(responseText(payload), batch.length);
    } catch (error) {
      lastError = error;
      await wait(500 * (2 ** attempt));
    }
  }
  throw lastError;
}

async function translateBatchResilient(translator, batch) {
  try {
    return await translateBatch(translator, batch);
  } catch (error) {
    if (batch.length === 1) {
      const url = translationUrl();
      url.searchParams.set("q", batch[0].text);
      const direct = responseText(await translator.request(url, { timeoutSec: 90 })).trim();
      if (!direct) throw new Error(`Blank direct translation for: ${batch[0].text}`);
      return [direct];
    }
    const middle = Math.ceil(batch.length / 2);
    const left = await translateBatchResilient(translator, batch.slice(0, middle));
    const right = await translateBatchResilient(translator, batch.slice(middle));
    return [...left, ...right];
  }
}

async function translateMissing(texts, cache) {
  const unique = [...new Set(texts.map((text) => String(text || "").trim()).filter(Boolean))];
  const missing = unique.filter((text) => !cache[text]).map((text) => ({ text }));
  const batches = buildBatches(missing);
  const translators = Array.from({ length: Math.max(1, WORKERS) }, () => createPowerShellTranslator());
  let cursor = 0;
  try {
    await Promise.all(translators.map(async (translator) => {
      while (cursor < batches.length) {
        const batchIndex = cursor++;
        const batch = batches[batchIndex];
        const translated = await translateBatchResilient(translator, batch);
        batch.forEach((item, index) => { cache[item.text] = translated[index]; });
        if (batchIndex % 10 === 0) await writeJsonAtomic(CACHE_PATH, cache);
        await wait(REQUEST_DELAY_MS);
      }
    }));
  } finally {
    translators.forEach((translator) => translator.close());
  }
  await writeJsonAtomic(CACHE_PATH, cache);
}

function cleanStudyMeaning(value) {
  const normalized = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/[|/]+/g, "；")
    .replace(/[;,，、]+/g, "；")
    .replace(/\s+/g, " ")
    .replace(/\s*；\s*/g, "；")
    .replace(/[。；\s]+$/g, "")
    .trim();
  const parts = normalized.split("；").map((part) => part.trim()).filter((part) => /\p{Script=Han}/u.test(part));
  const unique = [];
  for (const part of parts) {
    const concise = part.length > 14 ? part.slice(0, 14).replace(/[的地得于在和或与、，：；]+$/g, "") : part;
    if (concise && !unique.includes(concise)) unique.push(concise);
    if (unique.length === 3) break;
  }
  let result = unique.join("；");
  if (result.length > 32) result = result.slice(0, 32).replace(/[的地得于在和或与、，：；]+$/g, "");
  return result;
}

function chooseExistingMeaning(entry) {
  const meaning = cleanStudyMeaning(entry?.meaning);
  const trusted = String(entry?.source || "").includes("核心中文释义")
    || String(entry?.source || "").includes("manually reviewed")
    || String(entry?.source || "").includes("WikDict Russian-Chinese gloss");
  return trusted && meaning.length <= 32 ? meaning : "";
}

const sqliteOutput = execFileSync(SQLITE_PATH, [
  "-json", DB_PATH, "select flds from notes",
], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
const notes = JSON.parse(sqliteOutput).map(({ flds }) => {
  const fields = flds.split("\x1f");
  return {
    studyRank: Number(fields[0]),
    stressed: fields[1].trim(),
    word: normalizeRussian(fields[1]),
    meaningEn: fields[2].replace(/<br\s*\/?\s*>/gi, "; ").trim(),
  };
}).sort((a, b) => a.studyRank - b.studyRank);

if (notes.length !== 5000 || notes[0]?.studyRank !== 1 || notes[4999]?.studyRank !== 5000) {
  throw new Error(`Expected ranks 1-5000, received ${notes.length} notes`);
}

const [lookup, overrides, cache] = await Promise.all([
  readJson(LOOKUP_PATH, []),
  readJson(OVERRIDES_PATH, {}),
  readJson(CACHE_PATH, {}),
]);
const lookupByWord = new Map();
for (const entry of lookup) {
  for (const candidate of wordCandidates(entry.word)) {
    if (!lookupByWord.has(candidate)) lookupByWord.set(candidate, entry);
  }
}

const resolved = notes.map((note) => {
  const entry = wordCandidates(note.word).map((candidate) => lookupByWord.get(candidate)).find(Boolean);
  return { note, entry, existingMeaning: chooseExistingMeaning(entry) };
});
await translateMissing(resolved.filter(({ note, existingMeaning }) => !existingMeaning && !overrides[`${note.word}#${note.studyRank}`] && !overrides[note.word]).map(({ note }) => note.meaningEn), cache);

const usedIds = new Set();
const output = resolved.map(({ note, entry, existingMeaning }) => {
  const override = overrides[`${note.word}#${note.studyRank}`] || overrides[note.word];
  const translated = cleanStudyMeaning(cache[note.meaningEn]);
  const meaning = cleanStudyMeaning(override || existingMeaning || translated || entry?.meaning);
  if (!meaning) throw new Error(`Missing Chinese study meaning for #${note.studyRank} ${note.word}`);
  let id = entry?.id || `core5000-${note.studyRank}`;
  if (usedIds.has(id)) id = `core5000-${note.studyRank}`;
  usedIds.add(id);
  return {
    ...(entry || {}),
    id,
    word: note.word,
    stressed: note.stressed,
    meaning,
    meaningEn: note.meaningEn || entry?.meaningEn || "",
    level: levelForRank(note.studyRank),
    studyRank: note.studyRank,
    lookupWord: entry?.word || "",
    studyGlossSource: override ? "人工精简" : existingMeaning ? "现有短释义" : "Anki Core 5000 英译精简",
  };
});

await writeJsonAtomic(OUTPUT_PATH, output);
console.log(`Imported ${output.length} ranked study entries to ${OUTPUT_PATH}`);
