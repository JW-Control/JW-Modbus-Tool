import { describe, expect, it } from "vitest";
import { formatHex } from "../../src/shared/modbus/byteUtils.js";
import {
  decodeRegisterReadResponse,
  encodeReadHoldingRegistersRequest,
  encodeWriteSingleCoilRequest,
  encodeWriteSingleRegisterRequest
} from "../../src/shared/modbus/masterRequests.js";
import { VirtualSlaveBus } from "../../src/shared/modbus/virtualSlaveBus.js";

describe("VirtualSlaveBus", () => {
  it("routes each request to the device with its unit id", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1, "Tanque");
    bus.addDevice(2, "Bomba");
    bus.setValue({ unitId: 1, table: "holdingRegisters", address: 0, value: 111 });
    bus.setValue({ unitId: 2, table: "holdingRegisters", address: 0, value: 222 });

    const one = bus.handleFrame(encodeReadHoldingRegistersRequest({ unitId: 1, startAddress: 0, quantity: 1 }));
    const two = bus.handleFrame(encodeReadHoldingRegistersRequest({ unitId: 2, startAddress: 0, quantity: 1 }));

    expect(one.kind === "response" && decodeRegisterReadResponse(one.response).values).toEqual([111]);
    expect(two.kind === "response" && decodeRegisterReadResponse(two.response).values).toEqual([222]);
    expect(bus.listDevices().map((device) => [device.unitId, device.requests])).toEqual([[1, 1], [2, 1]]);
  });

  it("ignores unit ids with no virtual device and frames with a bad CRC", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1);

    const missing = bus.handleFrame(encodeReadHoldingRegistersRequest({ unitId: 9, startAddress: 0, quantity: 1 }));
    const corrupted = encodeReadHoldingRegistersRequest({ unitId: 1, startAddress: 0, quantity: 1 });
    corrupted[7] ^= 0xff;

    expect(missing).toMatchObject({ kind: "ignored", reason: "unit-id-mismatch", unitId: 9 });
    expect(bus.handleFrame(corrupted)).toMatchObject({ kind: "ignored", reason: "crc-error", unitId: 1 });
  });

  it("reports which devices a write changed", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(3);

    const write = bus.handleFrame(encodeWriteSingleRegisterRequest({ unitId: 3, address: 5, value: 42 }));
    const outOfRange = bus.handleFrame(encodeWriteSingleRegisterRequest({ unitId: 3, address: 500, value: 1 }));

    expect(write.changedUnitIds).toEqual([3]);
    expect(bus.getDevice(3).holdingRegisters[5]).toBe(42);
    expect(outOfRange.kind === "response" && formatHex(outOfRange.response.slice(0, 3))).toBe("03 86 02");
    expect(outOfRange.changedUnitIds).toEqual([]);
  });

  it("applies broadcast writes to every device without answering", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1);
    bus.addDevice(2);

    const result = bus.handleFrame(encodeWriteSingleCoilRequest({ unitId: 0, address: 0, value: true }));

    expect(result.kind).toBe("broadcast");
    expect(result.changedUnitIds).toEqual([1, 2]);
    expect(bus.getDevice(1).coils[0]).toBe(true);
    expect(bus.getDevice(2).coils[0]).toBe(true);
  });

  it("validates device ids, table sizes, and edited values", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1, undefined, { holdingRegisters: 10 });

    expect(() => bus.addDevice(1)).toThrow(/Ya existe/);
    expect(() => bus.addDevice(0)).toThrow(/entre 1 y 247/);
    expect(() => bus.addDevice(2, undefined, { coils: 0 })).toThrow(/tamaño/);
    expect(() => bus.setValue({ unitId: 1, table: "holdingRegisters", address: 10, value: 1 })).toThrow(/fuera/);
    expect(() => bus.setValue({ unitId: 1, table: "holdingRegisters", address: 0, value: 70000 })).toThrow(/65535/);
    expect(bus.getDevice(1)).toMatchObject({ name: "Slave virtual 1", sizes: { holdingRegisters: 10, coils: 64 } });
  });
});
