import { useMemo, useState } from "react";
import { CaretDown, CaretUp, MagnifyingGlass, SpeakerHigh } from "@phosphor-icons/react";
import russianPhrases, { PHRASE_CATEGORIES } from "../data/russian-phrases.js";

function russianOnly(text) {
  return (String(text).match(/[А-Яа-яЁё][А-Яа-яЁё\s,.-]*/gu) || [])
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/[\s,.-]+$/g, "")
    .trim();
}

function SpeakButton({ text, onSpeak, label }) {
  const [loading, setLoading] = useState(false);
  const play = async (event) => {
    event.stopPropagation();
    if (!text || loading) return;
    setLoading(true);
    try {
      await onSpeak?.(text, { kind: "phrase" });
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      className={`phrase-speak ${loading ? "is-loading" : ""}`}
      onClick={(event) => void play(event)}
      aria-busy={loading}
      aria-label={`朗读${label || "俄语短语"}`}
    >
      <SpeakerHigh size={20} weight={loading ? "fill" : "regular"} />
    </button>
  );
}

export default function PhrasebookView({ onSpeak, onStop }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [level, setLevel] = useState("全部");
  const [expandedId, setExpandedId] = useState(russianPhrases[0]?.id || null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru-RU");
    return russianPhrases.filter((item) => {
      const matchesCategory = category === "全部" || item.category === category;
      const matchesLevel = level === "全部" || item.level === level;
      const searchable = `${item.phrase} ${item.meaning} ${item.exampleRu} ${item.exampleZh} ${item.note}`.toLocaleLowerCase("ru-RU");
      return matchesCategory && matchesLevel && (!needle || searchable.includes(needle));
    });
  }, [category, level, query]);

  const toggle = (id) => {
    onStop?.();
    setExpandedId((current) => current === id ? null : id);
  };

  return (
    <section className="phrasebook" aria-label="俄语短语大全">
      <div className="phrasebook-toolbar">
        <label className="phrase-search">
          <MagnifyingGlass size={21} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索俄语短语、中文或例句" />
        </label>
        <div className="phrase-count"><strong>{filtered.length}</strong><span>/ {russianPhrases.length} 条</span></div>
      </div>

      <div className="phrase-filters" role="group" aria-label="短语类型">
        {["全部", ...PHRASE_CATEGORIES].map((item) => (
          <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      <div className="phrase-levels" role="group" aria-label="短语难度">
        {["全部", "A1", "A2", "B1", "B2"].map((item) => (
          <button type="button" key={item} className={level === item ? "active" : ""} onClick={() => setLevel(item)}>{item}</button>
        ))}
      </div>

      {filtered.length ? <div className="phrase-list">
        {filtered.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <article className={`phrase-card ${expanded ? "expanded" : ""}`} key={item.id}>
              <button type="button" className="phrase-summary" onClick={() => toggle(item.id)} aria-expanded={expanded}>
                <span className="phrase-heading"><strong lang="ru">{item.phrase}</strong><small>{item.category} · {item.level}</small></span>
                <span className="phrase-meaning">{item.meaning}</span>
                {expanded ? <CaretUp size={20} /> : <CaretDown size={20} />}
              </button>
              <SpeakButton text={russianOnly(item.phrase)} onSpeak={onSpeak} label={item.phrase} />
              {expanded && <div className="phrase-detail">
                {item.note && <p className="phrase-note">{item.note}</p>}
                <div className="phrase-example">
                  <div><strong lang="ru">{item.exampleRu}</strong><span>{item.exampleZh}</span></div>
                  <SpeakButton text={item.exampleRu} onSpeak={onSpeak} label="例句" />
                </div>
              </div>}
            </article>
          );
        })}
      </div> : <div className="reading-empty"><p>没有找到匹配的短语。</p></div>}
    </section>
  );
}
