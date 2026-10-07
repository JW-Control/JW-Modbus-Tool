import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RtuSlaveSimulator, type SlavePort } from "../../src/main/modbus/rtuSlaveSimulator.js";
import { hasValidCrc } from "../../src/shared/modbus/crc16.js";
import {
  decodeBitReadResponse,
  decodeRegisterReadResponse,
  encodeReadCoilsRequest,
  encodeReadDiscreteInputsRequest,
  encodeReadHoldingRegistersRequest,
  encodeReadInputRegistersRequest,
  encodeWriteMultipleCoilsRequest,
  encodeWriteMultipleRegistersRequest,
  encodeWriteSingleCoilRequest,
  encodeWriteSingleRegisterRequest
} from "../../src/shared/modbus/masterRequests.js";
import { expectedRtuResponseLength } from "../../src/shared/modbus/rtuResponseLength.js";
import type { NormalizedSerialPortConfig } from "../../src/shared/serial/types.js";
import type { SlaveSimulatorEvent } from "../../src/shared/slave/types.js";

class FakePort extends EventEmitter implements SlavePort {
  isOpen = false;
  readonly written: Uint8Array[] = [];

  constructor(readonly config: NormalizedSerialPortConfig) {
    super();
  }

  open(callback: (error: Error | null) => void): void {
    this.isOpen = true;
    callback(null);
  }

  close(callback: (error: Error | null) => void): void {
    this.isOpen = false;
    this.emit("close");
    callback(null);
  }

  write(data: Buffer, callback: (error: Error | null | undefined) => void): boolean {
    this.written.push(Uint8Array.from(data));
    callback(null);
    return true;
  }

  receive(bytes: Uint8Array): void {
    this.emit("data", Buffer.from(bytes));
  }
}

function createSimulator() {
  const ports: FakePort[] = [];
  const simulator = new RtuSlaveSimulator((config) => {
    const port = new FakePort(config);
    ports.push(port);
    return port;
  });
  const events: SlaveSimulatorEvent[] = [];
  simulator.onEvent((event) => events.push(event));
  return { simulator, ports, events };
}

// Deterministic pseudo-random sequence so the load test is reproducible.
function seededRandom(seed: number) {
  let state = seed;
  return (max: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % max;
  };
}

describe("RtuSlaveSimulator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens its own port with the requested serial format", async () => {
    const { simulator, ports } = createSimulator();

    const state = await simulator.start({ path: "COM10", baudRate: 19200, parity: "even" });

    expect(ports[0].config).toMatchObject({ path: "COM10", baudRate: 19200, dataBits: 8, parity: "even", stopBits: 1 });
    expect(state).toMatchObject({ running: true, config: { path: "COM10" } });
    await expect(simulator.start({ path: "COM11", baudRate: 9600 })).rejects.toThrow(/ya está escuchando en COM10/);
  });

  it("answers requests for its devices and reports traffic and changed values", async () => {
    const { simulator, ports, events } = createSimulator();
    simulator.addDevice({ unitId: 2, name: "JWPLC virtual" });
    await simulator.start({ path: "COM10", baudRate: 9600 });

    ports[0].receive(encodeWriteSingleRegisterRequest({ unitId: 2, address: 3, value: 1234 }));
    ports[0].receive(encodeReadHoldingRegistersRequest({ unitId: 2, startAddress: 3, quantity: 1 }));

    expect(ports[0].written).toHaveLength(2);
    expect(decodeRegisterReadResponse(ports[0].written[1]).values).toEqual([1234]);
    expect(events.filter((event) => event.type === "device")).toEqual([{ type: "device", unitId: 2 }]);
    expect(events.filter((event) => event.type === "traffic").map((event) => event.type === "traffic" && event.entry.result)).toEqual([
      "response",
      "response"
    ]);
    expect(simulator.getState().counters).toMatchObject({ requests: 2, responses: 2, exceptions: 0 });
  });

  it("stays silent for other unit ids and counts them as ignored", async () => {
    const { simulator, ports } = createSimulator();
    simulator.addDevice({ unitId: 1 });
    await simulator.start({ path: "COM10", baudRate: 9600 });

    ports[0].receive(encodeReadCoilsRequest({ unitId: 7, startAddress: 0, quantity: 8 }));

    expect(ports[0].written).toEqual([]);
    expect(simulator.getState().counters).toMatchObject({ requests: 1, ignored: 1 });
  });

  it("releases unframed bytes after the line goes idle", async () => {
    vi.useFakeTimers();
    const { simulator, ports } = createSimulator();
    simulator.addDevice({ unitId: 1 });
    await simulator.start({ path: "COM10", baudRate: 9600 });

    ports[0].receive(Uint8Array.of(0x01, 0x03, 0x00));
    expect(simulator.getState().counters.requests).toBe(0);

    vi.advanceTimersByTime(25);

    expect(simulator.getState().counters).toMatchObject({ requests: 1, ignored: 1 });
    expect(ports[0].written).toEqual([]);
  });

  it("publishes updated counters while traffic flows", async () => {
    vi.useFakeTimers();
    const { simulator, ports, events } = createSimulator();
    simulator.addDevice({ unitId: 1 });
    await simulator.start({ path: "COM10", baudRate: 9600 });
    events.length = 0;

    ports[0].receive(encodeReadCoilsRequest({ unitId: 1, startAddress: 0, quantity: 8 }));
    ports[0].receive(encodeReadCoilsRequest({ unitId: 1, startAddress: 0, quantity: 8 }));
    expect(events.some((event) => event.type === "state")).toBe(false);

    vi.advanceTimersByTime(200);

    const states = events.filter((event) => event.type === "state");
    expect(states).toHaveLength(1);
    expect(states[0].type === "state" && states[0].state.counters.responses).toBe(2);
    expect(states[0].type === "state" && states[0].state.devices[0].requests).toBe(2);
  });

  it("closes the port on stop and reports an unexpected close", async () => {
    const { simulator, ports } = createSimulator();
    await simulator.start({ path: "COM10", baudRate: 9600 });

    const stopped = await simulator.stop();
    expect(stopped.running).toBe(false);
    expect(ports[0].isOpen).toBe(false);
    expect(stopped.lastError).toBeUndefined();

    await simulator.start({ path: "COM10", baudRate: 9600 });
    ports[1].close(() => undefined);
    expect(simulator.getState()).toMatchObject({ running: false, lastError: "El puerto COM10 se cerró inesperadamente" });
  });

  it("serves 1000 mixed requests to two devices without errors", async () => {
    const { simulator, ports } = createSimulator();
    simulator.addDevice({ unitId: 1 });
    simulator.addDevice({ unitId: 2 });
    await simulator.start({ path: "COM10", baudRate: 115200 });
    const port = ports[0];
    const random = seededRandom(29);
    const shadow = new Map([1, 2].map((id) => [id, {
      coils: Array<boolean>(64).fill(false),
      holding: Array<number>(64).fill(0)
    }]));

    for (let index = 0; index < 1000; index += 1) {
      const unitId = 1 + random(2);
      const model = shadow.get(unitId)!;
      const start = random(56);
      const quantity = 1 + random(8);
      let request: Uint8Array;
      let check: (response: Uint8Array) => void = () => undefined;

      switch (random(8)) {
        case 0:
          request = encodeReadCoilsRequest({ unitId, startAddress: start, quantity });
          check = (response) => expect(decodeBitReadResponse(response, quantity).values).toEqual(model.coils.slice(start, start + quantity));
          break;
        case 1:
          request = encodeReadDiscreteInputsRequest({ unitId, startAddress: start, quantity });
          break;
        case 2:
          request = encodeReadHoldingRegistersRequest({ unitId, startAddress: start, quantity });
          check = (response) => expect(decodeRegisterReadResponse(response).values).toEqual(model.holding.slice(start, start + quantity));
          break;
        case 3:
          request = encodeReadInputRegistersRequest({ unitId, startAddress: start, quantity });
          break;
        case 4: {
          const value = random(2) === 1;
          request = encodeWriteSingleCoilRequest({ unitId, address: start, value });
          model.coils[start] = value;
          break;
        }
        case 5: {
          const value = random(65536);
          request = encodeWriteSingleRegisterRequest({ unitId, address: start, value });
          model.holding[start] = value;
          break;
        }
        case 6: {
          const values = Array.from({ length: quantity }, () => random(2) === 1);
          request = encodeWriteMultipleCoilsRequest({ unitId, startAddress: start, values });
          values.forEach((value, offset) => { model.coils[start + offset] = value; });
          break;
        }
        default: {
          const values = Array.from({ length: quantity }, () => random(65536));
          request = encodeWriteMultipleRegistersRequest({ unitId, startAddress: start, values });
          values.forEach((value, offset) => { model.holding[start + offset] = value; });
        }
      }

      // Deliver each request split in two chunks, as a USB adapter would.
      const cut = 1 + random(request.length - 1);
      port.receive(request.slice(0, cut));
      port.receive(request.slice(cut));

      const response = port.written[index];
      expect(response, `request ${index}`).toBeDefined();
      expect(hasValidCrc(response)).toBe(true);
      expect(response[0]).toBe(unitId);
      expect(response[1] & 0x80).toBe(0);
      expect(expectedRtuResponseLength(response)).toBe(response.length);
      check(response);
    }

    expect(simulator.getState().counters).toEqual({ requests: 1000, responses: 1000, exceptions: 0, ignored: 0, crcErrors: 0 });
    await simulator.stop();
  });
});
