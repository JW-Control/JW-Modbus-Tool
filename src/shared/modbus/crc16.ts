import { concatBytes } from "./byteUtils.js";

export function crc16Modbus(bytes: Uint8Array): number {
  let crc = 0xffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      const carry = (crc & 0x0001) !== 0;
      crc >>= 1;

      if (carry) {
        crc ^= 0xa001;
      }
    }
  }

  return crc & 0xffff;
}

export function crcToLowHighBytes(crc: number): [number, number] {
  return [crc & 0xff, (crc >> 8) & 0xff];
}

export function appendCrc(bytes: Uint8Array): Uint8Array {
  return concatBytes(bytes, Uint8Array.from(crcToLowHighBytes(crc16Modbus(bytes))));
}

export function readFrameCrc(frame: Uint8Array): number {
  if (frame.length < 2) {
    throw new Error("RTU frame is too short to contain a CRC");
  }

  return frame[frame.length - 2] | (frame[frame.length - 1] << 8);
}

export function hasValidCrc(frame: Uint8Array): boolean {
  if (frame.length < 4) {
    return false;
  }

  const payload = frame.slice(0, -2);
  return crc16Modbus(payload) === readFrameCrc(frame);
}
