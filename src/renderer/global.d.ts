export {};

import type {
  ReadCoilsCommand,
  ReadDiscreteInputsCommand,
  ReadHoldingRegistersCommand,
  ReadInputRegistersCommand,
  RtuMasterActionResult,
  ValidationSequenceCommand,
  ValidationSequenceResult,
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
import type {
  SerialConnectionState,
  SerialOperationResult,
  SerialPortConfig,
  SerialPortDescriptor
} from "../shared/serial/types.js";
import type {
  AddVirtualDeviceRequest,
  SetVirtualValueRequest,
  SlaveSimulatorEvent,
  SlaveSimulatorState,
  VirtualDeviceSnapshot
} from "../shared/slave/types.js";
import type {
  OpenSessionFileRequest,
  OpenSessionFileResult,
  SaveSessionFileRequest,
  SaveSessionFileResult
} from "../shared/session/types.js";

declare global {
  interface Window {
    jwModbus?: {
      appName: string;
      versions: {
        chrome?: string;
        electron?: string;
        node?: string;
      };
      window?: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
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
        readHoldingRegisters: (
          command: ReadHoldingRegistersCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        readInputRegisters: (
          command: ReadInputRegistersCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        writeSingleCoil: (
          command: WriteSingleCoilCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        writeMultipleCoils: (
          command: WriteMultipleCoilsCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        writeSingleRegister: (
          command: WriteSingleRegisterCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        writeMultipleRegisters: (
          command: WriteMultipleRegistersCommand
        ) => Promise<SerialOperationResult<RtuMasterActionResult>>;
        runJwplcValidation: (
          command: ValidationSequenceCommand
        ) => Promise<SerialOperationResult<ValidationSequenceResult>>;
      };
      slave: {
        getState: () => Promise<SerialOperationResult<SlaveSimulatorState>>;
        start: (config: SerialPortConfig) => Promise<SerialOperationResult<SlaveSimulatorState>>;
        stop: () => Promise<SerialOperationResult<SlaveSimulatorState>>;
        addDevice: (request: AddVirtualDeviceRequest) => Promise<SerialOperationResult<SlaveSimulatorState>>;
        removeDevice: (unitId: number) => Promise<SerialOperationResult<SlaveSimulatorState>>;
        getDevice: (unitId: number) => Promise<SerialOperationResult<VirtualDeviceSnapshot>>;
        setValue: (request: SetVirtualValueRequest) => Promise<SerialOperationResult<VirtualDeviceSnapshot>>;
        onEvent: (listener: (event: SlaveSimulatorEvent) => void) => () => void;
      };
      sessions: {
        saveFile: (
          request: SaveSessionFileRequest
        ) => Promise<SerialOperationResult<SaveSessionFileResult>>;
        openFile: (
          request?: OpenSessionFileRequest
        ) => Promise<SerialOperationResult<OpenSessionFileResult>>;
      };
      reports: {
        copyMarkdown: (markdown: string) => Promise<SerialOperationResult<CopyMarkdownReportResult>>;
        saveMarkdown: (
          request: SaveMarkdownReportRequest
        ) => Promise<SerialOperationResult<SaveMarkdownReportResult>>;
      };
    };
  }
}
