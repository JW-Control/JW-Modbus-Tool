import { describe, expect, it } from "vitest";
import { formatHex, hexToBytes } from "../../src/shared/modbus/byteUtils.js";
import { appendCrc, crc16Modbus, hasValidCrc } from "../../src/shared/modbus/crc16.js";

describe("crc16Modbus", () => {
  it("matches the standard check value for 123456789", () => {
    const bytes = new TextEncoder().encode("123456789");

    expect(crc16Modbus(bytes)).toBe(0x4b37);
  });

  it("appends low byte then high byte for RTU frames", () => {
    const payload = hexToBytes("01 03 00 00 00 0A");
    const frame = appendCrc(payload);

    expect(formatHex(frame)).toBe("01 03 00 00 00 0A C5 CD");
    expect(hasValidCrc(frame)).toBe(true);
  });
});
