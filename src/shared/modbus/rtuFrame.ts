import { concatBytes } from "./byteUtils.js";
import { appendCrc, crc16Modbus, readFrameCrc } from "./crc16.js";
import {
  type DecodedExceptionResponse,
  type ExceptionCode,
  exceptionCodeName,
  isExceptionFunctionCode,
  originalFunctionCode,
  toExceptionFunctionCode
} from "./exceptions.js";
import type { ParsedRtuFrame } from "./types.js";

export function buildRtuFrame(unitId: number, pdu: Uint8Array): Uint8Array {
  if (!Number.isInteger(unitId) || unitId < 0 || unitId > 247) {
    throw new RangeError("unitId must be an integer between 0 and 247");
  }

  if (pdu.length < 1) {
    throw new Error("PDU must include a function code");
  }

  return appendCrc(concatBytes(Uint8Array.of(unitId), pdu));
}

export function parseRtuFrame(raw: Uint8Array): ParsedRtuFrame {
  if (raw.length < 4) {
    throw new Error("RTU frame must contain unit id, function code, data, and CRC");
  }

  const payload = raw.slice(0, -2);
  const pdu = raw.slice(1, -2);
  const functionCode = pdu[0];

  return {
    raw,
    unitId: raw[0],
    pdu,
    functionCode,
    data: pdu.slice(1),
    crc: readFrameCrc(raw),
    computedCrc: crc16Modbus(payload),
    crcOk: crc16Modbus(payload) === readFrameCrc(raw)
  };
}

export function buildExceptionFrame(
  unitId: number,
  functionCode: number,
  exceptionCode: ExceptionCode
): Uint8Array {
  return buildRtuFrame(unitId, Uint8Array.of(toExceptionFunctionCode(functionCode), exceptionCode));
}

export function decodeExceptionResponse(frame: Uint8Array): DecodedExceptionResponse | null {
  const parsed = parseRtuFrame(frame);

  if (!parsed.crcOk || !isExceptionFunctionCode(parsed.functionCode) || parsed.data.length !== 1) {
    return null;
  }

  const exceptionCode = parsed.data[0] as ExceptionCode;

  return {
    unitId: parsed.unitId,
    functionCode: originalFunctionCode(parsed.functionCode),
    exceptionFunctionCode: parsed.functionCode,
    exceptionCode,
    exceptionName: exceptionCodeName(exceptionCode)
  };
}
