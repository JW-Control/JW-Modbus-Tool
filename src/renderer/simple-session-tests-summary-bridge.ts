// @ts-nocheck
export {};

const installKey = "__jwSimpleSessionTestsSummaryBridgeInstalled_v2";
const historyStorageKey = "jw-modbus-tool.simple.tests-execution-history.v1";
const summarySelector = "[data-tests-history-summary-bridge]";
let lastSignature = "";
let renderQueued = false;
let clearPausedUntil = 0;

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value ?? "");
  } catch {
    return fallback;
  }
}

function readHistory() {
  const parsed = safeJsonParse(window.localStorage?.getItem(historyStorageKey), []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeHistory(items) {
  const clean = Array.isArray(items) ? items : [];
  window.localStorage?.setItem(historyStorageKey, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent("jw-simple-tests-history-updated", { detail: clean }));
}

function clearHistory(reason = "manual") {
  clearPausedUntil = Date.now() + 1500;
  writeHistory([]);
  lastSignature = "";
  scheduleRender(true);
  window.__jwSimpleTestsHistoryDebug = buildDebugApi();
  console.debug?.(`[JW Tests History] historial limpiado (${reason}).`);
}

function fmtTime(value) {
  if (!value) return "Sin ejecucion";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin ejecucion";
  return date.toLocaleString("es-PE", { hour12: false });
}

function summarize(history) {
  const items = Array.isArray(history) ? history : [];
  const total = items.length;
  const ok = items.filter((item) => item.status === "OK").length;
  const timeout = items.filter((item) => item.status === "Timeout").length;
  const error = items.filter((item) => item.status && item.status !== "OK" && item.status !== "Timeout").length;
  const completed = items.filter((item) => typeof item.elapsedMs === "number" && Number.isFinite(item.elapsedMs));
  const avg = completed.length ? Math.round(completed.reduce((sum, item) => sum + item.elapsedMs, 0) / completed.length) : null;
  const last = items[0]?.completedAt || items[0]?.startedAt || null;
  return { total, ok, timeout, error, avg, last };
}

function makeSignature(summary) {
  return [summary.total, summary.ok, summary.timeout, summary.error, summary.avg ?? "", summary.last ?? ""].join("|");
}

function makeTile(summary) {
  const article = document.createElement("article");
  article.dataset.testsHistorySummaryBridge = "true";
  article.className = "testsHistoryTile";
  article.innerHTML = `
    <span class="testsHistoryTileIcon">🧪</span>
    <b>${summary.ok}/${summary.total}</b>
    <strong>Historial pruebas</strong>
    <small>${summary.total ? `${summary.error} error(es), ${summary.timeout} timeout(s)` : "Sin historial guardado"}</small>
  `;
  article.title = summary.total
    ? `Ultima ejecucion: ${fmtTime(summary.last)}${summary.avg == null ? "" : ` · Promedio ${summary.avg} ms`}`
    : "Ejecuta Pruebas y guarda la sesion para conservar evidencia.";
  return article;
}

function makeTimelineNote(summary) {
  const note = document.createElement("p");
  note.dataset.testsHistorySummaryBridge = "true";
  note.className = "note testsHistoryNote";
  note.textContent = summary.total
    ? `Pruebas: ${summary.ok}/${summary.total} solicitudes OK guardadas. Ultima: ${fmtTime(summary.last)}${summary.avg == null ? "." : ` · Promedio ${summary.avg} ms.`}`
    : "Pruebas: sin historial de ejecucion guardado todavia.";
  return note;
}

function renderSummary(force = false) {
  const sessions = document.querySelector(".sessions.grid");
  if (!sessions) return;

  const summary = summarize(readHistory());
  const signature = makeSignature(summary);
  const hasRendered = Boolean(document.querySelector(summarySelector));
  if (!force && hasRendered && signature === lastSignature) return;
  lastSignature = signature;

  document.querySelectorAll(summarySelector).forEach((node) => node.remove());

  const tiles = sessions.querySelector(".sumsession .tiles");
  if (tiles) tiles.appendChild(makeTile(summary));

  const timeline = sessions.querySelector(".timeline");
  if (timeline) timeline.appendChild(makeTimelineNote(summary));
}

function scheduleRender(force = false) {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    renderSummary(force);
  });
}

function buildDebugApi() {
  return {
    storageKey: historyStorageKey,
    get: readHistory,
    count: () => readHistory().length,
    summary: () => summarize(readHistory()),
    clear: () => clearHistory("debug-api"),
    lastSignature: () => lastSignature,
    pausedMs: () => Math.max(0, clearPausedUntil - Date.now())
  };
}

function buttonText(target) {
  const button = target?.closest?.("button");
  return button ? String(button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() : "";
}

function maybeClearFromButton(event) {
  const label = buttonText(event.target);
  if (!label) return;
  if (label.includes("nueva sesión") || label === "nuevo" || label.includes("limpiar registro")) {
    clearHistory(`button:${label}`);
    window.setTimeout(() => clearHistory(`button:${label}:late`), 250);
    window.setTimeout(() => scheduleRender(true), 800);
  }
}

function installStyles() {
  if (document.querySelector("style[data-tests-history-summary-bridge]")) return;
  const style = document.createElement("style");
  style.dataset.testsHistorySummaryBridge = "true";
  style.textContent = `
    .testsHistoryTile {
      border-color: #00bfff66 !important;
      background: #00bfff12 !important;
    }
    .testsHistoryTileIcon {
      display: inline-grid;
      width: 22px;
      height: 22px;
      place-items: center;
      border: 1px solid #00bfff55;
      border-radius: 999px;
      background: #00bfff18;
      font-size: 12px;
    }
    .testsHistoryNote {
      margin-top: 10px !important;
      border-color: #00bfff33 !important;
      background: #00bfff0d !important;
    }
  `;
  document.head.appendChild(style);
}

function install() {
  installStyles();
  window.__jwSimpleTestsHistoryDebug = buildDebugApi();
  scheduleRender(true);

  const observer = new MutationObserver(() => scheduleRender(false));
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("click", maybeClearFromButton, true);
  window.addEventListener("jw-simple-tests-history-updated", () => {
    window.__jwSimpleTestsHistoryDebug = buildDebugApi();
    scheduleRender(true);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === historyStorageKey) scheduleRender(true);
  });
}

if (!window[installKey]) {
  window[installKey] = true;
  install();
}
