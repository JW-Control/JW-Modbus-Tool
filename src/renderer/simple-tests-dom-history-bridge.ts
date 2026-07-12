// @ts-nocheck
export {};

const installKey = "__jwSimpleTestsDomHistoryBridgeInstalled";
const storageKey = "jw-modbus-tool.simple.tests-execution-history.v1";
const seenKey = "__jwSimpleTestsDomHistorySeenKeys";
const maxItems = 200;

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
  const set = new Set(readHistory().map((item) => item.key).filter(Boolean));
  window[seenKey] = set;
  return set;
}

function captureVisibleTestsLog() {
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

function install() {
  captureVisibleTestsLog();
  const observer = new MutationObserver(() => captureVisibleTestsLog());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("jw-simple-tests-history-updated", () => hydrateSeenKeys());
}

if (!window[installKey]) {
  window[installKey] = true;
  if (document.body) install();
  else window.addEventListener("DOMContentLoaded", install, { once: true });
}
