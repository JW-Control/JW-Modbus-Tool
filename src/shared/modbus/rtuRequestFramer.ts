import { concatBytes } from "./byteUtils.js";
import { hasValidCrc } from "./crc16.js";
import { FunctionCode } from "./functionCodes.js";
import type { NormalizedSerialPortConfig } from "../serial/types.js";

const MIN_FRAME_LENGTH = 4;

export function expectedRtuRequestLength(bytes: Uint8Array): number | null {
  if (bytes.length < 2) {
    return null;
  }

  switch (bytes[1]) {
    case FunctionCode.ReadCoils:
    case FunctionCode.ReadDiscreteInputs:
    case FunctionCode.ReadHoldingRegisters:
    case FunctionCode.ReadInputRegisters:
    case FunctionCode.WriteSingleCoil:
    case FunctionCode.WriteSingleRegister:
      return 8;
    case FunctionCode.WriteMultipleCoils:
    case FunctionCode.WriteMultipleRegisters:
      return bytes.length >= 7 ? 7 + bytes[6] + 2 : null;
    default:
      return null;
  }
}

/**
 * Silence that marks the end of an RTU frame (3.5 character times). Above
 * 19200 baud the Modbus spec fixes it at 1.75 ms.
 */
export function rtuSilenceMs(config: Pick<NormalizedSerialPortConfig, "baudRate" | "dataBits" | "parity" | "stopBits">): number {
  if (config.baudRate > 19200) {
    return 1.75;
  }

  const bitsPerCharacter = 1 + config.dataBits + (config.parity === "none" ? 0 : 1) + config.stopBits;
  return (3.5 * bitsPerCharacter * 1000) / config.baudRate;
}

/**
 * Splits a slave-side byte stream into RTU request frames.
 *
 * Requests are cut by their function-code length. When that length does not
 * yield a valid CRC (a misaligned stream, or another slave's response on a
 * shared RS-485 bus) the shortest CRC-valid prefix is taken instead. Bytes that
 * never form a frame are released by `flush()`, which the owner calls after a
 * period of line silence.
 */
export class RtuRequestFramer {
  private buffer: Uint8Array = new Uint8Array(0);

  get pendingBytes(): number {
    return this.buffer.length;
  }

  push(chunk: Uint8Array): Uint8Array[] {
    this.buffer = concatBytes(this.buffer, chunk);
    const frames: Uint8Array[] = [];
    let frame = this.next();

    while (frame) {
      frames.push(frame);
      frame = this.next();
    }

    return frames;
  }

  flush(): Uint8Array | null {
    if (this.buffer.length === 0) {
      return null;
    }

    const rest = this.buffer;
    this.buffer = new Uint8Array(0);
    return rest;
  }

  private next(): Uint8Array | null {
    const expectedLength = expectedRtuRequestLength(this.buffer);

    if (expectedLength !== null) {
      if (this.buffer.length < expectedLength) {
        return null;
      }

      const candidate = this.buffer.slice(0, expectedLength);

      if (hasValidCrc(candidate)) {
        return this.take(expectedLength);
      }

      const shorter = this.shortestValidPrefix(expectedLength - 1);
      return this.take(shorter ?? expectedLength);
    }

    const valid = this.shortestValidPrefix(this.buffer.length);
    return valid === null ? null : this.take(valid);
  }

  private shortestValidPrefix(maxLength: number): number | null {
    for (let length = MIN_FRAME_LENGTH; length <= maxLength; length += 1) {
      if (hasValidCrc(this.buffer.subarray(0, length))) {
        return length;
      }
    }

    return null;
  }

  private take(length: number): Uint8Array {
    const frame = this.buffer.slice(0, length);
    this.buffer = this.buffer.slice(length);
    return frame;
  }
}
