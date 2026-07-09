import { BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";
import {
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
import { serialManager, toSerialResult } from "./serial/serialManager.js";
import type {
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

export function registerIpcHandlers(): void {
  ipcMain.handle("serial:listPorts", async () => toSerialResult(() => serialManager.listPorts()));
  ipcMain.handle("serial:getConnectionState", async () =>
    toSerialResult(async () => serialManager.getConnectionState())
  );
  ipcMain.handle("serial:open", async (_event, config: SerialPortConfig) =>
    toSerialResult(() => serialManager.open(config))
  );
  ipcMain.handle("serial:close", async () => toSerialResult(() => serialManager.close()));
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
  ipcMain.handle("modbus:runJwplcValidation", async (_event, command: ValidationSequenceCommand) =>
    toSerialResult(() => runJwplcValidationSequence(command))
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

function assertMarkdown(markdown: unknown): asserts markdown is string {
  if (typeof markdown !== "string" || markdown.trim().length === 0) {
    throw new Error("No Markdown report is available");
  }
}

function normalizeMarkdownFileName(fileName: string | undefined): string {
  const baseName = (fileName?.trim() || "jwplc-validation-report.md")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-");

  return baseName.toLowerCase().endsWith(".md") ? baseName : `${baseName}.md`;
}
