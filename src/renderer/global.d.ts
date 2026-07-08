export {};

import type {
  SerialConnectionState,
  SerialOperationResult,
  SerialPortConfig,
  SerialPortDescriptor
} from "../shared/serial/types.js";

declare global {
  interface Window {
    jwModbus?: {
      appName: string;
      versions: {
        chrome?: string;
        electron?: string;
        node?: string;
      };
      serial: {
        listPorts: () => Promise<SerialOperationResult<SerialPortDescriptor[]>>;
        getConnectionState: () => Promise<SerialOperationResult<SerialConnectionState>>;
        open: (config: SerialPortConfig) => Promise<SerialOperationResult<SerialConnectionState>>;
        close: () => Promise<SerialOperationResult<SerialConnectionState>>;
      };
    };
  }
}
