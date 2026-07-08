import { bytesToUint16, concatBytes, packBits, uint16ToBytes, unpackBits } from "./byteUtils.js";
import { ExceptionCode } from "./exceptions.js";
import { FunctionCode, functionCodeName } from "./functionCodes.js";
import { buildExceptionFrame, buildRtuFrame, parseRtuFrame } from "./rtuFrame.js";

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

interface HandleOptions {
  unitId: number;
}

export function createSlaveDataModel(options: CreateSlaveDataModelOptions = {}): SlaveDataModel {
  return {
    coils: Array.from({ length: options.coilCount ?? 64 }, () => false),
    discreteInputs: Array.from({ length: options.discreteInputCount ?? 64 }, () => false),
    holdingRegisters: Array.from({ length: options.holdingRegisterCount ?? 64 }, () => 0),
    inputRegisters: Array.from({ length: options.inputRegisterCount ?? 64 }, () => 0)
  };
}

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
    return {
      kind: "ignored",
      reason: "crc-error",
      summary: "CRC error"
    };
  }

  const isBroadcast = parsed.unitId === 0;

  if (!isBroadcast && parsed.unitId !== options.unitId) {
    return {
      kind: "ignored",
      reason: "unit-id-mismatch",
      summary: `Frame for unit ${parsed.unitId} ignored by unit ${options.unitId}`
    };
  }

  switch (parsed.functionCode) {
    case FunctionCode.ReadCoils:
      return isBroadcast
        ? ignoredReadBroadcast(parsed.functionCode)
        : readBits(parsed.unitId, parsed.functionCode, parsed.data, model.coils);
    case FunctionCode.ReadDiscreteInputs:
      return isBroadcast
        ? ignoredReadBroadcast(parsed.functionCode)
        : readBits(parsed.unitId, parsed.functionCode, parsed.data, model.discreteInputs);
    case FunctionCode.ReadHoldingRegisters:
      return isBroadcast
        ? ignoredReadBroadcast(parsed.functionCode)
        : readRegisters(parsed.unitId, parsed.functionCode, parsed.data, model.holdingRegisters);
    case FunctionCode.ReadInputRegisters:
      return isBroadcast
        ? ignoredReadBroadcast(parsed.functionCode)
        : readRegisters(parsed.unitId, parsed.functionCode, parsed.data, model.inputRegisters);
    case FunctionCode.WriteSingleCoil:
      return writeSingleCoil(parsed.unitId, parsed.data, model.coils, rawFrame, isBroadcast);
    case FunctionCode.WriteSingleRegister:
      return writeSingleRegister(parsed.unitId, parsed.data, model.holdingRegisters, rawFrame, isBroadcast);
    case FunctionCode.WriteMultipleCoils:
      return writeMultipleCoils(parsed.unitId, parsed.data, model.coils, isBroadcast);
    case FunctionCode.WriteMultipleRegisters:
      return writeMultipleRegisters(parsed.unitId, parsed.data, model.holdingRegisters, isBroadcast);
    default:
      return exceptionOrBroadcast(
        parsed.unitId,
        parsed.functionCode,
        ExceptionCode.IllegalFunction,
        isBroadcast
      );
  }
}

function ignoredReadBroadcast(functionCode: number): SlaveFrameResult {
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

function readBits(
  unitId: number,
  functionCode: FunctionCode,
  data: Uint8Array,
  source: boolean[]
): SlaveFrameResult {
  const range = readRange(data);

  if (!range || !assertRange(range.startAddress, range.quantity, source.length)) {
    return exceptionOrBroadcast(unitId, functionCode, ExceptionCode.IllegalDataAddress, false);
  }

  const values = source.slice(range.startAddress, range.startAddress + range.quantity);
  const packedValues = packBits(values);
  const responsePdu = concatBytes(Uint8Array.of(functionCode, packedValues.length), packedValues);

  return {
    kind: "response",
    response: buildRtuFrame(unitId, responsePdu),
    summary: `${functionCodeName(functionCode)} ${range.startAddress}:${range.quantity}`
  };
}

function readRegisters(
  unitId: number,
  functionCode: FunctionCode,
  data: Uint8Array,
  source: number[]
): SlaveFrameResult {
  const range = readRange(data);

  if (!range || !assertRange(range.startAddress, range.quantity, source.length)) {
    return exceptionOrBroadcast(unitId, functionCode, ExceptionCode.IllegalDataAddress, false);
  }

  const registerBytes = source
    .slice(range.startAddress, range.startAddress + range.quantity)
    .flatMap((value) => uint16ToBytes(value));
  const responsePdu = concatBytes(
    Uint8Array.of(functionCode, registerBytes.length),
    Uint8Array.from(registerBytes)
  );

  return {
    kind: "response",
    response: buildRtuFrame(unitId, responsePdu),
    summary: `${functionCodeName(functionCode)} ${range.startAddress}:${range.quantity}`
  };
}

function writeSingleCoil(
  unitId: number,
  data: Uint8Array,
  coils: boolean[],
  rawFrame: Uint8Array,
  isBroadcast: boolean
): SlaveFrameResult {
  if (data.length !== 4) {
    return exceptionOrBroadcast(unitId, FunctionCode.WriteSingleCoil, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  const address = bytesToUint16(data, 0);
  const value = bytesToUint16(data, 2);

  if (address >= coils.length) {
    return exceptionOrBroadcast(unitId, FunctionCode.WriteSingleCoil, ExceptionCode.IllegalDataAddress, isBroadcast);
  }

  if (value !== 0xff00 && value !== 0x0000) {
    return exceptionOrBroadcast(unitId, FunctionCode.WriteSingleCoil, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  coils[address] = value === 0xff00;
  return writeResult(rawFrame, isBroadcast, `Write Single Coil ${address}=${coils[address] ? "ON" : "OFF"}`);
}

function writeSingleRegister(
  unitId: number,
  data: Uint8Array,
  registers: number[],
  rawFrame: Uint8Array,
  isBroadcast: boolean
): SlaveFrameResult {
  if (data.length !== 4) {
    return exceptionOrBroadcast(
      unitId,
      FunctionCode.WriteSingleRegister,
      ExceptionCode.IllegalDataValue,
      isBroadcast
    );
  }

  const address = bytesToUint16(data, 0);
  const value = bytesToUint16(data, 2);

  if (address >= registers.length) {
    return exceptionOrBroadcast(
      unitId,
      FunctionCode.WriteSingleRegister,
      ExceptionCode.IllegalDataAddress,
      isBroadcast
    );
  }

  registers[address] = value;
  return writeResult(rawFrame, isBroadcast, `Write Single Register ${address}=${value}`);
}

function writeMultipleCoils(
  unitId: number,
  data: Uint8Array,
  coils: boolean[],
  isBroadcast: boolean
): SlaveFrameResult {
  if (data.length < 5) {
    return exceptionOrBroadcast(unitId, FunctionCode.WriteMultipleCoils, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  const startAddress = bytesToUint16(data, 0);
  const quantity = bytesToUint16(data, 2);
  const byteCount = data[4];
  const packedValues = data.slice(5);

  if (byteCount !== packedValues.length || byteCount !== Math.ceil(quantity / 8)) {
    return exceptionOrBroadcast(unitId, FunctionCode.WriteMultipleCoils, ExceptionCode.IllegalDataValue, isBroadcast);
  }

  if (!assertRange(startAddress, quantity, coils.length)) {
    return exceptionOrBroadcast(unitId, FunctionCode.WriteMultipleCoils, ExceptionCode.IllegalDataAddress, isBroadcast);
  }

  unpackBits(packedValues, quantity).forEach((value, index) => {
    coils[startAddress + index] = value;
  });

  const [startHi, startLo] = uint16ToBytes(startAddress);
  const [quantityHi, quantityLo] = uint16ToBytes(quantity);
  const response = buildRtuFrame(
    unitId,
    Uint8Array.of(FunctionCode.WriteMultipleCoils, startHi, startLo, quantityHi, quantityLo)
  );

  return isBroadcast
    ? { kind: "broadcast", summary: `Broadcast Write Multiple Coils ${startAddress}:${quantity}` }
    : { kind: "response", response, summary: `Write Multiple Coils ${startAddress}:${quantity}` };
}

function writeMultipleRegisters(
  unitId: number,
  data: Uint8Array,
  registers: number[],
  isBroadcast: boolean
): SlaveFrameResult {
  if (data.length < 5) {
    return exceptionOrBroadcast(
      unitId,
      FunctionCode.WriteMultipleRegisters,
      ExceptionCode.IllegalDataValue,
      isBroadcast
    );
  }

  const startAddress = bytesToUint16(data, 0);
  const quantity = bytesToUint16(data, 2);
  const byteCount = data[4];
  const registerBytes = data.slice(5);

  if (byteCount !== registerBytes.length || byteCount !== quantity * 2) {
    return exceptionOrBroadcast(
      unitId,
      FunctionCode.WriteMultipleRegisters,
      ExceptionCode.IllegalDataValue,
      isBroadcast
    );
  }

  if (!assertRange(startAddress, quantity, registers.length)) {
    return exceptionOrBroadcast(
      unitId,
      FunctionCode.WriteMultipleRegisters,
      ExceptionCode.IllegalDataAddress,
      isBroadcast
    );
  }

  for (let index = 0; index < quantity; index += 1) {
    registers[startAddress + index] = bytesToUint16(registerBytes, index * 2);
  }

  const [startHi, startLo] = uint16ToBytes(startAddress);
  const [quantityHi, quantityLo] = uint16ToBytes(quantity);
  const response = buildRtuFrame(
    unitId,
    Uint8Array.of(FunctionCode.WriteMultipleRegisters, startHi, startLo, quantityHi, quantityLo)
  );

  return isBroadcast
    ? { kind: "broadcast", summary: `Broadcast Write Multiple Registers ${startAddress}:${quantity}` }
    : { kind: "response", response, summary: `Write Multiple Registers ${startAddress}:${quantity}` };
}

function writeResult(rawFrame: Uint8Array, isBroadcast: boolean, summary: string): SlaveFrameResult {
  return isBroadcast ? { kind: "broadcast", summary: `Broadcast ${summary}` } : {
    kind: "response",
    response: rawFrame,
    summary
  };
}

function exceptionOrBroadcast(
  unitId: number,
  functionCode: number,
  exceptionCode: ExceptionCode,
  isBroadcast: boolean
): SlaveFrameResult {
  return isBroadcast
    ? {
        kind: "broadcast",
        summary: `Broadcast exception suppressed for ${functionCodeName(functionCode)}`
      }
    : {
        kind: "response",
        response: buildExceptionFrame(unitId, functionCode, exceptionCode),
        summary: `Exception ${exceptionCode} for ${functionCodeName(functionCode)}`
      };
}
