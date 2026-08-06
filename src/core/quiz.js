export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function answerValue(word, mode) {
  return mode === "listen" ? word?.word : word?.meaning;
}

export function createOptions(activeWord, pool, mode = "meaning", random = Math.random, optionCount = 4) {
  const correct = answerValue(activeWord, mode);
  if (!activeWord || !correct) return [];
  const seen = new Set([correct]);
  const distractors = [];
  for (const word of shuffle(pool || [], random)) {
    const value = answerValue(word, mode);
    if (word.id === activeWord.id || !value || seen.has(value)) continue;
    seen.add(value);
    distractors.push(value);
    if (distractors.length >= optionCount - 1) break;
  }
  return shuffle([correct, ...distractors], random);
}
