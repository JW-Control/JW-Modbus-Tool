// PDU de Modbus (código de función + datos), común a RTU, ASCII y TCP.
// Cada transporte solo agrega su envoltura: unit id + CRC (RTU),
// ":" + hex + LRC (ASCII) o la cabecera MBAP (TCP).
import { bytesToUint16, concatBytes, packBits, uint16ToBytes, unpackBits } from "./byteUtils.js";
import { exceptionCodeName, isExceptionFunctionCode, originalFunctionCode } from "./exceptions.js";
import { FunctionCode, MEI_READ_DEVICE_ID } from "./functionCodes.js";

export type BitReadFunction = 1 | 2;
export type RegisterReadFunction = 3 | 4;

export type ModbusRequest =
  | { fc: BitReadFunction | RegisterReadFunction; startAddress: number; quantity: number }
  | { fc: 5; address: number; value: boolean }
  | { fc: 6; address: number; value: number }
  | { fc: 15; startAddress: number; values: boolean[] }
  | { fc: 16; startAddress: number; values: number[] }
  | { fc: 17 }
  | { fc: 22; address: number; andMask: number; orMask: number }
  | { fc: 23; readStartAddress: number; readQuantity: number; writeStartAddress: number; values: number[] }
  | { fc: 43; readDeviceIdCode: 1 | 2 | 3 | 4; objectId: number };

export interface DeviceIdObject {
  id: number;
  name: string;
  value: string;
}

export interface DeviceIdentification {
  readDeviceIdCode: number;
  conformityLevel: number;
  moreFollows: boolean;
  nextObjectId: number;
  objects: DeviceIdObject[];
}

export interface ServerIdReport {
  /** Bytes after the byte count, as sent by the device. */
  data: number[];
  /** First byte, usually the server id. */
  serverId: number | null;
  /** Second byte: 0xFF = run, 0x00 = stop (when present). */
  running: boolean | null;
  /** Printable text found in the rest of the data, if any. */
  text: string;
}

export interface ModbusResponse {
  functionCode: number;
  exception?: { functionCode: number; exceptionCode: number; exceptionName: string };
  bits?: boolean[];
  registers?: number[];
  serverId?: ServerIdReport;
  deviceId?: DeviceIdentification;
}

export const deviceIdObjectNames: Record<number, string> = {
  0: "VendorName",
  1: "ProductCode",
  2: "MajorMinorRevision",
  3: "VendorUrl",
  4: "ProductName",
  5: "ModelName",
  6: "UserApplicationName"
};

export function deviceIdObjectName(id: number): string {
  return deviceIdObjectNames[id] ?? (id >= 0x80 ? `Privado 0x${hex2(id)}` : `Objeto 0x${hex2(id)}`);
}

// ---------------------------------------------------------------- petición

export function encodeRequestPdu(request: ModbusRequest): Uint8Array {
  switch (request.fc) {
    case 1:
    case 2:
    case 3:
    case 4: {
      const max = request.fc <= 2 ? 2000 : 125;
      assertAddress(request.startAddress, "startAddress");
      assertCount(request.quantity, max, "quantity");
      assertFits(request.startAddress, request.quantity);
      return Uint8Array.of(request.fc, ...uint16ToBytes(request.startAddress), ...uint16ToBytes(request.quantity));
    }
    case 5:
      assertAddress(request.address, "address");
      return Uint8Array.of(5, ...uint16ToBytes(request.address), request.value ? 0xff : 0x00, 0x00);
    case 6:
      assertAddress(request.address, "address");
      assertRegister(request.value);
      return Uint8Array.of(6, ...uint16ToBytes(request.address), ...uint16ToBytes(request.value));
    case 15: {
      assertAddress(request.startAddress, "startAddress");
      assertCount(request.values.length, 1968, "coil write quantity");
      assertFits(request.startAddress, request.values.length);
      const packed = packBits(request.values);
      return concatBytes(
        Uint8Array.of(15, ...uint16ToBytes(request.startAddress), ...uint16ToBytes(request.values.length), packed.length),
        packed
      );
    }
    case 16: {
      assertAddress(request.startAddress, "startAddress");
      assertCount(request.values.length, 123, "register write quantity");
      assertFits(request.startAddress, request.values.length);
      request.values.forEach(assertRegister);
      return concatBytes(
        Uint8Array.of(16, ...uint16ToBytes(request.startAddress), ...uint16ToBytes(request.values.length), request.values.length * 2),
        Uint8Array.from(request.values.flatMap((value) => uint16ToBytes(value)))
      );
    }
    case 17:
      return Uint8Array.of(17);
    case 22:
      assertAddress(request.address, "address");
      assertRegister(request.andMask);
      assertRegister(request.orMask);
      return Uint8Array.of(22, ...uint16ToBytes(request.address), ...uint16ToBytes(request.andMask), ...uint16ToBytes(request.orMask));
    case 23: {
      assertAddress(request.readStartAddress, "readStartAddress");
      assertCount(request.readQuantity, 125, "read quantity");
      assertFits(request.readStartAddress, request.readQuantity);
      assertAddress(request.writeStartAddress, "writeStartAddress");
      assertCount(request.values.length, 121, "write quantity");
      assertFits(request.writeStartAddress, request.values.length);
      request.values.forEach(assertRegister);
      return concatBytes(
        Uint8Array.of(
          23,
          ...uint16ToBytes(request.readStartAddress),
          ...uint16ToBytes(request.readQuantity),
          ...uint16ToBytes(request.writeStartAddress),
          ...uint16ToBytes(request.values.length),
          request.values.length * 2
        ),
        Uint8Array.from(request.values.flatMap((value) => uint16ToBytes(value)))
      );
    }
    case 43:
      if (![1, 2, 3, 4].includes(request.readDeviceIdCode)) {
        throw new RangeError("readDeviceIdCode must be 1, 2, 3 or 4");
      }
      if (!Number.isInteger(request.objectId) || request.objectId < 0 || request.objectId > 0xff) {
        throw new RangeError("objectId must be an integer between 0 and 255");
      }
      return Uint8Array.of(43, MEI_READ_DEVICE_ID, request.readDeviceIdCode, request.objectId);
  }
}

/**
 * Length of a request PDU from its first bytes, or null while it cannot be
 * known yet (or the function code is unknown).
 */
export function expectedRequestPduLength(pdu: Uint8Array): number | null {
  if (pdu.length < 1) return null;

  switch (pdu[0]) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return 5;
    case 15:
    case 16:
      return pdu.length >= 6 ? 6 + pdu[5] : null;
    case 17:
      return 1;
    case 22:
      return 7;
    case 23:
      return pdu.length >= 10 ? 10 + pdu[9] : null;
    case 43:
      return 4;
    default:
      return null;
  }
}

/** Function codes whose request length is known, so a framer can wait for the rest. */
export function isKnownRequestFunction(functionCode: number): boolean {
  return [1, 2, 3, 4, 5, 6, 15, 16, 17, 22, 23, 43].includes(functionCode);
}

// --------------------------------------------------------------- respuesta

/**
 * Length of a response PDU from its first bytes, or null while it cannot be
 * known yet. FC43 is walked object by object.
 */
export function expectedResponsePduLength(pdu: Uint8Array): number | null {
  if (pdu.length < 1) return null;
  const functionCode = pdu[0];

  if (isExceptionFunctionCode(functionCode)) return 2;

  switch (functionCode) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 17:
    case 23:
      return pdu.length >= 2 ? 2 + pdu[1] : null;
    case 5:
    case 6:
    case 15:
    case 16:
      return 5;
    case 22:
      return 7;
    case 43: {
      // FC, MEI, code, conformity, more, next, count, then [id, len, value...]
      if (pdu.length < 7) return null;
      let offset = 7;
      for (let index = 0; index < pdu[6]; index += 1) {
        if (pdu.length < offset + 2) return null;
        offset += 2 + pdu[offset + 1];
      }
      return offset;
    }
    default:
      return null;
  }
}

export function decodeExceptionPdu(pdu: Uint8Array): ModbusResponse["exception"] | null {
  if (pdu.length !== 2 || !isExceptionFunctionCode(pdu[0])) return null;
  return {
    functionCode: originalFunctionCode(pdu[0]),
    exceptionCode: pdu[1],
    exceptionName: exceptionCodeName(pdu[1])
  };
}

/** Checks a response PDU against its request and extracts the values. Throws on a malformed reply. */
export function decodeResponsePdu(request: ModbusRequest, pdu: Uint8Array): ModbusResponse {
  if (pdu.length < 1) throw new Error("Respuesta vacía");

  const exception = decodeExceptionPdu(pdu);

  if (exception) {
    if (exception.functionCode !== request.fc) {
      throw new Error(`Excepción para FC${exception.functionCode}, se esperaba FC${request.fc}`);
    }
    return { functionCode: pdu[0], exception };
  }

  if (pdu[0] !== request.fc) {
    throw new Error(`La respuesta es FC${pdu[0]}, se esperaba FC${request.fc}`);
  }

  const expected = expectedResponsePduLength(pdu);

  if (expected === null || pdu.length !== expected) {
    throw new Error(`Longitud de respuesta inválida: ${pdu.length} bytes`);
  }

  switch (request.fc) {
    case 1:
    case 2: {
      const byteCount = pdu[1];
      if (byteCount !== Math.ceil(request.quantity / 8)) {
        throw new Error(`Se esperaban ${Math.ceil(request.quantity / 8)} bytes de bits y llegaron ${byteCount}`);
      }
      return { functionCode: pdu[0], bits: unpackBits(pdu.slice(2), request.quantity) };
    }
    case 3:
    case 4:
      return { functionCode: pdu[0], registers: readRegisterBytes(pdu, request.quantity) };
    case 23:
      return { functionCode: pdu[0], registers: readRegisterBytes(pdu, request.readQuantity) };
    case 5:
    case 6:
    case 15:
    case 16:
    case 22: {
      const sent = encodeRequestPdu(request);
      const echoLength = request.fc === 22 ? 7 : 5;
      if (!sameBytes(pdu.subarray(0, echoLength), sent.subarray(0, echoLength))) {
        throw new Error("La respuesta no repite la dirección y el valor enviados");
      }
      return { functionCode: pdu[0] };
    }
    case 17:
      return { functionCode: pdu[0], serverId: decodeServerId(pdu.slice(2)) };
    case 43:
      return { functionCode: pdu[0], deviceId: decodeDeviceId(pdu) };
  }
}

function readRegisterBytes(pdu: Uint8Array, quantity: number): number[] {
  const byteCount = pdu[1];
  if (byteCount !== quantity * 2) {
    throw new Error(`Se esperaban ${quantity * 2} bytes de registros y llegaron ${byteCount}`);
  }
  const values: number[] = [];
  for (let offset = 2; offset < 2 + byteCount; offset += 2) values.push(bytesToUint16(pdu, offset));
  return values;
}

function decodeServerId(data: Uint8Array): ServerIdReport {
  const text = Array.from(data.slice(2))
    .map((byte) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : " "))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return {
    data: Array.from(data),
    serverId: data.length > 0 ? data[0] : null,
    running: data.length > 1 ? data[1] === 0xff : null,
    text
  };
}

function decodeDeviceId(pdu: Uint8Array): DeviceIdentification {
  if (pdu[1] !== MEI_READ_DEVICE_ID) {
    throw new Error(`MEI 0x${hex2(pdu[1])} no es Read Device Identification`);
  }
  const objects: DeviceIdObject[] = [];
  let offset = 7;
  for (let index = 0; index < pdu[6]; index += 1) {
    const id = pdu[offset];
    const length = pdu[offset + 1];
    const value = new TextDecoder("latin1").decode(pdu.slice(offset + 2, offset + 2 + length));
    objects.push({ id, name: deviceIdObjectName(id), value });
    offset += 2 + length;
  }
  return {
    readDeviceIdCode: pdu[2],
    conformityLevel: pdu[3],
    moreFollows: pdu[4] === 0xff,
    nextObjectId: pdu[5],
    objects
  };
}

// ------------------------------------------------------------------ ayudas

function assertAddress(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${label} must be an integer between 0 and 65535`);
  }
}

function assertCount(value: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${label} must be between 1 and ${max}`);
  }
}

function assertFits(start: number, quantity: number): void {
  if (start + quantity > 0x10000) {
    throw new RangeError("the range goes past address 65535");
  }
}

function assertRegister(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError("register values must be integers between 0 and 65535");
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function hex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export { FunctionCode };
