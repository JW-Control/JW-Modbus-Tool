import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged;

if (isDevelopment) {
  const cacheDirectory = path.join(os.tmpdir(), "jw-modbus-tool", `electron-cache-${process.pid}`);
  fs.mkdirSync(cacheDirectory, { recursive: true });
  app.setPath("cache", cacheDirectory);
  app.commandLine.appendSwitch("disk-cache-dir", cacheDirectory);
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 680,
    title: "JW Modbus Tool",
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#071d2e",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "../preload/preload.cjs")
    }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? (app.isPackaged ? undefined : "http://127.0.0.1:5173");

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
    return;
  }

  void window.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
