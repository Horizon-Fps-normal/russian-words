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

function meaningSegments(meaning) {
  return new Set(String(meaning || "").split(/[；;，,、\s]+/).filter(Boolean));
}

function meaningsOverlap(a, b) {
  const aSegments = meaningSegments(a);
  return [...meaningSegments(b)].some((segment) => aSegments.has(segment));
}

export function createOptions(activeWord, pool, mode = "meaning", random = Math.random, optionCount = 4) {
  const correct = answerValue(activeWord, mode);
  if (!activeWord || !correct) return [];
  const seen = new Set([correct]);
  const distractors = [];
  const candidates = shuffle(pool || [], random);
  const addDistractor = (word) => {
    const value = answerValue(word, mode);
    if (word.id === activeWord.id || !value || seen.has(value)) return false;
    seen.add(value);
    distractors.push(value);
    return true;
  };
  for (const word of candidates) {
    if (distractors.length >= optionCount - 1) break;
    if (mode === "meaning" && meaningsOverlap(word.meaning, correct)) continue;
    addDistractor(word);
  }
  if (distractors.length < optionCount - 1) {
    for (const word of candidates) {
      if (distractors.length >= optionCount - 1) break;
      addDistractor(word);
    }
  }
  return shuffle([correct, ...distractors], random);
}
