export {};

import type {
  ReadCoilsCommand,
  ReadDiscreteInputsCommand,
  RtuMasterActionResult,
  ValidationSequenceCommand,
  ValidationSequenceResult,
  WriteMultipleCoilsCommand,
  WriteSingleCoilCommand
} from "../shared/modbus/masterActionTypes.js";
import type {
  SerialConnectionState,
  SerialOperationResult,
  SerialPortConfig,
  SerialPortDescriptor
} from "../shared/serial/types.js";

declare global {
  interface Window {
    jwModbus?: {
      appName: string;
      versions: {
        chrome?: string;
        electron?: string;
        node?: string;
      };
      serial: {
        listPorts: () => Promise<SerialOperationResult<SerialPortDescriptor[]>>;
        getConnectionState: () => Promise<SerialOperationResult<SerialConnectionState>>;
        open: (config: SerialPortConfig) => Promise<SerialOperationResult<SerialConnectionState>>;
        close: () => Promise<SerialOperationResult<SerialConnectionState>>;
      };
      modbus: {
        readCoils: (
          command: ReadCoilsCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        readDiscreteInputs: (
          command: ReadDiscreteInputsCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        writeSingleCoil: (
          command: WriteSingleCoilCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        writeMultipleCoils: (
          command: WriteMultipleCoilsCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        runJwplcValidation: (
          command: ValidationSequenceCommand
        ) => Promise<SerialOperationResult<ValidationSequenceResult>>;
      };
    };
  }
}
