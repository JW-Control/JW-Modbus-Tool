import { describe, expect, it } from "vitest";
import { formatHex } from "../../src/shared/modbus/byteUtils.js";
import { hasValidCrc } from "../../src/shared/modbus/crc16.js";
import {
  decodeBitReadResponse,
  encodeReadCoilsRequest,
  encodeReadDiscreteInputsRequest
} from "../../src/shared/modbus/masterRequests.js";
import {
  createSlaveDataModel,
  handleRtuSlaveRequest
} from "../../src/shared/modbus/slaveResponses.js";

describe("FC1 and FC2", () => {
  it("builds FC1 Read Coils requests", () => {
    const frame = encodeReadCoilsRequest({ unitId: 2, startAddress: 0, quantity: 8 });

    expect(formatHex(frame.slice(0, -2))).toBe("02 01 00 00 00 08");
    expect(hasValidCrc(frame)).toBe(true);
  });

  it("builds FC2 Read Discrete Inputs requests", () => {
    const frame = encodeReadDiscreteInputsRequest({ unitId: 2, startAddress: 0, quantity: 8 });

    expect(formatHex(frame.slice(0, -2))).toBe("02 02 00 00 00 08");
    expect(hasValidCrc(frame)).toBe(true);
  });

  it("responds to FC1 from the slave simulator", () => {
    const model = createSlaveDataModel({ coilCount: 8 });
    model.coils.splice(0, 8, true, false, true, false, true, false, true, false);
    const request = encodeReadCoilsRequest({ unitId: 2, startAddress: 0, quantity: 8 });
    const result = handleRtuSlaveRequest(request, model, { unitId: 2 });

    if (result.kind !== "response") {
      throw new Error(`Expected response, got ${result.kind}`);
    }

    const decoded = decodeBitReadResponse(result.response, 8);
    expect(decoded.values).toEqual([true, false, true, false, true, false, true, false]);
  });

  it("responds to FC2 from the slave simulator", () => {
    const model = createSlaveDataModel({ discreteInputCount: 8 });
    model.discreteInputs.splice(0, 8, false, true, false, true, false, true, false, true);
    const request = encodeReadDiscreteInputsRequest({ unitId: 2, startAddress: 0, quantity: 8 });
    const result = handleRtuSlaveRequest(request, model, { unitId: 2 });

    if (result.kind !== "response") {
      throw new Error(`Expected response, got ${result.kind}`);
    }

    const decoded = decodeBitReadResponse(result.response, 8);
    expect(decoded.values).toEqual([false, true, false, true, false, true, false, true]);
  });
});
