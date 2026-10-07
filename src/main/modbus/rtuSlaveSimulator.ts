import { EventEmitter } from "node:events";
import { SerialPort } from "serialport";
import { formatHex } from "../../shared/modbus/byteUtils.js";
import { isExceptionFunctionCode } from "../../shared/modbus/exceptions.js";
import { RtuRequestFramer, rtuSilenceMs } from "../../shared/modbus/rtuRequestFramer.js";
import { VirtualSlaveBus, type VirtualBusFrameResult } from "../../shared/modbus/virtualSlaveBus.js";
import { INTERNAL_SIMULATOR_PATH, type NormalizedSerialPortConfig, type SerialPortConfig } from "../../shared/serial/types.js";
import type {
  AddVirtualDeviceRequest,
  SetVirtualFaultsRequest,
  SetVirtualValueRequest,
  SlaveSimulatorCounters,
  SlaveSimulatorEvent,
  SlaveSimulatorState,
  SlaveTrafficEntry,
  SlaveTrafficResult,
  VirtualDeviceConfig,
  VirtualDeviceFaults,
  VirtualDeviceSnapshot
} from "../../shared/slave/types.js";
import { isInternalSimulatorPath, validateSerialPortConfig, type InternalSlaveEndpoint } from "../serial/serialManager.js";

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

/** Where a response goes: the COM port or the in-memory master. */
interface ResponseSink {
  channel: string;
  isActive(): boolean;
  write(response: Uint8Array): void;
  /** Delayed responses waiting to be sent, so they can be dropped when the channel closes. */
  pending: Set<ReturnType<typeof setTimeout>>;
}

// USB-serial adapters deliver bytes in bursts, so the idle timeout that
// releases unframed bytes must be well above the theoretical 3.5 characters.
const MIN_IDLE_FLUSH_MS = 20;
// Counters change on every frame; the UI only needs them a few times a second.
const STATE_EMIT_INTERVAL_MS = 200;
// Traffic kept for the Simulator view, so it survives switching views.
const MAX_TRAFFIC_ENTRIES = 500;

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
  private comSink: ResponseSink | null = null;
  private readonly internalPending = new Set<ReturnType<typeof setTimeout>>();
  private config?: NormalizedSerialPortConfig;
  private startedAt?: string;
  private lastError?: string;
  private counters: SlaveSimulatorCounters = emptyCounters();
  private nextTrafficId = 1;
  private traffic: SlaveTrafficEntry[] = [];
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

    if (isInternalSimulatorPath(config?.path)) {
      throw new Error(`${INTERNAL_SIMULATOR_PATH} es el canal interno: el simulador ya lo atiende sin iniciarlo. Elige un puerto COM.`);
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
    this.comSink = {
      channel: normalizedConfig.path,
      isActive: () => this.port === port,
      write: (response) => this.writeResponse(port, response),
      pending: new Set()
    };
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
    this.bus.addDevice(request.unitId, request.name, request.sizes, request.template);
    this.emitState();
    return this.getState();
  }

  setFaults(request: SetVirtualFaultsRequest): SlaveSimulatorState {
    this.bus.setFaults(request.unitId, request.faults ?? {});
    this.emitState();
    return this.getState();
  }

  exportDevices(): VirtualDeviceConfig[] {
    return this.bus.exportDevices();
  }

  importDevices(devices: VirtualDeviceConfig[]): SlaveSimulatorState {
    this.bus.replaceDevices(devices);
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

  /** Newest first. */
  getTraffic(): SlaveTrafficEntry[] {
    return [...this.traffic];
  }

  clearTraffic(): void {
    this.traffic = [];
  }

  getDevice(unitId: number): VirtualDeviceSnapshot {
    return this.bus.getDevice(unitId);
  }

  setValue(request: SetVirtualValueRequest): VirtualDeviceSnapshot {
    return this.bus.setValue(request);
  }

  /** Lets the app's master talk to the virtual devices in memory, with no COM port. */
  internalEndpoint(): InternalSlaveEndpoint {
    return {
      send: (request, reply) => {
        this.processFrame(Uint8Array.from(request), {
          channel: INTERNAL_SIMULATOR_PATH,
          isActive: () => true,
          write: reply,
          pending: this.internalPending
        });
      }
    };
  }

  private handleData(port: SlavePort, chunk: Buffer): void {
    if (this.port !== port) {
      return;
    }

    this.clearIdleTimer();

    const sink = this.comSink;

    if (!sink) {
      return;
    }

    for (const frame of this.framer.push(Uint8Array.from(chunk))) {
      this.processFrame(frame, sink);
    }

    if (this.framer.pendingBytes > 0) {
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        const rest = this.framer.flush();

        if (rest && sink.isActive()) {
          this.processFrame(rest, sink);
        }
      }, this.idleFlushMs);
    }
  }

  private processFrame(frame: Uint8Array, sink: ResponseSink): void {
    const result = this.bus.handleFrame(frame);
    const trafficResult = classify(result);

    this.counters.requests += 1;

    if (trafficResult === "response") this.counters.responses += 1;
    if (trafficResult === "exception") this.counters.exceptions += 1;
    if (trafficResult === "crc-error") this.counters.crcErrors += 1;
    if (trafficResult === "ignored" || trafficResult === "frame-error") this.counters.ignored += 1;
    if (result.fault) this.counters.faults += 1;

    const response = result.kind === "response" ? result.response : null;

    if (response) {
      const delayMs = result.fault?.delayMs ?? 0;

      if (delayMs > 0) {
        const timer = setTimeout(() => {
          sink.pending.delete(timer);
          if (sink.isActive()) sink.write(response);
        }, delayMs);
        sink.pending.add(timer);
      } else {
        sink.write(response);
      }
    }

    const entry: SlaveTrafficEntry = {
      id: this.nextTrafficId++,
      at: new Date().toISOString(),
      channel: sink.channel,
      unitId: result.unitId,
      functionCode: result.functionCode,
      request: formatHex(frame),
      response: response ? formatHex(response) : null,
      result: trafficResult,
      summary: result.summary,
      fault: result.fault ? describeFault(result.fault) : null
    };

    this.traffic.unshift(entry);
    if (this.traffic.length > MAX_TRAFFIC_ENTRIES) this.traffic.length = MAX_TRAFFIC_ENTRIES;
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

  private writeResponse(port: SlavePort, response: Uint8Array): void {
    port.write(Buffer.from(response), (error) => {
      if (error) {
        this.lastError = error.message;
        this.emitState();
      }
    });
  }

  private detachPort(): void {
    this.clearIdleTimer();
    this.comSink?.pending.forEach((timer) => clearTimeout(timer));
    this.comSink = null;
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
    case "silenced":
      return "silenced";
    case "ignored":
      if (result.reason === "crc-error") return "crc-error";
      if (result.reason === "frame-error") return "frame-error";
      return "ignored";
  }
}

function describeFault(faults: VirtualDeviceFaults): string {
  const parts: string[] = [];

  if (faults.mode === "no-response") parts.push("Sin respuesta");
  if (faults.mode === "bad-crc") parts.push("CRC corrupto");
  if (faults.mode === "exception") parts.push(`Excepción ${String(faults.exceptionCode).padStart(2, "0")}`);
  if (faults.delayMs > 0 && faults.mode !== "no-response") parts.push(`Retardo ${faults.delayMs} ms`);

  return parts.join(" · ") || "Sin falla";
}

function emptyCounters(): SlaveSimulatorCounters {
  return { requests: 0, responses: 0, exceptions: 0, ignored: 0, crcErrors: 0, faults: 0 };
}

export const slaveSimulator = new RtuSlaveSimulator();
