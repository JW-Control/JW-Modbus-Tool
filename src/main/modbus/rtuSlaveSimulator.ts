import { EventEmitter } from "node:events";
import { createServer, type Server, type Socket } from "node:net";
import { SerialPort } from "serialport";
import { formatAdu, type Framing } from "../../shared/modbus/adu.js";
import { AsciiFramer, MbapFramer } from "../../shared/modbus/streamFramers.js";
import { isExceptionFunctionCode } from "../../shared/modbus/exceptions.js";
import { RtuRequestFramer, rtuSilenceMs } from "../../shared/modbus/rtuRequestFramer.js";
import { VirtualSlaveBus, type VirtualBusFrameResult } from "../../shared/modbus/virtualSlaveBus.js";
import { responseRepeatsRequest } from "../../shared/serial/echoFilter.js";
import {
  DEFAULT_TCP_PORT,
  INTERNAL_SIMULATOR_PATH,
  type NormalizedSerialPortConfig,
  type SerialPortConfig
} from "../../shared/serial/types.js";
import type {
  AddVirtualDeviceRequest,
  SetVirtualFaultsRequest,
  SetVirtualValueRequest,
  SlaveSimulatorCounters,
  SlaveSimulatorEvent,
  SlaveSimulatorState,
  SlaveTcpConfig,
  SlaveTcpState,
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
  framing: Framing;
  isActive(): boolean;
  write(response: Uint8Array): void;
  /** Delayed responses waiting to be sent, so they can be dropped when the channel closes. */
  pending: Set<ReturnType<typeof setTimeout>>;
}

// USB-serial adapters deliver bytes in bursts, so the idle timeout that
// releases unframed bytes must be well above the theoretical 3.5 characters.
const MIN_IDLE_FLUSH_MS = 20;
// A request that is clearly incomplete (known function code, bytes missing)
// gets this much silence before it is given up: the rest is usually in flight.
const INCOMPLETE_FRAME_WAIT_MS = 150;
// Counters change on every frame; the UI only needs them a few times a second.
const STATE_EMIT_INTERVAL_MS = 200;
// Margin over the transmit time in which an echo of our response may arrive
// (USB-serial latency). Bytes after it are a new request.
const ECHO_WINDOW_MARGIN_MS = 30;
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

/** Splits a byte stream into request frames; RTU also reports a frame still in flight. */
interface RequestFramer {
  readonly pendingBytes: number;
  readonly awaitingRestOfFrame?: boolean;
  push(chunk: Uint8Array): Uint8Array[];
  flush(): Uint8Array | null;
}

interface TcpServerState {
  server: Server;
  config: SlaveTcpState;
  sockets: Set<Socket>;
}

export class RtuSlaveSimulator {
  private readonly bus = new VirtualSlaveBus();
  private readonly events = new EventEmitter();
  private framer: RequestFramer = new RtuRequestFramer();
  private tcp: TcpServerState | null = null;
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
  /** Response just written to the COM port, whose echo we may still receive. */
  private pendingEcho: { bytes: Uint8Array; matched: number; until: number } | null = null;
  /** What `auto` echo mode learned about the converter; undefined = unknown. */
  private echoDetected: boolean | undefined;

  constructor(private readonly portFactory: SlavePortFactory = defaultPortFactory) {}

  getState(): SlaveSimulatorState {
    return {
      running: Boolean(this.port?.isOpen),
      config: this.port ? this.config : undefined,
      startedAt: this.port ? this.startedAt : undefined,
      devices: this.bus.listDevices(),
      counters: { ...this.counters },
      lastError: this.lastError,
      echoDetected: this.port ? this.echoDetected : undefined,
      tcp: this.tcp ? { ...this.tcp.config, clients: this.tcp.sockets.size } : undefined
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
      framing: normalizedConfig.framing,
      isActive: () => this.port === port,
      write: (response) => this.writeResponse(port, response),
      pending: new Set()
    };
    this.config = normalizedConfig;
    this.startedAt = new Date().toISOString();
    this.lastError = undefined;
    this.counters = emptyCounters();
    this.framer = normalizedConfig.framing === "ascii" ? new AsciiFramer() : new RtuRequestFramer();
    this.pendingEcho = null;
    this.echoDetected = undefined;
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

  /**
   * Serves the virtual devices over TCP, alongside (or instead of) the COM
   * port. Standard Modbus TCP (MBAP) or RTU frames over TCP.
   */
  async startTcp(config: SlaveTcpConfig): Promise<SlaveSimulatorState> {
    if (this.tcp) {
      throw new Error(`El simulador ya escucha por TCP en ${this.tcp.config.host}:${this.tcp.config.port}. Detenlo antes de cambiarlo.`);
    }

    const host = (config?.host ?? "0.0.0.0").trim() || "0.0.0.0";
    const port = config?.port ?? DEFAULT_TCP_PORT;
    const framing: Framing = config?.framing === "rtu" ? "rtu" : "tcp";

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("El puerto TCP debe estar entre 1 y 65535");
    }

    const sockets = new Set<Socket>();
    const server = createServer((socket) => this.acceptTcpClient(socket, framing, sockets));

    await new Promise<void>((resolve, reject) => {
      server.once("error", (error: NodeJS.ErrnoException) => {
        reject(
          new Error(
            error.code === "EADDRINUSE"
              ? `El puerto TCP ${port} ya está en uso por otro programa`
              : error.code === "EACCES"
                ? `Sin permiso para usar el puerto TCP ${port}`
                : error.message
          )
        );
      });
      server.listen(port, host, () => resolve());
    });

    server.on("error", (error) => {
      this.lastError = error.message;
      this.emitState();
    });

    this.tcp = { server, sockets, config: { host, port, framing, clients: 0, startedAt: new Date().toISOString() } };
    this.emitState();
    return this.getState();
  }

  async stopTcp(): Promise<SlaveSimulatorState> {
    const tcp = this.tcp;

    if (!tcp) return this.getState();

    this.tcp = null;
    tcp.sockets.forEach((socket) => socket.destroy());
    await new Promise<void>((resolve) => tcp.server.close(() => resolve()));
    this.emitState();
    return this.getState();
  }

  private acceptTcpClient(socket: Socket, framing: Framing, sockets: Set<Socket>): void {
    sockets.add(socket);
    socket.setNoDelay(true);
    const remote = `${socket.remoteAddress ?? "?"}:${socket.remotePort ?? "?"}`.replace(/^::ffff:/, "");
    const framer: RequestFramer = framing === "rtu" ? new RtuRequestFramer() : new MbapFramer();
    const sink: ResponseSink = {
      channel: `TCP ${remote}`,
      framing,
      isActive: () => !socket.destroyed && this.tcp?.sockets === sockets,
      write: (response) => {
        socket.write(Buffer.from(response));
      },
      pending: new Set()
    };
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    socket.on("data", (chunk: Buffer) => {
      if (idleTimer) clearTimeout(idleTimer);
      for (const frame of framer.push(Uint8Array.from(chunk))) this.processFrame(frame, sink);
      // RTU over TCP: release bytes that never formed a frame.
      if (framing === "rtu" && framer.pendingBytes > 0) {
        idleTimer = setTimeout(() => {
          const rest = framer.flush();
          if (rest && sink.isActive()) this.processFrame(rest, sink);
        }, INCOMPLETE_FRAME_WAIT_MS);
      }
    });
    socket.on("error", () => {
      // "close" follows.
    });
    socket.on("close", () => {
      if (idleTimer) clearTimeout(idleTimer);
      sink.pending.forEach((timer) => clearTimeout(timer));
      sockets.delete(socket);
      this.scheduleStateEmit();
    });
    this.scheduleStateEmit();
  }

  /** Lets the app's master talk to the virtual devices in memory, with no COM port. */
  internalEndpoint(): InternalSlaveEndpoint {
    return {
      send: (request, reply, framing = "rtu") => {
        this.processFrame(Uint8Array.from(request), {
          channel: INTERNAL_SIMULATOR_PATH,
          framing,
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

    const bytes = this.discardEcho(Uint8Array.from(chunk));

    if (bytes.length === 0) {
      return;
    }

    for (const frame of this.framer.push(bytes)) {
      this.processFrame(frame, sink);
    }

    if (this.framer.pendingBytes > 0) {
      const waitMs = this.framer.awaitingRestOfFrame
        ? Math.max(this.idleFlushMs, INCOMPLETE_FRAME_WAIT_MS)
        : this.idleFlushMs;
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        const rest = this.framer.flush();

        if (rest && sink.isActive()) {
          this.processFrame(rest, sink);
        }
      }, waitMs);
    }
  }

  private processFrame(frame: Uint8Array, sink: ResponseSink): void {
    const result = this.bus.handleAdu(sink.framing, frame);
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
      request: formatAdu(sink.framing, frame),
      response: response ? formatAdu(sink.framing, response) : null,
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

  /**
   * Drops the echo of our own last response, if the converter sends it back.
   * Without this, the simulator would read its response as a new request and
   * answer it, flooding the bus.
   */
  private discardEcho(chunk: Uint8Array): Uint8Array {
    const pending = this.pendingEcho;
    const mode = this.config?.echo ?? "off";

    if (!pending) {
      return chunk;
    }

    const learnable = !responseRepeatsRequest(pending.bytes);

    if (Date.now() > pending.until) {
      this.pendingEcho = null;
      if (mode === "auto" && learnable && pending.matched === 0) this.echoDetected = false;
      return pending.matched > 0 ? concat(pending.bytes.subarray(0, pending.matched), chunk) : chunk;
    }

    const matchedBefore = pending.matched;
    let index = 0;

    while (index < chunk.length && pending.matched < pending.bytes.length) {
      if (chunk[index] !== pending.bytes[pending.matched]) {
        this.pendingEcho = null;
        if (mode === "auto" && learnable) this.echoDetected = false;
        return concat(pending.bytes.subarray(0, matchedBefore), chunk);
      }

      index += 1;
      pending.matched += 1;
    }

    if (pending.matched === pending.bytes.length) {
      this.pendingEcho = null;
      this.counters.echoesDiscarded += 1;
      if (mode === "auto" && learnable) this.echoDetected = true;
    }

    return chunk.slice(index);
  }

  private expectEcho(response: Uint8Array): void {
    const mode = this.config?.echo ?? "off";

    if (mode === "off" || (mode === "auto" && this.echoDetected === false) || !this.config) {
      this.pendingEcho = null;
      return;
    }

    const bitsPerCharacter = 1 + this.config.dataBits + (this.config.parity === "none" ? 0 : 1) + this.config.stopBits;
    const transmitMs = (response.length * bitsPerCharacter * 1000) / this.config.baudRate;
    this.pendingEcho = { bytes: response, matched: 0, until: Date.now() + transmitMs + ECHO_WINDOW_MARGIN_MS };
  }

  private writeResponse(port: SlavePort, response: Uint8Array): void {
    this.expectEcho(response);
    port.write(Buffer.from(response), (error) => {
      if (error) {
        this.lastError = error.message;
        this.emitState();
      }
    });
  }

  private detachPort(): void {
    this.clearIdleTimer();
    this.pendingEcho = null;
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
      return isExceptionFunctionCode(result.responsePdu?.[0] ?? result.response[1]) ? "exception" : "response";
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
  return { requests: 0, responses: 0, exceptions: 0, ignored: 0, crcErrors: 0, faults: 0, echoesDiscarded: 0 };
}

function concat(head: Uint8Array, tail: Uint8Array): Uint8Array {
  const joined = new Uint8Array(head.length + tail.length);
  joined.set(head, 0);
  joined.set(tail, head.length);
  return joined;
}

export const slaveSimulator = new RtuSlaveSimulator();
