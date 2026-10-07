import type { NormalizedSerialPortConfig } from "../serial/types.js";

export type SlaveTable = "coils" | "discreteInputs" | "holdingRegisters" | "inputRegisters";

export interface VirtualDeviceSizes {
  coils: number;
  discreteInputs: number;
  holdingRegisters: number;
  inputRegisters: number;
}

export interface VirtualDeviceSummary {
  unitId: number;
  name: string;
  sizes: VirtualDeviceSizes;
  requests: number;
}

export interface VirtualDeviceSnapshot extends VirtualDeviceSummary {
  coils: boolean[];
  discreteInputs: boolean[];
  holdingRegisters: number[];
  inputRegisters: number[];
}

export interface SlaveSimulatorCounters {
  requests: number;
  responses: number;
  exceptions: number;
  ignored: number;
  crcErrors: number;
}

export interface SlaveSimulatorState {
  running: boolean;
  config?: NormalizedSerialPortConfig;
  startedAt?: string;
  devices: VirtualDeviceSummary[];
  counters: SlaveSimulatorCounters;
  lastError?: string;
}

export type SlaveTrafficResult = "response" | "exception" | "broadcast" | "ignored" | "crc-error" | "frame-error";

export interface SlaveTrafficEntry {
  id: number;
  at: string;
  unitId: number | null;
  functionCode: number | null;
  request: string;
  response: string | null;
  result: SlaveTrafficResult;
  summary: string;
}

export interface AddVirtualDeviceRequest {
  unitId: number;
  name?: string;
  sizes?: Partial<VirtualDeviceSizes>;
}

export interface SetVirtualValueRequest {
  unitId: number;
  table: SlaveTable;
  address: number;
  value: number | boolean;
}

export type SlaveSimulatorEvent =
  | { type: "traffic"; entry: SlaveTrafficEntry }
  | { type: "device"; unitId: number }
  | { type: "state"; state: SlaveSimulatorState };
