import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const androidEnvironment = { ...process.env, VITE_APP_TARGET: "android" };

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [resolve(script), ...args], {
    cwd: process.cwd(),
    env: androidEnvironment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

runNode("node_modules/vite/bin/vite.js", ["build"]);
runNode("scripts/prepare-sites-build.mjs");
runNode("node_modules/@capacitor/cli/bin/capacitor", ["sync", "android"]);
