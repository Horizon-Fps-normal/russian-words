export const READING_CATEGORIES = ["life", "news", "science", "humor", "civics", "literature", "media", "governance", "culture", "environment"];
export const READING_LEVELS = ["A1", "A2", "B1", "B2", "C1"];

const hasRussian = (value) => /[А-Яа-яЁё]/u.test(String(value || ""));
const hasHan = (value) => /\p{Script=Han}/u.test(String(value || ""));
const endsAsSentence = (value) => /[.!?…。！？][»”]?$/u.test(String(value || "").trim());

export function auditReadingTexts(articles) {
  const report = {
    total: articles.length,
    original: 0,
    publicDomain: 0,
    adaptedSummary: 0,
    russianWords: 0,
    chineseCharacters: 0,
    errors: [],
    levels: Object.fromEntries(READING_LEVELS.map((level) => [level, 0])),
    categories: Object.fromEntries(READING_CATEGORIES.map((category) => [category, 0])),
  };
  const ids = new Set();
  const addError = (article, message) => report.errors.push(`${article?.id || "<missing-id>"}: ${message}`);

  for (const article of articles) {
    if (!article.id || ids.has(article.id)) addError(article, "ID 缺失或重复");
    ids.add(article.id);
    if (!article.title || !hasRussian(article.title)) addError(article, "俄文标题缺失");
    if (!article.titleZh || !hasHan(article.titleZh)) addError(article, "中文标题缺失");
    if (!READING_LEVELS.includes(article.level)) addError(article, `未知级别 ${article.level}`);
    else report.levels[article.level] += 1;
    if (!READING_CATEGORIES.includes(article.category)) addError(article, `未知分类 ${article.category}`);
    else report.categories[article.category] += 1;
    if (!article.categoryZh || !hasHan(article.categoryZh)) addError(article, "中文分类缺失");
    if (article.kind === "original") report.original += 1;
    else if (article.kind === "public-domain") report.publicDomain += 1;
    else if (article.kind === "adapted-summary") report.adaptedSummary += 1;
    else addError(article, `未知内容类型 ${article.kind}`);
    if (!article.author || !article.source || !article.date) addError(article, "作者、来源或日期缺失");
    if (!Number.isInteger(article.estimatedMinutes) || article.estimatedMinutes < 1) addError(article, "预计阅读时间无效");
    if (article.kind === "public-domain" && (!article.sourceUrl?.startsWith("https://ru.wikisource.org/") || !article.license?.includes("Public domain"))) {
      addError(article, "公版选段缺少维基文库链接或公版标记");
    }
    if (article.kind === "adapted-summary" && !article.sourceUrl?.startsWith("https://")) {
      addError(article, "联网改写文章缺少 HTTPS 来源链接");
    }
    if (!Array.isArray(article.paragraphs) || !article.paragraphs.length) {
      addError(article, "正文段落缺失");
      continue;
    }
    for (const [paragraphIndex, paragraph] of article.paragraphs.entries()) {
      if (!hasRussian(paragraph.ru) || !hasHan(paragraph.zh)) addError(article, `第 ${paragraphIndex + 1} 段双语全文缺失`);
      if (!Array.isArray(paragraph.sentences) || !paragraph.sentences.length) addError(article, `第 ${paragraphIndex + 1} 段逐句内容缺失`);
      const joinedRu = paragraph.sentences.map(({ ru }) => ru).join(" ");
      const joinedZh = paragraph.sentences.map(({ zh }) => zh).join("");
      if (paragraph.ru !== joinedRu || paragraph.zh !== joinedZh) addError(article, `第 ${paragraphIndex + 1} 段全文与逐句内容不一致`);
      for (const [sentenceIndex, sentence] of paragraph.sentences.entries()) {
        if (!hasRussian(sentence.ru)) addError(article, `第 ${paragraphIndex + 1} 段第 ${sentenceIndex + 1} 句缺少俄文`);
        if (!hasHan(sentence.zh)) addError(article, `第 ${paragraphIndex + 1} 段第 ${sentenceIndex + 1} 句缺少中文`);
        if (!endsAsSentence(sentence.ru) || !endsAsSentence(sentence.zh)) addError(article, `第 ${paragraphIndex + 1} 段第 ${sentenceIndex + 1} 句缺少句末标点`);
        report.russianWords += sentence.ru.match(/[А-Яа-яЁё]+/gu)?.length || 0;
        report.chineseCharacters += sentence.zh.match(/\p{Script=Han}/gu)?.length || 0;
      }
    }
  }
  report.valid = report.errors.length === 0
    && Object.values(report.levels).every((count) => count >= 3)
    && report.original > 0
    && report.publicDomain > 0
    && report.adaptedSummary > 0;
  return report;
}
