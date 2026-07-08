import { ipcMain } from "electron";
import {
  readCoils,
  readDiscreteInputs,
  runJwplcValidationSequence,
  writeMultipleCoils,
  writeSingleCoil
} from "./modbus/rtuMasterActions.js";
import { serialManager, toSerialResult } from "./serial/serialManager.js";
import type {
  ReadCoilsCommand,
  ReadDiscreteInputsCommand,
  ValidationSequenceCommand,
  WriteMultipleCoilsCommand,
  WriteSingleCoilCommand
} from "../shared/modbus/masterActionTypes.js";
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
  ipcMain.handle("modbus:writeSingleCoil", async (_event, command: WriteSingleCoilCommand) =>
    toSerialResult(() => writeSingleCoil(command))
  );
  ipcMain.handle("modbus:writeMultipleCoils", async (_event, command: WriteMultipleCoilsCommand) =>
    toSerialResult(() => writeMultipleCoils(command))
  );
  ipcMain.handle("modbus:runJwplcValidation", async (_event, command: ValidationSequenceCommand) =>
    toSerialResult(() => runJwplcValidationSequence(command))
  );
}
