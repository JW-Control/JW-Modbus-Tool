import { afterEach, describe, expect, it, vi } from "vitest";
import { readCoils, runJwplcValidationSequence } from "../../src/main/modbus/rtuMasterActions.js";
import { serialManager } from "../../src/main/serial/serialManager.js";
import { VirtualSlaveBus } from "../../src/shared/modbus/virtualSlaveBus.js";

// Routes the master's serial transactions straight into a virtual bus, so the
// real master code runs against the simulator without a COM port.
function connectMasterTo(bus: VirtualSlaveBus) {
  vi.spyOn(serialManager, "transact").mockImplementation(async (request) => {
    const result = bus.handleFrame(request);

    if (result.kind !== "response") {
      throw new Error("Timed out waiting for RTU response after 1000 ms");
    }

    return { request, response: result.response, elapsedMs: 1 };
  });
}

describe("master against the JWPLC virtual device", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes the app's JWPLC validation sequence", async () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(2, undefined, {}, "jwplc-basic-remote-io");
    connectMasterTo(bus);

    const result = await runJwplcValidationSequence({ unitId: 2 });

    expect(result.steps.filter((step) => !step.passed).map((step) => step.name)).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("reports a corrupted CRC on a read instead of failing to decode it", async () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(2, undefined, {}, "jwplc-basic-remote-io");
    bus.setFaults(2, { mode: "bad-crc" });
    connectMasterTo(bus);

    const result = await readCoils({ unitId: 2, startAddress: 0, quantity: 8 });

    expect(result.crcOk).toBe(false);
    expect(result.values).toBeUndefined();
  });

  it("fails the validation sequence when the device stops answering", async () => {
    const bus = new VirtualSlaveBus();
    bus.addDevice(2, undefined, {}, "jwplc-basic-remote-io");
    bus.setFaults(2, { mode: "no-response" });
    connectMasterTo(bus);

    await expect(runJwplcValidationSequence({ unitId: 2 })).rejects.toThrow(/Timed out/);
  });
});
