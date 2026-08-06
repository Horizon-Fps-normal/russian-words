import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const variant = process.argv[2] === "release" ? "assembleRelease" : "assembleDebug";
const androidDir = path.resolve("android");
const wrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const wrapperPath = path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");

if (!existsSync(wrapperPath)) {
  console.error("Android 工程尚未生成，请先运行 npm run android:sync。");
  process.exit(1);
}

const result = spawnSync(wrapper, [variant], {
  cwd: androidDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
