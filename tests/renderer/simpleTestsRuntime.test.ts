import { describe, expect, it } from "vitest";
import {
  classifyStepErrorResult,
  createScenarioPlan,
  parsePlanCoilValues,
  parsePlanRegisterValues,
  summarizeTestsRun
} from "../../src/renderer/simple-tests-consolidated.js";

describe("simple tests runtime", () => {
  it("classifies serial timed-out messages as timeout", () => {
    expect(classifyStepErrorResult("Timed out waiting for RTU response after 1000 ms")).toBe("Timeout");
    expect(classifyStepErrorResult("Response timeout")).toBe("Timeout");
    expect(classifyStepErrorResult("Port is closed")).toBe("Error");
  });

  it("parses explicit coil values and rejects ambiguous tokens", () => {
    expect(parsePlanCoilValues("ON, 0, yes, off")).toEqual([true, false, true, false]);
    expect(parsePlanCoilValues("0xFF00, 0x0000, 65280")).toEqual([true, false, true]);
    expect(() => parsePlanCoilValues("ON, maybe")).toThrow("Valor de bobina 2");
  });

  it("parses decimal and hexadecimal register values strictly", () => {
    expect(parsePlanRegisterValues("10, 0x20, 65535")).toEqual([10, 32, 65535]);
    expect(() => parsePlanRegisterValues("10, nope")).toThrow("Valor 2");
    expect(() => parsePlanRegisterValues("65536")).toThrow("Valor 1");
  });

  it("builds distinct fallback plans for built-in scenarios", () => {
    const normal = createScenarioPlan("normal", 2);
    const timeout = createScenarioPlan("timeout", 2);
    const crc = createScenarioPlan("crc", 2);
    const exception = createScenarioPlan("exception", 2);

    expect(new Set(normal.map((step) => step.slave))).toEqual(new Set(["2"]));
    expect(new Set(timeout.map((step) => step.slave))).toEqual(new Set(["1"]));
    expect(crc.some((step) => step.validationMode === "exact" && step.expected === "65535")).toBe(true);
    expect(exception.some((step) => Number(step.address) > 65535)).toBe(true);
  });

  it("summarizes native test runs for session counters", () => {
    const summary = summarizeTestsRun([
      { enabled: true, result: "Aprobado", elapsedMs: 8, at: "10:00:00" },
      { enabled: true, result: "Validacion fallida", elapsedMs: 10, at: "10:00:01" },
      { enabled: true, result: "Timeout", elapsedMs: 1000, at: "10:00:02" },
      { enabled: true, result: "Pendiente", elapsedMs: null },
      { enabled: false, result: "Aprobado", elapsedMs: 1, at: "10:00:03" }
    ]);

    expect(summary).toMatchObject({
      total: 4,
      executed: 3,
      passed: 1,
      failed: 2,
      timeouts: 1,
      otherFailed: 1,
      responsive: 2,
      avgMs: 9,
      lastRunAt: "10:00:02"
    });
  });
});
