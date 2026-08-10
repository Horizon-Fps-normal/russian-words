# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product direction

- The product has two local application targets: the existing Windows desktop application and an Android application. The Vite page is the shared local UI layer used by the Electron desktop shell, the Capacitor Android shell, and Sites compatibility; it is not primarily a web product.
- The Android UI must be a substantial Material 3 mobile redesign rather than a scaled desktop layout. Target Redmi K80-class portrait screens first (360-430dp logical width), respect system bars and gesture insets, and keep all learning content and functional scope available.
- Preserve the existing Windows/Electron build while adding Android; do not remove `.openai/hosting.json`, the Sites worker/build preparation, or their tests.
- Preserve the primary Russian-to-Chinese learning flow and keep listening discrimination as a secondary mode.
- On Android, the word-book list keeps meanings hidden until a row is tapped; an expanded row exposes a dedicated lookup control that opens a Material 3 bottom-sheet word detail instead of abruptly navigating away.
- Reading includes an offline phrase encyclopedia grouped by learning purpose. Every entry supplies a Chinese gloss, an original bilingual example, a short usage note, and Russian speech controls.
- Daily study goal is a milestone, not a cap: after reaching the daily quota the user can keep studying ("继续学习") and every learned word is still recorded. Study records, settings, and date-scoped today-added words persist in platform-local storage (desktop may retain the existing localStorage compatibility path).
- Review uses spaced repetition (1/3/7/14/30/90 day stages); a correct review answer advances the stage, a wrong one resets it.
- Study pool = local words + OpenRussian words with Chinese glosses (`russian-chinese-core.json` 315 + `russian-chinese-extra.json` 800, merged by `scripts/add-chinese-glosses.mjs`), sorted A1→C1. Example sentences come from `russian-examples.json` (fetched from openrussian.org by `scripts/fetch-examples.mjs`, with Chinese translations). Grammar tables (declensions/conjugations, incl. pronouns) come from `russian-grammar.json` (fetched by `scripts/fetch-grammar.mjs`). Lookup/examples/grammar data are lazy-loaded chunks.
- Use a platform adapter for device-specific capabilities. Windows TTS continues through desktop IPC (Edge TTS in the main process); Android uses its native/Capacitor speech, persistence, media-picker, system-bar, back-navigation, and haptics paths with safe web fallbacks.
- Keep temporary Android SDK, JDK, Gradle caches, downloads, and disposable build artifacts under `D:\software(other)\russia\russian-words-0.2.0\codex_shit` whenever tooling permits.
