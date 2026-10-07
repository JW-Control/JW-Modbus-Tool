import { EventEmitter } from "node:events";
import { SerialPort } from "serialport";
import { formatHex } from "../../shared/modbus/byteUtils.js";
import { isExceptionFunctionCode } from "../../shared/modbus/exceptions.js";
import { RtuRequestFramer, rtuSilenceMs } from "../../shared/modbus/rtuRequestFramer.js";
import { VirtualSlaveBus, type VirtualBusFrameResult } from "../../shared/modbus/virtualSlaveBus.js";
import type { NormalizedSerialPortConfig, SerialPortConfig } from "../../shared/serial/types.js";
import type {
  AddVirtualDeviceRequest,
  SetVirtualValueRequest,
  SlaveSimulatorCounters,
  SlaveSimulatorEvent,
  SlaveSimulatorState,
  SlaveTrafficEntry,
  SlaveTrafficResult,
  VirtualDeviceSnapshot
} from "../../shared/slave/types.js";
import { validateSerialPortConfig } from "../serial/serialManager.js";

/** The slice of `SerialPort` the simulator needs; tests pass a fake. */
export interface SlavePort {
  readonly isOpen: boolean;
  open(callback: (error: Error | null) => void): void;
  close(callback: (error: Error | null) => void): void;
  write(data: Buffer, callback: (error: Error | null | undefined) => void): unknown;
  on(event: string, listener: (...args: any[]) => void): unknown;
  removeAllListeners(event?: string): unknown;
}

export type SlavePortFactory = (config: NormalizedSerialPortConfig) => SlavePort;

// USB-serial adapters deliver bytes in bursts, so the idle timeout that
// releases unframed bytes must be well above the theoretical 3.5 characters.
const MIN_IDLE_FLUSH_MS = 20;
// Counters change on every frame; the UI only needs them a few times a second.
const STATE_EMIT_INTERVAL_MS = 200;

const defaultPortFactory: SlavePortFactory = (config) =>
  new SerialPort({
    path: config.path,
    baudRate: config.baudRate,
    dataBits: config.dataBits,
    parity: config.parity,
    stopBits: config.stopBits,
    lock: config.lock,
    autoOpen: false
  });

export class RtuSlaveSimulator {
  private readonly bus = new VirtualSlaveBus();
  private readonly events = new EventEmitter();
  private framer = new RtuRequestFramer();
  private port: SlavePort | null = null;
  private config?: NormalizedSerialPortConfig;
  private startedAt?: string;
  private lastError?: string;
  private counters: SlaveSimulatorCounters = emptyCounters();
  private nextTrafficId = 1;
  private idleFlushMs = MIN_IDLE_FLUSH_MS;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private stateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly portFactory: SlavePortFactory = defaultPortFactory) {}

  getState(): SlaveSimulatorState {
    return {
      running: Boolean(this.port?.isOpen),
      config: this.port ? this.config : undefined,
      startedAt: this.port ? this.startedAt : undefined,
      devices: this.bus.listDevices(),
      counters: { ...this.counters },
      lastError: this.lastError
    };
  }

  onEvent(listener: (event: SlaveSimulatorEvent) => void): () => void {
    this.events.on("event", listener);
    return () => this.events.off("event", listener);
  }

  async start(config: SerialPortConfig): Promise<SlaveSimulatorState> {
    if (this.port) {
      throw new Error(`El simulador ya está escuchando en ${this.config?.path}. Detenlo antes de cambiar el puerto.`);
    }

    const normalizedConfig = validateSerialPortConfig(config);
    const port = this.portFactory(normalizedConfig);

    port.on("data", (chunk: Buffer) => this.handleData(port, chunk));
    port.on("error", (error: Error) => {
      this.lastError = error.message;
      this.emitState();
    });
    port.on("close", () => {
      if (this.port !== port) {
        return;
      }

      this.lastError = this.lastError ?? `El puerto ${normalizedConfig.path} se cerró inesperadamente`;
      this.detachPort();
      this.emitState();
    });

    await new Promise<void>((resolve, reject) => {
      port.open((error) => (error ? reject(error) : resolve()));
    });

    this.port = port;
    this.config = normalizedConfig;
    this.startedAt = new Date().toISOString();
    this.lastError = undefined;
    this.counters = emptyCounters();
    this.framer = new RtuRequestFramer();
    this.idleFlushMs = Math.max(MIN_IDLE_FLUSH_MS, Math.ceil(rtuSilenceMs(normalizedConfig) * 4));
    this.emitState();
    return this.getState();
  }

  async stop(): Promise<SlaveSimulatorState> {
    const port = this.port;

    if (!port) {
      return this.getState();
    }

    this.detachPort();

    if (port.isOpen) {
      await new Promise<void>((resolve, reject) => {
        port.close((error) => (error ? reject(error) : resolve()));
      });
    }

    port.removeAllListeners();
    this.emitState();
    return this.getState();
  }

  addDevice(request: AddVirtualDeviceRequest): SlaveSimulatorState {
    this.bus.addDevice(request.unitId, request.name, request.sizes);
    this.emitState();
    return this.getState();
  }

  removeDevice(unitId: number): SlaveSimulatorState {
    if (!this.bus.removeDevice(unitId)) {
      throw new Error(`No existe un dispositivo virtual con ID ${unitId}`);
    }

    this.emitState();
    return this.getState();
  }

  getDevice(unitId: number): VirtualDeviceSnapshot {
    return this.bus.getDevice(unitId);
  }

  setValue(request: SetVirtualValueRequest): VirtualDeviceSnapshot {
    return this.bus.setValue(request);
  }

  private handleData(port: SlavePort, chunk: Buffer): void {
    if (this.port !== port) {
      return;
    }

    this.clearIdleTimer();

    for (const frame of this.framer.push(Uint8Array.from(chunk))) {
      this.processFrame(port, frame);
    }

    if (this.framer.pendingBytes > 0) {
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        const rest = this.framer.flush();

        if (rest && this.port === port) {
          this.processFrame(port, rest);
        }
      }, this.idleFlushMs);
    }
  }

  private processFrame(port: SlavePort, frame: Uint8Array): void {
    const result = this.bus.handleFrame(frame);
    const trafficResult = classify(result);

    this.counters.requests += 1;

    if (trafficResult === "response") this.counters.responses += 1;
    if (trafficResult === "exception") this.counters.exceptions += 1;
    if (trafficResult === "crc-error") this.counters.crcErrors += 1;
    if (trafficResult === "ignored" || trafficResult === "frame-error") this.counters.ignored += 1;

    const response = result.kind === "response" ? result.response : null;

    if (response) {
      port.write(Buffer.from(response), (error) => {
        if (error) {
          this.lastError = error.message;
          this.emitState();
        }
      });
    }

    const entry: SlaveTrafficEntry = {
      id: this.nextTrafficId++,
      at: new Date().toISOString(),
      unitId: result.unitId,
      functionCode: result.functionCode,
      request: formatHex(frame),
      response: response ? formatHex(response) : null,
      result: trafficResult,
      summary: result.summary
    };

    this.emit({ type: "traffic", entry });

    for (const unitId of result.changedUnitIds) {
      this.emit({ type: "device", unitId });
    }

    this.scheduleStateEmit();
  }

  private scheduleStateEmit(): void {
    if (this.stateTimer) {
      return;
    }

    this.stateTimer = setTimeout(() => {
      this.stateTimer = null;
      this.emitState();
    }, STATE_EMIT_INTERVAL_MS);
  }

  private detachPort(): void {
    this.clearIdleTimer();
    this.framer.flush();
    this.port = null;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private emitState(): void {
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }

    this.emit({ type: "state", state: this.getState() });
  }

  private emit(event: SlaveSimulatorEvent): void {
    this.events.emit("event", event);
  }
}

function classify(result: VirtualBusFrameResult): SlaveTrafficResult {
  switch (result.kind) {
    case "response":
      return isExceptionFunctionCode(result.response[1]) ? "exception" : "response";
    case "broadcast":
      return "broadcast";
    case "ignored":
      if (result.reason === "crc-error") return "crc-error";
      if (result.reason === "frame-error") return "frame-error";
      return "ignored";
  }
}

function emptyCounters(): SlaveSimulatorCounters {
  return { requests: 0, responses: 0, exceptions: 0, ignored: 0, crcErrors: 0 };
}

export const slaveSimulator = new RtuSlaveSimulator();
