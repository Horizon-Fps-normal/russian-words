import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  BookOpenText,
  Books,
  ChartLineUp,
  Check,
  GearSix,
  House,
  MagnifyingGlass,
  Play,
  Plus,
  Repeat,
  SpeakerHigh,
  SquaresFour,
  CaretRight,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import {
  SCHEMA_VERSION,
  STORAGE_KEYS as CORE_STORAGE_KEYS,
  addWordForToday,
  buildDictionary as buildCoreDictionary,
  buildExampleWordIndex,
  buildReadingWordIndex,
  buildLearnQueue as buildCoreLearnQueue,
  buildReviewQueue as buildCoreReviewQueue,
  buildStudyPool as buildCoreStudyPool,
  completeSessionWord,
  createOptions,
  getHistoryDays as getCoreHistoryDays,
  getHistoryStats as getCoreHistoryStats,
  getTodayStats as getCoreTodayStats,
  hydrateSessionQueue,
  loadCoreState,
  normalizeAddedToday,
  normalizeRecord,
  normalizeSession,
  normalizeSettings,
  paginateItems,
  recordAnswer,
  removeRussianStress,
  resolveReadingWord,
  splitRussianText,
  createReadingSpeechController,
} from "./core/index.js";
import ReadingView from "./components/ReadingView.jsx";
import readingTexts from "./data/reading-texts.js";
import {
  background as platformBackground,
  haptics,
  isAndroid,
  speech as platformSpeech,
  storage as platformStorage,
  system,
} from "./platform/index.js";

const WORDS = [
  {
    id: "interesnyj",
    word: "интересный",
    stressed: "интересный",
    meaning: "有趣的",
    level: "A1",
    pos: "形容词",
    example: "Это очень интересная книга.",
    translation: "这是一本非常有趣的书。",
    collocations: ["интересный фильм", "интересная книга", "интересный человек"],
    forms: "интересный · интересная · интересное · интересные",
  },
  {
    id: "universitet",
    word: "университет",
    stressed: "университе́т",
    meaning: "大学",
    level: "A1",
    pos: "名词 · 阳性",
    example: "Я учусь в университете.",
    translation: "我在大学学习。",
    collocations: ["поступить в университет", "Московский университет", "учиться в университете"],
    forms: "университет · университета · университету · университетом",
  },
  {
    id: "druzja",
    word: "друзья",
    stressed: "друзья́",
    meaning: "朋友们",
    level: "A1",
    pos: "名词 · 复数",
    example: "Мои друзья живут рядом.",
    translation: "我的朋友们住在附近。",
    collocations: ["лучшие друзья", "встретиться с друзьями", "друзья детства"],
    forms: "друг · друга · другу · друзья · друзьями",
  },
  {
    id: "rabota",
    word: "работа",
    stressed: "рабо́та",
    meaning: "工作",
    level: "A1",
    pos: "名词 · 阴性",
    example: "Я иду на работу в восемь часов.",
    translation: "我八点去上班。",
    collocations: ["идти на работу", "искать работу", "работа дома"],
    forms: "работа · работы · работе · работу · работой",
  },
  {
    id: "nachinat",
    word: "начинать",
    stressed: "начина́ть",
    meaning: "开始",
    level: "A1",
    pos: "动词 · 不完成体",
    example: "Я начинаю учить русский язык каждый день.",
    translation: "我每天开始学习俄语。",
    collocations: ["начинать работу", "начинать учёбу", "начинать с нуля", "начинать разговор"],
    forms: "начинать · начинаю · начинаешь · начинают · начинал",
  },
  {
    id: "magazin",
    word: "магазин",
    stressed: "магази́н",
    meaning: "商店",
    level: "A1",
    pos: "名词 · 阳性",
    example: "Этот магазин открыт до десяти.",
    translation: "这家商店营业到十点。",
    collocations: ["продуктовый магазин", "зайти в магазин", "интернет-магазин"],
    forms: "магазин · магазина · магазину · магазином",
  },
  {
    id: "mashina",
    word: "машина",
    stressed: "маши́на",
    meaning: "汽车；机器",
    level: "A1",
    pos: "名词 · 阴性",
    example: "Моя машина стоит возле дома.",
    translation: "我的车停在房子旁边。",
    collocations: ["новая машина", "водить машину", "машина времени"],
    forms: "машина · машины · машине · машину · машиной",
  },
  {
    id: "moloko",
    word: "молоко",
    stressed: "молоко́",
    meaning: "牛奶",
    level: "A1",
    pos: "名词 · 中性",
    example: "Я пью кофе с молоком.",
    translation: "我喝加牛奶的咖啡。",
    collocations: ["свежее молоко", "стакан молока", "молочный продукт"],
    forms: "молоко · молока · молоку · молоком",
  },
  {
    id: "kvartira",
    word: "квартира",
    stressed: "кварти́ра",
    meaning: "公寓；住宅",
    level: "A1",
    pos: "名词 · 阴性",
    example: "Мы снимаем небольшую квартиру.",
    translation: "我们租了一套小公寓。",
    collocations: ["снимать квартиру", "новая квартира", "квартира в центре"],
    forms: "квартира · квартиры · квартире · квартиру · квартирой",
  },
  {
    id: "govorit",
    word: "говорить",
    stressed: "говори́ть",
    meaning: "说；讲",
    level: "A1",
    pos: "动词 · 未完成体",
    example: "Я немного говорю по-русски.",
    translation: "我会说一点俄语。",
    collocations: ["говорить по-русски", "говорить правду", "говорить громко"],
    forms: "говорить · говорю · говоришь · говорят · говорил",
  },
];

const COLLOCATION_MEANINGS = {
  interesnyj: ["有趣的电影", "有趣的书", "有趣的人"],
  universitet: ["考入大学", "莫斯科大学", "在大学学习"],
  druzja: ["最好的朋友", "与朋友见面", "童年朋友"],
  rabota: ["去上班", "找工作", "在家工作"],
  nachinat: ["开始工作", "开始学习", "从零开始", "开始谈话"],
  magazin: ["食品店", "去商店", "网上商店"],
  mashina: ["新车", "开车", "时光机"],
  moloko: ["新鲜牛奶", "一杯牛奶", "乳制品"],
  kvartira: ["租公寓", "新公寓", "市中心的公寓"],
  govorit: ["说俄语", "说实话", "大声说话"],
};

const FORM_MEANINGS = {
  interesnyj: ["有趣的（阳性）", "有趣的（阴性）", "有趣的（中性）", "有趣的（复数）"],
  universitet: ["大学", "大学的", "给大学", "与大学"],
  druzja: ["朋友", "朋友的", "给朋友", "朋友们", "和朋友们"],
  rabota: ["工作", "工作；工作的", "在工作上", "工作（宾格）", "用工作"],
  nachinat: ["开始", "我开始", "你开始", "他们开始", "他开始过"],
  magazin: ["商店", "商店的", "去商店", "与商店"],
  mashina: ["汽车", "汽车的；汽车们", "在车里；给汽车", "汽车（宾格）", "用汽车"],
  moloko: ["牛奶", "牛奶的", "给牛奶", "用牛奶"],
  kvartira: ["公寓", "公寓的；公寓们", "在公寓里；给公寓", "公寓（宾格）", "用公寓"],
  govorit: ["说；讲", "我说", "你说", "他们说", "他说过"],
};

function getFormItems(word) {
  return String(word.forms || "")
    .split(" · ")
    .map((form, index) => ({
      form,
      meaning: FORM_MEANINGS[word.id]?.[index] || word.meaning || "词形变化",
    }));
}

const NAV_ITEMS = [
  { id: "today", label: "今日学习", Icon: House },
  { id: "review", label: "复习单词", Icon: SquaresFour },
  { id: "reading", label: "阅读", Icon: BookOpenText },
  { id: "grammar", label: "俄语语法", Icon: Books },
  { id: "library", label: "词库", Icon: BookOpen },
  { id: "history", label: "学习记录", Icon: ChartLineUp },
  { id: "settings", label: "设置", Icon: GearSix },
];

const STUDY_PROGRESS_KEY = "russian-words-study-progress";
const STUDY_SETTINGS_KEY = "russian-words-settings";
const STUDY_RECORD_KEY = "russian-words-record";
const ADDED_TODAY_KEY = "russian-words-added-today";

const DEFAULT_SETTINGS = { dailyGoal: 20, speed: 1, speedProfileVersion: 2, listenEnabled: true };

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayKey() {
  return dateKey(new Date());
}

function getStoredJson(key, fallback) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || "null");
    return stored ?? fallback;
  } catch {
    return fallback;
  }
}

function getStoredSettings() {
  return normalizeSettings(getStoredJson(STUDY_SETTINGS_KEY, null));
}

function getStoredStudyProgress() {
  const stored = getStoredJson(STUDY_PROGRESS_KEY, {});
  const today = todayKey();
  const learnedToday = Object.values(getStoredRecord().words).filter((entry) => entry?.learnedAt === today).length;
  return {
    // 学习断点不能超过“今天实际学过 + 今天加入队列”的词数，防止旧进度/清空记录后会话跳词
    learn: Math.min(Math.max(0, Number(stored.learn) || 0), learnedToday + getStoredAddedToday().length),
    review: Math.max(0, Number(stored.review) || 0),
  };
}

function getStoredRecord() {
  return normalizeRecord(getStoredJson(STUDY_RECORD_KEY, null));
}

function getStoredAddedToday() {
  return normalizeAddedToday(getStoredJson(ADDED_TODAY_KEY, []), todayKey());
}

function cleanRussianText(text) {
  return removeRussianStress(text);
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const LEVEL_ORDER = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4 };
const REVIEW_STAGES = [1, 3, 7, 14, 30, 90];

// 学习池：本地词 + 有中文释义的参考词，按去重音后的词形去重（本地词优先），再按等级从低到高排序
function buildStudyPool(lookupWords, examples) {
  const byWord = new Map();
  for (const word of WORDS) byWord.set(cleanRussianText(word.word), word);
  for (const word of lookupWords || []) {
    if (!word.meaning) continue;
    const key = cleanRussianText(word.word);
    if (!byWord.has(key)) byWord.set(key, word);
  }
  const merged = [...byWord.values()];
  if (examples) {
    for (const word of merged) {
      const example = examples[word.word];
      if (example?.ru) word.example = example.ru;
      if (example?.zh) word.translation = example.zh;
    }
  }
  return merged.sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9));
}

// 词典：本地词 + 全部参考词，去重（本地词优先）
function buildDictionaryWords(lookupWords, examples) {
  const byWord = new Map();
  for (const word of WORDS) byWord.set(cleanRussianText(word.word), word);
  for (const word of lookupWords || []) {
    const key = cleanRussianText(word.word);
    if (!byWord.has(key)) byWord.set(key, word);
  }
  const merged = [...byWord.values()];
  if (examples) {
    for (const word of merged) {
      const example = examples[word.word];
      if (example?.ru && !word.example) word.example = example.ru;
      if (example?.zh && !word.translation) word.translation = example.zh;
    }
  }
  return merged;
}

// 词性分组键：把“名词 · 阳性”“动词 · 不完成体”归入「名词」「动词」大类
function posGroup(pos) {
  return String(pos || "其他").split(" · ")[0] || "其他";
}

// 释义按中文标点切分，用于判断两个词的释义是否有重叠
function meaningSegments(meaning) {
  return new Set(String(meaning || "").split(/[；;，,、\s]+/).filter(Boolean));
}

function meaningsOverlap(a, b) {
  const setA = meaningSegments(a);
  for (const segment of meaningSegments(b)) {
    if (setA.has(segment)) return true;
  }
  return false;
}

// 以当天日期为种子的伪随机数生成器：同一天内学习队列顺序稳定，断点续学不会因为重排而跳词
function daySeededRandom() {
  let seed = 2166136261;
  for (const char of todayKey()) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 今日学习队列：加入今日学习的词在前；其余未学词按等级升序，同一等级内按词性轮转取词，
// 每个词性桶内洗牌，并避免连续出现释义重叠的词——防止连排出现词性/意思相近的词（如虚词墙）
function buildLearnQueue(pool, record, addedToday) {
  const addedIds = new Set(addedToday);
  const added = addedToday.map((id) => pool.find((word) => word.id === id)).filter(Boolean);
  const unlearned = pool.filter((word) => !record.words[word.id]?.learnedAt && !addedIds.has(word.id));
  const rng = daySeededRandom();
  const levels = new Map();
  for (const word of unlearned) {
    const level = word.level || "其他";
    if (!levels.has(level)) levels.set(level, new Map());
    const posMap = levels.get(level);
    const group = posGroup(word.pos);
    if (!posMap.has(group)) posMap.set(group, []);
    posMap.get(group).push(word);
  }
  for (const [, posMap] of levels) {
    for (const bucket of posMap.values()) {
      for (let i = bucket.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
      }
    }
  }
  const queue = [];
  let lastMeaning = null;
  for (const [, posMap] of levels) {
    const groups = [...posMap.keys()];
    const cursors = new Map(groups.map((group) => [group, 0]));
    let remaining = [...posMap.values()].reduce((sum, bucket) => sum + bucket.length, 0);
    while (remaining > 0) {
      for (const group of groups) {
        const bucket = posMap.get(group);
        if (cursors.get(group) >= bucket.length) continue;
        // 优先挑一个与上一个词释义不重叠的词，没有则取桶内下一个
        let pickIndex = cursors.get(group);
        if (lastMeaning) {
          const overlapFree = bucket.slice(cursors.get(group)).findIndex((word) => !meaningsOverlap(word.meaning, lastMeaning));
          if (overlapFree >= 0) pickIndex = cursors.get(group) + overlapFree;
        }
        const picked = bucket[pickIndex];
        [bucket[cursors.get(group)], bucket[pickIndex]] = [bucket[pickIndex], bucket[cursors.get(group)]];
        cursors.set(group, cursors.get(group) + 1);
        remaining -= 1;
        lastMeaning = picked.meaning;
        queue.push(picked);
      }
    }
  }
  return [...added, ...queue];
}

// 复习队列：间隔重复——到期的词优先（按到期日排序）；没有到期词时回退到全部已学词（最久未复习的在前）
function buildReviewQueue(pool, record) {
  const today = todayKey();
  const learned = pool
    .filter((word) => record.words[word.id]?.learnedAt)
    .map((word) => {
      const entry = record.words[word.id];
      const interval = REVIEW_STAGES[Math.min(entry.reviewStage || 0, REVIEW_STAGES.length - 1)];
      const last = new Date(`${entry.lastSeen || entry.learnedAt}T00:00:00`);
      return { word, due: dateKey(new Date(last.getTime() + interval * 86400000)) };
    });
  const dueWords = learned.filter(({ due }) => due <= today).map(({ word }) => word);
  if (dueWords.length) return dueWords;
  return learned.sort((a, b) => a.due.localeCompare(b.due)).map(({ word }) => word);
}

function getTodayStats(pool, record) {
  const today = todayKey();
  const learnedToday = pool.filter((word) => record.words[word.id]?.learnedAt === today).length;
  const dueWords = pool
    .filter((word) => record.words[word.id]?.learnedAt && record.words[word.id]?.learnedAt !== today)
    .sort((a, b) =>
      (record.words[a.id].lastSeen || record.words[a.id].learnedAt || "").localeCompare(
        record.words[b.id].lastSeen || record.words[b.id].learnedAt || "",
      ),
    );
  return { learnedToday, dueWords };
}

function getHistoryStats(pool, record) {
  const learnedCount = pool.filter((word) => record.words[word.id]?.learnedAt).length;
  const activeDates = new Set();
  for (const word of pool) {
    const entry = record.words[word.id];
    if (entry?.learnedAt) activeDates.add(entry.learnedAt);
    if (entry?.lastSeen) activeDates.add(entry.lastSeen);
  }
  let streak = 0;
  const cursor = new Date();
  if (!activeDates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (activeDates.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  let attempts = 0;
  let correct = 0;
  for (const word of pool) {
    const entry = record.words[word.id];
    if (entry) {
      attempts += entry.attempts || 0;
      correct += entry.correct || 0;
    }
  }
  return {
    learnedCount,
    streak,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : null,
  };
}

function getHistoryDays(pool, record) {
  const byDate = new Map();
  for (const word of pool) {
    const date = record.words[word.id]?.learnedAt;
    if (date) byDate.set(date, (byDate.get(date) || 0) + 1);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 5)
    .map(([date, count]) => ({ date, count }));
}

function formatHistoryDay(dateKey) {
  const today = todayKey();
  if (dateKey === today) return "今天";
  const date = new Date(`${dateKey}T00:00:00`);
  const diff = Math.round((new Date(`${today}T00:00:00`) - date) / 86400000);
  if (diff === 1) return "昨天";
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function relativeDay(dateKey) {
  if (!dateKey) return "未学习";
  const today = todayKey();
  if (dateKey === today) return "今天";
  const date = new Date(`${dateKey}T00:00:00`);
  const diff = Math.round((new Date(`${today}T00:00:00`) - date) / 86400000);
  if (diff === 1) return "昨天";
  return `${diff} 天前`;
}

let activeAudio = null;
let activeAudioFinish = null;
let activeBrowserFinish = null;
let speechRequestSerial = 0;

function stopActiveAudio() {
  if (!activeAudio) return;
  const audio = activeAudio;
  const finish = activeAudioFinish;
  activeAudio = null;
  activeAudioFinish = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  finish?.(false);
}

function stopBrowserSpeech() {
  const finish = activeBrowserFinish;
  activeBrowserFinish = null;
  window.speechSynthesis?.cancel();
  finish?.(false);
}

function playAudioUrl(url, requestId) {
  if (requestId !== speechRequestSerial) return Promise.resolve(false);
  stopActiveAudio();
  const audio = new Audio(url);
  activeAudio = audio;
  audio.volume = 1;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (played) => {
      if (settled) return;
      settled = true;
      if (activeAudio === audio) {
        activeAudio = null;
        activeAudioFinish = null;
      }
      resolve(Boolean(played && requestId === speechRequestSerial));
    };
    activeAudioFinish = finish;
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio.play().catch(() => finish(false));
  });
}

async function playGeneratedAudio(audioBase64, requestId) {
  if (!audioBase64) return false;
  return playAudioUrl(`data:audio/mpeg;base64,${audioBase64}`, requestId);
}

function getBrowserVoices() {
  const synth = window.speechSynthesis;
  const current = synth.getVoices();
  if (current.length) return Promise.resolve(current);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", finish);
    window.setTimeout(finish, 1200);
  });
}

async function speakWithBrowser(text, speed = 1, requestId = speechRequestSerial) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  const voices = await getBrowserVoices();
  if (requestId !== speechRequestSerial) return false;
  const russianVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith("ru"));
  const russianVoice = russianVoices.find((voice) => /svetlana|dariya|irina|alena|milena|katya|tatyana/i.test(voice.name))
    || russianVoices.find((voice) => !/dmitry|maxim|pavel|alexander|yuri/i.test(voice.name))
    || russianVoices[0];
  if (!russianVoice) return false;
  stopBrowserSpeech();
  const utterance = new SpeechSynthesisUtterance(cleanRussianText(text));
  utterance.voice = russianVoice;
  utterance.lang = "ru-RU";
  utterance.rate = Math.max(0.7, Math.min(1.3, speed));
  utterance.pitch = 1;
  utterance.volume = 1;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (played) => {
      if (settled) return;
      settled = true;
      if (activeBrowserFinish === finish) activeBrowserFinish = null;
      resolve(Boolean(played && requestId === speechRequestSerial));
    };
    activeBrowserFinish = finish;
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    synth.speak(utterance);
  });
}

async function stopRussianSpeech() {
  speechRequestSerial += 1;
  stopActiveAudio();
  stopBrowserSpeech();
  try {
    await platformSpeech.stop();
  } catch {
    // Cancellation remains best-effort while a native provider is starting.
  }
}

async function speakRussian(text, speed = 1) {
  const cleanText = cleanRussianText(text);
  const requestId = ++speechRequestSerial;
  stopActiveAudio();
  stopBrowserSpeech();
  try {
    await platformSpeech.stop();
  } catch {
    // Stopping is best-effort on devices whose TTS engine is still starting.
  }
  if (requestId !== speechRequestSerial) return false;
  try {
    if (isAndroid) {
      const played = await platformSpeech.speakRussian(cleanText, speed);
      if (requestId !== speechRequestSerial) return false;
      if (played) return true;
    }
    if (window.desktopApp?.speakRussian) {
      const result = await window.desktopApp.speakRussian(cleanText, speed);
      if (requestId !== speechRequestSerial || result?.provider === "cancelled") return false;
      if (result?.audioBase64) {
        return playGeneratedAudio(result.audioBase64, requestId);
      }
      if (result?.provider === "windows") return true;
    }
  } catch {
    // Fall back to the browser voice if Windows has no Russian voice installed.
  }
  if (requestId !== speechRequestSerial) return false;
  const played = await speakWithBrowser(cleanText, speed, requestId);
  if (requestId !== speechRequestSerial) return false;
  if (!played) window.dispatchEvent(new Event("russian-tts-unavailable"));
  return played;
}

function Nav({ active, onChange, goal }) {
  const mobileItems = [
    { id: "today", label: "今日", Icon: House },
    { id: "library", label: "词库", Icon: BookOpen },
    { id: "reading", label: "阅读", Icon: BookOpenText },
    { id: "grammar", label: "语法", Icon: Books },
    { id: "profile", label: "我的", Icon: UserCircle },
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">RU</span>
        <div>
          <strong>俄语词库</strong>
          <span>给中文使用者</span>
        </div>
      </div>
      <nav className="nav-list desktop-nav" aria-label="主导航">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button className={`nav-item ${active === id ? "active" : ""}`} key={id} onClick={() => onChange(id)}>
            <Icon size={21} weight={active === id ? "fill" : "regular"} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <nav className="nav-list mobile-nav" aria-label="底部导航">
        {mobileItems.map(({ id, label, Icon }) => (
          <button className={`nav-item ${active === id ? "active" : ""}`} key={id} onClick={() => onChange(id)}>
            <Icon size={23} weight={active === id ? "fill" : "regular"} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footnote">A1 – C1 · 每天 {goal} 词</div>
    </aside>
  );
}

function AudioButton({ word, compact = false, text, className = "", speed = 1 }) {
  const spokenText = text || word?.stressed || "";
  const label = text || word?.word || "俄语内容";
  return (
    <button
      className={`audio-button ${compact ? "compact" : ""} ${className}`.trim()}
      onClick={(event) => {
        event.stopPropagation();
        void speakRussian(spokenText, speed);
      }}
      aria-label={`播放 ${label} 发音`}
    >
      <SpeakerHigh size={compact ? 17 : 21} weight="regular" />
    </button>
  );
}

const CLOSE_EXAMPLE_POPOVER_EVENT = "russian-words:close-example-popover";
const EXAMPLE_POPOVER_BACK_GUARD_MS = 300;
let lastExamplePopoverCloseAt = Number.NEGATIVE_INFINITY;

function markExamplePopoverClosed() {
  lastExamplePopoverCloseAt = Date.now();
}

function wasExamplePopoverJustClosed() {
  return Date.now() - lastExamplePopoverCloseAt < EXAMPLE_POPOVER_BACK_GUARD_MS;
}

function InteractiveExample({ text, wordIndex, speed = 1, className = "" }) {
  const [selected, setSelected] = useState(null);
  const rootRef = useRef(null);
  const parts = useMemo(() => splitRussianText(text), [text]);

  useEffect(() => {
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setSelected(null);
    };
    const closeOnViewportChange = () => setSelected(null);
    const closeFromBackIntent = () => setSelected(null);
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener(CLOSE_EXAMPLE_POPOVER_EVENT, closeFromBackIntent);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener(CLOSE_EXAMPLE_POPOVER_EVENT, closeFromBackIntent);
    };
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      markExamplePopoverClosed();
      setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [selected]);

  const selectWord = (event, token, partIndex) => {
    if (selected?.partIndex === partIndex) {
      setSelected(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(310, window.innerWidth - 32);
    const half = width / 2;
    const left = Math.min(Math.max(rect.left + rect.width / 2, half + 16), window.innerWidth - half - 16);
    const top = rect.bottom + 176 < window.innerHeight ? rect.bottom + 10 : Math.max(12, rect.top - 166);
    const entry = wordIndex?.get(cleanRussianText(token).toLocaleLowerCase("ru-RU")) || null;
    setSelected({ partIndex, token, entry, left, top, width });
  };

  const selectedEntry = selected?.entry;
  const lemmaDiffers = selectedEntry && cleanRussianText(selected.token).toLocaleLowerCase("ru-RU") !== cleanRussianText(selectedEntry.word).toLocaleLowerCase("ru-RU");
  return (
    <span className={`interactive-example ${className}`.trim()} ref={rootRef}>
      {parts.map((part, partIndex) => part.isRussian ? (
        <button
          type="button"
          className={`example-token ${wordIndex?.has(cleanRussianText(part.text).toLocaleLowerCase("ru-RU")) ? "has-gloss" : ""}`}
          key={`${part.text}-${partIndex}`}
          onClick={(event) => selectWord(event, part.text, partIndex)}
          aria-expanded={selected?.partIndex === partIndex}
          aria-label={`${part.text}，单击查看释义`}
        >{part.text}</button>
      ) : <span key={`${part.text}-${partIndex}`}>{part.text}</span>)}
      {selected && (
        <span className="example-word-popover" role="dialog" aria-label={`${selected.token} 的释义`} style={{ left: selected.left, top: selected.top, width: selected.width }}>
          <span className="example-popover-head"><strong>{selected.token}</strong><button type="button" onClick={() => setSelected(null)} aria-label="关闭释义">×</button></span>
          {lemmaDiffers && <span className="example-lemma">原形：{selectedEntry.stressed || selectedEntry.word}</span>}
          <span className="example-gloss">{selectedEntry?.meaning || (selectedEntry?.meaningEn ? `英译参考：${selectedEntry.meaningEn}` : "该词形暂未收录释义")}</span>
          <span className="example-popover-meta">{[selectedEntry?.level, selectedEntry?.pos].filter(Boolean).join(" · ") || "本地词典"}</span>
          <AudioButton text={selected.token} compact speed={speed} className="example-popover-audio" />
        </span>
      )}
    </span>
  );
}

function TodayView({ learnedToday, goal, dueWords, record, settings, onStart, onStartReview, onSelectWord }) {
  const complete = learnedToday >= goal;
  const percent = goal > 0 ? Math.min((learnedToday / goal) * 100, 100) : 0;
  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <h1>上午好！</h1>
          <p>坚持每天学习，积累俄语词汇。</p>
        </div>
        <span className="level-pill">A1 初学者</span>
      </header>
      <section className="progress-block">
        <div className="progress-copy">
          <span className="eyebrow">今日学习进度</span>
          <div className="progress-number"><strong>{Math.min(learnedToday, goal)}</strong><span>/ {goal}</span><em>{complete ? "已完成今日目标" : "已学单词"}</em></div>
        </div>
        <div className="progress-action"><button className="primary-button" onClick={onStart}>{complete ? "继续学习" : "开始学习"}</button></div>
        <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
        <span className="progress-percent">{complete ? `今日目标已完成，已学 ${learnedToday} 词，可继续学习` : `${Math.round(percent)}% 完成`}</span>
      </section>
      <section className="due-section">
        <div className="section-heading"><h2>待复习单词（{dueWords.length}）</h2><button className="text-button" onClick={onStartReview}>进入复习 <span>→</span></button></div>
        <div className="word-list">
          <div className="list-header"><span>单词</span><span>中文释义</span><span>上次学习</span></div>
          {dueWords.slice(0, 5).map((word) => (
            <div className="word-row" role="button" tabIndex={0} key={word.id} onClick={() => onSelectWord(word)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectWord(word); } }}>
              <span className="word-name">{word.stressed}<AudioButton word={word} compact speed={settings.speed} /></span>
              <span>{word.meaning}</span>
              <span className="last-studied">{relativeDay(record.words[word.id]?.lastSeen || record.words[word.id]?.learnedAt)}</span>
            </div>
          ))}
          {!dueWords.length && <div className="empty-state">今天没有待复习的单词，先学习新词吧。</div>}
        </div>
      </section>
    </div>
  );
}

function StudyDetailView({ word, mode, sessionType, index, total, selectedAnswer, correctAnswer, speed, grammar, exampleWordIndex, onContinue, onBack }) {
  const isCorrect = selectedAnswer === correctAnswer;
  const formItems = getFormItems(word);
  const grammarEntry = grammar?.[word.word];
  const progress = ((index + 1) / total) * 100;
  const sessionLabel = sessionType === "learn" ? "新词学习" : sessionType === "practice" ? "单词练习" : "复习单词";
  return (
    <div className="review-page study-detail-page">
      <div className="review-topline"><button className="back-button" onClick={onBack}>← 退出学习</button><span>{`第 ${index + 1} 题 / 共 ${total} 题`}</span><span>{`进度 ${Math.round(progress)}%`}</span></div>
      <div className="review-track"><span style={{ width: `${progress}%` }} /></div>
      <div className="study-detail-shell">
        <div className={`study-result ${isCorrect ? "success" : "error"}`}><strong>{isCorrect ? "答对了" : "再看一遍这个词"}</strong>{!isCorrect && <span>{`你的选择：${selectedAnswer} · 正确答案：${correctAnswer}`}</span>}</div>
        <div className="detail-top study-detail-top"><div><span className="eyebrow">{sessionLabel} · {word.level} · {word.pos}</span><div className="detail-word-line"><h1>{word.stressed}</h1><AudioButton word={word} speed={speed} /></div><div className="detail-meaning">{word.meaning}</div></div></div>
        {word.example ? <div className="detail-section"><h2>例句</h2><div className="example-russian example-audio-line"><InteractiveExample text={word.example} wordIndex={exampleWordIndex} speed={speed} /><AudioButton text={word.example} compact speed={speed} /></div><p className="example-chinese">{word.translation}</p></div> : null}
        {word.collocations?.length ? <div className="detail-section"><h2>常见搭配</h2><div className="collocations">{word.collocations.map((item, itemIndex) => <div key={item}><div className="detail-russian-line"><InteractiveExample text={item} wordIndex={exampleWordIndex} speed={speed} className="collocation-russian" /><AudioButton text={item} compact speed={speed} /></div><small>{COLLOCATION_MEANINGS[word.id]?.[itemIndex] || word.meaning}</small></div>)}</div></div> : null}
        {grammarEntry?.declension || grammarEntry?.conjugation ? <div className="detail-section"><h2>词形变化</h2><WordGrammarBlock word={word} grammar={grammar} speed={speed} /></div> : (formItems.length > 1 ? <div className="detail-section"><h2>词形变化</h2><div className="forms-list">{formItems.map(({ form, meaning }) => <div key={form}><div className="detail-russian-line"><strong>{form}</strong><AudioButton text={form} compact speed={speed} /></div><small>{meaning}</small></div>)}</div></div> : null)}
        <div className="detail-footer">
          <button className="primary-button" onClick={onContinue}>{isCorrect ? (index >= total - 1 ? (sessionType === "practice" ? "完成练习" : "完成今日学习") : "下一题") : "返回题目重新选择"} →</button>
        </div>
      </div>
    </div>
  );
}

function ReviewView({ queue, pool, settings, grammar, exampleWordIndex, sessionType, initialIndex = 0, onAnswer, onDone, onBack }) {
  // 会话开始时的词表快照，避免词库懒加载完成后队列变化导致题目跳词
  const [sessionWords] = useState(queue);
  const [index, setIndex] = useState(() => Math.min(initialIndex, Math.max(sessionWords.length - 1, 0)));
  const [mode, setMode] = useState("meaning");
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const answerLocked = useRef(false);
  const total = sessionWords.length;
  const activeWord = sessionWords[index];
  const correct = mode === "meaning" ? activeWord?.meaning : activeWord?.word;

  const options = useMemo(() => {
    return createOptions(activeWord, pool, mode);
  }, [activeWord, mode, pool]);

  const choose = (answer) => {
    if (answerLocked.current || selected !== null || !activeWord) return;
    answerLocked.current = true;
    const isCorrect = answer === correct;
    setSelected(answer);
    onAnswer?.(activeWord, sessionType, isCorrect, index + 1);
    void (isCorrect ? haptics.success() : haptics.error());
    setShowDetail(true);
  };
  const next = () => {
    if (index >= total - 1) {
      onDone(total);
      return;
    }
    answerLocked.current = false;
    setIndex((current) => current + 1);
    setSelected(null);
    setShowDetail(false);
  };
  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    answerLocked.current = false;
    setMode(nextMode);
    setSelected(null);
    setShowDetail(false);
  };

  if (!total) {
    return (
      <div className="review-page">
        <div className="review-topline"><button className="back-button" onClick={onBack}>← 返回</button></div>
        <div className="quiz-shell empty-queue">
          <h1>太棒了！</h1>
          <p>{sessionType === "learn" ? "所有单词都已经学习过了，去复习巩固吧。" : "暂时没有可复习的单词。"}</p>
          <button className="primary-button" onClick={onBack}>返回首页</button>
        </div>
      </div>
    );
  }

  if (showDetail) {
    return <StudyDetailView word={activeWord} mode={mode} sessionType={sessionType} index={index} total={total} selectedAnswer={selected} correctAnswer={correct} speed={settings.speed} grammar={grammar} exampleWordIndex={exampleWordIndex} onContinue={selected === correct ? next : () => { answerLocked.current = false; setSelected(null); setShowDetail(false); }} onBack={onBack} />;
  }

  const progress = (index / total) * 100;
  return (
    <div className="review-page">
      <div className="review-topline"><button className="back-button" onClick={onBack}>← 退出学习</button><span>{`第 ${index + 1} 题 / 共 ${total} 题`}</span><span>{`进度 ${Math.round(progress)}%`}</span></div>
      <div className="review-track"><span style={{ width: `${progress}%` }} /></div>
      <div className="quiz-mode-switch">
        <button className={mode === "meaning" ? "active" : ""} onClick={() => switchMode("meaning")}>俄语选中文</button>
        {settings.listenEnabled && <button className={mode === "listen" ? "active" : ""} onClick={() => switchMode("listen")}>听音选俄语</button>}
      </div>
      <div className="quiz-shell">
        {mode === "meaning" ? (
          <div className="study-word-card">
            <div className="study-word">{activeWord.stressed}</div>
            <div className="study-word-meta">{activeWord.level} · {activeWord.pos}</div>
            <AudioButton word={activeWord} speed={settings.speed} />
          </div>
        ) : (
          <>
            <button className="listen-main" onClick={() => void speakRussian(activeWord.stressed, settings.speed)} aria-label="播放俄语发音"><Play size={28} weight="fill" /></button>
            <button className="replay-button" onClick={() => void speakRussian(activeWord.stressed, settings.speed)}><Repeat size={18} /> 再听一次</button>
          </>
        )}
        <div className={`answer-grid ${mode === "meaning" ? "meaning-options" : ""}`}>
          {options.map((option, optionIndex) => {
            const state = selected ? (option === correct ? "correct" : option === selected ? "wrong" : "muted") : "";
            return <button key={`${option}-${optionIndex}`} className={`answer-option ${state}`} onClick={() => choose(option)}><span>{String.fromCharCode(65 + optionIndex)}.</span><strong>{option}</strong>{option === correct && selected ? <Check size={21} weight="bold" /> : option === selected && selected !== correct ? <X size={21} weight="bold" /> : null}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

const LIBRARY_PAGE_SIZE = 60;

function LibraryView({ dictionaryWords, loading, settings, onSelectWord }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("全部");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const searchInput = useRef(null);
  const libraryList = useRef(null);
  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dictionaryWords.filter((word) => {
      const searchable = `${word.word} ${word.stressed} ${word.meaning} ${word.meaningEn} ${word.level}`.toLowerCase();
      return (level === "全部" || word.level === level) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [level, query, dictionaryWords]);
  const pagination = useMemo(() => paginateItems(filtered, page, LIBRARY_PAGE_SIZE), [filtered, page]);
  const visibleWords = pagination.items;
  const currentPage = pagination.page;
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
    setPageInput(String(currentPage));
  }, [currentPage, page]);
  const resetToFirstPage = () => {
    setPage(1);
    setPageInput("1");
  };
  const goToPage = (requestedPage) => {
    const parsed = Number.parseInt(requestedPage, 10);
    const nextPage = paginateItems(filtered, Number.isFinite(parsed) ? parsed : currentPage, LIBRARY_PAGE_SIZE).page;
    setPage(nextPage);
    setPageInput(String(nextPage));
    if (nextPage !== currentPage) requestAnimationFrame(() => libraryList.current?.scrollIntoView({ block: "start" }));
  };
  const levels = ["全部", "A1", "A2", "B1", "B2"];
  return (
    <div className="page-content library-page">
      <header className="library-heading"><div><span className="eyebrow">词典</span><h1>查找俄语单词</h1></div><span className="dictionary-source-note">OpenRussian · WikDict · Wiktionary · CC BY-SA</span></header>
      <label className="search-box"><MagnifyingGlass size={22} /><input ref={searchInput} value={query} onChange={(event) => { setQuery(event.target.value); resetToFirstPage(); }} placeholder="搜索俄语单词或中文释义" /><kbd>Ctrl K</kbd></label>
      <div className="library-meta"><span>{loading ? "词库加载中…" : `${pagination.totalItems} 个词条 · 第 ${currentPage} / ${pagination.totalPages} 页`}</span><div>{levels.map((item) => <button key={item} className={`filter-chip ${level === item ? "active" : ""}`} onClick={() => { setLevel(item); resetToFirstPage(); }}>{item}</button>)}</div></div>
      <div className="library-list" ref={libraryList}>
        {visibleWords.map((word) => <div className="library-row" role="button" tabIndex={0} key={word.id} onClick={() => onSelectWord(word)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectWord(word); } }}><span className="library-word">{word.stressed}<AudioButton word={word} compact speed={settings.speed} /></span><span>{word.meaning || (word.meaningEn ? `英译参考：${word.meaningEn}` : "中文释义待补充")}</span><span className="level-tag">{word.level}</span><span className="library-arrow">→</span></div>)}
        {!filtered.length && !loading && <div className="empty-state">没有找到匹配的单词。</div>}
      </div>
      {pagination.totalItems > 0 && <nav className="library-pagination" aria-label="词库分页">
        <button type="button" className="pagination-button" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>← 上一页</button>
        <label className="pagination-jump"><span>第</span><input type="number" min="1" max={pagination.totalPages} inputMode="numeric" value={pageInput} onChange={(event) => setPageInput(event.target.value)} onBlur={() => goToPage(pageInput)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); goToPage(pageInput); event.currentTarget.blur(); } }} aria-label="跳转页码" /><span>/ {pagination.totalPages} 页</span><small>{pagination.start + 1}–{pagination.end} / {pagination.totalItems}</small></label>
        <button type="button" className="pagination-button" disabled={currentPage === pagination.totalPages} onClick={() => goToPage(currentPage + 1)}>下一页 →</button>
      </nav>}
    </div>
  );
}

function WordDetail({ word, onBack, onPractice, onAddToday, added, learnedToday, grammar, exampleWordIndex, settings }) {
  const hasLearningData = Boolean(word.meaning);
  const grammarEntry = grammar?.[word.word];
  return (
    <div className="page-content detail-page">
      <button className="back-button detail-back" onClick={onBack}>← 返回词库</button>
      <div className="detail-top"><div><span className="eyebrow">{word.level} · {word.pos}</span><div className="detail-word-line"><h1>{word.stressed}</h1><AudioButton word={word} speed={settings.speed} /></div><div className="detail-meaning">{word.meaning || "中文释义待补充"}</div>{!word.meaning && word.meaningEn && <p className="reference-meaning">英译参考：{word.meaningEn}</p>}</div></div>
      <div className="detail-section"><h2>例句</h2>{word.example ? <><div className="example-russian example-audio-line"><InteractiveExample text={word.example} wordIndex={exampleWordIndex} speed={settings.speed} /><AudioButton text={word.example} compact speed={settings.speed} /></div><p className="example-chinese">{word.translation}</p></> : <p className="empty-detail">暂无例句。</p>}</div>
      <div className="detail-section"><h2>常见搭配</h2>{word.collocations.length ? <div className="collocations">{word.collocations.map((item, index) => <div key={item}><div className="detail-russian-line"><InteractiveExample text={item} wordIndex={exampleWordIndex} speed={settings.speed} className="collocation-russian" /><AudioButton text={item} compact speed={settings.speed} /></div><small>{COLLOCATION_MEANINGS[word.id]?.[index] || word.meaning}</small></div>)}</div> : <p className="empty-detail">暂无常见搭配。</p>}</div>
      <div className="detail-section"><h2>词形变化</h2>{grammarEntry?.declension || grammarEntry?.conjugation ? <WordGrammarBlock word={word} grammar={grammar} speed={settings.speed} /> : (getFormItems(word).length > 1 ? <div className="forms-list">{getFormItems(word).map(({ form, meaning }) => <div key={form}><div className="detail-russian-line"><strong>{form}</strong><AudioButton text={form} compact speed={settings.speed} /></div><small>{meaning}</small></div>)}</div> : <p className="empty-detail">暂无词形变化。</p>)}</div>
      <div className="detail-footer">{hasLearningData ? <>{learnedToday ? <button className="primary-button add-button added" disabled><Check size={20} /> 今日已学习</button> : <button className={`primary-button add-button ${added ? "added" : ""}`} onClick={onAddToday}>{added ? <Check size={20} /> : <Plus size={20} />} {added ? "已加入今日学习" : "加入今日学习"}</button>}<button className="secondary-button" onClick={onPractice}>立即练习</button></> : <span className="detail-note">补充中文释义后即可加入学习。</span>}</div>
    </div>
  );
}

const GRAMMAR_TABS = [
  { id: "nouns", label: "名词的格" },
  { id: "adjectives", label: "形容词变格" },
  { id: "verbs", label: "动词变位" },
  { id: "lookup", label: "查词变形" },
];

const CASE_INFO = [
  { en: "nominative", ru: "именительный", zh: "主格", use: "主语、表语", ask: "кто? что?" },
  { en: "genitive", ru: "родительный", zh: "属格", use: "所属、否定、数量、部分", ask: "кого? чего?" },
  { en: "dative", ru: "дательный", zh: "与格", use: "间接宾语（给谁）", ask: "кому? чему?" },
  { en: "accusative", ru: "винительный", zh: "宾格", use: "直接宾语（动作对象）", ask: "кого? что?" },
  { en: "instrumental", ru: "творительный", zh: "工具格", use: "工具、方式、共同行为", ask: "кем? чем?" },
  { en: "prepositional", ru: "предложный", zh: "前置格", use: "与前置词连用（谈论、地点）", ask: "о ком? о чём?" },
];

const DECLENSION_COLUMNS = {
  singular: "单数",
  plural: "复数",
  masculine: "阳性",
  feminine: "阴性",
  neuter: "中性",
};

const CONJ_PERSONS = ["я", "ты", "он/она́/оно́", "мы", "вы", "они́"];
const PAST_LABELS = { masculine: "阳性", feminine: "阴性", neuter: "中性", plural: "复数" };

function caseInfo(en) {
  return CASE_INFO.find((item) => item.en === en) || { en, zh: en, use: "", ask: "" };
}

function findParadigm(grammar, type, preferred) {
  for (const word of preferred) {
    const entry = grammar?.[word];
    if (entry && (type === "conjugation" ? entry.conjugation : entry.declension)) {
      return { word, data: type === "conjugation" ? entry.conjugation : entry.declension };
    }
  }
  const first = Object.keys(grammar || {}).find((word) => {
    const entry = grammar[word];
    return type === "conjugation" ? entry.conjugation : entry.declension;
  });
  return first ? { word: first, data: type === "conjugation" ? grammar[first].conjugation : grammar[first].declension } : null;
}

function DeclensionTable({ declension, speed, examples }) {
  return (
    <table className="grammar-table">
      <thead>
        <tr><th>格</th>{declension.columns.map((column) => <th key={column}>{DECLENSION_COLUMNS[column] || column}</th>)}</tr>
      </thead>
      <tbody>
        {declension.rows.map((row) => {
          const info = caseInfo(row.case);
          const example = examples?.[row.case];
          return (
            <tr key={row.case}>
              <th className="grammar-case-name">{info.zh}<small>{info.ru}</small>
                {example ? <span className="grammar-example"><span className="grammar-example-ru">{example.ru}</span><AudioButton text={example.ru} compact speed={speed} /><span className="grammar-example-zh">{example.zh}</span></span> : null}
              </th>
              {row.cells.map((cell, cellIndex) => <td key={cellIndex}><span className="grammar-form">{cell}</span><AudioButton text={cell} compact speed={speed} /></td>)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ConjugationTable({ conjugation, speed, personExamples }) {
  const hasPresent = Object.keys(conjugation.present || {}).length > 0;
  const hasFuture = Object.keys(conjugation.future || {}).length > 0;
  const hasPast = Object.keys(conjugation.past || {}).length > 0;
  const hasImperative = Object.keys(conjugation.imperative || {}).length > 0;
  const presentTitle = hasPresent && hasFuture ? "现在时 / 将来时" : hasPresent ? "现在时" : "将来时";
  const renderFormCell = (form, person, section) => {
    const example = personExamples?.[section ? `${section}:${person}` : person];
    return (
      <td>
        <span className="grammar-form">{form}</span><AudioButton text={form} compact speed={speed} />
        {example ? <span className="grammar-example"><span className="grammar-example-ru">{example.ru}</span><AudioButton text={example.ru} compact speed={speed} /><span className="grammar-example-zh">{example.zh}</span></span> : null}
      </td>
    );
  };
  return (
    <div className="conjugation-blocks">
      {hasPresent || hasFuture ? (
        <div className="conjugation-block">
          <h4>{presentTitle}</h4>
          <table className="grammar-table">
            <tbody>
              {CONJ_PERSONS.map((person) => (
                <tr key={person}>
                  <th className="grammar-person">{person}</th>
                  {hasPresent ? renderFormCell(conjugation.present[person] || "—", person) : null}
                  {hasFuture && hasPresent ? renderFormCell(conjugation.future[person] || "—", person) : null}
                  {hasFuture && !hasPresent ? renderFormCell(conjugation.future[person] || "—", person) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {hasPast ? (
        <div className="conjugation-block">
          <h4>过去时</h4>
          <table className="grammar-table">
            <tbody>
              {Object.entries(conjugation.past).map(([gender, form]) => (
                <tr key={gender}><th className="grammar-person">{PAST_LABELS[gender] || gender}</th>{renderFormCell(form, gender)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {hasImperative ? (
        <div className="conjugation-block">
          <h4>命令式</h4>
          <table className="grammar-table">
            <tbody>
              {Object.entries(conjugation.imperative).map(([person, form]) => (
                <tr key={person}><th className="grammar-person">{person}</th>{renderFormCell(form, person)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function WordGrammarBlock({ word, grammar, speed }) {
  const entry = grammar?.[word.word];
  if (entry?.declension) return <DeclensionTable declension={entry.declension} speed={speed} />;
  if (entry?.conjugation) return <ConjugationTable conjugation={entry.conjugation} speed={speed} />;
  return null;
}

// 范式词每格/每人称的例句（俄语 + 中文）
const PARADIGM_EXAMPLES = {
  работа: {
    nominative: { ru: "Работа — это важная часть жизни.", zh: "工作是生活的重要部分。" },
    genitive: { ru: "У меня нет работы.", zh: "我没有工作。" },
    dative: { ru: "Я рад своей работе.", zh: "我为自己的工作感到高兴。" },
    accusative: { ru: "Я люблю свою работу.", zh: "我爱我的工作。" },
    instrumental: { ru: "Я горжусь своей работой.", zh: "我为自己的工作自豪。" },
    prepositional: { ru: "Мы говорим о работе.", zh: "我们在谈论工作。" },
  },
  университет: {
    nominative: { ru: "Университет находится в центре города.", zh: "大学位于市中心。" },
    genitive: { ru: "Студенты университета пришли на лекцию.", zh: "大学的学生们来上课了。" },
    dative: { ru: "Мы идём к университету.", zh: "我们朝大学走去。" },
    accusative: { ru: "Я поступил в университет.", zh: "我考上了大学。" },
    instrumental: { ru: "Я горжусь своим университетом.", zh: "我为自己的大学自豪。" },
    prepositional: { ru: "Мы говорим об университете.", zh: "我们在谈论大学。" },
  },
  время: {
    nominative: { ru: "Время летит быстро.", zh: "时间飞逝。" },
    genitive: { ru: "У меня нет времени.", zh: "我没有时间。" },
    dative: { ru: "К времени нужно относиться бережно.", zh: "要珍惜时间。" },
    accusative: { ru: "Я провожу время с семьёй.", zh: "我和家人共度时光。" },
    instrumental: { ru: "Со временем всё изменится.", zh: "随着时间推移一切都会改变。" },
    prepositional: { ru: "Мы говорим о времени.", zh: "我们在谈论时间。" },
  },
  интересный: {
    nominative: { ru: "Это интересная книга.", zh: "这是一本有趣的书。" },
    genitive: { ru: "У меня нет интересной книги.", zh: "我没有有趣的书。" },
    dative: { ru: "Я рад интересному фильму.", zh: "我为这部有趣的电影感到高兴。" },
    accusative: { ru: "Я смотрю интересный фильм.", zh: "我在看一部有趣的电影。" },
    instrumental: { ru: "Мы довольны интересным фильмом.", zh: "我们对这部有趣的电影很满意。" },
    prepositional: { ru: "Мы говорим об интересной книге.", zh: "我们在谈论一本有趣的书。" },
  },
};

const VERB_PERSON_EXAMPLES = {
  говорить: {
    "я": { ru: "Я говорю по-русски.", zh: "我说俄语。" },
    "ты": { ru: "Ты говоришь слишком быстро.", zh: "你说得太快了。" },
    "он/она́/оно́": { ru: "Она говорит по телефону.", zh: "她在打电话。" },
    "мы": { ru: "Мы говорим о планах.", zh: "我们在谈计划。" },
    "вы": { ru: "Вы говорите по-английски?", zh: "您会说英语吗？" },
    "они́": { ru: "Они говорят на разных языках.", zh: "他们说不同的语言。" },
    masculine: { ru: "Он говорил правду.", zh: "他说了实话。" },
    feminine: { ru: "Она говорила с мамой.", zh: "她和妈妈谈过话。" },
    neuter: { ru: "Всё говорило о скорой весне.", zh: "一切都预示着春天将至。" },
    plural: { ru: "Они говорили о будущем.", zh: "他们谈论着未来。" },
    "imperative:ты": { ru: "Говори громче!", zh: "说大声点！" },
    "imperative:вы": { ru: "Говорите медленнее, пожалуйста.", zh: "请说慢一点。" },
  },
};

function PronounTable({ words, grammar, speed }) {
  const rows = CASE_INFO.map((info) => ({
    info,
    cells: words.map(({ word }) => grammar[word]?.declension?.rows.find((row) => row.case === info.en)?.cells[0] || "—"),
  }));
  return (
    <table className="grammar-table pronoun-table">
      <thead><tr><th>格</th>{words.map(({ word, zh }) => <th key={word}>{word}<small>{zh}</small></th>)}</tr></thead>
      <tbody>
        {rows.map(({ info, cells }) => (
          <tr key={info.en}>
            <th className="grammar-case-name">{info.zh}<small>{info.ru}</small></th>
            {cells.map((cell, index) => <td key={index}><span className="grammar-form">{cell}</span><AudioButton text={cell} compact speed={speed} /></td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GrammarView({ grammar, loading, settings }) {
  const [tab, setTab] = useState("nouns");
  const [query, setQuery] = useState("");

  const nounParadigms = [
    findParadigm(grammar, "declension", ["работа", "книга"]),
    findParadigm(grammar, "declension", ["университет", "дом"]),
    findParadigm(grammar, "declension", ["время", "море"]),
  ].filter(Boolean);
  const adjectiveParadigm = findParadigm(grammar, "declension", ["интересный", "новый"]);
  const verbParadigm = findParadigm(grammar, "conjugation", ["говорить", "работать", "читать"]);

  const searched = useMemo(() => {
    const normalized = cleanRussianText(query.trim().toLowerCase());
    if (!normalized || !grammar) return null;
    const key = Object.keys(grammar).find((word) => cleanRussianText(word) === normalized);
    return key ? { word: key, entry: grammar[key] } : null;
  }, [query, grammar]);

  return (
    <div className="page-content grammar-page">
      <header className="grammar-heading">
        <div><span className="eyebrow">语法</span><h1>俄语语法</h1></div>
      </header>
      <div className="grammar-tabs" role="tablist">
        {GRAMMAR_TABS.map(({ id, label }) => <button key={id} role="tab" aria-selected={tab === id} className={`grammar-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {loading ? <div className="empty-state">语法数据加载中…</div> : null}

      {!loading && tab === "nouns" ? (
        <div className="grammar-panel">
          <section className="grammar-section">
            <h2>俄语的六个格</h2>
            <p className="grammar-note">俄语名词有六个格，通过词尾变化表示在句中的作用。变格是名词学习的核心。</p>
            <table className="grammar-table case-overview">
              <thead><tr><th>格</th><th>俄语名称</th><th>主要用途</th><th>提问词</th></tr></thead>
              <tbody>
                {CASE_INFO.map((item) => <tr key={item.en}><th className="grammar-case-name">{item.zh}<small>{item.ru}</small></th><td>{item.en}</td><td>{item.use}</td><td className="grammar-ask">{item.ask}</td></tr>)}
              </tbody>
            </table>
          </section>
          {nounParadigms.length ? nounParadigms.map(({ word, data }) => (
            <section className="grammar-section" key={word}>
              <h2>名词范式：{word}</h2>
              <DeclensionTable declension={data} speed={settings.speed} examples={PARADIGM_EXAMPLES[word]} />
            </section>
          )) : null}
          <section className="grammar-section">
            <h2>人称代词变格</h2>
            <p className="grammar-note">人称代词（я 我、ты 你、он/она 他/她、мы 我们、вы 你们/您、они 他们）也要变格，是日常会话的基础。</p>
            <h3 className="grammar-paradigm-title">单数代词</h3>
            <PronounTable words={[{ word: "я", zh: "我" }, { word: "ты", zh: "你" }, { word: "он", zh: "他" }, { word: "она", zh: "她" }]} grammar={grammar} speed={settings.speed} />
            <h3 className="grammar-paradigm-title">复数代词</h3>
            <PronounTable words={[{ word: "мы", zh: "我们" }, { word: "вы", zh: "你们/您" }, { word: "они", zh: "他们" }]} grammar={grammar} speed={settings.speed} />
          </section>
        </div>
      ) : null}

      {!loading && tab === "adjectives" ? (
        <div className="grammar-panel">
          <section className="grammar-section">
            <h2>形容词变格</h2>
            <p className="grammar-note">形容词与所修饰的名词保持性、数、格一致。阴性常用 -ая/-яя，中性 -ое/-ее，阳性 -ый/-ий/-ой，复数 -ые/-ие。</p>
            {adjectiveParadigm ? <DeclensionTable declension={adjectiveParadigm.data} speed={settings.speed} examples={PARADIGM_EXAMPLES[adjectiveParadigm.word]} /> : <p className="empty-detail">暂无形容词范式数据。</p>}
          </section>
        </div>
      ) : null}

      {!loading && tab === "verbs" ? (
        <div className="grammar-panel">
          <section className="grammar-section">
            <h2>动词变位</h2>
            <p className="grammar-note">俄语动词按人称和数变位。第一变位法以 -ешь/-ет/-ем/-ете/-ут(-ют) 结尾，第二变位法以 -ишь/-ит/-им/-ите/-ат(-ят) 结尾。过去时按性数变化。完成体动词没有现在时，其变位形式即将来时。</p>
            {verbParadigm ? (
              <>
                <h3 className="grammar-paradigm-title">范式动词：{verbParadigm.word}</h3>
                <ConjugationTable conjugation={verbParadigm.data} speed={settings.speed} personExamples={VERB_PERSON_EXAMPLES[verbParadigm.word]} />
              </>
            ) : <p className="empty-detail">暂无动词范式数据。</p>}
          </section>
        </div>
      ) : null}

      {!loading && tab === "lookup" ? (
        <div className="grammar-panel">
          <section className="grammar-section">
            <h2>查词变形</h2>
            <p className="grammar-note">输入学习池中的名词、形容词或动词，查看它的完整变格/变位表。</p>
            <label className="search-box grammar-search"><MagnifyingGlass size={22} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入俄语单词（如 работа、говорить）" /></label>
            {query.trim() && !searched ? <div className="empty-state">词库中暂无该词的变格数据，可试试 работа / интересный / говорить。</div> : null}
            {searched ? (
              <div className="grammar-result">
                <div className="grammar-result-heading"><h3>{searched.word}</h3>{searched.entry.declension ? <span className="level-tag">变格</span> : <span className="level-tag">变位</span>}</div>
                {searched.entry.declension ? <DeclensionTable declension={searched.entry.declension} speed={settings.speed} /> : null}
                {searched.entry.conjugation ? <ConjugationTable conjugation={searched.entry.conjugation} speed={settings.speed} /> : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function HistoryView({ stats, days }) {
  return <div className="page-content history-page"><span className="eyebrow">学习记录</span><h1>看见自己的进步</h1><p className="intro-copy">把每天的学习变成稳定的长期记忆。</p><div className="history-summary"><div><strong>{stats.learnedCount}</strong><span>已掌握词条</span></div><div><strong>{stats.streak}</strong><span>连续学习天数</span></div><div><strong>{stats.accuracy == null ? "—" : `${stats.accuracy}%`}</strong><span>累计正确率</span></div></div><div className="history-list">{days.length ? days.map(({ date, count }) => <div key={date}><span>{formatHistoryDay(date)}</span><strong>{count} 个词</strong><em>{date === todayKey() ? "进行中" : "完成"}</em></div>) : <div><span>暂无记录</span><strong>—</strong><em /></div>}</div></div>;
}

function ProfileView({ stats, settings, onNavigate }) {
  return (
    <div className="page-content profile-page">
      <header className="profile-hero">
        <span className="profile-avatar"><UserCircle size={48} weight="fill" /></span>
        <div><span className="eyebrow">学习空间</span><h1>我的</h1></div>
      </header>
      <section className="profile-summary" aria-label="学习摘要">
        <div><strong>{stats.learnedCount}</strong><span>已学词条</span></div>
        <div><strong>{stats.streak}</strong><span>连续天数</span></div>
        <div><strong>{stats.accuracy == null ? "—" : `${stats.accuracy}%`}</strong><span>正确率</span></div>
      </section>
      <section className="profile-menu" aria-label="账户菜单">
        <button className="profile-menu-item" onClick={() => onNavigate("history")}>
          <span className="profile-menu-icon"><ChartLineUp size={23} /></span><span><strong>学习记录</strong></span><CaretRight size={21} />
        </button>
        <button className="profile-menu-item" onClick={() => onNavigate("settings")}>
          <span className="profile-menu-icon"><GearSix size={23} /></span><span><strong>学习设置</strong></span><CaretRight size={21} />
        </button>
      </section>
    </div>
  );
}

function SettingsView({ settings, onChange, backgroundImage, onChooseBackground, onClearBackground, onResetData }) {
  const fileInput = useRef(null);
  const chooseFromFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => onChooseBackground(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const chooseImage = () => {
    if (isAndroid || window.desktopApp?.selectBackgroundImage) void onChooseBackground();
    else fileInput.current?.click();
  };
  return <div className="page-content settings-page"><span className="eyebrow">设置</span><h1>学习偏好</h1><div className="settings-list"><label><span><strong>每日新词</strong></span><select value={settings.dailyGoal} onChange={(event) => onChange({ ...settings, dailyGoal: Number(event.target.value) })}><option value="10">10</option><option value="20">20</option><option value="30">30</option></select></label><label><span><strong>发音速度</strong></span><select value={settings.speed} onChange={(event) => onChange({ ...settings, speed: Number(event.target.value), speedProfileVersion: 2 })}><option value="0.82">慢速</option><option value="1">标准</option><option value="1.15">快速</option></select></label><label><span><strong>听音辨词</strong></span><button type="button" role="switch" aria-checked={settings.listenEnabled} className={`toggle ${settings.listenEnabled ? "on" : ""}`} onClick={() => onChange({ ...settings, listenEnabled: !settings.listenEnabled })}><span /></button></label><div className="background-setting"><div><strong>应用背景</strong></div><div className="background-actions"><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={chooseFromFile} /><button className="secondary-button" onClick={chooseImage}>{backgroundImage ? "更换图片" : "导入图片"}</button>{backgroundImage && <button className="text-button" onClick={onClearBackground}>恢复默认</button>}</div></div><div className="background-setting"><div><strong>学习数据</strong></div><div className="background-actions"><button className="danger-button" onClick={onResetData}>清空学习数据</button></div></div></div></div>;
}

export function App() {
  const initialCoreState = useRef(null);
  if (!initialCoreState.current) initialCoreState.current = loadCoreState(window.localStorage, todayKey());
  const [active, setActive] = useState("today");
  const [sessions, setSessions] = useState(initialCoreState.current.sessions);
  const [settings, setSettings] = useState(initialCoreState.current.settings);
  const [record, setRecord] = useState(initialCoreState.current.record);
  const [addedToday, setAddedToday] = useState(initialCoreState.current.addedToday);
  const [storageReady, setStorageReady] = useState(!isAndroid);
  const [storageError, setStorageError] = useState("");
  const [storageAttempt, setStorageAttempt] = useState(0);
  const [ttsNotice, setTtsNotice] = useState("");
  const [studySession, setStudySession] = useState("review");
  const [selectedWord, setSelectedWord] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState("");
  const [lookupWords, setLookupWords] = useState(null);
  const [examples, setExamples] = useState(null);
  const [grammar, setGrammar] = useState(null);

  useEffect(() => {
    if (!isAndroid) return undefined;
    let mounted = true;
    let hydratedSuccessfully = false;
    void (async () => {
      try {
        const keys = Object.values(CORE_STORAGE_KEYS);
        await platformStorage.migrateFromLocalStorage(keys);
        const entries = await Promise.all(keys.map(async (key) => [key, await platformStorage.get(key)]));
        const values = new Map(entries);
        const hydrated = loadCoreState({ getItem: (key) => values.get(key) ?? null }, todayKey());
        if (!mounted) return;
        setSessions(hydrated.sessions);
        setSettings(hydrated.settings);
        setRecord(hydrated.record);
        setAddedToday(hydrated.addedToday);
        hydratedSuccessfully = true;
      } catch {
        if (mounted) setStorageError("无法读取本机学习记录，请重试。原数据尚未被覆盖。");
      } finally {
        if (mounted && hydratedSuccessfully) setStorageReady(true);
      }
    })();
    return () => { mounted = false; };
  }, [storageAttempt]);

  useEffect(() => {
    let timeoutId;
    const showNotice = () => {
      window.clearTimeout(timeoutId);
      setTtsNotice("未找到俄语语音。请在系统“文字转语音”设置中安装俄语语音数据。");
      timeoutId = window.setTimeout(() => setTtsNotice(""), 6500);
    };
    window.addEventListener("russian-tts-unavailable", showNotice);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("russian-tts-unavailable", showNotice);
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    void platformStorage.set(STUDY_PROGRESS_KEY, JSON.stringify({ version: SCHEMA_VERSION, sessions })).catch(() => {});
  }, [sessions, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    void platformStorage.set(STUDY_SETTINGS_KEY, JSON.stringify(normalizeSettings(settings))).catch(() => {});
  }, [settings, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    void platformStorage.set(STUDY_RECORD_KEY, JSON.stringify(normalizeRecord(record))).catch(() => {});
  }, [record, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    void platformStorage.set(ADDED_TODAY_KEY, JSON.stringify(normalizeAddedToday(addedToday, todayKey()))).catch(() => {});
  }, [addedToday, storageReady]);

  // 词库参考数据懒加载：首屏只打包本地词，词库/例句/语法 JSON 按需加载
  useEffect(() => {
    let mounted = true;
    Promise.all([
      import("./data/open-russian-lookup.json"),
      import("./data/russian-examples.json").catch(() => null),
      import("./data/russian-grammar.json").catch(() => null),
    ]).then(([lookupModule, examplesModule, grammarModule]) => {
      if (!mounted) return;
      setLookupWords(lookupModule.default);
      setExamples(examplesModule?.default || null);
      setGrammar(grammarModule?.default || null);
    }).catch(() => {
      // Library and study pool fall back to the bundled local words.
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    platformBackground.get().then((image) => {
      if (image) setBackgroundImage(image);
    }).catch(() => {});
  }, []);

  const pool = useMemo(() => buildCoreStudyPool(WORDS, lookupWords, examples), [lookupWords, examples]);
  const dictionaryWords = useMemo(() => buildCoreDictionary(WORDS, lookupWords, examples), [lookupWords, examples]);
  const exampleWordIndex = useMemo(() => buildExampleWordIndex(dictionaryWords, grammar), [dictionaryWords, grammar]);
  const readingWordIndex = useMemo(() => buildReadingWordIndex(dictionaryWords, grammar), [dictionaryWords, grammar]);
  const readingSpeechController = useMemo(() => createReadingSpeechController({
    speak: (text) => speakRussian(text, settings.speed),
    stop: stopRussianSpeech,
  }), [settings.speed]);
  const learnQueue = useMemo(() => buildCoreLearnQueue(pool, record, addedToday, todayKey()), [pool, record, addedToday]);
  const reviewQueue = useMemo(() => buildCoreReviewQueue(pool, record, todayKey()), [pool, record]);
  const practiceQueue = selectedWord ? [selectedWord] : [];
  const todayStats = useMemo(() => getCoreTodayStats(pool, record, todayKey()), [pool, record]);
  const historyStats = useMemo(() => getCoreHistoryStats(pool, record, todayKey()), [pool, record]);
  const historyDays = useMemo(() => getCoreHistoryDays(pool, record), [pool, record]);

  useEffect(() => () => {
    void readingSpeechController.cancel();
  }, [readingSpeechController]);

  useEffect(() => {
    void system.initialize();
  }, []);

  // Keep desktop Escape, browser history and Android's physical back button
  // aligned with the currently visible screen.
  useEffect(() => {
    let disposed = false;
    let removeNativeListener = () => {};
    const closeExamplePopover = () => {
      if (!document.querySelector(".example-word-popover")) return false;
      markExamplePopoverClosed();
      window.dispatchEvent(new Event(CLOSE_EXAMPLE_POPOVER_EVENT));
      return true;
    };
    const closeReadingPopover = () => {
      if (!document.querySelector(".reading-popover")) return false;
      window.dispatchEvent(new Event("reading:close-popover"));
      return true;
    };
    const goBack = () => {
      if (active === "learn" || active === "review") {
        if (studySession === "practice") setActive("library");
        else {
          setSelectedWord(null);
          setActive("today");
        }
      } else if (selectedWord) {
        setSelectedWord(null);
      } else if (["history", "settings"].includes(active)) {
        setActive("profile");
      } else if (active !== "today") {
        setActive("today");
      } else {
        return false;
      }
      return true;
    };
    const handleBackIntent = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (closeReadingPopover() || closeExamplePopover()) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        return;
      }
      if (event.type === "keydown" && wasExamplePopoverJustClosed()) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        return;
      }
      if (goBack()) event.preventDefault?.();
    };
    void system.onBackButton(() => {
      if (closeReadingPopover() || closeExamplePopover()) return;
      if (wasExamplePopoverJustClosed()) return;
      if (!goBack()) system.exitApp();
    }).then((remove) => {
      if (disposed) remove();
      else removeNativeListener = remove;
    }).catch(() => {});
    window.addEventListener("keydown", handleBackIntent);
    window.addEventListener("popstate", handleBackIntent);
    return () => {
      disposed = true;
      removeNativeListener();
      window.removeEventListener("keydown", handleBackIntent);
      window.removeEventListener("popstate", handleBackIntent);
    };
  }, [active, selectedWord, studySession]);

  const chooseBackground = async (fallbackDataUrl) => {
    if (isAndroid || window.desktopApp?.selectBackgroundImage) {
      try {
        const image = await platformBackground.select();
        if (image) setBackgroundImage(image);
        return;
      } catch {
        return;
      }
    }
    if (fallbackDataUrl) setBackgroundImage(fallbackDataUrl);
  };
  const clearBackground = async () => {
    try {
      await platformBackground.clear();
    } catch {
      // The local UI state is still cleared if the platform file is unavailable.
    }
    setBackgroundImage("");
  };
  const resetStudyData = async () => {
    if (!window.confirm("确定要清空所有学习数据吗？已学单词、复习进度和今日加入的词都会被清除，此操作不可撤销。")) return;
    try {
      await Promise.all([
        STUDY_PROGRESS_KEY,
        STUDY_RECORD_KEY,
        ADDED_TODAY_KEY,
      ].map((key) => platformStorage.remove(key)));
    } catch {
      // State is still reset for the current app session if storage is unavailable.
    }
    setSessions({});
    setRecord({ version: SCHEMA_VERSION, words: {} });
    setAddedToday(normalizeAddedToday(null, todayKey()));
  };

  const goToWord = (word) => {
    setSelectedWord(word);
    setActive("library");
  };
  const startStudy = (type) => {
    setStudySession(type);
    setActive(type === "practice" ? "review" : type);
  };
  const handleAnswer = (word, type, isCorrect) => {
    const today = todayKey();
    setRecord((current) => recordAnswer(current, { wordId: word.id, sessionType: type, correct: isCorrect, today }));
    if (type !== "practice" && isCorrect) {
      const sourceQueue = type === "learn" ? learnQueue : reviewQueue;
      setSessions((current) => {
        const session = normalizeSession(current[type], type, sourceQueue, today);
        return { ...current, [type]: completeSessionWord(session, word.id) };
      });
    }
  };
  const addWordToToday = (wordId) => {
    setAddedToday((current) => addWordForToday(current, wordId, todayKey()));
  };
  const exitStudy = () => {
    if (studySession === "practice") {
      setActive("library");
      return;
    }
    setSelectedWord(null);
    setActive("today");
  };
  const finishStudy = (type) => {
    if (type !== "practice") {
      setSessions((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
    }
    exitStudy();
  };
  const navigate = (id) => {
    setSelectedWord(null);
    if (id === "review") setStudySession("review");
    setActive(id);
  };
  const resolveReadingEntry = (token) => resolveReadingWord(token, readingWordIndex)?.entry || null;
  const speakReadingText = (text) => {
    if (isAndroid) return speakRussian(text, settings.speed);
    return readingSpeechController.readAll(text, { speed: settings.speed, maxChars: 220 });
  };
  const stopReading = () => isAndroid ? stopRussianSpeech() : readingSpeechController.cancel();

  let content = null;
  if (active === "learn" || active === "review") {
    const type = active === "learn" ? "learn" : studySession;
    const baseQueue = type === "learn" ? learnQueue : type === "practice" ? practiceQueue : reviewQueue;
    const session = type === "practice" ? null : normalizeSession(sessions[type], type, baseQueue, todayKey());
    const sessionComplete = Boolean(session && session.cursor >= session.queueIds.length);
    const queue = sessionComplete ? [] : session ? hydrateSessionQueue(session, pool) : baseQueue;
    const initialIndex = session ? Math.min(session.cursor, Math.max(queue.length - 1, 0)) : 0;
    content = <ReviewView key={type} queue={queue} pool={pool} settings={settings} grammar={grammar} exampleWordIndex={exampleWordIndex} sessionType={type} initialIndex={initialIndex} onAnswer={handleAnswer} onDone={() => finishStudy(type)} onBack={sessionComplete ? () => finishStudy(type) : exitStudy} />;
  } else if (selectedWord && active === "library") {
    content = <WordDetail word={selectedWord} onBack={() => setSelectedWord(null)} onPractice={() => startStudy("practice")} onAddToday={() => addWordToToday(selectedWord.id)} added={addedToday.wordIds.includes(selectedWord.id)} learnedToday={record.words[selectedWord.id]?.learnedAt === todayKey()} grammar={grammar} exampleWordIndex={exampleWordIndex} settings={settings} />;
  } else if (active === "grammar") {
    content = <GrammarView grammar={grammar} loading={!grammar} settings={settings} />;
  } else if (active === "reading") {
    content = <ReadingView texts={readingTexts} resolveWord={resolveReadingEntry} onSpeak={speakReadingText} onStop={stopReading} />;
  } else if (active === "library") {
    content = <LibraryView dictionaryWords={dictionaryWords} loading={!lookupWords} settings={settings} onSelectWord={goToWord} />;
  } else if (active === "history") {
    content = <HistoryView stats={historyStats} days={historyDays} />;
  } else if (active === "settings") {
    content = <SettingsView settings={settings} onChange={setSettings} backgroundImage={backgroundImage} onChooseBackground={chooseBackground} onClearBackground={clearBackground} onResetData={resetStudyData} />;
  } else if (active === "profile") {
    content = <ProfileView stats={historyStats} settings={settings} onNavigate={navigate} />;
  } else {
    content = <TodayView learnedToday={todayStats.learnedToday} goal={settings.dailyGoal} dueWords={todayStats.dueWords} record={record} settings={settings} onStart={() => startStudy("learn")} onStartReview={() => startStudy("review")} onSelectWord={goToWord} />;
  }

  const shellStyle = backgroundImage ? { "--custom-background": `url(${backgroundImage})` } : undefined;
  const navActive = active === "learn" ? "today" : active === "review" && studySession === "practice" ? "library" : ["history", "settings"].includes(active) ? "profile" : active;
  const sessionActive = active === "learn" || active === "review";
  if (isAndroid && !storageReady) {
    return <main className="storage-gate"><div><span className="brand-mark">RU</span><h1>{storageError ? "学习记录读取失败" : "正在载入学习记录"}</h1><p>{storageError || "正在安全读取这台设备上的设置与学习进度…"}</p>{storageError && <button className="primary-button" onClick={() => { setStorageError(""); setStorageAttempt((value) => value + 1); }}>重新读取</button>}</div></main>;
  }
  return <div className={`app-shell ${sessionActive ? "in-session" : ""} ${backgroundImage ? "custom-background" : ""}`} style={shellStyle}><Nav active={navActive} onChange={navigate} goal={settings.dailyGoal} /><main className="main-panel">{content}</main>{ttsNotice && <div className="app-toast" role="status">{ttsNotice}</div>}</div>;
}
