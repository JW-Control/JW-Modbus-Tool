// Conexión del master, sea cual sea el transporte: puerto serie (RTU o
// ASCII), canal interno al simulador o socket TCP (MBAP o RTU sobre TCP).
// Las peticiones se atienden de a una, en orden de llegada, para que varias
// ventanas de sondeo puedan compartir la línea sin mezclar tramas.
import { buildAdu, expectedAduLength, parseAdu, type Framing, type ParsedAdu } from "../../shared/modbus/adu.js";
import {
  DEFAULT_TCP_PORT,
  type NormalizedSerialPortConfig,
  type SerialConnectionState,
  type SerialPortConfig
} from "../../shared/serial/types.js";
import { serialManager } from "../serial/serialManager.js";
import { TcpMasterLink } from "../tcp/tcpMasterLink.js";

export interface MasterTransaction {
  framing: Framing;
  request: Uint8Array;
  response: Uint8Array;
  parsed: ParsedAdu;
  elapsedMs: number;
  echoDiscarded?: boolean;
}

export interface RawTransactionOptions {
  /** Add CRC (RTU), ":" + LRC + CRLF (ASCII) or the MBAP header (TCP) to the typed bytes. */
  addCheck: boolean;
  timeoutMs: number;
}

/** Silence that ends a reply whose length cannot be known from its content. */
const RAW_IDLE_MS = 60;

export function validateTcpConfig(config: SerialPortConfig): NormalizedSerialPortConfig {
  const host = (config.host ?? "").trim();

  if (!host) {
    throw new Error("Escribe la dirección IP o el nombre del equipo");
  }

  if (!/^[A-Za-z0-9.:\-[\]]+$/.test(host)) {
    throw new Error(`Dirección no válida: ${host}`);
  }

  const tcpPort = config.tcpPort ?? DEFAULT_TCP_PORT;

  if (!Number.isInteger(tcpPort) || tcpPort < 1 || tcpPort > 65535) {
    throw new Error("El puerto TCP debe estar entre 1 y 65535");
  }

  const tcpFraming = config.tcpFraming ?? "mbap";

  if (tcpFraming !== "mbap" && tcpFraming !== "rtu") {
    throw new Error("El formato TCP debe ser mbap o rtu");
  }

  return {
    path: `${host}:${tcpPort}`,
    baudRate: 0,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    lock: false,
    echo: "off",
    transport: "tcp",
    framing: tcpFraming === "mbap" ? "tcp" : "rtu",
    host,
    tcpPort
  };
}

export class MasterConnection {
  private readonly tcp = new TcpMasterLink();
  private tcpState: SerialConnectionState = { connected: false };
  private queue: Promise<unknown> = Promise.resolve();
  private nextTransactionId = 1;

  constructor() {
    this.tcp.onClose((reason) => {
      this.tcpState = { connected: false, lastError: reason };
    });
  }

  getState(): SerialConnectionState {
    if (this.tcp.isOpen) return { ...this.tcpState };
    const serial = serialManager.getConnectionState();
    // A TCP link that dropped keeps its reason until something else connects.
    return !serial.connected && this.tcpState.lastError ? { ...this.tcpState } : serial;
  }

  get framing(): Framing {
    return this.tcp.isOpen ? this.tcpState.config?.framing ?? "tcp" : serialManager.getConnectionState().config?.framing ?? "rtu";
  }

  async open(config: SerialPortConfig): Promise<SerialConnectionState> {
    if (config?.transport === "tcp") {
      const normalized = validateTcpConfig(config);
      await serialManager.close();
      await this.tcp.open(normalized.host!, normalized.tcpPort!);
      this.tcpState = { connected: true, config: normalized, openedAt: new Date().toISOString() };
      return this.getState();
    }

    await this.closeTcp();
    return serialManager.open(config);
  }

  async close(): Promise<SerialConnectionState> {
    await this.closeTcp();
    return serialManager.close();
  }

  /** Sends one request PDU to `unitId` and returns the parsed reply. Throws on timeout or I/O errors. */
  transactPdu(unitId: number, pdu: Uint8Array, timeoutMs: number): Promise<MasterTransaction> {
    return this.enqueue(async () => {
      const framing = this.framing;
      const transactionId = framing === "tcp" ? this.takeTransactionId() : undefined;
      const request = buildAdu(framing, unitId, pdu, transactionId);
      return this.send(framing, request, { timeoutMs, transactionId });
    });
  }

  /**
   * Sends bytes typed by the user: unit id + PDU when `addCheck` is on,
   * or the whole frame exactly as typed when it is off.
   */
  transactRaw(bytes: Uint8Array, options: RawTransactionOptions): Promise<MasterTransaction> {
    return this.enqueue(async () => {
      const framing = this.framing;
      let request = bytes;
      let transactionId: number | undefined;

      if (options.addCheck) {
        if (bytes.length < 2) throw new Error("Escribe al menos el unit id y el código de función");
        transactionId = framing === "tcp" ? this.takeTransactionId() : undefined;
        request = buildAdu(framing, bytes[0], bytes.slice(1), transactionId);
      }

      return this.send(framing, request, { timeoutMs: options.timeoutMs, transactionId, idleCompleteMs: RAW_IDLE_MS });
    });
  }

  private async send(
    framing: Framing,
    request: Uint8Array,
    options: { timeoutMs: number; transactionId?: number; idleCompleteMs?: number }
  ): Promise<MasterTransaction> {
    const expectedResponseLength = (bytes: Uint8Array) => expectedAduLength(framing, bytes, "response");
    const result = this.tcp.isOpen
      ? await this.tcp.transact(request, { ...options, expectedResponseLength })
      : await serialManager.transact(request, { timeoutMs: options.timeoutMs, idleCompleteMs: options.idleCompleteMs, expectedResponseLength });

    return {
      framing,
      request,
      response: result.response,
      parsed: parseAdu(framing, result.response),
      elapsedMs: result.elapsedMs,
      echoDiscarded: "echoDiscarded" in result ? (result.echoDiscarded as boolean | undefined) : undefined
    };
  }

  private takeTransactionId(): number {
    const id = this.nextTransactionId;
    this.nextTransactionId = (this.nextTransactionId % 0xffff) + 1;
    return id;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async closeTcp(): Promise<void> {
    await this.tcp.close();
    this.tcpState = { connected: false };
  }
}

export const masterConnection = new MasterConnection();
