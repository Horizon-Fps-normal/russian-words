const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  isDesktop: true,
  platform: process.platform,
  speakRussian: (text, speed) => ipcRenderer.invoke("speak-russian", text, speed),
  stopRussian: () => ipcRenderer.invoke("stop-russian"),
  getBackgroundImage: () => ipcRenderer.invoke("get-background-image"),
  selectBackgroundImage: () => ipcRenderer.invoke("select-background-image"),
  clearBackgroundImage: () => ipcRenderer.invoke("clear-background-image"),
});
