import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const basePort = Number(process.env.DESKTOP_DEV_PORT || 4175);

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

let port = basePort;
while (!(await portIsFree(port))) port += 1;
const url = `http://127.0.0.1:${port}`;
if (port !== basePort) console.log(`[desktop-dev] Port ${basePort} is busy (is the app already running?), using ${port}`);
const viteCommand = path.resolve("node_modules/vite/bin/vite.js");
const electronCommand = process.platform === "win32"
  ? path.resolve("node_modules/electron/dist/electron.exe")
  : path.resolve("node_modules/electron/dist/electron");

const vite = spawn(process.execPath, [viteCommand, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  stdio: "inherit",
  shell: false,
});

let ready = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    // Vite is still starting.
  }
  await delay(250);
}

if (!ready) {
  vite.kill();
  throw new Error(`Vite did not become ready at ${url}`);
}

const electron = spawn(electronCommand, ["."], {
  env: { ...process.env, ELECTRON_START_URL: url },
  stdio: "inherit",
  shell: false,
});

const shutdown = () => {
  if (!vite.killed) vite.kill();
  if (!electron.killed) electron.kill();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
electron.on("exit", (code) => {
  shutdown();
  process.exit(code ?? 0);
});
