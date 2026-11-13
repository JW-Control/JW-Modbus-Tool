// Separadores de tramas para flujos de bytes que no son RTU: Modbus ASCII
// (":" ... CR LF) y Modbus TCP (longitud en la cabecera MBAP).
import { bytesToUint16, concatBytes } from "./byteUtils.js";

/** Longest ASCII frame: ":" + 2 * (1 + 253 + 1) hex chars + CR LF. */
const MAX_ASCII_FRAME = 513;
/** Longest MBAP frame: 7-byte header + 253-byte PDU. */
const MAX_MBAP_FRAME = 260;

export class AsciiFramer {
  private buffer: Uint8Array = new Uint8Array(0);

  get pendingBytes(): number {
    return this.buffer.length;
  }

  push(chunk: Uint8Array): Uint8Array[] {
    this.buffer = concatBytes(this.buffer, chunk);
    const frames: Uint8Array[] = [];

    for (;;) {
      const start = this.buffer.indexOf(0x3a);
      if (start < 0) {
        this.buffer = new Uint8Array(0);
        break;
      }
      if (start > 0) this.buffer = this.buffer.slice(start);

      // A new ":" before the end restarts the frame (the spec's resync rule).
      const restart = this.buffer.indexOf(0x3a, 1);
      const lf = this.buffer.indexOf(0x0a, 1);

      if (restart > 0 && (lf < 0 || restart < lf)) {
        this.buffer = this.buffer.slice(restart);
        continue;
      }

      if (lf < 0) {
        if (this.buffer.length > MAX_ASCII_FRAME) this.buffer = new Uint8Array(0);
        break;
      }

      frames.push(this.buffer.slice(0, lf + 1));
      this.buffer = this.buffer.slice(lf + 1);
    }

    return frames;
  }

  flush(): Uint8Array | null {
    const rest = this.buffer;
    this.buffer = new Uint8Array(0);
    return rest.length ? rest : null;
  }
}

export class MbapFramer {
  private buffer: Uint8Array = new Uint8Array(0);

  get pendingBytes(): number {
    return this.buffer.length;
  }

  flush(): Uint8Array | null {
    const rest = this.buffer;
    this.buffer = new Uint8Array(0);
    return rest.length ? rest : null;
  }

  push(chunk: Uint8Array): Uint8Array[] {
    this.buffer = concatBytes(this.buffer, chunk);
    const frames: Uint8Array[] = [];

    while (this.buffer.length >= 6) {
      const total = 6 + bytesToUint16(this.buffer, 4);

      if (total < 8 || total > MAX_MBAP_FRAME) {
        // Not a Modbus TCP stream we can follow: drop it.
        this.buffer = new Uint8Array(0);
        break;
      }

      if (this.buffer.length < total) break;
      frames.push(this.buffer.slice(0, total));
      this.buffer = this.buffer.slice(total);
    }

    return frames;
  }
}
