// @ts-nocheck
export {};

const installKey = "__jwSimpleTestsDomHistoryBridgeInstalled_v7";
const storageKey = "jw-modbus-tool.simple.tests-execution-history.v1";
const seenKey = "__jwSimpleTestsDomHistorySeenKeys_v7";
const maxItems = 200;
let capturePausedUntil = 0;
let pendingRun = null;
let pendingPoll = null;

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

function clearPendingPoll() {
  if (pendingPoll != null) window.clearTimeout(pendingPoll);
  pendingPoll = null;
}

function clearHistory() {
  capturePausedUntil = Date.now() + 1200;
  pendingRun = null;
  clearPendingPoll();
  writeHistory([]);
  window.setTimeout(() => writeHistory([]), 150);
  window.setTimeout(() => writeHistory([]), 700);
}

function text(cell) {
  return String(cell?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function statusFromText(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("aprobado") || normalized === "ok") return "OK";
  if (normalized.includes("timeout")) return "Timeout";
  if (normalized.includes("crc")) return "CRC Error";
  if (normalized.includes("excepcion") || normalized.includes("excepción")) return "Excepción";
  if (normalized.includes("fallida") || normalized.includes("error")) return "Error";
  if (normalized.includes("ejecutando")) return "Ejecutando";
  return "Pendiente";
}

function functionCode(label) {
  const match = String(label || "").match(/FC\d{2}/i);
  return match ? match[0].toUpperCase() : String(label || "");
}

function parseElapsedMs(value) {
  const match = String(value || "").match(/([\d.]+)/);
  return match ? Math.round(Number(match[1])) : null;
}

function parseSlave(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function inferQuantity(functionLabel, amountText) {
  const textValue = String(amountText || "").trim();
  if (!textValue) return 1;
  if (/^FC0[1-4]/i.test(functionLabel)) {
    const qty = Number(textValue);
    return Number.isFinite(qty) ? qty : 1;
  }
  if (textValue.includes(",")) return textValue.split(",").filter(Boolean).length;
  return 1;
}

function parseValues(functionLabel, amountText) {
  const textValue = String(amountText || "").trim();
  if (!textValue || /^FC0[1-4]/i.test(functionLabel)) return [];
  return textValue.split(/[;,\s]+/).map((item) => item.trim()).filter(Boolean);
}

function visibleRunRows() {
  const tests = document.querySelector(".testsNative");
  if (!tests) return [];
  return Array.from(tests.querySelectorAll(".testsLogCard tbody tr"));
}

function rowStatus(row) {
  const cells = row.querySelectorAll("td");
  return statusFromText(text(cells[6]));
}

function finalRowsFrom(rows) {
  return rows.filter((row) => !["Pendiente", "Ejecutando"].includes(rowStatus(row)));
}

function buildItem(row, runId) {
  const cells = Array.from(row.querySelectorAll("td"));
  if (cells.length < 9) return null;

  const hour = text(cells[0]);
  const step = text(cells[1]);
  const slaveText = text(cells[2]);
  const fnLabel = text(cells[3]);
  const address = text(cells[4]);
  const amount = text(cells[5]);
  const resultText = text(cells[6]);
  const elapsedText = text(cells[7]);
  const detail = text(cells[8]);
  const status = statusFromText(resultText);

  if (!hour || hour === "-" || status === "Pendiente" || status === "Ejecutando") return null;

  const fnCode = functionCode(fnLabel);
  const key = [runId, step, slaveText, fnCode, address, amount, status].join("|");
  const today = new Date().toISOString().slice(0, 10);
  const completedAt = new Date(`${today}T${hour.length === 5 ? `${hour}:00` : hour}`).toISOString();

  return {
    key,
    item: {
      id: `test-run-${runId}-${step}-${Date.now()}-${Math.round(Math.random() * 100000)}`,
      runId,
      step: Number(step),
      startedAt: completedAt,
      completedAt,
      elapsedMs: parseElapsedMs(elapsedText),
      source: "Pruebas",
      role: "PC Master",
      method: fnCode,
      functionCode: fnCode,
      functionLabel: fnLabel,
      unitId: parseSlave(slaveText),
      address: Number(address),
      quantity: inferQuantity(fnLabel, amount),
      values: parseValues(fnLabel, amount),
      timeoutMs: null,
      status,
      summary: detail || resultText,
      response: null,
      error: status === "OK" ? null : detail || resultText
    }
  };
}

function hydrateSeenKeys() {
  if (window[seenKey]) return window[seenKey];
  return resetSeenKeys();
}

function appendRunHistory(rows, runId) {
  const seen = hydrateSeenKeys();
  const current = readHistory();
  const additions = [];

  for (const row of rows) {
    const parsed = buildItem(row, runId);
    if (!parsed || seen.has(parsed.key)) continue;
    seen.add(parsed.key);
    additions.push({ ...parsed.item, key: parsed.key });
  }

  if (additions.length) writeHistory([...additions, ...current]);
  return additions.length;
}

function isRunButtonReady() {
  const tests = document.querySelector(".testsNative");
  const buttons = Array.from(tests?.querySelectorAll("button") ?? []);
  const startButton = buttons.find((button) => text(button).toLowerCase().includes("iniciar prueba"));
  return Boolean(startButton && !startButton.disabled);
}

function finishPendingRun(reason = "poll") {
  if (!pendingRun || Date.now() < capturePausedUntil) return false;

  const run = pendingRun;
  const rows = visibleRunRows();
  const statuses = rows.map(rowStatus);
  const finalRows = finalRowsFrom(rows);
  const hasExecuting = statuses.includes("Ejecutando");
  const ready = isRunButtonReady();
  const expired = Date.now() > run.deadline;
  const completeRunVisible = rows.length > 0 && finalRows.length === rows.length;
  const canFinish = expired || (ready && !hasExecuting && completeRunVisible) || (reason === "manual-flush" && finalRows.length > 0);

  window.__jwSimpleTestsDomHistoryLastCaptureAttempt = {
    runId: run.id,
    reason,
    canFinish,
    ready,
    hasExecuting,
    rows: rows.length,
    finalRows: finalRows.length,
    statuses,
    expired
  };

  if (!canFinish) return false;

  const captured = appendRunHistory(finalRows, run.id);
  window.__jwSimpleTestsDomHistoryLastCapture = {
    runId: run.id,
    captured,
    rows: rows.length,
    finalRows: finalRows.length,
    expired,
    reason
  };
  pendingRun = null;
  clearPendingPoll();
  return true;
}

function scheduleRunCompletionPoll() {
  if (!pendingRun) return;
  clearPendingPoll();

  pendingPoll = window.setTimeout(() => {
    pendingPoll = null;
    if (!finishPendingRun("poll")) scheduleRunCompletionPoll();
  }, 180);
}

function startRunCapture() {
  if (Date.now() < capturePausedUntil) return;
  if (pendingRun && !finishPendingRun("before-next-run")) {
    scheduleRunCompletionPoll();
    return;
  }

  pendingRun = {
    id: `run-${Date.now()}-${Math.round(Math.random() * 100000)}`,
    startedAt: Date.now(),
    deadline: Date.now() + 60000
  };
  scheduleRunCompletionPoll();
}

function manualCapture() {
  const runId = `manual-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  return appendRunHistory(finalRowsFrom(visibleRunRows()), runId);
}

function maybeHandleButton(event) {
  const button = event.target?.closest?.("button");
  if (!button) return;
  const label = text(button).toLowerCase();
  if (label.includes("limpiar registro") || label.includes("nueva sesión") || label === "nuevo") {
    clearHistory();
    return;
  }
  if (label.includes("iniciar prueba")) {
    if (pendingRun && !finishPendingRun("before-next-run")) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      scheduleRunCompletionPoll();
      return;
    }
    window.setTimeout(startRunCapture, 80);
  }
}

function buildDebugApi() {
  return {
    storageKey,
    get: readHistory,
    count: () => readHistory().length,
    clear: () => clearHistory(),
    capture: () => manualCapture(),
    pending: () => pendingRun,
    flushPending: () => finishPendingRun("manual-flush"),
    lastCapture: () => window.__jwSimpleTestsDomHistoryLastCapture ?? null,
    lastAttempt: () => window.__jwSimpleTestsDomHistoryLastCaptureAttempt ?? null,
    pausedMs: () => Math.max(0, capturePausedUntil - Date.now())
  };
}

function install() {
  window.__jwSimpleTestsDomHistoryDebug = buildDebugApi();
  window.__jwSimpleTestsHistoryDebug = window.__jwSimpleTestsHistoryDebug || buildDebugApi();
  document.addEventListener("click", maybeHandleButton, true);
  window.setInterval(() => {
    window.__jwSimpleTestsDomHistoryDebug = buildDebugApi();
  }, 1000);
}

if (!window[installKey]) {
  window[installKey] = true;
  if (document.body) install();
  else window.addEventListener("DOMContentLoaded", install, { once: true });
}
