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

export interface RtuMasterActionResult {
  timestamp: string;
  elapsedMs: number;
  unitId: number;
  functionCode: number;
  summary: string;
  txHex: string;
  rxHex: string;
  crcOk: boolean;
  values?: boolean[];
  registerValues?: number[];
  exception?: {
    functionCode: number;
    exceptionCode: number;
    exceptionName: string;
  };
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
