import { describe, expect, it } from "vitest";
import { hasValidCrc } from "../../src/shared/modbus/crc16.js";
import {
  decodeBitReadResponse,
  encodeReadCoilsRequest,
  encodeReadHoldingRegistersRequest,
  encodeWriteSingleCoilRequest,
  encodeWriteSingleRegisterRequest
} from "../../src/shared/modbus/masterRequests.js";
import { decodeExceptionResponse } from "../../src/shared/modbus/rtuFrame.js";
import { VirtualSlaveBus } from "../../src/shared/modbus/virtualSlaveBus.js";

describe("JWPLC Basic Remote I/O template", () => {
  it("creates the same map as the real firmware: 8 coils, 8 inputs, no registers", () => {
    const bus = new VirtualSlaveBus();
    const device = bus.addDevice(2, undefined, {}, "jwplc-basic-remote-io");

    expect(device).toMatchObject({
      name: "JWPLC Basic Remote I/O",
      template: "jwplc-basic-remote-io",
      sizes: { coils: 8, discreteInputs: 8, holdingRegisters: 0, inputRegisters: 0 }
    });
    expect(device.labels.coils?.[0]).toBe("Q0_0");
    expect(device.labels.discreteInputs?.[7]).toBe("I0_7");
  });

  it("answers register reads with exception 02, like the real device", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(2, undefined, {}, "jwplc-basic-remote-io");

    const result = bus.handleFrame(encodeReadHoldingRegistersRequest({ unitId: 2, startAddress: 0, quantity: 1 }));

    expect(result.kind === "response" && decodeExceptionResponse(result.response)?.exceptionCode).toBe(2);
  });

  it("rejects unknown templates", () => {
    expect(() => new VirtualSlaveBus().addDevice(2, undefined, {}, "nope")).toThrow(/Plantilla desconocida/);
  });
});

describe("virtual device faults", () => {
  const readCoils = encodeReadCoilsRequest({ unitId: 1, startAddress: 0, quantity: 8 });

  it("stays silent and ignores writes in no-response mode", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1);
    bus.setFaults(1, { mode: "no-response" });

    const result = bus.handleFrame(encodeWriteSingleCoilRequest({ unitId: 1, address: 0, value: true }));

    expect(result.kind).toBe("silenced");
    expect(result.fault?.mode).toBe("no-response");
    expect(bus.getDevice(1).coils[0]).toBe(false);
  });

  it("corrupts the CRC but still applies the request", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1);
    bus.setFaults(1, { mode: "bad-crc" });

    const write = bus.handleFrame(encodeWriteSingleRegisterRequest({ unitId: 1, address: 0, value: 7 }));

    expect(write.kind === "response" && hasValidCrc(write.response)).toBe(false);
    expect(bus.getDevice(1).holdingRegisters[0]).toBe(7);
  });

  it("forces the chosen exception code without touching the memory", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1);
    bus.setFaults(1, { mode: "exception", exceptionCode: 4 });

    const result = bus.handleFrame(encodeWriteSingleCoilRequest({ unitId: 1, address: 0, value: true }));
    const exception = result.kind === "response" ? decodeExceptionResponse(result.response) : null;

    expect(exception).toMatchObject({ exceptionCode: 4, exceptionName: "Slave Device Failure", functionCode: 5 });
    expect(bus.getDevice(1).coils[0]).toBe(false);
  });

  it("reports a delay-only fault while answering normally", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1);
    bus.setFaults(1, { delayMs: 250 });

    const result = bus.handleFrame(readCoils);

    expect(result.kind === "response" && decodeBitReadResponse(result.response, 8).values).toHaveLength(8);
    expect(result.fault).toEqual({ mode: "none", delayMs: 250, exceptionCode: 2 });
  });

  it("validates fault settings", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1);

    expect(() => bus.setFaults(1, { delayMs: -5 })).toThrow(/retardo/);
    expect(() => bus.setFaults(1, { mode: "explode" as never })).toThrow(/Modo de falla/);
    expect(() => bus.setFaults(1, { exceptionCode: 9 as never })).toThrow(/01, 02, 03 o 04/);
  });
});

describe("session export and import", () => {
  it("round-trips devices with values, labels, and faults", () => {
    const source = new VirtualSlaveBus();
    source.addDevice(2, "Planta", {}, "jwplc-basic-remote-io");
    source.addDevice(5, "Tanque", { holdingRegisters: 4 });
    source.setValue({ unitId: 2, table: "coils", address: 3, value: true });
    source.setValue({ unitId: 5, table: "holdingRegisters", address: 1, value: 999 });
    source.setFaults(5, { mode: "bad-crc", delayMs: 50 });

    const target = new VirtualSlaveBus();
    target.addDevice(9);
    target.replaceDevices(JSON.parse(JSON.stringify(source.exportDevices())));

    expect(target.listDevices().map((device) => device.unitId)).toEqual([2, 5]);
    expect(target.getDevice(2)).toMatchObject({ name: "Planta", template: "jwplc-basic-remote-io", sizes: { coils: 8, holdingRegisters: 0 } });
    expect(target.getDevice(2).coils[3]).toBe(true);
    expect(target.getDevice(2).labels.coils?.[3]).toBe("Q0_3");
    expect(target.getDevice(5).holdingRegisters).toEqual([0, 999, 0, 0]);
    expect(target.getDevice(5).faults).toEqual({ mode: "bad-crc", delayMs: 50, exceptionCode: 2 });
  });

  it("leaves the current devices untouched when the file is invalid", () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(1);
    const exported = bus.exportDevices();

    expect(() => bus.replaceDevices([...exported, ...exported])).toThrow(/aparece dos veces/);
    expect(() => bus.replaceDevices([{ ...exported[0], unitId: 300 }])).toThrow(/entre 1 y 247/);
    expect(bus.listDevices().map((device) => device.unitId)).toEqual([1]);
  });
});
