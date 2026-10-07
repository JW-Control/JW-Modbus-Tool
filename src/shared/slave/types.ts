import type { NormalizedSerialPortConfig, SerialDataBits, SerialParity, SerialStopBits } from "../serial/types.js";

export type SlaveTable = "coils" | "discreteInputs" | "holdingRegisters" | "inputRegisters";

export interface VirtualDeviceSizes {
  coils: number;
  discreteInputs: number;
  holdingRegisters: number;
  inputRegisters: number;
}

export type VirtualDeviceLabels = Partial<Record<SlaveTable, string[]>>;

/** How a virtual device misbehaves, to exercise the master's error handling. */
export type VirtualFaultMode = "none" | "no-response" | "bad-crc" | "exception";

export type VirtualExceptionCode = 1 | 2 | 3 | 4;

export interface VirtualDeviceFaults {
  mode: VirtualFaultMode;
  /** Applied before every response, on top of the mode. */
  delayMs: number;
  /** Used when `mode` is "exception". */
  exceptionCode: VirtualExceptionCode;
}

export interface VirtualDeviceSummary {
  unitId: number;
  name: string;
  template: string | null;
  sizes: VirtualDeviceSizes;
  labels: VirtualDeviceLabels;
  faults: VirtualDeviceFaults;
  requests: number;
}

export interface VirtualDeviceValues {
  coils: boolean[];
  discreteInputs: boolean[];
  holdingRegisters: number[];
  inputRegisters: number[];
}

export interface VirtualDeviceSnapshot extends VirtualDeviceSummary, VirtualDeviceValues {}

/** A device as stored in a session file. */
export interface VirtualDeviceConfig {
  unitId: number;
  name: string;
  template: string | null;
  labels: VirtualDeviceLabels;
  faults: VirtualDeviceFaults;
  values: VirtualDeviceValues;
}

export interface SlaveSimulatorSettings {
  port: string;
  baudRate: number;
  dataBits: SerialDataBits;
  parity: SerialParity;
  stopBits: SerialStopBits;
}

export interface SlaveSimulatorSessionConfig {
  settings: SlaveSimulatorSettings | null;
  devices: VirtualDeviceConfig[];
}

export interface SlaveSimulatorCounters {
  requests: number;
  responses: number;
  exceptions: number;
  ignored: number;
  crcErrors: number;
  faults: number;
}

export interface SlaveSimulatorState {
  running: boolean;
  config?: NormalizedSerialPortConfig;
  startedAt?: string;
  devices: VirtualDeviceSummary[];
  counters: SlaveSimulatorCounters;
  lastError?: string;
}

export type SlaveTrafficResult =
  | "response"
  | "exception"
  | "broadcast"
  | "ignored"
  | "silenced"
  | "crc-error"
  | "frame-error";

export interface SlaveTrafficEntry {
  id: number;
  at: string;
  unitId: number | null;
  functionCode: number | null;
  request: string;
  response: string | null;
  result: SlaveTrafficResult;
  summary: string;
  /** Fault applied to this exchange, in words; null when the device behaved normally. */
  fault: string | null;
}

export interface AddVirtualDeviceRequest {
  unitId: number;
  name?: string;
  template?: string;
  sizes?: Partial<VirtualDeviceSizes>;
}

export interface SetVirtualValueRequest {
  unitId: number;
  table: SlaveTable;
  address: number;
  value: number | boolean;
}

export interface SetVirtualFaultsRequest {
  unitId: number;
  faults: Partial<VirtualDeviceFaults>;
}

export type SlaveSimulatorEvent =
  | { type: "traffic"; entry: SlaveTrafficEntry }
  | { type: "device"; unitId: number }
  | { type: "state"; state: SlaveSimulatorState };
