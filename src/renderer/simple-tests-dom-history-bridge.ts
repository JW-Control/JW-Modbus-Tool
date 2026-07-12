// @ts-nocheck
export {};

const installKey = "__jwSimpleTestsDomHistoryBridgeInstalled_v3";
const storageKey = "jw-modbus-tool.simple.tests-execution-history.v1";
const seenKey = "__jwSimpleTestsDomHistorySeenKeys_v3";
const patchedSessionsKey = "__jwSimpleTestsDomHistorySessionsPatched_v3";
const maxItems = 200;
let capturePausedUntil = 0;

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
  capturePausedUntil = Date.now() + 1200;
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

function buildItem(row) {
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

  if (!hour || hour === "-" || status === "Pendiente") return null;

  const fnCode = functionCode(fnLabel);
  const key = [hour, step, slaveText, fnCode, address, amount, status].join("|");
  const today = new Date().toISOString().slice(0, 10);
  const completedAt = new Date(`${today}T${hour.length === 5 ? `${hour}:00` : hour}`).toISOString();

  return {
    key,
    item: {
      id: `test-dom-${Date.now()}-${Math.round(Math.random() * 100000)}`,
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

function captureVisibleTestsLog() {
  if (Date.now() < capturePausedUntil) return;
  const tests = document.querySelector(".testsNative");
  if (!tests) return;

  const rows = Array.from(tests.querySelectorAll(".testsLogCard tbody tr"));
  if (!rows.length) return;

  const seen = hydrateSeenKeys();
  const current = readHistory();
  const additions = [];

  for (const row of rows) {
    const parsed = buildItem(row);
    if (!parsed || seen.has(parsed.key)) continue;
    seen.add(parsed.key);
    additions.push({ ...parsed.item, key: parsed.key });
  }

  if (additions.length) writeHistory([...additions.reverse(), ...current]);
}

function patchSessionsApi() {
  const sessions = window.jwModbus?.sessions;
  if (!sessions || sessions[patchedSessionsKey]) return Boolean(sessions?.[patchedSessionsKey]);

  if (typeof sessions.saveFile === "function") {
    const originalSave = sessions.saveFile.bind(sessions);
    sessions.saveFile = async (payload) => {
      captureVisibleTestsLog();
      const history = readHistory();
      const nextPayload = payload && typeof payload === "object"
        ? {
            ...payload,
            data: payload.data && typeof payload.data === "object"
              ? {
                  ...payload.data,
                  testsExecutionHistory: history,
                  testsExecutionHistoryUpdatedAt: new Date().toISOString()
                }
              : payload.data
          }
        : payload;
      return originalSave(nextPayload);
    };
  }

  if (typeof sessions.openFile === "function") {
    const originalOpen = sessions.openFile.bind(sessions);
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

function maybeClearFromButton(event) {
  const button = event.target?.closest?.("button");
  if (!button) return;
  const label = text(button).toLowerCase();
  if (label.includes("limpiar registro") || label.includes("nueva sesión") || label === "nuevo") {
    clearHistory();
  }
}

function install() {
  captureVisibleTestsLog();
  patchSessionsApi();
  const observer = new MutationObserver(() => {
    captureVisibleTestsLog();
    patchSessionsApi();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener("click", maybeClearFromButton, true);
  window.setInterval(() => {
    captureVisibleTestsLog();
    patchSessionsApi();
  }, 1000);
}

if (!window[installKey]) {
  window[installKey] = true;
  if (document.body) install();
  else window.addEventListener("DOMContentLoaded", install, { once: true });
}
