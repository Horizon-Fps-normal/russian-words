# Русский单词 · 俄语学习桌面应用

面向中文学习者的俄语单词学习应用（Windows 桌面版）。从零开始背单词，通过**每日目标 + 间隔重复复习**把词汇变成长期记忆，内置**俄语语法速查**与**神经语音发音**。

![cover](cover-russian-words-v1.png)

## ✨ 功能特性

- **每日学习目标**：默认每天 20 词，达到目标后仍可继续学习，所有记录照常累计
- **1105 词学习池**：按 A1 → B2 等级递进，学完自动进入复习轮转
- **间隔重复复习**：1 / 3 / 7 / 14 / 30 / 90 天六档复习节奏，答对升档、答错重新巩固
- **听音辨词模式**：俄语选中文 ↔ 听音选俄语，随时切换
- **俄语语法页**：六格总览、名词变格、形容词变格、动词变位（现在/将来/过去/命令式）、人称代词变格——每个词形带例句与发音
- **29,500+ 词词典**：支持中文/俄语/英文搜索，按等级筛选，词条含释义、例句、搭配
- **神经语音 TTS**：微软 Edge TTS 俄语女声，无需安装语音包，支持慢速/标准/快速三档
- **学习记录**：已掌握词数、连续学习天数、正确率，全部本地保存

## 📦 安装

### 方式一：安装程序（推荐）

下载最新版 `Russian-Words-Setup-<version>.exe`（见 [Releases](https://github.com/Horizon-Fps-normal/russian-words/releases)），双击运行，按向导安装即可。安装后可选择创建桌面快捷方式。

### 方式二：便携版（免安装）

下载 `win-unpacked` 文件夹（或解压 Release 资产），直接双击 `Русский单词.exe` 运行，可整体拷贝到 U 盘携带。

**系统要求**：Windows 10 / 11（64 位）

> 学习记录、设置与自定义背景保存在系统 `%APPDATA%` 下，升级或卸载不会丢失。

## 🛠️ 开发指南

### 环境要求

- Node.js 18+
- npm

### 安装依赖

```bash
npm install
```

### 启动开发模式

```bash
# 桌面应用开发模式（Electron 窗口 + 热更新）
npm run desktop:dev

# 或仅浏览器预览
npm run dev
```

### 打包 Windows 安装程序

```bash
npm run desktop:build
```

产物输出到 `release/`：

- `Russian-Words-Setup-<version>.exe` — NSIS 安装程序
- `win-unpacked/` — 便携版目录

### 测试

```bash
npm run test:sites   # Sites 部署兼容性测试
```

## 📚 数据说明

| 数据 | 来源 | 说明 |
|---|---|---|
| 学习池 1105 词 | OpenRussian 词库 + 自译中文词表 | 315 词核心词表 + 800 词高频扩展（`russian-chinese-extra.json`） |
| 词典 29,500 词 | [OpenRussian](https://openrussian.org/)（CC BY-SA） | 含英文释义与重音标记 |
| 双语例句 356 条 | OpenRussian 例句库 | 俄语原文 + 中文翻译 |
| 语法表 841 词条 | OpenRussian 词条页 | 变格表 / 变位表 / 代词变格，全部带发音 |

数据更新脚本（`scripts/`）：

```bash
npm run data:import        # 从 OpenRussian 源数据重新导入词库
node scripts/add-chinese-glosses.mjs   # 合并扩展中文释义
node scripts/fetch-examples.mjs        # 抓取双语例句
node scripts/fetch-grammar.mjs         # 抓取变格/变位表
```

## 🏗️ 项目结构

```
├── src/                 # React 前端（UI 层）
│   ├── App.jsx          # 主应用：学习/复习/语法/词库/记录/设置
│   └── data/            # 词库、例句、语法、中文释义数据
├── electron/            # Electron 主进程（TTS、背景图、窗口）
│   ├── main.cjs         # Edge TTS 合成 + IPC
│   └── preload.cjs      # 安全桥接（contextIsolation）
├── scripts/             # 数据抓取/导入/构建脚本
├── tests/               # Sites 部署测试
└── release/             # 打包产物（安装包/便携版）
```

## 🧱 技术栈

- **Electron 37** + **React 19** + **Vite 6**
- **edge-tts-universal**：微软 Edge 神经语音（俄语）
- **electron-builder**：Windows 安装包打包

## 📄 许可与致谢

- 词库与例句数据来源于 [OpenRussian](https://openrussian.org/)（CC BY-SA 4.0），详见 `src/data/open-russian-attribution.md`
- 中文释义与例句翻译由本项目补充
- 应用代码仅供学习交流使用
