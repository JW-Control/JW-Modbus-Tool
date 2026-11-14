import type { Framing } from "../modbus/adu.js";
import type { EchoMode } from "./echoFilter.js";

/** How the master reaches the slaves: a serial port (or the internal channel) or a TCP socket. */
export type MasterTransport = "serial" | "tcp";

/** Framing on a serial port. */
export type SerialFraming = "rtu" | "ascii";

/** Framing on TCP: standard Modbus TCP (MBAP) or RTU frames over a TCP socket (serial gateways). */
export type TcpFraming = "mbap" | "rtu";

export const DEFAULT_TCP_PORT = 502;

/**
 * Port path that connects the master to the slave simulator in memory, with
 * no COM port involved. The serial format is accepted but has no effect.
 */
export const INTERNAL_SIMULATOR_PATH = "INTERNO";

export type SerialParity = "none" | "even" | "odd";

export type SerialDataBits = 7 | 8;

export type SerialStopBits = 1 | 2;

export interface SerialPortDescriptor {
  path: string;
  displayName: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  vendorId?: string;
  productId?: string;
}

export interface SerialPortConfig {
  path: string;
  baudRate: number;
  dataBits?: SerialDataBits;
  parity?: SerialParity;
  stopBits?: SerialStopBits;
  lock?: boolean;
  /** Echo of the USB-RS485 converter (see echoFilter.ts). Default: auto. */
  echo?: EchoMode;
  /** Default: serial. */
  transport?: MasterTransport;
  /** Serial framing. Default: rtu. */
  framing?: SerialFraming;
  /** TCP only. */
  host?: string;
  /** TCP only. Default: 502. */
  tcpPort?: number;
  /** TCP only. Default: mbap. */
  tcpFraming?: TcpFraming;
}

export interface NormalizedSerialPortConfig {
  path: string;
  baudRate: number;
  dataBits: SerialDataBits;
  parity: SerialParity;
  stopBits: SerialStopBits;
  lock: boolean;
  echo: EchoMode;
  transport: MasterTransport;
  /** Frame format on the wire: rtu, ascii or tcp (MBAP). */
  framing: Framing;
  host?: string;
  tcpPort?: number;
}

export interface SerialConnectionState {
  connected: boolean;
  config?: NormalizedSerialPortConfig;
  openedAt?: string;
  lastError?: string;
  /** What `auto` echo mode learned from the converter; undefined = not yet known. */
  echoDetected?: boolean;
}

export type SerialOperationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };
