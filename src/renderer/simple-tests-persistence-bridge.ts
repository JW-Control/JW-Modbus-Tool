// @ts-nocheck
export {};

const storageKey = "jw-modbus-tool.simple.tests-runtime.v1";
const runtimeFormat = "jwmodbus-tests-runtime";
let bridgeInstalled = false;

function isRuntimeState(value) {
  return Boolean(value && typeof value === "object" && value.format === runtimeFormat && Array.isArray(value.steps));
}

function readStoredRuntimeState() {
  try {
    const raw = window.localStorage?.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isRuntimeState(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[JW Modbus Tool] No se pudo leer el plan de pruebas local", error);
    return null;
  }
}

function writeStoredRuntimeState(state) {
  if (!isRuntimeState(state)) return;
  try {
    window.__jwPendingTestsRuntimeState = state;
    window.localStorage?.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.warn("[JW Modbus Tool] No se pudo guardar el plan de pruebas local", error);
  }
}

function currentRuntimeState() {
  try {
    const exported = window.__jwSimpleTestsRuntimeState?.export?.();
    if (isRuntimeState(exported)) return exported;
  } catch (error) {
    console.warn("[JW Modbus Tool] No se pudo exportar el plan de pruebas activo", error);
  }
  return readStoredRuntimeState();
}

function importRuntimeState(state) {
  if (!isRuntimeState(state)) return;
  writeStoredRuntimeState(state);
  try {
    window.__jwSimpleTestsRuntimeState?.import?.(state);
  } catch (error) {
    console.warn("[JW Modbus Tool] No se pudo importar el plan de pruebas activo", error);
  }
}

function installSessionBridge() {
  if (bridgeInstalled) return true;
  const sessions = window.jwModbus?.sessions;
  if (!sessions?.saveFile) return false;

  const bridgeFlag = "__jwTestsPersistenceBridge";
  if (sessions[bridgeFlag]) {
    bridgeInstalled = true;
    return true;
  }

  const originalSaveFile = sessions.saveFile.bind(sessions);
  const originalOpenFile = sessions.openFile?.bind(sessions);

  sessions.saveFile = async (args = {}) => {
    const runtimeState = currentRuntimeState();
    const data = { ...(args?.data || {}) };
    if (runtimeState) data.testsRuntime = runtimeState;
    return originalSaveFile({ ...args, data });
  };

  if (originalOpenFile) {
    sessions.openFile = async (...args) => {
      const result = await originalOpenFile(...args);
      const runtimeState = result?.ok && result.value?.data?.testsRuntime;
      if (isRuntimeState(runtimeState)) importRuntimeState(runtimeState);
      return result;
    };
  }

  sessions[bridgeFlag] = true;
  bridgeInstalled = true;
  return true;
}

function start() {
  const stored = readStoredRuntimeState();
  if (stored) window.__jwPendingTestsRuntimeState = stored;

  window.addEventListener("jw-simple-tests-plan-updated", (event) => {
    writeStoredRuntimeState(event.detail);
  });

  const timer = window.setInterval(() => {
    if (installSessionBridge()) window.clearInterval(timer);
  }, 200);

  window.setTimeout(() => window.clearInterval(timer), 10000);
}

try {
  start();
} catch (error) {
  console.error("[JW Modbus Tool] Tests persistence bridge failed", error);
}
