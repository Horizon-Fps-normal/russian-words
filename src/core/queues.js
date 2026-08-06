import { REVIEW_INTERVAL_DAYS } from "./constants.js";
import { addDays, dateKey } from "./dates.js";

export function normalizeAddedToday(value, today = dateKey()) {
  if (Array.isArray(value)) return { version: 2, date: today, wordIds: [...new Set(value.filter((id) => typeof id === "string"))] };
  if (!value || value.date !== today || !Array.isArray(value.wordIds)) return { version: 2, date: today, wordIds: [] };
  return { version: 2, date: today, wordIds: [...new Set(value.wordIds.filter((id) => typeof id === "string"))] };
}

export function addWordForToday(state, wordId, today = dateKey()) {
  const current = normalizeAddedToday(state, today);
  return current.wordIds.includes(wordId) ? current : { ...current, wordIds: [...current.wordIds, wordId] };
}

export function buildLearnQueue(pool, record, addedToday, today = dateKey()) {
  const { wordIds } = normalizeAddedToday(addedToday, today);
  const byId = new Map((pool || []).map((word) => [word.id, word]));
  const added = wordIds.map((id) => byId.get(id)).filter(Boolean);
  const addedIds = new Set(added.map((word) => word.id));
  const unlearned = (pool || []).filter((word) => !record?.words?.[word.id]?.learnedAt && !addedIds.has(word.id));
  return [...added, ...unlearned];
}

export function reviewDueDate(entry) {
  if (!entry?.learnedAt) return null;
  const stage = Math.max(0, Math.trunc(Number(entry.reviewStage) || 0));
  const interval = REVIEW_INTERVAL_DAYS[Math.min(stage, REVIEW_INTERVAL_DAYS.length - 1)];
  return addDays(entry.lastSeen || entry.learnedAt, interval);
}

export function getReviewItems(pool, record, today = dateKey()) {
  return (pool || []).flatMap((word, poolIndex) => {
    const entry = record?.words?.[word.id];
    const due = reviewDueDate(entry);
    return due ? [{ word, due, poolIndex, isDue: due <= today }] : [];
  }).sort((a, b) => a.due.localeCompare(b.due) || a.poolIndex - b.poolIndex);
}

export function buildReviewQueue(pool, record, today = dateKey(), { fallbackToAll = true } = {}) {
  const items = getReviewItems(pool, record, today);
  const due = items.filter((item) => item.isDue);
  return (due.length || !fallbackToAll ? due : items).map((item) => item.word);
}
