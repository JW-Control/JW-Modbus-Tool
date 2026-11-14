// Envolturas (ADU) de los tres transportes Modbus sobre la misma PDU:
//   RTU    unit id + PDU + CRC16 (binario)
//   ASCII  ":" + hex(unit id + PDU + LRC) + CR LF
//   TCP    cabecera MBAP (transacción, protocolo 0, longitud, unit id) + PDU
import { bytesToUint16, concatBytes, uint16ToBytes } from "./byteUtils.js";
import { appendCrc, crc16Modbus, readFrameCrc } from "./crc16.js";
import { expectedRequestPduLength, expectedResponsePduLength } from "./pdu.js";

export type Framing = "rtu" | "ascii" | "tcp";

export const framingLabels: Record<Framing, string> = {
  rtu: "RTU",
  ascii: "ASCII",
  tcp: "TCP (MBAP)"
};

export interface ParsedAdu {
  unitId: number;
  pdu: Uint8Array;
  /** CRC (RTU), LRC (ASCII) or MBAP header (TCP) are valid. */
  checkOk: boolean;
  /** Why `checkOk` is false, in words. */
  checkError?: string;
  transactionId?: number;
}

const COLON = 0x3a;
const CR = 0x0d;
const LF = 0x0a;

// --------------------------------------------------------------------- RTU

export function buildRtuAdu(unitId: number, pdu: Uint8Array): Uint8Array {
  assertUnitId(unitId);
  return appendCrc(concatBytes(Uint8Array.of(unitId), pdu));
}

export function parseRtuAdu(frame: Uint8Array): ParsedAdu {
  if (frame.length < 4) {
    return { unitId: frame[0] ?? 0, pdu: frame.slice(1), checkOk: false, checkError: "Trama RTU incompleta" };
  }
  const checkOk = crc16Modbus(frame.subarray(0, -2)) === readFrameCrc(frame);
  return { unitId: frame[0], pdu: frame.slice(1, -2), checkOk, checkError: checkOk ? undefined : "Error de CRC" };
}

// ------------------------------------------------------------------- ASCII

export function lrc(bytes: Uint8Array): number {
  let sum = 0;
  for (const byte of bytes) sum = (sum + byte) & 0xff;
  return (-sum) & 0xff;
}

export function buildAsciiAdu(unitId: number, pdu: Uint8Array): Uint8Array {
  assertUnitId(unitId);
  const body = concatBytes(Uint8Array.of(unitId), pdu);
  const text = `:${toHex(body)}${toHex(Uint8Array.of(lrc(body)))}\r\n`;
  return new TextEncoder().encode(text);
}

export function parseAsciiAdu(frame: Uint8Array): ParsedAdu {
  const text = new TextDecoder("latin1").decode(frame);
  const fail = (checkError: string): ParsedAdu => ({ unitId: 0, pdu: new Uint8Array(0), checkOk: false, checkError });

  if (!text.startsWith(":")) return fail("La trama ASCII no empieza con ':'");
  if (!text.endsWith("\r\n")) return fail("La trama ASCII no termina en CR LF");

  const hex = text.slice(1, -2);
  if (hex.length < 6 || hex.length % 2 !== 0 || !/^[0-9A-Fa-f]+$/.test(hex)) {
    return fail("Caracteres hex inválidos en la trama ASCII");
  }

  const bytes = fromHex(hex);
  const body = bytes.subarray(0, -1);
  const checkOk = lrc(body) === bytes[bytes.length - 1];
  return { unitId: body[0], pdu: body.slice(1), checkOk, checkError: checkOk ? undefined : "Error de LRC" };
}

// --------------------------------------------------------------------- TCP

export function buildMbapAdu(transactionId: number, unitId: number, pdu: Uint8Array): Uint8Array {
  if (!Number.isInteger(unitId) || unitId < 0 || unitId > 255) {
    throw new RangeError("unitId must be an integer between 0 and 255");
  }
  return concatBytes(
    Uint8Array.of(...uint16ToBytes(transactionId & 0xffff), 0, 0, ...uint16ToBytes(pdu.length + 1), unitId),
    pdu
  );
}

export function parseMbapAdu(frame: Uint8Array): ParsedAdu {
  if (frame.length < 8) {
    return { unitId: frame[6] ?? 0, pdu: frame.slice(7), checkOk: false, checkError: "Trama TCP incompleta" };
  }
  const transactionId = bytesToUint16(frame, 0);
  const protocolId = bytesToUint16(frame, 2);
  const length = bytesToUint16(frame, 4);
  const unitId = frame[6];
  const pdu = frame.slice(7);
  let checkError: string | undefined;
  if (protocolId !== 0) checkError = `Protocolo MBAP ${protocolId} (se esperaba 0)`;
  else if (length !== frame.length - 6) checkError = `Longitud MBAP ${length} no coincide con la trama`;
  return { unitId, pdu, checkOk: !checkError, checkError, transactionId };
}

// ------------------------------------------------------------------ común

export function buildAdu(framing: Framing, unitId: number, pdu: Uint8Array, transactionId = 0): Uint8Array {
  if (framing === "ascii") return buildAsciiAdu(unitId, pdu);
  if (framing === "tcp") return buildMbapAdu(transactionId, unitId, pdu);
  return buildRtuAdu(unitId, pdu);
}

export function parseAdu(framing: Framing, frame: Uint8Array): ParsedAdu {
  if (framing === "ascii") return parseAsciiAdu(frame);
  if (framing === "tcp") return parseMbapAdu(frame);
  return parseRtuAdu(frame);
}

/**
 * Length of a complete ADU from its first bytes, or null while it cannot be
 * known. For RTU the PDU length decides; ASCII ends at LF; TCP uses MBAP.
 */
export function expectedAduLength(framing: Framing, bytes: Uint8Array, side: "request" | "response"): number | null {
  if (framing === "ascii") {
    const start = bytes.indexOf(COLON);
    if (start < 0) return null;
    for (let index = start + 1; index < bytes.length; index += 1) {
      if (bytes[index] === LF && bytes[index - 1] === CR) return index + 1;
    }
    return null;
  }

  if (framing === "tcp") {
    return bytes.length >= 6 ? 6 + bytesToUint16(bytes, 4) : null;
  }

  if (bytes.length < 2) return null;
  const pduLength = (side === "request" ? expectedRequestPduLength : expectedResponsePduLength)(bytes.subarray(1));
  return pduLength === null ? null : 1 + pduLength + 2;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

/** Shows an ASCII frame as text (":0103...\r\n") and binary frames as hex bytes. */
export function formatAdu(framing: Framing, frame: Uint8Array): string {
  if (framing === "ascii") {
    return new TextDecoder("latin1").decode(frame).replace(/\r/g, "\\r").replace(/\n/g, "\\n");
  }
  return Array.from(frame, (byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function assertUnitId(unitId: number): void {
  if (!Number.isInteger(unitId) || unitId < 0 || unitId > 255) {
    throw new RangeError("unitId must be an integer between 0 and 255");
  }
}

export { CR, LF, COLON };
