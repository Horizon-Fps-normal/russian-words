import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CaretDown, CaretUp, SpeakerHigh, X } from "@phosphor-icons/react";
import { filterReadingTexts, normalizeReadingTexts, READING_LEVELS, tokenizeReadingRussian } from "../core/reading.js";
import PhrasebookView from "./PhrasebookView.jsx";
import "../styles-reading.css";

function anchorPosition(target, preferredWidth = 340) {
  const rect = target.getBoundingClientRect();
  const width = Math.min(preferredWidth, window.innerWidth - 32);
  const half = width / 2;
  return {
    left: Math.min(Math.max(rect.left + rect.width / 2, half + 16), window.innerWidth - half - 16),
    top: rect.bottom + 230 < window.innerHeight ? rect.bottom + 10 : Math.max(12, rect.top - 220),
    width,
  };
}

function articleMeta(article) {
  const source = typeof article.source === "string"
    ? { label: article.source, url: article.sourceUrl, license: article.license }
    : article.source;
  return [
    { key: "level", label: article.level },
    { key: "author", label: article.author },
    { key: "source", label: source?.label, url: source?.url },
    { key: "license", label: source?.license },
    { key: "date", label: article.date },
    { key: "duration", label: article.estimatedMinutes ? `${article.estimatedMinutes} 分钟` : "" },
  ].filter((item) => item.label);
}

export default function ReadingView({ texts = [], resolveWord, onSpeak, onStop }) {
  const articles = useMemo(() => normalizeReadingTexts(texts), [texts]);
  const [mode, setMode] = useState("articles");
  const [level, setLevel] = useState("全部");
  const filtered = useMemo(() => filterReadingTexts(articles, level), [articles, level]);
  const [selectedId, setSelectedId] = useState(null);
  const selectedArticle = filtered.find((article) => article.id === selectedId) || filtered[0] || null;
  const [translationOpen, setTranslationOpen] = useState(false);
  const [popup, setPopup] = useState(null);
  const popupRef = useRef(null);
  const lookupSerial = useRef(0);
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  useEffect(() => () => {
    onStopRef.current?.();
  }, []);

  const closePopup = (restoreFocus = false) => {
    const trigger = popup?.trigger;
    lookupSerial.current += 1;
    setPopup(null);
    if (restoreFocus && trigger?.isConnected) requestAnimationFrame(() => trigger.focus());
  };

  useEffect(() => {
    if (!popup) return undefined;
    const closeOutside = (event) => {
      if (popupRef.current?.contains(event.target)) return;
      if (event.target.closest?.(".reading-word, .sentence-punctuation")) return;
      closePopup(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closePopup(true);
    };
    const closeOnViewportChange = () => closePopup(false);
    const closeFromAppShell = () => closePopup(false);
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape, true);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("reading:close-popover", closeFromAppShell);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape, true);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("reading:close-popover", closeFromAppShell);
    };
  }, [popup]);

  useEffect(() => {
    if (popup) requestAnimationFrame(() => popupRef.current?.focus());
  }, [popup?.type, popup?.key]);

  const speak = (text, kind) => {
    if (!text) return;
    onStop?.();
    onSpeak?.(text, { kind });
  };

  const openWord = async (event, token, key) => {
    const requestId = ++lookupSerial.current;
    const position = anchorPosition(event.currentTarget);
    const trigger = event.currentTarget;
    setPopup({ type: "word", key, token, entry: null, loading: typeof resolveWord === "function", trigger, ...position });
    if (typeof resolveWord !== "function") return;
    try {
      const resolved = await resolveWord(token);
      if (requestId !== lookupSerial.current) return;
      const entry = resolved?.entry || resolved || null;
      setPopup((current) => current?.type === "word" && current.key === key ? { ...current, entry, lemma: resolved?.lemma || entry?.word || "", loading: false } : current);
    } catch {
      if (requestId !== lookupSerial.current) return;
      setPopup((current) => current?.type === "word" && current.key === key ? { ...current, entry: null, loading: false } : current);
    }
  };

  const openSentence = (event, sentence, key) => {
    lookupSerial.current += 1;
    setPopup({ type: "sentence", key, sentence, trigger: event.currentTarget, ...anchorPosition(event.currentTarget, 460) });
  };

  const renderRussian = (text, keyPrefix) => tokenizeReadingRussian(text).map((part, index) => part.isRussian ? (
    <button
      type="button"
      className="reading-word"
      key={`${keyPrefix}-word-${index}`}
      onClick={(event) => void openWord(event, part.text, `${keyPrefix}-${index}`)}
      aria-haspopup="dialog"
      aria-expanded={popup?.type === "word" && popup.key === `${keyPrefix}-${index}`}
      aria-label={`${part.text}，查看释义`}
    >{part.text}</button>
  ) : <span key={`${keyPrefix}-text-${index}`}>{part.text}</span>);

  const changeArticle = (article) => {
    onStop?.();
    closePopup(false);
    setSelectedId(article.id);
    setTranslationOpen(false);
  };

  const entry = popup?.type === "word" ? popup.entry : null;
  const baseWord = entry?.stressed || popup?.lemma || entry?.word || entry?.lemma || "";
  const changeMode = (nextMode) => {
    onStop?.();
    closePopup(false);
    setMode(nextMode);
  };

  return (
    <section className="reading-view" aria-label="俄语阅读">
      <header className="reading-header">
        <div><span className="reading-eyebrow">阅读</span><h1>{mode === "articles" ? "俄语文章" : "短语大全"}</h1></div>
        <div className="reading-mode-switch" role="tablist" aria-label="阅读内容">
          <button type="button" role="tab" aria-selected={mode === "articles"} className={mode === "articles" ? "active" : ""} onClick={() => changeMode("articles")}>文章</button>
          <button type="button" role="tab" aria-selected={mode === "phrases"} className={mode === "phrases" ? "active" : ""} onClick={() => changeMode("phrases")}>短语大全</button>
        </div>
        {mode === "articles" && <div className="reading-chips" role="group" aria-label="阅读等级筛选">
          {["全部", ...READING_LEVELS].map((item) => <button type="button" key={item} className={level === item ? "active" : ""} onClick={() => { setLevel(item); setSelectedId(null); setTranslationOpen(false); closePopup(false); }}>{item}</button>)}
        </div>}
      </header>

      {mode === "phrases" ? <PhrasebookView onSpeak={onSpeak} onStop={onStop} /> : !articles.length ? <div className="reading-empty"><BookOpen size={34} /><p>暂无阅读文章。</p></div> : !filtered.length ? <div className="reading-empty"><p>该难度暂无文章。</p></div> : (
        <div className="reading-layout">
          <aside className="reading-list" aria-label="文章列表">
            {filtered.map((article) => <button type="button" key={article.id} className={selectedArticle?.id === article.id ? "active" : ""} onClick={() => changeArticle(article)} aria-current={selectedArticle?.id === article.id ? "page" : undefined}>
              <strong>{article.title || "未命名文章"}</strong>
              <span>{articleMeta(article).map((item) => item.label).join(" · ")}</span>
            </button>)}
          </aside>

          {selectedArticle && <article className="reading-article">
            <header className="reading-article-head">
              <div><h2>{selectedArticle.title || "未命名文章"}</h2>{selectedArticle.titleZh && <p>{selectedArticle.titleZh}</p>}<div className="reading-meta">{articleMeta(selectedArticle).map((item) => item.url ? <a key={item.key} href={item.url} target="_blank" rel="noreferrer">{item.label}</a> : <span key={item.key}>{item.label}</span>)}</div></div>
              <button type="button" className="reading-speak-button" onClick={() => speak(selectedArticle.fullRussianText, "document")}><SpeakerHigh size={20} /> 全文朗读</button>
            </header>

            <div className="reading-body" lang="ru">
              {selectedArticle.paragraphs.map((paragraph, paragraphIndex) => <p key={`${selectedArticle.id}-paragraph-${paragraphIndex}`}>
                {paragraph.sentences.map((sentence, sentenceIndex) => {
                  const sentenceKey = `${selectedArticle.id}-${paragraphIndex}-${sentenceIndex}`;
                  return <span className="reading-sentence" key={sentenceKey}>{renderRussian(sentence.content, sentenceKey)}{sentence.punctuation ? <button type="button" className="sentence-punctuation" onClick={(event) => openSentence(event, sentence, sentenceKey)} aria-haspopup="dialog" aria-expanded={popup?.type === "sentence" && popup.key === sentenceKey} aria-label={`查看句子翻译：${sentence.text}`}>{sentence.punctuation}</button> : null}{sentenceIndex < paragraph.sentences.length - 1 ? " " : ""}</span>;
                })}
              </p>)}
            </div>

            {selectedArticle.fullTranslation && <section className="reading-translation">
              <button type="button" onClick={() => setTranslationOpen((open) => !open)} aria-expanded={translationOpen}>{translationOpen ? <CaretUp size={18} /> : <CaretDown size={18} />} 全文翻译</button>
              {translationOpen && <div>{selectedArticle.fullTranslation}</div>}
            </section>}
          </article>}
        </div>
      )}

      {popup?.type === "word" && <div ref={popupRef} tabIndex={-1} className="reading-popover reading-word-popover" role="dialog" aria-modal="false" aria-label={`${popup.token} 的释义`} style={{ left: popup.left, top: popup.top, width: popup.width }}>
        <div className="reading-popover-head"><strong>{popup.token}</strong><button type="button" onClick={() => closePopup(true)} aria-label="关闭释义"><X size={22} /></button></div>
        {popup.loading ? <span className="reading-lookup-state" aria-live="polite">查询中…</span> : <>
          {baseWord && baseWord.toLocaleLowerCase("ru-RU") !== popup.token.toLocaleLowerCase("ru-RU") && <span className="reading-base-word">基础词：{baseWord}</span>}
          <strong className="reading-gloss">{entry?.meaning || "暂无中文释义"}</strong>
          {entry?.meaningEn && <span className="reading-english">{entry.meaningEn}</span>}
          <span className="reading-entry-meta">{[entry?.level, entry?.pos].filter(Boolean).join(" · ")}</span>
        </>}
        <button type="button" className="reading-popup-speak" onClick={() => speak(popup.token, "word")} aria-label={`朗读 ${popup.token}`}><SpeakerHigh size={20} /></button>
      </div>}

      {popup?.type === "sentence" && <div ref={popupRef} tabIndex={-1} className="reading-popover reading-sentence-popover" role="dialog" aria-modal="false" aria-label="句子对照" style={{ left: popup.left, top: popup.top, width: popup.width }}>
        <div className="reading-popover-head"><strong>句子对照</strong><button type="button" onClick={() => closePopup(true)} aria-label="关闭句子对照"><X size={22} /></button></div>
        <p lang="ru">{popup.sentence.text}</p>
        <p className="reading-sentence-translation">{popup.sentence.zh || "暂无译文"}</p>
        <button type="button" className="reading-popup-speak" onClick={() => speak(popup.sentence.text, "sentence")} aria-label="朗读句子"><SpeakerHigh size={20} /></button>
      </div>}
    </section>
  );
}
