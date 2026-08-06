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

function posGroup(pos) {
  return String(pos || "其他").split(" · ")[0] || "其他";
}

function meaningSegments(meaning) {
  return new Set(String(meaning || "").split(/[；;，,、\s]+/).filter(Boolean));
}

function meaningsOverlap(a, b) {
  const aSegments = meaningSegments(a);
  return [...meaningSegments(b)].some((segment) => aSegments.has(segment));
}

function dateSeededRandom(today) {
  let seed = 2166136261;
  for (const char of today) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLearnQueue(pool, record, addedToday, today = dateKey()) {
  const { wordIds } = normalizeAddedToday(addedToday, today);
  const byId = new Map((pool || []).map((word) => [word.id, word]));
  const added = wordIds.map((id) => byId.get(id)).filter(Boolean);
  const addedIds = new Set(added.map((word) => word.id));
  const unlearned = (pool || []).filter((word) => !record?.words?.[word.id]?.learnedAt && !addedIds.has(word.id));
  const random = dateSeededRandom(today);
  const levels = new Map();
  for (const word of unlearned) {
    const level = word.level || "其他";
    if (!levels.has(level)) levels.set(level, new Map());
    const groups = levels.get(level);
    const group = posGroup(word.pos);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(word);
  }
  for (const groups of levels.values()) {
    for (const bucket of groups.values()) {
      for (let index = bucket.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [bucket[index], bucket[swap]] = [bucket[swap], bucket[index]];
      }
    }
  }
  const queue = [];
  let lastMeaning = "";
  for (const groups of levels.values()) {
    const names = [...groups.keys()];
    const cursors = new Map(names.map((name) => [name, 0]));
    let remaining = [...groups.values()].reduce((sum, bucket) => sum + bucket.length, 0);
    while (remaining > 0) {
      for (const name of names) {
        const bucket = groups.get(name);
        const cursor = cursors.get(name);
        if (cursor >= bucket.length) continue;
        let pickIndex = cursor;
        if (lastMeaning) {
          const offset = bucket.slice(cursor).findIndex((word) => !meaningsOverlap(word.meaning, lastMeaning));
          if (offset >= 0) pickIndex = cursor + offset;
        }
        [bucket[cursor], bucket[pickIndex]] = [bucket[pickIndex], bucket[cursor]];
        const picked = bucket[cursor];
        cursors.set(name, cursor + 1);
        remaining -= 1;
        lastMeaning = picked.meaning;
        queue.push(picked);
      }
    }
  }
  return [...added, ...queue];
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
