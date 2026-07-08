export function assertByte(value: number, label = "byte"): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${label} must be an integer between 0 and 255`);
  }
}

export function assertUInt16(value: number, label = "uint16"): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${label} must be an integer between 0 and 65535`);
  }
}

export function uint16ToBytes(value: number): [number, number] {
  assertUInt16(value);
  return [(value >> 8) & 0xff, value & 0xff];
}

export function bytesToUint16(bytes: Uint8Array, offset = 0): number {
  if (offset < 0 || offset + 1 >= bytes.length) {
    throw new RangeError("Not enough bytes to read uint16");
  }

  return (bytes[offset] << 8) | bytes[offset + 1];
}

export function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

export function formatHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, "");

  if (clean.length % 2 !== 0) {
    throw new Error("Hex input must contain an even number of characters");
  }

  const output = new Uint8Array(clean.length / 2);

  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }

  return output;
}

export function packBits(values: readonly boolean[]): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(values.length / 8));

  values.forEach((value, index) => {
    if (value) {
      bytes[Math.floor(index / 8)] |= 1 << (index % 8);
    }
  });

  return bytes;
}

export function unpackBits(bytes: Uint8Array, quantity: number): boolean[] {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError("quantity must be a positive integer");
  }

  return Array.from({ length: quantity }, (_, index) => {
    const byte = bytes[Math.floor(index / 8)] ?? 0;
    return (byte & (1 << (index % 8))) !== 0;
  });
}
