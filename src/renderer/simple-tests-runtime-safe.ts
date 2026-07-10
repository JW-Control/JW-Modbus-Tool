// @ts-nocheck
export {};

const installKey = "__jwSimpleTestsRuntimeSafeInstalled";

if (!window[installKey]) {
  window[installKey] = true;

  const F = {
    fc1: "FC01 Read Coils",
    fc2: "FC02 Read Discrete Inputs",
    fc3: "FC03 Read Holding Registers",
    fc4: "FC04 Read Input Registers",
    fc5: "FC05 Write Single Coil",
    fc6: "FC06 Write Single Register",
    fc15: "FC15 Write Multiple Coils",
    fc16: "FC16 Write Multiple Registers"
  };

  const functionOrder = ["fc1", "fc2", "fc3", "fc4", "fc5", "fc6", "fc15", "fc16"];
  const readFns = new Set(["fc1", "fc2", "fc3", "fc4"]);
  const writeFns = new Set(["fc5", "fc6", "fc15", "fc16"]);
  const bitFns = new Set(["fc1", "fc2", "fc5", "fc15"]);
  const overlayId = "jw-simple-tests-runtime-overlay";
  const styleId = "simple-tests-runtime-safe-style";
  const runtimeFormat = "jwmodbus-tests-runtime";
  const defaultScenarioIds = new Set(["normal", "timeout", "crc", "exception"]);

  const colorOptions = {
    shield: "Verde",
    clock: "Naranja",
    warn: "Amarillo",
    bad: "Rojo",
    cyan: "Azul"
  };

  const defaultScenarios = {
    normal: { icon: "🛡", name: "Operación normal", desc: "Verifica lectura y escritura correcta.", color: "shield" },
    timeout: { icon: "⏱", name: "Timeout detectado", desc: "Simula dispositivos no disponibles.", color: "clock" },
    crc: { icon: "⚠", name: "Error CRC detectado", desc: "Reserva escenario para tramas CRC inválidas.", color: "warn" },
    exception: { icon: "✖", name: "Excepción Modbus", desc: "Fuerza códigos de excepción (01, 02, 03).", color: "bad" }
  };

  const validationModes = {
    response: "Respuesta OK",
    count: "Cantidad solicitada",
    exact: "Valores exactos",
    byAddress: "Por dirección"
  };

  const st = {
    sc: "normal",
    sim: "Detenido",
    steps: [],
    log: [],
    running: false,
    stopped: false,
    manage: false,
    detail: null,
    scenarios: clone(defaultScenarios)
  };

  let mounted = false;
  let lastRectKey = "";
  st.steps = plan(2);

  const api = () => window.jwModbus;
  const workspace = () => document.querySelector(".workspace");
  const statusText = () => document.querySelector(".status")?.textContent || "";
  const statusParts = () => Array.from(document.querySelectorAll(".status span")).map((item) => item.textContent?.trim() || "").filter(Boolean);
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function active() {
    const activeButton = document.querySelector(".sidebar button.active");
    return Boolean(activeButton?.textContent?.includes("Pruebas"));
  }

  function port() {
    const fromSpan = statusParts().find((value) => /^COM\d+$/i.test(value));
    if (fromSpan) return fromSpan;
    return /COM\d{1,3}/i.exec(statusText())?.[0] || "COM3";
  }

  function baud() {
    const fromSpan = statusParts().find((value) => /^(9600|19200|38400|57600|115200|230400)$/.test(value));
    if (fromSpan) return fromSpan;
    return /\b(9600|19200|38400|57600|115200|230400)\b/.exec(statusText())?.[1] || "115200";
  }

  function sid() {
    const match = /Slave activo ID\s*(\d+)/i.exec(statusText());
    return match ? +match[1] : 2;
  }

  function isRead(fn) { return readFns.has(fn); }
  function isWrite(fn) { return writeFns.has(fn); }

  function raw(fn, address) {
    const a = Number(address) || 0;
    if (["fc3", "fc6", "fc16"].includes(fn)) return a >= 40000 ? a - 40000 : a;
    if (fn === "fc4") return a >= 30000 ? a - 30000 : a;
    if (fn === "fc2") return a >= 10000 ? a - 10000 : a;
    return a;
  }

  function displayAddress(fn, base, index = 0) {
    const a = Number(base) || 0;
    const value = a + index;
    if (fn === "fc3" || fn === "fc6" || fn === "fc16") return value >= 40000 ? value : 40000 + value;
    if (fn === "fc4") return value >= 30000 ? value : 30000 + value;
    if (fn === "fc2") return value >= 10000 ? value : 10000 + value;
    return value;
  }

  function def(fn) {
    if (["fc3", "fc6", "fc16"].includes(fn)) return 40000;
    if (fn === "fc4") return 30000;
    if (fn === "fc2") return 10000;
    return 0;
  }

  function defaultCount(fn) {
    if (fn === "fc1" || fn === "fc2") return "8";
    if (fn === "fc3" || fn === "fc4") return "1";
    if (fn === "fc15") return "4";
    if (fn === "fc16") return "3";
    return "1";
  }

  function defaultValue(fn) {
    if (fn === "fc5") return "ON";
    if (fn === "fc6") return "1234";
    if (fn === "fc15") return "1,0,1,0";
    if (fn === "fc16") return "100,200,300";
    return "";
  }

  function defaultMode(fn) { return isWrite(fn) ? "response" : "count"; }

  function countNumber(step) {
    if (isRead(step.fn)) {
      const n = Number(step.count);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
    }
    if (step.fn === "fc15") return parseBoolList(step.value).length || 1;
    if (step.fn === "fc16") return parseRegList(step.value).length || 1;
    return 1;
  }

  function expectedAutoText(step) {
    if (step.expectedMode === "response") return "OK";
    if (step.expectedMode === "count") {
      const suffix = step.fn === "fc1" ? "coils" : step.fn === "fc2" ? "bits" : "regs";
      return `${countNumber(step)} ${suffix}`;
    }
    return step.expectedValue || "";
  }

  function normalizeBool(value) {
    const s = String(value ?? "").trim().toLowerCase();
    return ["1", "true", "on", "sí", "si", "high"].includes(s);
  }

  function boolText(value) { return normalizeBool(value) ? "ON" : "OFF"; }
  function parseBoolList(value) { return String(value ?? "").split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean).map(normalizeBool); }
  function parseRegList(value) { return String(value ?? "").split(/[;,\s]+/).map((x) => Number(x.trim())).filter((x) => Number.isFinite(x)); }

  function inferMode(fn, exp) {
    const text = String(exp ?? "").trim();
    if (!text) return defaultMode(fn);
    if (/^ok$/i.test(text)) return "response";
    if (/^\d+\s*(regs?|coils?|bits?)$/i.test(text)) return "count";
    if (text.includes("=")) return "byAddress";
    return "exact";
  }

  function inferExpectedValue(exp) {
    const text = String(exp ?? "").trim();
    if (!text || /^ok$/i.test(text) || /^\d+\s*(regs?|coils?|bits?)$/i.test(text)) return "";
    return text;
  }

  function mk(slave, fn, addr, count, value, mode = defaultMode(fn), expectedValue = "", to = 1000) {
    return cleanStep({ on: true, slave, fn, addr, count, value, expectedMode: mode, expectedValue, to });
  }

  function cleanStep(input) {
    const fn = F[input?.fn] ? input.fn : "fc3";
    const oldAmount = input?.amount;
    const oldExp = input?.exp;
    const mode = input?.expectedMode || inferMode(fn, oldExp);
    return {
      on: input?.on !== false,
      slave: Math.max(1, Math.min(247, parseInt(String(input?.slave ?? 2), 10) || 2)),
      fn,
      addr: Number.isFinite(Number(input?.addr)) ? Number(input.addr) : def(fn),
      count: String(input?.count ?? (isRead(fn) ? oldAmount ?? defaultCount(fn) : defaultCount(fn))),
      value: String(input?.value ?? (isWrite(fn) ? oldAmount ?? defaultValue(fn) : "")),
      expectedMode: validationModes[mode] ? mode : defaultMode(fn),
      expectedValue: String(input?.expectedValue ?? inferExpectedValue(oldExp)),
      to: Number.isFinite(Number(input?.to)) ? Number(input.to) : 1000,
      res: input?.res || "Pendiente",
      ms: input?.ms ?? null,
      detail: input?.detail || "",
      values: input?.values || "",
      rows: Array.isArray(input?.rows) ? input.rows : [],
      at: input?.at || ""
    };
  }

  function cloneStep(step) { return cleanStep({ ...step, res: "Pendiente", ms: null, detail: "", values: "", rows: [], at: "" }); }

  function plan(slave) {
    return [
      mk(slave, "fc3", 40000, "6", "", "count"),
      mk(slave, "fc4", 30000, "4", "", "count"),
      mk(slave, "fc1", 0, "8", "", "count"),
      mk(slave, "fc2", 0, "8", "", "count"),
      mk(slave, "fc5", 0, "1", "ON", "response"),
      mk(slave, "fc6", 40010, "1", "1234", "response"),
      mk(slave, "fc15", 0, "4", "1,0,1,0", "response"),
      mk(slave, "fc16", 40020, "3", "10,20,30", "response")
    ];
  }

  function normalizeScenario(input, fallback = defaultScenarios.normal) {
    const base = fallback || defaultScenarios.normal;
    return {
      icon: String(input?.icon ?? base.icon ?? "🧪").slice(0, 4),
      name: String(input?.name ?? base.name ?? "Escenario"),
      desc: String(input?.desc ?? base.desc ?? "Escenario de prueba."),
      color: colorOptions[input?.color] ? input.color : base.color ?? "shield",
      steps: Array.isArray(input?.steps) ? input.steps.map(cleanStep) : undefined
    };
  }

  function normalizeScenarios(input) {
    const result = clone(defaultScenarios);
    if (!input || typeof input !== "object") return result;
    for (const [key, value] of Object.entries(input)) {
      const safeKey = defaultScenarioIds.has(key) ? key : key.replace(/[^\w-]/g, "_") || `custom_${Date.now()}`;
      result[safeKey] = normalizeScenario(value, result[safeKey]);
    }
    return result;
  }

  function exportRuntimeState() {
    return {
      format: runtimeFormat,
      version: 2,
      savedAt: new Date().toISOString(),
      selectedScenario: st.sc,
      simulatorState: st.sim,
      steps: st.steps.map(cleanStep),
      scenarios: normalizeScenarios(st.scenarios)
    };
  }

  function importRuntimeState(data) {
    try {
      const src = data?.format === runtimeFormat ? data : data?.testsRuntime;
      if (!src || src.format !== runtimeFormat || !Array.isArray(src.steps)) return false;
      st.scenarios = normalizeScenarios(src.scenarios);
      st.sc = st.scenarios[src.selectedScenario] ? src.selectedScenario : "normal";
      st.sim = src.simulatorState || "Detenido";
      st.steps = src.steps.map(cleanStep);
      st.log = [];
      st.detail = null;
      st.manage = false;
      render();
      return true;
    } catch (error) {
      console.warn("[JW Modbus Tool] No se pudo importar testsRuntime", error);
      return false;
    }
  }

  function exposeRuntimeState() { window.__jwSimpleTestsRuntimeState = { export: exportRuntimeState, import: importRuntimeState }; }
  function persistSilent() { exposeRuntimeState(); window.dispatchEvent(new CustomEvent("jw-simple-tests-plan-updated", { detail: exportRuntimeState() })); }
  function msg(text) { const p = document.querySelector(".helper p"); if (p) p.textContent = text; }
  function persistPlanMessage() { persistSilent(); msg("Plan guardado en memoria de la vista. Usa Guardar sesión para persistirlo en archivo."); }

  function functionOptions(selected) { return functionOrder.map((key) => `<option value="${key}" ${selected === key ? "selected" : ""}>${esc(F[key])}</option>`).join(""); }

  function validationOptions(selected, fn) {
    const keys = isWrite(fn) ? ["response", "exact", "byAddress"] : ["count", "exact", "byAddress"];
    return keys.map((key) => `<option value="${key}" ${selected === key ? "selected" : ""}>${esc(validationModes[key])}</option>`).join("");
  }

  function resultHtml(result) {
    const map = { Aprobado: ["✓", "resultOK"], Pendiente: ["—", ""], Timeout: ["!", "resultWarn"], "Validación fallida": ["×", "resultBad"], Excepción: ["!", "resultWarn"], "CRC Error": ["!", "resultWarn"], Error: ["×", "resultBad"] };
    const [icon, cls] = map[result] || map.Error;
    return `<span class="${cls} resultPill">${icon} ${esc(result)}</span>`;
  }

  function valueBadge(value, isBit) {
    if (!isBit) return esc(value);
    const on = normalizeBool(value);
    return `<span class="bitBadge ${on ? "on" : "off"}">${on ? "ON" : "OFF"}</span>`;
  }

  function nameFor(fn, address) {
    if (fn === "fc1" || fn === "fc5" || fn === "fc15") return `Q0_${address}`;
    if (fn === "fc2") return `I0_${raw(fn, address)}`;
    const names = { 40000: "Velocidad_Ref (RPM)", 40001: "Estado_Variador", 40002: "Corriente_Salida (A)", 40003: "Tension_DC (V)", 40004: "Temp_Disipador (°C)", 40005: "Horas_Marcha (h)", 40008: "Frecuencia_Salida (Hz)", 40009: "Estado_Alarma", 30000: "Input_Reg_0", 30001: "Input_Reg_1", 30002: "Input_Reg_2", 30003: "Input_Reg_3" };
    return names[address] || `Reg_${address}`;
  }

  function expectedMap(step) {
    const map = new Map();
    if (step.expectedMode !== "byAddress") return map;
    for (const part of String(step.expectedValue || "").split(/[;,]+/)) {
      const [left, right] = part.split("=").map((x) => x?.trim());
      const address = Number(left);
      if (Number.isFinite(address) && right != null) map.set(address, right);
    }
    return map;
  }

  function expectedSeq(step) {
    if (step.expectedMode !== "exact") return [];
    return String(step.expectedValue || "").split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean);
  }

  function sameValue(actual, expected, isBit) {
    if (expected == null || expected === "") return true;
    if (isBit) return normalizeBool(actual) === normalizeBool(expected);
    return Number(actual) === Number(expected);
  }

  function buildRows(step, action) {
    const rows = [];
    const isBit = bitFns.has(step.fn);
    const seq = expectedSeq(step);
    const byAddr = expectedMap(step);
    const qty = countNumber(step);
    let actualValues = [];
    if (step.fn === "fc1" || step.fn === "fc2") actualValues = action?.values || [];
    if (step.fn === "fc3" || step.fn === "fc4") actualValues = action?.registerValues || [];
    if (step.fn === "fc5") actualValues = [normalizeBool(step.value)];
    if (step.fn === "fc6") actualValues = [Number(step.value)];
    if (step.fn === "fc15") actualValues = parseBoolList(step.value);
    if (step.fn === "fc16") actualValues = parseRegList(step.value);

    const total = isRead(step.fn) ? Math.max(qty, actualValues.length) : actualValues.length;
    for (let i = 0; i < total; i += 1) {
      const address = displayAddress(step.fn, step.addr, i);
      const actualRaw = actualValues[i];
      const actual = isBit ? boolText(actualRaw) : String(actualRaw ?? "");
      const expected = byAddr.has(address) ? byAddr.get(address) : seq[i] ?? "";
      const hasCriterion = step.expectedMode === "exact" || step.expectedMode === "byAddress";
      const ok = hasCriterion ? sameValue(actual, expected, isBit) : true;
      rows.push({ address, name: nameFor(step.fn, address), expected: hasCriterion ? expected || "—" : "—", actual: actual || "—", type: isBit ? "bool" : "uint16", validation: hasCriterion ? (ok ? "OK" : "No coincide") : "Sin criterio", ok });
    }
    return rows;
  }

  function validate(step, action, rows) {
    if (action?.exception) return { result: "Excepción", detail: action.exception.exceptionName || "Excepción Modbus." };
    if (action && action.crcOk === false) return { result: "CRC Error", detail: "La respuesta fue marcada como CRC inválido." };
    const qty = countNumber(step);
    if (step.expectedMode === "response") return { result: "Aprobado", detail: "Respuesta Modbus recibida correctamente." };
    if (step.expectedMode === "count") {
      const got = step.fn === "fc1" || step.fn === "fc2" ? action?.values?.length ?? 0 : step.fn === "fc3" || step.fn === "fc4" ? action?.registerValues?.length ?? 0 : qty;
      const ok = got >= qty;
      const label = step.fn === "fc1" ? "coils" : step.fn === "fc2" ? "bits" : "registros";
      return { result: ok ? "Aprobado" : "Validación fallida", detail: ok ? `${qty} ${label} leídos correctamente.` : `Se esperaban ${qty} valores y llegaron ${got}.` };
    }
    const allOk = rows.every((row) => row.ok);
    return { result: allOk ? "Aprobado" : "Validación fallida", detail: allOk ? "Validación de valores OK." : "Uno o más valores no coinciden con lo esperado." };
  }

  async function executeStep(step, index) {
    const started = performance.now();
    const commandBase = { unitId: step.slave, timeoutMs: Number(step.to) || 1000 };
    const modbus = api()?.modbus;
    if (!modbus) throw new Error("Backend Modbus no disponible.");
    let action;
    if (step.fn === "fc1") action = await modbus.readCoils({ ...commandBase, startAddress: raw(step.fn, step.addr), quantity: countNumber(step) });
    else if (step.fn === "fc2") action = await modbus.readDiscreteInputs({ ...commandBase, startAddress: raw(step.fn, step.addr), quantity: countNumber(step) });
    else if (step.fn === "fc3") action = await modbus.readHoldingRegisters({ ...commandBase, startAddress: raw(step.fn, step.addr), quantity: countNumber(step) });
    else if (step.fn === "fc4") action = await modbus.readInputRegisters({ ...commandBase, startAddress: raw(step.fn, step.addr), quantity: countNumber(step) });
    else if (step.fn === "fc5") action = await modbus.writeSingleCoil({ ...commandBase, address: raw(step.fn, step.addr), value: normalizeBool(step.value) });
    else if (step.fn === "fc6") action = await modbus.writeSingleRegister({ ...commandBase, address: raw(step.fn, step.addr), value: Number(step.value) || 0 });
    else if (step.fn === "fc15") action = await modbus.writeMultipleCoils({ ...commandBase, startAddress: raw(step.fn, step.addr), values: parseBoolList(step.value) });
    else if (step.fn === "fc16") action = await modbus.writeMultipleRegisters({ ...commandBase, startAddress: raw(step.fn, step.addr), values: parseRegList(step.value) });
    const rows = buildRows(step, action);
    const validation = validate(step, action, rows);
    const ms = Math.round(action?.elapsedMs ?? performance.now() - started);
    const at = new Date().toLocaleTimeString("es-PE", { hour12: false });
    st.steps[index] = cleanStep({ ...step, res: validation.result, ms, detail: validation.detail, rows, values: rows.map((row) => `${row.address}=${row.actual}`).join(", "), at });
    st.log.unshift({ ...st.steps[index], index: index + 1 });
  }

  async function runPlan() {
    if (st.running) return;
    st.running = true;
    st.stopped = false;
    st.detail = null;
    st.log = [];
    st.steps = st.steps.map(cloneStep);
    render();
    for (let i = 0; i < st.steps.length; i += 1) {
      if (st.stopped) break;
      if (!st.steps[i].on) continue;
      try {
        await executeStep(st.steps[i], i);
      } catch (error) {
        const at = new Date().toLocaleTimeString("es-PE", { hour12: false });
        const message = String(error?.message || error || "Error de comunicación.");
        const result = /timeout/i.test(message) ? "Timeout" : "Error";
        st.steps[i] = cleanStep({ ...st.steps[i], res: result, ms: Number(st.steps[i].to) || 1000, detail: message, rows: [], values: "", at });
        st.log.unshift({ ...st.steps[i], index: i + 1 });
      }
      render();
    }
    st.running = false;
    persistSilent();
    msg("Plan ejecutado. Cada paso aprobado requiere comunicación OK y validación OK.");
    render();
  }

  function kpis() {
    const executed = st.steps.filter((x) => x.res !== "Pendiente");
    const passed = executed.filter((x) => x.res === "Aprobado").length;
    const failed = executed.filter((x) => x.res !== "Aprobado").length;
    const avg = executed.length ? Math.round(executed.reduce((sum, x) => sum + (Number(x.ms) || 0), 0) / executed.length) : null;
    const rate = executed.length ? Math.round((passed / executed.length) * 100) : 0;
    return { executed: executed.length, passed, failed, avg, rate, total: st.steps.filter((x) => x.on).length };
  }

  function kpiCard(title, value, sub, ringClass = "", ringText = "") {
    if (ringClass) return `<section class="card kpiCard ringKpi"><div class="ring ${ringClass}"><strong>${esc(value)}</strong><small>${esc(ringText)}</small></div><div class="kpiCopy"><h4>${esc(title)}</h4><p>${esc(sub)}</p></div></section>`;
    return `<section class="card kpiCard textKpi"><div class="kpiCopy"><h4>${esc(title)}</h4><strong class="kpiValue ${title === "Errores" ? "danger" : ""}">${esc(value)}</strong><p>${esc(sub)}</p></div></section>`;
  }

  function stepRow(step, index) {
    const read = isRead(step.fn);
    const expectedDisabled = step.expectedMode === "response" || step.expectedMode === "count";
    return `<tr>
      <td class="colActive"><input type="checkbox" data-i="${index}" data-field="on" ${step.on ? "checked" : ""}></td>
      <td class="colPaso">${index + 1}</td>
      <td class="colSlave"><input class="slaveInput" inputmode="numeric" data-i="${index}" data-field="slave" value="${esc(step.slave)}"></td>
      <td class="colFn"><select data-i="${index}" data-field="fn">${functionOptions(step.fn)}</select></td>
      <td class="colAddr"><input inputmode="numeric" data-i="${index}" data-field="addr" value="${esc(step.addr)}"></td>
      <td class="colCount"><input inputmode="numeric" data-i="${index}" data-field="count" ${read ? "" : "disabled"} value="${esc(countNumber(step))}"></td>
      <td class="colValue"><input data-i="${index}" data-field="value" ${read ? "disabled" : ""} value="${esc(read ? "—" : step.value)}"></td>
      <td class="colMode"><select data-i="${index}" data-field="expectedMode">${validationOptions(step.expectedMode, step.fn)}</select></td>
      <td class="colExpected"><input data-i="${index}" data-field="expectedValue" ${expectedDisabled ? "disabled" : ""} placeholder="${esc(expectedAutoText(step))}" value="${esc(expectedDisabled ? "" : step.expectedValue)}"></td>
      <td class="colTimeout"><input inputmode="numeric" data-i="${index}" data-field="to" value="${esc(step.to)}"></td>
      <td class="colResult">${resultHtml(step.res)}</td>
      <td class="colTrash"><button class="tiny" data-action="delete-step" data-i="${index}">🗑</button></td>
    </tr>`;
  }

  function planTable() {
    return `<div class="planBody"><table class="planTable"><thead><tr><th>Activo</th><th>Paso</th><th>Slave</th><th>Función</th><th>Dirección</th><th>Cantidad</th><th>Valor</th><th>Validación</th><th>Esperado</th><th>Timeout</th><th>Resultado</th><th></th></tr></thead><tbody>${st.steps.map(stepRow).join("")}</tbody></table></div><div class="infoLine">ⓘ Cantidad se usa en lecturas. Valor se usa en escrituras. Validación define si basta respuesta/cantidad o si se comparan valores exactos.</div>`;
  }

  function scenariosHtml() {
    if (st.manage) return scenarioManagerHtml();
    return `<section class="card scenarios"><h3>Escenarios</h3><div class="scenarioList">${Object.entries(st.scenarios).map(([id, scenario]) => `<button class="scenarioCard ${id === st.sc ? "selected" : ""}" data-action="select-scenario" data-id="${esc(id)}"><span class="scenarioIcon ${esc(scenario.color)}">${esc(scenario.icon)}</span><span><strong>${esc(scenario.name)}</strong><small>${esc(scenario.desc)}</small></span><i class="scenarioRadio"></i></button>`).join("")}</div><button class="manageScenarios" data-action="manage-scenarios">Gestionar escenarios ›</button></section>`;
  }

  function scenarioManagerHtml() {
    const scenario = st.scenarios[st.sc] || defaultScenarios.normal;
    const isDefault = defaultScenarioIds.has(st.sc);
    return `<section class="card scenarios scenarioManager"><h3>Gestionar escenarios</h3><div class="managerTop"><label>Escenario activo<select data-action="manager-select">${Object.entries(st.scenarios).map(([id, s]) => `<option value="${esc(id)}" ${id === st.sc ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label><button data-action="new-scenario">+ Nuevo</button></div><label>Nombre<input data-scenario-field="name" value="${esc(scenario.name)}"></label><label>Descripción<textarea data-scenario-field="desc">${esc(scenario.desc)}</textarea></label><div class="twoCols"><label>Ícono<input data-scenario-field="icon" value="${esc(scenario.icon)}"></label><label>Color<select data-scenario-field="color">${Object.entries(colorOptions).map(([key, label]) => `<option value="${key}" ${scenario.color === key ? "selected" : ""}>${label}</option>`).join("")}</select></label></div><button data-action="use-current-plan">Usar plan visible como pasos</button><div class="twoCols"><button data-action="duplicate-scenario">Duplicar</button>${isDefault ? `<button data-action="restore-scenario">Restaurar base</button>` : `<button data-action="delete-scenario">Eliminar</button>`}</div><button class="primary wide" data-action="save-manager">Guardar y volver</button></section>`;
  }

  function simHtml() {
    return `<section class="card sim"><h3>Simulador slave <small>(PC como slave)</small></h3><label>Estado<input disabled value="${esc(st.sim)}"></label><label>Dirección slave<input inputmode="numeric" value="1"></label><label>Puerto<input disabled value="${esc(port())}"></label><label>Baud Rate<input disabled value="${esc(baud())}"></label><button class="simButton" data-action="toggle-sim">▶ ${st.sim === "Detenido" ? "Preparar" : "Detener"} simulador slave</button><button data-action="sim-settings">⚙</button></section>`;
  }

  function execRows() {
    return st.steps.map((step, index) => `<tr><td>${esc(step.at || "—")}</td><td>${index + 1}</td><td>${esc(step.slave)}</td><td>${esc(F[step.fn])}</td><td>${esc(step.addr)}</td><td>${esc(isRead(step.fn) ? countNumber(step) : step.value)}</td><td>${resultHtml(step.res)}</td><td>${step.ms == null ? "—" : `${esc(step.ms)} ms`}</td><td>${esc(step.detail || "Pendiente de ejecución.")}</td><td><button class="tiny infoBtn" data-action="show-detail" data-i="${index}">ⓘ</button></td></tr>`).join("");
  }

  function detailHtml(index) {
    const step = st.steps[index];
    if (!step) return "";
    const rows = step.rows || [];
    return `<div class="detailPanel"><button class="closeDetail" data-action="close-detail">×</button><h3>Detalle del paso ${index + 1}</h3><p>${esc(F[step.fn])} · ${esc(step.detail || "Sin detalle.")}</p><div class="detailGrid"><span><small>Función</small><strong>${esc(F[step.fn])}</strong></span><span><small>Slave ID</small><strong>${esc(step.slave)}</strong></span><span><small>Dirección inicial</small><strong>${esc(step.addr)}</strong></span><span><small>${isRead(step.fn) ? "Cantidad" : "Valor"}</small><strong>${esc(isRead(step.fn) ? countNumber(step) : step.value)}</strong></span><span><small>Validación</small><strong>${esc(validationModes[step.expectedMode])}</strong></span><span><small>Resultado</small><strong>${esc(step.res)}</strong></span></div><div class="execBody detailTable"><table><thead><tr><th>Dirección</th><th>Nombre</th><th>Esperado</th><th>Leído/Escrito</th><th>Tipo</th><th>Validación</th></tr></thead><tbody>${rows.length ? rows.map((row) => `<tr><td>${esc(row.address)}</td><td>${esc(row.name)}</td><td>${esc(row.expected)}</td><td>${valueBadge(row.actual, row.type === "bool")}</td><td>${esc(row.type)}</td><td class="${row.validation === "No coincide" ? "resultBad" : row.validation === "OK" ? "resultOK" : ""}">${esc(row.validation)}</td></tr>`).join("") : `<tr><td colspan="6">Este paso no tiene valores detallados.</td></tr>`}</tbody></table></div></div>`;
  }

  function execHtml() {
    return `<section class="card exec"><div class="execHeader"><h3>Registro de ejecución</h3><div><button data-action="clear-log">🗑 Limpiar registro</button><button data-action="export-log">⇩ Exportar</button></div></div>${st.detail == null ? `<div class="execBody"><table><thead><tr><th>Hora</th><th>Paso</th><th>Slave</th><th>Función</th><th>Dirección</th><th>Cantidad/Valor</th><th>Resultado</th><th>Tiempo</th><th>Detalle</th><th>Info</th></tr></thead><tbody>${execRows()}</tbody></table></div>` : detailHtml(st.detail)}</section>`;
  }

  function render() {
    const root = document.getElementById(overlayId);
    if (!root) return;
    const k = kpis();
    root.innerHTML = `<div class="testsRuntime"><section class="card plan"><div class="planHeader"><div class="planTitle"><h2>Plan de pruebas al slave</h2><p>PC como Master</p></div><div class="planActions"><button class="primary" data-action="run">▶ Iniciar prueba</button><button data-action="stop">■ Detener</button><button data-action="add-step">+ Agregar paso</button><button data-action="save-plan">💾 Guardar plan</button></div></div>${planTable()}</section>${scenariosHtml()}${simHtml()}<div class="testkpis">${kpiCard("Tasa de éxito", `${k.rate}%`, `Última ejecución: ${k.passed}/${k.executed || k.total} aprobados`, "success", "Éxito")}${kpiCard("Latencia promedio", k.avg == null ? "—" : `${k.avg} ms`, k.executed ? `Última ejecución: ${k.executed} paso(s)` : "Sin datos todavía")}${kpiCard("Errores", String(k.failed), "Última ejecución")}${kpiCard("Pasos completados", `${k.passed}/${k.total}`, "Última ejecución", "steps", "Pasos")}</div>${execHtml()}</div>`;
    bind();
  }

  function style() {
    if (document.getElementById(styleId)) return;
    const e = document.createElement("style");
    e.id = styleId;
    e.textContent = `
#${overlayId}{position:fixed;z-index:40;background:linear-gradient(180deg,#061b2d,#031323);padding:12px;box-sizing:border-box;pointer-events:auto;color:var(--text,#eef7ff);overflow:hidden}.jw-tests-overlay-active .workspace .tests{visibility:hidden!important}
.testsRuntime{height:100%;min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr)318px;grid-template-rows:minmax(0,1.15fr)126px minmax(0,.82fr);gap:12px}.testsRuntime .card{min-height:0;overflow:hidden;border:1px solid #2d5c75;border-radius:9px;background:linear-gradient(180deg,#0b2a42dd,#071f33dd);box-shadow:inset 0 0 0 1px #ffffff06}.testsRuntime h2,.testsRuntime h3,.testsRuntime h4{margin:0;color:#00d5ff}.testsRuntime p{margin:0;color:#aac3d2}.testsRuntime .plan{grid-column:1;grid-row:1;display:flex;flex-direction:column;padding:12px}.testsRuntime .scenarios{grid-column:2;grid-row:1;display:flex;flex-direction:column;gap:10px;padding:12px}.testsRuntime .sim{grid-column:2;grid-row:2/4;display:flex;flex-direction:column;gap:10px;padding:12px}.testsRuntime .testkpis{grid-column:1;grid-row:2;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.testsRuntime .exec{grid-column:1;grid-row:3;display:flex;flex-direction:column;padding:10px}.testsRuntime .planHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex:0 0 auto;margin-bottom:8px}.testsRuntime .planTitle{display:grid;gap:8px}.testsRuntime .planActions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.testsRuntime button{border:1px solid #2d5c75;border-radius:7px;background:#061a2b;color:#eef7ff;padding:7px 10px;font-weight:700;cursor:pointer}.testsRuntime button.primary{background:linear-gradient(180deg,#1498f3,#0878c7);border-color:#11a7ff}.testsRuntime button.wide{width:100%}.testsRuntime .planBody,.testsRuntime .execBody{min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#2d87aa #071d30}.testsRuntime table{width:100%;border-collapse:collapse;font-size:.84rem}.testsRuntime th,.testsRuntime td{border-bottom:1px solid #4588a640;padding:5px 7px;text-align:left;vertical-align:middle}.testsRuntime th{color:#aac3d2;font-weight:600;background:#ffffff0a;position:sticky;top:0;z-index:1}.testsRuntime input,.testsRuntime select,.testsRuntime textarea{width:100%;min-height:29px;border:1px solid #2d5c75;border-radius:6px;background:#061a2b;color:#eef7ff;padding:4px 7px;box-sizing:border-box}.testsRuntime textarea{min-height:58px;resize:vertical;font-family:inherit}.testsRuntime input:disabled{opacity:.62;color:#aac3d2}.testsRuntime input[type=checkbox]{width:17px;min-height:17px;accent-color:#5ce044}.testsRuntime .slaveInput{-moz-appearance:textfield}.testsRuntime .slaveInput::-webkit-inner-spin-button,.testsRuntime .slaveInput::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.testsRuntime .colActive{width:42px}.testsRuntime .colPaso{width:38px}.testsRuntime .colSlave{width:72px}.testsRuntime .colFn{width:185px}.testsRuntime .colAddr{width:86px}.testsRuntime .colCount{width:70px}.testsRuntime .colValue{width:138px}.testsRuntime .colMode{width:152px}.testsRuntime .colExpected{width:150px}.testsRuntime .colTimeout{width:78px}.testsRuntime .colResult{width:120px}.testsRuntime .colTrash{width:34px}.testsRuntime .infoLine{margin-top:7px;padding:7px 9px;border:1px solid #007da850;border-radius:7px;background:#073a5566;color:#aac3d2}.testsRuntime .scenarioList{display:flex;flex:1 1 auto;min-height:0;overflow:auto;flex-direction:column;gap:10px;padding-right:4px;scrollbar-width:thin;scrollbar-color:#2d87aa #071d30}.testsRuntime .scenarioCard{display:grid;grid-template-columns:46px 1fr 28px;gap:10px;align-items:center;min-height:70px;padding:10px;border:1px solid #2d5c75;border-radius:11px;background:linear-gradient(180deg,#ffffff0d,#ffffff05);color:#eef7ff;text-align:left;flex:0 0 auto}.testsRuntime .scenarioCard.selected{border-color:#00d5ff;background:linear-gradient(180deg,#00bfff24,#00bfff0b);box-shadow:0 0 16px #00bfff1d,inset 0 0 0 1px #00bfff33}.testsRuntime .scenarioIcon{display:grid;place-items:center;width:42px;height:42px;border-radius:10px;font-size:1.35rem}.testsRuntime .scenarioIcon.shield{background:#1f6e3b88}.testsRuntime .scenarioIcon.clock,.testsRuntime .scenarioIcon.warn{background:#9a5d1288}.testsRuntime .scenarioIcon.bad{background:#9b313d88}.testsRuntime .scenarioIcon.cyan{background:#136b8e88}.testsRuntime .scenarioCard strong,.testsRuntime .scenarioCard small{display:block}.testsRuntime .scenarioCard small{color:#aac3d2;margin-top:4px;line-height:1.25}.testsRuntime .scenarioRadio{display:grid;place-items:center;width:24px;height:24px;border:2px solid #45677a;border-radius:50%}.testsRuntime .scenarioCard.selected .scenarioRadio{border-color:#00d5ff;background:radial-gradient(circle at center,#dff7ff 0 36%,transparent 40%)}.testsRuntime .manageScenarios{flex:0 0 auto}.testsRuntime .scenarioManager{overflow:auto}.testsRuntime .managerTop,.testsRuntime .twoCols{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.testsRuntime .sim small{color:#aac3d2}.testsRuntime .simButton{background:linear-gradient(180deg,#9b37e8,#7b19ce);border-color:#b859ff}.testsRuntime .kpiCard{padding:12px 16px;display:flex!important;align-items:center!important;justify-content:center!important;gap:18px}.testsRuntime .kpiCard .kpiCopy{display:flex;flex-direction:column;justify-content:center;gap:4px;min-width:0}.testsRuntime .kpiCard h4{color:#b9d1df;font-size:1rem}.testsRuntime .kpiCard p{font-size:.82rem;color:#aac3d2;margin:0}.testsRuntime .textKpi{align-items:center!important;justify-content:flex-start!important}.testsRuntime .kpiValue{display:block!important;border:0!important;background:transparent!important;box-shadow:none!important;color:#00d5ff!important;font-size:1.9rem!important;line-height:1.1!important;padding:0!important;margin:0!important;min-height:0!important}.testsRuntime .kpiValue.danger{color:#ff5d5d!important}.testsRuntime .ring{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#5ce044 var(--pct,100%),#0b3952 0);position:relative;flex:0 0 auto}.testsRuntime .ring.steps{background:conic-gradient(#00c8ff var(--pct,100%),#0b3952 0)}.testsRuntime .ring::after{content:"";position:absolute;inset:13px;border-radius:50%;background:#062033}.testsRuntime .ring strong,.testsRuntime .ring small{position:relative;z-index:1}.testsRuntime .ring strong{font-size:1.25rem}.testsRuntime .ring small{font-size:.65rem;color:#eef7ff;margin-top:30px;position:absolute}.testsRuntime .execHeader{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.testsRuntime .execHeader div{display:flex;gap:8px}.testsRuntime .resultOK{color:#5ce044;font-weight:800}.testsRuntime .resultWarn{color:#ffb22e;font-weight:800}.testsRuntime .resultBad{color:#ff5d5d;font-weight:800}.testsRuntime .bitBadge{display:inline-block;min-width:42px;text-align:center;border-radius:999px;padding:2px 9px;font-weight:800}.testsRuntime .bitBadge.on{background:#228a3c;color:white}.testsRuntime .bitBadge.off{background:#34495a;color:white}.testsRuntime .tiny{padding:4px 7px;min-width:26px}.testsRuntime .detailPanel{display:flex;flex-direction:column;min-height:0;position:relative}.testsRuntime .closeDetail{position:absolute;right:0;top:0}.testsRuntime .detailGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin:12px 36px 8px 0}.testsRuntime .detailGrid span{border:1px solid #2d5c75;border-radius:6px;padding:7px;background:#061a2b}.testsRuntime .detailGrid small,.testsRuntime .detailGrid strong{display:block}.testsRuntime .detailGrid small{color:#aac3d2}.testsRuntime .detailTable{flex:1 1 auto}
`;
    document.head.appendChild(e);
  }

  function updateField(target, shouldRender) {
    const index = target.dataset?.i != null ? Number(target.dataset.i) : null;
    const field = target.dataset?.field;
    if (index == null || !field || !st.steps[index]) return false;
    const step = st.steps[index];
    if (field === "on") step.on = target.checked;
    else if (field === "fn") {
      const nextFn = target.value;
      step.fn = nextFn;
      step.addr = def(nextFn);
      step.count = defaultCount(nextFn);
      step.value = defaultValue(nextFn);
      step.expectedMode = defaultMode(nextFn);
      step.expectedValue = "";
    } else if (field === "expectedMode") {
      step.expectedMode = target.value;
      step.expectedValue = step.expectedMode === "exact" ? (isWrite(step.fn) ? step.value : "") : "";
    } else if (field === "slave") step.slave = Math.max(1, Math.min(247, parseInt(target.value, 10) || 1));
    else if (field === "addr") step.addr = Number(target.value) || 0;
    else if (field === "count") step.count = String(target.value);
    else if (field === "value") { step.value = String(target.value); if (!isRead(step.fn)) step.count = String(countNumber(step)); }
    else if (field === "expectedValue") step.expectedValue = String(target.value);
    else if (field === "to") step.to = Number(target.value) || 1000;
    st.steps[index] = cleanStep(step);
    persistSilent();
    if (shouldRender) render();
    return true;
  }

  function bind() {
    const root = document.getElementById(overlayId);
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    root.addEventListener("input", (event) => {
      const target = event.target;
      if (target?.matches?.("input[data-field], textarea[data-scenario-field], input[data-scenario-field]")) {
        if (target.dataset?.scenarioField) {
          const scenario = st.scenarios[st.sc];
          scenario[target.dataset.scenarioField] = target.value;
          st.scenarios[st.sc] = normalizeScenario(scenario, scenario);
          persistSilent();
          return;
        }
        updateField(target, false);
      }
    });

    root.addEventListener("change", (event) => {
      const target = event.target;
      if (target.dataset?.field) {
        const renderNeeded = target.tagName === "SELECT" || target.type === "checkbox";
        updateField(target, renderNeeded);
      }
      if (target.dataset?.scenarioField) {
        const scenario = st.scenarios[st.sc];
        scenario[target.dataset.scenarioField] = target.value;
        st.scenarios[st.sc] = normalizeScenario(scenario, scenario);
        persistSilent();
        if (target.tagName === "SELECT") render();
      }
      if (target.dataset?.action === "manager-select") {
        st.sc = target.value;
        const scenario = st.scenarios[st.sc];
        if (scenario?.steps) st.steps = scenario.steps.map(cloneStep);
        persistSilent();
        render();
      }
    });

    root.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      const index = button.dataset.i != null ? Number(button.dataset.i) : null;
      if (action === "run") await runPlan();
      if (action === "stop") { st.stopped = true; st.running = false; msg("Prueba detenida por el usuario."); render(); }
      if (action === "add-step") { st.steps.push(mk(sid(), "fc3", 40000, "1", "", "count")); persistPlanMessage(); render(); }
      if (action === "delete-step" && index != null) { st.steps.splice(index, 1); persistPlanMessage(); render(); }
      if (action === "save-plan") { if (st.scenarios[st.sc]) st.scenarios[st.sc].steps = st.steps.map(cleanStep); persistPlanMessage(); render(); }
      if (action === "select-scenario") { st.sc = button.dataset.id; const scenario = st.scenarios[st.sc]; st.steps = scenario?.steps ? scenario.steps.map(cloneStep) : plan(sid()); st.detail = null; persistSilent(); render(); }
      if (action === "manage-scenarios") { st.manage = true; render(); }
      if (action === "save-manager") { st.manage = false; persistPlanMessage(); render(); }
      if (action === "new-scenario") { const id = `custom_${Date.now()}`; st.scenarios[id] = normalizeScenario({ icon: "🧪", name: "Nuevo escenario", desc: "Escenario personalizado.", color: "cyan", steps: st.steps.map(cleanStep) }); st.sc = id; persistSilent(); render(); }
      if (action === "use-current-plan") { st.scenarios[st.sc].steps = st.steps.map(cleanStep); persistPlanMessage(); render(); }
      if (action === "duplicate-scenario") { const id = `custom_${Date.now()}`; st.scenarios[id] = normalizeScenario({ ...clone(st.scenarios[st.sc]), name: `${st.scenarios[st.sc].name} copia`, steps: st.steps.map(cleanStep) }); st.sc = id; persistSilent(); render(); }
      if (action === "restore-scenario" && defaultScenarioIds.has(st.sc)) { st.scenarios[st.sc] = normalizeScenario(defaultScenarios[st.sc], defaultScenarios[st.sc]); st.steps = plan(sid()); persistPlanMessage(); render(); }
      if (action === "delete-scenario" && !defaultScenarioIds.has(st.sc)) { delete st.scenarios[st.sc]; st.sc = "normal"; st.steps = st.scenarios.normal.steps ? st.scenarios.normal.steps.map(cloneStep) : plan(sid()); persistPlanMessage(); render(); }
      if (action === "clear-log") { st.log = []; st.detail = null; st.steps = st.steps.map(cloneStep); persistSilent(); render(); }
      if (action === "show-detail" && index != null) { st.detail = index; render(); }
      if (action === "close-detail") { st.detail = null; render(); }
      if (action === "toggle-sim") { st.sim = st.sim === "Detenido" ? "Preparado" : "Detenido"; persistSilent(); render(); }
    });
  }

  function applyGeometry(root, area) {
    const rect = area.getBoundingClientRect();
    const key = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`;
    if (key === lastRectKey) return false;
    lastRectKey = key;
    root.style.left = `${rect.left}px`;
    root.style.top = `${rect.top}px`;
    root.style.width = `${rect.width}px`;
    root.style.height = `${rect.height}px`;
    return true;
  }

  function mount() {
    const area = workspace();
    if (!area) return;
    style();
    document.body.classList.add("jw-tests-overlay-active");
    let root = document.getElementById(overlayId);
    const isNew = !root;
    if (!root) {
      root = document.createElement("div");
      root.id = overlayId;
      document.body.appendChild(root);
      const pending = window.__jwPendingTestsRuntimeState;
      if (pending) importRuntimeState(pending);
    }
    applyGeometry(root, area);
    if (isNew || !mounted || !root.querySelector(".testsRuntime")) {
      mounted = true;
      render();
    }
  }

  function unmount() {
    document.body.classList.remove("jw-tests-overlay-active");
    document.getElementById(overlayId)?.remove();
    mounted = false;
    lastRectKey = "";
  }

  function sync() {
    try { if (active()) mount(); else unmount(); }
    catch (error) { console.warn("[JW Modbus Tool] Pruebas runtime protegido", error); unmount(); }
  }

  exposeRuntimeState();
  if (window.__jwPendingTestsRuntimeState) importRuntimeState(window.__jwPendingTestsRuntimeState);
  setInterval(sync, 450);
  window.addEventListener("resize", () => { lastRectKey = ""; sync(); });
  window.addEventListener("jw-simple-tests-runtime-import", (event) => importRuntimeState(event.detail));
  setTimeout(sync, 80);
}
