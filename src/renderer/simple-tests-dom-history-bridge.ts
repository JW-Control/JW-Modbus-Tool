// @ts-nocheck
export {};

const installKey = "__jwSimpleTestsNativeHistoryBridgeInstalled_v1";
const storageKey = "jw-modbus-tool.simple.tests-execution-history.v1";
const seenKey = "__jwSimpleTestsNativeHistorySeenKeys_v1";
const maxItems = 200;

let lastRun = null;

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

function resetSeenKeys(items = readHistory()) {
  const set = new Set(items.map((item) => item.key).filter(Boolean));
  window[seenKey] = set;
  return set;
}

function writeHistory(items) {
  const clean = Array.isArray(items) ? items.slice(0, maxItems) : [];
  window.localStorage?.setItem(storageKey, JSON.stringify(clean));
  resetSeenKeys(clean);
  window.dispatchEvent(new CustomEvent("jw-simple-tests-history-updated", { detail: clean }));
}

function clearHistory() {
  lastRun = { reason: "clear", entries: 0, at: new Date().toISOString() };
  writeHistory([]);
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      ...entry,
      key: String(entry.key || [entry.runId || "run", entry.step || index + 1, entry.functionCode || entry.method || "FC"].join("|")),
      completedAt: entry.completedAt || new Date().toISOString(),
      startedAt: entry.startedAt || entry.completedAt || new Date().toISOString(),
      status: entry.status || "Error"
    }));
}

function appendEntries(entries, meta = {}) {
  const normalized = normalizeEntries(entries);
  if (!normalized.length) {
    lastRun = { ...meta, entries: 0, added: 0, at: new Date().toISOString() };
    return 0;
  }

  const current = readHistory();
  const seen = resetSeenKeys(current);
  const additions = [];

  for (const entry of normalized) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    additions.push(entry);
  }

  if (additions.length) writeHistory([...additions, ...current]);

  lastRun = {
    ...meta,
    entries: normalized.length,
    added: additions.length,
    at: new Date().toISOString()
  };

  return additions.length;
}

function buttonText(target) {
  const button = target?.closest?.("button");
  return button ? String(button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() : "";
}

function maybeClearFromButton(event) {
  const label = buttonText(event.target);
  if (!label) return;
  if (label.includes("limpiar registro") || label.includes("nueva sesión") || label === "nuevo") {
    clearHistory();
  }
}

function buildDebugApi() {
  return {
    storageKey,
    get: readHistory,
    count: () => readHistory().length,
    clear: () => clearHistory(),
    lastRun: () => lastRun,
    capture: () => 0,
    pending: () => null,
    flushPending: () => false,
    lastCapture: () => lastRun,
    lastAttempt: () => lastRun,
    locked: () => false
  };
}

function install() {
  window.__jwSimpleTestsDomHistoryDebug = buildDebugApi();
  window.__jwSimpleTestsHistoryDebug = window.__jwSimpleTestsHistoryDebug || buildDebugApi();

  document.addEventListener("click", maybeClearFromButton, true);

  window.addEventListener("jw-simple-tests-run-completed", (event) => {
    const detail = event.detail || {};
    appendEntries(detail.entries, {
      runId: detail.runId,
      stopped: Boolean(detail.stopped),
      completedAt: detail.completedAt,
      source: "native-run-event"
    });
    window.__jwSimpleTestsDomHistoryDebug = buildDebugApi();
    window.__jwSimpleTestsHistoryDebug = buildDebugApi();
  });

  window.addEventListener("jw-simple-tests-history-updated", () => {
    window.__jwSimpleTestsDomHistoryDebug = buildDebugApi();
    window.__jwSimpleTestsHistoryDebug = buildDebugApi();
  });
}

if (!window[installKey]) {
  window[installKey] = true;
  if (document.body) install();
  else window.addEventListener("DOMContentLoaded", install, { once: true });
}
