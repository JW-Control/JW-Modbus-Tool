import { describe, expect, it } from "vitest";
import { concatBytes, formatHex } from "../../src/shared/modbus/byteUtils.js";
import {
  encodeReadHoldingRegistersRequest,
  encodeWriteMultipleCoilsRequest,
  encodeWriteMultipleRegistersRequest,
  encodeWriteSingleCoilRequest
} from "../../src/shared/modbus/masterRequests.js";
import { buildRtuFrame } from "../../src/shared/modbus/rtuFrame.js";
import {
  RtuRequestFramer,
  expectedRtuRequestLength,
  rtuSilenceMs
} from "../../src/shared/modbus/rtuRequestFramer.js";

describe("expectedRtuRequestLength", () => {
  it("returns fixed lengths for FC1 to FC6 and byte-count lengths for FC15/FC16", () => {
    expect(expectedRtuRequestLength(encodeReadHoldingRegistersRequest({ unitId: 1, startAddress: 0, quantity: 2 }))).toBe(8);
    expect(expectedRtuRequestLength(encodeWriteSingleCoilRequest({ unitId: 1, address: 0, value: true }))).toBe(8);

    const fc16 = encodeWriteMultipleRegistersRequest({ unitId: 1, startAddress: 0, values: [1, 2, 3] });
    expect(expectedRtuRequestLength(fc16)).toBe(fc16.length);
    expect(expectedRtuRequestLength(fc16.slice(0, 6))).toBeNull();
    expect(expectedRtuRequestLength(Uint8Array.of(1, 0x2b))).toBeNull();
  });
});

describe("rtuSilenceMs", () => {
  it("uses 3.5 characters at low baud rates and 1.75 ms above 19200", () => {
    expect(rtuSilenceMs({ baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1 })).toBeCloseTo(3.646, 2);
    expect(rtuSilenceMs({ baudRate: 9600, dataBits: 8, parity: "even", stopBits: 1 })).toBeCloseTo(4.01, 2);
    expect(rtuSilenceMs({ baudRate: 115200, dataBits: 8, parity: "none", stopBits: 1 })).toBe(1.75);
  });
});

describe("RtuRequestFramer", () => {
  const read = encodeReadHoldingRegistersRequest({ unitId: 1, startAddress: 0, quantity: 4 });
  const writeCoils = encodeWriteMultipleCoilsRequest({ unitId: 2, startAddress: 0, values: [true, false, true] });

  it("splits back-to-back requests delivered in one chunk", () => {
    const framer = new RtuRequestFramer();
    const frames = framer.push(concatBytes(read, writeCoils, read));

    expect(frames.map(formatHex)).toEqual([formatHex(read), formatHex(writeCoils), formatHex(read)]);
    expect(framer.pendingBytes).toBe(0);
  });

  it("waits for the rest of a request split across chunks", () => {
    const framer = new RtuRequestFramer();

    expect(framer.push(writeCoils.slice(0, 3))).toEqual([]);
    expect(framer.push(writeCoils.slice(3, 8))).toEqual([]);
    expect(framer.push(writeCoils.slice(8)).map(formatHex)).toEqual([formatHex(writeCoils)]);
  });

  it("skips another slave's response on a shared bus and keeps the next request", () => {
    const framer = new RtuRequestFramer();
    // FC3 response from a real slave: 7 bytes, shorter than an FC3 request.
    const foreignResponse = buildRtuFrame(5, Uint8Array.of(0x03, 0x02, 0x12, 0x34));

    expect(framer.push(foreignResponse)).toEqual([]);
    const frames = framer.push(read);

    expect(frames.map(formatHex)).toEqual([formatHex(foreignResponse), formatHex(read)]);
  });

  it("frames unknown function codes by their CRC", () => {
    const framer = new RtuRequestFramer();
    const unknown = buildRtuFrame(1, Uint8Array.of(0x2b, 0x0e, 0x01, 0x00));

    expect(framer.push(concatBytes(unknown, read)).map(formatHex)).toEqual([formatHex(unknown), formatHex(read)]);
  });

  it("releases leftover noise on flush", () => {
    const framer = new RtuRequestFramer();

    expect(framer.push(Uint8Array.of(0xff, 0x00))).toEqual([]);
    expect(framer.flush()).toEqual(Uint8Array.of(0xff, 0x00));
    expect(framer.flush()).toBeNull();
  });
});
