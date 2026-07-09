import { describe, expect, it } from "vitest";
import {
  defaultSerialSettings,
  normalizeSerialSettings,
  serialFormatLabel
} from "../../src/renderer/serialSettingsModel.js";

describe("serial settings model", () => {
  it("normalizes a complete supported configuration", () => {
    expect(
      normalizeSerialSettings({
        portPath: "COM14",
        baudRate: 38400,
        dataBits: 7,
        parity: "even",
        stopBits: 2,
        timeoutMs: 2500
      })
    ).toEqual({
      portPath: "COM14",
      baudRate: 38400,
      dataBits: 7,
      parity: "even",
      stopBits: 2,
      timeoutMs: 2500
    });
  });

  it("falls back when persisted values are unsupported", () => {
    expect(
      normalizeSerialSettings({
        portPath: 14,
        baudRate: 12345,
        dataBits: 9,
        parity: "mark",
        stopBits: 3,
        timeoutMs: 0
      })
    ).toEqual(defaultSerialSettings);
  });

  it("formats common serial notation", () => {
    expect(serialFormatLabel(defaultSerialSettings)).toBe("115200 8N1");
    expect(
      serialFormatLabel({ baudRate: 19200, dataBits: 7, parity: "odd", stopBits: 2 })
    ).toBe("19200 7O2");
  });
});
