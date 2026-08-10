import { normalizeRussian } from "./russian.js";
import { buildExampleWordIndex, splitRussianText } from "./words.js";

function addCandidate(set, stem, endings) {
  if (!stem || stem.length < 2) return;
  for (const ending of endings) set.add(stem + ending);
}

/** Conservative morphology guesses; a guess is used only if it exists in the dictionary. */
export function readingLemmaCandidates(token) {
  const value = normalizeRussian(token);
  const candidates = new Set([value]);
  const rules = [
    [/ая$/u, ["ый", "ий", "ой"]], [/яя$/u, ["ий"]],
    [/(?:ое|ую)$/u, ["ый", "ой"]], [/(?:ее|юю)$/u, ["ий"]],
    [/(?:ые|ых|ыми)$/u, ["ый"]], [/(?:ие|их|ими)$/u, ["ий"]],
    [/(?:ого|ому|ым|ом)$/u, ["ый", "ой"]], [/(?:его|ему|им|ем)$/u, ["ий"]],
    [/ами$/u, ["а"]], [/ями$/u, ["я"]], [/ах$/u, ["а"]], [/ях$/u, ["я"]],
    [/(?:ой|ою)$/u, ["а"]], [/(?:ей|ею)$/u, ["я", "ь"]],
    [/у$/u, ["", "а"]], [/ю$/u, ["ть", "ить", "ать", "еть", "я", "ь"]], [/е$/u, ["а", "я", "ь"]],
    [/ы$/u, ["а"]], [/и$/u, ["а", "я", "ь", "й"]],
    [/(?:ом|ем)$/u, [""]], [/(?:ов|ев)$/u, [""]],
    [/(?:ешь|ет|ем|ете|ют)$/u, ["ть", "ать", "ять"]],
    [/(?:ишь|ит|им|ите|ят)$/u, ["ить"]],
    [/(?:ла|ло|ли|л)$/u, ["ть"]],
  ];
  for (const [pattern, endings] of rules) {
    if (!pattern.test(value)) continue;
    addCandidate(candidates, value.replace(pattern, ""), endings);
  }
  return [...candidates];
}

/** Builds a form-to-entry resolver for reading text and the full dictionary. */
export function buildReadingWordIndex(words, grammar) {
  const index = buildExampleWordIndex(words, grammar);
  for (const word of words || []) {
    if (!word) continue;
    for (const field of [word.word, word.stressed, word.forms]) {
      for (const part of splitRussianText(field)) {
        if (!part.isRussian) continue;
        const key = normalizeRussian(part.text);
        if (key && (!index.has(key) || (!index.get(key)?.meaning && word.meaning))) index.set(key, word);
      }
    }
  }
  return index;
}

export function resolveReadingWord(token, wordIndex) {
  if (!(wordIndex instanceof Map)) return null;
  for (const candidate of readingLemmaCandidates(token)) {
    const entry = wordIndex.get(candidate);
    if (entry) return { token: String(token), lemma: entry.word, entry, matchedBy: candidate === normalizeRussian(token) ? "form" : "heuristic" };
  }
  return null;
}

export function tokenizeReadingText(text, wordIndex) {
  return splitRussianText(text).map((part) => ({
    ...part,
    lookup: part.isRussian ? resolveReadingWord(part.text, wordIndex) : null,
  }));
}
