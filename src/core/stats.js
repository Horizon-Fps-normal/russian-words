import { dateKey, daysBetween } from "./dates.js";
import { getReviewItems } from "./queues.js";

export function getTodayStats(pool, record, today = dateKey()) {
  const learnedToday = (pool || []).filter((word) => record?.words?.[word.id]?.learnedAt === today).length;
  const dueWords = getReviewItems(pool, record, today).filter((item) => item.isDue).map((item) => item.word);
  return { learnedToday, dueWords };
}

export function getHistoryStats(pool, record, today = dateKey()) {
  const poolIds = new Set((pool || []).map((word) => word.id));
  const entries = Object.entries(record?.words || {}).filter(([id]) => poolIds.has(id));
  const activeDates = new Set();
  let learnedCount = 0;
  let attempts = 0;
  let correct = 0;
  for (const [, entry] of entries) {
    if (entry.learnedAt) { learnedCount += 1; activeDates.add(entry.learnedAt); }
    if (entry.lastSeen) activeDates.add(entry.lastSeen);
    attempts += Math.max(0, Number(entry.attempts) || 0);
    correct += Math.max(0, Number(entry.correct) || 0);
  }
  let streak = 0;
  let cursor = activeDates.has(today) ? today : null;
  if (!cursor) {
    const yesterday = [...activeDates].find((day) => daysBetween(day, today) === 1);
    cursor = yesterday || null;
  }
  while (cursor && activeDates.has(cursor)) {
    streak += 1;
    const previous = [...activeDates].find((day) => daysBetween(day, cursor) === 1);
    cursor = previous || null;
  }
  return { learnedCount, streak, accuracy: attempts ? Math.round(correct / attempts * 100) : null };
}

export function getHistoryDays(pool, record, limit = 5) {
  const counts = new Map();
  for (const word of pool || []) {
    const learnedAt = record?.words?.[word.id]?.learnedAt;
    if (learnedAt) counts.set(learnedAt, (counts.get(learnedAt) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[0].localeCompare(a[0])).slice(0, limit).map(([date, count]) => ({ date, count }));
}
