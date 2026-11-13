// Formatos de visualización y escritura de registros (como en Modbus Poll):
// enteros de 16, 32 y 64 bits con y sin signo, Float32, Float64, hex, binario
// y texto, con los cuatro órdenes de bytes habituales.

export type RegisterFormat =
  | "uint16"
  | "int16"
  | "hex16"
  | "bin16"
  | "ascii16"
  | "uint32"
  | "int32"
  | "float32"
  | "uint64"
  | "int64"
  | "float64";

/**
 * Byte order of the value across its registers, naming the bytes of a 32-bit
 * value A (most significant) to D:
 *   ABCD  big endian (Modbus standard)
 *   CDAB  words swapped (little-endian word order, common in PLCs)
 *   BADC  bytes swapped inside each word
 *   DCBA  little endian
 * 64-bit values follow the same rule over four words.
 */
export type ByteOrder = "ABCD" | "CDAB" | "BADC" | "DCBA";

export const registerFormats: RegisterFormat[] = [
  "uint16",
  "int16",
  "hex16",
  "bin16",
  "ascii16",
  "uint32",
  "int32",
  "float32",
  "uint64",
  "int64",
  "float64"
];

export const registerFormatLabels: Record<RegisterFormat, string> = {
  uint16: "UInt16 (sin signo)",
  int16: "Int16 (con signo)",
  hex16: "Hex",
  bin16: "Binario",
  ascii16: "Texto (2 caracteres)",
  uint32: "UInt32",
  int32: "Int32",
  float32: "Float32",
  uint64: "UInt64",
  int64: "Int64",
  float64: "Float64 (double)"
};

export const byteOrders: ByteOrder[] = ["ABCD", "CDAB", "BADC", "DCBA"];

export const byteOrderLabels: Record<ByteOrder, string> = {
  ABCD: "ABCD (big endian)",
  CDAB: "CDAB (palabras invertidas)",
  BADC: "BADC (bytes invertidos)",
  DCBA: "DCBA (little endian)"
};

export function isRegisterFormat(value: unknown): value is RegisterFormat {
  return typeof value === "string" && (registerFormats as string[]).includes(value);
}

export function isByteOrder(value: unknown): value is ByteOrder {
  return typeof value === "string" && (byteOrders as string[]).includes(value);
}

export function registersPerValue(format: RegisterFormat): 1 | 2 | 4 {
  if (format === "uint32" || format === "int32" || format === "float32") return 2;
  if (format === "uint64" || format === "int64" || format === "float64") return 4;
  return 1;
}

/** Registers (as read, first register first) to big-endian bytes of the value. */
function orderedBytes(registers: readonly number[], order: ByteOrder): Uint8Array {
  const words = order === "CDAB" || order === "DCBA" ? [...registers].reverse() : [...registers];
  const swapBytes = order === "BADC" || order === "DCBA";
  const bytes = new Uint8Array(words.length * 2);
  words.forEach((word, index) => {
    const hi = (word >> 8) & 0xff;
    const lo = word & 0xff;
    bytes[index * 2] = swapBytes ? lo : hi;
    bytes[index * 2 + 1] = swapBytes ? hi : lo;
  });
  return bytes;
}

/** Inverse of `orderedBytes`: big-endian value bytes to registers in wire order. */
function bytesToRegisters(bytes: Uint8Array, order: ByteOrder): number[] {
  const swapBytes = order === "BADC" || order === "DCBA";
  const words: number[] = [];
  for (let index = 0; index < bytes.length; index += 2) {
    const first = bytes[index];
    const second = bytes[index + 1];
    words.push(swapBytes ? (second << 8) | first : (first << 8) | second);
  }
  return order === "CDAB" || order === "DCBA" ? words.reverse() : words;
}

export function decodeRegisters(registers: readonly number[], format: RegisterFormat, order: ByteOrder = "ABCD"): string {
  const needed = registersPerValue(format);
  if (registers.length < needed) return "—";
  const bytes = orderedBytes(registers.slice(0, needed), order);
  const view = new DataView(bytes.buffer);

  switch (format) {
    case "uint16":
      return String(view.getUint16(0));
    case "int16":
      return String(view.getInt16(0));
    case "hex16":
      return `0x${view.getUint16(0).toString(16).toUpperCase().padStart(4, "0")}`;
    case "bin16": {
      const bits = view.getUint16(0).toString(2).padStart(16, "0");
      return `${bits.slice(0, 4)} ${bits.slice(4, 8)} ${bits.slice(8, 12)} ${bits.slice(12)}`;
    }
    case "ascii16":
      return Array.from(bytes, (byte) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : "·")).join("");
    case "uint32":
      return String(view.getUint32(0));
    case "int32":
      return String(view.getInt32(0));
    case "float32":
      return formatFloat(view.getFloat32(0), 7);
    case "uint64":
      return view.getBigUint64(0).toString();
    case "int64":
      return view.getBigInt64(0).toString();
    case "float64":
      return formatFloat(view.getFloat64(0), 15);
  }
}

/** Numeric value of the registers, for charts and statistics; null for text formats. */
export function numericValue(registers: readonly number[], format: RegisterFormat, order: ByteOrder = "ABCD"): number | null {
  if (format === "ascii16" || format === "bin16") return registers.length ? registers[0] : null;
  if (format === "hex16") return registers.length ? registers[0] : null;
  const text = decodeRegisters(registers, format, order);
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Parses what the user typed into the registers to write, in wire order. Throws RangeError when invalid. */
export function encodeValue(input: string, format: RegisterFormat, order: ByteOrder = "ABCD"): number[] {
  const text = input.trim();
  const size = registersPerValue(format) * 2;
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);

  switch (format) {
    case "uint16":
      view.setUint16(0, parseInteger(text, 0, 0xffff));
      break;
    case "int16":
      view.setInt16(0, parseInteger(text, -0x8000, 0x7fff));
      break;
    case "hex16":
      view.setUint16(0, parseInteger(text.toLowerCase().startsWith("0x") ? text : `0x${text}`, 0, 0xffff));
      break;
    case "bin16": {
      const clean = text.replace(/[\s_]/g, "").replace(/^0b/i, "");
      if (!/^[01]{1,16}$/.test(clean)) throw new RangeError("Escribe hasta 16 dígitos 0 o 1");
      view.setUint16(0, parseInt(clean, 2));
      break;
    }
    case "ascii16": {
      if (text.length > 2 || [...text].some((char) => char.charCodeAt(0) > 0x7e)) {
        throw new RangeError("Escribe hasta 2 caracteres ASCII");
      }
      bytes[0] = text.charCodeAt(0) || 0;
      bytes[1] = text.charCodeAt(1) || 0;
      break;
    }
    case "uint32":
      view.setUint32(0, parseInteger(text, 0, 0xffffffff));
      break;
    case "int32":
      view.setInt32(0, parseInteger(text, -0x80000000, 0x7fffffff));
      break;
    case "float32":
      view.setFloat32(0, parseFloatValue(text));
      break;
    case "uint64":
      view.setBigUint64(0, parseBigInteger(text, 0n, 0xffffffffffffffffn));
      break;
    case "int64":
      view.setBigInt64(0, parseBigInteger(text, -0x8000000000000000n, 0x7fffffffffffffffn));
      break;
    case "float64":
      view.setFloat64(0, parseFloatValue(text));
      break;
  }

  return bytesToRegisters(bytes, order);
}

function parseInteger(text: string, min: number, max: number): number {
  const value = /^[-+]?0x[0-9a-f]+$/i.test(text) ? Number.parseInt(text, 16) : /^[-+]?\d+$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`Escribe un entero entre ${min} y ${max}`);
  }
  return value;
}

function parseBigInteger(text: string, min: bigint, max: bigint): bigint {
  if (!/^[-+]?\d+$/.test(text)) throw new RangeError(`Escribe un entero entre ${min} y ${max}`);
  const value = BigInt(text);
  if (value < min || value > max) throw new RangeError(`Escribe un entero entre ${min} y ${max}`);
  return value;
}

function parseFloatValue(text: string): number {
  const value = Number(text.replace(",", "."));
  if (text === "" || !Number.isFinite(value)) throw new RangeError("Escribe un número, por ejemplo 12.5");
  return value;
}

function formatFloat(value: number, digits: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  return String(Number(value.toPrecision(digits)));
}
