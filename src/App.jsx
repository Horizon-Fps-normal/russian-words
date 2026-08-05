import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
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
  X,
} from "@phosphor-icons/react";

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
  { id: "grammar", label: "俄语语法", Icon: Books },
  { id: "library", label: "词库", Icon: BookOpen },
  { id: "history", label: "学习记录", Icon: ChartLineUp },
  { id: "settings", label: "设置", Icon: GearSix },
];

const STUDY_PROGRESS_KEY = "russian-words-study-progress";
const STUDY_SETTINGS_KEY = "russian-words-settings";
const STUDY_RECORD_KEY = "russian-words-record";
const ADDED_TODAY_KEY = "russian-words-added-today";

const DEFAULT_SETTINGS = { dailyGoal: 20, speed: 0.82, listenEnabled: true };

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
  const stored = getStoredJson(STUDY_SETTINGS_KEY, null);
  if (!stored || typeof stored !== "object") return DEFAULT_SETTINGS;
  return {
    dailyGoal: [10, 20, 30].includes(Number(stored.dailyGoal)) ? Number(stored.dailyGoal) : DEFAULT_SETTINGS.dailyGoal,
    speed: [0.7, 0.82, 1].includes(Number(stored.speed)) ? Number(stored.speed) : DEFAULT_SETTINGS.speed,
    listenEnabled: stored.listenEnabled !== false,
  };
}

function getStoredStudyProgress() {
  const stored = getStoredJson(STUDY_PROGRESS_KEY, {});
  return {
    learn: Math.max(0, Number(stored.learn) || 0),
    review: Math.max(0, Number(stored.review) || 0),
  };
}

function getStoredRecord() {
  const stored = getStoredJson(STUDY_RECORD_KEY, null);
  return { words: stored?.words && typeof stored.words === "object" ? stored.words : {} };
}

function getStoredAddedToday() {
  const stored = getStoredJson(ADDED_TODAY_KEY, []);
  return Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
}

function cleanRussianText(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

// 今日学习队列：加入今日学习的词在前，然后是未学过的词（不限每日额度）
function buildLearnQueue(pool, record, addedToday) {
  const addedIds = new Set(addedToday);
  const added = addedToday.map((id) => pool.find((word) => word.id === id)).filter(Boolean);
  const unlearned = pool.filter((word) => !record.words[word.id]?.learnedAt);
  return [...added, ...unlearned.filter((word) => !addedIds.has(word.id))];
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

function playAudioUrl(url) {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
  }
  activeAudio = new Audio(url);
  activeAudio.volume = 1;
  return activeAudio.play().then(() => true).catch(() => false);
}

async function playGeneratedAudio(audioBase64) {
  if (!audioBase64) return false;
  return playAudioUrl(`data:audio/mpeg;base64,${audioBase64}`);
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

async function speakWithBrowser(text, speed = 0.82) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const voices = await getBrowserVoices();
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanRussianText(text));
  const russianVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith("ru"));
  if (russianVoice) utterance.voice = russianVoice;
  utterance.lang = "ru-RU";
  utterance.rate = speed;
  utterance.volume = 1;
  synth.speak(utterance);
}

async function speakRussian(text, speed = 0.82) {
  const cleanText = cleanRussianText(text);
  try {
    if (window.desktopApp?.speakRussian) {
      const result = await window.desktopApp.speakRussian(cleanText, speed);
      if (result?.audioBase64) {
        await playGeneratedAudio(result.audioBase64);
        return;
      }
      if (result?.provider === "windows") return;
    }
  } catch {
    // Fall back to the browser voice if Windows has no Russian voice installed.
  }
  await speakWithBrowser(cleanText, speed);
}

function Nav({ active, onChange, goal }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">RU</span>
        <div>
          <strong>俄语词库</strong>
          <span>给中文使用者</span>
        </div>
      </div>
      <nav className="nav-list" aria-label="主导航">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button className={`nav-item ${active === id ? "active" : ""}`} key={id} onClick={() => onChange(id)}>
            <Icon size={21} weight={active === id ? "fill" : "regular"} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footnote">A1 — B2 · 每天 {goal} 词</div>
    </aside>
  );
}

function AudioButton({ word, compact = false, text, className = "", speed = 0.82 }) {
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

function StudyDetailView({ word, mode, sessionType, index, total, selectedAnswer, correctAnswer, speed, grammar, onContinue, onBackToQuestion, onBack }) {
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
        <div className={`study-result ${isCorrect ? "success" : "error"}`}><strong>{isCorrect ? "答对了" : "再看一遍这个词"}</strong><span>{isCorrect ? "记住释义、搭配和例句，再进入下一题" : `你的选择：${selectedAnswer} · 正确答案：${correctAnswer}`}</span></div>
        <div className="detail-top study-detail-top"><div><span className="eyebrow">{sessionLabel} · {word.level} · {word.pos}</span><div className="detail-word-line"><h1>{word.stressed}</h1><AudioButton word={word} speed={speed} /></div><p className="phonetic">重音标记 · 点击按钮播放俄语神经 TTS 发音</p><div className="detail-meaning">{word.meaning}</div></div><span className="detail-index">单词详情</span></div>
        {word.example ? <div className="detail-section"><h2>例句</h2><div className="example-russian example-audio-line"><span>{word.example}</span><AudioButton text={word.example} compact speed={speed} /></div><p className="example-chinese">{word.translation}</p></div> : null}
        {word.collocations?.length ? <div className="detail-section"><h2>常见搭配</h2><div className="collocations">{word.collocations.map((item, itemIndex) => <div key={item}><div className="detail-russian-line"><strong>{item}</strong><AudioButton text={item} compact speed={speed} /></div><small>{COLLOCATION_MEANINGS[word.id]?.[itemIndex] || word.meaning}</small></div>)}</div></div> : null}
        {grammarEntry?.declension || grammarEntry?.conjugation ? <div className="detail-section"><h2>词形变化</h2><WordGrammarBlock word={word} grammar={grammar} speed={speed} /></div> : (formItems.length > 1 ? <div className="detail-section"><h2>词形变化</h2><div className="forms-list">{formItems.map(({ form, meaning }) => <div key={form}><div className="detail-russian-line"><strong>{form}</strong><AudioButton text={form} compact speed={speed} /></div><small>{meaning}</small></div>)}</div></div> : null)}
        <div className="detail-footer">
          <button className="primary-button" onClick={onContinue}>{isCorrect ? (index >= total - 1 ? (sessionType === "practice" ? "完成练习" : "完成今日学习") : "下一题") : "返回题目重新选择"} →</button>
          {isCorrect && <button className="secondary-button" onClick={onBackToQuestion}>返回题目</button>}
        </div>
      </div>
    </div>
  );
}

function ReviewView({ queue, pool, settings, grammar, sessionType, initialIndex = 0, onAnswer, onDone, onBack }) {
  // 会话开始时的词表快照，避免词库懒加载完成后队列变化导致题目跳词
  const [sessionWords] = useState(queue);
  const [index, setIndex] = useState(() => Math.min(initialIndex, Math.max(sessionWords.length - 1, 0)));
  const [mode, setMode] = useState("meaning");
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const total = sessionWords.length;
  const activeWord = sessionWords[index];
  const correct = mode === "meaning" ? activeWord?.meaning : activeWord?.word;

  const options = useMemo(() => {
    if (!activeWord) return [];
    const correctValue = mode === "meaning" ? activeWord.meaning : activeWord.word;
    // 干扰项从整个词池随机抽取，保证不同单词的错误选项各不相同
    const distractors = [];
    const seen = new Set([correctValue]);
    for (const word of shuffled(pool)) {
      if (word.id === activeWord.id) continue;
      const value = mode === "meaning" ? word.meaning : word.word;
      if (!value || seen.has(value)) continue;
      seen.add(value);
      distractors.push(value);
      if (distractors.length === 3) break;
    }
    return shuffled([correctValue, ...distractors]);
  }, [activeWord, mode, pool]);

  const choose = (answer) => {
    const isCorrect = answer === correct;
    setSelected(answer);
    onAnswer?.(activeWord, sessionType, isCorrect, index + 1);
    setShowDetail(true);
  };
  const next = () => {
    if (index >= total - 1) {
      onDone(total);
      return;
    }
    setIndex((current) => current + 1);
    setSelected(null);
    setShowDetail(false);
  };
  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
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
    return <StudyDetailView word={activeWord} mode={mode} sessionType={sessionType} index={index} total={total} selectedAnswer={selected} correctAnswer={correct} speed={settings.speed} grammar={grammar} onContinue={selected === correct ? next : () => { setSelected(null); setShowDetail(false); }} onBackToQuestion={() => setShowDetail(false)} onBack={onBack} />;
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

function LibraryView({ dictionaryWords, loading, onSelectWord }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("全部");
  const searchInput = useRef(null);
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
  const visibleWords = filtered.slice(0, 120);
  const levels = ["全部", "A1", "A2", "B1", "B2"];
  return (
    <div className="page-content library-page">
      <header className="library-heading"><div><span className="eyebrow">词典</span><h1>查找俄语单词</h1><p className="library-intro">输入俄语、重音形式或中文释义，按等级筛选并打开完整词条。</p></div><span className="dictionary-source-note">本机词条 + OpenRussian 参考词库 · CC BY-SA</span></header>
      <label className="search-box"><MagnifyingGlass size={22} /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索俄语单词或中文释义" /><kbd>Ctrl K</kbd></label>
      <div className="library-meta"><span>{loading ? "词库加载中…" : `${filtered.length} 个词条${filtered.length > visibleWords.length ? ` · 显示前 ${visibleWords.length} 个` : ""}`}</span><div>{levels.map((item) => <button key={item} className={`filter-chip ${level === item ? "active" : ""}`} onClick={() => setLevel(item)}>{item}</button>)}</div></div>
      <div className="library-list">
        {visibleWords.map((word) => <div className="library-row" role="button" tabIndex={0} key={word.id} onClick={() => onSelectWord(word)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectWord(word); } }}><span className="library-word">{word.stressed}<AudioButton word={word} compact /></span><span>{word.meaning || (word.meaningEn ? `英译参考：${word.meaningEn}` : "中文释义待补充")}</span><span className="level-tag">{word.level}</span><span className="library-arrow">→</span></div>)}
        {!filtered.length && !loading && <div className="empty-state">没有找到匹配的单词。</div>}
      </div>
    </div>
  );
}

function WordDetail({ word, onBack, onPractice, onAddToday, added, learnedToday, grammar, settings }) {
  const hasLearningData = Boolean(word.meaning);
  const grammarEntry = grammar?.[word.word];
  return (
    <div className="page-content detail-page">
      <button className="back-button detail-back" onClick={onBack}>← 返回词库</button>
      <div className="detail-top"><div><span className="eyebrow">{word.level} · {word.pos}</span><div className="detail-word-line"><h1>{word.stressed}</h1><AudioButton word={word} speed={settings.speed} /></div><p className="phonetic">{word.source ? `${word.source} 参考词条 · ` : ""}点击按钮播放俄语神经 TTS 发音</p><div className="detail-meaning">{word.meaning || "中文释义待补充"}</div>{!word.meaning && word.meaningEn && <p className="reference-meaning">英译参考：{word.meaningEn}</p>}</div><span className="detail-index">词典词条</span></div>
      <div className="detail-section"><h2>例句</h2>{word.example ? <><div className="example-russian example-audio-line"><span>{word.example}</span><AudioButton text={word.example} compact speed={settings.speed} /></div><p className="example-chinese">{word.translation}</p></> : <p className="empty-detail">该参考词条暂未收录例句。</p>}</div>
      <div className="detail-section"><h2>常见搭配</h2>{word.collocations.length ? <div className="collocations">{word.collocations.map((item, index) => <div key={item}><div className="detail-russian-line"><strong>{item}</strong><AudioButton text={item} compact speed={settings.speed} /></div><small>{COLLOCATION_MEANINGS[word.id]?.[index] || word.meaning}</small></div>)}</div> : <p className="empty-detail">该参考词条暂未收录搭配。</p>}</div>
      <div className="detail-section"><h2>词形变化</h2>{grammarEntry?.declension || grammarEntry?.conjugation ? <WordGrammarBlock word={word} grammar={grammar} speed={settings.speed} /> : (getFormItems(word).length > 1 ? <div className="forms-list">{getFormItems(word).map(({ form, meaning }) => <div key={form}><div className="detail-russian-line"><strong>{form}</strong><AudioButton text={form} compact speed={settings.speed} /></div><small>{meaning}</small></div>)}</div> : <p className="empty-detail">该参考词条暂未收录词形变化。</p>)}</div>
      <div className="detail-footer">{hasLearningData ? <>{learnedToday ? <button className="primary-button add-button added" disabled><Check size={20} /> 今日已学习</button> : <button className={`primary-button add-button ${added ? "added" : ""}`} onClick={onAddToday}>{added ? <Check size={20} /> : <Plus size={20} />} {added ? "已加入今日学习" : "加入今日学习"}</button>}<button className="secondary-button" onClick={onPractice}>立即练习</button></> : <span className="detail-note">该词条来自参考词库，中文释义补全后即可加入学习计划。</span>}</div>
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
        <div><span className="eyebrow">语法</span><h1>俄语语法</h1><p className="grammar-intro">名词的格、形容词变格与动词变位一览，附带发音。</p></div>
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

function SettingsView({ settings, onChange, backgroundImage, onChooseBackground, onClearBackground }) {
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
    if (window.desktopApp?.selectBackgroundImage) void onChooseBackground();
    else fileInput.current?.click();
  };
  return <div className="page-content settings-page"><span className="eyebrow">设置</span><h1>学习偏好</h1><div className="settings-list"><label><span><strong>每日新词</strong><small>每天的学习目标，达到后仍可继续学习</small></span><select value={settings.dailyGoal} onChange={(event) => onChange({ ...settings, dailyGoal: Number(event.target.value) })}><option value="10">10</option><option value="20">20</option><option value="30">30</option></select></label><label><span><strong>发音速度</strong><small>听音辨词和单词详情中的播放速度</small></span><select value={settings.speed} onChange={(event) => onChange({ ...settings, speed: Number(event.target.value) })}><option value="0.7">慢速</option><option value="0.82">标准</option><option value="1">快速</option></select></label><label><span><strong>听音辨词</strong><small>开启后练习中可切换「听音选俄语」模式</small></span><button type="button" role="switch" aria-checked={settings.listenEnabled} className={`toggle ${settings.listenEnabled ? "on" : ""}`} onClick={() => onChange({ ...settings, listenEnabled: !settings.listenEnabled })}><span /></button></label><div className="background-setting"><div><strong>应用背景</strong><small>导入一张图片作为全局背景，图片只保存在本机。</small></div><div className="background-actions"><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={chooseFromFile} /><button className="secondary-button" onClick={chooseImage}>{backgroundImage ? "更换图片" : "导入图片"}</button>{backgroundImage && <button className="text-button" onClick={onClearBackground}>恢复默认</button>}</div></div></div></div>;
}

export function App() {
  const [active, setActive] = useState("today");
  const [progress, setProgress] = useState(getStoredStudyProgress);
  const [settings, setSettings] = useState(getStoredSettings);
  const [record, setRecord] = useState(getStoredRecord);
  const [addedToday, setAddedToday] = useState(getStoredAddedToday);
  const [studySession, setStudySession] = useState("review");
  const [selectedWord, setSelectedWord] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState("");
  const [lookupWords, setLookupWords] = useState(null);
  const [examples, setExamples] = useState(null);
  const [grammar, setGrammar] = useState(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Progress remains available for the current app session if storage is unavailable.
    }
  }, [progress]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDY_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Settings remain available for the current app session if storage is unavailable.
    }
  }, [settings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDY_RECORD_KEY, JSON.stringify(record));
    } catch {
      // Record remains available for the current app session if storage is unavailable.
    }
  }, [record]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ADDED_TODAY_KEY, JSON.stringify(addedToday));
    } catch {
      // Added words remain available for the current app session if storage is unavailable.
    }
  }, [addedToday]);

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
    const loadBackground = window.desktopApp?.getBackgroundImage;
    if (!loadBackground) return;
    loadBackground().then((image) => {
      if (image) setBackgroundImage(image);
    }).catch(() => {});
  }, []);

  const pool = useMemo(() => buildStudyPool(lookupWords, examples), [lookupWords, examples]);
  const dictionaryWords = useMemo(() => buildDictionaryWords(lookupWords, examples), [lookupWords, examples]);
  const learnQueue = useMemo(() => buildLearnQueue(pool, record, addedToday), [pool, record, addedToday]);
  const reviewQueue = useMemo(() => buildReviewQueue(pool, record), [pool, record]);
  const practiceQueue = selectedWord ? [selectedWord] : [];
  const todayStats = useMemo(() => getTodayStats(pool, record), [pool, record]);
  const historyStats = useMemo(() => getHistoryStats(pool, record), [pool, record]);
  const historyDays = useMemo(() => getHistoryDays(pool, record), [pool, record]);

  const chooseBackground = async (fallbackDataUrl) => {
    if (window.desktopApp?.selectBackgroundImage) {
      try {
        const image = await window.desktopApp.selectBackgroundImage();
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
      await window.desktopApp?.clearBackgroundImage?.();
    } catch {
      // The local UI state is still cleared if the desktop file is unavailable.
    }
    setBackgroundImage("");
  };

  const goToWord = (word) => {
    setSelectedWord(word);
    setActive("library");
  };
  const startStudy = (type) => {
    setStudySession(type);
    setActive(type === "practice" ? "review" : type);
  };
  const handleAnswer = (word, type, isCorrect, answeredCount) => {
    setRecord((current) => {
      const previous = current.words[word.id];
      const entry = {
        ...previous,
        attempts: (previous?.attempts || 0) + 1,
        correct: (previous?.correct || 0) + (isCorrect ? 1 : 0),
        lastSeen: todayKey(),
      };
      if (type === "learn" && !previous?.learnedAt) entry.learnedAt = todayKey();
      if (type === "review") {
        // 间隔重复：答对升档（1/3/7/14/30/90 天），答错回到最低档明天再复习
        entry.reviewStage = isCorrect ? (previous?.reviewStage || 0) + 1 : 0;
      } else if (type === "learn") {
        entry.reviewStage = 0;
      }
      return { ...current, words: { ...current.words, [word.id]: entry } };
    });
    if (type !== "practice" && isCorrect) {
      setProgress((current) => ({ ...current, [type]: Math.max(current[type] || 0, answeredCount) }));
    }
  };
  const addWordToToday = (wordId) => {
    setAddedToday((current) => (current.includes(wordId) ? current : [...current, wordId]));
  };
  const exitStudy = () => {
    if (studySession === "practice") {
      setActive("library");
      return;
    }
    setSelectedWord(null);
    setActive("today");
  };
  const navigate = (id) => {
    setSelectedWord(null);
    if (id === "review") setStudySession("review");
    setActive(id);
  };

  let content = null;
  if (active === "learn" || active === "review") {
    const type = active === "learn" ? "learn" : studySession;
    const queue = type === "learn" ? learnQueue : type === "practice" ? practiceQueue : reviewQueue;
    content = <ReviewView key={type} queue={queue} pool={pool} settings={settings} grammar={grammar} sessionType={type} initialIndex={type === "practice" ? 0 : progress[type] || 0} onAnswer={handleAnswer} onDone={exitStudy} onBack={exitStudy} />;
  } else if (selectedWord && active === "library") {
    content = <WordDetail word={selectedWord} onBack={() => setSelectedWord(null)} onPractice={() => startStudy("practice")} onAddToday={() => addWordToToday(selectedWord.id)} added={addedToday.includes(selectedWord.id)} learnedToday={record.words[selectedWord.id]?.learnedAt === todayKey()} grammar={grammar} settings={settings} />;
  } else if (active === "grammar") {
    content = <GrammarView grammar={grammar} loading={!grammar} settings={settings} />;
  } else if (active === "library") {
    content = <LibraryView dictionaryWords={dictionaryWords} loading={!lookupWords} onSelectWord={goToWord} />;
  } else if (active === "history") {
    content = <HistoryView stats={historyStats} days={historyDays} />;
  } else if (active === "settings") {
    content = <SettingsView settings={settings} onChange={setSettings} backgroundImage={backgroundImage} onChooseBackground={chooseBackground} onClearBackground={clearBackground} />;
  } else {
    content = <TodayView learnedToday={todayStats.learnedToday} goal={settings.dailyGoal} dueWords={todayStats.dueWords} record={record} settings={settings} onStart={() => startStudy("learn")} onStartReview={() => startStudy("review")} onSelectWord={goToWord} />;
  }

  const shellStyle = backgroundImage ? { "--custom-background": `url(${backgroundImage})` } : undefined;
  const navActive = active === "learn" ? "today" : active === "review" && studySession === "practice" ? "library" : active;
  return <div className={`app-shell ${backgroundImage ? "custom-background" : ""}`} style={shellStyle}><Nav active={navActive} onChange={navigate} goal={settings.dailyGoal} /><main className="main-panel">{content}</main></div>;
}
