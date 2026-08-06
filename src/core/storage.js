import { DEFAULT_SETTINGS, SCHEMA_VERSION, SPEECH_SPEEDS, STORAGE_KEYS } from "./constants.js";
import { dateKey } from "./dates.js";
import { normalizeAddedToday } from "./queues.js";
import { normalizeRecord, normalizeSession } from "./study.js";

export function parseJson(value, fallback = null) {
  try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; }
}

export function normalizeSettings(value) {
  const storedSpeed = Number(value?.speed);
  const speed = value?.speedProfileVersion === 2
    ? Object.values(SPEECH_SPEEDS).includes(storedSpeed) ? storedSpeed : DEFAULT_SETTINGS.speed
    // Preserve the meaning of the old slow / standard / fast choices.
    : storedSpeed === 0.7 ? SPEECH_SPEEDS.slow
      : storedSpeed === 1 ? SPEECH_SPEEDS.fast
        : SPEECH_SPEEDS.standard;
  return {
    version: SCHEMA_VERSION,
    dailyGoal: [10, 20, 30].includes(Number(value?.dailyGoal)) ? Number(value.dailyGoal) : DEFAULT_SETTINGS.dailyGoal,
    speed,
    speedProfileVersion: 2,
    listenEnabled: value?.listenEnabled !== false,
  };
}

export function loadCoreState(storage, today = dateKey()) {
  const read = (key) => parseJson(storage?.getItem?.(key), null);
  const legacyProgress = read(STORAGE_KEYS.progress);
  return {
    version: SCHEMA_VERSION,
    settings: normalizeSettings(read(STORAGE_KEYS.settings)),
    record: normalizeRecord(read(STORAGE_KEYS.record)),
    addedToday: normalizeAddedToday(read(STORAGE_KEYS.addedToday), today),
    // v1 numeric offsets cannot safely be restored because they were not tied to a queue.
    sessions: legacyProgress?.version === SCHEMA_VERSION && legacyProgress.sessions ? legacyProgress.sessions : {},
  };
}

export function saveCoreState(storage, state) {
  if (!storage?.setItem) return false;
  try {
    storage.setItem(STORAGE_KEYS.settings, JSON.stringify(normalizeSettings(state.settings)));
    storage.setItem(STORAGE_KEYS.record, JSON.stringify(normalizeRecord(state.record)));
    storage.setItem(STORAGE_KEYS.addedToday, JSON.stringify(normalizeAddedToday(state.addedToday, state.addedToday?.date || dateKey())));
    storage.setItem(STORAGE_KEYS.progress, JSON.stringify({ version: SCHEMA_VERSION, sessions: state.sessions || {} }));
    return true;
  } catch { return false; }
}

export function restoreSession(state, type, queue, today = dateKey()) {
  return normalizeSession(state?.sessions?.[type], type, queue, today);
}
