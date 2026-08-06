import test from "node:test";
import assert from "node:assert/strict";
import {
  addWordForToday,
  buildDictionary,
  buildExampleWordIndex,
  buildLearnQueue,
  buildReviewQueue,
  buildStudyPool,
  completeSessionWord,
  createOptions,
  createSession,
  getHistoryStats,
  getTodayStats,
  loadCoreState,
  normalizeRussian,
  normalizeSession,
  normalizeSettings,
  paginateItems,
  recordAnswer,
  removeRussianStress,
  reviewDueDate,
  saveCoreState,
  searchDictionary,
  splitRussianText,
} from "../src/core/index.js";

const words = [
  { id: "a", word: "маяк", stressed: "мая́к", meaning: "灯塔", level: "A1" },
  { id: "b", word: "зайка", stressed: "за́йка", meaning: "兔子", level: "A2" },
  { id: "c", word: "ёлка", stressed: "ёлка", meaning: "枞树", level: "B1" },
  { id: "d", word: "дом", stressed: "до́м", meaning: "家", level: "A1" },
];

test("Russian normalization removes stress without corrupting й or ё", () => {
  assert.equal(removeRussianStress("за́йка"), "зайка");
  assert.equal(normalizeRussian(" ЁЛКА "), "ёлка");
  assert.notEqual(normalizeRussian("зайка"), normalizeRussian("заика"));
  assert.notEqual(normalizeRussian("ёлка"), normalizeRussian("елка"));
});

test("pool merge preserves local priority, content, ordering and does not mutate inputs", () => {
  const local = [{ ...words[1], example: "local" }];
  const lookup = [{ ...words[1], meaning: "wrong" }, words[2], words[0]];
  const examples = { "мая́к": { ru: "Это маяк.", zh: "这是灯塔。" } };
  const pool = buildStudyPool(local, lookup, examples);
  assert.deepEqual(pool.map((word) => word.id), ["a", "b", "c"]);
  assert.equal(pool.find((word) => word.id === "b").meaning, "兔子");
  assert.equal(pool.find((word) => word.id === "a").example, "Это маяк.");
  assert.equal(lookup[2].example, undefined);
  assert.equal(buildDictionary(local, [{ id: "x", word: "слово", meaning: "" }]).length, 2);
});

test("dictionary search includes the actual meaningEn field", () => {
  const dictionary = [{ id: "x", word: "слово", stressed: "сло́во", meaning: "", meaningEn: "word", level: "A1" }];
  assert.deepEqual(searchDictionary(dictionary, "word").map((word) => word.id), ["x"]);
});

test("pagination exposes every dictionary item and clamps invalid pages", () => {
  const dictionary = Array.from({ length: 29_500 }, (_, index) => ({ id: index }));
  const first = paginateItems(dictionary, 1, 60);
  const last = paginateItems(dictionary, first.totalPages, 60);
  assert.equal(first.totalItems, 29_500);
  assert.equal(first.totalPages, 492);
  assert.deepEqual(first.items.map((item) => item.id), Array.from({ length: 60 }, (_, index) => index));
  assert.equal(last.page, 492);
  assert.equal(last.items.length, 40);
  assert.equal(last.items.at(-1).id, 29_499);

  const allIds = Array.from({ length: first.totalPages }, (_, index) => paginateItems(dictionary, index + 1, 60).items)
    .flat()
    .map((item) => item.id);
  assert.deepEqual(allIds, dictionary.map((item) => item.id));
  assert.equal(paginateItems(dictionary, 99_999, 60).page, 492);
  assert.equal(paginateItems(dictionary, -4, 60).page, 1);
  assert.deepEqual(paginateItems([], 8, 60), { items: [], page: 1, pageSize: 60, totalItems: 0, totalPages: 1, start: 0, end: 0 });
});

test("example lookup tokenizes Russian text and resolves inflected grammar forms", () => {
  const dictionary = [{ id: "rabota", word: "работа", stressed: "рабо́та", meaning: "工作", pos: "名词", level: "A1" }];
  const grammar = { работа: { declension: { rows: [{ cells: ["рабо́те", "рабо́тами"] }] } } };
  const index = buildExampleWordIndex(dictionary, grammar);
  assert.equal(index.get(normalizeRussian("работе")).meaning, "工作");
  assert.equal(index.get(normalizeRussian("рабо́тами")).word, "работа");
  assert.equal(index.get(normalizeRussian("рабо́та")).word, "работа");
  assert.equal(index.get(normalizeRussian("несловарное")), undefined);
  assert.deepEqual(splitRussianText("Я на рабо́те."), [
    { text: "Я", isRussian: true },
    { text: " ", isRussian: false },
    { text: "на", isRussian: true },
    { text: " ", isRussian: false },
    { text: "рабо́те", isRussian: true },
    { text: ".", isRussian: false },
  ]);
  assert.deepEqual(splitRussianText("по-русски"), [{ text: "по-русски", isRussian: true }]);
});

test("today-added words expire by date, lead queue and daily goal never caps queue", () => {
  const state = addWordForToday(null, "c", "2026-08-06");
  const record = { words: { a: { learnedAt: "2026-08-05" } } };
  assert.deepEqual(buildLearnQueue(words, record, state, "2026-08-06").map((word) => word.id), ["c", "b", "d"]);
  assert.deepEqual(buildLearnQueue(words, record, state, "2026-08-07").map((word) => word.id), ["b", "c", "d"]);
  assert.equal(buildLearnQueue(Array.from({ length: 31 }, (_, id) => ({ id: String(id) })), { words: {} }, null, "2026-08-06").length, 31);
});

test("learn queue is stable within a day and interleaves parts of speech", () => {
  const mixed = [
    { id: "n1", word: "дом", meaning: "家", level: "A1", pos: "名词 · 阳性" },
    { id: "n2", word: "стол", meaning: "桌子", level: "A1", pos: "名词 · 阳性" },
    { id: "v1", word: "читать", meaning: "阅读", level: "A1", pos: "动词 · 未完成体" },
    { id: "v2", word: "писать", meaning: "写", level: "A1", pos: "动词 · 未完成体" },
  ];
  const first = buildLearnQueue(mixed, { words: {} }, null, "2026-08-06");
  const second = buildLearnQueue(mixed, { words: {} }, null, "2026-08-06");
  assert.deepEqual(first.map((word) => word.id), second.map((word) => word.id));
  assert.deepEqual(first.map((word) => word.pos.split(" · ")[0]), ["名词", "动词", "名词", "动词"]);
});

test("SRS uses 1/3/7/14/30/90 days and caps later stages", () => {
  const expected = ["2026-08-02", "2026-08-04", "2026-08-08", "2026-08-15", "2026-08-31", "2026-10-30", "2026-10-30"];
  expected.forEach((due, stage) => assert.equal(reviewDueDate({ learnedAt: "2026-08-01", lastSeen: "2026-08-01", reviewStage: stage }), due));
});

test("review queue contains true due words sorted by due date", () => {
  const record = { words: {
    a: { learnedAt: "2026-07-01", lastSeen: "2026-08-04", reviewStage: 1 }, // due Aug 7
    b: { learnedAt: "2026-07-01", lastSeen: "2026-08-01", reviewStage: 1 }, // due Aug 4
    c: { learnedAt: "2026-07-01", lastSeen: "2026-08-06", reviewStage: 0 }, // due Aug 7
  } };
  assert.deepEqual(buildReviewQueue(words, record, "2026-08-07").map((word) => word.id), ["b", "a", "c"]);
  assert.deepEqual(getTodayStats(words, record, "2026-08-06").dueWords.map((word) => word.id), ["b"]);
});

test("wrong review followed by same-day correction stays at tomorrow interval", () => {
  let record = { words: { a: { learnedAt: "2026-07-01", lastSeen: "2026-08-01", reviewStage: 4, attempts: 0, correct: 0 } } };
  record = recordAnswer(record, { wordId: "a", sessionType: "review", correct: false, today: "2026-08-06" });
  record = recordAnswer(record, { wordId: "a", sessionType: "review", correct: true, today: "2026-08-06" });
  assert.equal(record.words.a.reviewStage, 0);
  assert.equal(reviewDueDate(record.words.a), "2026-08-07");
  assert.equal(record.words.a.attempts, 2);
  assert.equal(record.words.a.correct, 1);
  record = recordAnswer(record, { wordId: "a", sessionType: "review", correct: true, today: "2026-08-07" });
  assert.equal(record.words.a.reviewStage, 1);
});

test("practice records activity but does not learn or change SRS", () => {
  const result = recordAnswer({ words: {} }, { wordId: "a", sessionType: "practice", correct: true, today: "2026-08-06" });
  assert.equal(result.words.a.learnedAt, undefined);
  assert.equal(result.words.a.reviewStage, 0);
  assert.equal(result.words.a.lastSeen, "2026-08-06");
});

test("a wrong first learn attempt records activity but only a correct answer learns the word", () => {
  let result = recordAnswer({ words: {} }, { wordId: "a", sessionType: "learn", correct: false, today: "2026-08-06" });
  assert.equal(result.words.a.learnedAt, undefined);
  assert.equal(result.words.a.attempts, 1);
  result = recordAnswer(result, { wordId: "a", sessionType: "learn", correct: true, today: "2026-08-06" });
  assert.equal(result.words.a.learnedAt, "2026-08-06");
  assert.equal(result.words.a.reviewStage, 0);
});

test("relearning an already learned today-added word preserves its SRS stage", () => {
  const original = { words: { a: { learnedAt: "2026-07-01", lastSeen: "2026-08-01", reviewStage: 4, attempts: 2, correct: 2 } } };
  const result = recordAnswer(original, { wordId: "a", sessionType: "learn", correct: true, today: "2026-08-06" });
  assert.equal(result.words.a.learnedAt, "2026-07-01");
  assert.equal(result.words.a.reviewStage, 4);
  assert.equal(result.words.a.lastSeen, "2026-08-06");
});

test("versioned queue snapshots discard legacy offsets and reconcile by IDs", () => {
  const fresh = normalizeSession(17, "learn", words, "2026-08-06");
  assert.equal(fresh.cursor, 0);
  let session = createSession("learn", words, "2026-08-06");
  session = completeSessionWord(session, "a");
  const reordered = normalizeSession(session, "learn", [words[3], words[1], words[0]], "2026-08-06");
  assert.equal(reordered.queueIds[reordered.cursor], "b");
  assert.deepEqual(reordered.completedIds, ["a"]);
});

test("answer options support both modes and remain unique", () => {
  const random = () => 0.25;
  const meanings = createOptions(words[0], words, "meaning", random);
  const listening = createOptions(words[0], words, "listen", random);
  assert.ok(meanings.includes("灯塔"));
  assert.ok(listening.includes("маяк"));
  assert.equal(new Set(meanings).size, meanings.length);
});

test("meaning options avoid overlapping glosses when enough alternatives exist", () => {
  const pool = [
    { id: "correct", word: "и", meaning: "和；与" },
    { id: "overlap", word: "да", meaning: "和" },
    { id: "safe-1", word: "дом", meaning: "房子" },
    { id: "safe-2", word: "читать", meaning: "阅读" },
    { id: "safe-3", word: "быстро", meaning: "快速地" },
  ];
  const options = createOptions(pool[0], pool, "meaning", () => 0.5);
  assert.ok(options.includes("和；与"));
  assert.ok(!options.includes("和"));
});

test("history counts study/review/practice activity in streak and all attempts in accuracy", () => {
  const record = { words: {
    a: { learnedAt: "2026-08-04", lastSeen: "2026-08-04", attempts: 1, correct: 1 },
    b: { learnedAt: "2026-08-05", lastSeen: "2026-08-06", attempts: 3, correct: 1 },
  } };
  assert.deepEqual(getHistoryStats(words, record, "2026-08-06"), { learnedCount: 2, streak: 3, accuracy: 50 });
});

test("storage migrates v1 values, dates added words, versions schema and survives failures", () => {
  const values = new Map([
    ["russian-words-settings", JSON.stringify({ dailyGoal: 30, speed: 1, listenEnabled: false })],
    ["russian-words-study-progress", JSON.stringify({ learn: 99, review: 8 })],
    ["russian-words-record", JSON.stringify({ words: { a: { attempts: 2, correct: 1 } } })],
    ["russian-words-added-today", JSON.stringify(["a", "a", 3])],
  ]);
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const state = loadCoreState(storage, "2026-08-06");
  assert.equal(state.version, 2);
  assert.deepEqual(state.sessions, {});
  assert.deepEqual(state.addedToday.wordIds, ["a"]);
  assert.equal(state.settings.speed, 1.15);
  assert.equal(state.settings.speedProfileVersion, 2);
  assert.equal(saveCoreState(storage, state), true);
  assert.equal(JSON.parse(values.get("russian-words-study-progress")).version, 2);
  assert.equal(saveCoreState({ setItem() { throw new Error("full"); } }, state), false);
});

test("legacy speech choices migrate by meaning and standard is natural speed", () => {
  assert.equal(normalizeSettings({ speed: 0.7 }).speed, 0.82);
  assert.equal(normalizeSettings({ speed: 0.82 }).speed, 1);
  assert.equal(normalizeSettings({ speed: 1 }).speed, 1.15);
  assert.equal(normalizeSettings({ speed: 1, speedProfileVersion: 2 }).speed, 1);
});

test("corrupt persisted dates are discarded instead of crashing queues and statistics", () => {
  const storage = { getItem(key) {
    if (key !== "russian-words-record") return null;
    return JSON.stringify({ words: { a: { learnedAt: "bad", lastSeen: "2026-99-01", reviewMistakeDate: "yesterday" } } });
  } };
  const state = loadCoreState(storage, "2026-08-06");
  assert.equal(state.record.words.a.learnedAt, undefined);
  assert.equal(state.record.words.a.lastSeen, undefined);
  assert.equal(state.record.words.a.reviewMistakeDate, undefined);
  assert.deepEqual(buildReviewQueue(words, state.record, "2026-08-06"), []);
  assert.deepEqual(getHistoryStats(words, state.record, "2026-08-06"), { learnedCount: 0, streak: 0, accuracy: null });
});
