const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");
const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const { mkdir, readFile, unlink, writeFile } = require("node:fs/promises");
const path = require("node:path");

const isDev = Boolean(process.env.ELECTRON_START_URL);
let speechProcess = null;
const edgeAudioMemory = new Map();
let edgeTtsModulePromise;
const backgroundDirectoryName = "background";
const backgroundFileName = "background.image";
const backgroundMetaName = "background.json";

function getBackgroundPaths() {
  const directory = path.join(app.getPath("userData"), backgroundDirectoryName);
  return {
    directory,
    image: path.join(directory, backgroundFileName),
    meta: path.join(directory, backgroundMetaName),
  };
}

async function loadBackgroundImage() {
  const { image, meta } = getBackgroundPaths();
  try {
    const metadata = JSON.parse(await readFile(meta, "utf8"));
    const file = await readFile(image);
    return `data:${metadata.mimeType};base64,${file.toString("base64")}`;
  } catch {
    return null;
  }
}

async function selectBackgroundImage() {
  const result = await dialog.showOpenDialog({
    title: "选择应用背景",
    properties: ["openFile"],
    filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const source = result.filePaths[0];
  const file = await readFile(source);
  if (file.length > 8 * 1024 * 1024) throw new Error("背景图片不能超过 8 MB");
  const extension = path.extname(source).toLowerCase();
  const mimeType = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : extension === ".gif" ? "image/gif" : "image/jpeg";
  const { directory, image, meta } = getBackgroundPaths();
  await mkdir(directory, { recursive: true });
  await writeFile(image, file);
  await writeFile(meta, JSON.stringify({ mimeType }));
  return `data:${mimeType};base64,${file.toString("base64")}`;
}

async function clearBackgroundImage() {
  const { image, meta } = getBackgroundPaths();
  await Promise.all([unlink(image).catch(() => {}), unlink(meta).catch(() => {})]);
}

function cleanRussianText(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function edgeRateForSpeed(speed) {
  const value = Number.isFinite(Number(speed)) ? Number(speed) : 0.82;
  return `${Math.round((value - 1) * 100)}%`;
}

function getEdgeCachePath(text, speed) {
  const hash = createHash("sha256").update(`${text}|${speed}`).digest("hex");
  return path.join(app.getPath("userData"), "tts-cache", `${hash}.mp3`);
}

async function synthesizeWithEdgeTts(text, speed) {
  const cleanText = cleanRussianText(text);
  const cacheKey = `${cleanText}|${speed}`;
  if (edgeAudioMemory.has(cacheKey)) return edgeAudioMemory.get(cacheKey);

  const cachePath = getEdgeCachePath(cleanText, speed);
  try {
    const cached = await readFile(cachePath);
    const base64 = cached.toString("base64");
    edgeAudioMemory.set(cacheKey, base64);
    return base64;
  } catch {
    // Generate and cache the word on first use.
  }

  edgeTtsModulePromise ??= import("edge-tts-universal");
  const { EdgeTTS } = await edgeTtsModulePromise;
  const tts = new EdgeTTS(cleanText, "ru-RU-SvetlanaNeural", {
    rate: edgeRateForSpeed(speed),
    volume: "+0%",
    pitch: "+0Hz",
  });
  const result = await tts.synthesize();
  const audio = Buffer.from(await result.audio.arrayBuffer());
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, audio);
  const base64 = audio.toString("base64");
  edgeAudioMemory.set(cacheKey, base64);
  return base64;
}

function speakWithWindowsVoice(text, speed) {
  if (process.platform !== "win32") return Promise.reject(new Error("Windows voice is unavailable"));
  if (speechProcess) speechProcess.kill();

  const encodedText = Buffer.from(String(text || ""), "utf8").toString("base64");
  const value = Number.isFinite(Number(speed)) ? Number(speed) : 0.82;
  const rate = Math.round((value - 1) * 10);
  const script = [
    "Add-Type -AssemblyName System.Speech",
    "$bytes = [Convert]::FromBase64String($env:RUSSIAN_WORD_TEXT)",
    "$text = [Text.Encoding]::UTF8.GetString($bytes)",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'ru-*' } | Select-Object -First 1",
    "if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }",
    `$synth.Rate = ${rate}`,
    "$synth.Volume = 100",
    "$synth.Speak($text)",
    "$synth.Dispose()",
  ].join("; ");

  speechProcess = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
    env: { ...process.env, RUSSIAN_WORD_TEXT: encodedText },
    windowsHide: true,
  });

  const currentProcess = speechProcess;
  return new Promise((resolve, reject) => {
    let errorText = "";
    currentProcess.stderr.on("data", (chunk) => { errorText += chunk.toString(); });
    currentProcess.once("error", reject);
    currentProcess.once("exit", (code) => {
      if (speechProcess === currentProcess) speechProcess = null;
      if (code === 0) resolve();
      else reject(new Error(errorText || `Windows voice exited with code ${code}`));
    });
  });
}

ipcMain.handle("speak-russian", async (_event, text, speed) => {
  try {
    return { provider: "edge-neural", audioBase64: await synthesizeWithEdgeTts(text, speed) };
  } catch {
    try {
      await speakWithWindowsVoice(text, speed);
      return { provider: "windows" };
    } catch {
      return { provider: "browser" };
    }
  }
});
ipcMain.handle("get-background-image", () => loadBackgroundImage());
ipcMain.handle("select-background-image", () => selectBackgroundImage());
ipcMain.handle("clear-background-image", () => clearBackgroundImage());

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: "#f7f8fa",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (isDev && url.startsWith(process.env.ELECTRON_START_URL)) return;
    event.preventDefault();
  });

  if (isDev) {
    window.loadURL(process.env.ELECTRON_START_URL);
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "client", "index.html"));
  }

  return window;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
