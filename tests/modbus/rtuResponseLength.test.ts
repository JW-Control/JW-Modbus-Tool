import { describe, expect, it } from "vitest";
import { hexToBytes } from "../../src/shared/modbus/byteUtils.js";
import { expectedRtuResponseLength } from "../../src/shared/modbus/rtuResponseLength.js";

describe("expectedRtuResponseLength", () => {
  it("waits until a byte count is available for bit read responses", () => {
    expect(expectedRtuResponseLength(hexToBytes("02 02"))).toBeNull();
    expect(expectedRtuResponseLength(hexToBytes("02 02 01"))).toBe(6);
  });

  it("detects fixed write response lengths", () => {
    expect(expectedRtuResponseLength(hexToBytes("02 05"))).toBe(8);
    expect(expectedRtuResponseLength(hexToBytes("02 0F"))).toBe(8);
  });

  it("detects exception response length", () => {
    expect(expectedRtuResponseLength(hexToBytes("02 82"))).toBe(5);
  });
});
