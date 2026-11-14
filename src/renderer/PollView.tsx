// Vista Registros: varias ventanas de sondeo en paralelo, cada una con su
// slave, función, bloque, intervalo y formato de datos. Doble clic en un
// valor para escribirlo; casilla de gráfica para trazarlo; registro a CSV.
import { useEffect, useMemo, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { CircleDot, FileDown, Info, Pause, Play, Plus, RefreshCw, Square, Trash2 } from "lucide-react";
import {
  MIN_POLL_INTERVAL_MS,
  isBitFunction,
  pollEngine,
  pollFunctionLabels,
  pollRows,
  type PollFunction,
  type PollRow,
  type PollWindowState,
  type TrendPoint
} from "./pollEngine.js";
import { addressModeLabels, toDisplayAddress, toProtocolAddress, type AddressMode } from "./addressing.js";
import {
  byteOrderLabels,
  byteOrders,
  registerFormatLabels,
  registerFormatShortLabels,
  registerFormats,
  type ByteOrder,
  type RegisterFormat
} from "../shared/modbus/dataFormats.js";
import "./poll.css";

const SERIES_COLORS = ["#00c8ff", "#69d945", "#ffab25", "#a66cff", "#ff5252", "#ff6fb5", "#3ee0c5", "#f5e663"];
const CHART_SPANS = [
  { ms: 60_000, label: "1 min" },
  { ms: 300_000, label: "5 min" },
  { ms: 600_000, label: "10 min" }
];

export function PollView(props: {
  addressMode: AddressMode;
  connected: boolean;
  activeSlaveId: number | null;
  onMessage: (text: string) => void;
}) {
  const windows = useSyncExternalStore(pollEngine.subscribe, pollEngine.getSnapshot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = windows.find((window) => window.def.id === selectedId) ?? windows[0] ?? null;

  useEffect(() => {
    if (selected && selected.def.id !== selectedId) setSelectedId(selected.def.id);
  }, [selected, selectedId]);

  function addWindow() {
    const base = selected?.def;
    const created = pollEngine.add({
      unitId: props.activeSlaveId ?? base?.unitId ?? 1,
      fc: base?.fc ?? 3,
      intervalMs: base?.intervalMs ?? 1000,
      timeoutMs: base?.timeoutMs ?? 1000
    });
    setSelectedId(created.def.id);
  }

  const runningCount = windows.filter((window) => window.rt.running).length;

  return (
    <div className="poll grid">
      <header className="pollHeader">
        <h1>Lecturas <span>{windows.length} {windows.length === 1 ? "ventana" : "ventanas"} · {runningCount} sondeando</span></h1>
        <p><Info size={15} />Direcciones en {addressModeLabels[props.addressMode].toLowerCase()}. Doble clic en un valor para escribirlo.</p>
        <div className="pollHeaderActions">
          <button className="ghost" onClick={addWindow}><Plus size={15} />Nueva ventana</button>
          <button onClick={() => windows.forEach((window) => pollEngine.start(window.def.id))} disabled={!props.connected || windows.length === 0}><Play size={15} />Iniciar todas</button>
          <button onClick={() => pollEngine.stopAll()} disabled={runningCount === 0}><Square size={14} />Detener todas</button>
        </div>
      </header>

      <aside className="pollList">
        {windows.length === 0 ? (
          <div className="pollEmpty">
            <p>Aún no hay ventanas de lectura.</p>
            <button className="primary" onClick={addWindow}><Plus size={15} />Crear la primera</button>
          </div>
        ) : windows.map((window) => (
          <button key={window.def.id} className={`pollListItem ${window.def.id === selected?.def.id ? "active" : ""}`} onClick={() => setSelectedId(window.def.id)}>
            <span className={`pollDot ${statusTone(window)}`} />
            <span className="pollListText">
              <strong>{window.def.name}</strong>
              <small>ID {window.def.unitId} · FC0{window.def.fc} · {toDisplayAddress(props.addressMode, window.def.fc, window.def.start)} ×{window.def.quantity}</small>
            </span>
            {window.rt.running ? <RefreshCw size={14} className="spin" /> : null}
            {window.rt.logPath ? <CircleDot size={14} className="recording" /> : null}
          </button>
        ))}
      </aside>

      {selected ? <PollWindow key={selected.def.id} window={selected} {...props} /> : null}
    </div>
  );
}

function PollWindow({ window, addressMode, connected, onMessage }: { window: PollWindowState; addressMode: AddressMode; connected: boolean; onMessage: (text: string) => void }) {
  const { def, rt } = window;
  const rows = useMemo(() => pollRows(window, addressMode), [window, addressMode]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [forceMultiple, setForceMultiple] = useState(false);
  const [startText, setStartText] = useState(() => String(toDisplayAddress(addressMode, def.fc, def.start)));
  const [startError, setStartError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    setStartText(String(toDisplayAddress(addressMode, def.fc, def.start)));
    setStartError(null);
  }, [addressMode, def.fc, def.start]);

  const update = (patch: Parameters<typeof pollEngine.update>[1]) => pollEngine.update(def.id, patch);

  function commitStart(text: string) {
    try {
      update({ start: toProtocolAddress(addressMode, def.fc, Number(text)) });
      setStartError(null);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Dirección no válida");
    }
  }

  function beginEdit(row: PollRow) {
    if (!row.writable) {
      onMessage(row.continuation ? "Esta fila es parte del valor de la fila de arriba: edítalo ahí." : "Esta tabla es de solo lectura.");
      return;
    }
    setEditing(row.raw);
    setDraft(row.text === "—" ? "" : isBitFunction(def.fc) ? (row.text === "ON" ? "OFF" : "ON") : row.text);
  }

  async function commitEdit(row: PollRow) {
    setWriting(true);
    const result = await pollEngine.write(def.id, row.raw, draft, { forceMultiple });
    setWriting(false);
    onMessage(result.ok ? `${row.display}: ${result.message}.` : `${row.display}: ${result.message}`);
    if (result.ok) setEditing(null);
  }

  function onEditKey(event: KeyboardEvent<HTMLInputElement>, row: PollRow) {
    if (event.key === "Enter") void commitEdit(row);
    if (event.key === "Escape") setEditing(null);
  }

  async function toggleLog() {
    if (rt.logPath) {
      await pollEngine.stopLog(def.id);
      onMessage(`Registro detenido: ${rt.logRows} filas guardadas.`);
      return;
    }
    const result = await pollEngine.startLog(def.id);
    onMessage(result.message);
  }

  function toggleChart(raw: number) {
    update({ charted: def.charted.includes(raw) ? def.charted.filter((value) => value !== raw) : [...def.charted, raw] });
  }

  function setRowFormat(raw: number, format: RegisterFormat) {
    const rowFormats = { ...def.rowFormats };
    if (format === def.format) delete rowFormats[raw];
    else rowFormats[raw] = format;
    update({ rowFormats });
  }

  const bits = isBitFunction(def.fc);
  const success = rt.reads > 0 ? Math.round((rt.ok / rt.reads) * 100) : null;

  return (
    <section className="pollMain">
      <div className="pollConfig card">
        <label className="pf name"><span>Nombre</span><input value={def.name} onChange={(event) => update({ name: event.target.value })} /></label>
        <label className="pf"><span>Slave ID</span><input type="number" min={0} max={255} value={def.unitId} onChange={(event) => update({ unitId: Number(event.target.value) })} /></label>
        <label className="pf wide"><span>Función</span>
          <select value={def.fc} onChange={(event) => update({ fc: Number(event.target.value) as PollFunction, charted: [], rowFormats: {} })}>
            {([1, 2, 3, 4] as PollFunction[]).map((fc) => <option key={fc} value={fc}>{pollFunctionLabels[fc]}</option>)}
          </select>
        </label>
        <label className={`pf ${startError ? "invalid" : ""}`} title={startError ?? `Dirección de protocolo ${def.start} (0x${def.start.toString(16).toUpperCase().padStart(4, "0")})`}>
          <span>Dirección inicial</span>
          <input type="number" value={startText} onChange={(event) => setStartText(event.target.value)} onBlur={(event) => commitStart(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") commitStart((event.target as HTMLInputElement).value); }} />
        </label>
        <label className="pf"><span>Cantidad</span><input type="number" min={1} max={bits ? 2000 : 125} value={def.quantity} onChange={(event) => update({ quantity: Number(event.target.value) })} /></label>
        <label className="pf"><span>Intervalo (ms)</span><input type="number" min={MIN_POLL_INTERVAL_MS} step={100} value={def.intervalMs} onChange={(event) => update({ intervalMs: Number(event.target.value) })} /></label>
        <label className="pf"><span>Timeout (ms)</span><input type="number" min={50} step={50} value={def.timeoutMs} onChange={(event) => update({ timeoutMs: Number(event.target.value) })} /></label>
        <label className="pf wide"><span>Formato</span>
          <select value={def.format} disabled={bits} onChange={(event) => update({ format: event.target.value as RegisterFormat })}>
            {registerFormats.map((format) => <option key={format} value={format}>{registerFormatLabels[format]}</option>)}
          </select>
        </label>
        <label className="pf wide"><span>Orden de bytes</span>
          <select value={def.byteOrder} disabled={bits} onChange={(event) => update({ byteOrder: event.target.value as ByteOrder })}>
            {byteOrders.map((order) => <option key={order} value={order}>{byteOrderLabels[order]}</option>)}
          </select>
        </label>
        <div className="pollActions">
          <button onClick={() => void pollEngine.readOnce(def.id)} disabled={!connected || rt.reading}><RefreshCw size={15} />Leer una vez</button>
          {rt.running
            ? <button className="danger-btn" onClick={() => pollEngine.stop(def.id)}><Pause size={15} />Detener</button>
            : <button className="primary" onClick={() => pollEngine.start(def.id)} disabled={!connected}><Play size={15} />Sondear</button>}
          <button className={rt.logPath ? "recordingBtn" : ""} onClick={() => void toggleLog()}><FileDown size={15} />{rt.logPath ? "Detener CSV" : "Registrar CSV"}</button>
          <label className="inlineCheck" title={bits ? "Escribe con FC15 en vez de FC5" : "Escribe con FC16 aunque sea un solo registro"}>
            <input type="checkbox" checked={forceMultiple} onChange={(event) => setForceMultiple(event.target.checked)} />
            Escribir con {bits ? "FC15" : "FC16"}
          </label>
          <button className="ghost iconOnly" title="Eliminar ventana" onClick={() => pollEngine.remove(def.id)}><Trash2 size={15} /></button>
        </div>
      </div>

      <div className={`pollStatus ${statusTone(window)}`}>
        <span className={`pollDot ${statusTone(window)}`} />
        <strong>{rt.reading ? "Leyendo…" : rt.message}</strong>
        <span>Lecturas {rt.reads}</span>
        <span>OK {rt.ok}{success === null ? "" : ` (${success}%)`}</span>
        <span>Errores {rt.errors}</span>
        <span>Timeouts {rt.timeouts}</span>
        <span>{rt.elapsedMs === null ? "—" : `${rt.elapsedMs} ms`}</span>
        {rt.logPath ? <span className="recording" title={rt.logPath}><CircleDot size={13} />CSV · {rt.logRows} filas</span> : null}
      </div>

      <div className="pollTable card">
        <div className={`ptr phead ${bits ? "bits" : ""}`}>
          <span>Dirección</span><span>Alias</span>{bits ? null : <span>Formato</span>}<span>Valor</span><span>Hex</span><span title="Graficar">Gráf.</span>
        </div>
        <div className="pollRows">
          {rows.map((row) => (
            <div key={row.raw} className={`ptr ${bits ? "bits" : ""} ${row.continuation ? "cont" : ""}`}>
              <span className="paddr">{row.display}</span>
              <span><input className="alias" value={def.aliases[row.raw] ?? ""} placeholder="—" onChange={(event) => update({ aliases: withAlias(def.aliases, row.raw, event.target.value) })} /></span>
              {bits ? null : (
                <span>
                  {row.continuation ? <small>↳ parte de arriba</small> : (
                    <select className="rowFormat" value={row.format} onChange={(event) => setRowFormat(row.raw, event.target.value as RegisterFormat)}>
                      {registerFormats.map((format) => <option key={format} value={format}>{registerFormatShortLabels[format]}</option>)}
                    </select>
                  )}
                </span>
              )}
              <span className={`pval ${row.writable ? "writable" : ""}`} onDoubleClick={() => beginEdit(row)} title={row.writable ? "Doble clic para escribir" : undefined}>
                {editing === row.raw ? (
                  <input autoFocus className="pedit" value={draft} disabled={writing} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => onEditKey(event, row)} onBlur={() => { if (!writing) setEditing(null); }} />
                ) : bits && row.text !== "—" ? <span className={`bitChip ${row.text === "ON" ? "on" : "off"}`}>{row.text}</span> : row.text}
              </span>
              <span className="phex">{hexOf(row.rawValue)}</span>
              <span>{row.continuation ? null : <input type="checkbox" checked={def.charted.includes(row.raw)} onChange={() => toggleChart(row.raw)} />}</span>
            </div>
          ))}
        </div>
      </div>

      <PollChart window={window} addressMode={addressMode} />
    </section>
  );
}

function PollChart({ window, addressMode }: { window: PollWindowState; addressMode: AddressMode }) {
  const [span, setSpan] = useState(CHART_SPANS[0].ms);
  const history = pollEngine.history_(window.def.id);
  const now = window.rt.lastAt ? new Date(window.rt.lastAt).getTime() : Date.now();
  const series = window.def.charted
    .map((raw, index) => ({
      raw,
      label: window.def.aliases[raw] || String(toDisplayAddress(addressMode, window.def.fc, raw)),
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points: (history.get(raw) ?? []).filter((point) => now - point.at <= span)
    }));
  const all = series.flatMap((item) => item.points.map((point) => point.value));
  let min = all.length ? Math.min(...all) : 0;
  let max = all.length ? Math.max(...all) : 1;
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.08;
  min -= pad; max += pad;

  return (
    <div className="pollChart card">
      <header>
        <h2>Gráfica</h2>
        <div className="spanPicker">
          {CHART_SPANS.map((item) => <button key={item.ms} className={span === item.ms ? "active" : ""} onClick={() => setSpan(item.ms)}>{item.label}</button>)}
        </div>
      </header>
      {series.length === 0 ? <p className="note"><Info size={15} />Marca la casilla «Gráf.» de las filas que quieras ver aquí.</p> : (
        <>
          <div className="chartArea">
            <div className="yAxis"><span>{fmtNumber(max)}</span><span>{fmtNumber((max + min) / 2)}</span><span>{fmtNumber(min)}</span></div>
            <svg viewBox="0 0 1000 200" preserveAspectRatio="none">
              {[50, 100, 150].map((y) => <line key={y} x1={0} x2={1000} y1={y} y2={y} className="gridline" />)}
              {series.map((item) => item.points.length > 0 ? (
                <polyline key={item.raw} points={toPolyline(item.points, now, span, min, max)} style={{ stroke: item.color }} />
              ) : null)}
            </svg>
          </div>
          <div className="legend">
            {series.map((item) => {
              const values = item.points.map((point) => point.value);
              const last = values.at(-1);
              return (
                <span key={item.raw}>
                  <i style={{ background: item.color }} />
                  <strong>{item.label}</strong>
                  {last === undefined ? "—" : fmtNumber(last)}
                  {values.length > 1 ? <small>mín {fmtNumber(Math.min(...values))} · máx {fmtNumber(Math.max(...values))}</small> : null}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function toPolyline(points: TrendPoint[], now: number, span: number, min: number, max: number): string {
  return points
    .map((point) => {
      const x = 1000 - ((now - point.at) / span) * 1000;
      const y = 200 - ((point.value - min) / (max - min)) * 200;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function statusTone(window: PollWindowState): string {
  const status = window.rt.status;
  if (status === "ok") return "ok";
  if (status === "idle") return "idle";
  if (status === "exception") return "exception";
  return "bad";
}

function withAlias(aliases: Record<number, string>, raw: number, value: string): Record<number, string> {
  const next = { ...aliases };
  if (value) next[raw] = value;
  else delete next[raw];
  return next;
}

function hexOf(value: number | boolean | null): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

function fmtNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const abs = Math.abs(value);
  return value.toFixed(abs >= 100 ? 1 : abs >= 1 ? 2 : 4);
}
