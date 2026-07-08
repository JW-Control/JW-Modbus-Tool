import { describe, expect, it } from "vitest";
import {
  listSerialPorts,
  normalizeSerialPorts,
  toSerialResult,
  validateSerialPortConfig
} from "../../src/main/serial/serialManager.js";

describe("serialManager", () => {
  it("normalizes and naturally sorts Windows COM ports", () => {
    const ports = normalizeSerialPorts([
      { path: "COM10", manufacturer: "USB Serial" },
      { path: "COM2" },
      { path: "COM1", vendorId: "1234", productId: "ABCD" }
    ]);

    expect(ports.map((port) => port.path)).toEqual(["COM1", "COM2", "COM10"]);
    expect(ports[0]).toMatchObject({
      displayName: "COM1",
      vendorId: "1234",
      productId: "ABCD"
    });
    expect(ports[2].displayName).toBe("COM10 - USB Serial");
  });

  it("lists ports through an injectable lister", async () => {
    const ports = await listSerialPorts({
      list: async () => [{ path: "COM4", manufacturer: "JW Control" }]
    });

    expect(ports).toEqual([
      {
        path: "COM4",
        displayName: "COM4 - JW Control",
        manufacturer: "JW Control",
        serialNumber: undefined,
        pnpId: undefined,
        locationId: undefined,
        vendorId: undefined,
        productId: undefined
      }
    ]);
  });

  it("validates and defaults serial RTU settings", () => {
    expect(validateSerialPortConfig({ path: " COM7 ", baudRate: 115200 })).toEqual({
      path: "COM7",
      baudRate: 115200,
      dataBits: 8,
      parity: "none",
      stopBits: 1,
      lock: true
    });
  });

  it("rejects unsupported baud rates", () => {
    expect(() => validateSerialPortConfig({ path: "COM7", baudRate: 12345 })).toThrow(
      "Unsupported baud rate"
    );
  });

  it("serializes async errors for IPC callers", async () => {
    await expect(
      toSerialResult(async () => {
        throw new Error("Port busy");
      })
    ).resolves.toEqual({
      ok: false,
      error: "Port busy"
    });
  });
});
