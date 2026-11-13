// Socket TCP del master: Modbus TCP (MBAP) o tramas RTU sobre TCP (pasarelas
// serie-Ethernet). Una petición a la vez; las respuestas tardías de una
// petición que ya venció se descartan por su número de transacción.
import { Socket } from "node:net";
import { bytesToUint16, concatBytes } from "../../shared/modbus/byteUtils.js";

export interface TcpTransactionOptions {
  timeoutMs: number;
  expectedResponseLength: (bytes: Uint8Array) => number | null;
  idleCompleteMs?: number;
  /** MBAP transaction id the response must carry; omit for RTU over TCP. */
  transactionId?: number;
}

export interface TcpTransactionResult {
  request: Uint8Array;
  response: Uint8Array;
  elapsedMs: number;
}

interface Pending {
  options: TcpTransactionOptions;
  startedAt: number;
  request: Uint8Array;
  resolve: (result: TcpTransactionResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export class TcpMasterLink {
  private socket: Socket | null = null;
  private buffer: Uint8Array = new Uint8Array(0);
  private pending: Pending | null = null;
  private closeListener: ((reason: string) => void) | null = null;

  get isOpen(): boolean {
    return Boolean(this.socket && !this.socket.destroyed);
  }

  /** Called when the peer closes or the socket fails while connected. */
  onClose(listener: (reason: string) => void): void {
    this.closeListener = listener;
  }

  async open(host: string, port: number, connectTimeoutMs = 3000): Promise<void> {
    await this.close();

    const socket = new Socket();
    socket.setNoDelay(true);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`No se pudo conectar a ${host}:${port} en ${connectTimeoutMs} ms`));
      }, connectTimeoutMs);
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`No se pudo conectar a ${host}:${port}: ${error.message}`));
      });
      socket.connect(port, host, () => {
        clearTimeout(timer);
        socket.removeAllListeners("error");
        resolve();
      });
    });

    socket.on("data", (chunk: Buffer) => this.handleData(Uint8Array.from(chunk)));
    socket.on("error", () => {
      // "close" follows and reports it.
    });
    socket.on("close", (hadError) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.failPending(new Error("La conexión TCP se cerró"));
      this.closeListener?.(hadError ? "La conexión TCP se cerró por un error" : "El equipo cerró la conexión TCP");
    });

    this.socket = socket;
    this.buffer = new Uint8Array(0);
  }

  async close(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    this.failPending(new Error("La conexión TCP se cerró"));

    if (!socket || socket.destroyed) return;

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.end();
      setTimeout(() => {
        socket.destroy();
        resolve();
      }, 300);
    });
  }

  transact(request: Uint8Array, options: TcpTransactionOptions): Promise<TcpTransactionResult> {
    const socket = this.socket;

    if (!socket || socket.destroyed) {
      return Promise.reject(new Error("TCP is not connected"));
    }

    if (this.pending) {
      return Promise.reject(new Error("Ya hay una petición TCP en curso"));
    }

    // Leftovers belong to an earlier request.
    this.buffer = new Uint8Array(0);

    return new Promise<TcpTransactionResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`Timed out waiting for response after ${options.timeoutMs} ms`));
      }, options.timeoutMs);

      this.pending = { options, startedAt: performance.now(), request, resolve, reject, timer, idleTimer: null };
      socket.write(Buffer.from(request), (error) => {
        if (error) this.failPending(error);
      });
    });
  }

  private handleData(chunk: Uint8Array): void {
    const pending = this.pending;

    if (!pending) {
      // Late reply to a request that already timed out.
      return;
    }

    if (pending.idleTimer) {
      clearTimeout(pending.idleTimer);
      pending.idleTimer = null;
    }

    this.buffer = concatBytes(this.buffer, chunk);

    for (;;) {
      const expected = pending.options.expectedResponseLength(this.buffer);

      if (expected === null) {
        if (pending.options.idleCompleteMs && this.buffer.length > 0) {
          pending.idleTimer = setTimeout(() => this.finish(this.buffer), pending.options.idleCompleteMs);
        }
        return;
      }

      if (this.buffer.length < expected) return;

      const frame = this.buffer.slice(0, expected);
      this.buffer = this.buffer.slice(expected);
      const tid = pending.options.transactionId;

      if (tid !== undefined && frame.length >= 2 && bytesToUint16(frame, 0) !== tid) {
        // Response to another (older) transaction: drop it and keep waiting.
        continue;
      }

      this.finish(frame);
      return;
    }
  }

  private finish(response: Uint8Array): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timer);
    if (pending.idleTimer) clearTimeout(pending.idleTimer);
    this.buffer = new Uint8Array(0);
    pending.resolve({ request: pending.request, response, elapsedMs: Math.round(performance.now() - pending.startedAt) });
  }

  private failPending(error: Error): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timer);
    if (pending.idleTimer) clearTimeout(pending.idleTimer);
    pending.reject(error);
  }
}
