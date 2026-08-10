import { SCHEMA_VERSION, SESSION_ORDER_VERSION, SESSION_TYPES } from "./constants.js";
import { dateKey, isDateKey } from "./dates.js";

export function normalizeRecord(value) {
  const source = value?.words && typeof value.words === "object" ? value.words : {};
  const words = {};
  for (const [id, raw] of Object.entries(source)) {
    if (!raw || typeof raw !== "object") continue;
    words[id] = {
      attempts: Math.max(0, Math.trunc(Number(raw.attempts) || 0)),
      correct: Math.max(0, Math.trunc(Number(raw.correct) || 0)),
      ...(isDateKey(raw.learnedAt) ? { learnedAt: raw.learnedAt } : {}),
      ...(isDateKey(raw.lastSeen) ? { lastSeen: raw.lastSeen } : {}),
      reviewStage: Math.max(0, Math.trunc(Number(raw.reviewStage) || 0)),
      ...(isDateKey(raw.reviewMistakeDate) ? { reviewMistakeDate: raw.reviewMistakeDate } : {}),
    };
  }
  return { version: SCHEMA_VERSION, words };
}

export function recordAnswer(record, { wordId, sessionType, correct, today = dateKey() }) {
  if (!SESSION_TYPES.includes(sessionType)) throw new TypeError(`Unknown session type: ${sessionType}`);
  if (!wordId) throw new TypeError("wordId is required");
  const normalized = normalizeRecord(record);
  const previous = normalized.words[wordId] || { attempts: 0, correct: 0, reviewStage: 0 };
  const entry = {
    ...previous,
    attempts: previous.attempts + 1,
    correct: previous.correct + (correct ? 1 : 0),
    lastSeen: today,
  };
  if (sessionType === "learn") {
    if (!previous.learnedAt && correct) {
      entry.learnedAt = today;
      entry.reviewStage = 0;
    }
  } else if (sessionType === "review") {
    if (!correct) {
      entry.reviewStage = 0;
      entry.reviewMistakeDate = today;
    } else if (previous.reviewMistakeDate === today) {
      // A correction proves recall in this attempt, but the failed review remains
      // scheduled for tomorrow rather than being promoted straight to three days.
      entry.reviewStage = 0;
      entry.reviewMistakeDate = today;
    } else {
      entry.reviewStage = previous.reviewStage + 1;
      delete entry.reviewMistakeDate;
    }
  }
  return { ...normalized, words: { ...normalized.words, [wordId]: entry } };
}

export function createSession(sessionType, queue, today = dateKey()) {
  if (!SESSION_TYPES.includes(sessionType)) throw new TypeError(`Unknown session type: ${sessionType}`);
  return {
    version: SCHEMA_VERSION,
    orderVersion: SESSION_ORDER_VERSION,
    type: sessionType,
    date: today,
    queueIds: (queue || []).map((word) => typeof word === "string" ? word : word.id).filter(Boolean),
    cursor: 0,
    completedIds: [],
  };
}

export function normalizeSession(value, sessionType, queue, today = dateKey()) {
  const queueIds = (queue || []).map((word) => typeof word === "string" ? word : word.id).filter(Boolean);
  // Numeric v1 progress had no queue identity and is intentionally discarded.
  if (!value || value.version !== SCHEMA_VERSION || value.type !== sessionType || value.date !== today || !Array.isArray(value.queueIds)) {
    return createSession(sessionType, queueIds, today);
  }
  const available = new Set(queueIds);
  const storedQueue = value.queueIds.filter((id) => available.has(id));
  const appended = queueIds.filter((id) => !storedQueue.includes(id));
  const completedIds = [...new Set((value.completedIds || []).filter((id) => available.has(id)))];
  const completed = new Set(completedIds);
  if (value.orderVersion !== SESSION_ORDER_VERSION) {
    const completedPrefix = storedQueue.filter((id) => completed.has(id));
    const missingCompleted = completedIds.filter((id) => !completedPrefix.includes(id));
    const pending = queueIds.filter((id) => !completed.has(id));
    const reconciled = [...completedPrefix, ...missingCompleted, ...pending];
    return {
      ...value,
      orderVersion: SESSION_ORDER_VERSION,
      queueIds: reconciled,
      completedIds,
      cursor: completedPrefix.length + missingCompleted.length,
    };
  }
  const reconciled = [...storedQueue, ...appended];
  const firstPending = reconciled.findIndex((id) => !completed.has(id));
  return { ...value, orderVersion: SESSION_ORDER_VERSION, queueIds: reconciled, completedIds, cursor: firstPending < 0 ? reconciled.length : firstPending };
}

export function completeSessionWord(session, wordId) {
  const completedIds = session.completedIds.includes(wordId) ? session.completedIds : [...session.completedIds, wordId];
  const completed = new Set(completedIds);
  const cursor = session.queueIds.findIndex((id) => !completed.has(id));
  return { ...session, completedIds, cursor: cursor < 0 ? session.queueIds.length : cursor };
}

export function hydrateSessionQueue(session, pool) {
  const byId = new Map((pool || []).map((word) => [word.id, word]));
  return (session?.queueIds || []).map((id) => byId.get(id)).filter(Boolean);
}
