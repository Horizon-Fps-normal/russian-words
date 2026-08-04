import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
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
import openRussianLookup from "./data/open-russian-lookup.json";

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
  return word.forms.split(" · ").map((form, index) => ({
    form,
    meaning: FORM_MEANINGS[word.id]?.[index] || word.meaning || "词形变化",
  }));
}

const NAV_ITEMS = [
  { id: "today", label: "今日学习", Icon: House },
  { id: "review", label: "复习单词", Icon: SquaresFour },
  { id: "library", label: "词库", Icon: BookOpen },
  { id: "history", label: "学习记录", Icon: ChartLineUp },
  { id: "settings", label: "设置", Icon: GearSix },
];

const REVIEW_WORDS = WORDS.slice(0, 20);
const DICTIONARY_WORDS = [...WORDS, ...openRussianLookup];
const STUDY_PROGRESS_KEY = "russian-words-study-progress";

function getStoredStudyProgress() {
  const empty = { learn: 0, review: 0 };
  try {
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_KEY) || "null");
    return {
      learn: Math.max(0, Math.min(Number(stored?.learn) || 0, REVIEW_WORDS.length)),
      review: Math.max(0, Math.min(Number(stored?.review) || 0, REVIEW_WORDS.length)),
    };
  } catch {
    return empty;
  }
}

function cleanRussianText(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

let activeAudio = null;

async function playGeneratedAudio(audioBase64) {
  if (!audioBase64) return false;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
  }
  activeAudio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
  activeAudio.volume = 1;
  await activeAudio.play();
  return true;
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

async function speakWithBrowser(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const voices = await getBrowserVoices();
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanRussianText(text));
  const russianVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith("ru"));
  if (russianVoice) utterance.voice = russianVoice;
  utterance.lang = "ru-RU";
  utterance.rate = 0.82;
  utterance.volume = 1;
  synth.speak(utterance);
}

async function speakRussian(text) {
  const cleanText = cleanRussianText(text);
  try {
    if (window.desktopApp?.speakRussian) {
      const result = await window.desktopApp.speakRussian(cleanText);
      if (result?.audioBase64) {
        await playGeneratedAudio(result.audioBase64);
        return;
      }
      if (result?.provider === "windows") return;
    }
  } catch {
    // Fall back to the browser voice if Windows has no Russian voice installed.
  }
  await speakWithBrowser(cleanText);
}

function Nav({ active, onChange }) {
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
      <div className="sidebar-footnote">A1 — C1 · 每天 20 词</div>
    </aside>
  );
}

function AudioButton({ word, compact = false, text, className = "" }) {
  const spokenText = text || word?.stressed || "";
  const label = text || word?.word || "俄语内容";
  return (
    <button className={`audio-button ${compact ? "compact" : ""} ${className}`.trim()} onClick={() => void speakRussian(spokenText)} aria-label={`播放 ${label} 发音`}>
      <SpeakerHigh size={compact ? 17 : 21} weight="regular" />
    </button>
  );
}

function ProgressHeader({ learned }) {
  return (
    <section className="progress-block">
      <div className="progress-copy">
        <span className="eyebrow">今日学习进度</span>
        <div className="progress-number"><strong>{learned}</strong><span>/ 20</span><em>已学单词</em></div>
      </div>
      <div className="progress-action"><button className="primary-button" onClick={() => window.dispatchEvent(new CustomEvent("open-review"))}>开始学习</button></div>
      <div className="progress-track"><span style={{ width: `${(learned / 20) * 100}%` }} /></div>
      <span className="progress-percent">{Math.round((learned / 20) * 100)}% 完成</span>
    </section>
  );
}

function TodayView({ learned, onStart, onStartReview, onSelectWord }) {
  const dueWords = WORDS.slice(0, 5);
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
          <div className="progress-number"><strong>{learned}</strong><span>/ 20</span><em>已学单词</em></div>
        </div>
        <div className="progress-action"><button className="primary-button" onClick={onStart}>开始学习</button></div>
        <div className="progress-track"><span style={{ width: `${(learned / 20) * 100}%` }} /></div>
        <span className="progress-percent">{Math.round((learned / 20) * 100)}% 完成</span>
      </section>
      <section className="due-section">
        <div className="section-heading"><h2>待复习单词（20）</h2><button className="text-button" onClick={onStartReview}>进入复习 <span>→</span></button></div>
        <div className="word-list">
          <div className="list-header"><span>单词</span><span>中文释义</span><span>上次学习</span></div>
          {dueWords.map((word, index) => (
            <div className="word-row" role="button" tabIndex={0} key={word.id} onClick={() => onSelectWord(word)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectWord(word); } }}>
              <span className="word-name">{word.stressed}<AudioButton word={word} compact /></span>
              <span>{word.meaning}</span>
              <span className="last-studied">{index < 3 ? "昨天" : "2 天前"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StudyDetailView({ word, mode, sessionType, index, total, selectedAnswer, correctAnswer, onContinue, onBackToQuestion, onBack }) {
  const isCorrect = selectedAnswer === correctAnswer;
  const answerText = mode === "meaning" ? selectedAnswer : selectedAnswer;
  const correctText = mode === "meaning" ? word.meaning : word.stressed;
  return (
    <div className="review-page study-detail-page">
      <div className="review-topline"><button className="back-button" onClick={onBack}>← 退出学习</button><span>{`第 ${index + 1} 题 / 共 ${total} 题`}</span><span>{`进度 ${Math.round((index / total) * 100)}%`}</span></div>
      <div className="review-track"><span style={{ width: `${(index / total) * 100}%` }} /></div>
      <div className="study-detail-shell">
        <div className={`study-result ${isCorrect ? "success" : "error"}`}><strong>{isCorrect ? "答对了" : "再看一遍这个词"}</strong><span>{isCorrect ? "记住释义、搭配和例句，再进入下一题" : `你的选择：${answerText} · 正确答案：${correctText}`}</span></div>
        <div className="detail-top study-detail-top"><div><span className="eyebrow">{sessionType === "learn" ? "新词学习" : "复习单词"} · {word.level} · {word.pos}</span><div className="detail-word-line"><h1>{word.stressed}</h1><AudioButton word={word} /></div><p className="phonetic">重音标记 · 点击按钮播放俄语神经 TTS 发音</p><div className="detail-meaning">{word.meaning}</div></div><span className="detail-index">单词详情</span></div>
        <div className="detail-section"><h2>例句</h2><div className="example-russian example-audio-line"><span>{word.example}</span><AudioButton text={word.example} compact /></div><p className="example-chinese">{word.translation}</p></div>
        <div className="detail-section"><h2>常见搭配</h2><div className="collocations">{word.collocations.map((item, itemIndex) => <div key={item}><div className="detail-russian-line"><strong>{item}</strong><AudioButton text={item} compact /></div><small>{COLLOCATION_MEANINGS[word.id]?.[itemIndex] || word.meaning}</small></div>)}</div></div>
        <div className="detail-section"><h2>词形变化</h2><div className="forms-list">{getFormItems(word).map(({ form, meaning }) => <div key={form}><div className="detail-russian-line"><strong>{form}</strong><AudioButton text={form} compact /></div><small>{meaning}</small></div>)}</div></div>
        <div className="detail-footer"><button className="primary-button" onClick={onContinue}>{isCorrect ? (index >= total - 1 ? "完成今日学习" : "下一题") : "返回题目重新选择"} →</button><button className="secondary-button" onClick={onBackToQuestion}>返回题目</button></div>
      </div>
    </div>
  );
}

function ReviewView({ onDone, onBack, onProgress, initialIndex = 0, sessionType = "review" }) {
  const [index, setIndex] = useState(() => Math.min(initialIndex, REVIEW_WORDS.length - 1));
  const [mode, setMode] = useState("meaning");
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const activeWord = REVIEW_WORDS[index] || REVIEW_WORDS[0];
  const total = REVIEW_WORDS.length;
  const correct = mode === "meaning" ? activeWord.meaning : activeWord.word;
  const options = useMemo(() => {
    const distractors = REVIEW_WORDS.filter((word) => word.id !== activeWord.id).slice(index % 3, (index % 3) + 3);
    return mode === "meaning" ? [activeWord.meaning, ...distractors.map((word) => word.meaning)] : [activeWord.word, ...distractors.map((word) => word.word)];
  }, [activeWord, index, mode]);

  const choose = (answer) => {
    setSelected(answer);
    if (answer === correct) onProgress?.(Math.min(index + 1, total));
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
    setMode(nextMode);
    setSelected(null);
    setShowDetail(false);
  };

  if (showDetail) {
    return <StudyDetailView word={activeWord} mode={mode} sessionType={sessionType} index={index} total={total} selectedAnswer={selected} correctAnswer={correct} onContinue={selected === correct ? next : () => { setSelected(null); setShowDetail(false); }} onBackToQuestion={() => setShowDetail(false)} onBack={onBack} />;
  }

  return (
    <div className="review-page">
      <div className="review-topline"><button className="back-button" onClick={onBack}>← 退出学习</button><span>{`第 ${index + 1} 题 / 共 ${total} 题`}</span><span>{`进度 ${Math.round((index / total) * 100)}%`}</span></div>
      <div className="review-track"><span style={{ width: `${(index / total) * 100}%` }} /></div>
      <div className="quiz-shell">
        {mode === "meaning" ? (
          <div className="study-word-card">
            <div className="study-word">{activeWord.stressed}</div>
            <div className="study-word-meta">{activeWord.level} · {activeWord.pos}</div>
            <AudioButton word={activeWord} />
          </div>
        ) : (
          <>
            <button className="listen-main" onClick={() => void speakRussian(activeWord.stressed)} aria-label="播放俄语发音"><Play size={28} weight="fill" /></button>
            <button className="replay-button" onClick={() => void speakRussian(activeWord.stressed)}><Repeat size={18} /> 再听一次</button>
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

function LibraryView({ onSelectWord }) {
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
    return DICTIONARY_WORDS.filter((word) => {
      const searchable = `${word.word} ${word.stressed} ${word.meaning} ${word.meaningEn} ${word.level}`.toLowerCase();
      return (level === "全部" || word.level === level) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [level, query]);
  const visibleWords = filtered.slice(0, 120);
  const levels = ["全部", "A1", "A2", "B1", "B2", "C1"];
  return (
    <div className="page-content library-page">
      <header className="library-heading"><div><span className="eyebrow">词典</span><h1>查找俄语单词</h1><p className="library-intro">输入俄语、重音形式或中文释义，按等级筛选并打开完整词条。</p></div><span className="dictionary-source-note">本机词条 + OpenRussian 参考词库 · CC BY-SA</span></header>
      <label className="search-box"><MagnifyingGlass size={22} /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索俄语单词或中文释义" /><kbd>Ctrl K</kbd></label>
      <div className="library-meta"><span>{filtered.length} 个词条{filtered.length > visibleWords.length ? ` · 显示前 ${visibleWords.length} 个` : ""}</span><div>{levels.map((item) => <button key={item} className={`filter-chip ${level === item ? "active" : ""}`} onClick={() => setLevel(item)}>{item}</button>)}</div></div>
      <div className="library-list">
        {visibleWords.map((word) => <div className="library-row" role="button" tabIndex={0} key={word.id} onClick={() => onSelectWord(word)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectWord(word); } }}><span className="library-word">{word.stressed}<AudioButton word={word} compact /></span><span>{word.meaning || (word.meaningEn ? `英译参考：${word.meaningEn}` : "中文释义待补充")}</span><span className="level-tag">{word.level}</span><span className="library-arrow">→</span></div>)}
        {!filtered.length && <div className="empty-state">没有找到匹配的单词。</div>}
      </div>
    </div>
  );
}

function WordDetail({ word, onBack, onStart }) {
  const [added, setAdded] = useState(false);
  const hasLearningData = Boolean(word.meaning);
  return (
    <div className="page-content detail-page">
      <button className="back-button detail-back" onClick={onBack}>← 返回词库</button>
      <div className="detail-top"><div><span className="eyebrow">{word.level} · {word.pos}</span><div className="detail-word-line"><h1>{word.stressed}</h1><AudioButton word={word} /></div><p className="phonetic">{word.source ? `${word.source} 参考词条 · ` : ""}点击按钮播放俄语神经 TTS 发音</p><div className="detail-meaning">{word.meaning || "中文释义待补充"}</div>{!word.meaning && word.meaningEn && <p className="reference-meaning">英译参考：{word.meaningEn}</p>}</div><span className="detail-index">词典词条</span></div>
      <div className="detail-section"><h2>例句</h2>{word.example ? <><div className="example-russian example-audio-line"><span>{word.example}</span><AudioButton text={word.example} compact /></div><p className="example-chinese">{word.translation}</p></> : <p className="empty-detail">该参考词条暂未收录例句。</p>}</div>
      <div className="detail-section"><h2>常见搭配</h2>{word.collocations.length ? <div className="collocations">{word.collocations.map((item, index) => <div key={item}><div className="detail-russian-line"><strong>{item}</strong><AudioButton text={item} compact /></div><small>{COLLOCATION_MEANINGS[word.id]?.[index] || word.meaning}</small></div>)}</div> : <p className="empty-detail">该参考词条暂未收录搭配。</p>}</div>
      <div className="detail-section"><h2>词形变化</h2><div className="forms-list">{getFormItems(word).map(({ form, meaning }) => <div key={form}><div className="detail-russian-line"><strong>{form}</strong><AudioButton text={form} compact /></div><small>{meaning}</small></div>)}</div></div>
      <div className="detail-footer">{hasLearningData ? <><button className={`primary-button add-button ${added ? "added" : ""}`} onClick={() => setAdded(true)}>{added ? <Check size={20} /> : <Plus size={20} />} {added ? "已加入今日学习" : "加入今日学习"}</button><button className="secondary-button" onClick={onStart}>立即练习</button></> : <span className="detail-note">该词条来自参考词库，中文释义补全后即可加入学习计划。</span>}</div>
    </div>
  );
}

function HistoryView() {
  return <div className="page-content history-page"><span className="eyebrow">学习记录</span><h1>看见自己的进步</h1><p className="intro-copy">把每天的 20 个词变成稳定的长期记忆。</p><div className="history-summary"><div><strong>126</strong><span>已掌握词条</span></div><div><strong>18</strong><span>连续学习天数</span></div><div><strong>87%</strong><span>近 7 日正确率</span></div></div><div className="history-list"><div><span>今天</span><strong>20 个词</strong><em>进行中</em></div><div><span>昨天</span><strong>20 个词</strong><em>完成</em></div><div><span>8 月 2 日</span><strong>20 个词</strong><em>完成</em></div></div></div>;
}

function SettingsView({ backgroundImage, onChooseBackground, onClearBackground }) {
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
  return <div className="page-content settings-page"><span className="eyebrow">设置</span><h1>学习偏好</h1><div className="settings-list"><label><span><strong>每日新词</strong><small>每天加入学习计划的词条数</small></span><select defaultValue="20"><option>10</option><option>20</option><option>30</option></select></label><label><span><strong>发音速度</strong><small>听音辨词和单词详情中的播放速度</small></span><select defaultValue="0.82"><option value="0.7">慢速</option><option value="0.82">标准</option><option value="1">快速</option></select></label><label><span><strong>学习方向</strong><small>听音选择俄语单词 + 俄语选择中文释义</small></span><span className="toggle on"><span /></span></label><div className="background-setting"><div><strong>应用背景</strong><small>导入一张图片作为全局背景，图片只保存在本机。</small></div><div className="background-actions"><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={chooseFromFile} /><button className="secondary-button" onClick={chooseImage}>{backgroundImage ? "更换图片" : "导入图片"}</button>{backgroundImage && <button className="text-button" onClick={onClearBackground}>恢复默认</button>}</div></div></div></div>;
}

export function App() {
  const [active, setActive] = useState("today");
  const [studyProgress, setStudyProgress] = useState(getStoredStudyProgress);
  const [studySession, setStudySession] = useState("review");
  const [selectedWord, setSelectedWord] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(studyProgress));
    } catch {
      // Progress remains available for the current app session if storage is unavailable.
    }
  }, [studyProgress]);

  useEffect(() => {
    const loadBackground = window.desktopApp?.getBackgroundImage;
    if (!loadBackground) return;
    loadBackground().then((image) => {
      if (image) setBackgroundImage(image);
    }).catch(() => {});
  }, []);

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
  const startStudy = (sessionType = "review") => {
    setStudySession(sessionType);
    setActive(sessionType === "learn" ? "learn" : "review");
  };
  const updateStudyProgress = (sessionType, completed) => {
    setStudyProgress((current) => ({ ...current, [sessionType]: completed }));
  };
  const finishStudy = () => {
    setActive("today");
  };
  const navigate = (id) => {
    setSelectedWord(null);
    if (id === "review") setStudySession("review");
    setActive(id);
  };

  let content = null;
  if (active === "learn" || active === "review") content = <ReviewView key={studySession} sessionType={studySession} initialIndex={studyProgress[studySession]} onProgress={(completed) => updateStudyProgress(studySession, completed)} onDone={finishStudy} onBack={() => navigate("today")} />;
  else if (selectedWord && active === "library") content = <WordDetail word={selectedWord} onBack={() => setSelectedWord(null)} onStart={() => startStudy("review")} />;
  else if (active === "library") content = <LibraryView onSelectWord={goToWord} />;
  else if (active === "history") content = <HistoryView />;
  else if (active === "settings") content = <SettingsView backgroundImage={backgroundImage} onChooseBackground={chooseBackground} onClearBackground={clearBackground} />;
  else content = <TodayView learned={studyProgress.learn} onStart={() => startStudy("learn")} onStartReview={() => startStudy("review")} onSelectWord={goToWord} />;

  const shellStyle = backgroundImage ? { "--custom-background": `url(${backgroundImage})` } : undefined;
  const navActive = active === "learn" ? "today" : active;
  return <div className={`app-shell ${backgroundImage ? "custom-background" : ""}`} style={shellStyle}><Nav active={navActive} onChange={navigate} /><main className="main-panel">{content}</main></div>;
}
