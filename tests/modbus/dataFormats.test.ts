import { describe, expect, it } from "vitest";
import { decodeRegisters, encodeValue, numericValue } from "../../src/shared/modbus/dataFormats.js";

describe("formatos de registros", () => {
  it("16 bits con y sin signo, hex, binario y texto", () => {
    expect(decodeRegisters([0xfffe], "uint16")).toBe("65534");
    expect(decodeRegisters([0xfffe], "int16")).toBe("-2");
    expect(decodeRegisters([0x00ff], "hex16")).toBe("0x00FF");
    expect(decodeRegisters([0x00ff], "bin16")).toBe("0000 0000 1111 1111");
    expect(decodeRegisters([0x4a57], "ascii16")).toBe("JW");
    expect(decodeRegisters([0x4a57], "ascii16", "BADC")).toBe("WJ");
  });

  it("Float32 123.456 en los cuatro órdenes", () => {
    // 123.456 = 0x42F6E979 (A=42 B=F6 C=E9 D=79)
    expect(decodeRegisters([0x42f6, 0xe979], "float32", "ABCD")).toBe("123.456");
    expect(decodeRegisters([0xe979, 0x42f6], "float32", "CDAB")).toBe("123.456");
    expect(decodeRegisters([0xf642, 0x79e9], "float32", "BADC")).toBe("123.456");
    expect(decodeRegisters([0x79e9, 0xf642], "float32", "DCBA")).toBe("123.456");
    for (const order of ["ABCD", "CDAB", "BADC", "DCBA"] as const) {
      expect(decodeRegisters(encodeValue("123.456", "float32", order), "float32", order)).toBe("123.456");
    }
  });

  it("Int32, UInt32, 64 bits y Float64 ida y vuelta", () => {
    expect(encodeValue("-2", "int32", "ABCD")).toEqual([0xffff, 0xfffe]);
    expect(encodeValue("-2", "int32", "CDAB")).toEqual([0xfffe, 0xffff]);
    expect(decodeRegisters([0x0001, 0x0000], "uint32", "CDAB")).toBe("1");
    expect(decodeRegisters(encodeValue("-9007199254740993", "int64"), "int64")).toBe("-9007199254740993");
    expect(decodeRegisters(encodeValue("18446744073709551615", "uint64", "DCBA"), "uint64", "DCBA")).toBe("18446744073709551615");
    expect(decodeRegisters(encodeValue("3.141592653589793", "float64", "CDAB"), "float64", "CDAB")).toBe("3.14159265358979");
  });

  it("rechaza valores fuera de rango o mal escritos", () => {
    expect(() => encodeValue("70000", "uint16")).toThrow(RangeError);
    expect(() => encodeValue("-40000", "int16")).toThrow(RangeError);
    expect(() => encodeValue("1.5", "int32")).toThrow(RangeError);
    expect(() => encodeValue("abc", "float32")).toThrow(RangeError);
    expect(() => encodeValue("102", "bin16")).toThrow(RangeError);
    expect(encodeValue("FF", "hex16")).toEqual([0x00ff]);
    expect(encodeValue("1010", "bin16")).toEqual([10]);
  });

  it("da el valor numérico para gráficas", () => {
    expect(numericValue([0x42f6, 0xe979], "float32")).toBeCloseTo(123.456, 3);
    expect(numericValue([0xfffe], "int16")).toBe(-2);
  });
});
