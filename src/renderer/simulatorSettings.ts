import type { SlaveSimulatorSettings } from "../shared/slave/types.js";
import { defaultEchoMode, isEchoMode } from "../shared/serial/echoFilter.js";

const SETTINGS_STORAGE_KEY = "jw-modbus-tool.simulator.settings.v1";
export const SIMULATOR_SETTINGS_EVENT = "jw-simulator-settings-changed";
export const simulatorBaudRates = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

export const defaultSimulatorSettings: SlaveSimulatorSettings = { port: "", baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1, echo: defaultEchoMode, framing: "rtu", tcpHost: "0.0.0.0", tcpPort: 502, tcpFraming: "tcp" };

export function normalizeSimulatorSettings(input: unknown): SlaveSimulatorSettings {
  if (!input || typeof input !== "object") return { ...defaultSimulatorSettings };
  const source = input as Partial<SlaveSimulatorSettings>;
  return {
    port: typeof source.port === "string" ? source.port : defaultSimulatorSettings.port,
    baudRate: simulatorBaudRates.includes(Number(source.baudRate)) ? Number(source.baudRate) : defaultSimulatorSettings.baudRate,
    dataBits: source.dataBits === 7 ? 7 : 8,
    parity: source.parity === "even" || source.parity === "odd" ? source.parity : "none",
    stopBits: source.stopBits === 2 ? 2 : 1,
    echo: isEchoMode(source.echo) ? source.echo : defaultEchoMode,
    framing: source.framing === "ascii" ? "ascii" : "rtu",
    tcpHost: source.tcpHost === "127.0.0.1" ? "127.0.0.1" : "0.0.0.0",
    tcpPort: Number.isInteger(source.tcpPort) && source.tcpPort! >= 1 && source.tcpPort! <= 65535 ? source.tcpPort : 502,
    tcpFraming: source.tcpFraming === "rtu" ? "rtu" : "tcp"
  };
}

export function loadSimulatorSettings(): SlaveSimulatorSettings {
  try {
    return normalizeSimulatorSettings(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null"));
  } catch {
    return { ...defaultSimulatorSettings };
  }
}

export function storeSimulatorSettings(settings: SlaveSimulatorSettings, notify = false) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* local storage can be unavailable in previews */
  }
  if (notify) window.dispatchEvent(new CustomEvent(SIMULATOR_SETTINGS_EVENT));
}
