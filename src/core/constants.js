export const SCHEMA_VERSION = 2;

export const SESSION_TYPES = Object.freeze(["learn", "review", "practice"]);
export const QUIZ_MODES = Object.freeze(["meaning", "listen"]);
export const REVIEW_INTERVAL_DAYS = Object.freeze([1, 3, 7, 14, 30, 90]);
export const LEVEL_ORDER = Object.freeze({ A1: 0, A2: 1, B1: 2, B2: 3, C1: 4 });

export const DEFAULT_SETTINGS = Object.freeze({
  dailyGoal: 20,
  speed: 1,
  speedProfileVersion: 2,
  listenEnabled: true,
});

export const SPEECH_SPEEDS = Object.freeze({ slow: 0.82, standard: 1, fast: 1.15 });

export const STORAGE_KEYS = Object.freeze({
  settings: "russian-words-settings",
  progress: "russian-words-study-progress",
  record: "russian-words-record",
  addedToday: "russian-words-added-today",
});
