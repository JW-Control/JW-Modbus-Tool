import { BrowserWindow, clipboard, dialog, ipcMain, app } from "electron";
import type { OpenDialogOptions, SaveDialogOptions } from "electron";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { masterConnection } from "./modbus/masterConnection.js";
import {
  executeModbusRequest,
  sendRawFrame,
  readCoils,
  readDiscreteInputs,
  readHoldingRegisters,
  readInputRegisters,
  runJwplcValidationSequence,
  writeMultipleCoils,
  writeMultipleRegisters,
  writeSingleCoil,
  writeSingleRegister
} from "./modbus/rtuMasterActions.js";
import { slaveSimulator } from "./modbus/rtuSlaveSimulator.js";
import { serialManager, toSerialResult } from "./serial/serialManager.js";
import type {
  ModbusCommand,
  RawFrameCommand,
  ReadCoilsCommand,
  ReadDiscreteInputsCommand,
  ReadHoldingRegistersCommand,
  ReadInputRegistersCommand,
  ValidationSequenceCommand,
  WriteMultipleCoilsCommand,
  WriteMultipleRegistersCommand,
  WriteSingleCoilCommand,
  WriteSingleRegisterCommand
} from "../shared/modbus/masterActionTypes.js";
import type {
  CopyMarkdownReportResult,
  SaveMarkdownReportRequest,
  SaveMarkdownReportResult
} from "../shared/report/types.js";
import type { SerialPortConfig } from "../shared/serial/types.js";
import type {
  AddVirtualDeviceRequest,
  SetVirtualFaultsRequest,
  SetVirtualValueRequest,
  SlaveTcpConfig,
  VirtualDeviceConfig
} from "../shared/slave/types.js";
import type { AppendTextFileRequest, SaveTextFileRequest, SaveTextFileResult } from "../shared/files/types.js";
import type {
  OpenSessionFileRequest,
  OpenSessionFileResult,
  SaveSessionFileRequest,
  SaveSessionFileResult
} from "../shared/session/types.js";

/** Files the user picked with file:saveText; only these can be appended to. */
const appendableFiles = new Set<string>();

export function registerIpcHandlers(): void {
  ipcMain.handle("file:saveText", async (event, request: SaveTextFileRequest) =>
    toSerialResult<SaveTextFileResult>(async () => {
      if (typeof request?.text !== "string") throw new Error("No hay texto para guardar");
      const lastDir = await getLastDir();
      const fileName = String(request.defaultFileName || "datos.txt").replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");
      const options: SaveDialogOptions = {
        title: request.title ?? "Guardar archivo",
        defaultPath: lastDir ? join(lastDir, fileName) : fileName,
        filters: request.filters
      };
      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const saveResult = parentWindow ? await dialog.showSaveDialog(parentWindow, options) : await dialog.showSaveDialog(options);
      if (saveResult.canceled || !saveResult.filePath) return { canceled: true };
      await setLastDir(saveResult.filePath);
      await writeFile(saveResult.filePath, request.text, "utf8");
      appendableFiles.add(saveResult.filePath);
      return { canceled: false, filePath: saveResult.filePath, bytesWritten: Buffer.byteLength(request.text, "utf8") };
    })
  );
  ipcMain.handle("file:appendText", async (_event, request: AppendTextFileRequest) =>
    toSerialResult(async () => {
      if (!request || !appendableFiles.has(request.filePath)) {
        throw new Error("Ese archivo no se eligió en esta sesión de la app");
      }
      await appendFile(request.filePath, String(request.text), "utf8");
      return { bytesWritten: Buffer.byteLength(String(request.text), "utf8") };
    })
  );
  ipcMain.handle("window:minimize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });
  ipcMain.handle("window:maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });
  ipcMain.handle("window:close", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });
  ipcMain.handle("serial:listPorts", async () => toSerialResult(() => serialManager.listPorts()));
  ipcMain.handle("serial:getConnectionState", async () =>
    toSerialResult(async () => masterConnection.getState())
  );
  ipcMain.handle("serial:open", async (_event, config: SerialPortConfig) =>
    toSerialResult(async () => {
      const simulatorPath = slaveSimulator.getState().config?.path;
      if (config?.transport !== "tcp" && simulatorPath && samePortPath(simulatorPath, config?.path)) {
        throw new Error(`${simulatorPath} está ocupado por el simulador slave. Usa otro puerto para el master.`);
      }
      return masterConnection.open(config);
    })
  );
  ipcMain.handle("serial:close", async () => toSerialResult(() => masterConnection.close()));
  serialManager.setInternalEndpoint(slaveSimulator.internalEndpoint());
  slaveSimulator.onEvent((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("slave:event", event);
    }
  });
  ipcMain.handle("slave:getState", async () => toSerialResult(async () => slaveSimulator.getState()));
  ipcMain.handle("slave:start", async (_event, config: SerialPortConfig) =>
    toSerialResult(async () => {
      const master = masterConnection.getState();
      if (master.connected && master.config?.transport !== "tcp" && master.config && samePortPath(master.config.path, config?.path)) {
        throw new Error(`${master.config.path} está abierto como master. Desconéctalo o elige otro puerto para el simulador.`);
      }
      return slaveSimulator.start(config);
    })
  );
  ipcMain.handle("slave:stop", async () => toSerialResult(() => slaveSimulator.stop()));
  ipcMain.handle("slave:startTcp", async (_event, config: SlaveTcpConfig) => toSerialResult(() => slaveSimulator.startTcp(config)));
  ipcMain.handle("slave:stopTcp", async () => toSerialResult(() => slaveSimulator.stopTcp()));
  ipcMain.handle("slave:addDevice", async (_event, request: AddVirtualDeviceRequest) =>
    toSerialResult(async () => slaveSimulator.addDevice(request))
  );
  ipcMain.handle("slave:removeDevice", async (_event, unitId: number) =>
    toSerialResult(async () => slaveSimulator.removeDevice(unitId))
  );
  ipcMain.handle("slave:getDevice", async (_event, unitId: number) =>
    toSerialResult(async () => slaveSimulator.getDevice(unitId))
  );
  ipcMain.handle("slave:setValue", async (_event, request: SetVirtualValueRequest) =>
    toSerialResult(async () => slaveSimulator.setValue(request))
  );
  ipcMain.handle("slave:setFaults", async (_event, request: SetVirtualFaultsRequest) =>
    toSerialResult(async () => slaveSimulator.setFaults(request))
  );
  ipcMain.handle("slave:getTraffic", async () => toSerialResult(async () => slaveSimulator.getTraffic()));
  ipcMain.handle("slave:clearTraffic", async () => toSerialResult(async () => slaveSimulator.clearTraffic()));
  ipcMain.handle("slave:exportDevices", async () => toSerialResult(async () => slaveSimulator.exportDevices()));
  ipcMain.handle("slave:importDevices", async (_event, devices: VirtualDeviceConfig[]) =>
    toSerialResult(async () => slaveSimulator.importDevices(devices))
  );
  ipcMain.handle("modbus:readDiscreteInputs", async (_event, command: ReadDiscreteInputsCommand) =>
    toSerialResult(() => readDiscreteInputs(command))
  );
  ipcMain.handle("modbus:readCoils", async (_event, command: ReadCoilsCommand) =>
    toSerialResult(() => readCoils(command))
  );
  ipcMain.handle("modbus:readHoldingRegisters", async (_event, command: ReadHoldingRegistersCommand) =>
    toSerialResult(() => readHoldingRegisters(command))
  );
  ipcMain.handle("modbus:readInputRegisters", async (_event, command: ReadInputRegistersCommand) =>
    toSerialResult(() => readInputRegisters(command))
  );
  ipcMain.handle("modbus:writeSingleCoil", async (_event, command: WriteSingleCoilCommand) =>
    toSerialResult(() => writeSingleCoil(command))
  );
  ipcMain.handle("modbus:writeMultipleCoils", async (_event, command: WriteMultipleCoilsCommand) =>
    toSerialResult(() => writeMultipleCoils(command))
  );
  ipcMain.handle("modbus:writeSingleRegister", async (_event, command: WriteSingleRegisterCommand) =>
    toSerialResult(() => writeSingleRegister(command))
  );
  ipcMain.handle("modbus:writeMultipleRegisters", async (_event, command: WriteMultipleRegistersCommand) =>
    toSerialResult(() => writeMultipleRegisters(command))
  );
  ipcMain.handle("modbus:execute", async (_event, command: ModbusCommand) =>
    toSerialResult(() => executeModbusRequest(command))
  );
  ipcMain.handle("modbus:sendRaw", async (_event, command: RawFrameCommand) =>
    toSerialResult(() => sendRawFrame(command))
  );
  ipcMain.handle("modbus:runJwplcValidation", async (_event, command: ValidationSequenceCommand) =>
    toSerialResult(() => runJwplcValidationSequence(command))
  );
  ipcMain.handle("session:saveFile", async (event, request: SaveSessionFileRequest) =>
    toSerialResult<SaveSessionFileResult>(async () => {
      assertSessionData(request?.data);
      const json = `${JSON.stringify(request.data, null, 2)}\n`;
      let filePath = typeof request.filePath === "string" && request.filePath.trim() ? request.filePath : undefined;

      if (!filePath) {
        let defaultPath = normalizeSessionFileName(request.defaultFileName);
        const lastDir = await getLastDir();
        if (lastDir) defaultPath = join(lastDir, defaultPath);

        const options: SaveDialogOptions = {
          title: "Guardar sesión JW Modbus",
          defaultPath,
          filters: [{ name: "JW Modbus Session", extensions: ["jwmodbus-session"] }]
        };
        const parentWindow = BrowserWindow.fromWebContents(event.sender);
        const saveResult = parentWindow
          ? await dialog.showSaveDialog(parentWindow, options)
          : await dialog.showSaveDialog(options);

        if (saveResult.canceled || !saveResult.filePath) {
          return { canceled: true };
        }
        filePath = saveResult.filePath;
      }

      await setLastDir(filePath);
      await writeFile(filePath, json, "utf8");
      return { canceled: false, filePath, bytesWritten: Buffer.byteLength(json, "utf8") };
    })
  );
  ipcMain.handle("session:openFile", async (event, request?: OpenSessionFileRequest) =>
    toSerialResult<OpenSessionFileResult>(async () => {
      let filePath = typeof request?.filePath === "string" && request.filePath.trim() ? request.filePath : undefined;

      if (!filePath) {
        const lastDir = await getLastDir();
        const options: OpenDialogOptions = {
          title: "Abrir sesión JW Modbus",
          defaultPath: lastDir,
          properties: ["openFile"],
          filters: [{ name: "JW Modbus Session", extensions: ["jwmodbus-session"] }]
        };
        const parentWindow = BrowserWindow.fromWebContents(event.sender);
        const openResult = parentWindow
          ? await dialog.showOpenDialog(parentWindow, options)
          : await dialog.showOpenDialog(options);

        if (openResult.canceled || openResult.filePaths.length === 0) {
          return { canceled: true };
        }
        filePath = openResult.filePaths[0];
      }

      await setLastDir(filePath);
      const raw = await readFile(filePath, "utf8");
      return { canceled: false, filePath, data: JSON.parse(raw) };
    })
  );
  ipcMain.handle("report:copyMarkdown", async (_event, markdown: string) =>
    toSerialResult<CopyMarkdownReportResult>(async () => {
      assertMarkdown(markdown);
      clipboard.writeText(markdown);
      return { characters: markdown.length };
    })
  );
  ipcMain.handle("report:saveMarkdown", async (event, request: SaveMarkdownReportRequest) =>
    toSerialResult<SaveMarkdownReportResult>(async () => {
      assertMarkdown(request?.markdown);
      const defaultFileName = normalizeMarkdownFileName(request.defaultFileName);
      const options = {
        title: "Save JWPLC validation report",
        defaultPath: defaultFileName,
        filters: [{ name: "Markdown", extensions: ["md"] }]
      };
      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const saveResult = parentWindow
        ? await dialog.showSaveDialog(parentWindow, options)
        : await dialog.showSaveDialog(options);

      if (saveResult.canceled || !saveResult.filePath) {
        return { canceled: true };
      }

      await writeFile(saveResult.filePath, request.markdown, "utf8");

      return {
        canceled: false,
        filePath: saveResult.filePath,
        bytesWritten: Buffer.byteLength(request.markdown, "utf8")
      };
    })
  );
}

function samePortPath(left: string, right: unknown): boolean {
  return typeof right === "string" && left.trim().toUpperCase() === right.trim().toUpperCase();
}

function assertMarkdown(markdown: unknown): asserts markdown is string {
  if (typeof markdown !== "string" || markdown.trim().length === 0) {
    throw new Error("No Markdown report is available");
  }
}

function assertSessionData(data: unknown): asserts data is object {
  if (!data || typeof data !== "object") {
    throw new Error("No session data is available");
  }
}

function normalizeMarkdownFileName(fileName: string | undefined): string {
  const baseName = (fileName?.trim() || "jwplc-validation-report.md")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-");

  return baseName.toLowerCase().endsWith(".md") ? baseName : `${baseName}.md`;
}

function normalizeSessionFileName(fileName: string | undefined): string {
  const baseName = (fileName?.trim() || "Nueva_sesion_Modbus")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-");

  return baseName.toLowerCase().endsWith(".jwmodbus-session") ? baseName : `${baseName}.jwmodbus-session`;
}

async function getLastDir(): Promise<string | undefined> {
  try {
    const configPath = join(app.getPath("userData"), "modbus-tool-config.json");
    const data = JSON.parse(await readFile(configPath, "utf8"));
    return data.lastDir;
  } catch {
    return undefined;
  }
}

async function setLastDir(filePath: string): Promise<void> {
  try {
    const configPath = join(app.getPath("userData"), "modbus-tool-config.json");
    let data: any = {};
    try {
      data = JSON.parse(await readFile(configPath, "utf8"));
    } catch {}
    data.lastDir = dirname(filePath);
    await writeFile(configPath, JSON.stringify(data), "utf8");
  } catch {}
}

