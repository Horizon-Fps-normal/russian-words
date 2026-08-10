# Tatoeba example-sentence attribution

Some offline Russian–Chinese example pairs in `russian-examples.json` come from
the [Tatoeba Project](https://tatoeba.org/) and are redistributed under
[CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/).

Every imported record retains its Russian sentence ID, Mandarin translation ID,
and a stable `sourceUrl` pointing to the Tatoeba sentence page, where the author
and revision history can be inspected. Existing locally written and OpenRussian
examples are preserved.

Traditional Chinese characters in the downloaded Mandarin translations are
converted to Simplified Chinese with the OpenCC `TSCharacters` dictionary
(Apache-2.0). The Russian and Chinese sentence content is otherwise unchanged.
