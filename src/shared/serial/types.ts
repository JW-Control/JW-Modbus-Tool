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
}

export interface NormalizedSerialPortConfig {
  path: string;
  baudRate: number;
  dataBits: SerialDataBits;
  parity: SerialParity;
  stopBits: SerialStopBits;
  lock: boolean;
}

export interface SerialConnectionState {
  connected: boolean;
  config?: NormalizedSerialPortConfig;
  openedAt?: string;
  lastError?: string;
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
