import { ipcMain } from "electron";
import { serialManager, toSerialResult } from "./serial/serialManager.js";
import type { SerialPortConfig } from "../shared/serial/types.js";

export function registerIpcHandlers(): void {
  ipcMain.handle("serial:listPorts", async () => toSerialResult(() => serialManager.listPorts()));
  ipcMain.handle("serial:getConnectionState", async () =>
    toSerialResult(async () => serialManager.getConnectionState())
  );
  ipcMain.handle("serial:open", async (_event, config: SerialPortConfig) =>
    toSerialResult(() => serialManager.open(config))
  );
  ipcMain.handle("serial:close", async () => toSerialResult(() => serialManager.close()));
}
