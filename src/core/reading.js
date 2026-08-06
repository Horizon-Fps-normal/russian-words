import { splitRussianText } from "./words.js";

export const READING_LEVELS = Object.freeze(["A1", "A2", "B1", "B2", "C1"]);

const SENTENCE_END_PATTERN = /([.!?…]+)(?:[”»"])?$/u;

function splitParagraphString(value) {
  return String(value ?? "").split(/\r?\n\s*\r?\n/u).map((item) => item.trim()).filter(Boolean);
}

function splitTranslatedSentences(value) {
  return String(value ?? "").match(/[^。！？!?…]+(?:[。！？!?…]+|$)/gu)?.map((item) => item.trim()).filter(Boolean) || [];
}

export function splitReadingSentences(value) {
  const source = String(value ?? "").trim();
  if (!source) return [];
  const chunks = source.match(/[^.!?…]+(?:[.!?…]+(?:[”»"])?|$)/gu) || [source];
  return chunks.map((chunk) => {
    const text = chunk.trim();
    const ending = text.match(SENTENCE_END_PATTERN);
    const punctuation = ending?.[1] || "";
    const punctuationIndex = punctuation ? text.lastIndexOf(punctuation) : text.length;
    return {
      text,
      content: text.slice(0, punctuationIndex),
      punctuation: text.slice(punctuationIndex),
    };
  }).filter((sentence) => sentence.text);
}

export function normalizeReadingTexts(texts) {
  if (!Array.isArray(texts)) return [];
  return texts.map((article, articleIndex) => {
    if (!article || typeof article !== "object") return null;
    const rawParagraphs = Array.isArray(article.paragraphs)
      ? article.paragraphs
      : Array.isArray(article.sentences)
        ? [{
          ru: article.sentences.map((sentence) => sentence?.ru ?? sentence?.text ?? "").filter(Boolean).join(" "),
          zh: article.sentences.map((sentence) => sentence?.zh ?? sentence?.translation ?? "").filter(Boolean).join(""),
          sentences: article.sentences,
        }]
        : splitParagraphString(article.body ?? article.text ?? article.russian).map((ru) => ({ ru }));
    const fallbackTranslations = Array.isArray(article.translation)
      ? article.translation
      : splitParagraphString(article.translation ?? article.chinese ?? article.bodyZh);
    const paragraphs = rawParagraphs.map((paragraph, paragraphIndex) => {
      const paragraphObject = typeof paragraph === "string" ? { ru: paragraph } : paragraph;
      const ru = String(paragraphObject?.ru ?? paragraphObject?.text ?? "").trim();
      const zh = String(paragraphObject?.zh ?? paragraphObject?.translation ?? fallbackTranslations[paragraphIndex] ?? "").trim();
      const russianSentences = Array.isArray(paragraphObject?.sentences)
        ? paragraphObject.sentences.map((sentence) => typeof sentence === "string" ? { ru: sentence } : sentence)
        : splitReadingSentences(ru).map((sentence) => ({ ru: sentence.text }));
      const chineseSentences = splitTranslatedSentences(zh);
      const sentences = russianSentences.map((sentence, sentenceIndex) => {
        const sentenceRu = String(sentence?.ru ?? sentence?.text ?? "").trim();
        const parsed = splitReadingSentences(sentenceRu)[0] || { text: sentenceRu, content: sentenceRu, punctuation: "" };
        return {
          ...parsed,
          zh: String(sentence?.zh ?? sentence?.translation ?? chineseSentences[sentenceIndex] ?? "").trim(),
        };
      }).filter((sentence) => sentence.text);
      return { ru, zh, sentences };
    }).filter((paragraph) => paragraph.ru);
    if (!paragraphs.length) return null;
    return {
      ...article,
      id: article.id ?? `${article.level || "reading"}-${article.title || articleIndex}-${articleIndex}`,
      title: String(article.title ?? article.titleRu ?? "").trim(),
      level: READING_LEVELS.includes(article.level) ? article.level : "",
      category: String(article.category ?? "").trim(),
      categoryZh: String(article.categoryZh ?? "").trim(),
      paragraphs,
      fullRussianText: paragraphs.map((paragraph) => paragraph.ru).join("\n\n"),
      fullTranslation: paragraphs.map((paragraph) => paragraph.zh).filter(Boolean).join("\n\n"),
    };
  }).filter(Boolean);
}

export function filterReadingTexts(texts, level = "全部") {
  const normalized = normalizeReadingTexts(texts);
  return level === "全部" ? normalized : normalized.filter((article) => article.level === level);
}

export function tokenizeReadingRussian(value) {
  return splitRussianText(value);
}
