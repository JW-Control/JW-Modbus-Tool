import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatHex } from "../../src/shared/modbus/byteUtils.js";
import {
  decodeRegisterReadResponse,
  encodeReadHoldingRegistersRequest,
  encodeWriteSingleRegisterRequest
} from "../../src/shared/modbus/masterRequests.js";
import { expectedRtuResponseLength } from "../../src/shared/modbus/rtuResponseLength.js";
import { VirtualSlaveBus } from "../../src/shared/modbus/virtualSlaveBus.js";

/** A USB-RS485 converter with one virtual slave behind it, optionally echoing. */
const line = { echo: false, slaveDelayMs: 2, bus: new VirtualSlaveBus() };

vi.mock("serialport", async () => {
  const { EventEmitter } = await import("node:events");
  class FakeSerialPort extends EventEmitter {
    isOpen = false;
    constructor(_options: unknown) {
      super();
    }
    static list = async () => [];
    open(callback: (error: Error | null) => void) {
      this.isOpen = true;
      callback(null);
    }
    close(callback: (error: Error | null) => void) {
      this.isOpen = false;
      callback(null);
    }
    flush(callback: (error: Error | null) => void) {
      callback(null);
    }
    drain(callback: (error: Error | null) => void) {
      callback(null);
    }
    write(data: Buffer, callback: (error: Error | null) => void) {
      callback(null);
      const request = Uint8Array.from(data);
      if (line.echo) setTimeout(() => this.emit("data", Buffer.from(request)), 0);
      const result = line.bus.handleFrame(request);
      if (result.kind === "response") {
        setTimeout(() => this.emit("data", Buffer.from(result.response)), line.slaveDelayMs);
      }
      return true;
    }
  }
  return { SerialPort: FakeSerialPort };
});

const { SerialManager } = await import("../../src/main/serial/serialManager.js");

const options = { timeoutMs: 400, expectedResponseLength: expectedRtuResponseLength };
const readHr = encodeReadHoldingRegistersRequest({ unitId: 2, startAddress: 0, quantity: 2 });
const writeHr = encodeWriteSingleRegisterRequest({ unitId: 2, address: 1, value: 4242 });

describe("SerialManager echo handling", () => {
  let manager: InstanceType<typeof SerialManager>;

  beforeEach(() => {
    line.bus = new VirtualSlaveBus();
    line.bus.addDevice(2, "JWPLC");
    line.bus.setValue({ unitId: 2, table: "holdingRegisters", address: 0, value: 1750 });
    manager = new SerialManager();
  });

  afterEach(async () => {
    await manager.close();
  });

  for (const echo of [false, true]) {
    it(`auto mode reads and writes correctly ${echo ? "with" : "without"} an echoing converter`, async () => {
      line.echo = echo;
      await manager.open({ path: "COM9", baudRate: 115200 });

      const read = await manager.transact(readHr, options);
      expect(decodeRegisterReadResponse(read.response).values).toEqual([1750, 0]);
      expect(read.echoDiscarded).toBe(echo);
      expect(manager.getConnectionState().echoDetected).toBe(echo);

      const write = await manager.transact(writeHr, options);
      expect(formatHex(write.response)).toBe(formatHex(writeHr));
      expect(write.echoDiscarded).toBe(echo);
    });
  }

  it("auto mode settles an FC6 write before anything was learned, with and without echo", async () => {
    for (const echo of [false, true]) {
      line.echo = echo;
      const fresh = new SerialManager();
      await fresh.open({ path: "COM9", baudRate: 115200 });
      const write = await fresh.transact(writeHr, options);
      expect(formatHex(write.response)).toBe(formatHex(writeHr));
      expect(write.echoDiscarded).toBe(echo);
      await fresh.close();
    }
  });

  it("off mode takes the echo as the response, which is what broke reads before", async () => {
    line.echo = true;
    await manager.open({ path: "COM9", baudRate: 115200, echo: "off" });
    const read = await manager.transact(readHr, options);
    expect(formatHex(read.response)).toBe(formatHex(readHr.slice(0, 5)));
  });

  it("on mode still works when the converter turns out not to echo on reads", async () => {
    line.echo = false;
    await manager.open({ path: "COM9", baudRate: 115200, echo: "on" });
    const read = await manager.transact(readHr, options);
    expect(read.echoDiscarded).toBe(false);
    expect(read.response[1]).toBe(3);
  });

  it("rejects an unknown echo mode", async () => {
    await expect(manager.open({ path: "COM9", baudRate: 115200, echo: "maybe" as never })).rejects.toThrow("Echo must be");
  });
});
