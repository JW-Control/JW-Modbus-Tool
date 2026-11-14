import { describe, expect, it } from "vitest";
import { formatHex } from "../../src/shared/modbus/byteUtils.js";
import {
  encodeReadCoilsRequest,
  encodeWriteMultipleRegistersRequest,
  encodeWriteSingleCoilRequest
} from "../../src/shared/modbus/masterRequests.js";
import { decideEcho, splitEcho } from "../../src/shared/serial/echoFilter.js";

const bytes = (hex: string) => Uint8Array.from(hex.split(" ").map((value) => parseInt(value, 16)));
const readCoils = encodeReadCoilsRequest({ unitId: 2, startAddress: 0, quantity: 8 });
const response = bytes("02 01 01 05 91 8F");
const echoed = Uint8Array.from([...readCoils, ...response]);

describe("splitEcho", () => {
  it("waits while the bytes can still be the echo", () => {
    expect(splitEcho(readCoils, readCoils.slice(0, 4))).toEqual({ status: "partial" });
  });

  it("drops a full echo and keeps what follows", () => {
    const split = splitEcho(readCoils, echoed);
    expect(split.status).toBe("echo");
    expect(split.status === "echo" && formatHex(split.payload)).toBe(formatHex(response));
  });

  it("reports no echo as soon as a byte differs", () => {
    expect(splitEcho(readCoils, response)).toEqual({ status: "none", payload: response });
  });
});

describe("decideEcho", () => {
  it("off mode passes everything through", () => {
    expect(decideEcho("off", readCoils, echoed, undefined)).toEqual({ action: "parse", payload: echoed, echoSeen: false });
  });

  it("auto mode handles reads with and without echo", () => {
    expect(decideEcho("auto", readCoils, response, undefined)).toEqual({ action: "parse", payload: response, echoSeen: false });
    expect(decideEcho("auto", readCoils, echoed, undefined)).toMatchObject({ action: "parse", echoSeen: true });
  });

  it("auto mode distinguishes an FC16 response from its echo by the first differing byte", () => {
    const request = encodeWriteMultipleRegistersRequest({ unitId: 2, startAddress: 2, values: [1, 2, 3] });
    const reply = bytes("02 10 00 02 00 03 20 3A");
    expect(decideEcho("auto", request, reply, undefined)).toMatchObject({ action: "parse", echoSeen: false });
    expect(decideEcho("auto", request, request.slice(0, 8), undefined)).toEqual({ action: "wait" });
  });

  it("FC5 alone is ambiguous until the converter is known", () => {
    const write = encodeWriteSingleCoilRequest({ unitId: 2, address: 0, value: true });
    expect(decideEcho("auto", write, write, undefined)).toEqual({ action: "ambiguous", candidate: write });
    expect(decideEcho("auto", write, write, false)).toMatchObject({ action: "parse", echoSeen: false });
    expect(decideEcho("auto", write, write, true)).toEqual({ action: "wait" });
    expect(decideEcho("on", write, write, undefined)).toEqual({ action: "wait" });
    const twice = Uint8Array.from([...write, ...write]);
    expect(decideEcho("auto", write, twice, undefined)).toMatchObject({ action: "parse", echoSeen: true });
  });
});
