import { SerialPort } from "serialport";
import { concatBytes } from "../../shared/modbus/byteUtils.js";
import type {
  NormalizedSerialPortConfig,
  SerialConnectionState,
  SerialPortConfig,
  SerialPortDescriptor,
  SerialOperationResult
} from "../../shared/serial/types.js";

interface RawSerialPortDescriptor {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  vendorId?: string;
  productId?: string;
}

interface SerialPortLister {
  list(): Promise<RawSerialPortDescriptor[]>;
}

export interface SerialTransactionOptions {
  timeoutMs: number;
  expectedResponseLength: (bytes: Uint8Array) => number | null;
}

export interface SerialTransactionResult {
  request: Uint8Array;
  response: Uint8Array;
  elapsedMs: number;
}

export const supportedBaudRates = [9600, 19200, 38400, 57600, 115200] as const;

export function normalizeSerialPorts(ports: RawSerialPortDescriptor[]): SerialPortDescriptor[] {
  return ports
    .map((port) => ({
      path: port.path,
      displayName: port.manufacturer ? `${port.path} - ${port.manufacturer}` : port.path,
      manufacturer: port.manufacturer,
      serialNumber: port.serialNumber,
      pnpId: port.pnpId,
      locationId: port.locationId,
      vendorId: port.vendorId,
      productId: port.productId
    }))
    .sort((left, right) => comparePortPaths(left.path, right.path));
}

export function validateSerialPortConfig(config: SerialPortConfig): NormalizedSerialPortConfig {
  const path = config.path.trim();

  if (!path) {
    throw new Error("Serial port path is required");
  }

  if (!supportedBaudRates.includes(config.baudRate as (typeof supportedBaudRates)[number])) {
    throw new Error(`Unsupported baud rate: ${config.baudRate}`);
  }

  const dataBits = config.dataBits ?? 8;
  const parity = config.parity ?? "none";
  const stopBits = config.stopBits ?? 1;

  if (dataBits !== 7 && dataBits !== 8) {
    throw new Error("Data bits must be 7 or 8");
  }

  if (parity !== "none" && parity !== "even" && parity !== "odd") {
    throw new Error("Parity must be none, even, or odd");
  }

  if (stopBits !== 1 && stopBits !== 2) {
    throw new Error("Stop bits must be 1 or 2");
  }

  return {
    path,
    baudRate: config.baudRate,
    dataBits,
    parity,
    stopBits,
    lock: config.lock ?? true
  };
}

export async function listSerialPorts(lister: SerialPortLister = SerialPort): Promise<SerialPortDescriptor[]> {
  return normalizeSerialPorts(await lister.list());
}

export class SerialManager {
  private port: SerialPort | null = null;
  private state: SerialConnectionState = {
    connected: false
  };

  async listPorts(): Promise<SerialPortDescriptor[]> {
    return listSerialPorts();
  }

  getConnectionState(): SerialConnectionState {
    return { ...this.state };
  }

  async open(config: SerialPortConfig): Promise<SerialConnectionState> {
    const normalizedConfig = validateSerialPortConfig(config);

    if (this.port?.isOpen) {
      await this.close();
    }

    const nextPort = new SerialPort({
      path: normalizedConfig.path,
      baudRate: normalizedConfig.baudRate,
      dataBits: normalizedConfig.dataBits,
      parity: normalizedConfig.parity,
      stopBits: normalizedConfig.stopBits,
      lock: normalizedConfig.lock,
      autoOpen: false
    });

    nextPort.on("error", (error) => {
      this.state = {
        ...this.state,
        lastError: error.message
      };
    });

    await new Promise<void>((resolve, reject) => {
      nextPort.open((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    this.port = nextPort;
    this.state = {
      connected: true,
      config: normalizedConfig,
      openedAt: new Date().toISOString()
    };

    return this.getConnectionState();
  }

  async close(): Promise<SerialConnectionState> {
    const openPort = this.port;

    if (!openPort) {
      this.state = { connected: false };
      return this.getConnectionState();
    }

    await new Promise<void>((resolve, reject) => {
      openPort.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    this.port = null;
    this.state = { connected: false };
    return this.getConnectionState();
  }

  async transact(request: Uint8Array, options: SerialTransactionOptions): Promise<SerialTransactionResult> {
    const openPort = this.port;

    if (!openPort?.isOpen) {
      throw new Error("Serial port is not connected");
    }

    const startedAt = performance.now();
    const chunks: Uint8Array[] = [];

    return new Promise<SerialTransactionResult>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for RTU response after ${options.timeoutMs} ms`));
      }, options.timeoutMs);

      const cleanup = () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        openPort.off("data", onData);
        openPort.off("error", onError);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onData = (chunk: Buffer) => {
        chunks.push(Uint8Array.from(chunk));
        const response = concatBytes(...chunks);
        const expectedLength = options.expectedResponseLength(response);

        if (expectedLength !== null && response.length >= expectedLength) {
          cleanup();
          resolve({
            request,
            response: response.slice(0, expectedLength),
            elapsedMs: Math.round(performance.now() - startedAt)
          });
        }
      };

      openPort.on("data", onData);
      openPort.on("error", onError);

      openPort.flush((flushError) => {
        if (flushError) {
          cleanup();
          reject(flushError);
          return;
        }

        openPort.write(Buffer.from(request), (writeError) => {
          if (writeError) {
            cleanup();
            reject(writeError);
            return;
          }

          openPort.drain((drainError) => {
            if (drainError) {
              cleanup();
              reject(drainError);
            }
          });
        });
      });
    });
  }
}

export const serialManager = new SerialManager();

export function toSerialResult<T>(operation: () => Promise<T>): Promise<SerialOperationResult<T>> {
  return operation()
    .then((value) => ({ ok: true as const, value }))
    .catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown serial error"
    }));
}

function comparePortPaths(left: string, right: string): number {
  const leftCom = /^COM(\d+)$/i.exec(left);
  const rightCom = /^COM(\d+)$/i.exec(right);

  if (leftCom && rightCom) {
    return Number(leftCom[1]) - Number(rightCom[1]);
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}
