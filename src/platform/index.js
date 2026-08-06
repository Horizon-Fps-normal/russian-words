import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { App } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";

const RussianWords = registerPlugin("RussianWords");

export const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

const safeLocalStorage = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch { return false; }
  },
  remove(key) {
    try { window.localStorage.removeItem(key); return true; } catch { return false; }
  },
};

/** Async platform storage. Values stay as strings to preserve localStorage compatibility. */
export const storage = {
  async get(key) {
    if (!isAndroid) return safeLocalStorage.get(key);
    const { value } = await Preferences.get({ key });
    return value;
  },
  async set(key, value) {
    if (!isAndroid) return safeLocalStorage.set(key, String(value));
    await Preferences.set({ key, value: String(value) });
    return true;
  },
  async remove(key) {
    if (!isAndroid) return safeLocalStorage.remove(key);
    await Preferences.remove({ key });
    return true;
  },
  async migrateFromLocalStorage(keys) {
    if (!isAndroid) return;
    await Promise.all(keys.map(async (key) => {
      const existing = await Preferences.get({ key });
      if (existing.value !== null) return;
      const legacy = safeLocalStorage.get(key);
      if (legacy !== null) await Preferences.set({ key, value: legacy });
    }));
  },
};

export const speech = {
  async speakRussian(text, speed = 1) {
    const cleanText = String(text ?? "").trim();
    if (!cleanText) return false;
    if (isAndroid) {
      try {
        const result = await RussianWords.speakRussian({ text: cleanText, speed });
        return result?.ok !== false;
      } catch {
        return false;
      }
    }
    if (window.desktopApp?.speakRussian) {
      return Boolean(await window.desktopApp.speakRussian(cleanText, speed));
    }
    if (!("speechSynthesis" in window)) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ru-RU";
    utterance.rate = speed;
    window.speechSynthesis.speak(utterance);
    return true;
  },
  async stop() {
    if (isAndroid) await RussianWords.stopSpeaking();
    else {
      window.speechSynthesis?.cancel();
      await window.desktopApp?.stopRussian?.();
    }
  },
};

export const background = {
  async get() {
    if (isAndroid) {
      const { path } = await RussianWords.getBackgroundImage();
      return path ? Capacitor.convertFileSrc(path) : "";
    }
    return (await window.desktopApp?.getBackgroundImage?.()) || "";
  },
  async select() {
    if (isAndroid) {
      const { path } = await RussianWords.selectBackgroundImage();
      return path ? Capacitor.convertFileSrc(path) : "";
    }
    return (await window.desktopApp?.selectBackgroundImage?.()) || "";
  },
  async clear() {
    if (isAndroid) await RussianWords.clearBackgroundImage();
    else await window.desktopApp?.clearBackgroundImage?.();
  },
};

async function haptic(action) {
  if (!isAndroid) return;
  try { await action(); } catch { /* Devices may disable vibration. */ }
}

export const haptics = {
  selection: () => haptic(() => Haptics.impact({ style: ImpactStyle.Light })),
  success: () => haptic(() => Haptics.notification({ type: NotificationType.Success })),
  error: () => haptic(() => Haptics.notification({ type: NotificationType.Error })),
};

export const system = {
  async initialize() {
    if (!isAndroid) return;
    try {
      await StatusBar.setOverlaysWebView({ overlay: true });
      const darkTheme = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      await StatusBar.setStyle({ style: darkTheme ? Style.Light : Style.Dark });
    } catch { /* Keep the app usable if a system-bar call is unavailable. */ }
  },
  async onBackButton(handler) {
    if (!isAndroid) return () => {};
    const listener = await App.addListener("backButton", ({ canGoBack }) => handler({ canGoBack }));
    return () => listener.remove();
  },
  exitApp() {
    if (isAndroid) App.exitApp();
  },
};
