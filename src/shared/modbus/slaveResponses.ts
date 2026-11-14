import { bytesToUint16, concatBytes, packBits, uint16ToBytes, unpackBits } from "./byteUtils.js";
import { ExceptionCode, toExceptionFunctionCode } from "./exceptions.js";
import { FunctionCode, MEI_READ_DEVICE_ID, functionCodeName } from "./functionCodes.js";
import { buildRtuFrame, parseRtuFrame } from "./rtuFrame.js";

export interface SlaveDataModel {
  coils: boolean[];
  discreteInputs: boolean[];
  holdingRegisters: number[];
  inputRegisters: number[];
}

export interface CreateSlaveDataModelOptions {
  coilCount?: number;
  discreteInputCount?: number;
  holdingRegisterCount?: number;
  inputRegisterCount?: number;
}

/** What a slave says about itself in FC17 and FC43/14. */
export interface SlaveIdentity {
  vendorName: string;
  productCode: string;
  revision: string;
  vendorUrl: string;
  productName: string;
  modelName: string;
  userApplicationName: string;
}

export const defaultSlaveIdentity: SlaveIdentity = {
  vendorName: "JW Control",
  productCode: "JWMT-SIM",
  revision: "0.2",
  vendorUrl: "",
  productName: "JW Modbus Tool - slave virtual",
  modelName: "Slave virtual",
  userApplicationName: "JW Modbus Tool"
};

export type SlaveFrameResult =
  | {
      kind: "response";
      response: Uint8Array;
      summary: string;
    }
  | {
      kind: "broadcast";
      summary: string;
    }
  | {
      kind: "ignored";
      reason: "crc-error" | "frame-error" | "read-broadcast" | "unit-id-mismatch";
      summary: string;
    };

/** Result of handling one request PDU; the transport wraps `pdu` in its own ADU. */
export type SlavePduResult =
  | { kind: "response"; pdu: Uint8Array; summary: string }
  | { kind: "broadcast"; summary: string }
  | { kind: "ignored"; reason: "read-broadcast"; summary: string };

interface HandleOptions {
  unitId: number;
  identity?: SlaveIdentity;
}

export interface SlavePduContext {
  unitId: number;
  isBroadcast: boolean;
  identity?: SlaveIdentity;
}

export function createSlaveDataModel(options: CreateSlaveDataModelOptions = {}): SlaveDataModel {
  return {
    coils: Array.from({ length: options.coilCount ?? 64 }, () => false),
    discreteInputs: Array.from({ length: options.discreteInputCount ?? 64 }, () => false),
    holdingRegisters: Array.from({ length: options.holdingRegisterCount ?? 64 }, () => 0),
    inputRegisters: Array.from({ length: options.inputRegisterCount ?? 64 }, () => 0)
  };
}

/** RTU wrapper kept for callers that work with whole RTU frames. */
export function handleRtuSlaveRequest(
  rawFrame: Uint8Array,
  model: SlaveDataModel,
  options: HandleOptions
): SlaveFrameResult {
  let parsed;

  try {
    parsed = parseRtuFrame(rawFrame);
  } catch (error) {
    return {
      kind: "ignored",
      reason: "frame-error",
      summary: error instanceof Error ? error.message : "Invalid RTU frame"
    };
  }

  if (!parsed.crcOk) {
    return { kind: "ignored", reason: "crc-error", summary: "CRC error" };
  }

  const isBroadcast = parsed.unitId === 0;

  if (!isBroadcast && parsed.unitId !== options.unitId) {
    return {
      kind: "ignored",
      reason: "unit-id-mismatch",
      summary: `Frame for unit ${parsed.unitId} ignored by unit ${options.unitId}`
    };
  }

  const result = handleSlavePdu(parsed.pdu, model, { unitId: options.unitId, isBroadcast, identity: options.identity });
  return result.kind === "response"
    ? { kind: "response", response: buildRtuFrame(parsed.unitId, result.pdu), summary: result.summary }
    : result;
}

/** Answers one request PDU against the data model. Writes change the model. */
export function handleSlavePdu(pdu: Uint8Array, model: SlaveDataModel, context: SlavePduContext): SlavePduResult {
  const { isBroadcast } = context;
  const functionCode = pdu[0];
  const data = pdu.slice(1);

  switch (functionCode) {
    case FunctionCode.ReadCoils:
      return isBroadcast ? ignoredReadBroadcast(functionCode) : readBits(functionCode, data, model.coils);
    case FunctionCode.ReadDiscreteInputs:
      return isBroadcast ? ignoredReadBroadcast(functionCode) : readBits(functionCode, data, model.discreteInputs);
    case FunctionCode.ReadHoldingRegisters:
      return isBroadcast ? ignoredReadBroadcast(functionCode) : readRegisters(functionCode, data, model.holdingRegisters);
    case FunctionCode.ReadInputRegisters:
      return isBroadcast ? ignoredReadBroadcast(functionCode) : readRegisters(functionCode, data, model.inputRegisters);
    case FunctionCode.WriteSingleCoil:
      return writeSingleCoil(pdu, model.coils, isBroadcast);
    case FunctionCode.WriteSingleRegister:
      return writeSingleRegister(pdu, model.holdingRegisters, isBroadcast);
    case FunctionCode.WriteMultipleCoils:
      return writeMultipleCoils(data, model.coils, isBroadcast);
    case FunctionCode.WriteMultipleRegisters:
      return writeMultipleRegisters(data, model.holdingRegisters, isBroadcast);
    case FunctionCode.MaskWriteRegister:
      return maskWriteRegister(pdu, model.holdingRegisters, isBroadcast);
    case FunctionCode.ReadWriteMultipleRegisters:
      return isBroadcast ? ignoredReadBroadcast(functionCode) : readWriteRegisters(data, model.holdingRegisters);
    case FunctionCode.ReportServerId:
      return isBroadcast ? ignoredReadBroadcast(functionCode) : reportServerId(data, context);
    case FunctionCode.EncapsulatedInterface:
      return isBroadcast ? ignoredReadBroadcast(functionCode) : readDeviceIdentification(data, context);
    default:
      return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalFunction, isBroadcast);
  }
}

export function exceptionPdu(functionCode: number, exceptionCode: number): Uint8Array {
  return Uint8Array.of(toExceptionFunctionCode(functionCode), exceptionCode);
}

function ignoredReadBroadcast(functionCode: number): SlavePduResult {
  return {
    kind: "ignored",
    reason: "read-broadcast",
    summary: `Broadcast ${functionCodeName(functionCode)} request ignored`
  };
}

function assertRange(startAddress: number, quantity: number, length: number): boolean {
  return quantity >= 1 && startAddress >= 0 && startAddress + quantity <= length;
}

function readRange(data: Uint8Array): { startAddress: number; quantity: number } | null {
  if (data.length !== 4) {
    return null;
  }

  return {
    startAddress: bytesToUint16(data, 0),
    quantity: bytesToUint16(data, 2)
  };
}

function readBits(functionCode: FunctionCode, data: Uint8Array, source: boolean[]): SlavePduResult {
  const range = readRange(data);

  if (!range) return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataValue, false);
  if (range.quantity < 1 || range.quantity > 2000) return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataValue, false);
  if (!assertRange(range.startAddress, range.quantity, source.length)) {
    return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataAddress, false);
  }

  const values = source.slice(range.startAddress, range.startAddress + range.quantity);
  const packedValues = packBits(values);

  return {
    kind: "response",
    pdu: concatBytes(Uint8Array.of(functionCode, packedValues.length), packedValues),
    summary: `${functionCodeName(functionCode)} ${range.startAddress}:${range.quantity}`
  };
}

function readRegisters(functionCode: FunctionCode, data: Uint8Array, source: number[]): SlavePduResult {
  const range = readRange(data);

  if (!range) return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataValue, false);
  if (range.quantity < 1 || range.quantity > 125) return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataValue, false);
  if (!assertRange(range.startAddress, range.quantity, source.length)) {
    return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataAddress, false);
  }

  return {
    kind: "response",
    pdu: registerReadPdu(functionCode, source.slice(range.startAddress, range.startAddress + range.quantity)),
    summary: `${functionCodeName(functionCode)} ${range.startAddress}:${range.quantity}`
  };
}

function registerReadPdu(functionCode: number, values: number[]): Uint8Array {
  const registerBytes = values.flatMap((value) => uint16ToBytes(value));
  return concatBytes(Uint8Array.of(functionCode, registerBytes.length), Uint8Array.from(registerBytes));
}

function writeSingleCoil(pdu: Uint8Array, coils: boolean[], isBroadcast: boolean): SlavePduResult {
  if (pdu.length !== 5) {
    return exceptionOrBroadcast(FunctionCode.WriteSingleCoil, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  const address = bytesToUint16(pdu, 1);
  const value = bytesToUint16(pdu, 3);

  if (value !== 0xff00 && value !== 0x0000) {
    return exceptionOrBroadcast(FunctionCode.WriteSingleCoil, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  if (address >= coils.length) {
    return exceptionOrBroadcast(FunctionCode.WriteSingleCoil, ExceptionCode.IllegalDataAddress, isBroadcast);
  }

  coils[address] = value === 0xff00;
  return writeResult(pdu, isBroadcast, `Write Single Coil ${address}=${coils[address] ? "ON" : "OFF"}`);
}

function writeSingleRegister(pdu: Uint8Array, registers: number[], isBroadcast: boolean): SlavePduResult {
  if (pdu.length !== 5) {
    return exceptionOrBroadcast(FunctionCode.WriteSingleRegister, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  const address = bytesToUint16(pdu, 1);
  const value = bytesToUint16(pdu, 3);

  if (address >= registers.length) {
    return exceptionOrBroadcast(FunctionCode.WriteSingleRegister, ExceptionCode.IllegalDataAddress, isBroadcast);
  }

  registers[address] = value;
  return writeResult(pdu, isBroadcast, `Write Single Register ${address}=${value}`);
}

function writeMultipleCoils(data: Uint8Array, coils: boolean[], isBroadcast: boolean): SlavePduResult {
  if (data.length < 5) {
    return exceptionOrBroadcast(FunctionCode.WriteMultipleCoils, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  const startAddress = bytesToUint16(data, 0);
  const quantity = bytesToUint16(data, 2);
  const byteCount = data[4];
  const packedValues = data.slice(5);

  if (quantity < 1 || quantity > 1968 || byteCount !== packedValues.length || byteCount !== Math.ceil(quantity / 8)) {
    return exceptionOrBroadcast(FunctionCode.WriteMultipleCoils, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  if (!assertRange(startAddress, quantity, coils.length)) {
    return exceptionOrBroadcast(FunctionCode.WriteMultipleCoils, ExceptionCode.IllegalDataAddress, isBroadcast);
  }

  unpackBits(packedValues, quantity).forEach((value, index) => {
    coils[startAddress + index] = value;
  });

  return isBroadcast
    ? { kind: "broadcast", summary: `Broadcast Write Multiple Coils ${startAddress}:${quantity}` }
    : {
        kind: "response",
        pdu: Uint8Array.of(FunctionCode.WriteMultipleCoils, ...uint16ToBytes(startAddress), ...uint16ToBytes(quantity)),
        summary: `Write Multiple Coils ${startAddress}:${quantity}`
      };
}

function writeMultipleRegisters(data: Uint8Array, registers: number[], isBroadcast: boolean): SlavePduResult {
  if (data.length < 5) {
    return exceptionOrBroadcast(FunctionCode.WriteMultipleRegisters, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  const startAddress = bytesToUint16(data, 0);
  const quantity = bytesToUint16(data, 2);
  const byteCount = data[4];
  const registerBytes = data.slice(5);

  if (quantity < 1 || quantity > 123 || byteCount !== registerBytes.length || byteCount !== quantity * 2) {
    return exceptionOrBroadcast(FunctionCode.WriteMultipleRegisters, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  if (!assertRange(startAddress, quantity, registers.length)) {
    return exceptionOrBroadcast(FunctionCode.WriteMultipleRegisters, ExceptionCode.IllegalDataAddress, isBroadcast);
  }

  for (let index = 0; index < quantity; index += 1) {
    registers[startAddress + index] = bytesToUint16(registerBytes, index * 2);
  }

  return isBroadcast
    ? { kind: "broadcast", summary: `Broadcast Write Multiple Registers ${startAddress}:${quantity}` }
    : {
        kind: "response",
        pdu: Uint8Array.of(FunctionCode.WriteMultipleRegisters, ...uint16ToBytes(startAddress), ...uint16ToBytes(quantity)),
        summary: `Write Multiple Registers ${startAddress}:${quantity}`
      };
}

/** FC22: result = (current AND andMask) OR (orMask AND NOT andMask). */
function maskWriteRegister(pdu: Uint8Array, registers: number[], isBroadcast: boolean): SlavePduResult {
  if (pdu.length !== 7) {
    return exceptionOrBroadcast(FunctionCode.MaskWriteRegister, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  const address = bytesToUint16(pdu, 1);
  const andMask = bytesToUint16(pdu, 3);
  const orMask = bytesToUint16(pdu, 5);

  if (address >= registers.length) {
    return exceptionOrBroadcast(FunctionCode.MaskWriteRegister, ExceptionCode.IllegalDataAddress, isBroadcast);
  }

  const before = registers[address];
  registers[address] = ((before & andMask) | (orMask & ~andMask)) & 0xffff;
  return writeResult(pdu, isBroadcast, `Mask Write Register ${address}: ${before} -> ${registers[address]}`);
}

/** FC23: the write is done before the read, as the spec requires. */
function readWriteRegisters(data: Uint8Array, registers: number[]): SlavePduResult {
  const functionCode = FunctionCode.ReadWriteMultipleRegisters;

  if (data.length < 9) return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataValue, false);

  const readStart = bytesToUint16(data, 0);
  const readQuantity = bytesToUint16(data, 2);
  const writeStart = bytesToUint16(data, 4);
  const writeQuantity = bytesToUint16(data, 6);
  const byteCount = data[8];
  const writeBytes = data.slice(9);

  if (
    readQuantity < 1 ||
    readQuantity > 125 ||
    writeQuantity < 1 ||
    writeQuantity > 121 ||
    byteCount !== writeQuantity * 2 ||
    writeBytes.length !== byteCount
  ) {
    return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataValue, false);
  }

  if (!assertRange(readStart, readQuantity, registers.length) || !assertRange(writeStart, writeQuantity, registers.length)) {
    return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataAddress, false);
  }

  for (let index = 0; index < writeQuantity; index += 1) {
    registers[writeStart + index] = bytesToUint16(writeBytes, index * 2);
  }

  return {
    kind: "response",
    pdu: registerReadPdu(functionCode, registers.slice(readStart, readStart + readQuantity)),
    summary: `Read/Write Multiple Registers lee ${readStart}:${readQuantity}, escribe ${writeStart}:${writeQuantity}`
  };
}

function reportServerId(data: Uint8Array, context: SlavePduContext): SlavePduResult {
  if (data.length !== 0) return exceptionOrBroadcast(FunctionCode.ReportServerId, ExceptionCode.IllegalDataValue, false);
  const identity = context.identity ?? defaultSlaveIdentity;
  const text = new TextEncoder().encode(`${identity.productName} ${identity.revision}`.slice(0, 240));
  const payload = concatBytes(Uint8Array.of(context.unitId, 0xff), text);
  return {
    kind: "response",
    pdu: concatBytes(Uint8Array.of(FunctionCode.ReportServerId, payload.length), payload),
    summary: "Report Server ID"
  };
}

/** FC43/14 with stream access (codes 1 to 3) and individual access (code 4). */
function readDeviceIdentification(data: Uint8Array, context: SlavePduContext): SlavePduResult {
  const functionCode = FunctionCode.EncapsulatedInterface;

  if (data.length !== 3 || data[0] !== MEI_READ_DEVICE_ID) {
    return exceptionOrBroadcast(functionCode, data[0] !== MEI_READ_DEVICE_ID ? ExceptionCode.IllegalFunction : ExceptionCode.IllegalDataValue, false);
  }

  const code = data[1];
  const firstObject = data[2];
  const identity = context.identity ?? defaultSlaveIdentity;
  const objects: Array<[number, string]> = [
    [0, identity.vendorName],
    [1, identity.productCode],
    [2, identity.revision],
    [3, identity.vendorUrl],
    [4, identity.productName],
    [5, identity.modelName],
    [6, identity.userApplicationName]
  ];
  // Conformity 0x83: regular level, stream and individual access.
  const conformity = 0x83;
  let selected: Array<[number, string]>;

  if (code === 4) {
    const object = objects.find(([id]) => id === firstObject);
    if (!object) return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataAddress, false);
    selected = [object];
  } else if (code >= 1 && code <= 3) {
    const lastId = code === 1 ? 2 : 6;
    const start = firstObject > lastId ? 0 : firstObject;
    selected = objects.filter(([id]) => id >= start && id <= lastId);
  } else {
    return exceptionOrBroadcast(functionCode, ExceptionCode.IllegalDataValue, false);
  }

  const encoded = selected.map(([id, value]) => {
    const bytes = new TextEncoder().encode(value).slice(0, 200);
    return concatBytes(Uint8Array.of(id, bytes.length), bytes);
  });

  return {
    kind: "response",
    pdu: concatBytes(Uint8Array.of(functionCode, MEI_READ_DEVICE_ID, code, conformity, 0x00, 0x00, selected.length), ...encoded),
    summary: `Read Device Identification (código ${code}, ${selected.length} objetos)`
  };
}

function writeResult(echoPdu: Uint8Array, isBroadcast: boolean, summary: string): SlavePduResult {
  return isBroadcast
    ? { kind: "broadcast", summary: `Broadcast ${summary}` }
    : { kind: "response", pdu: echoPdu.slice(), summary };
}

function exceptionOrBroadcast(functionCode: number, exceptionCode: ExceptionCode, isBroadcast: boolean): SlavePduResult {
  return isBroadcast
    ? { kind: "broadcast", summary: `Broadcast exception suppressed for ${functionCodeName(functionCode)}` }
    : {
        kind: "response",
        pdu: exceptionPdu(functionCode, exceptionCode),
        summary: `Exception ${exceptionCode} for ${functionCodeName(functionCode)}`
      };
}
