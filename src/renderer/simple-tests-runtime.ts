// @ts-nocheck
export {};

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

const functionOrder = ["fc3", "fc6", "fc4", "fc1", "fc2", "fc5", "fc15", "fc16"];
const readFns = new Set(["fc1", "fc2", "fc3", "fc4"]);
const writeFns = new Set(["fc5", "fc6", "fc15", "fc16"]);

const defaultScenarios = {
  normal: { icon: "🛡", name: "Operación normal", desc: "Verifica lectura y escritura correcta.", color: "shield" },
  timeout: { icon: "⏱", name: "Timeout detectado", desc: "Simula dispositivos no disponibles.", color: "clock" },
  crc: { icon: "⚠", name: "Error CRC detectado", desc: "Reserva escenario para tramas CRC inválidas.", color: "warn" },
  exception: { icon: "✖", name: "Excepción Modbus", desc: "Fuerza códigos de excepción (01, 02, 03).", color: "bad" }
};

const st = {
  sc: "normal",
  sim: "Detenido",
  steps: [],
  log: [],
  running: false,
  stopped: false,
  manage: false,
  scenarios: JSON.parse(JSON.stringify(defaultScenarios))
};
st.steps = plan(1);

const api = () => window.jwModbus;
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
const active = () => document.querySelector(".sidebar nav button.active")?.textContent?.includes("Pruebas");
const ws = () => document.querySelector(".workspace");
const statusText = () => document.querySelector(".status")?.textContent || "";
const port = () => /COM\d+/i.exec(statusText())?.[0] || "COM3";
const baud = () => /\b(9600|19200|38400|57600|115200|230400)\b/.exec(statusText())?.[1] || "115200";

function sid() {
  const m = /Slave activo ID\s+(\d+)/i.exec(statusText());
  return m ? +m[1] : 1;
}

function mk(slave, fn, addr, amount, exp, to = 1000) {
  return { on: true, slave, fn, addr, amount: String(amount), exp, to, res: "Pendiente", ms: null, detail: "", values: "", at: "" };
}

function cloneStep(x) {
  return { ...x, res: "Pendiente", ms: null, detail: "", values: "", at: "" };
}

function plan(slave) {
  return [
    mk(slave, "fc3", 40000, 10, "10 regs"),
    mk(slave, "fc6", 40010, 1234, "OK"),
    mk(slave, "fc5", 0, "ON", "OK"),
    mk(slave, "fc15", 0, "1,0,1,0", "OK"),
    mk(slave, "fc16", 40020, "10,20,30", "OK"),
    mk(slave, "fc4", 30000, 8, "8 regs"),
    mk(slave, "fc1", 0, 8, "8 coils"),
    mk(slave, "fc2", 0, 8, "8 bits", 1500)
  ];
}

function raw(fn, a) {
  if (["fc3", "fc6", "fc16"].includes(fn)) return a >= 40000 ? a - 40000 : a;
  if (fn === "fc4") return a >= 30000 ? a - 30000 : a;
  if (fn === "fc2") return a >= 10000 ? a - 10000 : a;
  return a;
}

function def(fn) {
  if (["fc3", "fc6", "fc16"].includes(fn)) return 40000;
  if (fn === "fc4") return 30000;
  if (fn === "fc2") return 10000;
  return 0;
}

function defaultAmount(fn) {
  if (fn === "fc5") return "ON";
  if (fn === "fc15") return "1,0,1,0";
  if (fn === "fc16") return "100,200,300";
  if (fn === "fc6") return "1234";
  if (fn === "fc1" || fn === "fc2") return "8";
  return "1";
}

function defaultExpected(fn, amount = defaultAmount(fn)) {
  if (writeFns.has(fn)) return "OK";
  if (fn === "fc1") return `${amount} coils`;
  if (fn === "fc2") return `${amount} bits`;
  return `${amount} regs`;
}

function short(fn) {
  return F[fn]
    .replace("Registers", "Regs")
    .replace("Register", "Reg")
    .replace("Discrete Inputs", "Discrete")
    .replace("Holding", "Hold.")
    .replace("Multiple", "Multi.")
    .replace("Single", "Single");
}

function valueHint(fn) {
  if (fn === "fc5") return "ON/OFF";
  if (fn === "fc15") return "Bits: 1,0,1,0";
  if (fn === "fc16") return "Valores: 100,200,300";
  if (fn === "fc6") return "Valor";
  return "Cantidad";
}

function normalizeBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return ["1", "true", "on", "sí", "si", "high"].includes(s);
}

function parseBoolList(v) {
  return String(v ?? "")
    .split(/[;,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(normalizeBool);
}

function parseRegList(v) {
  return String(v ?? "")
    .split(/[;,\s]+/)
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
}

function amountNumber(x) {
  const n = Number(x.amount);
  return Number.isFinite(n) ? n : 1;
}

function res(r) {
  const c = r === "Aprobado" ? "resultOK" : r === "Pendiente" ? "" : r === "Timeout" ? "resultWarn" : "resultBad";
  const icon = r === "Aprobado" ? "✓" : r === "Pendiente" ? "—" : r === "Timeout" ? "!" : "×";
  return `<span class="${c} resultPill">${icon} ${r}</span>`;
}

function msg(t) {
  const p = document.querySelector(".helper p");
  if (p) p.textContent = t;
}

function style() {
  if (document.getElementById("simple-tests-runtime-style")) return;
  const e = document.createElement("style");
  e.id = "simple-tests-runtime-style";
  e.textContent = `
.testsRuntime{height:100%;min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr)318px;grid-template-rows:minmax(0,1.16fr)142px minmax(0,.84fr);gap:14px}
.testsRuntime .card{min-height:0;overflow:hidden}.testsRuntime .plan{grid-column:1;grid-row:1;display:flex;flex-direction:column}.testsRuntime .scenarios{grid-column:2;grid-row:1;display:flex;flex-direction:column;gap:10px}.testsRuntime .sim{grid-column:2;grid-row:2/4;display:flex;flex-direction:column;gap:10px}.testsRuntime .testkpis{grid-column:1;grid-row:2;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.testsRuntime .exec{grid-column:1;grid-row:3;display:flex;flex-direction:column}
.testsRuntime .planHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex:0 0 auto;margin-bottom:8px}.testsRuntime .planTitle{display:grid;gap:8px}.testsRuntime .planTitle p{margin:0;color:var(--muted)}.testsRuntime .planActions{display:flex;gap:9px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.testsRuntime .planActions button{min-height:34px}.testsRuntime .planBody,.testsRuntime .execBody{min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#2d87aa #071d30}.testsRuntime table{width:100%;border-collapse:collapse;font-size:.86rem}.testsRuntime th,.testsRuntime td{border-bottom:1px solid #4588a640;padding:6px 8px;text-align:left;vertical-align:middle}.testsRuntime th{color:var(--muted);font-weight:600;background:#ffffff0a;position:sticky;top:0;z-index:1}.testsRuntime input,.testsRuntime select,.testsRuntime textarea{width:100%;min-height:30px;border:1px solid #2d5c75;border-radius:6px;background:#061a2b;color:var(--text);padding:4px 7px}.testsRuntime textarea{min-height:58px;resize:vertical;font-family:inherit}.testsRuntime input[type=checkbox]{width:18px;min-height:18px;accent-color:#5ce044}.testsRuntime .slaveInput{-moz-appearance:textfield}.testsRuntime .slaveInput::-webkit-inner-spin-button,.testsRuntime .slaveInput::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.testsRuntime .scenarioList{display:flex;flex:1 1 auto;min-height:0;overflow:auto;flex-direction:column;gap:10px;padding-right:4px;scrollbar-width:thin;scrollbar-color:#2d87aa #071d30}.testsRuntime .scenarioCard{display:grid;grid-template-columns:46px 1fr 30px;gap:11px;align-items:center;min-height:72px;padding:11px;border:1px solid #2d5c75;border-radius:11px;background:linear-gradient(180deg,#ffffff0d,#ffffff05);color:var(--text);text-align:left;box-shadow:inset 0 0 0 1px #ffffff08;flex:0 0 auto}.testsRuntime .scenarioCard.selected{border-color:var(--cyan);background:linear-gradient(180deg,#00bfff24,#00bfff0b);box-shadow:0 0 16px #00bfff1d,inset 0 0 0 1px #00bfff33}.testsRuntime .scenarioIcon{display:grid;place-items:center;width:42px;height:42px;border-radius:10px;font-size:1.35rem}.testsRuntime .scenarioIcon.shield{background:#1f6e3b88}.testsRuntime .scenarioIcon.clock{background:#9a5d1288}.testsRuntime .scenarioIcon.warn{background:#9a5d1288}.testsRuntime .scenarioIcon.bad{background:#9b313d88}.testsRuntime .scenarioCard strong,.testsRuntime .scenarioCard small{display:block}.testsRuntime .scenarioCard small{color:var(--muted);margin-top:4px;line-height:1.25}.testsRuntime .scenarioRadio{display:grid;place-items:center;width:26px;height:26px;border:2px solid #45677a;border-radius:50%;font-style:normal;color:transparent}.testsRuntime .scenarioCard.selected .scenarioRadio{border-color:var(--cyan);color:white;background:radial-gradient(circle at center,#dff7ff 0 36%,transparent 40%)}.testsRuntime .manageScenarios{flex:0 0 auto;margin-top:2px}
.testsRuntime .scenarioManager{min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px;padding-right:4px;scrollbar-width:thin;scrollbar-color:#2d87aa #071d30}.testsRuntime .scenarioManager label{display:grid;gap:5px;color:var(--muted);font-size:.82rem}.testsRuntime .managerRow{display:grid;grid-template-columns:.75fr 1fr;gap:9px}.testsRuntime .scenarioPreview{display:grid;grid-template-columns:42px 1fr;gap:10px;align-items:center;border:1px solid #2d5c75;border-radius:10px;background:#ffffff09;padding:10px}.testsRuntime .scenarioSteps{border:1px solid #2d5c75;border-radius:10px;background:#ffffff08;padding:10px}.testsRuntime .scenarioSteps h3{margin:0 0 8px;color:var(--cyan);font-size:.92rem}.testsRuntime .scenarioSteps ol{margin:0;padding-left:18px;color:var(--muted);display:grid;gap:4px}.testsRuntime .managerActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.testsRuntime .managerNote{border:1px solid #00bfff33;border-radius:8px;background:#00bfff0d;color:var(--muted);padding:8px 10px;line-height:1.35}
.testsRuntime .testkpis article{border:1px solid #2d5c75;border-radius:11px;background:linear-gradient(180deg,#ffffff0d,#ffffff05);padding:10px 18px;display:grid;grid-template-columns:112px minmax(0,1fr);align-items:center;justify-items:center;column-gap:16px;min-width:0}.testsRuntime .testkpis article.plain{grid-template-columns:1fr;justify-items:start;align-content:center}.testsRuntime .kpiRing{--p:0;display:grid;place-items:center;width:92px;height:92px;border-radius:50%;background:conic-gradient(var(--ring,#00bfff) calc(var(--p)*1%),#102d42 0);position:relative;margin:auto}.testsRuntime .kpiRing::after{content:"";position:absolute;inset:13px;border-radius:50%;background:#071d30;box-shadow:inset 0 0 12px #0008}.testsRuntime .kpiStack{position:relative;z-index:1;display:grid;place-items:center;gap:2px;text-align:center;line-height:1}.testsRuntime .kpiStack strong{font-size:1.42rem;color:var(--text);line-height:1}.testsRuntime .kpiStack small{color:var(--muted);font-size:.66rem;line-height:1}.testsRuntime .kpiText{justify-self:start;display:grid;gap:5px}.testsRuntime .kpiText span{color:var(--muted);font-weight:700}.testsRuntime .kpiText b{display:block;font-size:1.85rem;color:var(--cyan);line-height:1}.testsRuntime .kpiText.danger b{color:#ff5353}.testsRuntime .kpiText small{color:var(--muted);line-height:1.2}
.testsRuntime .resultOK{color:var(--green);font-weight:700}.testsRuntime .resultBad{color:#ff5353;font-weight:700}.testsRuntime .resultWarn{color:#ffad24;font-weight:700}.testsRuntime .resultPill{white-space:nowrap}.testsRuntime .topActions{display:flex;gap:10px;align-items:center;justify-content:flex-end}.testsRuntime .iconOnly{min-height:28px;padding:0 8px}.testsRuntime .purple{background:linear-gradient(180deg,#8b36e7,#671cbe);border-color:#9d5cff;color:white}.testsRuntime .noteLine{margin-top:8px;padding:8px 10px;border:1px solid #00bfff33;border-radius:8px;color:var(--muted);background:#00bfff0d;flex:0 0 auto}.testsRuntime .simGrid{display:grid;gap:9px}.testsRuntime .simGrid label{display:grid;grid-template-columns:1fr 1.2fr;gap:8px;align-items:center;color:var(--muted)}.testsRuntime .fnWrite{border-left:3px solid #b96cff}.testsRuntime .fnRead{border-left:3px solid #00bfff}
`;
  document.head.appendChild(e);
}

function render() {
  if (!active()) return;
  const h = ws();
  if (!h) return;
  style();
  const done = st.steps.filter((x) => x.res !== "Pendiente").length;
  const ok = st.steps.filter((x) => x.res === "Aprobado").length;
  const bad = st.steps.filter((x) => !["Pendiente", "Aprobado"].includes(x.res)).length;
  const pct = done ? Math.round((ok / done) * 100) : 0;
  const avg = av();
  h.innerHTML = `<div class="testsRuntime">
<section class="card plan"><div class="planHeader"><div class="planTitle"><h2>Plan de pruebas al slave</h2><p>PC como Master</p></div><div class="planActions"><button class="primary" data-a="run">▶ Iniciar prueba</button><button data-a="stop">■ Detener</button><button>•••</button><button data-a="add">+ Agregar paso</button><button data-a="save">💾 Guardar plan</button></div></div><div class="planBody">${planTable()}</div><p class="noteLine">ⓘ Lecturas: FC01/02/03/04. Escrituras: FC05/06/15/16. Para FC15 usa bits 1,0,1,0; para FC16 usa valores 100,200,300.</p></section>
<section class="card scenarios"><header><h2>${st.manage ? "Gestionar escenarios" : "Escenarios"}</h2></header>${st.manage ? managerHtml() : `<div class="scenarioList">${scHtml()}</div><button class="ghost manageScenarios" data-a="manage">Gestionar escenarios ›</button>`}</section>
<section class="card sim"><header><h2>Simulador slave <small>(PC como slave)</small></h2></header>${simHtml()}</section>
<div class="testkpis">${kpiHtml(pct, ok, bad, done, avg)}</div>
<section class="card exec"><header><h2>Registro de ejecución</h2><div class="topActions"><button data-a="clear">🗑 Limpiar registro</button><button data-a="export">⇩ Exportar</button></div></header><div class="execBody">${execTable()}</div></section>
</div>`;
}

function planTable() {
  return `<table><thead><tr><th>Activo</th><th>Paso</th><th>Slave</th><th>Función</th><th>Dirección</th><th>Cantidad/Valor</th><th>Esperado</th><th>Timeout</th><th>Resultado</th><th></th></tr></thead><tbody>${st.steps
    .map((x, i) => `<tr class="${writeFns.has(x.fn) ? "fnWrite" : "fnRead"}"><td><input type="checkbox" data-c="on" data-i="${i}" ${x.on ? "checked" : ""}></td><td>${i + 1}</td><td><input class="slaveInput" inputmode="numeric" pattern="[0-9]*" data-c="slave" data-i="${i}" value="${x.slave}"></td><td><select data-c="fn" data-i="${i}">${functionOrder.map((f) => `<option value="${f}" ${x.fn === f ? "selected" : ""}>${short(f)}</option>`).join("")}</select></td><td><input type="number" data-c="addr" data-i="${i}" value="${x.addr}"></td><td><input data-c="amount" data-i="${i}" placeholder="${valueHint(x.fn)}" value="${esc(x.amount)}"></td><td><input data-c="exp" data-i="${i}" value="${esc(x.exp)}"></td><td><input type="number" data-c="to" data-i="${i}" value="${x.to}"></td><td>${res(x.res)}</td><td><button class="iconOnly" data-a="del" data-i="${i}">🗑</button></td></tr>`)
    .join("")}</tbody></table>`;
}

function execTable() {
  const r = st.log.length ? st.log : st.steps;
  return `<table><thead><tr><th>Hora</th><th>Paso</th><th>Slave</th><th>Función</th><th>Dirección</th><th>Cantidad/Valor</th><th>Resultado</th><th>Tiempo</th><th>Detalle</th></tr></thead><tbody>${r
    .map((x, i) => `<tr><td>${x.at || "—"}</td><td>${i + 1}</td><td>${x.slave}</td><td>${F[x.fn]}</td><td>${x.addr}</td><td>${esc(x.amount)}</td><td>${res(x.res)}</td><td>${x.ms != null ? x.ms + " ms" : "—"}</td><td>${esc(x.detail || x.values || "Pendiente de ejecución.")}</td></tr>`)
    .join("")}</tbody></table>`;
}

function scHtml() {
  return Object.keys(st.scenarios)
    .map((k) => {
      const s = st.scenarios[k];
      return `<button class="scenarioCard ${st.sc === k ? "selected" : ""}" data-a="sc" data-sc="${k}"><b class="scenarioIcon ${s.color}">${esc(s.icon)}</b><span><strong>${esc(s.name)}</strong><small>${esc(s.desc)}</small></span><i class="scenarioRadio">●</i></button>`;
    })
    .join("");
}

function managerHtml() {
  const keys = Object.keys(st.scenarios);
  const s = st.scenarios[st.sc] || st.scenarios.normal;
  const previewSteps = (s.steps || st.steps).slice(0, 6);
  return `<div class="scenarioManager">
<label>Escenario activo<select data-sel="scenario">${keys.map((k) => `<option value="${k}" ${k === st.sc ? "selected" : ""}>${esc(st.scenarios[k].name)}</option>`).join("")}</select></label>
<div class="scenarioPreview"><b class="scenarioIcon ${s.color}">${esc(s.icon)}</b><span><strong>${esc(s.name)}</strong><small>${esc(s.desc)}</small></span></div>
<label>Nombre<input data-sf="name" value="${esc(s.name)}"></label>
<label>Descripción<textarea data-sf="desc">${esc(s.desc)}</textarea></label>
<div class="managerRow"><label>Ícono<input data-sf="icon" value="${esc(s.icon)}" maxlength="2"></label><label>Color<select data-sf="color"><option value="shield" ${s.color === "shield" ? "selected" : ""}>Verde</option><option value="clock" ${s.color === "clock" ? "selected" : ""}>Naranja</option><option value="warn" ${s.color === "warn" ? "selected" : ""}>Amarillo</option><option value="bad" ${s.color === "bad" ? "selected" : ""}>Rojo</option></select></label></div>
<section class="scenarioSteps"><h3>Pasos del escenario</h3><ol>${previewSteps.map((x) => `<li>${F[x.fn]} · S${x.slave} · ${x.addr} · ${esc(x.amount)}</li>`).join("")}</ol></section>
<button data-a="scenarioUsePlan">Usar plan actual como pasos</button>
<div class="managerActions"><button data-a="scenarioDuplicate">Duplicar</button><button class="primary" data-a="scenarioClose">Guardar cambios</button></div>
<p class="managerNote">Los cambios quedan activos en esta sesión. Luego se persistirán dentro de <b>.jwmodbus-session</b> junto con los planes personalizados.</p>
</div>`;
}

function kpiHtml(pct, ok, bad, done, avg) {
  const stepPct = st.steps.length ? Math.round((done / st.steps.length) * 100) : 0;
  return `<article><div class="kpiRing" style="--p:${pct};--ring:var(--green)"><span class="kpiStack"><strong>${pct}%</strong><small>Éxito</small></span></div><div class="kpiText"><span>Tasa de éxito</span><small>Última ejecución: ${ok}/${done || st.steps.length} aprobados</small></div></article>
<article class="plain"><div class="kpiText"><span>Latencia promedio</span><b>${avg ? avg + " ms" : "—"}</b><small>${st.log.length ? `Última ejecución: ${st.log.length} paso(s)` : "Sin datos todavía"}</small></div></article>
<article class="plain"><div class="kpiText danger"><span>Errores</span><b>${bad}</b><small>Última ejecución</small></div></article>
<article><div class="kpiRing" style="--p:${stepPct};--ring:var(--cyan)"><span class="kpiStack"><strong>${done}/${st.steps.length}</strong><small>Pasos</small></span></div><div class="kpiText"><span>Pasos completados</span><small>Última ejecución</small></div></article>`;
}

function simHtml() {
  return `<div class="simGrid"><label><span>Estado</span><input readonly value="${st.sim}"></label><label><span>Dirección slave</span><input value="1"></label><label><span>Puerto</span><input readonly value="${esc(port())}"></label><label><span>Baud Rate</span><input readonly value="${esc(baud())}"></label><button class="purple" data-a="sim">▶ ${st.sim === "Detenido" ? "Preparar simulador slave" : "Detener simulador slave"}</button><button>⚙</button></div>`;
}

async function run() {
  const b = api();
  if (!b?.modbus) return msg("Backend Modbus no disponible.");
  st.log = [];
  st.running = true;
  st.stopped = false;
  render();
  for (let i = 0; i < st.steps.length; i++) {
    if (st.stopped) break;
    const x = st.steps[i];
    if (!x.on) continue;
    const t = performance.now();
    const at = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
    try {
      const r = await exec(x, b);
      const ms = Math.round(performance.now() - t);
      if (!r.ok) {
        x.res = String(r.error || "").toLowerCase().includes("timeout") ? "Timeout" : "Error";
        x.detail = r.error || "Error de comunicación.";
        x.ms = ms;
        x.at = at;
      } else {
        const v = r.value || {};
        const vals = v.registerValues || v.values || writeEchoValues(x);
        x.res = v.exception ? "Excepción" : v.crcOk === false ? "CRC Error" : "Aprobado";
        x.ms = v.elapsedMs ?? ms;
        x.values = summarizeValues(x, vals);
        x.detail = v.exception?.exceptionName || successDetail(x, vals);
        x.at = at;
      }
    } catch (e) {
      x.res = "Error";
      x.ms = Math.round(performance.now() - t);
      x.detail = e?.message || "Error inesperado.";
      x.at = at;
    }
    st.log = st.steps.filter((z) => z.at);
    render();
  }
  st.running = false;
  msg(st.stopped ? "Prueba detenida por el usuario." : "Plan de pruebas ejecutado. Revisa resultados, tiempos y detalles.");
}

function exec(x, b) {
  if (x.fn === "fc5") return b.modbus.writeSingleCoil({ unitId: x.slave, address: raw(x.fn, x.addr), value: normalizeBool(x.amount), timeoutMs: x.to });
  if (x.fn === "fc6") return b.modbus.writeSingleRegister({ unitId: x.slave, address: raw(x.fn, x.addr), value: Number(x.amount), timeoutMs: x.to });
  if (x.fn === "fc15") return b.modbus.writeMultipleCoils({ unitId: x.slave, startAddress: raw(x.fn, x.addr), values: parseBoolList(x.amount), timeoutMs: x.to });
  if (x.fn === "fc16") return b.modbus.writeMultipleRegisters({ unitId: x.slave, startAddress: raw(x.fn, x.addr), values: parseRegList(x.amount), timeoutMs: x.to });
  const c = { unitId: x.slave, startAddress: raw(x.fn, x.addr), quantity: amountNumber(x), timeoutMs: x.to };
  if (x.fn === "fc1") return b.modbus.readCoils(c);
  if (x.fn === "fc2") return b.modbus.readDiscreteInputs(c);
  if (x.fn === "fc4") return b.modbus.readInputRegisters(c);
  return b.modbus.readHoldingRegisters(c);
}

function writeEchoValues(x) {
  if (x.fn === "fc5") return [normalizeBool(x.amount)];
  if (x.fn === "fc6") return [Number(x.amount)];
  if (x.fn === "fc15") return parseBoolList(x.amount);
  if (x.fn === "fc16") return parseRegList(x.amount);
  return [];
}

function summarizeValues(x, vals) {
  if (!vals?.length) return "";
  return vals.slice(0, 4).map((y, j) => `${disp(x.fn, raw(x.fn, x.addr) + j, x.addr)}=${typeof y === "boolean" ? (y ? "ON" : "OFF") : y}`).join(", ") + (vals.length > 4 ? ", ..." : "");
}

function successDetail(x, vals) {
  if (x.fn === "fc5") return `Coil escrita en ${normalizeBool(x.amount) ? "ON" : "OFF"}.`;
  if (x.fn === "fc6") return `Registro escrito con valor ${Number(x.amount)}.`;
  if (x.fn === "fc15") return `${parseBoolList(x.amount).length} coils escritas: ${summarizeValues(x, vals)}.`;
  if (x.fn === "fc16") return `${parseRegList(x.amount).length} registros escritos: ${summarizeValues(x, vals)}.`;
  return `${amountNumber(x)} ${x.fn === "fc1" ? "coils" : x.fn === "fc2" ? "bits" : "registros"} leídos correctamente.`;
}

function applySc(k) {
  st.sc = k;
  const custom = st.scenarios[k]?.steps;
  if (custom?.length) {
    st.steps = custom.map(cloneStep);
  } else {
    const s = sid();
    if (k === "normal") st.steps = plan(s);
    if (k === "timeout") st.steps = [mk(247, "fc3", 40000, 1, "Timeout", 350)];
    if (k === "exception") st.steps = [mk(s, "fc3", 49999, 10, "Excepción", 1000)];
    if (k === "crc") st.steps = plan(s).map((x) => ({ ...x, exp: x.exp === "OK" ? "CRC/Error controlado" : x.exp }));
  }
  st.log = [];
  render();
}

function av() {
  const r = st.log.filter((x) => x.ms != null);
  return r.length ? Math.round(r.reduce((a, x) => a + x.ms, 0) / r.length) : 0;
}

function disp(fn, r, b) {
  if (fn === "fc2") return 10000 + r;
  if (fn === "fc4") return (b >= 30000 ? 30000 : 0) + r;
  if (["fc3", "fc6", "fc16"].includes(fn)) return (b >= 40000 ? 40000 : 0) + r;
  return r;
}

function tick() {
  if (active() && !ws()?.querySelector(".testsRuntime")) render();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest?.("[data-a]");
  if (!a || !active()) return;
  const n = a.dataset.a;
  if (n === "run") run();
  if (n === "stop") { st.stopped = true; msg("Deteniendo prueba al finalizar el paso actual..."); }
  if (n === "add") { st.steps.push(mk(sid(), "fc3", 40000, 1, "1 reg", 1000)); render(); }
  if (n === "del") { st.steps.splice(+a.dataset.i, 1); render(); }
  if (n === "clear") { st.log = []; st.steps = st.steps.map((x) => ({ ...x, res: "Pendiente", ms: null, detail: "", values: "", at: "" })); render(); }
  if (n === "export") { navigator.clipboard?.writeText(st.log.map((x, i) => `${i + 1}. ${x.at} ${F[x.fn]} S${x.slave} ${x.res} ${x.detail}`).join("\n")); msg("Registro copiado al portapapeles."); }
  if (n === "save") msg("Plan guardado en memoria de la vista. Usa Guardar sesión para persistirlo en archivo.");
  if (n === "sc") applySc(a.dataset.sc);
  if (n === "manage") { st.manage = true; render(); }
  if (n === "scenarioClose") { st.manage = false; msg("Escenario actualizado en memoria de la sesión."); render(); }
  if (n === "scenarioUsePlan") { st.scenarios[st.sc].steps = st.steps.map(cloneStep); msg("Plan actual asignado al escenario seleccionado."); render(); }
  if (n === "scenarioDuplicate") {
    const base = st.scenarios[st.sc];
    const id = `custom_${Date.now()}`;
    st.scenarios[id] = { ...JSON.parse(JSON.stringify(base)), name: `${base.name} copia`, steps: (base.steps || st.steps).map(cloneStep) };
    st.sc = id;
    msg("Escenario duplicado. Edita su nombre, color, ícono y pasos.");
    render();
  }
  if (n === "sim") { st.sim = st.sim === "Detenido" ? "Preparado" : "Detenido"; msg("Simulador slave preparado a nivel UI; emulación real queda para la siguiente etapa."); render(); }
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset?.sel === "scenario") { st.sc = t.value; render(); return; }
  if (t.dataset?.sf) { st.scenarios[st.sc][t.dataset.sf] = t.value; render(); return; }
  const c = t.dataset?.c;
  const i = +t.dataset?.i;
  if (!c || !st.steps[i]) return;
  const x = st.steps[i];
  const v = t.type === "checkbox" ? t.checked : t.value;
  if (c === "on") x.on = !!v;
  if (c === "slave") x.slave = Math.max(1, Math.min(247, Number.parseInt(String(v).replace(/\D/g, ""), 10) || 1));
  if (c === "fn") {
    x.fn = v;
    x.addr = def(v);
    x.amount = defaultAmount(v);
    x.exp = defaultExpected(v, x.amount);
  }
  if (c === "addr") x.addr = +v;
  if (c === "amount") { x.amount = String(v); if (readFns.has(x.fn)) x.exp = defaultExpected(x.fn, x.amount); }
  if (c === "exp") x.exp = v;
  if (c === "to") x.to = +v;
  x.res = "Pendiente";
  render();
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (!active() || !t.dataset?.sf) return;
  st.scenarios[st.sc][t.dataset.sf] = t.value;
});

setInterval(tick, 350);
new MutationObserver(tick).observe(document.body, { childList: true, subtree: true });
