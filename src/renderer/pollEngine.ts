// Ventanas de sondeo (como en Modbus Poll): cada una lee un bloque de un
// slave cada cierto intervalo, aunque el usuario esté en otra vista. Viven
// fuera de React para que el sondeo y el registro a CSV sigan corriendo.
import type { RtuMasterActionResult, ModbusCommand } from "../shared/modbus/masterActionTypes.js";
import type { ModbusRequest } from "../shared/modbus/pdu.js";
import {
  decodeRegisters,
  encodeValue,
  numericValue,
  registersPerValue,
  type ByteOrder,
  type RegisterFormat
} from "../shared/modbus/dataFormats.js";
import type { SerialOperationResult } from "../shared/serial/types.js";
import { toDisplayAddress, type AddressMode, type TableFn } from "./addressing.js";

export type PollFunction = 1 | 2 | 3 | 4;
export type PollStatus = "idle" | "ok" | "timeout" | "error" | "exception" | "crc";

export interface PollDefinition {
  id: string;
  name: string;
  unitId: number;
  fc: PollFunction;
  /** Protocol address (from 0). */
  start: number;
  quantity: number;
  intervalMs: number;
  timeoutMs: number;
  format: RegisterFormat;
  byteOrder: ByteOrder;
  /** Per-address format, overriding `format`. Keys are protocol addresses. */
  rowFormats: Record<number, RegisterFormat>;
  aliases: Record<number, string>;
  /** Protocol addresses drawn on the chart. */
  charted: number[];
}

export interface PollRuntime {
  running: boolean;
  reading: boolean;
  status: PollStatus;
  message: string;
  lastAt: string | null;
  elapsedMs: number | null;
  values: Array<number | boolean> | null;
  reads: number;
  ok: number;
  errors: number;
  timeouts: number;
  logPath: string | null;
  logRows: number;
}

export interface PollWindowState {
  def: PollDefinition;
  rt: PollRuntime;
}

export interface PollRow {
  /** Protocol address. */
  raw: number;
  display: number;
  alias: string;
  format: RegisterFormat;
  /** Text shown in the value column. */
  text: string;
  /** Raw register or bit, for the hex column. */
  rawValue: number | boolean | null;
  /** This address is the 2nd-4th register of a 32/64-bit value that starts above. */
  continuation: boolean;
  writable: boolean;
}

export interface TrendPoint {
  at: number;
  value: number;
}

/** What the engine reports after each request, for traffic and statistics. */
export interface PollActionEvent {
  windowId: string;
  unitId: number;
  request: ModbusRequest;
  at: Date;
  ok: boolean;
  status: PollStatus;
  error?: string;
  action?: RtuMasterActionResult;
}

export type ExecuteFn = (command: ModbusCommand) => Promise<SerialOperationResult<RtuMasterActionResult>>;

export interface LogFiles {
  saveText(request: { text: string; defaultFileName: string; filters?: Array<{ name: string; extensions: string[] }>; title?: string }): Promise<SerialOperationResult<{ canceled: boolean; filePath?: string }>>;
  appendText(request: { filePath: string; text: string }): Promise<SerialOperationResult<{ bytesWritten: number }>>;
}

const HISTORY_MS = 10 * 60 * 1000;
const HISTORY_MAX_POINTS = 3000;
const LOG_FLUSH_MS = 1000;
export const MIN_POLL_INTERVAL_MS = 100;

export const pollFunctionLabels: Record<PollFunction, string> = {
  1: "FC01 Coils",
  2: "FC02 Entradas discretas",
  3: "FC03 Holding registers",
  4: "FC04 Input registers"
};

export function defaultPollDefinition(id: string, unitId = 1): PollDefinition {
  return {
    id,
    name: `Ventana ${id.replace(/\D/g, "") || 1}`,
    unitId,
    fc: 3,
    start: 0,
    quantity: 10,
    intervalMs: 1000,
    timeoutMs: 1000,
    format: "uint16",
    byteOrder: "ABCD",
    rowFormats: {},
    aliases: {},
    charted: []
  };
}

function idleRuntime(): PollRuntime {
  return {
    running: false,
    reading: false,
    status: "idle",
    message: "Sin leer todavía",
    lastAt: null,
    elapsedMs: null,
    values: null,
    reads: 0,
    ok: 0,
    errors: 0,
    timeouts: 0,
    logPath: null,
    logRows: 0
  };
}

export function isBitFunction(fc: number): boolean {
  return fc === 1 || fc === 2;
}

/** Rows of a window for the table, decoded with each address's format. */
export function pollRows(window: PollWindowState, mode: AddressMode): PollRow[] {
  const { def, rt } = window;
  const rows: PollRow[] = [];
  const values = rt.values;
  let coveredUntil = -1;

  for (let index = 0; index < def.quantity; index += 1) {
    const raw = def.start + index;
    const display = toDisplayAddress(mode, def.fc as TableFn, raw);
    const alias = def.aliases[raw] ?? "";
    const value = values?.[index] ?? null;

    if (isBitFunction(def.fc)) {
      rows.push({
        raw,
        display,
        alias,
        format: "uint16",
        text: value === null ? "—" : value ? "ON" : "OFF",
        rawValue: value,
        continuation: false,
        writable: def.fc === 1
      });
      continue;
    }

    if (index <= coveredUntil) {
      rows.push({ raw, display, alias, format: "uint16", text: "↳", rawValue: value, continuation: true, writable: false });
      continue;
    }

    const format = def.rowFormats[raw] ?? def.format;
    const size = registersPerValue(format);
    const fits = index + size <= def.quantity;
    let text = "—";

    if (values && fits) {
      text = decodeRegisters(values.slice(index, index + size) as number[], format, def.byteOrder);
    } else if (values && !fits) {
      text = "falta registro";
    }

    if (fits && size > 1) coveredUntil = index + size - 1;
    rows.push({ raw, display, alias, format, text, rawValue: value, continuation: false, writable: def.fc === 3 && fits });
  }

  return rows;
}

export class PollEngine {
  private readonly windows = new Map<string, PollWindowState>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly history = new Map<string, Map<number, TrendPoint[]>>();
  private readonly listeners = new Set<() => void>();
  private readonly actionListeners = new Set<(event: PollActionEvent) => void>();
  private readonly logBuffers = new Map<string, string[]>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private logTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshot: PollWindowState[] = [];
  private nextId = 1;

  constructor(
    private execute: ExecuteFn | null,
    private files: LogFiles | null,
    private addressMode: () => AddressMode = () => "jw"
  ) {}

  setBackend(execute: ExecuteFn | null, files: LogFiles | null): void {
    this.execute = execute;
    this.files = files;
  }

  setAddressModeSource(source: () => AddressMode): void {
    this.addressMode = source;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PollWindowState[] => this.snapshot;

  onAction(listener: (event: PollActionEvent) => void): () => void {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  get(id: string): PollWindowState | undefined {
    return this.windows.get(id);
  }

  add(partial: Partial<PollDefinition> = {}): PollWindowState {
    while (this.windows.has(`w${this.nextId}`)) this.nextId += 1;
    const id = `w${this.nextId++}`;
    const def = { ...defaultPollDefinition(id, partial.unitId ?? 1), ...partial, id };
    const state = { def: sanitize(def), rt: idleRuntime() };
    this.windows.set(id, state);
    this.emit();
    return state;
  }

  update(id: string, patch: Partial<Omit<PollDefinition, "id">>): void {
    const current = this.windows.get(id);
    if (!current) return;
    const def = sanitize({ ...current.def, ...patch });
    const layoutChanged = def.fc !== current.def.fc || def.start !== current.def.start || def.quantity !== current.def.quantity || def.unitId !== current.def.unitId;
    this.windows.set(id, { def, rt: layoutChanged ? { ...current.rt, values: null, status: "idle", message: "Cambió el bloque: se lee de nuevo" } : current.rt });
    if (layoutChanged) this.history.delete(id);
    this.emit();
  }

  remove(id: string): void {
    this.stop(id);
    void this.stopLog(id);
    this.windows.delete(id);
    this.history.delete(id);
    this.emit();
  }

  /** Replaces every window (opening a session). Polling stops. */
  load(definitions: PollDefinition[]): void {
    [...this.windows.keys()].forEach((id) => this.remove(id));
    for (const definition of definitions) {
      const def = sanitize({ ...defaultPollDefinition(definition.id), ...definition });
      this.windows.set(def.id, { def, rt: idleRuntime() });
    }
    this.emit();
  }

  definitions(): PollDefinition[] {
    return [...this.windows.values()].map((window) => structuredClone(window.def));
  }

  stopAll(): void {
    [...this.windows.keys()].forEach((id) => this.stop(id));
  }

  start(id: string): void {
    const window = this.windows.get(id);
    if (!window || window.rt.running) return;
    this.setRuntime(id, { running: true });
    void this.tick(id);
  }

  stop(id: string): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    if (this.windows.get(id)?.rt.running) this.setRuntime(id, { running: false });
  }

  async readOnce(id: string): Promise<void> {
    await this.read(id);
  }

  history_(id: string): Map<number, TrendPoint[]> {
    return this.history.get(id) ?? new Map();
  }

  /**
   * Writes what the user typed at a protocol address of the window: FC5 for
   * a coil, FC6 for one register, FC16 for 32/64-bit values.
   */
  async write(id: string, raw: number, input: string, options: { forceMultiple?: boolean } = {}): Promise<{ ok: boolean; message: string }> {
    const window = this.windows.get(id);
    if (!window || !this.execute) return { ok: false, message: "Sin conexión con el backend" };
    const { def } = window;
    let request: ModbusRequest;

    try {
      if (def.fc === 1) {
        const text = input.trim().toUpperCase();
        const value = ["1", "ON", "TRUE", "SI", "SÍ"].includes(text) ? true : ["0", "OFF", "FALSE", "NO"].includes(text) ? false : null;
        if (value === null) throw new RangeError("Escribe ON u OFF (o 1 y 0)");
        request = options.forceMultiple ? { fc: 15, startAddress: raw, values: [value] } : { fc: 5, address: raw, value };
      } else if (def.fc === 3) {
        const format = def.rowFormats[raw] ?? def.format;
        const registers = encodeValue(input, format, def.byteOrder);
        request = registers.length === 1 && !options.forceMultiple
          ? { fc: 6, address: raw, value: registers[0] }
          : { fc: 16, startAddress: raw, values: registers };
      } else {
        return { ok: false, message: "Esta tabla es de solo lectura" };
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Valor no válido" };
    }

    const at = new Date();
    const result = await this.execute({ unitId: def.unitId, request, timeoutMs: def.timeoutMs });
    const outcome = classify(result);
    this.emitAction({ windowId: id, unitId: def.unitId, request, at, ok: outcome.status === "ok", status: outcome.status, error: result.ok ? undefined : result.error, action: result.ok ? result.value : undefined });

    if (outcome.status === "ok") {
      await this.read(id);
      return { ok: true, message: `Escrito con FC${request.fc}` };
    }

    return { ok: false, message: outcome.message };
  }

  async startLog(id: string): Promise<{ ok: boolean; message: string }> {
    const window = this.windows.get(id);
    if (!window || !this.files) return { ok: false, message: "El registro a archivo solo funciona en la app de escritorio" };
    const header = this.csvHeader(window);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const result = await this.files.saveText({
      text: header,
      defaultFileName: `${window.def.name.replace(/\s+/g, "_")}_${stamp}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
      title: "Registrar lecturas en CSV"
    });
    if (!result.ok) return { ok: false, message: result.error };
    if (result.value.canceled || !result.value.filePath) return { ok: false, message: "Registro cancelado" };
    this.setRuntime(id, { logPath: result.value.filePath, logRows: 0 });
    return { ok: true, message: `Registrando en ${result.value.filePath}` };
  }

  async stopLog(id: string): Promise<void> {
    await this.flushLog(id);
    if (this.windows.get(id)?.rt.logPath) this.setRuntime(id, { logPath: null });
  }

  private csvHeader(window: PollWindowState): string {
    const mode = this.addressMode();
    const rows = pollRows(window, mode).filter((row) => !row.continuation);
    const columns = rows.map((row) => csvCell(row.alias ? `${row.display} ${row.alias}` : String(row.display)));
    return `${["Fecha y hora", ...columns].join(";")}\r\n`;
  }

  private queueLogLine(id: string, window: PollWindowState): void {
    const rows = pollRows(window, this.addressMode()).filter((row) => !row.continuation);
    const cells = rows.map((row) => csvCell(row.text.replace(/^(-?\d+)\.(\d+)$/, "$1,$2")));
    const line = `${[localTimestamp(new Date()), ...cells].join(";")}\r\n`;
    const buffer = this.logBuffers.get(id) ?? [];
    buffer.push(line);
    this.logBuffers.set(id, buffer);
    if (!this.logTimer) {
      this.logTimer = setTimeout(() => {
        this.logTimer = null;
        [...this.logBuffers.keys()].forEach((windowId) => void this.flushLog(windowId));
      }, LOG_FLUSH_MS);
    }
  }

  private async flushLog(id: string): Promise<void> {
    const lines = this.logBuffers.get(id);
    const path = this.windows.get(id)?.rt.logPath;
    this.logBuffers.delete(id);
    if (!lines?.length || !path || !this.files) return;
    const result = await this.files.appendText({ filePath: path, text: lines.join("") });
    const current = this.windows.get(id);
    if (!current) return;
    if (result.ok) this.setRuntime(id, { logRows: current.rt.logRows + lines.length });
    else this.setRuntime(id, { logPath: null, message: `Se detuvo el registro: ${result.error}` });
  }

  private async tick(id: string): Promise<void> {
    const window = this.windows.get(id);
    if (!window?.rt.running) return;
    const started = Date.now();
    await this.read(id);
    const after = this.windows.get(id);
    if (!after?.rt.running) return;
    const wait = Math.max(0, Math.max(MIN_POLL_INTERVAL_MS, after.def.intervalMs) - (Date.now() - started));
    this.timers.set(id, setTimeout(() => void this.tick(id), wait));
  }

  /** One read per window at a time; callers during a read wait for it. */
  private read(id: string): Promise<void> {
    const running = this.inFlight.get(id);
    if (running) return running;
    const promise = this.readNow(id).finally(() => this.inFlight.delete(id));
    this.inFlight.set(id, promise);
    return promise;
  }

  private async readNow(id: string): Promise<void> {
    const window = this.windows.get(id);
    if (!window) return;
    if (!this.execute) {
      this.setRuntime(id, { status: "error", message: "Abre la app de escritorio para leer" });
      return;
    }

    const { def } = window;
    const request: ModbusRequest = { fc: def.fc, startAddress: def.start, quantity: def.quantity };
    this.setRuntime(id, { reading: true });
    const at = new Date();
    const result = await this.execute({ unitId: def.unitId, request, timeoutMs: def.timeoutMs });
    const current = this.windows.get(id);
    if (!current) return;
    const outcome = classify(result);
    const values = result.ok ? result.value.values ?? result.value.registerValues ?? null : null;
    const rt: Partial<PollRuntime> = {
      reading: false,
      status: outcome.status,
      message: outcome.message,
      lastAt: at.toISOString(),
      elapsedMs: result.ok ? result.value.elapsedMs : null,
      reads: current.rt.reads + 1,
      ok: current.rt.ok + (outcome.status === "ok" ? 1 : 0),
      errors: current.rt.errors + (outcome.status === "ok" ? 0 : 1),
      timeouts: current.rt.timeouts + (outcome.status === "timeout" ? 1 : 0)
    };
    if (outcome.status === "ok" && values) rt.values = values;
    this.setRuntime(id, rt);
    this.emitAction({ windowId: id, unitId: def.unitId, request, at, ok: outcome.status === "ok", status: outcome.status, error: result.ok ? undefined : result.error, action: result.ok ? result.value : undefined });

    const updated = this.windows.get(id);
    if (outcome.status === "ok" && updated) {
      this.recordHistory(id, updated, at.getTime());
      if (updated.rt.logPath) this.queueLogLine(id, updated);
    }
  }

  private recordHistory(id: string, window: PollWindowState, at: number): void {
    const perAddress = this.history.get(id) ?? new Map<number, TrendPoint[]>();
    const { def, rt } = window;
    if (!rt.values) return;

    for (let index = 0; index < def.quantity; index += 1) {
      const raw = def.start + index;
      if (!def.charted.includes(raw)) continue;
      let value: number | null;
      if (isBitFunction(def.fc)) value = rt.values[index] ? 1 : 0;
      else {
        const format = def.rowFormats[raw] ?? def.format;
        const size = registersPerValue(format);
        value = index + size <= rt.values.length ? numericValue(rt.values.slice(index, index + size) as number[], format, def.byteOrder) : null;
      }
      if (value === null) continue;
      const points = (perAddress.get(raw) ?? []).filter((point) => at - point.at <= HISTORY_MS);
      points.push({ at, value });
      if (points.length > HISTORY_MAX_POINTS) points.splice(0, points.length - HISTORY_MAX_POINTS);
      perAddress.set(raw, points);
    }

    this.history.set(id, perAddress);
  }

  private setRuntime(id: string, patch: Partial<PollRuntime>): void {
    const current = this.windows.get(id);
    if (!current) return;
    this.windows.set(id, { def: current.def, rt: { ...current.rt, ...patch } });
    this.emit();
  }

  private emitAction(event: PollActionEvent): void {
    this.actionListeners.forEach((listener) => listener(event));
  }

  private emit(): void {
    this.snapshot = [...this.windows.values()];
    this.listeners.forEach((listener) => listener());
  }
}

function classify(result: SerialOperationResult<RtuMasterActionResult>): { status: PollStatus; message: string } {
  if (!result.ok) {
    return /timed\s*out|timeout/i.test(result.error)
      ? { status: "timeout", message: "Sin respuesta (timeout)" }
      : { status: "error", message: result.error };
  }
  const action = result.value;
  if (action.exception) return { status: "exception", message: `Excepción ${action.exception.exceptionCode}: ${action.exception.exceptionName}` };
  if (!action.crcOk) return { status: "crc", message: action.checkError ?? action.summary ?? "Trama inválida" };
  return { status: "ok", message: `OK en ${action.elapsedMs} ms` };
}

function sanitize(def: PollDefinition): PollDefinition {
  const fc = ([1, 2, 3, 4] as const).includes(def.fc) ? def.fc : 3;
  const maxQuantity = isBitFunction(fc) ? 2000 : 125;
  const quantity = clampInt(def.quantity, 1, maxQuantity, 10);
  const start = clampInt(def.start, 0, 0xffff - quantity + 1, 0);
  return {
    ...def,
    fc,
    unitId: clampInt(def.unitId, 0, 255, 1),
    start,
    quantity,
    intervalMs: clampInt(def.intervalMs, MIN_POLL_INTERVAL_MS, 3_600_000, 1000),
    timeoutMs: clampInt(def.timeoutMs, 50, 60_000, 1000),
    rowFormats: { ...def.rowFormats },
    aliases: { ...def.aliases },
    charted: [...new Set(def.charted)].filter((raw) => raw >= start && raw < start + quantity)
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function csvCell(text: string): string {
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function localTimestamp(date: Date): string {
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export const pollEngine = new PollEngine(
  typeof window !== "undefined" && window.jwModbus ? (command) => window.jwModbus!.modbus.execute(command) : null,
  typeof window !== "undefined" && window.jwModbus?.files ? window.jwModbus.files : null
);
