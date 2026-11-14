import type { Framing } from "./adu.js";
import type { DeviceIdentification, ModbusRequest, ServerIdReport } from "./pdu.js";

export interface ReadDiscreteInputsCommand {
  unitId: number;
  startAddress: number;
  quantity: number;
  timeoutMs?: number;
}

export interface ReadCoilsCommand {
  unitId: number;
  startAddress: number;
  quantity: number;
  timeoutMs?: number;
}

export interface ReadHoldingRegistersCommand {
  unitId: number;
  startAddress: number;
  quantity: number;
  timeoutMs?: number;
}

export interface ReadInputRegistersCommand {
  unitId: number;
  startAddress: number;
  quantity: number;
  timeoutMs?: number;
}

export interface WriteSingleCoilCommand {
  unitId: number;
  address: number;
  value: boolean;
  timeoutMs?: number;
}

export interface WriteSingleRegisterCommand {
  unitId: number;
  address: number;
  value: number;
  timeoutMs?: number;
}

export interface WriteMultipleCoilsCommand {
  unitId: number;
  startAddress: number;
  values: boolean[];
  timeoutMs?: number;
}

export interface WriteMultipleRegistersCommand {
  unitId: number;
  startAddress: number;
  values: number[];
  timeoutMs?: number;
}

/** Any supported request, for `modbus:execute`. */
export interface ModbusCommand {
  unitId: number;
  request: ModbusRequest;
  timeoutMs?: number;
}

/** A frame typed by the user, for `modbus:sendRaw`. */
export interface RawFrameCommand {
  /** Hex bytes; spaces and separators are ignored. */
  hex: string;
  /**
   * true: `hex` is unit id + PDU, and the app adds CRC (RTU), LRC (ASCII) or
   * the MBAP header (TCP). false: `hex` is sent exactly as typed.
   */
  addCheck: boolean;
  timeoutMs?: number;
}

export interface RtuMasterActionResult {
  timestamp: string;
  elapsedMs: number;
  unitId: number;
  functionCode: number;
  summary: string;
  txHex: string;
  rxHex: string;
  /** CRC (RTU), LRC (ASCII) or MBAP header (TCP) and the reply's shape are valid. */
  crcOk: boolean;
  /** Why `crcOk` is false, in words. */
  checkError?: string;
  framing?: Framing;
  values?: boolean[];
  registerValues?: number[];
  exception?: {
    functionCode: number;
    exceptionCode: number;
    exceptionName: string;
  };
  serverId?: ServerIdReport;
  deviceId?: DeviceIdentification;
}

export interface ValidationStepResult {
  name: string;
  passed: boolean;
  details: string;
  action: RtuMasterActionResult;
}

export interface ValidationSequenceCommand {
  unitId: number;
  timeoutMs?: number;
}

export interface ValidationSequenceResult {
  timestamp: string;
  passed: boolean;
  summary: string;
  steps: ValidationStepResult[];
  markdown: string;
}
