import {
  bytesToUint16,
  concatBytes,
  packBits,
  uint16ToBytes,
  unpackBits
} from "./byteUtils.js";
import { FunctionCode } from "./functionCodes.js";
import { buildRtuFrame, parseRtuFrame } from "./rtuFrame.js";
import type {
  DecodedBitReadResponse,
  DecodedRegisterReadResponse,
  ReadAddressRange,
  WriteMultipleValues,
  WriteSingleValue
} from "./types.js";

const bitReadFunctionCodes = new Set<number>([
  FunctionCode.ReadCoils,
  FunctionCode.ReadDiscreteInputs
]);

const registerReadFunctionCodes = new Set<number>([
  FunctionCode.ReadHoldingRegisters,
  FunctionCode.ReadInputRegisters
]);

function assertAddressRange(startAddress: number, quantity: number): void {
  if (!Number.isInteger(startAddress) || startAddress < 0 || startAddress > 0xffff) {
    throw new RangeError("startAddress must be an integer between 0 and 65535");
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 0x07d0) {
    throw new RangeError("quantity must be an integer between 1 and 2000");
  }
}

function encodeReadRequest(functionCode: FunctionCode, request: ReadAddressRange): Uint8Array {
  assertAddressRange(request.startAddress, request.quantity);

  if (registerReadFunctionCodes.has(functionCode) && request.quantity > 125) {
    throw new RangeError("register read quantity must not exceed 125");
  }

  const [startHi, startLo] = uint16ToBytes(request.startAddress);
  const [quantityHi, quantityLo] = uint16ToBytes(request.quantity);
  return buildRtuFrame(request.unitId, Uint8Array.of(functionCode, startHi, startLo, quantityHi, quantityLo));
}

export function encodeReadCoilsRequest(request: ReadAddressRange): Uint8Array {
  return encodeReadRequest(FunctionCode.ReadCoils, request);
}

export function encodeReadDiscreteInputsRequest(request: ReadAddressRange): Uint8Array {
  return encodeReadRequest(FunctionCode.ReadDiscreteInputs, request);
}

export function encodeReadHoldingRegistersRequest(request: ReadAddressRange): Uint8Array {
  return encodeReadRequest(FunctionCode.ReadHoldingRegisters, request);
}

export function encodeReadInputRegistersRequest(request: ReadAddressRange): Uint8Array {
  return encodeReadRequest(FunctionCode.ReadInputRegisters, request);
}

export function encodeWriteSingleCoilRequest(request: WriteSingleValue): Uint8Array {
  const value = request.value === true || request.value === 0xff00 ? 0xff00 : 0x0000;
  const [addressHi, addressLo] = uint16ToBytes(request.address);
  const [valueHi, valueLo] = uint16ToBytes(value);
  return buildRtuFrame(
    request.unitId,
    Uint8Array.of(FunctionCode.WriteSingleCoil, addressHi, addressLo, valueHi, valueLo)
  );
}

export function encodeWriteSingleRegisterRequest(request: WriteSingleValue): Uint8Array {
  if (typeof request.value !== "number") {
    throw new TypeError("register value must be a number");
  }

  const [addressHi, addressLo] = uint16ToBytes(request.address);
  const [valueHi, valueLo] = uint16ToBytes(request.value);
  return buildRtuFrame(
    request.unitId,
    Uint8Array.of(FunctionCode.WriteSingleRegister, addressHi, addressLo, valueHi, valueLo)
  );
}

export function encodeWriteMultipleCoilsRequest(request: WriteMultipleValues<boolean>): Uint8Array {
  if (request.values.length < 1 || request.values.length > 0x07b0) {
    throw new RangeError("coil write quantity must be between 1 and 1968");
  }

  const [startHi, startLo] = uint16ToBytes(request.startAddress);
  const [quantityHi, quantityLo] = uint16ToBytes(request.values.length);
  const packedValues = packBits(request.values);
  return buildRtuFrame(
    request.unitId,
    concatBytes(
      Uint8Array.of(
        FunctionCode.WriteMultipleCoils,
        startHi,
        startLo,
        quantityHi,
        quantityLo,
        packedValues.length
      ),
      packedValues
    )
  );
}

export function encodeWriteMultipleRegistersRequest(request: WriteMultipleValues<number>): Uint8Array {
  if (request.values.length < 1 || request.values.length > 123) {
    throw new RangeError("register write quantity must be between 1 and 123");
  }

  const [startHi, startLo] = uint16ToBytes(request.startAddress);
  const [quantityHi, quantityLo] = uint16ToBytes(request.values.length);
  const registerBytes = request.values.flatMap((value) => uint16ToBytes(value));
  return buildRtuFrame(
    request.unitId,
    concatBytes(
      Uint8Array.of(
        FunctionCode.WriteMultipleRegisters,
        startHi,
        startLo,
        quantityHi,
        quantityLo,
        registerBytes.length
      ),
      Uint8Array.from(registerBytes)
    )
  );
}

export function decodeBitReadResponse(frame: Uint8Array, quantity: number): DecodedBitReadResponse {
  const parsed = parseRtuFrame(frame);

  if (!parsed.crcOk || !bitReadFunctionCodes.has(parsed.functionCode)) {
    throw new Error("Frame is not a valid bit read response");
  }

  const byteCount = parsed.data[0];
  const valueBytes = parsed.data.slice(1);

  if (byteCount !== valueBytes.length) {
    throw new Error("Bit read byte count does not match payload length");
  }

  return {
    unitId: parsed.unitId,
    functionCode: parsed.functionCode,
    values: unpackBits(valueBytes, quantity)
  };
}

export function decodeRegisterReadResponse(frame: Uint8Array): DecodedRegisterReadResponse {
  const parsed = parseRtuFrame(frame);

  if (!parsed.crcOk || !registerReadFunctionCodes.has(parsed.functionCode)) {
    throw new Error("Frame is not a valid register read response");
  }

  const byteCount = parsed.data[0];
  const valueBytes = parsed.data.slice(1);

  if (byteCount !== valueBytes.length || valueBytes.length % 2 !== 0) {
    throw new Error("Register read byte count does not match payload length");
  }

  const values: number[] = [];

  for (let offset = 0; offset < valueBytes.length; offset += 2) {
    values.push(bytesToUint16(valueBytes, offset));
  }

  return {
    unitId: parsed.unitId,
    functionCode: parsed.functionCode,
    values
  };
}
