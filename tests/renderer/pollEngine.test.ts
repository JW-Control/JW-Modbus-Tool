// Motor de ventanas de sondeo contra el simulador real por Modbus TCP:
// varias ventanas a la vez, formatos de 32 bits, escritura y registro a CSV.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { masterConnection } from "../../src/main/modbus/masterConnection.js";
import { executeModbusRequest } from "../../src/main/modbus/rtuMasterActions.js";
import { slaveSimulator } from "../../src/main/modbus/rtuSlaveSimulator.js";
import { PollEngine, pollRows, type LogFiles, type PollActionEvent } from "../../src/renderer/pollEngine.js";
import { toDisplayAddress, toProtocolAddress } from "../../src/renderer/addressing.js";

const PORT = 15510;

const execute = async (command: Parameters<typeof executeModbusRequest>[0]) => {
  try {
    return { ok: true as const, value: await executeModbusRequest(command) };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
};

function memoryFiles() {
  const files = new Map<string, string>();
  const api: LogFiles = {
    async saveText({ text, defaultFileName }) {
      files.set(defaultFileName, text);
      return { ok: true, value: { canceled: false, filePath: defaultFileName } };
    },
    async appendText({ filePath, text }) {
      files.set(filePath, (files.get(filePath) ?? "") + text);
      return { ok: true, value: { bytesWritten: text.length } };
    }
  };
  return { files, api };
}

const waitFor = async (check: () => boolean, ms = 3000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error("waitFor: tiempo agotado");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

describe("direcciones", () => {
  it("convierte entre los cuatro modos", () => {
    expect(toDisplayAddress("jw", 3, 0)).toBe(40000);
    expect(toDisplayAddress("modicon", 3, 0)).toBe(40001);
    expect(toDisplayAddress("modicon", 2, 4)).toBe(10005);
    expect(toDisplayAddress("one", 4, 9)).toBe(10);
    expect(toProtocolAddress("protocol", 1, 7)).toBe(7);
    expect(toProtocolAddress("modicon", 4, 30001)).toBe(0);
    expect(() => toProtocolAddress("modicon", 3, 40000)).toThrow(RangeError);
  });
});

describe("ventanas de sondeo por Modbus TCP", () => {
  let engine: PollEngine;

  beforeEach(async () => {
    slaveSimulator.importDevices([]);
    slaveSimulator.addDevice({ unitId: 1 });
    slaveSimulator.addDevice({ unitId: 2 });
    await slaveSimulator.startTcp({ host: "127.0.0.1", port: PORT });
    await masterConnection.open({ path: "", baudRate: 0, transport: "tcp", host: "127.0.0.1", tcpPort: PORT });
    engine = new PollEngine(execute, null);
  });

  afterEach(async () => {
    engine.stopAll();
    await masterConnection.close();
    await slaveSimulator.stopTcp();
    slaveSimulator.importDevices([]);
  });

  it("decodifica Float32 en dos filas y escribe con FC16", async () => {
    const window = engine.add({ unitId: 1, fc: 3, start: 0, quantity: 4, rowFormats: { 0: "float32" } });
    const actions: PollActionEvent[] = [];
    engine.onAction((event) => actions.push(event));

    const written = await engine.write(window.def.id, 0, "12,5");
    expect(written).toMatchObject({ ok: true, message: "Escrito con FC16" });
    await engine.readOnce(window.def.id);

    const rows = pollRows(engine.get(window.def.id)!, "jw");
    expect(rows[0]).toMatchObject({ display: 40000, text: "12.5", writable: true, format: "float32" });
    expect(rows[1]).toMatchObject({ continuation: true, text: "↳", writable: false });
    expect(engine.get(window.def.id)!.rt.values!.slice(0, 2)).toEqual([0x4148, 0x0000]);

    expect(await engine.write(window.def.id, 2, "-3")).toMatchObject({ ok: false });
    engine.update(window.def.id, { rowFormats: { 0: "float32", 2: "int16" } });
    expect(await engine.write(window.def.id, 2, "-3")).toMatchObject({ ok: true, message: "Escrito con FC6" });
    expect(pollRows(engine.get(window.def.id)!, "jw")[2].text).toBe("-3");
    engine.update(window.def.id, { rowFormats: { 0: "float32" } });
    expect(pollRows(engine.get(window.def.id)!, "jw")[2].text).toBe("65533");
  });

  it("CDAB invierte las palabras de un Int32", async () => {
    const window = engine.add({ unitId: 1, fc: 3, start: 10, quantity: 2, format: "int32", byteOrder: "CDAB" });
    await engine.write(window.def.id, 10, "-100000");
    await engine.readOnce(window.def.id);
    const state = engine.get(window.def.id)!;
    // -100000 = 0xFFFE7960; con CDAB la palabra baja va primero.
    expect(state.rt.values).toEqual([0x7960, 0xfffe]);
    expect(pollRows(state, "jw")[0].text).toBe("-100000");
  });

  it("escribe coils con FC5 y rechaza tablas de solo lectura", async () => {
    const coils = engine.add({ unitId: 2, fc: 1, start: 3, quantity: 2 });
    expect(await engine.write(coils.def.id, 4, "on")).toMatchObject({ ok: true, message: "Escrito con FC5" });
    await engine.readOnce(coils.def.id);
    expect(engine.get(coils.def.id)!.rt.values).toEqual([false, true]);
    expect(await engine.write(coils.def.id, 3, "talvez")).toMatchObject({ ok: false });

    const inputs = engine.add({ unitId: 2, fc: 4, start: 0, quantity: 2 });
    expect(await engine.write(inputs.def.id, 0, "1")).toMatchObject({ ok: false, message: "Esta tabla es de solo lectura" });
  });

  it("varias ventanas sondean a la vez sin mezclar respuestas", async () => {
    await executeModbusRequest({ unitId: 1, request: { fc: 16, startAddress: 0, values: [111, 112] } });
    await executeModbusRequest({ unitId: 2, request: { fc: 16, startAddress: 0, values: [221, 222] } });
    const a = engine.add({ unitId: 1, fc: 3, start: 0, quantity: 2, intervalMs: 100 });
    const b = engine.add({ unitId: 2, fc: 3, start: 0, quantity: 2, intervalMs: 100 });
    const c = engine.add({ unitId: 1, fc: 1, start: 0, quantity: 8, intervalMs: 100 });
    [a, b, c].forEach((w) => engine.start(w.def.id));
    await waitFor(() => [a, b, c].every((w) => engine.get(w.def.id)!.rt.ok >= 3));
    engine.stopAll();
    expect(engine.get(a.def.id)!.rt.values).toEqual([111, 112]);
    expect(engine.get(b.def.id)!.rt.values).toEqual([221, 222]);
    expect(engine.get(c.def.id)!.rt.values).toHaveLength(8);
    expect(engine.get(a.def.id)!.rt).toMatchObject({ errors: 0, running: false });
  });

  it("marca timeout cuando el unit id no existe", async () => {
    const window = engine.add({ unitId: 9, fc: 3, start: 0, quantity: 1, timeoutMs: 150 });
    await engine.readOnce(window.def.id);
    expect(engine.get(window.def.id)!.rt).toMatchObject({ status: "timeout", timeouts: 1 });
  });

  it("guarda historial de las direcciones graficadas y registra CSV", async () => {
    const { files, api } = memoryFiles();
    engine.setBackend(execute, api);
    const window = engine.add({ name: "Tanque 1", unitId: 1, fc: 3, start: 0, quantity: 3, rowFormats: { 0: "float32" }, aliases: { 0: "Nivel" }, charted: [0, 2] });
    await engine.write(window.def.id, 0, "1.25");
    await engine.write(window.def.id, 2, "7");

    const started = await engine.startLog(window.def.id);
    expect(started.ok).toBe(true);
    await engine.readOnce(window.def.id);
    await engine.readOnce(window.def.id);
    await engine.stopLog(window.def.id);

    const history = engine.history_(window.def.id);
    // Cada escritura relee el bloque: 2 escrituras + 2 lecturas.
    expect(history.get(0)!.map((p) => p.value)).toEqual([1.25, 1.25, 1.25, 1.25]);
    expect(history.get(2)!.at(-1)!.value).toBe(7);
    expect(history.has(1)).toBe(false);

    const [csv] = [...files.values()];
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Fecha y hora;40000 Nivel;40002");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3};1,25;7$/);
    expect(engine.get(window.def.id)!.rt).toMatchObject({ logPath: null, logRows: 2 });
  });
});
