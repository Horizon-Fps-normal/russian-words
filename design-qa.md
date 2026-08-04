# Design QA

- Reference: selected ImageGen direction 1, the today-learning dashboard.
- Desktop check: Electron development window and packaged `Русский单词.exe` launched successfully on Windows.
- Visual checks: off-white canvas, restrained blue accent, left navigation, daily progress, due-word table, and compact professional density match the selected direction.
- Primary interaction: today dashboard -> start new-word session -> Russian word with stress mark -> choose Chinese meaning -> open word detail -> continue to the next question.
- Review interaction: review entry points open a separate review session, and both meaning and listening answers open the same word-detail view before continuing.
- Dictionary interaction: dictionary search covers Russian spelling, stress-marked spelling, Chinese meanings, English reference glosses, and level filters; selecting a result opens its detail view.
- Data check: the app bundles 29,500 OpenRussian reference entries for lookup and adds 305 hand-reviewed Chinese glosses for common beginner words; missing Chinese glosses are explicitly labeled instead of silently machine-translated.
- Secondary interaction: switch to listening mode -> play Russian audio/TTS fallback -> choose the Russian word.
- Audio check: desktop IPC uses Microsoft Edge Neural TTS with local MP3 caching; Windows Speech and browser speech synthesis remain fallback providers.
- Customization check: settings can import a local image, persist it under Electron userData, reload it after restart, and restore the default background.
- Accessibility/HTML check: list rows use keyboard-focusable button semantics without nested buttons; audio controls remain independent.
- Runtime check: no browser error or warning logs on the final fresh-tab pass.
- Scope note: the Windows desktop shell and NSIS installer are now present. The sample corpus is representative; full A1-C1 data, licensed human recordings, persistence, and on-demand audio storage are next-phase work.

Final result: passed
