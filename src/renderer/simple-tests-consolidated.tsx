import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CheckCircle2, Activity, AlertTriangle, ListOrdered } from "lucide-react";

export type Fn = "fc1" | "fc2" | "fc3" | "fc4" | "fc5" | "fc6" | "fc15" | "fc16" | "delay";
export type Result = "Pendiente" | "Ejecutando" | "Aprobado" | "Timeout" | "CRC Error" | "Excepcion" | "Validacion fallida" | "Error";
export type ValidationMode = "response" | "count" | "exact" | "byAddress";
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
  byAddress: "Por direccion"
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
  return "1";
}

function defaultValue(fn: Fn) {
  if (fn === "fc5") return "ON";
  if (fn === "fc6") return "1234";
  if (fn === "fc15") return "1,0,1,0";
  if (fn === "fc16") return "10,20,30";
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
  return ["1", "true", "on", "si", "sí", "yes", "high"].includes(text);
}

function boolText(value: unknown) {
  return normalizeBool(value) ? "ON" : "OFF";
}

function parsePlanCoilValue(value: unknown, label = "Valor de bobina") {
  const text = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "on", "si", "sí", "yes", "high"].includes(text)) return true;
  if (["0", "false", "off", "no", "low"].includes(text)) return false;
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
    at: input.at || ""
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
    timeoutMs: normalized.timeoutMs
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

export function TestsView({ activeSlaveId, port, baud, runtimeState, resetKey, onRuntimeStateChange, onMessage }: TestsViewProps) {
  const defaultSlave = activeSlaveId ?? 2;
  const [state, setState] = useState<TestsState>(() => createInitialState(runtimeState, defaultSlave));
  const stateRef = useRef(state);
  const publishTimerRef = useRef<number | null>(null);
  const publishReadyRef = useRef(false);
  const onRuntimeStateChangeRef = useRef(onRuntimeStateChange);
  stateRef.current = state;

  useEffect(() => {
    onRuntimeStateChangeRef.current = onRuntimeStateChange;
  }, [onRuntimeStateChange]);

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
    const executed = active.filter((step) => isFinalResult(step.result));
    const responsive = executed.filter((step) => isResponsiveResult(step.result) && step.elapsedMs != null);
    const passed = executed.filter((step) => step.result === "Aprobado").length;
    const failed = executed.filter((step) => step.result !== "Aprobado").length;
    const timeouts = executed.filter((step) => step.result === "Timeout").length;
    const otherFailed = Math.max(0, failed - timeouts);
    const running = active.filter((step) => step.result === "Ejecutando").length;
    const avg = responsive.length ? Math.round(responsive.reduce((sum, step) => sum + (step.elapsedMs ?? 0), 0) / responsive.length) : null;
    const rate = executed.length ? Math.round((passed / executed.length) * 100) : 0;
    return { active: active.length, executed: executed.length, responsive: responsive.length, passed, failed, timeouts, otherFailed, running, avg, rate };
  }, [state.steps]);

  function patchStep(index: number, patch: Partial<TestStep>) {
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
    onMessage("Plan visible guardado en el escenario actual. Usa Guardar sesion para persistirlo en archivo.");
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

  async function runPlan(loop = false) {
    if (stateRef.current.running) return;
    setState((current) => ({ ...current, running: true, stopRequested: false, looping: loop, detailIndex: null }));

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
          setState((current) => ({ ...current, steps: current.steps.map((item, itemIndex) => itemIndex === index ? executedWithId : item), history: [...(current.history || []), executedWithId].slice(-100) }));
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
          setState((current) => ({ ...current, steps: current.steps.map((item, itemIndex) => itemIndex === index ? failed : item), history: [...(current.history || []), failed].slice(-100) }));
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
            <button onClick={() => setState((current) => ({ ...current, steps: [...current.steps, createStep(defaultSlave, "fc3", "40000", "1", "", "count")] }))}>+ Agregar paso</button>
            <button onClick={savePlanToScenario}>Guardar plan</button>
          </div>
        </div>
        <div className="testsPlanTable">
          <table>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '145px' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '35px' }} />
            </colgroup>
            <thead><tr><th>Activo</th><th>Paso</th><th>Slave</th><th>Funcion</th><th>Direccion</th><th>Cantidad</th><th>Valor</th><th>Validacion</th><th>Esperado</th><th>Timeout</th><th>Resultado</th><th /></tr></thead>
            <tbody>{state.steps.map((step, index) => <StepRow key={step.id} step={step} index={index} onPatch={(patch) => patchStep(index, patch)} onFn={(fn) => changeFn(index, fn)} onValue={(value) => changeValue(index, value)} onValidation={(mode) => changeValidation(index, mode)} onDelete={() => setState((current) => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index), detailIndex: null }))} onReorder={(from, to) => { if (from === to) return; setState((current) => { const steps = [...current.steps]; const [moved] = steps.splice(from, 1); steps.splice(to, 0, moved); return { ...current, steps, detailIndex: null }; }); }} />)}</tbody>
          </table>
        </div>
        <p className="testsInfo">Cantidad se usa en lecturas. Valor se usa en escrituras. Validacion define si basta respuesta/cantidad o si se comparan valores exactos.</p>
      </section>

      <div className="testsSide">
        {state.managingScenarios ? <ScenarioManager state={state} setState={setState} savePlan={savePlanToScenario} defaultSlave={defaultSlave} /> : <ScenariosPanel state={state} selectScenario={selectScenario} setState={setState} />}
        <SimulatorPanel state={state} setState={setState} port={port} baud={baud} />
      </div>

      <div className="testsKpis">
        <KpiRingCard title="Tasa de exito" value={`${summary.rate}%`} sub={summary.executed ? `Ultima ejecucion: ${summary.passed}/${summary.executed} aprobados` : "Sin ejecucion"} tone="success" percent={summary.rate || 0} />
        <KpiCard title="Latencia promedio" value={summary.avg == null ? "-" : `${summary.avg} ms`} sub={summary.responsive ? `Ultima ejecucion: ${summary.responsive} respuesta(s)${summary.timeouts ? `; ${summary.timeouts} timeout(s) excluidos` : ""}` : summary.running ? "Esperando respuesta" : "Sin datos todavia"} tone="neutral" icon={Activity} />
        <KpiCard title="Errores" value={String(summary.failed)} sub={summary.failed ? `${summary.timeouts} timeout(s), ${summary.otherFailed} otro(s)` : "Ultima ejecucion"} tone={summary.failed > 0 ? "danger" : "neutral"} icon={AlertTriangle} />
        <KpiRingCard title="Pasos completados" value={`${summary.executed}/${summary.active}`} sub={summary.running ? `${summary.running} en curso` : "Ultima ejecucion"} tone="steps" percent={summary.active > 0 ? (summary.executed / summary.active) * 100 : 0} />
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

function StepRow({ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onValidation: (mode: ValidationMode) => void; onDelete: () => void; onReorder: (from: number, to: number) => void }) {
  const read = isRead(step.fn);
  const expectedDisabled = step.validationMode === "response" || step.validationMode === "count";
  const modeOptions: ValidationMode[] = isWrite(step.fn) ? ["response", "exact", "byAddress"] : ["count", "exact", "byAddress"];
  return (
    <tr draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", index.toString()); e.dataTransfer.effectAllowed = "move"; }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); const from = Number(e.dataTransfer.getData("text/plain")); onReorder(from, index); }}>
      <td><input type="checkbox" checked={step.enabled} onChange={(event) => onPatch({ enabled: event.target.checked })} /></td>
      <td style={{ cursor: 'grab' }} title="Arrastra para reordenar">☰ {index + 1}</td>
      <td><input inputMode="numeric" disabled={step.fn === "delay"} value={step.fn === "delay" ? "-" : step.slave} onChange={(event) => onPatch({ slave: event.target.value.replace(/\D/g, "").slice(0, 3) })} onBlur={() => onPatch({ slave: clampSlave(step.slave, 2) })} /></td>
      <td><select value={step.fn} onChange={(event) => onFn(event.target.value as Fn)}>{functionOrder.map((fn) => <option key={fn} value={fn}>{labels[fn]}</option>)}</select></td>
      <td><input inputMode="numeric" disabled={step.fn === "delay"} value={step.fn === "delay" ? "-" : step.address} onChange={(event) => onPatch({ address: sanitizeNumericText(event.target.value, 8) })} /></td>
      <td><input inputMode="numeric" disabled={!read || step.fn === "delay"} value={step.fn === "delay" ? "-" : (read ? step.quantity : countFor(step))} onChange={(event) => onPatch({ quantity: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></td>
      <td><input disabled={read && step.fn !== "delay"} value={read && step.fn !== "delay" ? "-" : step.value} onChange={(event) => onValue(event.target.value)} /></td>
      <td><select disabled={step.fn === "delay"} value={step.validationMode} onChange={(event) => onValidation(event.target.value as ValidationMode)}>{modeOptions.map((mode) => <option key={mode} value={mode}>{validationLabels[mode]}</option>)}</select></td>
      <td><input disabled={expectedDisabled || step.fn === "delay"} value={step.fn === "delay" ? "-" : (expectedDisabled ? expectedAutoText(step) : step.expected)} placeholder={expectedAutoText(step)} onChange={(event) => onPatch({ expected: event.target.value })} /></td>
      <td><input inputMode="numeric" disabled={step.fn === "delay"} value={step.fn === "delay" ? "-" : step.timeoutMs} onChange={(event) => onPatch({ timeoutMs: event.target.value.replace(/\D/g, "").slice(0, 5) })} /></td>
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
  return <div className="testsExecutionTable"><table><thead><tr><th>Hora</th><th>Paso</th><th>Slave</th><th>Funcion</th><th>Direccion</th><th>Cantidad/Valor</th><th>Resultado</th><th>Tiempo</th><th>Detalle</th><th>Info</th></tr></thead><tbody>{[...steps].map((step, originalIndex) => ({ step, originalIndex })).reverse().map(({ step, originalIndex }) => <tr key={step.historyId || `${step.id}-${originalIndex}`}><td>{step.at || "-"}</td><td>{originalIndex + 1}</td><td>Slave ID {step.slave || "-"}</td><td>{labels[step.fn]}</td><td>{step.address}</td><td>{isRead(step.fn) ? countFor(step) : step.value}</td><td><ResultPill result={step.result} /></td><td>{step.elapsedMs == null ? "-" : `${step.elapsedMs} ms`}</td><td>{step.detail || "Pendiente de ejecucion."}</td><td><button className="tiny" onClick={() => onDetail(originalIndex)}>Info</button></td></tr>)}</tbody></table></div>;
}

function StepDetail({ step, index, onClose }: { step: TestStep; index: number; onClose: () => void }) {
  return <div className="testsDetailPanel"><button className="tiny closeDetail" onClick={onClose}>Cerrar</button><h2>Detalle del paso {index + 1}</h2><p>{labels[step.fn]} - {step.detail || "Sin detalle."}</p><div className="testsDetailFacts"><span><small>Funcion</small><strong>{labels[step.fn]}</strong></span><span><small>Slave ID</small><strong>{step.slave}</strong></span><span><small>Direccion inicial</small><strong>{step.address}</strong></span><span><small>{isRead(step.fn) ? "Cantidad" : "Valor"}</small><strong>{isRead(step.fn) ? countFor(step) : step.value}</strong></span><span><small>Validacion</small><strong>{validationLabels[step.validationMode]}</strong></span><span><small>Resultado</small><strong>{step.result}</strong></span></div><div className="testsExecutionTable testsDetailTable"><table><thead><tr><th>Direccion</th><th>Nombre</th><th>Esperado</th><th>Leido/Escrito</th><th>Tipo</th><th>Validacion</th></tr></thead><tbody>{step.rows.length === 0 ? <tr><td colSpan={6}>Este paso no tiene valores detallados.</td></tr> : step.rows.map((row) => <tr key={`${row.address}-${row.name}`}><td>{row.address}</td><td>{row.name}</td><td>{row.expected}</td><td>{row.type === "bool" ? <span className={`bitChip ${normalizeBool(row.actual) ? "on" : "off"}`}>{row.actual}</span> : row.actual}</td><td>{row.type}</td><td className={row.validation === "OK" ? "oktext" : row.validation === "No coincide" ? "badstatus" : ""}>{row.validation}</td></tr>)}</tbody></table></div></div>;
}
