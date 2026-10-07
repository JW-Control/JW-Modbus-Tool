// End to end: the app's real master code talks to the real slave simulator
// through the internal channel, with no COM port and no mocks in between.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readCoils,
  readDiscreteInputs,
  readHoldingRegisters,
  readInputRegisters,
  runJwplcValidationSequence,
  writeMultipleCoils,
  writeMultipleRegisters,
  writeSingleCoil,
  writeSingleRegister
} from "../../src/main/modbus/rtuMasterActions.js";
import { slaveSimulator } from "../../src/main/modbus/rtuSlaveSimulator.js";
import { serialManager } from "../../src/main/serial/serialManager.js";
import { INTERNAL_SIMULATOR_PATH } from "../../src/shared/serial/types.js";
import type { SlaveSimulatorEvent } from "../../src/shared/slave/types.js";

// Deterministic pseudo-random sequence so the run is reproducible.
function seededRandom(seed: number) {
  let state = seed;
  return (max: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % max;
  };
}

describe("master to simulator over the internal channel", () => {
  beforeEach(async () => {
    // The app wires this in registerIpcHandlers.
    serialManager.setInternalEndpoint(slaveSimulator.internalEndpoint());
    slaveSimulator.importDevices([]);
    await serialManager.open({ path: INTERNAL_SIMULATOR_PATH, baudRate: 9600 });
  });

  afterEach(async () => {
    await serialManager.close();
    slaveSimulator.importDevices([]);
  });

  it("connects without opening any COM port", () => {
    expect(serialManager.getConnectionState()).toMatchObject({ connected: true, config: { path: INTERNAL_SIMULATOR_PATH } });
    expect(slaveSimulator.getState().running).toBe(false);
  });

  it("runs 1000 mixed requests with the eight functions against two devices", async () => {
    slaveSimulator.addDevice({ unitId: 1 });
    slaveSimulator.addDevice({ unitId: 2 });
    const random = seededRandom(31);
    const shadow = new Map([1, 2].map((id) => [id, { coils: Array<boolean>(64).fill(false), holding: Array<number>(64).fill(0) }]));
    const before = slaveSimulator.getState().counters;
    let failures = 0;

    for (let index = 0; index < 1000; index += 1) {
      const unitId = 1 + random(2);
      const model = shadow.get(unitId)!;
      const startAddress = random(56);
      const quantity = 1 + random(8);
      const timeoutMs = 200;
      let result;

      switch (random(8)) {
        case 0:
          result = await readCoils({ unitId, startAddress, quantity, timeoutMs });
          if (JSON.stringify(result.values) !== JSON.stringify(model.coils.slice(startAddress, startAddress + quantity))) failures += 1;
          break;
        case 1:
          result = await readDiscreteInputs({ unitId, startAddress, quantity, timeoutMs });
          break;
        case 2:
          result = await readHoldingRegisters({ unitId, startAddress, quantity, timeoutMs });
          if (JSON.stringify(result.registerValues) !== JSON.stringify(model.holding.slice(startAddress, startAddress + quantity))) failures += 1;
          break;
        case 3:
          result = await readInputRegisters({ unitId, startAddress, quantity, timeoutMs });
          break;
        case 4: {
          const value = random(2) === 1;
          result = await writeSingleCoil({ unitId, address: startAddress, value, timeoutMs });
          model.coils[startAddress] = value;
          break;
        }
        case 5: {
          const value = random(65536);
          result = await writeSingleRegister({ unitId, address: startAddress, value, timeoutMs });
          model.holding[startAddress] = value;
          break;
        }
        case 6: {
          const values = Array.from({ length: quantity }, () => random(2) === 1);
          result = await writeMultipleCoils({ unitId, startAddress, values, timeoutMs });
          values.forEach((value, offset) => { model.coils[startAddress + offset] = value; });
          break;
        }
        default: {
          const values = Array.from({ length: quantity }, () => random(65536));
          result = await writeMultipleRegisters({ unitId, startAddress, values, timeoutMs });
          values.forEach((value, offset) => { model.holding[startAddress + offset] = value; });
        }
      }

      if (!result.crcOk || result.exception) failures += 1;
    }

    const after = slaveSimulator.getState().counters;
    expect(failures).toBe(0);
    expect({
      requests: after.requests - before.requests,
      responses: after.responses - before.responses,
      exceptions: after.exceptions - before.exceptions,
      crcErrors: after.crcErrors - before.crcErrors,
      faults: after.faults - before.faults
    }).toEqual({ requests: 1000, responses: 1000, exceptions: 0, crcErrors: 0, faults: 0 });
  });

  it("passes the JWPLC validation sequence against the JWPLC template", async () => {
    slaveSimulator.addDevice({ unitId: 2, template: "jwplc-basic-remote-io" });

    const result = await runJwplcValidationSequence({ unitId: 2, timeoutMs: 200 });

    expect(result.passed).toBe(true);
  });

  it("shows each fault to the master as the matching error", async () => {
    slaveSimulator.addDevice({ unitId: 1 });
    const command = { unitId: 1, startAddress: 0, quantity: 4, timeoutMs: 100 };

    slaveSimulator.setFaults({ unitId: 1, faults: { mode: "no-response" } });
    await expect(readHoldingRegisters(command)).rejects.toThrow(/Timed out/);

    slaveSimulator.setFaults({ unitId: 1, faults: { mode: "bad-crc" } });
    expect((await readHoldingRegisters(command)).crcOk).toBe(false);

    slaveSimulator.setFaults({ unitId: 1, faults: { mode: "exception", exceptionCode: 4 } });
    expect((await readHoldingRegisters(command)).exception).toMatchObject({ exceptionCode: 4, exceptionName: "Slave Device Failure" });

    slaveSimulator.setFaults({ unitId: 1, faults: { mode: "none", delayMs: 30 } });
    const slow = await readHoldingRegisters(command);
    expect(slow.registerValues).toEqual([0, 0, 0, 0]);
    expect(slow.elapsedMs).toBeGreaterThanOrEqual(25);

    slaveSimulator.setFaults({ unitId: 1, faults: { delayMs: 300 } });
    await expect(readHoldingRegisters(command)).rejects.toThrow(/Timed out/);
  });

  it("times out for unit ids that have no virtual device", async () => {
    slaveSimulator.addDevice({ unitId: 1 });
    const ignoredBefore = slaveSimulator.getState().counters.ignored;

    await expect(readCoils({ unitId: 9, startAddress: 0, quantity: 1, timeoutMs: 50 })).rejects.toThrow(/Timed out/);
    expect(slaveSimulator.getState().counters.ignored - ignoredBefore).toBe(1);
  });

  it("logs internal traffic in the simulator", async () => {
    slaveSimulator.addDevice({ unitId: 1 });
    const events: SlaveSimulatorEvent[] = [];
    const unsubscribe = slaveSimulator.onEvent((event) => events.push(event));

    await writeSingleRegister({ unitId: 1, address: 3, value: 77, timeoutMs: 100 });
    unsubscribe();

    expect(events.find((event) => event.type === "traffic")).toMatchObject({ entry: { channel: INTERNAL_SIMULATOR_PATH, unitId: 1, result: "response" } });
    expect(events).toContainEqual({ type: "device", unitId: 1 });
    expect(slaveSimulator.getDevice(1).holdingRegisters[3]).toBe(77);
  });

  it("stops answering once the master disconnects", async () => {
    slaveSimulator.addDevice({ unitId: 1 });
    await serialManager.close();

    await expect(readCoils({ unitId: 1, startAddress: 0, quantity: 1, timeoutMs: 50 })).rejects.toThrow(/not connected/);
  });

  it("refuses to start the COM simulator on the internal channel", async () => {
    await expect(slaveSimulator.start({ path: INTERNAL_SIMULATOR_PATH, baudRate: 9600 })).rejects.toThrow(/canal interno/);
  });
});
