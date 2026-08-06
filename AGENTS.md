# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product direction

- The deliverable is a Windows desktop application, not a web product. The Vite page is only the local UI layer used by the Electron desktop shell and for Sites compatibility.
- Preserve the primary Russian-to-Chinese learning flow and keep listening discrimination as a secondary mode.
- Daily study goal is a milestone, not a cap: after reaching the daily quota the user can keep studying ("继续学习") and every learned word is still recorded. Study records, settings, and today-added words persist locally in localStorage.
- The learn queue must not present near-identical words in a row (the OpenRussian frequency head is a wall of A1 function words with overlapping glosses): unlearned words are ordered by level, then interleaved by POS category with a day-seeded shuffle, avoiding consecutive words whose Chinese glosses overlap. The seed is derived from the date so a resumed session keeps a stable order within the same day.
- The learn-session breakpoint (progress) is clamped to "words actually learned today + words added today", so stale or wiped local data can never make the session skip words or show phantom learned counts. A wrong learn answer does not mark the word as learned.
- Quiz distractors prefer meanings that do not overlap the correct answer's gloss.
- Settings includes a "清空学习数据" button (confirm-gated) that clears study records, progress, and today-added words; the app deliberately keeps its data in `%APPDATA%\words` across reinstall/update, so the reset is the user-facing escape hatch.
- Review uses spaced repetition (1/3/7/14/30/90 day stages); a correct review answer advances the stage, a wrong one resets it.
- Study pool = local words + OpenRussian words with Chinese glosses (`russian-chinese-core.json` 315 + `russian-chinese-extra.json` 800, merged by `scripts/add-chinese-glosses.mjs`), sorted A1→C1. Example sentences come from `russian-examples.json` (fetched from openrussian.org by `scripts/fetch-examples.mjs`, with Chinese translations). Grammar tables (declensions/conjugations, incl. pronouns) come from `russian-grammar.json` (fetched by `scripts/fetch-grammar.mjs`). Lookup/examples/grammar data are lazy-loaded chunks.
- Product scope is Windows desktop only (Electron). Android/Capacitor/PWA support was removed; TTS always goes through the desktop IPC (Edge TTS in the main process).
