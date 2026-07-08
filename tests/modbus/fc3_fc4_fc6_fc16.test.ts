import { describe, expect, it } from "vitest";
import { formatHex } from "../../src/shared/modbus/byteUtils.js";
import { hasValidCrc } from "../../src/shared/modbus/crc16.js";
import { ExceptionCode } from "../../src/shared/modbus/exceptions.js";
import {
  decodeRegisterReadResponse,
  encodeReadHoldingRegistersRequest,
  encodeReadInputRegistersRequest,
  encodeWriteMultipleRegistersRequest,
  encodeWriteSingleRegisterRequest
} from "../../src/shared/modbus/masterRequests.js";
import { buildExceptionFrame, decodeExceptionResponse } from "../../src/shared/modbus/rtuFrame.js";
import {
  createSlaveDataModel,
  handleRtuSlaveRequest
} from "../../src/shared/modbus/slaveResponses.js";

describe("FC3, FC4, FC6, and FC16", () => {
  it("builds FC3 and FC4 read register requests", () => {
    const fc3 = encodeReadHoldingRegistersRequest({ unitId: 2, startAddress: 0, quantity: 2 });
    const fc4 = encodeReadInputRegistersRequest({ unitId: 2, startAddress: 1, quantity: 2 });

    expect(formatHex(fc3.slice(0, -2))).toBe("02 03 00 00 00 02");
    expect(formatHex(fc4.slice(0, -2))).toBe("02 04 00 01 00 02");
    expect(hasValidCrc(fc3)).toBe(true);
    expect(hasValidCrc(fc4)).toBe(true);
  });

  it("responds to FC3 and FC4 from the slave simulator", () => {
    const model = createSlaveDataModel({ holdingRegisterCount: 4, inputRegisterCount: 4 });
    model.holdingRegisters.splice(0, 2, 0x1234, 0xabcd);
    model.inputRegisters.splice(1, 2, 0x0007, 0x0008);

    const fc3 = handleRtuSlaveRequest(
      encodeReadHoldingRegistersRequest({ unitId: 2, startAddress: 0, quantity: 2 }),
      model,
      { unitId: 2 }
    );
    const fc4 = handleRtuSlaveRequest(
      encodeReadInputRegistersRequest({ unitId: 2, startAddress: 1, quantity: 2 }),
      model,
      { unitId: 2 }
    );

    if (fc3.kind !== "response" || fc4.kind !== "response") {
      throw new Error("Expected register read responses");
    }

    expect(decodeRegisterReadResponse(fc3.response).values).toEqual([0x1234, 0xabcd]);
    expect(decodeRegisterReadResponse(fc4.response).values).toEqual([0x0007, 0x0008]);
  });

  it("applies FC6 and FC16 writes in the slave simulator", () => {
    const model = createSlaveDataModel({ holdingRegisterCount: 8 });
    const fc6 = encodeWriteSingleRegisterRequest({ unitId: 2, address: 1, value: 0x3344 });
    const fc16 = encodeWriteMultipleRegistersRequest({
      unitId: 2,
      startAddress: 2,
      values: [0x0102, 0x0304]
    });

    const fc6Result = handleRtuSlaveRequest(fc6, model, { unitId: 2 });
    const fc16Result = handleRtuSlaveRequest(fc16, model, { unitId: 2 });

    expect(model.holdingRegisters.slice(1, 4)).toEqual([0x3344, 0x0102, 0x0304]);
    expect(fc6Result.kind).toBe("response");
    expect(fc16Result.kind).toBe("response");

    if (fc6Result.kind === "response") {
      expect(formatHex(fc6Result.response)).toBe(formatHex(fc6));
    }

    if (fc16Result.kind === "response") {
      expect(formatHex(fc16Result.response.slice(0, -2))).toBe("02 10 00 02 00 02");
      expect(hasValidCrc(fc16Result.response)).toBe(true);
    }
  });

  it("decodes exception responses", () => {
    const frame = buildExceptionFrame(2, 0x03, ExceptionCode.IllegalDataAddress);
    const decoded = decodeExceptionResponse(frame);

    expect(decoded).toEqual({
      unitId: 2,
      functionCode: 0x03,
      exceptionFunctionCode: 0x83,
      exceptionCode: ExceptionCode.IllegalDataAddress,
      exceptionName: "Illegal Data Address"
    });
  });

  it("returns exception 0x02 when FC3 range is outside the register map", () => {
    const model = createSlaveDataModel({ holdingRegisterCount: 2 });
    const request = encodeReadHoldingRegistersRequest({ unitId: 2, startAddress: 1, quantity: 2 });
    const result = handleRtuSlaveRequest(request, model, { unitId: 2 });

    if (result.kind !== "response") {
      throw new Error(`Expected response, got ${result.kind}`);
    }

    expect(decodeExceptionResponse(result.response)?.exceptionCode).toBe(ExceptionCode.IllegalDataAddress);
  });
});
