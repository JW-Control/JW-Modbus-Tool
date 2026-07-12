// @ts-nocheck
export {};

const installKey = "__jwSimpleTestsSessionHistoryBridgeInstalled";
const patchedModbusKey = "__jwSimpleTestsHistoryModbusPatched";
const patchedSessionsKey = "__jwSimpleTestsHistorySessionsPatched";
const storageKey = "jw-modbus-tool.simple.tests-execution-history.v1";
const maxItems = 200;

function nowIso() {
  return new Date().toISOString();
}

function isTestsViewActive() {
  return Boolean(document.querySelector(".testsNative"));
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value ?? "");
  } catch {
    return fallback;
  }
}

function readHistory() {
  const parsed = safeJsonParse(window.localStorage?.getItem(storageKey), []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeHistory(items) {
  const clean = Array.isArray(items) ? items.slice(0, maxItems) : [];
  window.localStorage?.setItem(storageKey, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent("jw-simple-tests-history-updated", { detail: clean }));
}

function appendHistory(item) {
  const next = [item, ...readHistory()].slice(0, maxItems);
  writeHistory(next);
}

function methodLabel(name) {
  const map = {
    readCoils: "FC01 Read Coils",
    readDiscreteInputs: "FC02 Read Discrete Inputs",
    readHoldingRegisters: "FC03 Read Holding Registers",
    readInputRegisters: "FC04 Read Input Registers",
    writeSingleCoil: "FC05 Write Single Coil",
    writeSingleRegister: "FC06 Write Single Register",
    writeMultipleCoils: "FC15 Write Multiple Coils",
    writeMultipleRegisters: "FC16 Write Multiple Registers"
  };
  return map[name] || name;
}

function methodCode(name) {
  const map = {
    readCoils: "FC01",
    readDiscreteInputs: "FC02",
    readHoldingRegisters: "FC03",
    readInputRegisters: "FC04",
    writeSingleCoil: "FC05",
    writeSingleRegister: "FC06",
    writeMultipleCoils: "FC15",
    writeMultipleRegisters: "FC16"
  };
  return map[name] || name;
}

function commandSummary(name, args) {
  const command = args?.[0] || {};
  const address = command.startAddress ?? command.address ?? null;
  const values = Array.isArray(command.values) ? command.values : command.value !== undefined ? [command.value] : [];
  const quantity = command.quantity ?? values.length || 1;
  return {
    method: name,
    functionCode: methodCode(name),
    functionLabel: methodLabel(name),
    unitId: command.unitId ?? null,
    address,
    quantity,
    values,
    timeoutMs: command.timeoutMs ?? null
  };
}

function unwrap(result) {
  if (!result || typeof result !== "object" || typeof result.ok !== "boolean") return { ok: true, value: result, error: null };
  return result.ok ? { ok: true, value: result.value, error: null } : { ok: false, value: null, error: result.error || "Error Modbus" };
}

function responseSummary(value) {
  if (!value || typeof value !== "object") return "Respuesta recibida";
  if (value.exception) return value.exception.exceptionName || "Excepción Modbus";
  if (value.crcOk === false) return "CRC inválido";
  const list = value.registerValues ?? value.values ?? value.data;
  if (Array.isArray(list)) return `${list.length} valor(es): ${list.slice(0, 6).join(", ")}${list.length > 6 ? ", ..." : ""}`;
  return "Respuesta OK";
}

function patchModbusApi() {
  const modbus = window.jwModbus?.modbus;
  if (!modbus || modbus[patchedModbusKey]) return Boolean(modbus?.[patchedModbusKey]);

  const methods = [
    "readCoils",
    "readDiscreteInputs",
    "readHoldingRegisters",
    "readInputRegisters",
    "writeSingleCoil",
    "writeSingleRegister",
    "writeMultipleCoils",
    "writeMultipleRegisters"
  ];

  for (const method of methods) {
    const original = modbus[method];
    if (typeof original !== "function") continue;
    modbus[method] = async (...args) => {
      const started = performance.now();
      const startedAt = nowIso();
      const command = commandSummary(method, args);
      try {
        const result = await original(...args);
        if (isTestsViewActive()) {
          const unwrapped = unwrap(result);
          const elapsedMs = Math.round((unwrapped.value?.elapsedMs ?? performance.now() - started));
          appendHistory({
            id: `test-${Date.now()}-${Math.round(Math.random() * 100000)}`,
            startedAt,
            completedAt: nowIso(),
            elapsedMs,
            source: "Pruebas",
            role: "PC Master",
            ...command,
            status: unwrapped.ok ? (unwrapped.value?.exception ? "Excepción" : unwrapped.value?.crcOk === false ? "CRC Error" : "OK") : "Error",
            summary: unwrapped.ok ? responseSummary(unwrapped.value) : unwrapped.error,
            response: unwrapped.value ?? null,
            error: unwrapped.error
          });
        }
        return result;
      } catch (error) {
        if (isTestsViewActive()) {
          appendHistory({
            id: `test-${Date.now()}-${Math.round(Math.random() * 100000)}`,
            startedAt,
            completedAt: nowIso(),
            elapsedMs: Math.round(performance.now() - started),
            source: "Pruebas",
            role: "PC Master",
            ...command,
            status: String(error?.message || error).toLowerCase().includes("timeout") ? "Timeout" : "Error",
            summary: String(error?.message || error || "Error Modbus"),
            response: null,
            error: String(error?.message || error || "Error Modbus")
          });
        }
        throw error;
      }
    };
  }

  modbus[patchedModbusKey] = true;
  return true;
}

function patchSessionsApi() {
  const sessions = window.jwModbus?.sessions;
  if (!sessions || sessions[patchedSessionsKey]) return Boolean(sessions?.[patchedSessionsKey]);

  if (typeof sessions.saveFile === "function") {
    const originalSave = sessions.saveFile;
    sessions.saveFile = async (payload) => {
      const history = readHistory();
      const nextPayload = payload && typeof payload === "object"
        ? {
            ...payload,
            data: payload.data && typeof payload.data === "object"
              ? { ...payload.data, testsExecutionHistory: history, testsExecutionHistoryUpdatedAt: nowIso() }
              : payload.data
          }
        : payload;
      return originalSave(nextPayload);
    };
  }

  if (typeof sessions.openFile === "function") {
    const originalOpen = sessions.openFile;
    sessions.openFile = async (...args) => {
      const result = await originalOpen(...args);
      const data = result?.ok ? result.value?.data : null;
      if (Array.isArray(data?.testsExecutionHistory)) writeHistory(data.testsExecutionHistory);
      return result;
    };
  }

  sessions[patchedSessionsKey] = true;
  return true;
}

function install() {
  patchModbusApi();
  patchSessionsApi();
  window.__jwSimpleTestsExecutionHistory = {
    get: readHistory,
    clear: () => writeHistory([]),
    storageKey
  };
}

if (!window[installKey]) {
  window[installKey] = true;
  install();
  const timer = window.setInterval(install, 250);
  window.setTimeout(() => window.clearInterval(timer), 5000);
}
