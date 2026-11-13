// Vista Funciones: identificación del equipo (FC43/14 y FC17), escritura con
// máscara (FC22), lectura y escritura en una sola petición (FC23) y envío de
// una trama escrita a mano en hexadecimal. Funciona igual en RTU, ASCII y TCP.
import { useState, type ReactNode } from "react";
import { Fingerprint, Info, Send, SlidersHorizontal, Terminal } from "lucide-react";
import type { RtuMasterActionResult } from "../shared/modbus/masterActionTypes.js";
import type { ModbusRequest } from "../shared/modbus/pdu.js";
import type { Framing } from "../shared/modbus/adu.js";
import type { SerialOperationResult } from "../shared/serial/types.js";
import { toDisplayAddress, toProtocolAddress, type AddressMode } from "./addressing.js";

type Outcome = { ok: true; action: RtuMasterActionResult } | { ok: false; error: string };

export interface FunctionsViewProps {
  addressMode: AddressMode;
  connected: boolean;
  framing: Framing;
  defaultUnitId: number;
  timeoutMs: number;
  /** Lets the app count the request in traffic and statistics. */
  onResult: (label: string, unitId: number, result: SerialOperationResult<RtuMasterActionResult>, at: Date) => void;
  onMessage: (text: string) => void;
}

const checkLabels: Record<Framing, string> = {
  rtu: "Agregar CRC",
  ascii: "Agregar «:», LRC y CRLF",
  tcp: "Agregar cabecera MBAP"
};

const RAW_EXAMPLE = "01 03 00 00 00 0A";

export function FunctionsView(props: FunctionsViewProps) {
  const [unitId, setUnitId] = useState(props.defaultUnitId);

  async function run(label: string, request: ModbusRequest): Promise<Outcome> {
    const bridge = window.jwModbus;
    if (!bridge) return { ok: false, error: "Abre la app de escritorio para enviar peticiones." };
    if (!props.connected) return { ok: false, error: "Conecta primero (serie o TCP)." };
    const at = new Date();
    const result = await bridge.modbus.execute({ unitId, request, timeoutMs: props.timeoutMs });
    props.onResult(label, unitId, result, at);
    return result.ok ? { ok: true, action: result.value } : { ok: false, error: result.error };
  }

  return (
    <div className="functions grid">
      <header className="pollHeader">
        <h1>Funciones <span>identificación, máscaras y tramas a mano</span></h1>
        <label className="pf" style={{ width: 110 }}>
          <span>Slave ID</span>
          <input type="number" min={0} max={255} value={unitId} onChange={(event) => setUnitId(Number(event.target.value))} />
        </label>
        <p><Info size={15} />Se envían por la conexión activa ({props.framing === "tcp" ? "Modbus TCP" : props.framing === "ascii" ? "Modbus ASCII" : "Modbus RTU"}).</p>
      </header>
      <DeviceIdCard run={run} />
      <ServerIdCard run={run} />
      <MaskWriteCard run={run} addressMode={props.addressMode} />
      <ReadWriteCard run={run} addressMode={props.addressMode} />
      <RawFrameCard {...props} />
    </div>
  );
}

type Run = (label: string, request: ModbusRequest) => Promise<Outcome>;

function DeviceIdCard({ run }: { run: Run }) {
  const [code, setCode] = useState<1 | 2 | 3 | 4>(1);
  const [objectId, setObjectId] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setOutcome(await run("FC43/14 Identificación", { fc: 43, readDeviceIdCode: code, objectId: code === 4 ? objectId : code === 1 ? 0 : objectId }));
    setBusy(false);
  }

  const id = outcome?.ok ? outcome.action.deviceId : undefined;
  return (
    <section className="card">
      <header><h2><Fingerprint size={17} /> Identificación (FC43/14)</h2></header>
      <p>Lee fabricante, código de producto, versión y demás datos del equipo (Read Device Identification).</p>
      <div className="fnRow">
        <label className="pf"><span>Tipo de lectura</span>
          <select value={code} onChange={(event) => setCode(Number(event.target.value) as 1 | 2 | 3 | 4)}>
            <option value={1}>01 Básica (0–2)</option>
            <option value={2}>02 Normal (0–6)</option>
            <option value={3}>03 Extendida</option>
            <option value={4}>04 Un objeto</option>
          </select>
        </label>
        <label className="pf"><span>Objeto inicial</span><input type="number" min={0} max={255} value={objectId} disabled={code === 1} onChange={(event) => setObjectId(Number(event.target.value))} /></label>
        <button className="primary" onClick={() => void send()} disabled={busy}><Send size={15} />Leer</button>
      </div>
      <ResultBox outcome={outcome}>
        {id ? (
          <dl>
            {id.objects.map((object) => <Fragment key={object.id} label={`${object.id.toString(16).toUpperCase().padStart(2, "0")} ${object.name}`} value={object.value || "(vacío)"} />)}
            <Fragment label="Conformidad" value={`0x${id.conformityLevel.toString(16).toUpperCase()}`} />
            {id.moreFollows ? <Fragment label="Hay más" value={`siguiente objeto ${id.nextObjectId}`} /> : null}
          </dl>
        ) : null}
      </ResultBox>
    </section>
  );
}

function ServerIdCard({ run }: { run: Run }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const report = outcome?.ok ? outcome.action.serverId : undefined;

  return (
    <section className="card">
      <header><h2><Fingerprint size={17} /> Report Server ID (FC17)</h2></header>
      <p>Pide al slave su identificador y si está en marcha. Lo usan equipos serie que no tienen FC43.</p>
      <div className="fnRow">
        <button className="primary" onClick={async () => { setBusy(true); setOutcome(await run("FC17 Report Server ID", { fc: 17 })); setBusy(false); }} disabled={busy}><Send size={15} />Consultar</button>
      </div>
      <ResultBox outcome={outcome}>
        {report ? (
          <dl>
            <Fragment label="Server ID" value={report.serverId === null ? "—" : String(report.serverId)} />
            <Fragment label="Estado" value={report.running === null ? "—" : report.running ? "En marcha (0xFF)" : "Detenido (0x00)"} />
            {report.text ? <Fragment label="Texto" value={report.text} /> : null}
            <Fragment label="Datos" value={<span className="mono">{report.data.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ")}</span>} />
          </dl>
        ) : null}
      </ResultBox>
    </section>
  );
}

function MaskWriteCard({ run, addressMode }: { run: Run; addressMode: AddressMode }) {
  const [address, setAddress] = useState(() => toDisplayAddress(addressMode, 3, 0));
  const [andMask, setAndMask] = useState("FFF0");
  const [orMask, setOrMask] = useState("0005");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    try {
      const raw = toProtocolAddress(addressMode, 3, address);
      const and = parseWord(andMask, "AND");
      const or = parseWord(orMask, "OR");
      setBusy(true);
      setOutcome(await run("FC22 Mask Write Register", { fc: 22, address: raw, andMask: and, orMask: or }));
    } catch (error) {
      setOutcome({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <header><h2><SlidersHorizontal size={17} /> Escribir con máscara (FC22)</h2></header>
      <p>Cambia solo algunos bits de un holding register: resultado = (actual AND máscara AND) OR (máscara OR AND NOT máscara AND).</p>
      <div className="fnRow">
        <label className="pf"><span>Dirección</span><input type="number" value={address} onChange={(event) => setAddress(Number(event.target.value))} /></label>
        <label className="pf"><span>Máscara AND (hex)</span><input value={andMask} onChange={(event) => setAndMask(event.target.value)} /></label>
        <label className="pf"><span>Máscara OR (hex)</span><input value={orMask} onChange={(event) => setOrMask(event.target.value)} /></label>
        <button className="primary" onClick={() => void send()} disabled={busy}><Send size={15} />Escribir</button>
      </div>
      <ResultBox outcome={outcome}>{outcome?.ok && !outcome.action.exception ? <span>El slave confirmó la máscara.</span> : null}</ResultBox>
    </section>
  );
}

function ReadWriteCard({ run, addressMode }: { run: Run; addressMode: AddressMode }) {
  const [readStart, setReadStart] = useState(() => toDisplayAddress(addressMode, 3, 0));
  const [readQty, setReadQty] = useState(4);
  const [writeStart, setWriteStart] = useState(() => toDisplayAddress(addressMode, 3, 0));
  const [values, setValues] = useState("1, 2");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    try {
      const parsed = values.split(/[\s,;]+/).filter(Boolean).map((text) => {
        const value = /^0x/i.test(text) ? parseInt(text, 16) : Number(text);
        if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new RangeError(`Valor fuera de 0–65535: ${text}`);
        return value;
      });
      if (parsed.length === 0) throw new RangeError("Escribe al menos un valor");
      setBusy(true);
      setOutcome(await run("FC23 Read/Write Multiple", {
        fc: 23,
        readStartAddress: toProtocolAddress(addressMode, 3, readStart),
        readQuantity: readQty,
        writeStartAddress: toProtocolAddress(addressMode, 3, writeStart),
        values: parsed
      }));
    } catch (error) {
      setOutcome({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  const read = outcome?.ok ? outcome.action.registerValues : undefined;
  return (
    <section className="card">
      <header><h2><SlidersHorizontal size={17} /> Leer y escribir a la vez (FC23)</h2></header>
      <p>Escribe un bloque y lee otro en la misma petición. El slave escribe primero y luego lee.</p>
      <div className="fnRow">
        <label className="pf"><span>Leer desde</span><input type="number" value={readStart} onChange={(event) => setReadStart(Number(event.target.value))} /></label>
        <label className="pf"><span>Cantidad</span><input type="number" min={1} max={125} value={readQty} onChange={(event) => setReadQty(Number(event.target.value))} /></label>
        <label className="pf"><span>Escribir desde</span><input type="number" value={writeStart} onChange={(event) => setWriteStart(Number(event.target.value))} /></label>
        <label className="pf"><span>Valores</span><input value={values} onChange={(event) => setValues(event.target.value)} /></label>
        <button className="primary" onClick={() => void send()} disabled={busy}><Send size={15} />Enviar</button>
      </div>
      <ResultBox outcome={outcome}>
        {read ? <dl>{read.map((value, index) => <Fragment key={index} label={String(readStart + index)} value={`${value}  (0x${value.toString(16).toUpperCase().padStart(4, "0")})`} />)}</dl> : null}
      </ResultBox>
    </section>
  );
}

function RawFrameCard(props: FunctionsViewProps) {
  const [hex, setHex] = useState(RAW_EXAMPLE);
  const [addCheck, setAddCheck] = useState(true);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    const bridge = window.jwModbus;
    if (!bridge) return setOutcome({ ok: false, error: "Abre la app de escritorio para enviar tramas." });
    if (!props.connected) return setOutcome({ ok: false, error: "Conecta primero (serie o TCP)." });
    setBusy(true);
    const at = new Date();
    const result = await bridge.modbus.sendRaw({ hex, addCheck, timeoutMs: props.timeoutMs });
    setBusy(false);
    props.onResult("Trama manual", result.ok ? result.value.unitId : 0, result, at);
    setOutcome(result.ok ? { ok: true, action: result.value } : { ok: false, error: result.error });
  }

  const action = outcome?.ok ? outcome.action : undefined;
  return (
    <section className="card rawFull">
      <header><h2><Terminal size={17} /> Trama manual (hex)</h2></header>
      <p>
        {addCheck
          ? `Escribe el unit id y el PDU; la app agrega ${props.framing === "rtu" ? "el CRC" : props.framing === "ascii" ? "«:», el LRC y CRLF" : "la cabecera MBAP"}.`
          : props.framing === "ascii"
            ? "Se envía tal cual. En ASCII escribe los bytes del texto, por ejemplo 3A 30 31 … 0D 0A."
            : "Se envía tal cual, byte por byte, sin agregar nada."}
      </p>
      <textarea value={hex} spellCheck={false} onChange={(event) => setHex(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void send(); }} />
      <div className="fnRow">
        <label className="inlineCheck"><input type="checkbox" checked={addCheck} onChange={(event) => setAddCheck(event.target.checked)} />{checkLabels[props.framing]}</label>
        <button className="primary" onClick={() => void send()} disabled={busy}><Send size={15} />Enviar (Ctrl+Enter)</button>
      </div>
      <ResultBox outcome={outcome}>
        {action ? (
          <dl>
            <Fragment label="Enviado" value={<span className="mono">{action.txHex}</span>} />
            <Fragment label="Recibido" value={<span className="mono">{action.rxHex || "—"}</span>} />
            <Fragment label="Resultado" value={action.summary} />
            <Fragment label="Tiempo" value={`${action.elapsedMs} ms`} />
          </dl>
        ) : null}
      </ResultBox>
    </section>
  );
}

function ResultBox({ outcome, children }: { outcome: Outcome | null; children?: ReactNode }) {
  if (!outcome) return null;
  if (!outcome.ok) return <div className="fnResult bad">{outcome.error}</div>;
  const { action } = outcome;
  if (action.exception) return <div className="fnResult bad">Excepción {action.exception.exceptionCode}: {action.exception.exceptionName}</div>;
  if (!action.crcOk) return <div className="fnResult bad">{action.checkError ?? action.summary}</div>;
  return <div className="fnResult">{children ?? action.summary}<small>{action.elapsedMs} ms</small></div>;
}

function Fragment({ label, value }: { label: string; value: ReactNode }) {
  return <><dt>{label}</dt><dd>{value}</dd></>;
}

function parseWord(text: string, name: string): number {
  const clean = text.trim().replace(/^0x/i, "");
  const value = parseInt(clean, 16);
  if (!/^[0-9a-f]{1,4}$/i.test(clean) || !Number.isFinite(value)) throw new RangeError(`Máscara ${name}: escribe de 1 a 4 dígitos hex`);
  return value;
}
