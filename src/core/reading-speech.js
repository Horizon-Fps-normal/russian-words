const SENTENCE_BOUNDARY = /(?<=[.!?…。！？])\s+|\r?\n+/u;

function splitLongSegment(text, maxChars) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars + 1);
    const preferred = Math.max(window.lastIndexOf(";"), window.lastIndexOf(":"), window.lastIndexOf(","));
    const whitespace = window.lastIndexOf(" ");
    const splitAt = preferred >= Math.floor(maxChars * 0.45) ? preferred + 1
      : whitespace >= Math.floor(maxChars * 0.45) ? whitespace
        : maxChars;
    chunks.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(splitAt).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Splits prose into bounded TTS requests while preserving sentence order. */
export function splitReadingSentences(value, options = {}) {
  const maxChars = Math.max(40, Number(options.maxChars) || 240);
  return String(value ?? "")
    .replace(/[\t\f\v ]+/gu, " ")
    .trim()
    .split(SENTENCE_BOUNDARY)
    .map((sentence) => sentence.replace(/\s+/gu, " ").trim())
    .flatMap((sentence) => splitLongSegment(sentence, maxChars))
    .filter(Boolean);
}

function completionFrom(result) {
  if (result && typeof result === "object") {
    if (result.finished && typeof result.finished.then === "function") return result.finished;
    if (result.done && typeof result.done.then === "function") return result.done;
  }
  if (result === false) return Promise.reject(new Error("Speech provider declined the request"));
  return Promise.resolve(result);
}

/**
 * A platform-neutral serial speech controller.
 *
 * `speak(text, context)` must either settle when audio ends or return an object
 * containing a `finished`/`done` Promise. Resolving only when playback starts is
 * insufficient for multi-sentence reading and should be wrapped by the caller.
 */
export function createReadingSpeechController({ speak, stop = async () => {} } = {}) {
  if (typeof speak !== "function") throw new TypeError("speak must be a function");
  if (typeof stop !== "function") throw new TypeError("stop must be a function");

  let serial = 0;
  let current = null;

  const cancelCurrent = async () => {
    const id = ++serial;
    if (current) {
      current.cancelled.resolve();
      current = null;
    }
    try { await stop(); } catch { /* A failed stop must not block the next request. */ }
    return id;
  };

  const begin = async () => {
    const id = ++serial;
    if (current) {
      current.cancelled.resolve();
      current = null;
    }
    try { await stop(); } catch { /* A failed stop must not block the next request. */ }
    if (id !== serial) return null;
    let resolveCancelled;
    const cancelledPromise = new Promise((resolve) => { resolveCancelled = resolve; });
    const request = { id, cancelled: { promise: cancelledPromise, resolve: resolveCancelled } };
    current = request;
    return request;
  };

  const run = async (segments, kind, options = {}) => {
    const request = await begin();
    if (!request) return { status: "cancelled", spoken: 0, errors: [] };
    const errors = [];
    let spoken = 0;
    for (let index = 0; index < segments.length; index += 1) {
      if (request.id !== serial) return { status: "cancelled", spoken, errors };
      const text = segments[index];
      const context = { kind, index, total: segments.length, speed: options.speed };
      options.onSegmentStart?.(text, context);
      try {
        const providerResult = await Promise.race([
          Promise.resolve().then(() => speak(text, context)),
          request.cancelled.promise.then(() => ({ cancelled: true })),
        ]);
        if (providerResult?.cancelled || request.id !== serial) {
          return { status: "cancelled", spoken, errors };
        }
        const completion = await Promise.race([
          completionFrom(providerResult).then(() => ({ completed: true })),
          request.cancelled.promise.then(() => ({ cancelled: true })),
        ]);
        if (completion.cancelled || request.id !== serial) {
          return { status: "cancelled", spoken, errors };
        }
        spoken += 1;
        options.onSegmentEnd?.(text, context);
      } catch (error) {
        if (request.id !== serial) return { status: "cancelled", spoken, errors };
        errors.push({ index, text, error });
        options.onError?.(error, text, context);
        if (options.continueOnError === false) {
          current = null;
          throw error;
        }
      }
    }
    if (current === request) current = null;
    return { status: "completed", spoken, errors };
  };

  return Object.freeze({
    readAll(text, options = {}) {
      return run(splitReadingSentences(text, options), "document", options);
    },
    readSentence(text, options = {}) {
      const sentence = String(text ?? "").trim();
      return run(sentence ? [sentence] : [], "sentence", options);
    },
    readWord(text, options = {}) {
      const word = String(text ?? "").trim();
      return run(word ? [word] : [], "word", options);
    },
    cancel: cancelCurrent,
    isSpeaking() { return current !== null; },
  });
}
