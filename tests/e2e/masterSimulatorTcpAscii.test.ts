// De extremo a extremo con sockets reales: el master de la app habla Modbus
// TCP (y RTU sobre TCP) con el servidor TCP del simulador en 127.0.0.1, y
// Modbus ASCII por el canal interno. Sin mocks entre medio.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { masterConnection } from "../../src/main/modbus/masterConnection.js";
import {
  executeModbusRequest,
  readHoldingRegisters,
  runJwplcValidationSequence,
  sendRawFrame,
  writeMultipleRegisters
} from "../../src/main/modbus/rtuMasterActions.js";
import { slaveSimulator } from "../../src/main/modbus/rtuSlaveSimulator.js";
import { serialManager } from "../../src/main/serial/serialManager.js";
import { INTERNAL_SIMULATOR_PATH } from "../../src/shared/serial/types.js";

const PORT = 15502;

describe("Modbus TCP contra el simulador", () => {
  beforeEach(async () => {
    slaveSimulator.importDevices([]);
    slaveSimulator.addDevice({ unitId: 1 });
    slaveSimulator.addDevice({ unitId: 2, template: "jwplc-basic-remote-io" });
    await slaveSimulator.startTcp({ host: "127.0.0.1", port: PORT });
    await masterConnection.open({ path: "", baudRate: 0, transport: "tcp", host: "127.0.0.1", tcpPort: PORT });
  });

  afterEach(async () => {
    await masterConnection.close();
    await slaveSimulator.stopTcp();
    slaveSimulator.importDevices([]);
  });

  it("conecta y lee/escribe registros con MBAP", async () => {
    expect(masterConnection.getState()).toMatchObject({ connected: true, config: { transport: "tcp", framing: "tcp", path: `127.0.0.1:${PORT}` } });
    const write = await writeMultipleRegisters({ unitId: 1, startAddress: 10, values: [11, 22, 33] });
    expect(write).toMatchObject({ crcOk: true, framing: "tcp" });
    expect(write.txHex).toMatch(/^00 0[0-9A-F] 00 00 00 0D 01 10 00 0A 00 03 06/);
    const read = await readHoldingRegisters({ unitId: 1, startAddress: 10, quantity: 3 });
    expect(read.registerValues).toEqual([11, 22, 33]);
    expect(slaveSimulator.getState().tcp).toMatchObject({ port: PORT, clients: 1 });
  });

  it("FC22, FC23, FC17 y FC43/14", async () => {
    await executeModbusRequest({ unitId: 1, request: { fc: 6, address: 4, value: 0x0012 } });
    const mask = await executeModbusRequest({ unitId: 1, request: { fc: 22, address: 4, andMask: 0x00f2, orMask: 0x0025 } });
    expect(mask.crcOk).toBe(true);
    // Spec example: 0x12 AND 0xF2 OR (0x25 AND NOT 0xF2) = 0x17
    expect((await readHoldingRegisters({ unitId: 1, startAddress: 4, quantity: 1 })).registerValues).toEqual([0x17]);

    const rw = await executeModbusRequest({ unitId: 1, request: { fc: 23, readStartAddress: 20, readQuantity: 2, writeStartAddress: 20, values: [7, 8] } });
    expect(rw.registerValues).toEqual([7, 8]);

    const report = await executeModbusRequest({ unitId: 2, request: { fc: 17 } });
    expect(report.serverId).toMatchObject({ serverId: 2, running: true });

    const ident = await executeModbusRequest({ unitId: 2, request: { fc: 43, readDeviceIdCode: 2, objectId: 0 } });
    expect(ident.deviceId?.objects.map((o) => o.name)).toEqual([
      "VendorName",
      "ProductCode",
      "MajorMinorRevision",
      "VendorUrl",
      "ProductName",
      "ModelName",
      "UserApplicationName"
    ]);
    expect(ident.deviceId?.objects[0].value).toBe("JW Control");

    const one = await executeModbusRequest({ unitId: 2, request: { fc: 43, readDeviceIdCode: 4, objectId: 4 } });
    expect(one.deviceId?.objects).toHaveLength(1);
  });

  it("un unit id sin dispositivo vence por timeout y la conexión sigue viva", async () => {
    await expect(readHoldingRegisters({ unitId: 9, startAddress: 0, quantity: 1, timeoutMs: 150 })).rejects.toThrow(/Timed out/);
    expect((await readHoldingRegisters({ unitId: 1, startAddress: 0, quantity: 1 })).crcOk).toBe(true);
  });

  it("la falla 'CRC corrupto' llega como cabecera MBAP inválida", async () => {
    slaveSimulator.setFaults({ unitId: 1, faults: { mode: "bad-crc" } });
    const read = await readHoldingRegisters({ unitId: 1, startAddress: 0, quantity: 1 });
    expect(read.crcOk).toBe(false);
    expect(read.checkError).toMatch(/Protocolo MBAP/);
  });

  it("peticiones simultáneas se atienden en orden sin mezclarse", async () => {
    await writeMultipleRegisters({ unitId: 1, startAddress: 0, values: [100, 200, 300, 400] });
    const reads = await Promise.all([0, 1, 2, 3].map((address) => readHoldingRegisters({ unitId: 1, startAddress: address, quantity: 1 })));
    expect(reads.map((r) => r.registerValues?.[0])).toEqual([100, 200, 300, 400]);
  });

  it("trama a mano: con MBAP automático y tal cual", async () => {
    const auto = await sendRawFrame({ hex: "01 03 00 00 00 01", addCheck: true });
    expect(auto.crcOk).toBe(true);
    const asTyped = await sendRawFrame({ hex: "AB CD 00 00 00 06 01 03 00 00 00 01", addCheck: false });
    expect(asTyped.rxHex.startsWith("AB CD 00 00 00 05 01 03 02")).toBe(true);
  });

  it("pasa la secuencia de validación JWPLC por TCP", async () => {
    const result = await runJwplcValidationSequence({ unitId: 2, timeoutMs: 500 });
    expect(result.passed).toBe(true);
  });
});

describe("RTU sobre TCP", () => {
  it("lee del simulador con tramas RTU dentro del socket", async () => {
    slaveSimulator.importDevices([]);
    slaveSimulator.addDevice({ unitId: 3 });
    await slaveSimulator.startTcp({ host: "127.0.0.1", port: PORT + 1, framing: "rtu" });
    await masterConnection.open({ path: "", baudRate: 0, transport: "tcp", host: "127.0.0.1", tcpPort: PORT + 1, tcpFraming: "rtu" });
    try {
      await writeMultipleRegisters({ unitId: 3, startAddress: 0, values: [5, 6] });
      const read = await readHoldingRegisters({ unitId: 3, startAddress: 0, quantity: 2 });
      expect(read).toMatchObject({ framing: "rtu", registerValues: [5, 6] });
    } finally {
      await masterConnection.close();
      await slaveSimulator.stopTcp();
    }
  });

  it("avisa si el puerto TCP ya está en uso", async () => {
    await slaveSimulator.startTcp({ host: "127.0.0.1", port: PORT + 2 });
    const other = await import("node:net");
    const blocker = other.createServer();
    await expect(new Promise((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(PORT + 2, "127.0.0.1", () => resolve(null));
    })).rejects.toThrow();
    await slaveSimulator.stopTcp();
    await expect(masterConnection.open({ path: "", baudRate: 0, transport: "tcp", host: "127.0.0.1", tcpPort: PORT + 2 })).rejects.toThrow(/No se pudo conectar/);
  });
});

describe("Modbus ASCII por el canal interno", () => {
  beforeEach(async () => {
    serialManager.setInternalEndpoint(slaveSimulator.internalEndpoint());
    slaveSimulator.importDevices([]);
    slaveSimulator.addDevice({ unitId: 1 });
    await masterConnection.open({ path: INTERNAL_SIMULATOR_PATH, baudRate: 9600, dataBits: 7, parity: "even", framing: "ascii" });
  });

  afterEach(async () => {
    await masterConnection.close();
    slaveSimulator.importDevices([]);
  });

  it("escribe y lee con tramas ':' ... CR LF", async () => {
    const write = await writeMultipleRegisters({ unitId: 1, startAddress: 0, values: [0x1234] });
    expect(write.txHex).toBe(":011000000001021234A6\\r\\n");
    const read = await readHoldingRegisters({ unitId: 1, startAddress: 0, quantity: 1 });
    expect(read).toMatchObject({ crcOk: true, framing: "ascii", registerValues: [0x1234] });
    expect(slaveSimulator.getTraffic()[0].request).toMatch(/^:0103/);
  });

  it("la falla 'CRC corrupto' llega como error de LRC", async () => {
    slaveSimulator.setFaults({ unitId: 1, faults: { mode: "bad-crc" } });
    const read = await readHoldingRegisters({ unitId: 1, startAddress: 0, quantity: 1 });
    expect(read).toMatchObject({ crcOk: false, summary: "LRC error in response" });
  });
});
