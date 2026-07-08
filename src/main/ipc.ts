import { ipcMain } from "electron";
import { listSerialPorts } from "./serial/serialManager.js";

export function registerIpcHandlers(): void {
  ipcMain.handle("serial:listPorts", async () => listSerialPorts());
}
