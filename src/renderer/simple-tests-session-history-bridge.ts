// @ts-nocheck
export {};

const installKey = "__jwSimpleTestsSessionHistoryBridgeInstalled";
const patchedSessionsKey = "__jwSimpleTestsHistorySessionsPatched";
const storageKey = "jw-modbus-tool.simple.tests-execution-history.v1";
const maxItems = 200;

function nowIso() {
  return new Date().toISOString();
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
