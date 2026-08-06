import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReadingWordIndex,
  createReadingSpeechController,
  readingLemmaCandidates,
  resolveReadingWord,
  splitReadingSentences,
  tokenizeReadingText,
} from "../src/core/index.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("reading text splits on Russian punctuation and bounds long Edge requests", () => {
  assert.deepEqual(splitReadingSentences("Привет! Как дела?\nВсё хорошо…"), ["Привет!", "Как дела?", "Всё хорошо…"]);
  assert.deepEqual(splitReadingSentences("Первая строка\nВторая строка"), ["Первая строка", "Вторая строка"]);
  const chunks = splitReadingSentences("Это очень длинная фраза, которую нужно разделить на несколько коротких частей", { maxChars: 45 });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 45));
});

test("document reading waits for each sentence before starting the next", async () => {
  const calls = [];
  const completions = [];
  const controller = createReadingSpeechController({
    stop: async () => {},
    speak: (text) => {
      calls.push(text);
      const item = deferred();
      completions.push(item);
      return { finished: item.promise };
    },
  });
  const reading = controller.readAll("Первое. Второе! Третье?");
  await tick();
  assert.deepEqual(calls, ["Первое."]);
  completions[0].resolve(); await tick();
  assert.deepEqual(calls, ["Первое.", "Второе!"]);
  completions[1].resolve(); await tick();
  completions[2].resolve();
  assert.deepEqual(await reading, { status: "completed", spoken: 3, errors: [] });
});

test("cancel releases a pending sentence and repeated clicks never overlap", async () => {
  let active = 0;
  let maximum = 0;
  let stopCount = 0;
  const pending = [];
  const controller = createReadingSpeechController({
    stop: async () => { stopCount += 1; active = 0; },
    speak: () => {
      active += 1;
      maximum = Math.max(maximum, active);
      const item = deferred();
      pending.push(item);
      return { finished: item.promise.finally(() => { active -= 1; }) };
    },
  });
  const first = controller.readAll("Один. Два.");
  await tick();
  const second = controller.readWord("слово");
  await tick();
  assert.equal((await first).status, "cancelled");
  assert.equal(maximum, 1);
  pending.at(-1).resolve();
  assert.equal((await second).status, "completed");
  assert.ok(stopCount >= 2);
});

test("an older delayed stop cannot revive a superseded reading request", async () => {
  const stops = [];
  const calls = [];
  const controller = createReadingSpeechController({
    stop: () => {
      const item = deferred();
      stops.push(item);
      return item.promise;
    },
    speak: async (text) => { calls.push(text); },
  });
  const oldReading = controller.readSentence("старое");
  const newReading = controller.readSentence("новое");
  stops[1].resolve();
  await tick();
  stops[0].resolve();
  assert.equal((await oldReading).status, "cancelled");
  assert.equal((await newReading).status, "completed");
  assert.deepEqual(calls, ["новое"]);
});

test("a failed sentence is recorded and later sentences continue", async () => {
  const calls = [];
  const controller = createReadingSpeechController({
    speak: async (text, { index }) => {
      calls.push(text);
      if (index === 1) throw new Error("provider failed");
    },
  });
  const result = await controller.readAll("Один. Два. Три.");
  assert.deepEqual(calls, ["Один.", "Два.", "Три."]);
  assert.equal(result.status, "completed");
  assert.equal(result.spoken, 2);
  assert.equal(result.errors.length, 1);
});

test("reading lookup resolves direct forms, grammar forms and conservative lemma guesses", () => {
  const words = [
    { word: "работа", stressed: "рабо́та", meaning: "工作", forms: "работа · работу" },
    { word: "интересный", meaning: "有趣的" },
    { word: "книга", meaning: "书" },
  ];
  const grammar = { "работа": { declension: { prepositional: "работе", instrumentalPlural: "работами" } } };
  const index = buildReadingWordIndex(words, grammar);
  assert.equal(resolveReadingWord("рабо́ту", index).lemma, "работа");
  assert.equal(resolveReadingWord("работами", index).lemma, "работа");
  assert.equal(resolveReadingWord("интересная", index).lemma, "интересный");
  assert.ok(readingLemmaCandidates("книги").includes("книга"));
  const tokens = tokenizeReadingText("Я читаю книги.", index);
  assert.equal(tokens.map((item) => item.text).join(""), "Я читаю книги.");
  assert.equal(tokens.find((item) => item.text === "книги").lookup.lemma, "книга");
});
