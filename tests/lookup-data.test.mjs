import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditLookup, buildBatches, parseMarkedTranslation } from "../scripts/lookup-gloss-utils.mjs";

test("marked translation parser preserves ordering and rejects missing markers", () => {
  assert.deepEqual(parseMarkedTranslation("[[1]] 兔子\n[[0]] 从上方", 2), ["从上方", "兔子"]);
  assert.throws(() => parseMarkedTranslation("[[0]] only one", 2), /marker mismatch/);
});

test("translation batches stay below the configured URL limit", () => {
  const makeUrl = (text) => new URL(`https://example.test/?q=${encodeURIComponent(text)}`);
  const items = Array.from({ length: 30 }, (_, index) => ({ text: `gloss number ${index}` }));
  const batches = buildBatches(items, makeUrl, 240);
  assert.ok(batches.length > 1);
  assert.ok(batches.every((batch) => makeUrl(batch.map((item, index) => `[[${index}]] ${item.text}`).join("\n")).href.length <= 240));
});

test("OpenRussian lookup has complete, non-self glosses and stable identities", async () => {
  const entries = JSON.parse(await readFile("src/data/open-russian-lookup.json", "utf8"));
  const overrides = JSON.parse(await readFile("src/data/russian-gloss-overrides.json", "utf8"));
  const report = auditLookup(entries);
  assert.equal(report.total, 29_500);
  assert.deepEqual(report, {
    total: 29_500,
    missingMeaning: 0,
    missingMeaningEn: 0,
    meaningWithoutHan: 0,
    invalidRussianAsMeaning: 0,
    invalidRussianAsMeaningEn: 0,
    duplicateIds: 0,
    duplicateWords: 0,
    valid: true,
  });
  assert.ok(!entries.some((entry) => entry.source.includes("Google Translate machine gloss")));
  assert.ok(entries.some((entry) => entry.source.includes("WikDict Russian-Chinese gloss")));
  assert.ok(entries.some((entry) => entry.source.includes("Russian Wiktionary contextual definition")));
  const curated = entries.filter((entry) => entry.source.includes("manually reviewed Russian dictionary gloss"));
  assert.equal(curated.length, Object.keys(overrides).length);
  assert.ok(curated.every((entry) => entry.glossReference?.startsWith("https://")));

  const repeated = entries.filter((entry) => {
    const segments = entry.meaning.split(/[，,；;、]/).map((part) => part.trim()).filter(Boolean);
    return new Set(segments).size < segments.length;
  });
  assert.deepEqual(repeated, []);

  const expectedScreenshotGlosses = {
    герыч: "【俚语】海洛因；二乙酰吗啡",
    гердос: "【俚语】海洛因",
    герандос: "【俚语】海洛因",
    гладило: "动词 гладить 的过去时中性形式：熨；熨平；抚摸",
    глобально: "在全球范围内；全面地；从全局看",
    вприглядку: "【诙谐】喝茶或咖啡时不加糖、只看着糖；【口语】从旁观察着",
    глядя: "动词 глядеть 的副动词形式：看着；一边看",
    говнишко: "【粗俗】小块粪便；一点破烂或烂东西（говно 的指小形式）",
    говнистость: "【粗俗】卑劣、讨厌的品性；糟糕程度",
    говёный: "【粗俗、非规范拼法】差劲的；糟透的；劣质的（规范拼写：говённый）",
    говнять: "【方言】敷衍做事；把事情搞砸；发臭",
    говёно: "【粗俗、非规范拼法】糟糕地；很差劲（规范拼写：говённо）",
    какашки: "【口语、儿童用语】便便；粪便；也可指劣质的东西",
  };
  const byWord = new Map(entries.map((entry) => [entry.word, entry]));
  for (const [word, meaning] of Object.entries(expectedScreenshotGlosses)) {
    assert.equal(byWord.get(word)?.meaning, meaning, `${word} should have a reviewed Chinese gloss`);
  }
});
