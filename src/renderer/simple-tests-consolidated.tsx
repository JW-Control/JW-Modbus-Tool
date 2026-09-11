import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Activity, AlertTriangle, ListOrdered } from "lucide-react";

export type Fn = "fc1" | "fc2" | "fc3" | "fc4" | "fc5" | "fc6" | "fc15" | "fc16" | "delay";
export type Result = "Pendiente" | "Ejecutando" | "Aprobado" | "Timeout" | "CRC Error" | "Excepcion" | "Validacion fallida" | "Error";
export type ValidationMode = "response" | "count" | "exact" | "byAddress" | "tolerance";
type ScenarioColor = "shield" | "clock" | "warn" | "bad" | "cyan";
type SimulatorState = "Detenido" | "Preparado";

interface StepDetailRow {
  address: number;
  name: string;
  expected: string;
  actual: string;
  type: "bool" | "uint16";
  validation: "OK" | "No coincide" | "Sin criterio";
  ok: boolean;
}

interface TestStep {
  id: string;
  enabled: boolean;
  slave: string;
  fn: Fn;
  address: string;
  quantity: string;
  value: string;
  validationMode: ValidationMode;
  expected: string;
  timeoutMs: string;
  result: Result;
  elapsedMs: number | null;
  detail: string;
  rows: StepDetailRow[];
  values: string;
  at: string;
  historyId?: string;
  dataType?: "Float32" | "UInt16" | "Int16" | "Int32" | "UInt32" | "Hex16" | "Bin16";
}

interface ExecutableStepCommand {
  unitId: number;
  timeoutMs: number;
  address: number;
  quantity: number;
  coilValue?: boolean;
  registerValue?: number;
  coilValues?: boolean[];
  registerValues?: number[];
}

export interface StoredStep {
  enabled: boolean;
  slave: string;
  fn: Fn;
  address: string;
  quantity: string;
  value: string;
  validationMode: ValidationMode;
  expected: string;
  timeoutMs: string;
  dataType?: "Float32" | "UInt16" | "Int16" | "Int32" | "UInt32" | "Hex16" | "Bin16";
}

export interface TestsRunSummary {
  total: number;
  executed: number;
  passed: number;
  failed: number;
  timeouts: number;
  otherFailed: number;
  responsive: number;
  avgMs: number | null;
  lastRunAt: string | null;
}

interface Scenario {
  icon: string;
  name: string;
  desc: string;
  color: ScenarioColor;
  steps?: StoredStep[];
}

interface CumulativeStats {
  executed: number;
  passed: number;
  failed: number;
  timeouts: number;
  responsive: number;
  elapsedMsTotal: number;
}

interface TestsState {
  selectedScenario: string;
  simulatorState: SimulatorState;
  steps: TestStep[];
  scenarios: Record<string, Scenario>;
  running: boolean;
  stopRequested: boolean;
  looping?: boolean;
  managingScenarios: boolean;
  detailIndex: number | null;
  history: TestStep[];
  cumulativeStats?: CumulativeStats;
}

export interface TestsRuntimeState {
  format: "jwmodbus-tests-runtime";
  version: 6;
  savedAt: string;
  selectedScenario: string;
  simulatorState: SimulatorState;
  steps: StoredStep[];
  scenarios: Record<string, Scenario>;
  lastRun: TestsRunSummary;
}

interface TestsViewProps {
  activeSlaveId: number | null;
  port: string;
  baud: number;
  runtimeState: TestsRuntimeState | null;
  resetKey: number;
  onRuntimeStateChange: (state: TestsRuntimeState) => void;
  onMessage: (message: string) => void;
  onSaveSession?: () => void;
  isSessionSaved?: boolean;
}

type LegacyStepFields = {
  id?: string;
  fn?: unknown;
  exp?: unknown;
  amount?: unknown;
  addr?: unknown;
  count?: unknown;
  expectedValue?: unknown;
  to?: unknown;
  timeout?: unknown;
  res?: Result;
  ms?: number | null;
};

const runtimeFormat = "jwmodbus-tests-runtime";

const labels: Record<Fn, string> = {
  fc1: "FC01 Read Coils",
  fc2: "FC02 Read Discrete Inputs",
  fc3: "FC03 Read Holding Registers",
  fc4: "FC04 Read Input Registers",
  fc5: "FC05 Write Single Coil",
  fc6: "FC06 Write Single Register",
  fc15: "FC15 Write Multiple Coils",
  fc16: "FC16 Write Multiple Registers",
  delay: "Retardo (ms)"
};

const functionOrder: Fn[] = ["fc1", "fc2", "fc3", "fc4", "fc5", "fc6", "fc15", "fc16", "delay"];
const readFns = new Set<Fn>(["fc1", "fc2", "fc3", "fc4"]);
const bitFns = new Set<Fn>(["fc1", "fc2", "fc5", "fc15"]);
const defaultScenarioIds = new Set(["normal", "timeout", "crc", "exception"]);

const validationLabels: Record<ValidationMode, string> = {
  response: "Respuesta OK",
  count: "Cantidad solicitada",
  exact: "Valores exactos",
  byAddress: "Por direccion",
  tolerance: "± Tolerancia"
};

const defaultScenarios: Record<string, Scenario> = {
  normal: { icon: "OK", name: "Operacion normal", desc: "Verifica lectura y escritura correcta.", color: "shield" },
  timeout: { icon: "TO", name: "Timeout detectado", desc: "Simula dispositivos no disponibles.", color: "clock" },
  crc: { icon: "CRC", name: "Error CRC detectado", desc: "Introduce errores de CRC en la trama.", color: "warn" },
  exception: { icon: "EX", name: "Excepcion Modbus", desc: "Fuerza codigos de excepcion (01, 02, 03).", color: "bad" }
};

const colorLabels: Record<ScenarioColor, string> = {
  shield: "Verde",
  clock: "Naranja",
  warn: "Amarillo",
  bad: "Rojo",
  cyan: "Azul"
};

function createId() {
  return `step-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isRead(fn: Fn) {
  return readFns.has(fn);
}

function isWrite(fn: Fn) {
  return !readFns.has(fn);
}

function numeric(value: unknown, fallback = 0) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampSlave(value: unknown, fallback = 2) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return String(fallback);
  return String(Math.max(1, Math.min(247, parsed)));
}

function sanitizeNumericText(value: string, maxLength = 8) {
  return value.replace(/[^0-9xXa-fA-F]/g, "").slice(0, maxLength);
}

function defaultAddress(fn: Fn) {
  if (fn === "fc3" || fn === "fc6" || fn === "fc16") return "40000";
  if (fn === "fc4") return "30000";
  if (fn === "fc2") return "10000";
  return "0";
}

function defaultQuantity(fn: Fn) {
  if (fn === "fc1" || fn === "fc2") return "8";
  if (fn === "fc15") return "4";
  if (fn === "fc16") return "3";
  if (fn === "fc4") return "2";
  return "1";
}

function defaultValue(fn: Fn) {
  if (fn === "fc5") return "ON";
  if (fn === "fc6") return "1234";
  if (fn === "fc15") return "1,0,1,0";
  if (fn === "fc16") return "10,20,30";
  if (fn === "delay") return "1000";
  return "";
}

function defaultValidation(fn: Fn): ValidationMode {
  return isRead(fn) ? "count" : "response";
}

function splitValues(value: unknown) {
  return String(value ?? "").split(/[;,\s]+/).map((part) => part.trim()).filter(Boolean);
}

function parseInteger(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} requerido.`);
  const parsed = text.toLowerCase().startsWith("0x") ? Number.parseInt(text, 16) : Number(text);
  if (!Number.isInteger(parsed)) throw new Error(`${label} debe ser un entero decimal o hexadecimal.`);
  return parsed;
}

function parseBoundedInteger(value: unknown, label: string, min: number, max: number) {
  const parsed = parseInteger(value, label);
  if (parsed < min || parsed > max) throw new Error(`${label} debe estar entre ${min} y ${max}.`);
  return parsed;
}

function normalizeBool(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "on", "si", "sí", "yes", "high", "65280", "0xff00", "ff00"].includes(text);
}

function boolText(value: unknown) {
  return normalizeBool(value) ? "ON" : "OFF";
}

function parsePlanCoilValue(value: unknown, label = "Valor de bobina") {
  const text = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "on", "si", "sí", "yes", "high", "65280", "0xff00", "ff00"].includes(text)) return true;
  if (["0", "false", "off", "no", "low", "0x0000", "0000"].includes(text)) return false;
  throw new Error(`${label} invalido. Usa ON/OFF o 1/0.`);
}

function parseBoolList(value: unknown) {
  const tokens = splitValues(value);
  if (tokens.length === 0) throw new Error("Valor de bobinas requerido. Usa ON/OFF o 1/0 separados por coma.");
  return tokens.map((token, index) => parsePlanCoilValue(token, `Valor de bobina ${index + 1}`));
}

function parseRegisterList(value: unknown) {
  const tokens = splitValues(value);
  if (tokens.length === 0) throw new Error("Valor de registros requerido. Usa enteros separados por coma.");
  return tokens.map((token, index) => parseBoundedInteger(token, `Valor ${index + 1}`, 0, 0xffff));
}

export function parsePlanCoilValues(value: unknown) {
  return parseBoolList(value);
}

export function parsePlanRegisterValues(value: unknown) {
  return parseRegisterList(value);
}


function getModbusOffset(address: string | number): number {
  const n = Number(address);
  if (!Number.isFinite(n)) return 0;
  if (n >= 40001) return n - 40001;
  if (n >= 30001) return n - 30001;
  if (n >= 10001) return n - 10001;
  if (n >= 1) return n - 1;
  return 0;
}

function bitDecimal(bits: boolean[], limit = 16): number {
  let value = 0;
  for (let index = 0; index < Math.min(limit, bits.length); index += 1) {
    if (bits[index]) value |= (1 << index);
  }
  return value;
}

function boolListText(bits: boolean[]) {
  return bits.map((bit) => bit ? "1" : "0").join(" ");
}

function bitRowsValue(rows: StepDetailRow[], field: "expected" | "actual") {
  return boolListText(rows.filter((row) => row.type === "bool").map((row) => normalizeBool(row[field])));
}

function hasBitRows(step: TestStep) {
  return step.rows.some((row) => row.type === "bool");
}

function bitAddressLabel(fn: Fn, startAddress: string, index: number) {
  const address = displayAddress(fn, numeric(startAddress, 0), index);
  return String(address).padStart(5, "0");
}

function bitEditorCopy(fn: Fn, field: "value" | "expected") {
  if (fn === "fc2") {
    return {
      title: "Editar entradas",
      description: field === "expected"
        ? "Define el patron esperado para las entradas discretas FC02."
        : "Visualizacion de entradas discretas FC02."
    };
  }
  if (fn === "fc1") {
    return {
      title: "Editar coils",
      description: field === "expected"
        ? "Define el patron esperado para los coils FC01."
        : "Visualizacion de coils FC01."
    };
  }
  return {
    title: "Editar bobinas",
    description: "Define el patron de bobinas para FC15 Write Multiple Coils."
  };
}

function rawAddress(fn: Fn, address: number) {
  if ((fn === "fc3" || fn === "fc6" || fn === "fc16") && address >= 40000) return address - 40000;
  if (fn === "fc4" && address >= 30000) return address - 30000;
  if (fn === "fc2" && address >= 10000) return address - 10000;
  return address;
}

function displayAddress(fn: Fn, base: number, index = 0) {
  const value = base + index;
  if (fn === "fc3" || fn === "fc6" || fn === "fc16") return value >= 40000 ? value : 40000 + value;
  if (fn === "fc4") return value >= 30000 ? value : 30000 + value;
  if (fn === "fc2") return value >= 10000 ? value : 10000 + value;
  return value;
}

function validateAddressWindow(address: number, quantity: number) {
  if (address < 0 || address > 0xffff) throw new Error("Direccion Modbus fuera de rango 0..65535.");
  if (address + quantity - 1 > 0xffff) throw new Error("El rango direccion + cantidad supera 65535.");
}

function maxReadQuantity(fn: Fn) {
  return fn === "fc1" || fn === "fc2" ? 2000 : 125;
}

function countFor(step: Pick<TestStep, "fn" | "quantity" | "value">) {
  if (isRead(step.fn)) return Math.max(1, numeric(step.quantity, 1));
  if (step.fn === "fc15") return Math.max(1, splitValues(step.value).length);
  if (step.fn === "fc16") return Math.max(1, splitValues(step.value).length);
  return 1;
}

function expectedAutoText(step: Pick<TestStep, "fn" | "quantity" | "value" | "validationMode" | "expected">) {
  if (step.validationMode === "response") return "OK";
  if (step.validationMode === "tolerance") return step.expected || "25.50 ± 0.10";
  if (step.validationMode === "count") {
    const suffix = step.fn === "fc1" ? "coils" : step.fn === "fc2" ? "bits" : "regs";
    return `${countFor(step)} ${suffix}`;
  }
  return step.expected;
}

function inferValidation(fn: Fn, expected: unknown): ValidationMode {
  const text = String(expected ?? "").trim();
  if (!text) return defaultValidation(fn);
  if (/^ok$/i.test(text)) return "response";
  if (/^\d+\s*(regs?|coils?|bits?)$/i.test(text)) return "count";
  if (text.includes("±") || text.includes("+/-")) return "tolerance";
  if (text.includes("=")) return "byAddress";
  return "exact";
}

function inferExpected(expected: unknown) {
  const text = String(expected ?? "").trim();
  if (!text || /^ok$/i.test(text) || /^\d+\s*(regs?|coils?|bits?)$/i.test(text)) return "";
  return text;
}

function normalizeStep(input: Partial<TestStep> & Partial<StoredStep> & LegacyStepFields, defaultSlave = 2): TestStep {
  const fn = functionOrder.includes(input.fn as Fn) ? input.fn as Fn : "fc3";
  const validationMode = input.validationMode && validationLabels[input.validationMode] ? input.validationMode : inferValidation(fn, input.exp);
  return {
    id: input.id || createId(),
    enabled: input.enabled !== false,
    slave: clampSlave(input.slave, defaultSlave),
    fn,
    address: String(input.address ?? input.addr ?? defaultAddress(fn)),
    quantity: String(input.quantity ?? input.count ?? (isRead(fn) ? input.amount ?? defaultQuantity(fn) : defaultQuantity(fn))),
    value: String(input.value ?? (isWrite(fn) ? input.amount ?? defaultValue(fn) : "")),
    validationMode,
    expected: String(input.expected ?? input.expectedValue ?? inferExpected(input.exp)),
    timeoutMs: String(input.timeoutMs ?? input.to ?? input.timeout ?? 1000),
    result: input.result || input.res || "Pendiente",
    elapsedMs: input.elapsedMs ?? input.ms ?? null,
    detail: input.detail || "",
    rows: Array.isArray(input.rows) ? input.rows : [],
    values: input.values || "",
    at: input.at || "",
    dataType: input.dataType || (String(input.expected || "").includes(".") ? "Float32" : (Number(input.quantity) === 1 ? "UInt16" : undefined))
  };
}

function resetExecution(step: TestStep): TestStep {
  return { ...normalizeStep(step), result: "Pendiente", elapsedMs: null, detail: "", rows: [], values: "", at: "" };
}

function stripStep(step: TestStep | StoredStep): StoredStep {
  const normalized = normalizeStep(step);
  return {
    enabled: normalized.enabled,
    slave: normalized.slave,
    fn: normalized.fn,
    address: normalized.address,
    quantity: normalized.quantity,
    value: normalized.value,
    validationMode: normalized.validationMode,
    expected: normalized.expected,
    timeoutMs: normalized.timeoutMs,
    dataType: normalized.dataType
  };
}

function createStep(defaultSlave: number, fn: Fn, address: string, quantity: string, value: string, validationMode = defaultValidation(fn), expected = "", timeoutMs = "1000") {
  return normalizeStep({ enabled: true, slave: String(defaultSlave), fn, address, quantity, value, validationMode, expected, timeoutMs }, defaultSlave);
}

function defaultPlan(defaultSlave = 2) {
  return [
    createStep(defaultSlave, "fc6", "40000", "1", "1234", "response"),
    createStep(defaultSlave, "fc3", "40000", "1", "", "exact", "1234"),
    createStep(defaultSlave, "fc5", "0", "1", "ON", "response"),
    createStep(defaultSlave, "fc15", "0", "4", "1,0,1,0", "response"),
    createStep(defaultSlave, "fc16", "40020", "3", "10,20,30", "response"),
    createStep(defaultSlave, "fc4", "30000", "8", "", "count"),
    createStep(defaultSlave, "fc1", "0", "8", "", "count"),
    createStep(defaultSlave, "fc2", "0", "8", "", "count")
  ];
}

function alternateSlave(defaultSlave = 2) {
  return defaultSlave === 1 ? 247 : 1;
}

function timeoutPlan(defaultSlave = 2) {
  return defaultPlan(alternateSlave(defaultSlave)).map((step) => resetExecution({ ...step, timeoutMs: "1000" }));
}

function crcDiagnosticPlan(defaultSlave = 2) {
  return defaultPlan(defaultSlave).map((step, index) => index === 1 ? resetExecution({ ...step, validationMode: "exact", expected: "65535" }) : step);
}

function exceptionPlan(defaultSlave = 2) {
  return [
    createStep(defaultSlave, "fc3", "105535", "1", "", "response"),
    createStep(defaultSlave, "fc4", "95535", "1", "", "response"),
    createStep(defaultSlave, "fc1", "65535", "1", "", "response"),
    createStep(defaultSlave, "fc2", "75535", "1", "", "response"),
    createStep(defaultSlave, "fc6", "105535", "1", "1234", "response"),
    createStep(defaultSlave, "fc5", "65535", "1", "ON", "response")
  ];
}

function scenarioPlan(id: string, defaultSlave = 2) {
  if (id === "timeout") return timeoutPlan(defaultSlave);
  if (id === "crc") return crcDiagnosticPlan(defaultSlave);
  if (id === "exception") return exceptionPlan(defaultSlave);
  return defaultPlan(defaultSlave);
}

export function createScenarioPlan(id: string, defaultSlave = 2): StoredStep[] {
  return scenarioPlan(id, defaultSlave).map(stripStep);
}

function scenarioSteps(id: string, scenario: Scenario | undefined, defaultSlave: number) {
  const source = scenario?.steps?.length ? scenario.steps : createScenarioPlan(id, defaultSlave);
  return source.map((step) => resetExecution(normalizeStep(step, defaultSlave)));
}

function normalizeScenario(input: Partial<Scenario> | undefined, fallback = defaultScenarios.normal): Scenario {
  return {
    icon: String(input?.icon ?? fallback.icon ?? "OK").slice(0, 6),
    name: String(input?.name ?? fallback.name ?? "Escenario"),
    desc: String(input?.desc ?? fallback.desc ?? "Escenario de prueba."),
    color: input?.color && colorLabels[input.color] ? input.color : fallback.color,
    steps: Array.isArray(input?.steps) ? input.steps.map(stripStep) : undefined
  };
}

function normalizeScenarios(input: unknown): Record<string, Scenario> {
  const result: Record<string, Scenario> = clone(defaultScenarios);
  if (!input || typeof input !== "object") return result;
  for (const [key, value] of Object.entries(input as Record<string, Scenario>)) {
    const safeKey = defaultScenarioIds.has(key) ? key : key.replace(/[^\w-]/g, "_") || `custom_${Date.now()}`;
    result[safeKey] = normalizeScenario(value, result[safeKey]);
  }
  return result;
}

function isFinalResult(result: Result) {
  return result !== "Pendiente" && result !== "Ejecutando";
}

function isResponsiveResult(result: Result) {
  return isFinalResult(result) && result !== "Timeout" && result !== "Error";
}

function blankRunSummary(total = 0): TestsRunSummary {
  return { total, executed: 0, passed: 0, failed: 0, timeouts: 0, otherFailed: 0, responsive: 0, avgMs: null, lastRunAt: null };
}

function boundedCount(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed);
}

export function summarizeTestsRun(steps: Array<{ enabled?: boolean; result?: Result; elapsedMs?: number | null; at?: string }>): TestsRunSummary {
  const active = steps.filter((step) => step.enabled !== false);
  const executed = active.filter((step) => step.result && isFinalResult(step.result));
  const responsive = executed.filter((step) => step.result && isResponsiveResult(step.result) && step.elapsedMs != null);
  const passed = executed.filter((step) => step.result === "Aprobado").length;
  const failed = executed.filter((step) => step.result !== "Aprobado").length;
  const timeouts = executed.filter((step) => step.result === "Timeout").length;
  const otherFailed = Math.max(0, failed - timeouts);
  const avgMs = responsive.length ? Math.round(responsive.reduce((sum, step) => sum + (step.elapsedMs ?? 0), 0) / responsive.length) : null;
  const lastRunAt = [...executed].reverse().find((step) => step.at)?.at ?? null;
  return { total: active.length, executed: executed.length, passed, failed, timeouts, otherFailed, responsive: responsive.length, avgMs, lastRunAt };
}

function normalizeTestsRunSummary(input: unknown, total: number): TestsRunSummary {
  if (!input || typeof input !== "object") return blankRunSummary(total);
  const source = input as Partial<TestsRunSummary>;
  const executed = boundedCount(source.executed, 0);
  const failed = boundedCount(source.failed, 0);
  const timeouts = boundedCount(source.timeouts, 0);
  return {
    total: boundedCount(source.total, total),
    executed,
    passed: boundedCount(source.passed, 0),
    failed,
    timeouts,
    otherFailed: boundedCount(source.otherFailed, Math.max(0, failed - timeouts)),
    responsive: boundedCount(source.responsive, 0),
    avgMs: source.avgMs == null ? null : boundedCount(source.avgMs, 0),
    lastRunAt: typeof source.lastRunAt === "string" ? source.lastRunAt : null
  };
}

export function normalizeTestsRuntimeState(data: unknown, defaultSlave = 2): TestsRuntimeState | null {
  const source = (data as any)?.format === runtimeFormat ? data as TestsRuntimeState : (data as any)?.testsRuntime;
  if (!source || source.format !== runtimeFormat || !Array.isArray(source.steps)) return null;
  const steps = source.steps as Array<Partial<TestStep> & Partial<StoredStep> & LegacyStepFields>;
  const normalizedSteps = steps.map((step) => stripStep(normalizeStep(step, defaultSlave)));
  const scenarios = normalizeScenarios(source.scenarios);
  const selectedScenario = scenarios[source.selectedScenario] ? source.selectedScenario : "normal";
  return {
    format: runtimeFormat,
    version: 6,
    savedAt: new Date().toISOString(),
    selectedScenario,
    simulatorState: source.simulatorState === "Preparado" ? "Preparado" : "Detenido",
    steps: normalizedSteps,
    scenarios,
    lastRun: normalizeTestsRunSummary(source.lastRun, normalizedSteps.length)
  };
}

function createInitialState(runtimeState: TestsRuntimeState | null, defaultSlave: number): TestsState {
  const runtime = normalizeTestsRuntimeState(runtimeState, defaultSlave);
  const scenarios = runtime?.scenarios ?? clone(defaultScenarios);
  const selectedScenario = runtime?.selectedScenario ?? "normal";
  return {
    selectedScenario,
    simulatorState: runtime?.simulatorState ?? "Detenido",
    steps: runtime?.steps.length ? runtime.steps.map((step) => resetExecution(normalizeStep(step, defaultSlave))) : scenarioSteps(selectedScenario, scenarios[selectedScenario], defaultSlave),
    scenarios,
    running: false,
    stopRequested: false,
    managingScenarios: false,
    detailIndex: null,
    history: []
  };
}

function exportRuntimeState(state: TestsState): TestsRuntimeState {
  return {
    format: runtimeFormat,
    version: 6,
    savedAt: new Date().toISOString(),
    selectedScenario: state.selectedScenario,
    simulatorState: state.simulatorState,
    steps: state.steps.map(stripStep),
    scenarios: Object.fromEntries(Object.entries(state.scenarios).map(([key, scenario]) => [key, normalizeScenario(scenario)])),
    lastRun: summarizeTestsRun(state.steps)
  };
}

function registerName(fn: Fn, address: number) {
  if (fn === "fc1" || fn === "fc5" || fn === "fc15") return `Q0_${rawAddress(fn, address)}`;
  if (fn === "fc2") return `I0_${rawAddress(fn, address)}`;
  const names: Record<number, string> = {
    40000: "Velocidad_Ref (RPM)",
    40001: "Estado_Variador",
    40002: "Corriente_Salida (A)",
    40003: "Tension_DC (V)",
    40004: "Temp_Disipador (C)",
    40005: "Horas_Marcha (h)",
    30000: "Input_Reg_0",
    30001: "Input_Reg_1",
    30002: "Input_Reg_2"
  };
  return names[address] || `Reg_${address}`;
}

function expectedByAddress(step: TestStep) {
  const map = new Map<number, string>();
  if (step.validationMode !== "byAddress") return map;
  for (const part of step.expected.split(/[;,]+/)) {
    const [left, right] = part.split("=").map((value) => value?.trim());
    const address = Number(left);
    if (Number.isFinite(address) && right != null) map.set(address, right);
  }
  return map;
}

function expectedSequence(step: TestStep) {
  return step.validationMode === "exact" ? splitValues(step.expected) : [];
}

function sameValue(actual: string, expected: string, isBit: boolean) {
  if (!expected || expected === "-") return true;
  if (isBit) return normalizeBool(actual) === normalizeBool(expected);
  return Number(actual) === Number(expected);
}

function extractValues(action: any, register = false): unknown[] {
  const candidates = register
    ? [action?.registerValues, action?.values, action?.data, action?.response?.registerValues, action?.response?.values, action?.response?.data]
    : [action?.values, action?.registerValues, action?.data, action?.response?.values, action?.response?.registerValues, action?.response?.data];
  const found = candidates.find(Array.isArray);
  return Array.isArray(found) ? found : [];
}

function buildRows(step: TestStep, action: any): StepDetailRow[] {
  const rows: StepDetailRow[] = [];
  const isBit = bitFns.has(step.fn);
  const byAddress = expectedByAddress(step);
  const sequence = expectedSequence(step);
  const quantity = countFor(step);
  let actualValues: unknown[] = [];

  if (step.fn === "fc1" || step.fn === "fc2") actualValues = extractValues(action, false);
  if (step.fn === "fc3" || step.fn === "fc4") actualValues = extractValues(action, true);
  if (step.fn === "fc5") actualValues = [normalizeBool(step.value)];
  if (step.fn === "fc6") actualValues = [numeric(step.value, 0)];
  if (step.fn === "fc15") actualValues = parseBoolList(step.value);
  if (step.fn === "fc16") actualValues = parseRegisterList(step.value);

  const total = isRead(step.fn) ? Math.max(quantity, actualValues.length) : actualValues.length;
  for (let index = 0; index < total; index += 1) {
    const address = displayAddress(step.fn, numeric(step.address), index);
    const actual = isBit ? boolText(actualValues[index]) : String(actualValues[index] ?? "");
    const expected = byAddress.get(address) ?? sequence[index] ?? "";
    const hasCriterion = (step.validationMode === "exact" || step.validationMode === "byAddress") && Boolean(expected);
    const ok = hasCriterion ? sameValue(actual, expected, isBit) : true;
    rows.push({
      address,
      name: registerName(step.fn, address),
      expected: hasCriterion ? expected : "-",
      actual: actual || "-",
      type: isBit ? "bool" : "uint16",
      validation: hasCriterion ? (ok ? "OK" : "No coincide") : "Sin criterio",
      ok
    });
  }
  return rows;
}

function validateStep(step: TestStep, action: any, rows: StepDetailRow[]) {
  if (action?.exception) return { result: "Excepcion" as Result, detail: action.exception.exceptionName || "Excepcion Modbus." };
  if (action && action.crcOk === false) return { result: "CRC Error" as Result, detail: "La respuesta fue marcada como CRC invalido." };
  if (step.validationMode === "response") return { result: "Aprobado" as Result, detail: "Respuesta Modbus recibida correctamente." };
  if (step.validationMode === "count") {
    const expected = countFor(step);
    const received = step.fn === "fc1" || step.fn === "fc2"
      ? extractValues(action, false).length
      : step.fn === "fc3" || step.fn === "fc4"
        ? extractValues(action, true).length
        : expected;
    const ok = received >= expected;
    return {
      result: ok ? "Aprobado" as Result : "Validacion fallida" as Result,
      detail: ok ? `${expected} valor(es) recibidos correctamente.` : `Se esperaban ${expected} valor(es) y llegaron ${received}.`
    };
  }
  if ((step.validationMode === "exact" || step.validationMode === "byAddress") && !rows.some((row) => row.expected !== "-")) {
    return { result: "Validacion fallida" as Result, detail: "Define al menos un valor esperado para validar." };
  }
  const allOk = rows.every((row) => row.ok);
  return {
    result: allOk ? "Aprobado" as Result : "Validacion fallida" as Result,
    detail: allOk ? "Validacion de valores OK." : "Uno o mas valores no coinciden con lo esperado."
  };
}

function validateExecutableStep(step: TestStep): ExecutableStepCommand {
  const unitId = parseBoundedInteger(step.slave, "Slave", 1, 247);
  const timeoutMs = parseBoundedInteger(step.timeoutMs, "Timeout", 50, 60000);
  const address = rawAddress(step.fn, parseInteger(step.address, "Direccion"));

  if (isRead(step.fn)) {
    const quantity = parseBoundedInteger(step.quantity, "Cantidad", 1, maxReadQuantity(step.fn));
    validateAddressWindow(address, quantity);
    return { unitId, timeoutMs, address, quantity };
  }

  if (step.fn === "fc5") {
    validateAddressWindow(address, 1);
    return { unitId, timeoutMs, address, quantity: 1, coilValue: parsePlanCoilValue(step.value) };
  }
  if (step.fn === "fc6") {
    validateAddressWindow(address, 1);
    return { unitId, timeoutMs, address, quantity: 1, registerValue: parseBoundedInteger(step.value, "Valor de registro", 0, 0xffff) };
  }
  if (step.fn === "fc15") {
    const coilValues = parseBoolList(step.value);
    if (coilValues.length > 1968) throw new Error("FC15 permite maximo 1968 bobinas.");
    validateAddressWindow(address, coilValues.length);
    return { unitId, timeoutMs, address, quantity: coilValues.length, coilValues };
  }
  if (step.fn === "fc16") {
    const registerValues = parseRegisterList(step.value);
    if (registerValues.length > 123) throw new Error("FC16 permite maximo 123 registros.");
    validateAddressWindow(address, registerValues.length);
    return { unitId, timeoutMs, address, quantity: registerValues.length, registerValues };
  }
  throw new Error("Funcion Modbus no soportada.");
}

function unwrapModbusActionResult(action: any) {
  if (!action || typeof action !== "object" || typeof action.ok !== "boolean") return action;
  if (!action.ok) throw new Error(action.error || "Error de comunicacion Modbus.");
  return action.value;
}

export function classifyStepErrorResult(message: string): Result {
  return /timeout|timed\s+out|time\s*-?\s*out/i.test(message) ? "Timeout" : "Error";
}

async function executeStep(step: TestStep) {
  if (step.fn === "delay") {
    const ms = parseInt(step.value) || 1000;
    await new Promise(resolve => setTimeout(resolve, ms));
    const at = new Date().toLocaleTimeString("es-PE", { hour12: false });
    return { ...step, result: "Aprobado" as Result, detail: `Retardo completado en ${ms} ms.`, at, elapsedMs: ms, rows: [] };
  }

  const modbus = window.jwModbus?.modbus;
  if (!modbus) throw new Error("Backend Modbus no disponible.");

  const command = validateExecutableStep(step);
  const started = performance.now();
  const base = { unitId: command.unitId, timeoutMs: command.timeoutMs };
  const address = command.address;
  let action: any;

  if (step.fn === "fc1") action = await modbus.readCoils({ ...base, startAddress: address, quantity: command.quantity });
  else if (step.fn === "fc2") action = await modbus.readDiscreteInputs({ ...base, startAddress: address, quantity: command.quantity });
  else if (step.fn === "fc3") action = await modbus.readHoldingRegisters({ ...base, startAddress: address, quantity: command.quantity });
  else if (step.fn === "fc4") action = await modbus.readInputRegisters({ ...base, startAddress: address, quantity: command.quantity });
  else if (step.fn === "fc5") action = await modbus.writeSingleCoil({ ...base, address, value: command.coilValue ?? false });
  else if (step.fn === "fc6") action = await modbus.writeSingleRegister({ ...base, address, value: command.registerValue ?? 0 });
  else if (step.fn === "fc15") action = await modbus.writeMultipleCoils({ ...base, startAddress: address, values: command.coilValues ?? [] });
  else if (step.fn === "fc16") action = await modbus.writeMultipleRegisters({ ...base, startAddress: address, values: command.registerValues ?? [] });

  const payload = unwrapModbusActionResult(action);
  const rows = buildRows(step, payload);
  const validation = validateStep(step, payload, rows);
  const elapsedMs = Math.round(payload?.elapsedMs ?? performance.now() - started);
  const at = new Date().toLocaleTimeString("es-PE", { hour12: false });

  return {
    ...step,
    result: validation.result,
    elapsedMs,
    detail: validation.detail,
    rows,
    values: rows.map((row) => `${row.address}=${row.actual}`).join(", "),
    at
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function executionCsv(steps: TestStep[]) {
  const header = ["Hora", "Paso", "Slave", "Funcion", "Direccion", "Cantidad", "Valor", "Validacion", "Esperado", "Resultado", "Tiempo ms", "Detalle", "Valores"];
  const rows = steps.map((step, index) => [
    step.at || "",
    index + 1,
    step.slave,
    labels[step.fn],
    step.address,
    isRead(step.fn) ? countFor(step) : "",
    isRead(step.fn) ? "" : step.value,
    validationLabels[step.validationMode],
    expectedAutoText(step),
    step.result,
    step.elapsedMs ?? "",
    step.detail || "Pendiente de ejecucion.",
    step.values || step.rows.map((row) => `${row.address}=${row.actual}`).join("; ")
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}


function historyStatusFromResult(result: Result) {
  if (result === "Aprobado") return "OK";
  if (result === "Timeout") return "Timeout";
  if (result === "CRC Error") return "CRC Error";
  if (result === "Excepcion") return "Excepción";
  return "Error";
}

function dispatchTestsRunCompleted(steps: TestStep[], stopped: boolean) {
  const executed = steps.filter((step) => step.enabled && isFinalResult(step.result));
  if (!executed.length) return;

  const runId = "run-" + Date.now() + "-" + Math.round(Math.random() * 100000);
  const completedAt = new Date().toISOString();

  const entries = executed.map((step, index) => {
    const functionCode = labels[step.fn].match(/FC\d{2}/)?.[0] ?? step.fn.toUpperCase();
    const status = historyStatusFromResult(step.result);
    const quantity = countFor(step);
    const values = step.rows.length
      ? step.rows.map((row) => row.actual).filter((value) => value && value !== "-")
      : splitValues(isRead(step.fn) ? step.values : step.value);

    return {
      id: "test-run-" + runId + "-" + (index + 1),
      key: [runId, index + 1, step.slave, functionCode, step.address, step.result].join("|"),
      runId,
      step: index + 1,
      startedAt: completedAt,
      completedAt,
      elapsedMs: step.elapsedMs,
      source: "Pruebas",
      role: "PC Master",
      method: functionCode,
      functionCode,
      functionLabel: labels[step.fn],
      unitId: Number(step.slave),
      address: Number(step.address),
      quantity,
      values,
      timeoutMs: numeric(step.timeoutMs, 1000),
      status,
      summary: step.detail || step.result,
      response: null,
      error: status === "OK" ? null : (step.detail || step.result)
    };
  });

  window.dispatchEvent(new CustomEvent("jw-simple-tests-run-completed", {
    detail: {
      runId,
      completedAt,
      stopped,
      total: entries.length,
      entries
    }
  }));
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob(["\ufeff", content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function TestsView({ activeSlaveId, port, baud, runtimeState, resetKey, onRuntimeStateChange, onMessage, onSaveSession, isSessionSaved }: TestsViewProps) {
  const defaultSlave = activeSlaveId ?? 2;
  const [state, setState] = useState<TestsState>(() => createInitialState(runtimeState, defaultSlave));
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const shiftAnchorRef = useRef<number | null>(null);
  const shouldCenterOnArrowRef = useRef(false);
  const [undoStack, setUndoStack] = useState<TestStep[][]>([]);
  const [redoStack, setRedoStack] = useState<TestStep[][]>([]);
  const [editingBits, setEditingBits] = useState<{ index: number; field: "value" | "expected" } | null>(null);
  const [editingRegisters, setEditingRegisters] = useState<{ index: number } | null>(null);
  const [editingFc04, setEditingFc04] = useState<{ index: number } | null>(null);
  const [editingFc06, setEditingFc06] = useState<{ index: number } | null>(null);

  function pushHistory(newSteps: TestStep[]) {
    setUndoStack(curr => [...curr, state.steps].slice(-50));
    setRedoStack([]);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(curr => curr.slice(0, -1));
    setRedoStack(curr => [...curr, state.steps].slice(-50));
    setState(s => ({ ...s, steps: prev }));
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(curr => curr.slice(0, -1));
    setUndoStack(curr => [...curr, state.steps].slice(-50));
    setState(s => ({ ...s, steps: next }));
  }

  function handleRowClick(index: number, e: React.MouseEvent) {
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const newSelection = [];
      for (let i = start; i <= end; i++) newSelection.push(i);
      setSelectedRows(newSelection);
    } else if (e.ctrlKey || e.metaKey) {
      if (selectedRows.includes(index)) {
        setSelectedRows(selectedRows.filter(r => r !== index));
      } else {
        setSelectedRows([...selectedRows, index]);
      }
      setLastSelectedIndex(index);
    } else {
      setSelectedRows([index]);
      setLastSelectedIndex(index);
    }
  }

  
  useEffect(() => {
    if (shouldCenterOnArrowRef.current && lastSelectedIndex !== null) {
      shouldCenterOnArrowRef.current = false;
      const row = document.querySelector(`.testsPlanTable tbody tr:nth-child(${lastSelectedIndex + 1})`);
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [lastSelectedIndex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const table = document.querySelector('.testsPlanTable');
      if (table && !table.contains(e.target as Node)) {
        setSelectedRows([]);
        setLastSelectedIndex(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedRows.length === 1) {
      const step = state.steps[selectedRows[0]];
      if (!step) return;
      let desc = "";
      switch (step.fn) {
        case "fc1": desc = "FC01 (Read Coils): Lee salidas digitales desde el PLC. En Dato/Valor configura los LEDs que esperas recibir."; break;
        case "fc2": desc = "FC02 (Read Discrete Inputs): Lee entradas físicas. Solo lectura. Configura qué patrón de LEDs esperas leer."; break;
        case "fc3": desc = "FC03 (Read Holding Registers): Lee registros internos. Usa el lápiz (✎) para configurar qué valores exactos esperas."; break;
        case "fc4": desc = "FC04 (Read Input Registers): Lee registros analógicos. Configura el valor exacto y un margen de tolerancia (±)."; break;
        case "fc5": desc = "FC05 (Write Single Coil): Escribe una única bobina. Usa el switch ON/OFF para forzar su estado en el PLC."; break;
        case "fc6": desc = "FC06 (Write Single Register): Escribe un registro interno. Introduce el número (0-65535) a enviar."; break;
        case "fc15": desc = "FC15 (Write Multiple Coils): Escribe múltiples salidas a la vez. Define el patrón de LEDs que inyectarás."; break;
        case "fc16": desc = "FC16 (Write Multiple Registers): Escribe una secuencia de valores numéricos en registros consecutivos (ej. 10, 20, 30)."; break;
        case "delay": desc = "Retardo: Pausa la ejecución de la prueba durante el tiempo configurado (en ms) sin enviar comandos."; break;
      }
      onMessage(desc);
    } else if (selectedRows.length > 1) {
      onMessage(`Has seleccionado ${selectedRows.length} pasos.`);
    } else {
      onMessage("Selecciona un paso de la tabla para ver cómo funciona.");
    }
  }, [selectedRows, state.steps, onMessage]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

            if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('clear-drag-lines'));
        e.preventDefault();
        setSelectedRows([]);
        setLastSelectedIndex(null);
        return;
      }
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedRows(state.steps.map((_, i) => i));
        return;
      }

      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }

      
      // Alt + Arrows to move items
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (selectedRows.length === 0) return;
        const sorted = [...selectedRows].sort((a,b)=>a-b);
        const direction = e.key === 'ArrowUp' ? -1 : 1;
        if (direction === -1 && sorted[0] === 0) return;
        if (direction === 1 && sorted[sorted.length - 1] === state.steps.length - 1) return;
        
        const nextSteps = [...state.steps];
        const newSelection = [];
        
        if (direction === -1) {
          for (const idx of sorted) {
            const temp = nextSteps[idx - 1];
            nextSteps[idx - 1] = nextSteps[idx];
            nextSteps[idx] = temp;
            newSelection.push(idx - 1);
          }
        } else {
          for (let i = sorted.length - 1; i >= 0; i--) {
            const idx = sorted[i];
            const temp = nextSteps[idx + 1];
            nextSteps[idx + 1] = nextSteps[idx];
            nextSteps[idx] = temp;
            newSelection.push(idx + 1);
          }
        }
        pushHistory(nextSteps);
        setState(s => ({ ...s, steps: nextSteps }));
        setSelectedRows(newSelection.sort((a,b)=>a-b));
        shouldCenterOnArrowRef.current = true;
        if (lastSelectedIndex !== null) setLastSelectedIndex(lastSelectedIndex + direction);
        return;
      }

      // Shift + Arrows

      if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (lastSelectedIndex === null) return;
        // Ensure anchor is set before first shift+arrow
        if (shiftAnchorRef.current === null) shiftAnchorRef.current = lastSelectedIndex;
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(state.steps.length - 1, lastSelectedIndex + 1)
          : Math.max(0, lastSelectedIndex - 1);
        // Build contiguous range from fixed anchor to new cursor
        const anchor = shiftAnchorRef.current;
        const rangeStart = Math.min(anchor, nextIndex);
        const rangeEnd = Math.max(anchor, nextIndex);
        const newSel: number[] = [];
        for (let ri = rangeStart; ri <= rangeEnd; ri++) newSel.push(ri);
        setSelectedRows(newSel);
        shouldCenterOnArrowRef.current = true;
        setLastSelectedIndex(nextIndex);
        return;
      } else if (!e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        let nextIndex = 0;
        if (lastSelectedIndex !== null) {
          nextIndex = e.key === 'ArrowDown' ? Math.min(state.steps.length - 1, lastSelectedIndex + 1) : Math.max(0, lastSelectedIndex - 1);
        }
        setSelectedRows([nextIndex]);
        shouldCenterOnArrowRef.current = true;
        setLastSelectedIndex(nextIndex);
        shiftAnchorRef.current = nextIndex; // reset anchor on non-shift navigation
        return;
      }

      if (e.ctrlKey && e.key === 'c' && selectedRows.length > 0) {
        e.preventDefault();
        const toCopy = [...selectedRows].sort((a, b) => a - b).map(idx => stripStep(state.steps[idx]));
        navigator.clipboard.writeText(JSON.stringify({ __jwmodbus_test_multi: true, data: toCopy }));
      }
      else if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          try {
            const parsed = JSON.parse(text);
            const toInsert = parsed.__jwmodbus_test_multi ? parsed.data : (parsed.__jwmodbus_test ? [parsed.data] : null);
            if (toInsert && Array.isArray(toInsert)) {
              const newSteps = toInsert.map(d => {
                const s = createStep(defaultSlave, d.fn, d.address, d.quantity, d.value, d.validationMode);
                s.expected = d.expected || "";
                s.timeoutMs = d.timeoutMs || 1000;
                return s;
              });
              const nextSteps = [...state.steps];
              const insertAt = selectedRows.length > 0 ? Math.max(...selectedRows) + 1 : nextSteps.length;
              nextSteps.splice(insertAt, 0, ...newSteps);
              pushHistory(nextSteps);
              setState(s => ({ ...s, steps: nextSteps }));
              const newSelection = newSteps.map((_, i) => insertAt + i);
              setSelectedRows(newSelection);
              setLastSelectedIndex(newSelection[newSelection.length - 1]);
            }
          } catch (e) {}
        }).catch(() => {});
      }
      else if (e.ctrlKey && e.key === 'd' && selectedRows.length > 0) {
        e.preventDefault();
        const toDuplicate = [...selectedRows].sort((a, b) => a - b).map(idx => state.steps[idx]);
        const newSteps = toDuplicate.map(d => {
          const s = createStep(defaultSlave, d.fn, d.address, d.quantity, d.value, d.validationMode);
          s.expected = d.expected;
          s.timeoutMs = d.timeoutMs;
          return s;
        });
        const nextSteps = [...state.steps];
        const insertAt = Math.max(...selectedRows) + 1;
        nextSteps.splice(insertAt, 0, ...newSteps);
        pushHistory(nextSteps);
        setState(s => ({ ...s, steps: nextSteps }));
        const newSelection = newSteps.map((_, i) => insertAt + i);
        setSelectedRows(newSelection);
        setLastSelectedIndex(newSelection[newSelection.length - 1]);
      }
      else if (e.key === 'Delete' && selectedRows.length > 0) {
        e.preventDefault();
        const nextSteps = state.steps.filter((_, idx) => !selectedRows.includes(idx));
        pushHistory(nextSteps);
        setState(s => ({ ...s, steps: nextSteps, detailIndex: null }));
        setSelectedRows([]);
        setLastSelectedIndex(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.steps, selectedRows, lastSelectedIndex, undoStack, redoStack]);

  const stateRef = useRef(state);
  const publishTimerRef = useRef<number | null>(null);
  const publishReadyRef = useRef(false);
  const onRuntimeStateChangeRef = useRef(onRuntimeStateChange);
  const onSaveSessionRef = useRef(onSaveSession);
  stateRef.current = state;

  useEffect(() => {
    onRuntimeStateChangeRef.current = onRuntimeStateChange;
    onSaveSessionRef.current = onSaveSession;
  }, [onRuntimeStateChange, onSaveSession]);

  useEffect(() => {
    setState(createInitialState(runtimeState, defaultSlave));
  }, [resetKey]);

  function publishNow(snapshot: TestsState) {
    if (publishTimerRef.current != null) window.clearTimeout(publishTimerRef.current);
    publishTimerRef.current = null;
    const runtime = exportRuntimeState(snapshot);
    window.setTimeout(() => onRuntimeStateChangeRef.current(runtime), 0);
  }

  useEffect(() => {
    if (!publishReadyRef.current) {
      publishReadyRef.current = true;
      return;
    }
    if (publishTimerRef.current != null) window.clearTimeout(publishTimerRef.current);
    publishTimerRef.current = window.setTimeout(() => publishNow(stateRef.current), 300);
  }, [state.selectedScenario, state.simulatorState, state.steps, state.scenarios]);

  useEffect(() => () => {
    if (publishTimerRef.current != null) window.clearTimeout(publishTimerRef.current);
  }, []);

  const summary = useMemo(() => {
    const active = state.steps.filter((step) => step.enabled);
    const running = active.filter((step) => step.result === "Ejecutando").length;

    let cumulative = state.cumulativeStats;
    if (!cumulative) {
      const hist = state.history || [];
      const executed = hist.length;
      const passed = hist.filter(h => h.result === "Aprobado").length;
      const timeouts = hist.filter(h => h.result === "Timeout").length;
      const failed = executed - passed;
      const responsive = hist.filter(h => h.elapsedMs != null).length;
      const elapsedMsTotal = hist.reduce((sum, h) => sum + (h.elapsedMs || 0), 0);
      cumulative = { executed, passed, failed, timeouts, responsive, elapsedMsTotal };
    }

    const { executed, passed, failed, timeouts, responsive, elapsedMsTotal } = cumulative;
    const otherFailed = Math.max(0, failed - timeouts);
    const avg = responsive ? Math.round(elapsedMsTotal / responsive) : null;
    const rate = executed ? Math.round((passed / executed) * 100) : 0;
    
    return { active: active.length, executed, responsive, passed, failed, timeouts, otherFailed, running, avg, rate };
  }, [state.steps, state.cumulativeStats, state.history]);

  function patchStep(index: number, patch: Partial<TestStep>) { pushHistory(state.steps);
    setState((current) => ({
      ...current,
      detailIndex: null,
      steps: current.steps.map((step, stepIndex) => stepIndex === index ? resetExecution({ ...step, ...patch }) : step)
    }));
  }

  function changeFn(index: number, fn: Fn) {
    patchStep(index, { fn, address: defaultAddress(fn), quantity: defaultQuantity(fn), value: defaultValue(fn), validationMode: defaultValidation(fn), expected: "" });
  }

  function changeValue(index: number, value: string) {
    const step = state.steps[index];
    const next = resetExecution({ ...step, value });
    patchStep(index, { value, quantity: isRead(step.fn) ? step.quantity : String(countFor(next)) });
  }

  function changeValidation(index: number, mode: ValidationMode) {
    const step = state.steps[index];
    const expected = mode === "exact" && isWrite(step.fn) ? step.value : "";
    patchStep(index, { validationMode: mode, expected });
  }

  function savePlanToScenario() {
    if (!isSessionSaved) {
      onMessage("Guarda la sesión primero en la barra superior (Guardar sesión) antes de poder guardar el plan.");
      return;
    }

    setState((current) => {
      const next = {
        ...current,
        scenarios: {
          ...current.scenarios,
          [current.selectedScenario]: normalizeScenario({
            ...current.scenarios[current.selectedScenario],
            steps: current.steps.map(stripStep)
          })
        }
      };
      publishNow(next);
      return next;
    });
    
    // Esperamos a que React actualice el estado global de la sesión antes de disparar el guardado a disco
    window.setTimeout(() => {
      onSaveSessionRef.current?.();
      onMessage("Plan guardado automáticamente en el archivo de sesión.");
    }, 100);
  }

  function selectScenario(id: string) {
    setState((current) => ({ ...current, selectedScenario: id, steps: scenarioSteps(id, current.scenarios[id], defaultSlave), detailIndex: null }));
  }

  function exportLog() {
    if (!(state.history || []).some((step) => isFinalResult(step.result))) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadTextFile(`jw-modbus-pruebas-${stamp}.csv`, executionCsv(state.history || []), "text/csv;charset=utf-8");
    onMessage("Registro de ejecucion exportado a CSV.");
  }

  
  async function runSingleStep(index: number) {
    if (state.running) return;
    const step = state.steps[index];
    if (!step) return;

    const runningStep: TestStep = {
      ...step,
      result: "Ejecutando",
      elapsedMs: null,
      detail: "Ejecutando solicitud Modbus...",
      rows: [],
      values: "",
      at: new Date().toLocaleTimeString("es-PE", { hour12: false })
    };
    setState(curr => ({ ...curr, steps: curr.steps.map((s, i) => i === index ? runningStep : s) }));

    try {
      const executed = await executeStep(step);
      const historyId = crypto.randomUUID();
      const executedWithId = { ...executed, historyId };
      setState(curr => {
        const c = curr.cumulativeStats || { executed: 0, passed: 0, failed: 0, timeouts: 0, responsive: 0, elapsedMsTotal: 0 };
        const isPass = executed.result === "Aprobado";
        const isTimeout = executed.result === "Timeout";
        const hasElapsed = executed.elapsedMs != null;
        return {
          ...curr,
          steps: curr.steps.map((s, i) => i === index ? executedWithId : s),
          history: [...(curr.history || []), executedWithId].slice(-100),
          cumulativeStats: {
            executed: c.executed + 1,
            passed: c.passed + (isPass ? 1 : 0),
            failed: c.failed + (isPass ? 0 : 1),
            timeouts: c.timeouts + (isTimeout ? 1 : 0),
            responsive: c.responsive + (hasElapsed ? 1 : 0),
            elapsedMsTotal: c.elapsedMsTotal + (executed.elapsedMs || 0)
          }
        };
      });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error || "Error de comunicacion.");
      const result = classifyStepErrorResult(message);
      const historyId = crypto.randomUUID();
      const failed: TestStep = {
        ...step,
        result,
        elapsedMs: result === "Timeout" ? numeric(step.timeoutMs, 1000) : null,
        detail: message,
        rows: [],
        values: "",
        at: new Date().toLocaleTimeString("es-PE", { hour12: false }),
        historyId
      };
      setState(curr => {
        const c = curr.cumulativeStats || { executed: 0, passed: 0, failed: 0, timeouts: 0, responsive: 0, elapsedMsTotal: 0 };
        const isTimeout = result === "Timeout";
        const hasElapsed = failed.elapsedMs != null;
        return {
          ...curr,
          steps: curr.steps.map((s, i) => i === index ? failed : s),
          history: [...(curr.history || []), failed].slice(-100),
          cumulativeStats: {
            executed: c.executed + 1,
            passed: c.passed,
            failed: c.failed + 1,
            timeouts: c.timeouts + (isTimeout ? 1 : 0),
            responsive: c.responsive + (hasElapsed ? 1 : 0),
            elapsedMsTotal: c.elapsedMsTotal + (failed.elapsedMs || 0)
          }
        };
      });
    }
  }

  function duplicateStep(index: number) {
    const step = state.steps[index];
    if (!step) return;
    pushHistory(state.steps);
    const cloned: TestStep = {
      ...clone(step),
      id: createId(),
      result: "Pendiente",
      detail: "",
      elapsedMs: null,
      at: "",
      rows: []
    };
    setState(curr => {
      const steps = [...curr.steps];
      steps.splice(index + 1, 0, cloned);
      return { ...curr, steps, detailIndex: null };
    });
  }

  const allStepsChecked = state.steps.length > 0 && state.steps.every(s => s.enabled);
  function toggleAllSteps() {
    const next = !allStepsChecked;
    pushHistory(state.steps);
    setState(curr => ({
      ...curr,
      steps: curr.steps.map(s => ({ ...s, enabled: next }))
    }));
  }

  async function runPlan(loop = false) {
    if (stateRef.current.running) return;
    setState((current) => ({ 
      ...current, 
      running: true, 
      stopRequested: false, 
      looping: loop, 
      detailIndex: null,
      cumulativeStats: { executed: 0, passed: 0, failed: 0, timeouts: 0, responsive: 0, elapsedMsTotal: 0 }
    }));

    do {
      let working = stateRef.current.steps.map(resetExecution);
      setState((current) => ({ ...current, steps: working }));

      for (let index = 0; index < working.length; index += 1) {
        if (stateRef.current.stopRequested) break;
        const step = working[index];
        if (!step?.enabled) continue;

        const runningStep: TestStep = {
          ...step,
          result: "Ejecutando",
          elapsedMs: null,
          detail: "Ejecutando solicitud Modbus...",
          rows: [],
          values: "",
          at: new Date().toLocaleTimeString("es-PE", { hour12: false })
        };
        working = working.map((item, itemIndex) => itemIndex === index ? runningStep : item);
        setState((current) => ({ ...current, steps: current.steps.map((item, itemIndex) => itemIndex === index ? runningStep : item) }));

        try {
          const executed = await executeStep(step);
          const historyId = crypto.randomUUID();
          const executedWithId = { ...executed, historyId };
          working = working.map((item, itemIndex) => itemIndex === index ? executedWithId : item);
          setState((current) => {
            const c = current.cumulativeStats || { executed: 0, passed: 0, failed: 0, timeouts: 0, responsive: 0, elapsedMsTotal: 0 };
            const isPass = executed.result === "Aprobado";
            const isTimeout = executed.result === "Timeout";
            const hasElapsed = executed.elapsedMs != null;
            return {
              ...current, 
              steps: current.steps.map((item, itemIndex) => itemIndex === index ? executedWithId : item), 
              history: [...(current.history || []), executedWithId].slice(-100),
              cumulativeStats: {
                executed: c.executed + 1,
                passed: c.passed + (isPass ? 1 : 0),
                failed: c.failed + (isPass ? 0 : 1),
                timeouts: c.timeouts + (isTimeout ? 1 : 0),
                responsive: c.responsive + (hasElapsed ? 1 : 0),
                elapsedMsTotal: c.elapsedMsTotal + (executed.elapsedMs || 0)
              }
            };
          });
        } catch (error) {
          const message = String(error instanceof Error ? error.message : error || "Error de comunicacion.");
          const result = classifyStepErrorResult(message);
          const historyId = crypto.randomUUID();
          const failed: TestStep = {
            ...step,
            result,
            elapsedMs: result === "Timeout" ? numeric(step.timeoutMs, 1000) : null,
            detail: message,
            rows: [],
            values: "",
            at: new Date().toLocaleTimeString("es-PE", { hour12: false }),
            historyId
          };
          working = working.map((item, itemIndex) => itemIndex === index ? failed : item);
          setState((current) => {
            const c = current.cumulativeStats || { executed: 0, passed: 0, failed: 0, timeouts: 0, responsive: 0, elapsedMsTotal: 0 };
            const isTimeout = result === "Timeout";
            const hasElapsed = failed.elapsedMs != null;
            return {
              ...current, 
              steps: current.steps.map((item, itemIndex) => itemIndex === index ? failed : item), 
              history: [...(current.history || []), failed].slice(-100),
              cumulativeStats: {
                executed: c.executed + 1,
                passed: c.passed,
                failed: c.failed + 1,
                timeouts: c.timeouts + (isTimeout ? 1 : 0),
                responsive: c.responsive + (hasElapsed ? 1 : 0),
                elapsedMsTotal: c.elapsedMsTotal + (failed.elapsedMs || 0)
              }
            };
          });
        }
        
        await new Promise(r => setTimeout(r, 60));
      }

      if (!stateRef.current.looping) break;
    } while (!stateRef.current.stopRequested);

    const stopped = stateRef.current.stopRequested;
    const finalState = { ...stateRef.current, running: false, stopRequested: false, looping: false };
    setState(finalState);
    publishNow(finalState);
    dispatchTestsRunCompleted(finalState.steps, stopped);
    onMessage(stopped ? "Plan detenido." : "Plan ejecutado completamente.");
  }

  return (
    <div className="testsNative">
      <section className="card testsPlanCard">
        <div className="testsPlanHeader">
          <div><h2>Plan de pruebas al slave</h2><p>PC como Master</p></div>
          <div className="testsPlanActions">
            <button className="primary" onClick={() => runPlan(false)} disabled={state.running}>Iniciar prueba</button>
            <button className={state.looping ? "primary" : ""} onClick={() => runPlan(true)} disabled={state.running}>Iniciar en bucle</button>
            <button onClick={() => setState((current) => ({ ...current, stopRequested: true }))} disabled={!state.running}>
              {state.stopRequested ? "Deteniendo..." : "Detener"}
            </button>
            <button onClick={() => { pushHistory(state.steps); setState((current) => ({ ...current, steps: [...current.steps, createStep(defaultSlave, "fc3", "40000", "1", "", "count")] })); }}>+ Agregar paso</button>
            <button onClick={savePlanToScenario}>Guardar plan</button>
          </div>
        </div>
        <div className="testsPlanTable" onDragOver={(e) => {
          // Auto-scroll while dragging near edges
          const container = e.currentTarget;
          const rect = container.getBoundingClientRect();
          const zone = 50;
          const speed = 12;
          if (e.clientY < rect.top + zone) {
            container.scrollBy({ top: -speed, behavior: 'instant' });
          } else if (e.clientY > rect.bottom - zone) {
            container.scrollBy({ top: speed, behavior: 'instant' });
          }
        }}>
      <style>{`
        .testsPlanTable table tr.drag-over td { border-top: 2px solid #00bfff !important; }
        .testsPlanTable table tr.drag-over-bottom td { border-bottom: 2px solid #00bfff !important; }
        .testsPlanTable table { border-collapse: collapse !important; }
        .testsPlanTable tbody tr { scroll-margin-top: 55px; scroll-margin-bottom: 55px; }
        .testsPlanTable { position: relative; }
      `}</style>
          <table>
            <colgroup>
              <col style={{ width: '35px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '185px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '375px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '40px' }} />
            </colgroup>
            <thead><tr>
                <th style={{textAlign:'center'}}>Activo</th>
                <th style={{textAlign:'center'}}>Paso</th>
                <th style={{textAlign:'center'}}>Slave</th>
                <th style={{textAlign:'center'}}>Funcion</th>
                <th style={{textAlign:'center'}}>Direccion</th>
                <th style={{textAlign:'center'}}>Cantidad</th>
                <th style={{textAlign:'center'}}>Dato / Valor</th>
                <th style={{textAlign:'center'}}>Timeout</th>
                <th style={{textAlign:'center'}}>Resultado</th>
                <th />
              </tr></thead>
            <tbody>{state.steps.map((step, index) => <StepRow key={step.id} step={step} index={index} selected={selectedRows.includes(index)} onSelect={(e) => handleRowClick(index, e)} onPatch={(patch) => patchStep(index, patch)} onFn={(fn) => changeFn(index, fn)} onValue={(value) => changeValue(index, value)} onValidation={(mode) => changeValidation(index, mode)} onEditBits={(field) => setEditingBits({ index, field })} onEditRegisters={() => setEditingRegisters({ index })} onEditFc04={() => setEditingFc04({ index })} onEditFc06={() => setEditingFc06({ index })} onDelete={() => { pushHistory(state.steps); setState((current) => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index), detailIndex: null })); setSelectedRows([]); setLastSelectedIndex(null); }} dragPayload={selectedRows.includes(index) ? selectedRows : [index]} onReorder={(payload, to) => {
  let fromIndices = [];
  try { fromIndices = JSON.parse(payload); } catch(e) { fromIndices = [Number(payload)]; }
  if (!Array.isArray(fromIndices) || fromIndices.length === 0) return;
  fromIndices.sort((a,b)=>a-b);
  if (fromIndices.includes(to) || (fromIndices.length === 1 && (fromIndices[0] === to || fromIndices[0] === to - 1))) return;
  
  pushHistory(state.steps);
  setState((current) => {
    const steps = [...current.steps];
    const movedItems = fromIndices.map(i => steps[i]);
    for (let i = fromIndices.length - 1; i >= 0; i--) {
      steps.splice(fromIndices[i], 1);
    }
    const shift = fromIndices.filter(i => i < to).length;
    const finalTo = to - shift;
    steps.splice(finalTo, 0, ...movedItems);
    
    setTimeout(() => {
      const newSelection = movedItems.map((_, idx) => finalTo + idx);
      setSelectedRows(newSelection);
      setLastSelectedIndex(newSelection[0]);
    }, 0);

    return { ...current, steps, detailIndex: null };
  });
}} />)}</tbody>
          </table>
        </div>
        {editingBits && state.steps[editingBits.index] && (
          <BitEditorModal 
            value={editingBits.field === "value" ? state.steps[editingBits.index].value : state.steps[editingBits.index].expected}
            quantity={Number(state.steps[editingBits.index].quantity) || 1}
            startAddress={state.steps[editingBits.index].address || "0"}
            fn={state.steps[editingBits.index].fn}
            field={editingBits.field}
            onClose={() => setEditingBits(null)}
            onApply={(val, qty) => {
              if (editingBits.field === "value") {
                patchStep(editingBits.index, { value: val, quantity: String(qty) });
              } else {
                patchStep(editingBits.index, { expected: val, quantity: String(qty) });
              }
              setEditingBits(null);
            }}
          />
        )}
        {editingRegisters && state.steps[editingRegisters.index] && (
          <RegisterExpectedModal
            step={state.steps[editingRegisters.index]}
            onClose={() => setEditingRegisters(null)}
            onApply={(val, validationMode, newAddress, newQty) => {
              const target = state.steps[editingRegisters.index];
              if (target.fn === "fc16") {
                patchStep(editingRegisters.index, { 
                  value: val, 
                  address: newAddress,
                  quantity: String(newQty)
                });
              } else {
                patchStep(editingRegisters.index, { 
                  expected: val, 
                  validationMode,
                  address: newAddress,
                  quantity: String(newQty)
                });
              }
              setEditingRegisters(null);
            }}
          />
        )}
        {editingFc06 && state.steps[editingFc06.index] && (
          <Fc06EditModal
            step={state.steps[editingFc06.index]}
            onClose={() => setEditingFc06(null)}
            onApply={(newVal, newAddress, newDt) => {
              patchStep(editingFc06.index, { 
                value: newVal, 
                address: newAddress,
                dataType: newDt
              });
              setEditingFc06(null);
            }}
          />
        )}
        {editingFc04 && state.steps[editingFc04.index] && (
          <Fc04ExpectedModal
            step={state.steps[editingFc04.index]}
            onClose={() => setEditingFc04(null)}
            onApply={(expectedVal, validationMode, newAddress, newQty, newDataType) => {
              patchStep(editingFc04.index, { 
                expected: expectedVal, 
                validationMode,
                address: newAddress,
                quantity: String(newQty),
                dataType: newDataType
              });
              setEditingFc04(null);
            }}
          />
        )}
        <p className="testsInfo">Cantidad define el número de registros o bobinas en lecturas y en FC16. Valor define el contenido de escritura o tiempo de retardo.</p>
      </section>

      <div className="testsSide">
        {state.managingScenarios ? <ScenarioManager state={state} setState={setState} savePlan={savePlanToScenario} defaultSlave={defaultSlave} /> : <ScenariosPanel state={state} selectScenario={selectScenario} setState={setState} />}
        <SimulatorPanel state={state} setState={setState} port={port} baud={baud} />
      </div>

      <div className="testsKpis">
        <KpiRingCard title="Tasa de exito" value={`${summary.rate}%`} sub={summary.executed ? `Ultima ejecucion: ${summary.passed}/${summary.executed} aprobados` : "Sin ejecucion"} tone="success" percent={summary.rate || 0} />
        <KpiCard title="Latencia promedio" value={summary.avg == null ? "-" : `${summary.avg} ms`} sub={summary.responsive ? `Ultima ejecucion: ${summary.responsive} respuesta(s)${summary.timeouts ? `; ${summary.timeouts} timeout(s) excluidos` : ""}` : summary.running ? "Esperando respuesta" : "Sin datos todavia"} tone="neutral" icon={Activity} />
        <KpiCard title="Errores" value={String(summary.failed)} sub={summary.failed ? `${summary.timeouts} timeout(s), ${summary.otherFailed} otro(s)` : "Ultima ejecucion"} tone={summary.failed > 0 ? "danger" : "neutral"} icon={AlertTriangle} />
        {(() => {
          const isLoopResult = summary.executed > summary.active || state.looping;
          const completedValue = isLoopResult ? `${summary.executed}` : `${summary.executed}/${summary.active}`;
          const completedSub = summary.running 
            ? (state.looping ? `Bucle continuo en curso` : `${summary.running} en curso`) 
            : (isLoopResult && summary.active > 0 ? `Ultima ejecucion: ${Math.floor(summary.executed / summary.active)} ciclos` : "Ultima ejecucion");
          
          let completedPercent = 0;
          if (summary.active > 0) {
            if (isLoopResult) {
              const mod = summary.executed % summary.active;
              completedPercent = (mod === 0 && summary.executed > 0 && !summary.running) ? 100 : (mod / summary.active) * 100;
            } else {
              completedPercent = (summary.executed / summary.active) * 100;
            }
          }

          return (
            <KpiRingCard 
              title="Pasos completados" 
              value={completedValue} 
              sub={completedSub} 
              tone="steps" 
              percent={completedPercent} 
            />
          );
        })()}
      </div>

      <section className="card testsLogCard">
        <div className="testsLogHeader">
          <h2>Registro de ejecucion</h2>
          <div>
            <button onClick={() => setState((current) => ({ ...current, detailIndex: null, history: [] }))}>Limpiar registro</button>
            <button onClick={exportLog} disabled={!(state.history || []).some((step) => isFinalResult(step.result))}>Exportar CSV</button>
          </div>
        </div>
        {state.detailIndex == null ? <ExecutionTable steps={state.history || []} onDetail={(index) => setState((current) => ({ ...current, detailIndex: index }))} /> : <StepDetail step={(state.history || [])[state.detailIndex]} index={state.detailIndex} onClose={() => setState((current) => ({ ...current, detailIndex: null }))} />}
      </section>
    </div>
  );
}

function Fc04Preview({
  step,
  onClick
}: {
  step: TestStep;
  onClick: () => void;
}) {
  const dt = step.dataType || (step.expected && !step.expected.includes(".") && Number(step.quantity) === 1 ? "UInt16" : "Float32");
  const isFloat = dt === "Float32";
  const match = String(step.expected || "").match(/([-+]?[0-9]*\.?[0-9]+)(\s*±\s*([0-9]*\.?[0-9]+))?/);
  const target = match && match[1] ? match[1] : (step.expected || (isFloat ? "25.50" : "100"));
  const tol = match && match[3] ? match[3] : (isFloat ? "0.10" : "5");

  let displayText: React.ReactNode = null;
  let title = `Configurar valor analógico ${dt} (FC04)`;

  if (step.validationMode === "tolerance") {
    const tNum = parseFloat(target) || 0;
    const tolNum = parseFloat(tol) || 0;
    const minR = isFloat ? (tNum - tolNum).toFixed(2) : String(Math.round(tNum - tolNum));
    const maxR = isFloat ? (tNum + tolNum).toFixed(2) : String(Math.round(tNum + tolNum));

    displayText = (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", whiteSpace: "nowrap" }}>
        <span style={{ fontSize: "0.68rem", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", padding: "1px 5px", borderRadius: "4px", color: "#9ec6e0", whiteSpace: "nowrap", fontWeight: 600 }}>
          Esperado:
        </span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#edf8ff", fontFamily: "monospace" }}>
          {target}
        </span>
        <span style={{
          fontSize: "0.72rem",
          fontWeight: 600,
          color: "#34d399",
          background: "rgba(16, 185, 129, 0.15)",
          border: "1px solid rgba(16, 185, 129, 0.35)",
          padding: "1px 5px",
          borderRadius: "4px",
          lineHeight: 1.2
        }}>
          ±{tol}
        </span>
        <span style={{
          fontSize: "0.72rem",
          color: "#7dd3fc",
          background: "rgba(0, 191, 255, 0.08)",
          border: "1px solid rgba(0, 191, 255, 0.22)",
          padding: "1px 6px",
          borderRadius: "4px",
          fontFamily: "monospace"
        }}>
          [{minR} ~ {maxR}]
        </span>
        <span style={{
          fontSize: "0.70rem",
          color: isFloat && Number(step.quantity) < 2 ? "#f59e0b" : "var(--muted)",
          background: isFloat && Number(step.quantity) < 2 ? "rgba(245, 158, 11, 0.12)" : "rgba(255, 255, 255, 0.04)",
          border: isFloat && Number(step.quantity) < 2 ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(255, 255, 255, 0.08)",
          padding: "1px 5px",
          borderRadius: "4px"
        }} title={isFloat && Number(step.quantity) < 2 ? "Float32 requiere 2 registros (32 bits). Ajusta Cantidad a 2." : `${dt} (${step.quantity || 1} regs)`}>
          {isFloat && Number(step.quantity) < 2 ? "Float32 (req. 2 regs)" : `${dt} · ${step.quantity || (isFloat ? 2 : 1)} reg${Number(step.quantity) === 1 ? "" : "s"}`}
        </span>
      </div>
    );
    title = `${dt}: ${target} | Tolerancia: ±${tol} | Rango válido: [${minR}, ${maxR}] | Clic para configurar`;
  } else if (step.validationMode === "exact") {
    displayText = (
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "0.68rem", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", padding: "1px 5px", borderRadius: "4px", color: "#9ec6e0", whiteSpace: "nowrap", fontWeight: 600 }}>
          Esperado:
        </span>
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--cyan)", fontFamily: "monospace" }}>
          {step.expected || target}
        </span>
        <span style={{ fontSize: "0.70rem", color: "#34d399", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "1px 5px", borderRadius: "4px" }}>
          Exacto
        </span>
        <span style={{ fontSize: "0.70rem", color: "var(--muted)", background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "1px 5px", borderRadius: "4px" }}>
          {dt} · {step.quantity || (isFloat ? 2 : 1)} reg{Number(step.quantity) === 1 ? "" : "s"}
        </span>
      </div>
    );
    title = `Valor exacto ${dt}: ${step.expected || target} | Clic para configurar`;
  } else if (step.validationMode === "response") {
    displayText = <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Respuesta OK</span>;
  } else {
    displayText = <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{step.quantity} regs</span>;
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#041727",
        border: "1px solid #2d5c75",
        borderRadius: "6px",
        padding: "2px 6px",
        width: "100%",
        height: "34px",
        boxSizing: "border-box",
        cursor: "pointer"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", overflow: "hidden", minWidth: 0, gap: "6px" }}>
        {displayText}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={{
          minHeight: "22px",
          height: "22px",
          width: "22px",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 191, 255, 0.12)",
          border: "1px solid rgba(0, 191, 255, 0.45)",
          color: "var(--cyan)",
          borderRadius: "4px",
          cursor: "pointer",
          flexShrink: 0,
          fontSize: "0.85rem"
        }}
      >
        ✎
      </button>
    </div>
  );
}

function StepRow({ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect, dragPayload, onEditBits, onEditRegisters, onEditFc04, onEditFc06 }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onValidation: (mode: ValidationMode) => void; onDelete: () => void; onReorder: (payload: string, to: number) => void; selected?: boolean; onSelect?: (e: React.MouseEvent) => void; dragPayload: number[]; onEditBits?: (field: "value" | "expected") => void; onEditRegisters?: () => void; onEditFc04?: () => void; onEditFc06?: () => void; }) {
  const [canDrag, setCanDrag] = useState(false);
  const read = isRead(step.fn);
  const isQtyEditable = read || step.fn === "fc16" || step.fn === "fc15";
  const isSingleWrite = step.fn === "fc5" || step.fn === "fc6";
  const expectedDisabled = step.validationMode === "response" || step.validationMode === "count";
  const modeOptions: ValidationMode[] = isWrite(step.fn) ? ["response", "exact", "byAddress"] : (step.fn === "fc4" ? ["tolerance", "exact", "count", "byAddress"] : ["count", "exact", "byAddress"]);
  const actualBitValue = hasBitRows(step) ? bitRowsValue(step.rows, "actual") : "";
  return (
    <tr onClick={onSelect} style={{ background: selected ? "#00bfff22" : (step.fn === "delay" ? "rgba(245, 158, 11, 0.03)" : undefined) }} draggable={canDrag} onDragStart={(e) => { 
  e.dataTransfer.setData("application/json", JSON.stringify(dragPayload)); 
  e.dataTransfer.effectAllowed = "move"; 
  if (dragPayload.length > 1) {
    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.opacity = '0.55';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.background = '#071d30';
    ghost.style.borderRadius = '8px';
    ghost.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    ghost.style.border = '1px solid #00bfff';
    ghost.style.overflow = 'hidden';
    
    const table = document.createElement('table');
    table.className = 'testsPlanTable';
    table.style.borderCollapse = 'collapse';
    table.style.width = e.currentTarget.closest('table')?.offsetWidth + 'px' || '800px';
    table.style.margin = '0';
    
    const tbody = document.createElement('tbody');
    const allRows = Array.from(e.currentTarget.parentElement?.children || []);
    dragPayload.forEach(idx => {
       if (allRows[idx]) {
         const clone = allRows[idx].cloneNode(true) as HTMLElement;
         clone.style.background = '#00bfff22';
         // remove specific drag classes from clone if they exist
         clone.classList.remove('drag-over', 'drag-over-bottom');
         tbody.appendChild(clone);
       }
    });
    
    table.appendChild(tbody);
    ghost.appendChild(table);
    document.body.appendChild(ghost);
    
    e.dataTransfer.setDragImage(ghost, 30, 30);
    setTimeout(() => { if(document.body.contains(ghost)) document.body.removeChild(ghost); }, 0);
  }
}} onDragOver={(e) => { 
  e.preventDefault(); 
  e.dataTransfer.dropEffect = "move"; 
  document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => {
    if (el !== e.currentTarget) el.classList.remove('drag-over', 'drag-over-bottom');
  });
  const rect = e.currentTarget.getBoundingClientRect(); 
  const isBottom = e.clientY > rect.top + rect.height / 2; 
  if (isBottom) {
    e.currentTarget.classList.add('drag-over-bottom');
    e.currentTarget.classList.remove('drag-over');
  } else {
    e.currentTarget.classList.add('drag-over');
    e.currentTarget.classList.remove('drag-over-bottom');
  }
}} onDragEnd={() => {
  setCanDrag(false);
  document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'));
}} 
onDragLeave={(e) => { 
  const rect = e.currentTarget.getBoundingClientRect();
  if (e.clientY <= rect.top || e.clientY >= rect.bottom || e.clientX <= rect.left || e.clientX >= rect.right) {
    e.currentTarget.classList.remove('drag-over', 'drag-over-bottom');
  }
}} onDrop={(e) => { 
  e.preventDefault(); 
  const isBottom = e.currentTarget.classList.contains('drag-over-bottom');
  document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'));
  const payload = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain"); 
  let to = index; 
  if (isBottom) { to = index + 1; } 
  onReorder(payload, to); 
}}>
      <td><input type="checkbox" checked={step.enabled} onChange={(event) => onPatch({ enabled: event.target.checked })} /></td>
      <td 
        style={{ cursor: 'grab', userSelect: 'none' }} 
        title="Arrastra para reordenar"
        onMouseEnter={() => setCanDrag(true)}
        onMouseLeave={() => setCanDrag(false)}
      >
        ☰ {index + 1}
      </td>
      <td><input type={step.fn === "delay" ? "text" : "number"} min="1" max="247" disabled={step.fn === "delay"} value={step.fn === "delay" ? "-" : step.slave} onChange={(event) => onPatch({ slave: event.target.value.replace(/\D/g, "").slice(0, 3) })} onBlur={() => onPatch({ slave: clampSlave(step.slave, 2) })} /></td>
      <td><select value={step.fn} onChange={(event) => onFn(event.target.value as Fn)}>{functionOrder.map((fn) => <option key={fn} value={fn}>{labels[fn]}</option>)}</select></td>
      <td><input type={step.fn === "delay" ? "text" : "number"} min="0" max="65535" disabled={step.fn === "delay"} value={step.fn === "delay" ? "-" : step.address} onChange={(event) => onPatch({ address: sanitizeNumericText(event.target.value, 8) })} /></td>
      <td>
        <input 
          type={!isQtyEditable || step.fn === "delay" ? "text" : "number"} 
          min="1" 
          max={step.fn === "fc16" ? "123" : (step.fn === "fc15" ? "1968" : (read ? maxReadQuantity(step.fn) : undefined))} 
          disabled={!isQtyEditable || step.fn === "delay"} 
          value={step.fn === "delay" ? "-" : (isQtyEditable ? (step.quantity !== undefined && step.quantity !== "" ? step.quantity : String(countFor(step))) : countFor(step))} 
          onChange={(event) => {
            const rawVal = event.target.value.replace(/\D/g, "").slice(0, 4);
            if (step.fn === "fc16") {
              if (rawVal === "") {
                onPatch({ quantity: "" });
                return;
              }
              const newQty = parseInt(rawVal, 10);
              if (isNaN(newQty) || newQty < 1) {
                onPatch({ quantity: rawVal });
                return;
              }
              const clampedQty = Math.min(newQty, 123);
              const currentRegs = splitValues(step.value);
              let nextRegs = [...currentRegs];
              if (currentRegs.length === 0) {
                nextRegs = Array(clampedQty).fill("0");
              } else if (clampedQty > currentRegs.length) {
                while (nextRegs.length < clampedQty) {
                  nextRegs.push("0");
                }
              } else if (clampedQty < currentRegs.length) {
                nextRegs = nextRegs.slice(0, clampedQty);
              }
              onPatch({
                quantity: String(clampedQty),
                value: nextRegs.join(" ")
              });
            } else if (step.fn === "fc15") {
              if (rawVal === "") {
                onPatch({ quantity: "" });
                return;
              }
              const newQty = parseInt(rawVal, 10);
              if (isNaN(newQty) || newQty < 1) {
                onPatch({ quantity: rawVal });
                return;
              }
              const clampedQty = Math.min(newQty, 1968);
              const tokens = splitValues(step.value);
              const currentBools: boolean[] = [];
              for (let i = 0; i < tokens.length; i++) {
                try {
                  currentBools.push(normalizeBool(tokens[i]));
                } catch {
                  currentBools.push(false);
                }
              }
              let nextBools = [...currentBools];
              if (nextBools.length === 0) {
                nextBools = Array(clampedQty).fill(false);
              } else if (clampedQty > nextBools.length) {
                // Si se incrementa la cantidad, las bobinas nuevas se añaden siempre apagadas (false -> "0")
                while (nextBools.length < clampedQty) {
                  nextBools.push(false);
                }
              } else if (clampedQty < nextBools.length) {
                // Al bajar la cantidad, se eliminan/apagan las bobinas excedentes
                nextBools = nextBools.slice(0, clampedQty);
              }
              onPatch({
                quantity: String(clampedQty),
                value: nextBools.map((b) => (b ? "1" : "0")).join(" ")
              });
            } else {
              onPatch({ quantity: rawVal });
            }
          }}
          onBlur={() => {
            if (step.fn === "fc16") {
              const currentRegs = splitValues(step.value);
              const q = parseInt(step.quantity, 10);
              const validQty = isNaN(q) || q < 1 ? Math.max(1, currentRegs.length) : Math.min(q, 123);
              let nextRegs = [...currentRegs];
              if (nextRegs.length === 0) {
                nextRegs = Array(validQty).fill("0");
              } else if (validQty > nextRegs.length) {
                while (nextRegs.length < validQty) {
                  nextRegs.push("0");
                }
              } else if (validQty < nextRegs.length) {
                nextRegs = nextRegs.slice(0, validQty);
              }
              onPatch({
                quantity: String(validQty),
                value: nextRegs.join(" ")
              });
            } else if (step.fn === "fc15") {
              const tokens = splitValues(step.value);
              const q = parseInt(step.quantity, 10);
              const validQty = isNaN(q) || q < 1 ? Math.max(1, tokens.length) : Math.min(q, 1968);
              const currentBools: boolean[] = [];
              for (let i = 0; i < tokens.length; i++) {
                try {
                  currentBools.push(normalizeBool(tokens[i]));
                } catch {
                  currentBools.push(false);
                }
              }
              let nextBools = [...currentBools];
              if (nextBools.length === 0) {
                nextBools = Array(validQty).fill(false);
              } else if (validQty > nextBools.length) {
                while (nextBools.length < validQty) {
                  nextBools.push(false);
                }
              } else if (validQty < nextBools.length) {
                nextBools = nextBools.slice(0, validQty);
              }
              onPatch({
                quantity: String(validQty),
                value: nextBools.map((b) => (b ? "1" : "0")).join(" ")
              });
            } else if (read) {
              if (!step.quantity || Number(step.quantity) < 1) {
                onPatch({ quantity: "1" });
              }
            }
          }}
        />
      </td>
      <td>
        {(() => {
          if (step.fn === "fc5") {
            const isFc5On = normalizeBool(step.value);
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: "#041727", border: "1px solid #2d5c75", borderRadius: "6px", padding: "2px 6px", height: "34px", width: "100%", boxSizing: "border-box" }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); onValue(isFc5On ? "OFF" : "ON"); onValidation("response"); }}
                    style={{ width: '38px', height: '22px', borderRadius: '12px', background: isFc5On ? '#10b981' : '#1e3242', border: isFc5On ? '1px solid #34d399' : '1px solid #314a5d', boxShadow: isFc5On ? '0 0 8px rgba(16,185,129,0.55)' : 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0 }}
                  >
                    <div style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#ffffff', position: 'absolute', top: '3px', left: isFc5On ? '19px' : '3px', transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isFc5On ? '#34d399' : 'var(--muted)', fontFamily: 'monospace' }}>
                    {isFc5On ? 'ON' : 'OFF'}
                  </span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Escritura de bobina</span>
              </div>
            );
          }
          if (step.fn === "fc1" || step.fn === "fc2") {
            return <BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => { onValidation("exact"); onEditBits && onEditBits("expected"); }} onChange={(val) => { onPatch({ expected: val }); onValidation("exact"); }} emptyText={`${step.quantity} bits`} isReadExpected />;
          }
          if (step.fn === "fc15") {
            return <BitPreview value={step.value} quantity={Number(step.quantity) || 1} onClick={() => { onValidation("response"); onEditBits && onEditBits("value"); }} onChange={(val) => { onValue(val); onValidation("response"); }} emptyText="Definir bobinas" />;
          }
          if (step.fn === "fc6") {
            const rawVal = String(step.value ?? "1234").trim();
            const parsed = rawVal.toLowerCase().startsWith("0x") ? parseInt(rawVal, 16) : parseInt(rawVal, 10);
            const numVal = isNaN(parsed) ? 1234 : parsed;
            const u16 = ((numVal % 65536) + 65536) % 65536;
            const s16 = u16 > 32767 ? u16 - 65536 : u16;
            const hex = "0x" + u16.toString(16).toUpperCase().padStart(4, "0");
            const bin = u16.toString(2).padStart(16, "0").match(/.{1,4}/g)?.join(" ") || "";
            const dt = step.dataType || "UInt16";

            let displayVal = String(u16);
            if (dt === "Int16") displayVal = String(s16);
            else if (dt === "Hex16") displayVal = hex;
            else if (dt === "Bin16") displayVal = bin;

            return (
              <div
                onClick={(e) => { e.stopPropagation(); onEditFc06 && onEditFc06(); }}
                title={`FC06 · Valor a escribir: ${displayVal}\nDEC uint16: ${u16}\nDEC int16: ${s16}\nHEX: ${hex}\nBIN: ${bin}\nClic para abrir editor avanzado`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: "#041727",
                  border: "1px solid #2d5c75",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  height: "34px",
                  width: "100%",
                  boxSizing: "border-box",
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#fff", fontFamily: "monospace" }}>
                    {displayVal}
                  </span>
                  <span style={{
                    fontSize: "0.70rem",
                    color: "var(--cyan)",
                    background: "rgba(0, 191, 255, 0.08)",
                    border: "1px solid rgba(0, 191, 255, 0.25)",
                    padding: "1px 6px",
                    borderRadius: "4px"
                  }}>
                    {dt}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#00c8ff", fontFamily: "monospace" }}>
                    {hex}
                  </span>
                </div>
                <button
                  type="button"
                  style={{
                    minHeight: "22px",
                    height: "22px",
                    width: "22px",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0, 191, 255, 0.12)",
                    border: "1px solid rgba(0, 191, 255, 0.45)",
                    color: "var(--cyan)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    flexShrink: 0,
                    fontSize: "0.85rem"
                  }}
                >
                  ✎
                </button>
              </div>
            );
          }
          if (step.fn === "fc16") {
            const regs = splitValues(step.value);
            const totalQty = Number(step.quantity) || regs.length || 1;
            const previewVals = regs.slice(0, 4);
            const remaining = regs.length > 4 ? regs.length - 4 : 0;

            return (
              <div
                onClick={(e) => { e.stopPropagation(); onEditRegisters && onEditRegisters(); }}
                title={regs.length > 0 ? `Valores a escribir (${regs.length}): ${regs.join(", ")} | Clic para configurar` : "Configurar valores a escribir"}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: "#041727",
                  border: "1px solid #2d5c75",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  height: "34px",
                  width: "100%",
                  boxSizing: "border-box",
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", minWidth: 0 }}>
                  {regs.length === 0 ? (
                    <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                      Definir registros
                    </span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" }}>
                      {previewVals.map((v, i) => (
                        <span
                          key={i}
                          style={{
                            background: "#082136",
                            border: "1px solid #1c4b6e",
                            borderRadius: "4px",
                            padding: "1px 6px",
                            fontFamily: "monospace",
                            fontSize: "0.80rem",
                            fontWeight: 700,
                            color: "#edf8ff",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {v}
                        </span>
                      ))}
                      {remaining > 0 && (
                        <span style={{ fontSize: "0.72rem", color: "#9ec6e0", padding: "1px 5px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", whiteSpace: "nowrap" }}>
                          +{remaining} más
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <span style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "var(--cyan)",
                    background: "rgba(0, 191, 255, 0.08)",
                    border: "1px solid rgba(0, 191, 255, 0.25)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    whiteSpace: "nowrap"
                  }}>
                    {regs.length > 0 ? `${regs.length} regs` : `${totalQty} regs`}
                  </span>
                  <button
                    type="button"
                    style={{
                      minHeight: "22px",
                      height: "22px",
                      width: "22px",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0, 191, 255, 0.12)",
                      border: "1px solid rgba(0, 191, 255, 0.45)",
                      color: "var(--cyan)",
                      borderRadius: "4px",
                      cursor: "pointer",
                      flexShrink: 0,
                      fontSize: "0.85rem"
                    }}
                  >
                    ✎
                  </button>
                </div>
              </div>
            );
          }
          if (step.fn === "fc3") {
            const qty = Math.max(1, Number(step.quantity) || 1);
            const allVals = splitValues(step.expected);
            const vals = allVals.slice(0, qty);
            const previewVals = vals.slice(0, 4);
            const remaining = qty > 4 ? qty - 4 : 0;

            return (
              <div
                onClick={(e) => { e.stopPropagation(); onEditRegisters && onEditRegisters(); }}
                title={allVals.length > 0 ? `Valores esperados (${qty} regs): ${vals.join(", ")}${allVals.length > qty ? ` (${allVals.length - qty} valores adicionales omitidos por Cantidad=${qty})` : ""} | Clic para configurar` : `Configurar ${qty} valores esperados por registro`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: "#041727",
                  border: "1px solid #2d5c75",
                  borderRadius: "6px",
                  padding: "2px 6px",
                  height: "34px",
                  width: "100%",
                  boxSizing: "border-box",
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", minWidth: 0 }}>
                  <span style={{ fontSize: "0.68rem", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", padding: "1px 5px", borderRadius: "4px", color: "#9ec6e0", whiteSpace: "nowrap", fontWeight: 600 }}>
                    Esperado:
                  </span>
                  {vals.length === 0 ? (
                    <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600, padding: "0 4px" }}>
                      -
                    </span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" }}>
                      {previewVals.map((v, i) => (
                        <span
                          key={i}
                          style={{
                            background: "#082136",
                            border: "1px solid #1c4b6e",
                            borderRadius: "4px",
                            padding: "1px 6px",
                            fontFamily: "monospace",
                            fontSize: "0.80rem",
                            fontWeight: 700,
                            color: "#edf8ff",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {v}
                        </span>
                      ))}
                      {remaining > 0 && (
                        <span style={{ fontSize: "0.72rem", color: "#9ec6e0", padding: "1px 5px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", whiteSpace: "nowrap" }}>
                          +{remaining} más
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <span style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "var(--cyan)",
                    background: "rgba(0, 191, 255, 0.08)",
                    border: "1px solid rgba(0, 191, 255, 0.25)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    whiteSpace: "nowrap"
                  }}>
                    {qty} regs
                  </span>
                  <button
                    type="button"
                    style={{
                      minHeight: "22px",
                      height: "22px",
                      width: "22px",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0, 191, 255, 0.12)",
                      border: "1px solid rgba(0, 191, 255, 0.45)",
                      color: "var(--cyan)",
                      borderRadius: "4px",
                      cursor: "pointer",
                      flexShrink: 0,
                      fontSize: "0.85rem"
                    }}
                  >
                    ✎
                  </button>
                </div>
              </div>
            );
          }
          if (step.fn === "fc4") {
            return <Fc04Preview step={step} onClick={() => onEditFc04 && onEditFc04()} />;
          }
          if (step.fn === "delay") {
            const currentMs = parseInt(step.value || "1000", 10) || 1000;
            const secVal = currentMs / 1000;
            const secText = currentMs % 1000 === 0 ? `${secVal} s` : `${secVal.toFixed(1)} s`;
            const presets = [
              { label: "250ms", ms: 250 },
              { label: "500ms", ms: 500 },
              { label: "1s", ms: 1000 },
              { label: "2s", ms: 2000 },
              { label: "5s", ms: 5000 },
            ];

            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "linear-gradient(90deg, rgba(245, 158, 11, 0.10) 0%, #041727 75%)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  height: "34px",
                  width: "100%",
                  boxSizing: "border-box",
                  gap: "6px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.80rem",
                    fontWeight: 700,
                    color: "#fbbf24",
                    letterSpacing: "0.2px"
                  }}>
                    <span style={{ fontSize: "0.95rem" }}>⏱</span>
                    <span>Pausa</span>
                  </span>
                  <span
                    title={`Equivale a ${secText}`}
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      fontFamily: "monospace",
                      color: "#fde68a",
                      background: "rgba(245, 158, 11, 0.15)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      padding: "1px 5px",
                      borderRadius: "4px"
                    }}
                  >
                    {secText}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "3px", overflow: "hidden" }}>
                  {presets.map((p) => {
                    const isActive = currentMs === p.ms;
                    return (
                      <button
                        key={p.ms}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onValue(String(p.ms));
                          onValidation("count");
                        }}
                        style={{
                          padding: "1px 5px",
                          fontSize: "0.68rem",
                          fontWeight: isActive ? 700 : 500,
                          fontFamily: "monospace",
                          borderRadius: "4px",
                          cursor: "pointer",
                          border: isActive ? "1px solid #fbbf24" : "1px solid rgba(255, 255, 255, 0.12)",
                          background: isActive ? "rgba(245, 158, 11, 0.28)" : "rgba(255, 255, 255, 0.04)",
                          color: isActive ? "#ffffff" : "var(--muted)",
                          boxShadow: isActive ? "0 0 6px rgba(245, 158, 11, 0.35)" : "none",
                          transition: "all 0.15s ease",
                          minHeight: "20px",
                          lineHeight: "18px",
                          flexShrink: 0
                        }}
                        title={`Fijar tiempo a ${p.label}`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  <input
                    type="number"
                    min="1"
                    max="60000"
                    step="100"
                    value={step.value || ""}
                    placeholder="1000"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      onValue(e.target.value.replace(/\D/g, "").slice(0, 5));
                      onValidation("count");
                    }}
                    style={{
                      width: "60px",
                      height: "24px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      fontFamily: "monospace",
                      background: "#082136",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      color: "#ffffff",
                      borderRadius: "4px",
                      textAlign: "center",
                      boxSizing: "border-box"
                    }}
                  />
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#fbbf24", fontFamily: "monospace" }}>ms</span>
                </div>
              </div>
            );
          }
          return <span style={{ color: "var(--muted)" }}>-</span>;
        })()}
      </td>
      <td><input type={step.fn === "delay" ? "text" : "number"} min="1" step="100" max="60000" disabled={step.fn === "delay"} value={step.fn === "delay" ? "-" : step.timeoutMs} onChange={(event) => onPatch({ timeoutMs: event.target.value.replace(/\D/g, "").slice(0, 5) })} /></td>
      <td><ResultPill result={step.result} /></td>
      <td><button className="tiny" onClick={onDelete} title="Eliminar paso">x</button></td>
    </tr>
  );
}

function ScenariosPanel({ state, selectScenario, setState }: { state: TestsState; selectScenario: (id: string) => void; setState: Dispatch<SetStateAction<TestsState>> }) {
  return <section className="card testsScenarioCard"><h2>Escenarios</h2><div className="testsScenarioList">{Object.entries(state.scenarios).map(([id, scenario]) => <button key={id} className={`testsScenarioItem ${id === state.selectedScenario ? "selected" : ""}`} onClick={() => selectScenario(id)}><span className={`scenarioIcon ${scenario.color}`}>{scenario.icon}</span><span><strong>{scenario.name}</strong><small>{scenario.desc}</small></span><i /></button>)}</div><button onClick={() => setState((current) => ({ ...current, managingScenarios: true }))}>Gestionar escenarios</button></section>;
}

function ScenarioManager({ state, setState, savePlan, defaultSlave }: { state: TestsState; setState: Dispatch<SetStateAction<TestsState>>; savePlan: () => void; defaultSlave: number }) {
  const scenario = state.scenarios[state.selectedScenario] || defaultScenarios.normal;
  const isDefault = defaultScenarioIds.has(state.selectedScenario);
  function patchScenario(patch: Partial<Scenario>) {
    setState((current) => ({ ...current, scenarios: { ...current.scenarios, [current.selectedScenario]: normalizeScenario({ ...current.scenarios[current.selectedScenario], ...patch }, current.scenarios[current.selectedScenario]) } }));
  }
  return (
    <section className="card testsScenarioCard testsScenarioManager">
      <h2>Gestionar escenarios</h2>
      <label>Escenario activo<select value={state.selectedScenario} onChange={(event) => { const id = event.target.value; setState((current) => ({ ...current, selectedScenario: id, steps: scenarioSteps(id, current.scenarios[id], defaultSlave), detailIndex: null })); }}>{Object.entries(state.scenarios).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>
      <label>Nombre<input value={scenario.name} onChange={(event) => patchScenario({ name: event.target.value })} /></label>
      <label>Descripcion<textarea value={scenario.desc} onChange={(event) => patchScenario({ desc: event.target.value })} /></label>
      <div className="twoCols"><label>Icono<input value={scenario.icon} onChange={(event) => patchScenario({ icon: event.target.value })} /></label><label>Color<select value={scenario.color} onChange={(event) => patchScenario({ color: event.target.value as ScenarioColor })}>{Object.entries(colorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <button onClick={savePlan}>Usar plan actual para este escenario</button>
      <div className="twoCols"><button onClick={() => { const id = `custom_${Date.now()}`; setState((current) => ({ ...current, selectedScenario: id, scenarios: { ...current.scenarios, [id]: normalizeScenario({ ...clone(scenario), name: `${scenario.name} copia`, steps: current.steps.map(stripStep) }) } })); }}>Duplicar</button>{isDefault ? <button onClick={() => setState((current) => { const base = defaultScenarios[current.selectedScenario] ?? defaultScenarios.normal; return { ...current, scenarios: { ...current.scenarios, [current.selectedScenario]: normalizeScenario(base, base) }, steps: scenarioSteps(current.selectedScenario, undefined, defaultSlave), detailIndex: null }; })}>Restaurar base</button> : <button onClick={() => setState((current) => { const scenarios = { ...current.scenarios }; delete scenarios[current.selectedScenario]; return { ...current, selectedScenario: "normal", scenarios, steps: scenarioSteps("normal", scenarios.normal, defaultSlave), detailIndex: null }; })}>Eliminar</button>}</div>
      <button onClick={() => { const id = `custom_${Date.now()}`; setState((current) => ({ ...current, selectedScenario: id, scenarios: { ...current.scenarios, [id]: normalizeScenario({ icon: "NEW", name: "Nuevo escenario", desc: "Escenario personalizado.", color: "cyan", steps: current.steps.map(stripStep) }) } })); }}>+ Nuevo escenario</button>
      <button className="primary" onClick={() => setState((current) => ({ ...current, managingScenarios: false }))}>Guardar y volver</button>
    </section>
  );
}

function SimulatorPanel({ state, setState, port, baud }: { state: TestsState; setState: Dispatch<SetStateAction<TestsState>>; port: string; baud: number }) {
  return <section className="card testsSimulatorCard"><h2>Simulador slave <small>(PC como slave)</small></h2><label>Estado<input disabled value={state.simulatorState} /></label><label>Direccion slave<input inputMode="numeric" defaultValue="1" /></label><label>Puerto<input disabled value={port || "Sin puerto"} /></label><label>Baud Rate<input disabled value={String(baud)} /></label><button className="purple" onClick={() => setState((current) => ({ ...current, simulatorState: current.simulatorState === "Detenido" ? "Preparado" : "Detenido" }))}>{state.simulatorState === "Detenido" ? "Preparar" : "Detener"} simulador slave</button><button disabled>Configurar</button></section>;
}

function KpiRingCard({ title, value, sub, tone, percent }: { title: string; value: string; sub: string; tone: "success" | "steps"; percent: number }) {
  const colors = { success: "#2ecc71", steps: "#00bcd4" };
  const size = 64;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <section className="card testsKpiCard testsKpiModern">
      <div style={{ width: size, height: size, position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
          <circle stroke="rgba(255,255,255,0.08)" fill="transparent" strokeWidth={strokeWidth} r={radius} cx={size / 2} cy={size / 2} />
          <circle stroke={colors[tone]} fill="transparent" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 0.5s ease' }} r={radius} cx={size / 2} cy={size / 2} />
        </svg>
        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', zIndex: 1, lineHeight: 1 }}>{value}</span>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
    </section>
  );
}

function KpiCard({ title, value, sub, tone, icon: Icon }: { title: string; value: string; sub: string; tone: "success" | "steps" | "danger" | "neutral"; icon: any }) {
  const colors = {
    success: "#2ecc71",
    steps: "#00bcd4",
    danger: "#e74c3c",
    neutral: "#95a5a6"
  };
  return (
    <section className="card testsKpiCard testsKpiModern">
      <div className={`testsKpiIconBox ${tone}`}>
        <Icon size={26} color={colors[tone]} strokeWidth={2.5} />
      </div>
      <div>
        <h3>{title}</h3>
        <strong className={tone === "danger" ? "danger" : ""}>{value}</strong>
        <p>{sub}</p>
      </div>
    </section>
  );
}

function ResultPill({ result }: { result: Result }) {
  const cls = result === "Aprobado" ? "ok" : result === "Ejecutando" ? "active" : result === "Pendiente" ? "pending" : result === "Timeout" || result === "CRC Error" || result === "Excepcion" ? "warn" : "bad";
  return <span className={`testsResult ${cls}`}>{result}</span>;
}

function ExecutionTable({ steps, onDetail }: { steps: TestStep[]; onDetail: (index: number) => void }) {
  return (
    <div className="testsExecutionTable">
      <table>
        <thead>
          <tr>
            <th>Hora</th>
            <th>Paso</th>
            <th>Slave</th>
            <th>Funcion</th>
            <th>Direccion</th>
            <th>Cantidad/Valor</th>
            <th>Resultado</th>
            <th>Tiempo</th>
            <th>Detalle</th>
            <th>Info</th>
          </tr>
        </thead>
        <tbody>
          {[...steps].map((step, originalIndex) => ({ step, originalIndex })).reverse().map(({ step, originalIndex }) => (
            <tr key={step.historyId || `${step.id}-${originalIndex}`}>
              <td>{step.at || "-"}</td>
              <td>{originalIndex + 1}</td>
              <td>Slave ID {step.slave || "-"}</td>
              <td>{labels[step.fn]}</td>
              <td>{step.address}</td>
              <td><ExecutionValue step={step} /></td>
              <td><ResultPill result={step.result} /></td>
              <td>{step.elapsedMs == null ? "-" : `${step.elapsedMs} ms`}</td>
              <td>{step.detail || "Pendiente de ejecucion."}</td>
              <td><button className="tiny" onClick={() => onDetail(originalIndex)}>Info</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExecutionValue({ step }: { step: TestStep }) {
  if (step.fn === "delay") {
    return <span style={{ color: "#fbbf24", fontFamily: "monospace", fontWeight: 600 }}>⏱ {step.value || "1000"} ms</span>;
  }
  if (step.fn === "fc2" && hasBitRows(step)) {
    return <BitPreview value={bitRowsValue(step.rows, "actual")} quantity={countFor(step)} readOnly emptyText="Sin lectura" />;
  }
  return <>{isRead(step.fn) ? countFor(step) : step.value}</>;
}

function BitCellValue({ value }: { value: string }) {
  if (!value || value === "-") return <>{value || "-"}</>;
  const isOn = normalizeBool(value);
  return <span className={`bitChip ${isOn ? "on" : "off"}`}>{isOn ? "ON" : "OFF"}</span>;
}

function StepDetail({ step, index, onClose }: { step: TestStep; index: number; onClose: () => void }) {
  const actualBitValue = hasBitRows(step) ? bitRowsValue(step.rows, "actual") : "";
  return (
    <div className="testsDetailPanel">
      <button className="tiny closeDetail" onClick={onClose}>Cerrar</button>
      <h2>Detalle del paso {index + 1}</h2>
      <p>{labels[step.fn]} - {step.detail || "Sin detalle."}</p>
      <div className="testsDetailFacts">
        <span><small>Funcion</small><strong>{labels[step.fn]}</strong></span>
        <span><small>Slave ID</small><strong>{step.slave}</strong></span>
        <span><small>Direccion inicial</small><strong>{step.address}</strong></span>
        <span><small>{isRead(step.fn) ? "Cantidad" : "Valor"}</small><strong>{isRead(step.fn) ? countFor(step) : step.value}</strong></span>
        <span><small>Validacion</small><strong>{validationLabels[step.validationMode]}</strong></span>
        <span><small>Resultado</small><strong>{step.result}</strong></span>
      </div>
      {step.fn === "fc2" && actualBitValue ? (
        <div className="bitReadout">
          <small>Entradas leidas</small>
          <BitPreview value={actualBitValue} quantity={countFor(step)} readOnly emptyText="Sin lectura" />
        </div>
      ) : null}
      <div className="testsExecutionTable testsDetailTable">
        <table>
          <thead>
            <tr>
              <th>Direccion</th>
              <th>Nombre</th>
              <th>Esperado</th>
              <th>Leido/Escrito</th>
              <th>Tipo</th>
              <th>Validacion</th>
            </tr>
          </thead>
          <tbody>
            {step.rows.length === 0 ? (
              <tr><td colSpan={6}>Este paso no tiene valores detallados.</td></tr>
            ) : step.rows.map((row) => (
              <tr key={`${row.address}-${row.name}`}>
                <td>{row.address}</td>
                <td>{row.name}</td>
                <td>{row.type === "bool" ? <BitCellValue value={row.expected} /> : row.expected}</td>
                <td>{row.type === "bool" ? <BitCellValue value={row.actual} /> : row.actual}</td>
                <td>{row.type}</td>
                <td className={row.validation === "OK" ? "oktext" : row.validation === "No coincide" ? "badstatus" : ""}>{row.validation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BitPreview({
  value,
  quantity,
  onClick,
  onChange,
  readOnly = false,
  emptyText = "OFF",
  isReadExpected = false
}: {
  value: string;
  quantity: number;
  onClick?: () => void;
  onChange?: (newValue: string) => void;
  readOnly?: boolean;
  emptyText?: string;
  isReadExpected?: boolean;
}) {
  let bits: boolean[] = [];
  try {
    bits = parseBoolList(value);
  } catch {
    bits = [];
  }
  const hasValue = splitValues(value).length > 0;
  const q = Math.max(1, quantity);
  const fullBits = Array.from({ length: Math.max(q, bits.length) }, (_, i) => !!bits[i]);
  const displayBits = fullBits.slice(0, 8);
  const hasMore = quantity > 8;
  const decValue = bitDecimal(fullBits.slice(0, Math.min(q, 16)));

  const toggleBitAt = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onChange || readOnly) return;
    const next = [...fullBits];
    next[i] = !next[i];
    onChange(next.slice(0, q).map(b => b ? "1" : "0").join(" "));
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#041727",
        border: "1px solid #2d5c75",
        borderRadius: "6px",
        padding: "3px 6px",
        width: "100%",
        height: "34px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", gap: "5px", alignItems: "center", overflow: "hidden", opacity: hasValue ? 1 : 0.45 }}>
        {isReadExpected && (
          <span style={{ fontSize: "0.68rem", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", padding: "1px 5px", borderRadius: "4px", color: "#9ec6e0", whiteSpace: "nowrap", marginRight: "2px", fontWeight: 600 }}>
            Esperado:
          </span>
        )}
        <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#fff", fontWeight: 600, marginRight: "8px", flexShrink: 0, minWidth: "45px", textAlign: "center", display: "inline-block" }}>
          {hasValue ? decValue : "-"}
        </span>
        {displayBits.map((b, i) => (
          <span
            key={i}
            onClick={(e) => toggleBitAt(i, e)}
            title={`Bit ${i}: ${b ? '1 (ON)' : '0 (OFF)'}${readOnly ? "" : " - Clic para alternar"}`}
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              display: "inline-block",
              background: b ? "#10b981" : "#253a4b",
              boxShadow: b && hasValue ? "0 0 6px #10b981" : "none",
              border: b ? "1px solid #6ee7b7" : "1px solid #1c2e3d",
              flexShrink: 0,
              cursor: onChange && !readOnly ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}
          />
        ))}
        {hasMore && <span style={{ color: "var(--muted)", fontSize: "0.68rem", marginLeft: "2px" }}>+{quantity - 8}</span>}
      </div>
      {onClick ? <button
        type="button"
        style={{
          minHeight: "24px",
          height: "24px",
          width: "24px",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 191, 255, 0.12)",
          border: "1px solid rgba(0, 191, 255, 0.45)",
          color: "var(--cyan)",
          borderRadius: "4px",
          cursor: "pointer",
          flexShrink: 0,
          fontSize: "0.9rem",
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClick();
        }}
      >
        ✎
      </button> : null}
    </div>
  );
}

function BitEditorModal({
  value,
  quantity,
  startAddress,
  fn,
  field,
  onClose,
  onApply
}: {
  value: string;
  quantity: number;
  startAddress: string;
  fn: Fn;
  field: "value" | "expected";
  onClose: () => void;
  onApply: (val: string, qty: number) => void;
}) {
  const copy = bitEditorCopy(fn, field);
  const [localQuantity, setLocalQuantity] = useState<number>(() => {
    const q = Math.max(1, Math.min(16, quantity || 16));
    return q;
  });

  const [bits, setBits] = useState<boolean[]>(() => {
    const arr = Array.from({ length: 16 }, () => false);
    try {
      const parsed = parseBoolList(value);
      for (let i = 0; i < 16; i++) {
        if (i < quantity && i < parsed.length) {
          arr[i] = !!parsed[i];
        }
      }
    } catch {}
    return arr;
  });

  const toggleBit = (index: number) => {
    if (index >= localQuantity) return;
    const next = [...bits];
    next[index] = !next[index];
    setBits(next);
  };

  const handleQuantityChange = (newQty: number) => {
    const clamped = Math.max(1, Math.min(16, newQty));
    setLocalQuantity(clamped);
    // When quantity decreases, turn off remaining bits
    setBits(prev => prev.map((b, i) => i < clamped ? b : false));
  };

  const setAll = (state: boolean) => {
    setBits(prev => prev.map((b, i) => i < localQuantity ? state : false));
  };

  const invert = () => {
    setBits(prev => prev.map((b, i) => i < localQuantity ? !b : false));
  };

  let decVal = 0;
  for (let i = 0; i < 16; i++) {
    if (i < localQuantity && bits[i]) {
      decVal |= (1 << i);
    }
  }

  const hexVal = "0x" + decVal.toString(16).toUpperCase().padStart(4, "0");

  let binVal = "";
  for (let i = 15; i >= 0; i--) {
    binVal += (i < localQuantity && bits[i]) ? "1" : "0";
    if (i > 0 && i % 4 === 0) binVal += " ";
  }

  const handleApply = () => {
    const valString = bits.slice(0, localQuantity).map(b => b ? "1" : "0").join(" ");
    onApply(valString, localQuantity);
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(2, 10, 18, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#071b2d",
          border: "1px solid #1c4b6e",
          borderRadius: "14px",
          padding: "22px 26px",
          width: "640px",
          maxWidth: "94vw",
          maxHeight: "90vh",
          boxShadow: "0 20px 50px rgba(0,0,0,0.95), 0 0 25px rgba(0,191,255,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          color: "#edf8ff",
          userSelect: "none"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Image 2 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(0,191,255,0.12)", border: "1px solid rgba(0,191,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cyan)", fontSize: "1.4rem" }}>
              ➿
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fff", fontWeight: 700 }}>{copy.title}</h2>
              <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                {copy.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="tiny ghost"
            style={{ minWidth: "30px", height: "30px", padding: 0, borderRadius: "50%", fontSize: "1rem", color: "var(--muted)" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Info & Quantity bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#051625", padding: "8px 14px", borderRadius: "8px", border: "1px solid #16364d" }}>
          <span style={{ fontSize: "0.86rem", color: "#edf8ff" }}>
            Inicio: <strong>{startAddress}</strong> <span style={{ color: "var(--muted)" }}>(offset {getModbusOffset(startAddress)})</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.86rem", color: "var(--muted)" }}>Cantidad:</span>
            <input 
              type="number" 
              min={1} 
              max={16} 
              value={localQuantity} 
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              style={{ width: "58px", height: "28px", textAlign: "center", background: "#082136", border: "1px solid #235475", borderRadius: "5px", color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}
            />
          </div>
        </div>

        {/* 16 Coils Grid (8x2) matching Image 2 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#051625", padding: "14px", borderRadius: "10px", border: "1px solid #16364d" }}>
          {/* Row 1: Coils 0 to 7 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "8px" }}>
            {Array.from({ length: 8 }, (_, i) => {
              const isActive = i < localQuantity;
              const isOn = isActive ? bits[i] : false;
              const addr = bitAddressLabel(fn, startAddress, i);

              return (
                <div 
                  key={i} 
                  style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: "6px",
                    opacity: isActive ? 1 : 0.3,
                    filter: isActive ? "none" : "grayscale(0.8)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span style={{ fontSize: "0.72rem", color: isActive ? "#9ec6e0" : "var(--muted)", fontFamily: "monospace", fontWeight: 600 }}>
                    {addr}
                  </span>
                  <div
                    onClick={() => toggleBit(i)}
                    style={{
                      width: "34px",
                      height: "19px",
                      borderRadius: "10px",
                      background: isOn ? "#10b981" : "#1b2f3f",
                      border: isOn ? "1px solid #34d399" : "1px solid #29475e",
                      boxShadow: isOn ? "0 0 8px rgba(16,185,129,0.6)" : "none",
                      position: "relative",
                      cursor: isActive ? "pointer" : "not-allowed",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div
                      style={{
                        width: "13px",
                        height: "13px",
                        borderRadius: "50%",
                        background: "#ffffff",
                        position: "absolute",
                        top: "2px",
                        left: isOn ? "17px" : "3px",
                        transition: "all 0.15s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.5)"
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 2: Coils 8 to 15 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "8px" }}>
            {Array.from({ length: 8 }, (_, i) => {
              const idx = i + 8;
              const isActive = idx < localQuantity;
              const isOn = isActive ? bits[idx] : false;
              const addr = bitAddressLabel(fn, startAddress, idx);

              return (
                <div 
                  key={idx} 
                  style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: "6px",
                    opacity: isActive ? 1 : 0.3,
                    filter: isActive ? "none" : "grayscale(0.8)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span style={{ fontSize: "0.72rem", color: isActive ? "#9ec6e0" : "var(--muted)", fontFamily: "monospace", fontWeight: 600 }}>
                    {addr}
                  </span>
                  <div
                    onClick={() => toggleBit(idx)}
                    style={{
                      width: "34px",
                      height: "19px",
                      borderRadius: "10px",
                      background: isOn ? "#10b981" : "#1b2f3f",
                      border: isOn ? "1px solid #34d399" : "1px solid #29475e",
                      boxShadow: isOn ? "0 0 8px rgba(16,185,129,0.6)" : "none",
                      position: "relative",
                      cursor: isActive ? "pointer" : "not-allowed",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div
                      style={{
                        width: "13px",
                        height: "13px",
                        borderRadius: "50%",
                        background: "#ffffff",
                        position: "absolute",
                        top: "2px",
                        left: isOn ? "17px" : "3px",
                        transition: "all 0.15s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.5)"
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acciones rápidas matching Image 2 */}
        <div>
          <span style={{ fontSize: "0.82rem", color: "var(--cyan)", fontWeight: 700, display: "block", marginBottom: "8px" }}>
            Acciones rápidas
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setAll(true)}
              style={{
                height: "36px",
                borderRadius: "8px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.35)",
                color: "#edf8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }}></span>
              Todo ON
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              style={{
                height: "36px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid #1f425c",
                color: "#edf8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", border: "1.5px solid var(--muted)" }}></span>
              Todo OFF
            </button>
            <button
              type="button"
              onClick={invert}
              style={{
                height: "36px",
                borderRadius: "8px",
                background: "rgba(0,191,255,0.08)",
                border: "1px solid rgba(0,191,255,0.35)",
                color: "#edf8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span style={{ color: "var(--cyan)", fontSize: "1.1rem" }}>⇄</span>
              Invertir
            </button>
          </div>
        </div>

        {/* Representación del patrón matching Image 2 */}
        <div>
          <span style={{ fontSize: "0.82rem", color: "var(--cyan)", fontWeight: 700, display: "block", marginBottom: "8px" }}>
            Representación del patrón
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.1fr 2fr", gap: "10px" }}>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>DEC (uint16)</span>
              <strong style={{ fontSize: "1.25rem", color: "#fff", fontFamily: "monospace" }}>{decVal}</strong>
            </div>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>HEX</span>
              <strong style={{ fontSize: "1.25rem", color: "var(--cyan)", fontFamily: "monospace" }}>{hexVal}</strong>
            </div>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>BIN (b15 ... b0)</span>
              <strong style={{ fontSize: "1.05rem", color: "#9ee6a5", fontFamily: "monospace", letterSpacing: "1px", lineHeight: "1.4" }}>{binVal}</strong>
            </div>
          </div>
        </div>

        {/* Footer buttons matching Image 2 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "6px" }}>
          <button
            type="button"
            className="ghost"
            style={{ minHeight: "36px", padding: "0 18px", fontSize: "0.88rem", borderRadius: "7px" }}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primary"
            style={{ minHeight: "36px", padding: "0 22px", fontSize: "0.88rem", borderRadius: "7px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 }}
            onClick={handleApply}
          >
            <span>✓</span>
            <span>Aplicar</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


function RegisterExpectedModal({
  step,
  onClose,
  onApply
}: {
  step: TestStep;
  onClose: () => void;
  onApply: (expected: string, validationMode: ValidationMode, newAddress: string, newQuantity: number) => void;
}) {
  const fn = step.fn;
  const [localAddress, setLocalAddress] = useState<string>(step.address || "40000");
  const [localQuantity, setLocalQuantity] = useState<number>(() => {
    return Math.max(1, Math.min(125, Number(step.quantity) || 1));
  });

  const offset = getModbusOffset(localAddress);

  const [validationMode, setValidationMode] = useState<ValidationMode>(
    step.validationMode === "exact" ? "exact" : (step.validationMode || "exact")
  );
  const [dataType, setDataType] = useState<"UInt16" | "Int16" | "Hex16">("UInt16");

  // Parse existing expected values
  const [values, setValues] = useState<number[]>(() => {
    const parts = splitValues(step.fn === "fc16" ? step.value : step.expected);
    const arr: number[] = [];
    for (let i = 0; i < localQuantity; i++) {
      const part = parts[i];
      if (part !== undefined && part !== "") {
        const num = part.toLowerCase().startsWith("0x") ? parseInt(part, 16) : parseInt(part, 10);
        arr.push(isNaN(num) ? 0 : num);
      } else {
        arr.push(i === 0 ? 100 : (i === 1 ? 200 : 0));
      }
    }
    return arr;
  });

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const startNum = parseInt(localAddress, 10) || 0;

  const handleQuantityChange = (newQty: number) => {
    const clamped = Math.max(1, Math.min(125, newQty));
    setLocalQuantity(clamped);
    setValues(prev => {
      const next: number[] = [];
      for (let i = 0; i < clamped; i++) {
        next.push(prev[i] !== undefined ? prev[i] : (i === 0 ? 100 : (i === 1 ? 200 : 0)));
      }
      return next;
    });
    if (selectedIndex >= clamped) {
      setSelectedIndex(clamped - 1);
    }
  };

  const updateValue = (index: number, rawInput: string) => {
    let num = 0;
    const trimmed = rawInput.trim();
    if (trimmed.toLowerCase().startsWith("0x")) {
      num = parseInt(trimmed, 16);
    } else {
      num = parseInt(trimmed, 10);
    }
    if (isNaN(num)) num = 0;
    setValues(prev => {
      const next = [...prev];
      next[index] = num;
      return next;
    });
  };

  // Selected register representations
  const currentVal = values[selectedIndex] ?? 0;
  const u16 = ((currentVal % 65536) + 65536) % 65536;
  const s16 = u16 > 32767 ? u16 - 65536 : u16;
  const hex = "0x" + u16.toString(16).toUpperCase().padStart(4, "0");
  const bin = u16.toString(2).padStart(16, "0").replace(/(.{4})/g, "$1 ").trim();

  const handleApply = () => {
    const formatted = values.slice(0, localQuantity).map(v => {
      const clamped = ((v % 65536) + 65536) % 65536;
      return dataType === "Hex16" 
        ? "0x" + clamped.toString(16).toUpperCase().padStart(4, "0") 
        : String(dataType === "Int16" ? (clamped > 32767 ? clamped - 65536 : clamped) : clamped);
    }).join(" ");
    onApply(formatted, validationMode, localAddress, localQuantity);
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(2, 10, 18, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#071b2d",
          border: "1px solid #1c4b6e",
          borderRadius: "14px",
          padding: "22px 26px",
          width: "530px",
          maxWidth: "94vw",
          maxHeight: "90vh",
          boxShadow: "0 20px 50px rgba(0,0,0,0.95), 0 0 25px rgba(0,191,255,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          color: "#edf8ff",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching modal styling */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "rgba(0,191,255,0.12)",
              border: "1px solid rgba(0,191,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cyan)",
              fontSize: "1.25rem"
            }}>
              ✎
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fff", fontWeight: 700 }}>{step.fn === "fc16" ? "Editar registros" : "Valor esperado"}</h2>
              <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                {fn.toUpperCase()} · {fn === "fc3" ? "Read Holding Registers" : fn === "fc4" ? "Read Input Registers" : labels[fn]}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="tiny ghost"
            style={{ minWidth: "30px", height: "30px", padding: 0, borderRadius: "50%", fontSize: "1rem", color: "var(--muted)" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Info bar with editable Inicio & Cantidad */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#051625",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid #16364d",
          fontSize: "0.86rem",
          gap: "10px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "var(--muted)" }}>Inicio:</span>
            <input
              type="text"
              value={localAddress}
              onChange={(e) => setLocalAddress(sanitizeNumericText(e.target.value, 8))}
              style={{
                width: "75px",
                height: "28px",
                textAlign: "center",
                background: "#082136",
                border: "1px solid #235475",
                borderRadius: "5px",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "0.88rem",
                fontFamily: "monospace"
              }}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>(offset {offset})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "var(--muted)" }}>Cantidad:</span>
            <input
              type="number"
              min={1}
              max={125}
              value={localQuantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              style={{
                width: "55px",
                height: "28px",
                textAlign: "center",
                background: "#082136",
                border: "1px solid #235475",
                borderRadius: "5px",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "0.88rem"
              }}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>registros</span>
          </div>
        </div>

        {/* Controls row: Tipo de dato & Validación */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
              Tipo de dato
            </label>
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value as any)}
              style={{
                width: "100%",
                background: "#051625",
                border: "1px solid #1e4b6c",
                borderRadius: "6px",
                color: "#fff",
                padding: "6px 10px",
                fontSize: "0.88rem"
              }}
            >
              <option value="UInt16">UInt16</option>
              <option value="Int16">Int16</option>
              <option value="Hex16">Hex16</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
              Validación
            </label>
            <select
              value={validationMode}
              onChange={(e) => setValidationMode(e.target.value as ValidationMode)}
              style={{
                width: "100%",
                background: "#051625",
                border: "1px solid #1e4b6c",
                borderRadius: "6px",
                color: "#fff",
                padding: "6px 10px",
                fontSize: "0.88rem"
              }}
            >
              <option value="exact">Valor exacto</option>
              <option value="response">Solo respuesta OK</option>
              <option value="byAddress">Por dirección</option>
            </select>
          </div>
        </div>

        {/* Valores esperados por registro */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#00c8ff" }}>
            Valores esperados por registro
          </span>
          <div style={{
            background: "#051625",
            border: "1px solid #16364d",
            borderRadius: "8px",
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--muted)", padding: "0 4px" }}>
              <span>Registro</span>
              <span>Valor esperado</span>
            </div>
            <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", paddingRight: "4px" }}>
              {values.slice(0, localQuantity).map((val, idx) => {
                const regAddr = startNum + idx;
                const isSelected = selectedIndex === idx;
                const displayVal = dataType === "Hex16"
                  ? "0x" + (((val % 65536) + 65536) % 65536).toString(16).toUpperCase().padStart(4, "0")
                  : dataType === "Int16"
                  ? (val > 32767 ? val - 65536 : val)
                  : (((val % 65536) + 65536) % 65536);

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedIndex(idx)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: isSelected ? "rgba(0, 191, 255, 0.1)" : "#031422",
                      border: isSelected ? "1px solid #00bfff" : "1px solid #14354c",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span style={{ fontSize: "0.86rem", fontFamily: "monospace", color: "#edf8ff" }}>
                      <strong>{regAddr}</strong> <span style={{ color: "var(--muted)", marginLeft: "6px" }}>[{idx}]</span>
                    </span>
                    <input
                      type={dataType === "Hex16" ? "text" : "number"}
                      value={displayVal}
                      onFocus={() => setSelectedIndex(idx)}
                      onChange={(e) => updateValue(idx, e.target.value)}
                      style={{
                        width: "160px",
                        height: "28px",
                        textAlign: "right",
                        padding: "2px 8px",
                        background: "#061a2b",
                        border: "1px solid #1e4b6c",
                        borderRadius: "5px",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        fontFamily: "monospace"
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Representaciones del seleccionado */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#00c8ff" }}>
            Representaciones del seleccionado
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>DEC (uint16)</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>{u16}</div>
            </div>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>DEC (int16)</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>{s16}</div>
            </div>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>HEX</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#00c8ff", fontFamily: "monospace" }}>{hex}</div>
            </div>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>BIN (16 bits)</div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#10b981", fontFamily: "monospace", letterSpacing: "1px" }}>{bin}</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
          <button
            type="button"
            style={{
              background: "#0c2338",
              border: "1px solid #1e4768",
              color: "#edf8ff",
              padding: "7px 18px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 600
            }}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            style={{
              background: "#0088ff",
              border: "none",
              color: "#fff",
              padding: "7px 22px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 700,
              boxShadow: "0 0 14px rgba(0, 136, 255, 0.45)"
            }}
            onClick={handleApply}
          >
            ✓ Aplicar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


function encodeFloat32Words(val: number, order: "ABCD" | "CDAB" | "BADC" | "DCBA") {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, val, false); // Big-endian
  const a = view.getUint8(0);
  const b = view.getUint8(1);
  const c = view.getUint8(2);
  const d = view.getUint8(3);

  const ieeeHex = "0x" + ((a << 24) | (b << 16) | (c << 8) | d).toString(16).toUpperCase().padStart(8, "0");

  let bytes: number[];
  switch (order) {
    case "ABCD": bytes = [a, b, c, d]; break;
    case "CDAB": bytes = [c, d, a, b]; break;
    case "BADC": bytes = [b, a, d, c]; break;
    case "DCBA": bytes = [d, c, b, a]; break;
    default: bytes = [a, b, c, d];
  }

  const w1 = (bytes[0] << 8) | bytes[1];
  const w2 = (bytes[2] << 8) | bytes[3];
  const hex1 = w1.toString(16).toUpperCase().padStart(4, "0");
  const hex2 = w2.toString(16).toUpperCase().padStart(4, "0");

  return {
    words: [w1, w2],
    previewHex: `${hex1} ${hex2}`,
    ieeeHex
  };
}

function Fc04ExpectedModal({
  step,
  onClose,
  onApply
}: {
  step: TestStep;
  onClose: () => void;
  onApply: (expected: string, validationMode: ValidationMode, newAddress: string, newQuantity: number, newDataType?: "Float32" | "UInt16" | "Int16" | "Int32" | "UInt32") => void;
}) {
  const [localAddress, setLocalAddress] = useState<string>(step.address || "30000");

  const [dataType, setDataType] = useState<"Float32" | "UInt16" | "Int16" | "Int32" | "UInt32">(() => {
    if (step.dataType && step.dataType !== "Hex16" && step.dataType !== "Bin16") return step.dataType;
    if (step.expected && !step.expected.includes(".") && Number(step.quantity) === 1) return "UInt16";
    return "Float32";
  });

  const is32Bit = (dt: string) => dt === "Float32" || dt === "Int32" || dt === "UInt32";

  const [localQuantity, setLocalQuantity] = useState<number>(() => {
    const initialDt = (step.dataType && step.dataType !== "Hex16" && step.dataType !== "Bin16") ? step.dataType : (step.expected && !step.expected.includes(".") && Number(step.quantity) === 1 ? "UInt16" : "Float32");
    const q = Number(step.quantity) || (is32Bit(initialDt) ? 2 : 1);
    return is32Bit(initialDt) ? Math.max(2, q) : Math.max(1, q);
  });

  const offset = getModbusOffset(localAddress);
  const startNum = parseInt(localAddress, 10) || 30000;
  const [order, setOrder] = useState<"ABCD" | "CDAB" | "BADC" | "DCBA">("ABCD");
  const [validationMode, setValidationMode] = useState<ValidationMode>(
    step.validationMode === "tolerance" ? "tolerance" : (step.validationMode || "tolerance")
  );

  // Parse initial target value and tolerance
  const [targetVal, setTargetVal] = useState<number>(() => {
    const match = String(step.expected || "").match(/([-+]?[0-9]*\.?[0-9]+)/);
    if (match) return parseFloat(match[1]);
    const initialDt = step.dataType || (step.expected && !step.expected.includes(".") && Number(step.quantity) === 1 ? "UInt16" : "Float32");
    return initialDt === "Float32" ? 25.50 : 100;
  });

  const [tolerance, setTolerance] = useState<number>(() => {
    const match = String(step.expected || "").match(/±\s*([0-9]*\.?[0-9]+)/);
    if (match) return parseFloat(match[1]);
    const initialDt = step.dataType || (step.expected && !step.expected.includes(".") && Number(step.quantity) === 1 ? "UInt16" : "Float32");
    return initialDt === "Float32" ? 0.10 : 5;
  });

  const handleDataTypeChange = (newType: "Float32" | "UInt16" | "Int16" | "Int32" | "UInt32") => {
    setDataType(newType);
    if (is32Bit(newType)) {
      if (localQuantity < 2) setLocalQuantity(2);
      if (newType === "Float32" && tolerance < 1 && tolerance === 0 && validationMode === "tolerance") {
        setTolerance(0.10);
      }
    } else {
      // 16-bit
      if (localQuantity === 2 && step.quantity !== "2") setLocalQuantity(1);
      if (validationMode === "tolerance" && tolerance < 1 && tolerance !== 0) {
        setTolerance(5);
      }
      setTargetVal(prev => Math.round(prev));
    }
  };

  let previewHex = "";
  let ieeeHex = "";
  let minRange = "";
  let maxRange = "";

  if (dataType === "Float32") {
    const fRes = encodeFloat32Words(targetVal, order);
    previewHex = fRes.previewHex;
    ieeeHex = fRes.ieeeHex;
    minRange = (targetVal - tolerance).toFixed(2);
    maxRange = (targetVal + tolerance).toFixed(2);
  } else if (dataType === "UInt16") {
    const u = ((Math.round(targetVal) % 65536) + 65536) % 65536;
    previewHex = "0x" + u.toString(16).toUpperCase().padStart(4, "0");
    ieeeHex = previewHex;
    minRange = String(Math.max(0, Math.round(targetVal - tolerance)));
    maxRange = String(Math.min(65535, Math.round(targetVal + tolerance)));
  } else if (dataType === "Int16") {
    const val = Math.round(targetVal);
    const u = ((val % 65536) + 65536) % 65536;
    previewHex = "0x" + u.toString(16).toUpperCase().padStart(4, "0");
    ieeeHex = previewHex;
    minRange = String(Math.max(-32768, Math.round(targetVal - tolerance)));
    maxRange = String(Math.min(32767, Math.round(targetVal + tolerance)));
  } else {
    const val = Math.round(targetVal);
    previewHex = "0x" + (val >>> 0).toString(16).toUpperCase().padStart(8, "0");
    ieeeHex = previewHex;
    minRange = String(Math.round(targetVal - tolerance));
    maxRange = String(Math.round(targetVal + tolerance));
  }

  const handleApply = () => {
    let expectedStr = "";
    if (dataType === "Float32") {
      if (validationMode === "tolerance") {
        expectedStr = `${targetVal.toFixed(2)} ± ${tolerance.toFixed(2)}`;
      } else if (validationMode === "exact") {
        expectedStr = targetVal.toFixed(2);
      }
    } else {
      const cleanTarget = Math.round(targetVal);
      const cleanTol = Math.round(tolerance);
      if (validationMode === "tolerance") {
        expectedStr = `${cleanTarget} ± ${cleanTol}`;
      } else if (validationMode === "exact") {
        expectedStr = String(cleanTarget);
      }
    }
    onApply(expectedStr, validationMode, localAddress, localQuantity, dataType);
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(2, 10, 18, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#071b2d",
          border: "1px solid #1c4b6e",
          borderRadius: "14px",
          padding: "22px 26px",
          width: "520px",
          maxWidth: "94vw",
          maxHeight: "90vh",
          boxShadow: "0 20px 50px rgba(0,0,0,0.95), 0 0 25px rgba(0,191,255,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          color: "#edf8ff",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "rgba(0,191,255,0.12)",
              border: "1px solid rgba(0,191,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cyan)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fff", fontWeight: 700 }}>Valor esperado</h2>
              <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                FC04 · Read Input Registers
              </p>
            </div>
          </div>
          <button
            type="button"
            className="tiny ghost"
            style={{ minWidth: "30px", height: "30px", padding: 0, borderRadius: "50%", fontSize: "1rem", color: "var(--muted)" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Info bar with editable Inicio & Cantidad */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#051625",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid #16364d",
          fontSize: "0.86rem",
          gap: "10px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "var(--muted)" }}>Inicio:</span>
            <input
              type="text"
              value={localAddress}
              onChange={(e) => setLocalAddress(sanitizeNumericText(e.target.value, 8))}
              style={{
                width: "75px",
                height: "28px",
                textAlign: "center",
                background: "#082136",
                border: "1px solid #235475",
                borderRadius: "5px",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "0.88rem",
                fontFamily: "monospace"
              }}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>(offset {offset})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "var(--muted)" }}>Cantidad:</span>
            <input
              type="number"
              min={1}
              max={125}
              value={localQuantity}
              onChange={(e) => setLocalQuantity(Math.max(1, Math.min(125, parseInt(e.target.value) || 2)))}
              style={{
                width: "55px",
                height: "28px",
                textAlign: "center",
                background: "#082136",
                border: "1px solid #235475",
                borderRadius: "5px",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "0.88rem"
              }}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>registros</span>
          </div>
        </div>

        {/* Controls row: Tipo de dato, Orden, Validación */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
              Tipo de dato
            </label>
            <select
              value={dataType}
              onChange={(e) => handleDataTypeChange(e.target.value as any)}
              style={{
                width: "100%",
                background: "#051625",
                border: "1px solid #1e4b6c",
                borderRadius: "6px",
                color: "#fff",
                padding: "6px 10px",
                fontSize: "0.88rem"
              }}
            >
              <option value="Float32">Float32</option>
              <option value="UInt16">UInt16</option>
              <option value="Int16">Int16</option>
              <option value="Int32">Int32</option>
              <option value="UInt32">UInt32</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
              Orden
            </label>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as any)}
              style={{
                width: "100%",
                background: "#051625",
                border: "1px solid #1e4b6c",
                borderRadius: "6px",
                color: "#fff",
                padding: "6px 10px",
                fontSize: "0.88rem"
              }}
            >
              <option value="ABCD">ABCD</option>
              <option value="CDAB">CDAB</option>
              <option value="BADC">BADC</option>
              <option value="DCBA">DCBA</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
              Validación
            </label>
            <select
              value={validationMode}
              onChange={(e) => {
                const newMode = e.target.value as ValidationMode;
                setValidationMode(newMode);
                if (newMode !== "tolerance") {
                  setTolerance(0);
                } else if (tolerance === 0) {
                  setTolerance(0.10);
                }
              }}
              style={{
                width: "100%",
                background: "#051625",
                border: "1px solid #1e4b6c",
                borderRadius: "6px",
                color: "#fff",
                padding: "6px 10px",
                fontSize: "0.88rem"
              }}
            >
              <option value="tolerance">Valor ± tolerancia</option>
              <option value="exact">Valor exacto</option>
              <option value="response">Solo respuesta OK</option>
            </select>
          </div>
        </div>

        {/* Inputs row: Valor esperado & Tolerancia */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
              Valor esperado
            </label>
            <input
              type="number"
              step={dataType === "Float32" ? "0.01" : "1"}
              value={dataType === "Float32" ? targetVal : Math.round(targetVal)}
              onChange={(e) => setTargetVal(parseFloat(e.target.value) || 0)}
              style={{
                width: "100%",
                height: "36px",
                background: "#051625",
                border: "1px solid #1e4b6c",
                borderRadius: "6px",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1.05rem",
                padding: "4px 10px"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
              Tolerancia {validationMode !== "tolerance" && <span style={{ fontSize: "0.74rem", color: "var(--muted)", marginLeft: "4px" }}>(bloqueada en 0)</span>}
            </label>
            <input
              type="number"
              step={dataType === "Float32" ? "0.01" : "1"}
              min="0"
              disabled={validationMode !== "tolerance"}
              value={validationMode !== "tolerance" ? 0 : tolerance}
              onChange={(e) => setTolerance(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{
                width: "100%",
                height: "36px",
                background: validationMode !== "tolerance" ? "#030f1a" : "#051625",
                border: validationMode !== "tolerance" ? "1px solid #142a3a" : "1px solid #1e4b6c",
                borderRadius: "6px",
                color: validationMode !== "tolerance" ? "var(--muted)" : "#fff",
                fontWeight: 700,
                fontSize: "1.05rem",
                padding: "4px 10px",
                opacity: validationMode !== "tolerance" ? 0.45 : 1,
                cursor: validationMode !== "tolerance" ? "not-allowed" : "text"
              }}
            />
          </div>
        </div>

        {/* Middle Preview Card */}
        <div style={{
          background: "#051625",
          border: "1px solid #16364d",
          borderRadius: "8px",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
              <div style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: "1px solid #00bfff",
                color: "#00bfff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700
              }}>
                ⓘ
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "var(--muted)" }}>Registros (direcciones)</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#edf8ff" }}>
                  {startNum} – {startNum + localQuantity - 1}
                </div>
              </div>
            </div>

            <div style={{ width: "1px", height: "36px", background: "#1c4b6e", margin: "0 16px" }} />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.74rem", color: "var(--muted)" }}>Vista previa (HEX)</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#00c8ff", fontFamily: "monospace" }}>
                {previewHex}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "2px" }}>
            El valor se codifica según el orden de bytes seleccionado ({order}).
          </div>
        </div>

        {/* Interpretación section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#00c8ff" }}>
            Interpretación
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr", gap: "8px" }}>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>{dataType}</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>{dataType === "Float32" ? targetVal.toFixed(2) : Math.round(targetVal)}</div>
            </div>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>Rango válido</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#10b981" }}>{validationMode === "exact" ? (dataType === "Float32" ? targetVal.toFixed(2) : Math.round(targetVal)) : `${minRange} – ${maxRange}`}</div>
            </div>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>IEEE754 HEX</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#00c8ff", fontFamily: "monospace" }}>{ieeeHex}</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
          <button
            type="button"
            style={{
              background: "#0c2338",
              border: "1px solid #1e4768",
              color: "#edf8ff",
              padding: "7px 18px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 600
            }}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            style={{
              background: "#0088ff",
              border: "none",
              color: "#fff",
              padding: "7px 22px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 700,
              boxShadow: "0 0 14px rgba(0, 136, 255, 0.45)"
            }}
            onClick={handleApply}
          >
            ✓ Aplicar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


function Fc06EditModal({
  step,
  onClose,
  onApply
}: {
  step: TestStep;
  onClose: () => void;
  onApply: (newValue: string, newAddress?: string, newDataType?: "UInt16" | "Int16" | "Hex16" | "Bin16") => void;
}) {
  const [localAddress, setLocalAddress] = useState<string>(step.address || "40001");
  const offset = getModbusOffset(localAddress);

  const [dataType, setDataType] = useState<"UInt16" | "Int16" | "Hex16" | "Bin16">(() => {
    if (step.dataType === "Int16" || step.dataType === "Hex16" || step.dataType === "Bin16") return step.dataType;
    return "UInt16";
  });

  // Numeric value 0..65535 internally
  const [currentNum, setCurrentNum] = useState<number>(() => {
    const raw = String(step.value || "1234").trim();
    if (raw.toLowerCase().startsWith("0x")) return parseInt(raw, 16) || 0;
    if (/^[01\s]+$/.test(raw) && raw.length >= 8) return parseInt(raw.replace(/\s+/g, ""), 2) || 0;
    const n = parseInt(raw, 10);
    return isNaN(n) ? 1234 : ((n % 65536) + 65536) % 65536;
  });

  // Derived representations
  const u16 = ((currentNum % 65536) + 65536) % 65536;
  const s16 = u16 > 32767 ? u16 - 65536 : u16;
  const hex = "0x" + u16.toString(16).toUpperCase().padStart(4, "0");
  const bin = u16.toString(2).padStart(16, "0").match(/.{1,4}/g)?.join(" ") || "0000 0000 0000 0000";

  // Text input representation
  const [inputValue, setInputValue] = useState<string>(() => {
    if (dataType === "Int16") return String(s16);
    if (dataType === "Hex16") return hex;
    if (dataType === "Bin16") return bin;
    return String(u16);
  });

  // When dataType changes, reformat input value
  const handleTypeChange = (newType: "UInt16" | "Int16" | "Hex16" | "Bin16") => {
    setDataType(newType);
    if (newType === "Int16") setInputValue(String(s16));
    else if (newType === "Hex16") setInputValue(hex);
    else if (newType === "Bin16") setInputValue(bin);
    else setInputValue(String(u16));
  };

  // When input value is typed
  const handleInputChange = (raw: string) => {
    setInputValue(raw);
    const trimmed = raw.trim();
    let num = 0;
    if (dataType === "Hex16" || trimmed.toLowerCase().startsWith("0x")) {
      num = parseInt(trimmed.replace(/^0x/i, ""), 16);
    } else if (dataType === "Bin16") {
      num = parseInt(trimmed.replace(/\s+/g, ""), 2);
    } else if (dataType === "Int16") {
      const signed = parseInt(trimmed, 10);
      num = isNaN(signed) ? 0 : ((signed % 65536) + 65536) % 65536;
    } else {
      num = parseInt(trimmed, 10);
    }
    if (!isNaN(num)) {
      setCurrentNum(((num % 65536) + 65536) % 65536);
    }
  };

  const applyQuick = (val: number) => {
    const clamped = ((val % 65536) + 65536) % 65536;
    setCurrentNum(clamped);
    const s = clamped > 32767 ? clamped - 65536 : clamped;
    const h = "0x" + clamped.toString(16).toUpperCase().padStart(4, "0");
    const b = clamped.toString(2).padStart(16, "0").match(/.{1,4}/g)?.join(" ") || "";
    if (dataType === "Int16") setInputValue(String(s));
    else if (dataType === "Hex16") setInputValue(h);
    else if (dataType === "Bin16") setInputValue(b);
    else setInputValue(String(clamped));
  };

  const handleApply = () => {
    let finalStr = String(u16);
    if (dataType === "Int16") finalStr = String(s16);
    else if (dataType === "Hex16") finalStr = hex;
    onApply(finalStr, localAddress, dataType);
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(2, 10, 18, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#071b2d",
          border: "1px solid #1c4b6e",
          borderRadius: "14px",
          padding: "22px 26px",
          width: "480px",
          maxWidth: "94vw",
          boxShadow: "0 20px 50px rgba(0,0,0,0.95), 0 0 25px rgba(0,191,255,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          color: "#edf8ff",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "rgba(0,191,255,0.12)",
              border: "1px solid rgba(0,191,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cyan)",
              fontSize: "1.1rem"
            }}>
              ✎
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.22rem", color: "#fff", fontWeight: 700 }}>Editar valor</h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                FC06 · Write Single Register
              </p>
            </div>
          </div>
          <button
            type="button"
            className="tiny ghost"
            style={{ minWidth: "30px", height: "30px", padding: 0, borderRadius: "50%", fontSize: "1rem", color: "var(--muted)" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Dirección bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          background: "#051625",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid #16364d",
          fontSize: "0.86rem",
          gap: "8px"
        }}>
          <span style={{ color: "var(--muted)" }}>Dirección:</span>
          <input
            type="text"
            value={localAddress}
            onChange={(e) => setLocalAddress(sanitizeNumericText(e.target.value, 8))}
            style={{
              width: "75px",
              height: "26px",
              textAlign: "center",
              background: "#082136",
              border: "1px solid #235475",
              borderRadius: "5px",
              color: "#fff",
              fontWeight: "bold",
              fontSize: "0.88rem",
              fontFamily: "monospace"
            }}
          />
          <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>(offset {offset})</span>
        </div>

        {/* Controls: Tipo de dato */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
            Tipo de dato
          </label>
          <select
            value={dataType}
            onChange={(e) => handleTypeChange(e.target.value as any)}
            style={{
              width: "100%",
              background: "#051625",
              border: "1px solid #1e4b6c",
              borderRadius: "6px",
              color: "#fff",
              padding: "6px 10px",
              fontSize: "0.88rem"
            }}
          >
            <option value="UInt16">UInt16</option>
            <option value="Int16">Int16</option>
            <option value="Hex16">Hex16</option>
            <option value="Bin16">Bin16</option>
          </select>
        </div>

        {/* Control: Valor */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
            Valor
          </label>
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              style={{
                width: "100%",
                height: "36px",
                background: "#051625",
                border: "1px solid #1e4b6c",
                borderRadius: "6px",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1.05rem",
                padding: "4px 10px",
                boxSizing: "border-box",
                fontFamily: "monospace"
              }}
            />
          </div>
        </div>

        {/* Representaciones equivalentes matching Image 2 */}
        <div>
          <span style={{ fontSize: "0.82rem", color: "#00c8ff", fontWeight: 700, display: "block", marginBottom: "8px" }}>
            Representaciones equivalentes
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>DEC (uint16)</span>
              <strong style={{ fontSize: "1.15rem", color: "#fff", fontFamily: "monospace" }}>{u16}</strong>
            </div>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>DEC (int16)</span>
              <strong style={{ fontSize: "1.15rem", color: "#00c8ff", fontFamily: "monospace" }}>{s16}</strong>
            </div>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>HEX</span>
              <strong style={{ fontSize: "1.15rem", color: "#00c8ff", fontFamily: "monospace" }}>{hex}</strong>
            </div>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>BIN (16 bits)</span>
              <strong style={{ fontSize: "0.95rem", color: "#10b981", fontFamily: "monospace", letterSpacing: "1px" }}>{bin}</strong>
            </div>
          </div>
        </div>

        {/* Acciones rápidas matching Image 2 */}
        <div>
          <span style={{ fontSize: "0.82rem", color: "#00c8ff", fontWeight: 700, display: "block", marginBottom: "8px" }}>
            Acciones rápidas
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <button
              type="button"
              onClick={() => applyQuick(0)}
              style={{
                height: "36px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid #1f425c",
                color: "#edf8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span>⊘</span>
              Cero
            </button>
            <button
              type="button"
              onClick={() => applyQuick(dataType === "Int16" ? 32767 : 65535)}
              style={{
                height: "36px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid #1f425c",
                color: "#edf8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span>↑</span>
              Máximo
            </button>
            <button
              type="button"
              onClick={() => applyQuick(dataType === "Int16" ? -32768 : 0)}
              style={{
                height: "36px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid #1f425c",
                color: "#edf8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span>↓</span>
              Mínimo
            </button>
          </div>
        </div>

        {/* Footer buttons matching Image 2 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
          <button
            type="button"
            style={{
              background: "#0c2338",
              border: "1px solid #1e4768",
              color: "#edf8ff",
              padding: "7px 18px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 600
            }}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            style={{
              background: "#0088ff",
              border: "none",
              color: "#fff",
              padding: "7px 22px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 700,
              boxShadow: "0 0 14px rgba(0, 136, 255, 0.45)"
            }}
            onClick={handleApply}
          >
            ✓ Aplicar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
