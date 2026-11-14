import { FunctionCode } from "../modbus/functionCodes.js";

/**
 * Echo of a USB-RS485 converter: many converters keep their receiver enabled
 * while they transmit, so every byte the PC writes comes back on the same COM
 * port before the other device answers.
 *
 * - `off`: the port never echoes; every received byte is the response.
 * - `on`: the port always echoes; what we wrote is discarded first.
 * - `auto`: an echo is discarded whenever it shows up. Only FC5 and FC6, whose
 *   normal response is identical to the request, need to know whether the
 *   converter echoes; that is learned from the other requests.
 */
export type EchoMode = "off" | "auto" | "on";

export const echoModes: readonly EchoMode[] = ["off", "auto", "on"];

export const defaultEchoMode: EchoMode = "auto";

export const echoModeLabels: Record<EchoMode, string> = { auto: "Automático", off: "Sin eco", on: "Con eco" };

export function isEchoMode(value: unknown): value is EchoMode {
  return value === "off" || value === "auto" || value === "on";
}

export type EchoSplit =
  /** Everything received so far could still be the start of our echo. */
  | { status: "partial" }
  /** The full echo arrived; `payload` is what came after it. */
  | { status: "echo"; payload: Uint8Array }
  /** The received bytes differ from what we sent: there is no echo. */
  | { status: "none"; payload: Uint8Array };

/** Compares the received bytes with what was just written. */
export function splitEcho(sent: Uint8Array, received: Uint8Array): EchoSplit {
  const common = Math.min(sent.length, received.length);

  for (let index = 0; index < common; index += 1) {
    if (sent[index] !== received[index]) {
      return { status: "none", payload: received };
    }
  }

  if (received.length < sent.length) {
    return { status: "partial" };
  }

  return { status: "echo", payload: received.slice(sent.length) };
}

/**
 * True when a correct response repeats the request byte for byte (FC5 and
 * FC6), so its echo and its response cannot be told apart by content.
 */
export function responseRepeatsRequest(request: Uint8Array): boolean {
  const functionCode = request[1];
  return functionCode === FunctionCode.WriteSingleCoil || functionCode === FunctionCode.WriteSingleRegister;
}

export type EchoDecision =
  /** Keep waiting for more bytes. */
  | { action: "wait" }
  /**
   * The bytes are the request repeated (FC5/FC6) and it is not yet known
   * whether the port echoes: wait `graceMs` of silence, then take them as the
   * response.
   */
  | { action: "ambiguous"; candidate: Uint8Array }
  /** Parse `payload` as the response. */
  | { action: "parse"; payload: Uint8Array; echoSeen: boolean };

/**
 * Decides what part of the received bytes is the response, for a master that
 * just wrote `request`. `learned` is what the connection knows so far about
 * the converter (undefined = unknown).
 */
export function decideEcho(
  mode: EchoMode,
  request: Uint8Array,
  received: Uint8Array,
  learned: boolean | undefined
): EchoDecision {
  if (mode === "off") {
    return { action: "parse", payload: received, echoSeen: false };
  }

  const split = splitEcho(request, received);

  if (split.status === "partial") {
    return { action: "wait" };
  }

  if (split.status === "none") {
    return { action: "parse", payload: split.payload, echoSeen: false };
  }

  if (split.payload.length > 0 || !responseRepeatsRequest(request)) {
    return { action: "parse", payload: split.payload, echoSeen: true };
  }

  // FC5/FC6 and exactly the request so far: echo, or the response itself?
  if (mode === "on" || learned === true) {
    return { action: "wait" };
  }

  if (learned === false) {
    return { action: "parse", payload: received, echoSeen: false };
  }

  return { action: "ambiguous", candidate: received };
}
