import type {
  SerialDataBits,
  SerialParity,
  SerialStopBits
} from "../shared/serial/types.js";

export const supportedBaudRates = [9600, 19200, 38400, 57600, 115200] as const;

export interface SerialSettings {
  portPath: string;
  baudRate: (typeof supportedBaudRates)[number];
  dataBits: SerialDataBits;
  parity: SerialParity;
  stopBits: SerialStopBits;
  timeoutMs: number;
}

export const defaultSerialSettings: SerialSettings = {
  portPath: "",
  baudRate: 115200,
  dataBits: 8,
  parity: "none",
  stopBits: 1,
  timeoutMs: 1000
};

export function normalizeSerialSettings(value: unknown): SerialSettings {
  if (!value || typeof value !== "object") {
    return { ...defaultSerialSettings };
  }

  const candidate = value as Partial<SerialSettings>;

  return {
    portPath: typeof candidate.portPath === "string" ? candidate.portPath : "",
    baudRate: supportedBaudRates.includes(
      candidate.baudRate as (typeof supportedBaudRates)[number]
    )
      ? (candidate.baudRate as SerialSettings["baudRate"])
      : defaultSerialSettings.baudRate,
    dataBits: candidate.dataBits === 7 || candidate.dataBits === 8
      ? candidate.dataBits
      : defaultSerialSettings.dataBits,
    parity: candidate.parity === "even" || candidate.parity === "odd" || candidate.parity === "none"
      ? candidate.parity
      : defaultSerialSettings.parity,
    stopBits: candidate.stopBits === 1 || candidate.stopBits === 2
      ? candidate.stopBits
      : defaultSerialSettings.stopBits,
    timeoutMs: isValidTimeout(candidate.timeoutMs)
      ? candidate.timeoutMs
      : defaultSerialSettings.timeoutMs
  };
}

export function serialFormatLabel(settings: {
  baudRate: number;
  dataBits: SerialDataBits;
  parity: SerialParity;
  stopBits: SerialStopBits;
}): string {
  const parityLabel = settings.parity === "none" ? "N" : settings.parity === "even" ? "E" : "O";
  return `${settings.baudRate} ${settings.dataBits}${parityLabel}${settings.stopBits}`;
}

export function isValidTimeout(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 50 && Number(value) <= 60000;
}
