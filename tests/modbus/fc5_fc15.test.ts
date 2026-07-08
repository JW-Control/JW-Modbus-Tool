import { describe, expect, it } from "vitest";
import { formatHex } from "../../src/shared/modbus/byteUtils.js";
import { hasValidCrc } from "../../src/shared/modbus/crc16.js";
import { ExceptionCode } from "../../src/shared/modbus/exceptions.js";
import {
  encodeWriteMultipleCoilsRequest,
  encodeWriteSingleCoilRequest
} from "../../src/shared/modbus/masterRequests.js";
import { decodeExceptionResponse } from "../../src/shared/modbus/rtuFrame.js";
import {
  createSlaveDataModel,
  handleRtuSlaveRequest
} from "../../src/shared/modbus/slaveResponses.js";

describe("FC5 and FC15", () => {
  it("builds FC5 Write Single Coil requests", () => {
    const frame = encodeWriteSingleCoilRequest({ unitId: 2, address: 0, value: true });

    expect(formatHex(frame.slice(0, -2))).toBe("02 05 00 00 FF 00");
    expect(hasValidCrc(frame)).toBe(true);
  });

  it("builds FC15 Write Multiple Coils requests", () => {
    const frame = encodeWriteMultipleCoilsRequest({
      unitId: 2,
      startAddress: 0,
      values: [true, false, true, false, true, false, true, false]
    });

    expect(formatHex(frame.slice(0, -2))).toBe("02 0F 00 00 00 08 01 55");
    expect(hasValidCrc(frame)).toBe(true);
  });

  it("applies FC5 writes in the slave simulator", () => {
    const model = createSlaveDataModel({ coilCount: 8 });
    const request = encodeWriteSingleCoilRequest({ unitId: 2, address: 3, value: true });
    const result = handleRtuSlaveRequest(request, model, { unitId: 2 });

    expect(model.coils[3]).toBe(true);
    expect(result.kind).toBe("response");

    if (result.kind === "response") {
      expect(formatHex(result.response)).toBe(formatHex(request));
    }
  });

  it("applies FC15 writes in the slave simulator", () => {
    const model = createSlaveDataModel({ coilCount: 8 });
    const request = encodeWriteMultipleCoilsRequest({
      unitId: 2,
      startAddress: 0,
      values: [true, false, true, false, true, false, true, false]
    });
    const result = handleRtuSlaveRequest(request, model, { unitId: 2 });

    expect(model.coils).toEqual([true, false, true, false, true, false, true, false]);
    expect(result.kind).toBe("response");

    if (result.kind === "response") {
      expect(formatHex(result.response.slice(0, -2))).toBe("02 0F 00 00 00 08");
      expect(hasValidCrc(result.response)).toBe(true);
    }
  });

  it("returns exception 0x02 when FC15 range is outside the coil map", () => {
    const model = createSlaveDataModel({ coilCount: 4 });
    const request = encodeWriteMultipleCoilsRequest({
      unitId: 2,
      startAddress: 3,
      values: [true, false]
    });
    const result = handleRtuSlaveRequest(request, model, { unitId: 2 });

    if (result.kind !== "response") {
      throw new Error(`Expected response, got ${result.kind}`);
    }

    const decoded = decodeExceptionResponse(result.response);
    expect(decoded?.exceptionCode).toBe(ExceptionCode.IllegalDataAddress);
  });
});
