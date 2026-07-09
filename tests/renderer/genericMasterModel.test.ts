import { describe, expect, it } from "vitest";
import {
  parseCoilValues,
  parseRegisterValues,
  readQuantityMax,
  validateGenericCommand,
  type GenericCommandInput
} from "../../src/renderer/genericMasterModel.js";

const baseCommand: GenericCommandInput = {
  functionCode: "fc3",
  unitId: 2,
  startAddress: 0,
  quantity: 4,
  registerValue: "0",
  valuesText: "0, 0"
};

describe("Generic Master model", () => {
  it("parses decimal and hexadecimal register values", () => {
    expect(parseRegisterValues("17, 0x2222; 3")).toEqual([17, 0x2222, 3]);
  });

  it("parses common coil value forms", () => {
    expect(parseCoilValues("1, OFF, true, 0, on")).toEqual([true, false, true, false, true]);
  });

  it("rejects unknown coil values", () => {
    expect(() => parseCoilValues("1, maybe")).toThrow("Valor de bobina inválido");
  });

  it("uses Modbus quantity limits for bit and register reads", () => {
    expect(readQuantityMax("fc1")).toBe(2000);
    expect(readQuantityMax("fc4")).toBe(125);
    expect(validateGenericCommand({ ...baseCommand, functionCode: "fc1", quantity: 2000 })).toBeNull();
    expect(validateGenericCommand({ ...baseCommand, functionCode: "fc3", quantity: 126 })).toContain("125");
  });

  it("validates FC15 and FC16 payloads", () => {
    expect(
      validateGenericCommand({ ...baseCommand, functionCode: "fc15", valuesText: "ON, OFF, 1, 0" })
    ).toBeNull();
    expect(
      validateGenericCommand({ ...baseCommand, functionCode: "fc15", valuesText: "ON, invalid" })
    ).toContain("1/0");
    expect(
      validateGenericCommand({ ...baseCommand, functionCode: "fc16", valuesText: "0x1111, 0x2222" })
    ).toBeNull();
  });

  it("does not treat an empty FC6 value as zero", () => {
    expect(
      validateGenericCommand({ ...baseCommand, functionCode: "fc6", registerValue: "" })
    ).toContain("entre 0 y 65535");
  });

  it("rejects ranges that cross the Modbus address boundary", () => {
    expect(
      validateGenericCommand({
        ...baseCommand,
        functionCode: "fc2",
        startAddress: 65535,
        quantity: 2
      })
    ).toContain("excede");
  });
});
