import { describe, expect, it } from "vitest";
import {
  classifyStepErrorResult,
  parsePlanCoilValues,
  parsePlanRegisterValues,
  unwrapModbusActionResult
} from "../../src/renderer/simple-tests-consolidated.js";

describe("simple tests runtime", () => {
  it("unwraps successful IPC results before validation", () => {
    const value = { elapsedMs: 8, crcOk: true };

    expect(unwrapModbusActionResult({ ok: true, value })).toBe(value);
  });

  it("throws failed IPC results so timeouts cannot approve write steps", () => {
    expect(() =>
      unwrapModbusActionResult({
        ok: false,
        error: "Timed out waiting for RTU response after 1000 ms"
      })
    ).toThrow("Timed out waiting for RTU response");
  });

  it("keeps direct action payloads for legacy callers", () => {
    const action = { elapsedMs: 12, crcOk: true };

    expect(unwrapModbusActionResult(action)).toBe(action);
  });

  it("classifies serial timed-out messages as timeout", () => {
    expect(classifyStepErrorResult("Timed out waiting for RTU response after 1000 ms")).toBe("Timeout");
    expect(classifyStepErrorResult("Response timeout")).toBe("Timeout");
    expect(classifyStepErrorResult("Port is closed")).toBe("Error");
  });

  it("parses explicit coil values and rejects ambiguous tokens", () => {
    expect(parsePlanCoilValues("ON, 0, yes, off")).toEqual([true, false, true, false]);
    expect(() => parsePlanCoilValues("ON, maybe")).toThrow("Valor de bobina 2");
  });

  it("parses decimal and hexadecimal register values strictly", () => {
    expect(parsePlanRegisterValues("10, 0x20, 65535")).toEqual([10, 32, 65535]);
    expect(() => parsePlanRegisterValues("10, nope")).toThrow("Valor 2");
    expect(() => parsePlanRegisterValues("65536")).toThrow("Valor 1");
  });
});
