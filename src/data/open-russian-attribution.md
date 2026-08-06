# OpenRussian 参考词库

本地查词索引由 OpenRussian.org 的公开数据生成，来源仓库为：

- https://github.com/Badestrand/russian-dictionary
- https://en.openrussian.org/dictionary-data

OpenRussian 数据以 CC BY-SA 发布。当前导入的是用于查词的俄语词条、重音、词性、词形和英译参考；原始音频没有打包，应用继续使用本地缓存的在线俄语 TTS。

当前词库页将人工整理的中文学习词条与 OpenRussian 参考词条分开处理：没有中文释义的参考词条会显示“中文释义待补充”和英译参考，不会自动把机器翻译当作权威中文释义。

俄汉译项还使用 WikDict 的 Russian–Chinese 数据。WikDict 数据由 Wiktionary 经 DBnary 抽取并以 CC BY-SA 4.0 发布；应用用它交叉核对或补充俄汉译项。机器生成的旧译文会优先由俄语维基词典的带语境释义重建，并保留逐条来源链接。

## 机器翻译补全

`scripts/rebuild-lookup-glosses.mjs` 会保留人工核心释义，按“人工覆写 → 俄语维基词典上下文释义 → WikDict 直接俄汉译项 → 英文参考兜底”的顺序重建其余释义。`scripts/audit-lookup-quality.mjs` 另外检查重复译段、俄语拉丁转写冒充英文、过短或过于宽泛的中文以及翻译过程残留文本。机器辅助生成的内容仍保留来源标记，不能替代专业词典编者的逐条人工审定。

脚本使用 Google Translate 的批量翻译响应，带编号标记校验、限速、指数退避和本地断点缓存。缓存和候选文件位于项目父目录的 `codex_shit/lookup-glosses/`。只有 `scripts/audit-lookup-glosses.mjs` 确认全部词条的中英文释义均非空、未直接复制俄语原词且 ID/词条无重复时，候选文件才会覆盖正式词库。Google Translate 服务与输出受 Google 的适用条款约束；重新生成或再分发前，维护者应再次确认其使用场景和当时条款。

机器翻译仍无法解释的少数缩写、字母名称和专名，由 `src/data/russian-gloss-overrides.json` 提供经核对的中英文释义及逐条参考链接。当前参考主要来自俄语维基词典；其文本按 CC BY-SA 发布，词条在正式数据的 `source` 和 `glossReference` 字段中保留来源与链接。相关页面包括 МТС、СП、б、ЗК、КПСС、КП、эн、КБ、кан、икс、ВЛКСМ、РТР、ЦДЛ 和 эсэсовский。

本次新增 `russian-chinese-core.json`，包含 305 个面向中文初学者的高频俄语词人工中文释义，用于改善中文搜索和常用词查找；它是应用整理层，不替代正式出版词典。
