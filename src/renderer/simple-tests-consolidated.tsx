import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

export {};

type Fn = "fc1" | "fc2" | "fc3" | "fc4" | "fc5" | "fc6" | "fc15" | "fc16";
type Result = "Aprobado" | "Pendiente" | "Timeout" | "CRC Error" | "Excepción" | "Validación fallida" | "Error";
type ExpectedMode = "response" | "count" | "exact" | "byAddress";
type ScenarioColor = "shield" | "clock" | "warn" | "bad" | "cyan";

interface TestRowDetail {
  address: number;
  name: string;
  expected: string;
  actual: string;
  type: "bool" | "uint16";
  validation: "OK" | "No coincide" | "Sin criterio";
  ok: boolean;
}

interface TestStep {
  on: boolean;
  slave: number;
  fn: Fn;
  addr: number;
  count: string;
  value: string;
  expectedMode: ExpectedMode;
  expectedValue: string;
  to: number;
  res: Result;
  ms: number | null;
  detail: string;
  rows: TestRowDetail[];
  values: string;
  at: string;
}

interface Scenario {
  icon: string;
  name: string;
  desc: string;
  color: ScenarioColor;
  steps?: TestStep[];
}

interface TestsState {
  sc: string;
  sim: "Detenido" | "Preparado";
  steps: TestStep[];
  log: Array<TestStep & { index: number }>;
  running: boolean;
  stopped: boolean;
  manage: boolean;
  detail: number | null;
  scenarios: Record<string, Scenario>;
}

interface RuntimeState {
  format: typeof runtimeFormat;
  version: number;
  savedAt: string;
  selectedScenario: string;
  simulatorState: TestsState["sim"];
  steps: TestStep[];
  scenarios: Record<string, Scenario>;
}

declare global {
  interface Window {
    jwModbus?: any;
    __jwSimpleTestsRuntimeState?: { export: () => RuntimeState; import: (data: unknown) => boolean };
    __jwPendingTestsRuntimeState?: unknown;
  }
}

const overlayId = "jw-simple-tests-consolidated";
const styleId = "jw-simple-tests-consolidated-style";
const storageKey = "jw-modbus-tool.simple.tests-runtime.v1";
const runtimeFormat = "jwmodbus-tests-runtime";

const F: Record<Fn, string> = {
  fc1: "FC01 Read Coils",
  fc2: "FC02 Read Discrete Inputs",
  fc3: "FC03 Read Holding Registers",
  fc4: "FC04 Read Input Registers",
  fc5: "FC05 Write Single Coil",
  fc6: "FC06 Write Single Register",
  fc15: "FC15 Write Multiple Coils",
  fc16: "FC16 Write Multiple Registers"
};

const functionOrder: Fn[] = ["fc1", "fc2", "fc3", "fc4", "fc5", "fc6", "fc15", "fc16"];
const readFns = new Set<Fn>(["fc1", "fc2", "fc3", "fc4"]);
const bitFns = new Set<Fn>(["fc1", "fc2", "fc5", "fc15"]);
const defaultScenarioIds = new Set(["normal", "timeout", "crc", "exception"]);

const validationModes: Record<ExpectedMode, string> = {
  response: "Respuesta OK",
  count: "Cantidad solicitada",
  exact: "Valores exactos",
  byAddress: "Por dirección"
};

const defaultScenarios: Record<string, Scenario> = {
  normal: { icon: "🛡", name: "Operación normal", desc: "Verifica lectura y escritura correcta.", color: "shield" },
  timeout: { icon: "⏱", name: "Timeout detectado", desc: "Simula dispositivos no disponibles.", color: "clock" },
  crc: { icon: "⚠", name: "Error CRC detectado", desc: "Introduce errores de CRC en la trama.", color: "warn" },
  exception: { icon: "✖", name: "Excepción Modbus", desc: "Fuerza códigos de excepción (01, 02, 03).", color: "bad" }
};

const colorOptions: Record<ScenarioColor, string> = {
  shield: "Verde",
  clock: "Naranja",
  warn: "Amarillo",
  bad: "Rojo",
  cyan: "Azul"
};

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function api() { return window.jwModbus; }
function workspace() { return document.querySelector(".workspace") as HTMLElement | null; }
function activeTestsView() { return Boolean(document.querySelector(".sidebar button.active")?.textContent?.includes("Pruebas")); }
function statusText() { return document.querySelector(".status")?.textContent || ""; }
function statusParts() { return Array.from(document.querySelectorAll(".status span")).map((item) => item.textContent?.trim() || "").filter(Boolean); }
function port() { return statusParts().find((value) => /^COM\d+$/i.test(value)) || /COM\d{1,3}/i.exec(statusText())?.[0] || "COM3"; }
function baud() { return statusParts().find((value) => /^(9600|19200|38400|57600|115200|230400)$/.test(value)) || /\b(9600|19200|38400|57600|115200|230400)\b/.exec(statusText())?.[1] || "115200"; }
function sid() { const match = /Slave activo ID\s*(\d+)/i.exec(statusText()); return match ? Number(match[1]) : 2; }
function isRead(fn: Fn) { return readFns.has(fn); }
function isWrite(fn: Fn) { return !readFns.has(fn); }
function raw(fn: Fn, address: number) { if (["fc3", "fc6", "fc16"].includes(fn) && address >= 40000) return address - 40000; if (fn === "fc4" && address >= 30000) return address - 30000; if (fn === "fc2" && address >= 10000) return address - 10000; return address; }
function displayAddress(fn: Fn, base: number, index = 0) { const value = Number(base || 0) + index; if (["fc3", "fc6", "fc16"].includes(fn)) return value >= 40000 ? value : 40000 + value; if (fn === "fc4") return value >= 30000 ? value : 30000 + value; if (fn === "fc2") return value >= 10000 ? value : 10000 + value; return value; }
function def(fn: Fn) { if (["fc3", "fc6", "fc16"].includes(fn)) return 40000; if (fn === "fc4") return 30000; if (fn === "fc2") return 10000; return 0; }
function defaultCount(fn: Fn) { if (fn === "fc1" || fn === "fc2") return "8"; if (fn === "fc3" || fn === "fc4") return "1"; if (fn === "fc15") return "4"; if (fn === "fc16") return "3"; return "1"; }
function defaultValue(fn: Fn) { if (fn === "fc5") return "ON"; if (fn === "fc6") return "1234"; if (fn === "fc15") return "1,0,1,0"; if (fn === "fc16") return "100,200,300"; return ""; }
function defaultMode(fn: Fn): ExpectedMode { return isWrite(fn) ? "response" : "count"; }
function normalizeBool(value: unknown) { const s = String(value ?? "").trim().toLowerCase(); return ["1", "true", "on", "sí", "si", "high"].includes(s); }
function boolText(value: unknown) { return normalizeBool(value) ? "ON" : "OFF"; }
function parseBoolList(value: unknown) { return String(value ?? "").split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean).map(normalizeBool); }
function parseRegList(value: unknown) { return String(value ?? "").split(/[;,\s]+/).map((x) => Number(x.trim())).filter(Number.isFinite); }
function countNumber(step: TestStep) { if (isRead(step.fn)) { const n = Number(step.count); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1; } if (step.fn === "fc15") return parseBoolList(step.value).length || 1; if (step.fn === "fc16") return parseRegList(step.value).length || 1; return 1; }
function expectedAutoText(step: TestStep) { if (step.expectedMode === "response") return "OK"; if (step.expectedMode === "count") { const suffix = step.fn === "fc1" ? "coils" : step.fn === "fc2" ? "bits" : "regs"; return `${countNumber(step)} ${suffix}`; } return step.expectedValue || ""; }
function inferMode(fn: Fn, exp: unknown): ExpectedMode { const text = String(exp ?? "").trim(); if (!text) return defaultMode(fn); if (/^ok$/i.test(text)) return "response"; if (/^\d+\s*(regs?|coils?|bits?)$/i.test(text)) return "count"; if (text.includes("=")) return "byAddress"; return "exact"; }
function inferExpectedValue(exp: unknown) { const text = String(exp ?? "").trim(); if (!text || /^ok$/i.test(text) || /^\d+\s*(regs?|coils?|bits?)$/i.test(text)) return ""; return text; }

function cleanStep(input: Partial<TestStep> & { amount?: unknown; exp?: unknown } = {}): TestStep {
  const fn: Fn = F[input.fn as Fn] ? input.fn as Fn : "fc3";
  const mode = (input.expectedMode && validationModes[input.expectedMode]) ? input.expectedMode : inferMode(fn, input.exp);
  return {
    on: input.on !== false,
    slave: Math.max(1, Math.min(247, parseInt(String(input.slave ?? sid()), 10) || 2)),
    fn,
    addr: Number.isFinite(Number(input.addr)) ? Number(input.addr) : def(fn),
    count: String(input.count ?? (isRead(fn) ? input.amount ?? defaultCount(fn) : defaultCount(fn))),
    value: String(input.value ?? (isWrite(fn) ? input.amount ?? defaultValue(fn) : "")),
    expectedMode: mode,
    expectedValue: String(input.expectedValue ?? inferExpectedValue(input.exp)),
    to: Number.isFinite(Number(input.to)) ? Number(input.to) : Number((input as any).timeout) || 1000,
    res: input.res || (input as any).result || "Pendiente",
    ms: input.ms ?? null,
    detail: input.detail || "",
    rows: Array.isArray(input.rows) ? input.rows : [],
    values: input.values || "",
    at: input.at || ""
  };
}

function mk(slave: number, fn: Fn, addr: number, count: string, value: string, mode = defaultMode(fn), expectedValue = "", to = 1000) { return cleanStep({ on: true, slave, fn, addr, count, value, expectedMode: mode, expectedValue, to }); }
function cloneStep(step: TestStep) { return cleanStep({ ...step, res: "Pendiente", ms: null, detail: "", values: "", rows: [], at: "" }); }
function defaultPlan(slave = sid()) { return [mk(slave, "fc6", 40000, "1", "1234", "response"), mk(slave, "fc3", 40000, "1", "", "exact", "1234"), mk(slave, "fc5", 0, "1", "ON", "response"), mk(slave, "fc15", 0, "4", "1,0,1,0", "response"), mk(slave, "fc16", 40020, "3", "10,20,30", "response"), mk(slave, "fc4", 30000, "8", "", "count"), mk(slave, "fc1", 0, "8", "", "count"), mk(slave, "fc2", 0, "8", "", "count")]; }
function normalizeScenario(input: Partial<Scenario> | undefined, fallback = defaultScenarios.normal): Scenario { return { icon: String(input?.icon ?? fallback.icon ?? "🧪").slice(0, 4), name: String(input?.name ?? fallback.name ?? "Escenario"), desc: String(input?.desc ?? fallback.desc ?? "Escenario de prueba."), color: colorOptions[input?.color as ScenarioColor] ? input!.color as ScenarioColor : fallback.color, steps: Array.isArray(input?.steps) ? input!.steps!.map((step) => cleanStep(step)) : undefined }; }
function normalizeScenarios(input: unknown): Record<string, Scenario> { const result: Record<string, Scenario> = clone(defaultScenarios); if (!input || typeof input !== "object") return result; for (const [key, value] of Object.entries(input as Record<string, Scenario>)) { const safeKey = defaultScenarioIds.has(key) ? key : key.replace(/[^\w-]/g, "_") || `custom_${Date.now()}`; result[safeKey] = normalizeScenario(value, result[safeKey]); } return result; }
function exportRuntimeState(state: TestsState): RuntimeState { return { format: runtimeFormat, version: 3, savedAt: new Date().toISOString(), selectedScenario: state.sc, simulatorState: state.sim, steps: state.steps.map(cleanStep), scenarios: normalizeScenarios(state.scenarios) }; }
function importRuntimeState(data: unknown): Partial<TestsState> | null { const src = (data as any)?.format === runtimeFormat ? data as RuntimeState : (data as any)?.testsRuntime; if (!src || src.format !== runtimeFormat || !Array.isArray(src.steps)) return null; const scenarios = normalizeScenarios(src.scenarios); return { scenarios, sc: scenarios[src.selectedScenario] ? src.selectedScenario : "normal", sim: src.simulatorState || "Detenido", steps: src.steps.map(cleanStep), log: [], detail: null, manage: false, running: false, stopped: false }; }
function readStored(): Partial<TestsState> | null { try { const rawValue = localStorage.getItem(storageKey); if (!rawValue) return null; return importRuntimeState(JSON.parse(rawValue)); } catch { return null; } }
function initialState(): TestsState { const imported = importRuntimeState(window.__jwPendingTestsRuntimeState) || readStored(); return { sc: "normal", sim: "Detenido", steps: defaultPlan(), log: [], running: false, stopped: false, manage: false, detail: null, scenarios: clone(defaultScenarios), ...imported } as TestsState; }

function nameFor(fn: Fn, address: number) { if (fn === "fc1" || fn === "fc5" || fn === "fc15") return `Q0_${raw(fn, address)}`; if (fn === "fc2") return `I0_${raw(fn, address)}`; const names: Record<number, string> = { 40000: "Velocidad_Ref (RPM)", 40001: "Estado_Variador", 40002: "Corriente_Salida (A)", 40003: "Tension_DC (V)", 40004: "Temp_Disipador (°C)", 40005: "Horas_Marcha (h)", 40008: "Frecuencia_Salida (Hz)", 40009: "Estado_Alarma", 30000: "Input_Reg_0", 30001: "Input_Reg_1", 30002: "Input_Reg_2", 30003: "Input_Reg_3" }; return names[address] || `Reg_${address}`; }
function expectedMap(step: TestStep) { const map = new Map<number, string>(); if (step.expectedMode !== "byAddress") return map; for (const part of String(step.expectedValue || "").split(/[;,]+/)) { const [left, right] = part.split("=").map((x) => x?.trim()); const address = Number(left); if (Number.isFinite(address) && right != null) map.set(address, right); } return map; }
function expectedSeq(step: TestStep) { if (step.expectedMode !== "exact") return []; return String(step.expectedValue || "").split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean); }
function sameValue(actual: string, expected: string, isBit: boolean) { if (expected == null || expected === "" || expected === "—") return true; if (isBit) return normalizeBool(actual) === normalizeBool(expected); return Number(actual) === Number(expected); }
function extractValues(action: any, register = false): unknown[] { const candidates = register ? [action?.registerValues, action?.values, action?.data, action?.response?.registerValues, action?.response?.values] : [action?.values, action?.registerValues, action?.data, action?.response?.values]; const found = candidates.find(Array.isArray); return Array.isArray(found) ? found : []; }

function buildRows(step: TestStep, action: any): TestRowDetail[] {
  const rows: TestRowDetail[] = [];
  const isBit = bitFns.has(step.fn);
  const seq = expectedSeq(step);
  const byAddr = expectedMap(step);
  const qty = countNumber(step);
  let actualValues: unknown[] = [];
  if (step.fn === "fc1" || step.fn === "fc2") actualValues = extractValues(action, false);
  if (step.fn === "fc3" || step.fn === "fc4") actualValues = extractValues(action, true);
  if (step.fn === "fc5") actualValues = [normalizeBool(step.value)];
  if (step.fn === "fc6") actualValues = [Number(step.value)];
  if (step.fn === "fc15") actualValues = parseBoolList(step.value);
  if (step.fn === "fc16") actualValues = parseRegList(step.value);
  const total = isRead(step.fn) ? Math.max(qty, actualValues.length) : actualValues.length;
  for (let i = 0; i < total; i += 1) {
    const address = displayAddress(step.fn, step.addr, i);
    const actualRaw = actualValues[i];
    const actual = isBit ? boolText(actualRaw) : String(actualRaw ?? "");
    const expected = byAddr.has(address) ? byAddr.get(address)! : seq[i] ?? "";
    const hasCriterion = step.expectedMode === "exact" || step.expectedMode === "byAddress";
    const ok = hasCriterion ? sameValue(actual, expected, isBit) : true;
    rows.push({ address, name: nameFor(step.fn, address), expected: hasCriterion ? expected || "—" : "—", actual: actual || "—", type: isBit ? "bool" : "uint16", validation: hasCriterion ? (ok ? "OK" : "No coincide") : "Sin criterio", ok });
  }
  return rows;
}

function validate(step: TestStep, action: any, rows: TestRowDetail[]) {
  if (action?.exception) return { result: "Excepción" as Result, detail: action.exception.exceptionName || "Excepción Modbus." };
  if (action && action.crcOk === false) return { result: "CRC Error" as Result, detail: "La respuesta fue marcada como CRC inválido." };
  const qty = countNumber(step);
  if (step.expectedMode === "response") return { result: "Aprobado" as Result, detail: "Respuesta Modbus recibida correctamente." };
  if (step.expectedMode === "count") {
    const got = step.fn === "fc1" || step.fn === "fc2" ? extractValues(action, false).length : step.fn === "fc3" || step.fn === "fc4" ? extractValues(action, true).length : qty;
    const ok = got >= qty;
    const label = step.fn === "fc1" ? "coils" : step.fn === "fc2" ? "bits" : "registros";
    return { result: ok ? "Aprobado" as Result : "Validación fallida" as Result, detail: ok ? `${qty} ${label} leídos correctamente.` : `Se esperaban ${qty} valores y llegaron ${got}.` };
  }
  const allOk = rows.every((row) => row.ok);
  return { result: allOk ? "Aprobado" as Result : "Validación fallida" as Result, detail: allOk ? "Validación de valores OK." : "Uno o más valores no coinciden con lo esperado." };
}

async function executeStep(step: TestStep) {
  const started = performance.now();
  const commandBase = { unitId: step.slave, timeoutMs: Number(step.to) || 1000 };
  const modbus = api()?.modbus;
  if (!modbus) throw new Error("Backend Modbus no disponible.");
  let action: any;
  if (step.fn === "fc1") action = await modbus.readCoils({ ...commandBase, startAddress: raw(step.fn, step.addr), quantity: countNumber(step) });
  else if (step.fn === "fc2") action = await modbus.readDiscreteInputs({ ...commandBase, startAddress: raw(step.fn, step.addr), quantity: countNumber(step) });
  else if (step.fn === "fc3") action = await modbus.readHoldingRegisters({ ...commandBase, startAddress: raw(step.fn, step.addr), quantity: countNumber(step) });
  else if (step.fn === "fc4") action = await modbus.readInputRegisters({ ...commandBase, startAddress: raw(step.fn, step.addr), quantity: countNumber(step) });
  else if (step.fn === "fc5") action = await modbus.writeSingleCoil({ ...commandBase, address: raw(step.fn, step.addr), value: normalizeBool(step.value) });
  else if (step.fn === "fc6") action = await modbus.writeSingleRegister({ ...commandBase, address: raw(step.fn, step.addr), value: Number(step.value) || 0 });
  else if (step.fn === "fc15") action = await modbus.writeMultipleCoils({ ...commandBase, startAddress: raw(step.fn, step.addr), values: parseBoolList(step.value) });
  else if (step.fn === "fc16") action = await modbus.writeMultipleRegisters({ ...commandBase, startAddress: raw(step.fn, step.addr), values: parseRegList(step.value) });
  const payload = action?.ok && action.value ? action.value : action;
  const rows = buildRows(step, payload);
  const validation = validate(step, payload, rows);
  const ms = Math.round(payload?.elapsedMs ?? performance.now() - started);
  const at = new Date().toLocaleTimeString("es-PE", { hour12: false });
  return cleanStep({ ...step, res: validation.result, ms, detail: validation.detail, rows, values: rows.map((row) => `${row.address}=${row.actual}`).join(", "), at });
}

function TestsConsolidated() {
  const [state, setState] = useState<TestsState>(() => initialState());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    window.__jwSimpleTestsRuntimeState = {
      export: () => exportRuntimeState(stateRef.current),
      import: (data: unknown) => {
        const imported = importRuntimeState(data);
        if (!imported) return false;
        setState((current) => ({ ...current, ...imported }));
        return true;
      }
    };
    const handler = (event: Event) => window.__jwSimpleTestsRuntimeState?.import((event as CustomEvent).detail);
    window.addEventListener("jw-simple-tests-runtime-import", handler);
    return () => window.removeEventListener("jw-simple-tests-runtime-import", handler);
  }, []);

  useEffect(() => {
    const exported = exportRuntimeState(state);
    window.__jwPendingTestsRuntimeState = exported;
    try { localStorage.setItem(storageKey, JSON.stringify(exported)); } catch { /* noop */ }
    window.dispatchEvent(new CustomEvent("jw-simple-tests-plan-updated", { detail: exported }));
  }, [state]);

  const summary = useMemo(() => {
    const executed = state.steps.filter((x) => x.res !== "Pendiente");
    const passed = executed.filter((x) => x.res === "Aprobado").length;
    const failed = executed.filter((x) => x.res !== "Aprobado").length;
    const avg = executed.length ? Math.round(executed.reduce((sum, x) => sum + (Number(x.ms) || 0), 0) / executed.length) : null;
    const total = state.steps.filter((x) => x.on).length;
    const rate = executed.length ? Math.round((passed / executed.length) * 100) : 0;
    return { executed: executed.length, passed, failed, avg, total, rate };
  }, [state.steps]);

  function msg(text: string) { const p = document.querySelector(".helper p"); if (p) p.textContent = text; }
  function updateStep(index: number, patch: Partial<TestStep>) { setState((current) => ({ ...current, steps: current.steps.map((step, i) => i === index ? cleanStep({ ...step, ...patch }) : step) })); }
  function changeFn(index: number, fn: Fn) { updateStep(index, { fn, addr: def(fn), count: defaultCount(fn), value: defaultValue(fn), expectedMode: defaultMode(fn), expectedValue: "" }); }
  function changeValue(index: number, value: string) { const step = state.steps[index]; updateStep(index, { value, count: isRead(step.fn) ? step.count : String(countNumber(cleanStep({ ...step, value }))) }); }
  function savePlan() { setState((current) => ({ ...current, scenarios: { ...current.scenarios, [current.sc]: normalizeScenario({ ...current.scenarios[current.sc], steps: current.steps.map(cleanStep) }) } })); msg("Plan guardado en el escenario actual. Usa Guardar sesión para persistirlo en archivo."); }

  async function runPlan() {
    if (stateRef.current.running) return;
    const reset = stateRef.current.steps.map(cloneStep);
    setState((current) => ({ ...current, running: true, stopped: false, detail: null, log: [], steps: reset }));
    for (let i = 0; i < reset.length; i += 1) {
      if (stateRef.current.stopped) break;
      if (!reset[i].on) continue;
      try {
        const executed = await executeStep(stateRef.current.steps[i]);
        setState((current) => ({ ...current, steps: current.steps.map((step, idx) => idx === i ? executed : step), log: [{ ...executed, index: i + 1 }, ...current.log] }));
      } catch (error: any) {
        const message = String(error?.message || error || "Error de comunicación.");
        const result: Result = /timeout/i.test(message) ? "Timeout" : "Error";
        const failed = cleanStep({ ...stateRef.current.steps[i], res: result, ms: Number(stateRef.current.steps[i].to) || 1000, detail: message, rows: [], values: "", at: new Date().toLocaleTimeString("es-PE", { hour12: false }) });
        setState((current) => ({ ...current, steps: current.steps.map((step, idx) => idx === i ? failed : step), log: [{ ...failed, index: i + 1 }, ...current.log] }));
      }
    }
    setState((current) => ({ ...current, running: false }));
    msg("Plan ejecutado. Cada paso aprobado requiere comunicación OK y validación OK.");
  }

  function selectScenario(id: string) { setState((current) => { const scenario = current.scenarios[id]; return { ...current, sc: id, steps: scenario?.steps ? scenario.steps.map(cloneStep) : defaultPlan(sid()), detail: null }; }); }

  return <div className="testsConsolidated">
    <section className="card planCard">
      <div className="planHeader"><div><h2>Plan de pruebas al slave</h2><p>PC como Master</p></div><div className="planActions"><button className="primary" onClick={runPlan} disabled={state.running}>▶ Iniciar prueba</button><button onClick={() => setState((s) => ({ ...s, stopped: true, running: false }))}>■ Detener</button><button onClick={() => setState((s) => ({ ...s, steps: [...s.steps, mk(sid(), "fc3", 40000, "1", "", "count")] }))}>+ Agregar paso</button><button onClick={savePlan}>💾 Guardar plan</button></div></div>
      <div className="planBody"><table><thead><tr><th>Activo</th><th>Paso</th><th>Slave</th><th>Función</th><th>Dirección</th><th>Cantidad</th><th>Valor</th><th>Validación</th><th>Esperado</th><th>Timeout</th><th>Resultado</th><th /></tr></thead><tbody>{state.steps.map((step, index) => <StepRow key={index} step={step} index={index} onPatch={(patch) => updateStep(index, patch)} onFn={(fn) => changeFn(index, fn)} onValue={(value) => changeValue(index, value)} onDelete={() => setState((s) => ({ ...s, steps: s.steps.filter((_, i) => i !== index) }))} />)}</tbody></table></div>
      <p className="infoLine">ⓘ Cantidad se usa en lecturas. Valor se usa en escrituras. Validación define si basta respuesta/cantidad o si se comparan valores exactos.</p>
    </section>
    {state.manage ? <ScenarioManager state={state} setState={setState} savePlan={savePlan} /> : <ScenariosPanel state={state} selectScenario={selectScenario} setState={setState} />}
    <SimPanel state={state} setState={setState} />
    <div className="testKpis"><KpiRing title="Tasa de éxito" value={`${summary.rate}%`} sub={`Última ejecución: ${summary.passed}/${summary.executed || summary.total} aprobados`} tone="success" /><KpiText title="Latencia promedio" value={summary.avg == null ? "—" : `${summary.avg} ms`} sub={summary.executed ? `Última ejecución: ${summary.executed} paso(s)` : "Sin datos todavía"} /><KpiText title="Errores" value={String(summary.failed)} sub="Última ejecución" danger /><KpiRing title="Pasos completados" value={`${summary.passed}/${summary.total}`} sub="Última ejecución" tone="steps" /></div>
    <section className="card execCard"><div className="execHeader"><h2>Registro de ejecución</h2><div><button onClick={() => setState((s) => ({ ...s, log: [], detail: null, steps: s.steps.map(cloneStep) }))}>🗑 Limpiar registro</button><button>⇩ Exportar</button></div></div>{state.detail == null ? <ExecutionTable steps={state.steps} onDetail={(index) => setState((s) => ({ ...s, detail: index }))} /> : <StepDetail step={state.steps[state.detail]} index={state.detail} onClose={() => setState((s) => ({ ...s, detail: null }))} />}</section>
  </div>;
}

function StepRow({ step, index, onPatch, onFn, onValue, onDelete }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onDelete: () => void }) {
  const read = isRead(step.fn);
  const expectedDisabled = step.expectedMode === "response" || step.expectedMode === "count";
  const modeOptions = isWrite(step.fn) ? ["response", "exact", "byAddress"] as ExpectedMode[] : ["count", "exact", "byAddress"] as ExpectedMode[];
  return <tr>
    <td className="colActive"><input type="checkbox" checked={step.on} onChange={(event) => onPatch({ on: event.target.checked })} /></td>
    <td className="colPaso">{index + 1}</td>
    <td className="colSlave"><input inputMode="numeric" value={step.slave} onChange={(event) => onPatch({ slave: Math.max(1, Math.min(247, parseInt(event.target.value, 10) || 1)) })} /></td>
    <td className="colFn"><select value={step.fn} onChange={(event) => onFn(event.target.value as Fn)}>{functionOrder.map((fn) => <option key={fn} value={fn}>{F[fn]}</option>)}</select></td>
    <td className="colAddr"><input inputMode="numeric" value={step.addr} onChange={(event) => onPatch({ addr: Number(event.target.value) || 0 })} /></td>
    <td className="colCount"><input inputMode="numeric" disabled={!read} value={countNumber(step)} onChange={(event) => onPatch({ count: event.target.value })} /></td>
    <td className="colValue"><input disabled={read} value={read ? "—" : step.value} onChange={(event) => onValue(event.target.value)} /></td>
    <td className="colMode"><select value={step.expectedMode} onChange={(event) => onPatch({ expectedMode: event.target.value as ExpectedMode, expectedValue: event.target.value === "exact" ? (isWrite(step.fn) ? step.value : "") : "" })}>{modeOptions.map((mode) => <option key={mode} value={mode}>{validationModes[mode]}</option>)}</select></td>
    <td className="colExpected"><input disabled={expectedDisabled} value={expectedDisabled ? expectedAutoText(step) : step.expectedValue} placeholder={expectedAutoText(step)} onChange={(event) => onPatch({ expectedValue: event.target.value })} /></td>
    <td className="colTimeout"><input inputMode="numeric" value={step.to} onChange={(event) => onPatch({ to: Number(event.target.value) || 1000 })} /></td>
    <td className="colResult"><ResultPill result={step.res} /></td>
    <td className="colTrash"><button className="tiny" onClick={onDelete}>🗑</button></td>
  </tr>;
}

function ScenariosPanel({ state, selectScenario, setState }: { state: TestsState; selectScenario: (id: string) => void; setState: React.Dispatch<React.SetStateAction<TestsState>> }) {
  return <section className="card scenarioCardWrap"><h2>Escenarios</h2><div className="scenarioList">{Object.entries(state.scenarios).map(([id, scenario]) => <button key={id} className={`scenarioItem ${id === state.sc ? "selected" : ""}`} onClick={() => selectScenario(id)}><span className={`scenarioIcon ${scenario.color}`}>{scenario.icon}</span><span><strong>{scenario.name}</strong><small>{scenario.desc}</small></span><i /></button>)}</div><button className="manage" onClick={() => setState((s) => ({ ...s, manage: true }))}>Gestionar escenarios ›</button></section>;
}

function ScenarioManager({ state, setState, savePlan }: { state: TestsState; setState: React.Dispatch<React.SetStateAction<TestsState>>; savePlan: () => void }) {
  const scenario = state.scenarios[state.sc] || defaultScenarios.normal;
  const isDefault = defaultScenarioIds.has(state.sc);
  function patch(patch: Partial<Scenario>) { setState((current) => ({ ...current, scenarios: { ...current.scenarios, [current.sc]: normalizeScenario({ ...current.scenarios[current.sc], ...patch }, current.scenarios[current.sc]) } })); }
  return <section className="card scenarioCardWrap scenarioManager"><h2>Gestionar escenarios</h2><label>Escenario activo<select value={state.sc} onChange={(event) => setState((s) => ({ ...s, sc: event.target.value, steps: s.scenarios[event.target.value]?.steps ? s.scenarios[event.target.value].steps!.map(cloneStep) : s.steps }))}>{Object.entries(state.scenarios).map(([id, s]) => <option key={id} value={id}>{s.name}</option>)}</select></label><label>Nombre<input value={scenario.name} onChange={(event) => patch({ name: event.target.value })} /></label><label>Descripción<textarea value={scenario.desc} onChange={(event) => patch({ desc: event.target.value })} /></label><div className="twoCols"><label>Ícono<input value={scenario.icon} onChange={(event) => patch({ icon: event.target.value })} /></label><label>Color<select value={scenario.color} onChange={(event) => patch({ color: event.target.value as ScenarioColor })}>{Object.entries(colorOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><button onClick={savePlan}>Usar plan visible como pasos</button><div className="twoCols"><button onClick={() => { const id = `custom_${Date.now()}`; setState((s) => ({ ...s, sc: id, scenarios: { ...s.scenarios, [id]: normalizeScenario({ ...clone(scenario), name: `${scenario.name} copia`, steps: s.steps.map(cleanStep) }) } })); }}>Duplicar</button>{isDefault ? <button onClick={() => setState((s) => ({ ...s, scenarios: { ...s.scenarios, [s.sc]: normalizeScenario(defaultScenarios[s.sc], defaultScenarios[s.sc]) }, steps: defaultPlan(sid()) }))}>Restaurar base</button> : <button onClick={() => setState((s) => { const scenarios = { ...s.scenarios }; delete scenarios[s.sc]; return { ...s, sc: "normal", scenarios, steps: scenarios.normal.steps ? scenarios.normal.steps.map(cloneStep) : defaultPlan(sid()) }; })}>Eliminar</button>}</div><button onClick={() => { const id = `custom_${Date.now()}`; setState((s) => ({ ...s, sc: id, scenarios: { ...s.scenarios, [id]: normalizeScenario({ icon: "🧪", name: "Nuevo escenario", desc: "Escenario personalizado.", color: "cyan", steps: s.steps.map(cleanStep) }) } })); }}>+ Nuevo escenario</button><button className="primary wide" onClick={() => setState((s) => ({ ...s, manage: false }))}>Guardar y volver</button></section>;
}

function SimPanel({ state, setState }: { state: TestsState; setState: React.Dispatch<React.SetStateAction<TestsState>> }) { return <section className="card simCard"><h2>Simulador slave <small>(PC como slave)</small></h2><label>Estado<input disabled value={state.sim} /></label><label>Dirección slave<input inputMode="numeric" defaultValue="1" /></label><label>Puerto<input disabled value={port()} /></label><label>Baud Rate<input disabled value={baud()} /></label><button className="simButton" onClick={() => setState((s) => ({ ...s, sim: s.sim === "Detenido" ? "Preparado" : "Detenido" }))}>▶ {state.sim === "Detenido" ? "Preparar" : "Detener"} simulador slave</button><button>⚙</button></section>; }
function KpiRing({ title, value, sub, tone }: { title: string; value: string; sub: string; tone: "success" | "steps" }) { const percent = Number(value.split("/")[1] ? (Number(value.split("/")[0]) / Number(value.split("/")[1])) * 100 : value.replace("%", "")) || 0; return <section className="card kpiCard ringKpi"><div className={`ring ${tone}`} style={{ background: `conic-gradient(${tone === "success" ? "#5ce044" : "#00c8ff"} ${percent}%, #0b3952 0)` }}><strong>{value}</strong><small>{tone === "success" ? "Éxito" : "Pasos"}</small></div><div><h3>{title}</h3><p>{sub}</p></div></section>; }
function KpiText({ title, value, sub, danger }: { title: string; value: string; sub: string; danger?: boolean }) { return <section className="card kpiCard textKpi"><div><h3>{title}</h3><strong className={danger ? "danger" : ""}>{value}</strong><p>{sub}</p></div></section>; }
function ResultPill({ result }: { result: Result }) { const cls = result === "Aprobado" ? "ok" : result === "Pendiente" ? "pending" : result === "Timeout" || result === "CRC Error" || result === "Excepción" ? "warn" : "bad"; const icon = result === "Aprobado" ? "✓" : result === "Pendiente" ? "—" : cls === "warn" ? "!" : "×"; return <span className={`result ${cls}`}>{icon} {result}</span>; }
function ExecutionTable({ steps, onDetail }: { steps: TestStep[]; onDetail: (index: number) => void }) { return <div className="execBody"><table><thead><tr><th>Hora</th><th>Paso</th><th>Slave</th><th>Función</th><th>Dirección</th><th>Cantidad/Valor</th><th>Resultado</th><th>Tiempo</th><th>Detalle</th><th>Info</th></tr></thead><tbody>{steps.map((step, index) => <tr key={index}><td>{step.at || "—"}</td><td>{index + 1}</td><td>Slave ID {step.slave}</td><td>{F[step.fn]}</td><td>{step.addr}</td><td>{isRead(step.fn) ? countNumber(step) : step.value}</td><td><ResultPill result={step.res} /></td><td>{step.ms == null ? "—" : `${step.ms} ms`}</td><td>{step.detail || "Pendiente de ejecución."}</td><td><button className="tiny infoBtn" onClick={() => onDetail(index)}>ⓘ</button></td></tr>)}</tbody></table></div>; }
function StepDetail({ step, index, onClose }: { step: TestStep; index: number; onClose: () => void }) { return <div className="detailPanel"><button className="closeDetail" onClick={onClose}>×</button><h2>Detalle del paso {index + 1}</h2><p>{F[step.fn]} · {step.detail || "Sin detalle."}</p><div className="detailGrid"><span><small>Función</small><strong>{F[step.fn]}</strong></span><span><small>Slave ID</small><strong>{step.slave}</strong></span><span><small>Dirección inicial</small><strong>{step.addr}</strong></span><span><small>{isRead(step.fn) ? "Cantidad" : "Valor"}</small><strong>{isRead(step.fn) ? countNumber(step) : step.value}</strong></span><span><small>Validación</small><strong>{validationModes[step.expectedMode]}</strong></span><span><small>Resultado</small><strong>{step.res}</strong></span></div><div className="execBody detailTable"><table><thead><tr><th>Dirección</th><th>Nombre</th><th>Esperado</th><th>Leído/Escrito</th><th>Tipo</th><th>Validación</th></tr></thead><tbody>{step.rows.length ? step.rows.map((row, i) => <tr key={i}><td>{row.address}</td><td>{row.name}</td><td>{row.expected}</td><td>{row.type === "bool" ? <span className={`bitBadge ${normalizeBool(row.actual) ? "on" : "off"}`}>{row.actual}</span> : row.actual}</td><td>{row.type}</td><td className={row.validation === "OK" ? "okText" : row.validation === "No coincide" ? "badText" : ""}>{row.validation}</td></tr>) : <tr><td colSpan={6}>Este paso no tiene valores detallados.</td></tr>}</tbody></table></div></div>; }

function injectStyle() {
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
#${overlayId}{position:fixed;z-index:50;background:linear-gradient(180deg,#061b2d,#031323);padding:12px;box-sizing:border-box;pointer-events:auto;color:var(--text,#eef7ff);overflow:hidden}body.jw-tests-consolidated-active .workspace>.tests{visibility:hidden!important}body.jw-tests-consolidated-active .workspace{overflow:hidden!important}.testsConsolidated{height:100%;min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr)318px;grid-template-rows:minmax(0,1.15fr)126px minmax(0,.82fr);gap:12px}.testsConsolidated .card{min-height:0;overflow:hidden;border:1px solid #2d5c75;border-radius:9px;background:linear-gradient(180deg,#0b2a42dd,#071f33dd);box-shadow:inset 0 0 0 1px #ffffff06}.testsConsolidated h2,.testsConsolidated h3{margin:0;color:#00d5ff}.testsConsolidated p{margin:0;color:#aac3d2}.testsConsolidated .planCard{grid-column:1;grid-row:1;display:flex;flex-direction:column;padding:12px}.testsConsolidated .scenarioCardWrap{grid-column:2;grid-row:1;display:flex;flex-direction:column;gap:10px;padding:12px}.testsConsolidated .simCard{grid-column:2;grid-row:2/4;display:flex;flex-direction:column;gap:10px;padding:12px}.testsConsolidated .testKpis{grid-column:1;grid-row:2;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.testsConsolidated .execCard{grid-column:1;grid-row:3;display:flex;flex-direction:column;padding:10px}.testsConsolidated .planHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex:0 0 auto;margin-bottom:8px}.testsConsolidated .planActions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.testsConsolidated button{border:1px solid #2d5c75;border-radius:7px;background:#061a2b;color:#eef7ff;padding:7px 10px;font-weight:700;cursor:pointer}.testsConsolidated button.primary,.testsConsolidated .primary{background:linear-gradient(180deg,#1498f3,#0878c7);border-color:#11a7ff}.testsConsolidated button.wide{width:100%}.testsConsolidated .planBody,.testsConsolidated .execBody{min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#2d87aa #071d30}.testsConsolidated table{width:100%;border-collapse:collapse;font-size:.84rem}.testsConsolidated th,.testsConsolidated td{border-bottom:1px solid #4588a640;padding:5px 7px;text-align:left;vertical-align:middle}.testsConsolidated th{color:#aac3d2;font-weight:600;background:#ffffff0a;position:sticky;top:0;z-index:1}.testsConsolidated input,.testsConsolidated select,.testsConsolidated textarea{width:100%;min-height:29px;border:1px solid #2d5c75;border-radius:6px;background:#061a2b;color:#eef7ff;padding:4px 7px;box-sizing:border-box}.testsConsolidated textarea{min-height:58px;resize:vertical;font-family:inherit}.testsConsolidated input:disabled{opacity:.62;color:#aac3d2}.testsConsolidated input[type=checkbox]{width:17px;min-height:17px;accent-color:#5ce044}.testsConsolidated .colActive{width:42px}.testsConsolidated .colPaso{width:38px}.testsConsolidated .colSlave{width:76px}.testsConsolidated .colFn{width:190px}.testsConsolidated .colAddr{width:88px}.testsConsolidated .colCount{width:76px}.testsConsolidated .colValue{width:138px}.testsConsolidated .colMode{width:154px}.testsConsolidated .colExpected{width:150px}.testsConsolidated .colTimeout{width:82px}.testsConsolidated .colResult{width:122px}.testsConsolidated .colTrash{width:34px}.testsConsolidated .infoLine{margin-top:7px;padding:7px 9px;border:1px solid #007da850;border-radius:7px;background:#073a5566;color:#aac3d2}.testsConsolidated .scenarioList{display:flex;flex:1 1 auto;min-height:0;overflow:auto;flex-direction:column;gap:10px;padding-right:4px;scrollbar-width:thin;scrollbar-color:#2d87aa #071d30}.testsConsolidated .scenarioItem{display:grid;grid-template-columns:46px 1fr 28px;gap:10px;align-items:center;min-height:70px;padding:10px;border:1px solid #2d5c75;border-radius:11px;background:linear-gradient(180deg,#ffffff0d,#ffffff05);color:#eef7ff;text-align:left;flex:0 0 auto}.testsConsolidated .scenarioItem.selected{border-color:#00d5ff;background:linear-gradient(180deg,#00bfff24,#00bfff0b);box-shadow:0 0 16px #00bfff1d,inset 0 0 0 1px #00bfff33}.testsConsolidated .scenarioIcon{display:grid;place-items:center;width:42px;height:42px;border-radius:10px;font-size:1.35rem}.testsConsolidated .scenarioIcon.shield{background:#1f6e3b88}.testsConsolidated .scenarioIcon.clock,.testsConsolidated .scenarioIcon.warn{background:#9a5d1288}.testsConsolidated .scenarioIcon.bad{background:#9b313d88}.testsConsolidated .scenarioIcon.cyan{background:#136b8e88}.testsConsolidated .scenarioItem strong,.testsConsolidated .scenarioItem small{display:block}.testsConsolidated .scenarioItem small{color:#aac3d2;margin-top:4px;line-height:1.25}.testsConsolidated .scenarioItem i{display:grid;place-items:center;width:24px;height:24px;border:2px solid #45677a;border-radius:50%}.testsConsolidated .scenarioItem.selected i{border-color:#00d5ff;background:radial-gradient(circle at center,#dff7ff 0 36%,transparent 40%)}.testsConsolidated .manage{flex:0 0 auto}.testsConsolidated .scenarioManager{overflow:auto}.testsConsolidated .scenarioManager label{display:grid;gap:5px;color:#aac3d2}.testsConsolidated .twoCols{display:grid;grid-template-columns:1fr 1fr;gap:8px}.testsConsolidated .simCard small{color:#aac3d2}.testsConsolidated .simCard label{display:grid;gap:5px;color:#aac3d2}.testsConsolidated .simButton{background:linear-gradient(180deg,#9b37e8,#7b19ce);border-color:#b859ff}.testsConsolidated .kpiCard{padding:12px 16px;display:flex!important;align-items:center!important;justify-content:center!important;gap:18px}.testsConsolidated .kpiCard h3{color:#b9d1df;font-size:1rem}.testsConsolidated .kpiCard p{font-size:.82rem;color:#aac3d2;margin:0}.testsConsolidated .textKpi{justify-content:flex-start!important}.testsConsolidated .textKpi strong{display:block;color:#00d5ff;font-size:1.9rem;line-height:1.1}.testsConsolidated .textKpi strong.danger{color:#ff5d5d}.testsConsolidated .ring{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;position:relative;flex:0 0 auto}.testsConsolidated .ring::after{content:"";position:absolute;inset:13px;border-radius:50%;background:#062033}.testsConsolidated .ring strong,.testsConsolidated .ring small{position:relative;z-index:1}.testsConsolidated .ring strong{font-size:1.25rem}.testsConsolidated .ring small{font-size:.65rem;color:#eef7ff;margin-top:30px;position:absolute}.testsConsolidated .execHeader{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.testsConsolidated .execHeader div{display:flex;gap:8px}.testsConsolidated .result{font-weight:800}.testsConsolidated .result.ok,.testsConsolidated .okText{color:#5ce044}.testsConsolidated .result.warn{color:#ffb22e}.testsConsolidated .result.bad,.testsConsolidated .badText{color:#ff5d5d}.testsConsolidated .result.pending{color:#b9d1df}.testsConsolidated .bitBadge{display:inline-block;min-width:42px;text-align:center;border-radius:999px;padding:2px 9px;font-weight:800}.testsConsolidated .bitBadge.on{background:#228a3c;color:white}.testsConsolidated .bitBadge.off{background:#34495a;color:white}.testsConsolidated .tiny{padding:4px 7px;min-width:26px}.testsConsolidated .detailPanel{display:flex;flex-direction:column;min-height:0;position:relative}.testsConsolidated .closeDetail{position:absolute;right:0;top:0}.testsConsolidated .detailGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin:12px 36px 8px 0}.testsConsolidated .detailGrid span{border:1px solid #2d5c75;border-radius:6px;padding:7px;background:#061a2b}.testsConsolidated .detailGrid small,.testsConsolidated .detailGrid strong{display:block}.testsConsolidated .detailGrid small{color:#aac3d2}.testsConsolidated .detailTable{flex:1 1 auto}`;
  document.head.appendChild(style);
}

let reactRoot: ReactDOM.Root | null = null;
let lastRect = "";
function applyGeometry(root: HTMLElement, area: HTMLElement) { const rect = area.getBoundingClientRect(); const key = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`; if (key === lastRect) return; lastRect = key; root.style.left = `${rect.left}px`; root.style.top = `${rect.top}px`; root.style.width = `${rect.width}px`; root.style.height = `${rect.height}px`; }
function mount() { const area = workspace(); if (!area) return; injectStyle(); document.body.classList.add("jw-tests-consolidated-active"); let root = document.getElementById(overlayId); if (!root) { root = document.createElement("div"); root.id = overlayId; document.body.appendChild(root); reactRoot = ReactDOM.createRoot(root); reactRoot.render(<TestsConsolidated />); } applyGeometry(root, area); }
function unmount() { document.body.classList.remove("jw-tests-consolidated-active"); document.getElementById(overlayId)?.remove(); reactRoot = null; lastRect = ""; }
function sync() { try { if (activeTestsView()) mount(); else unmount(); } catch (error) { console.warn("[JW Modbus Tool] Tests consolidated view failed", error); unmount(); } }

setInterval(sync, 300);
window.addEventListener("resize", () => { lastRect = ""; sync(); });
setTimeout(sync, 80);
