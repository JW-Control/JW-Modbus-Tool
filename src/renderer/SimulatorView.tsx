import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, Info, Play, Plus, RefreshCw, Square, Trash2 } from "lucide-react";
import type { SerialParity, SerialPortDescriptor } from "../shared/serial/types.js";
import { findVirtualDeviceTemplate, virtualDeviceTemplates } from "../shared/slave/templates.js";
import type {
  SlaveSimulatorSettings,
  SlaveSimulatorState,
  SlaveTable,
  SlaveTrafficEntry,
  SlaveTrafficResult,
  VirtualDeviceFaults,
  VirtualDeviceSnapshot,
  VirtualDeviceSummary,
  VirtualExceptionCode,
  VirtualFaultMode
} from "../shared/slave/types.js";
import { loadSimulatorSettings, SIMULATOR_SETTINGS_EVENT, simulatorBaudRates, storeSimulatorSettings } from "./simulatorSettings.js";
import "./simulator.css";

const MAX_TRAFFIC_ROWS = 500;
const DEFAULT_TABLE_SIZE = 64;
const MAX_TABLE_SIZE = 9999;

// Display offsets follow the convention used by the master views (40000 + offset for FC03, etc.).
const tables: Array<{ id: SlaveTable; label: string; functions: string; base: number; access: string }> = [
  { id: "coils", label: "Coils", functions: "FC01 · FC05 · FC15", base: 0, access: "Lectura y escritura" },
  { id: "discreteInputs", label: "Entradas discretas", functions: "FC02", base: 10000, access: "Solo lectura para el master" },
  { id: "holdingRegisters", label: "Holding registers", functions: "FC03 · FC06 · FC16", base: 40000, access: "Lectura y escritura" },
  { id: "inputRegisters", label: "Input registers", functions: "FC04", base: 30000, access: "Solo lectura para el master" }
];

const resultLabels: Record<SlaveTrafficResult, string> = {
  response: "Respondida",
  exception: "Excepción",
  broadcast: "Broadcast",
  ignored: "Ignorada",
  silenced: "Sin respuesta",
  "crc-error": "Error CRC",
  "frame-error": "Trama inválida"
};

const faultModes: Array<{ id: VirtualFaultMode; label: string }> = [
  { id: "none", label: "Ninguna" },
  { id: "no-response", label: "Sin respuesta (timeout)" },
  { id: "bad-crc", label: "CRC corrupto" },
  { id: "exception", label: "Excepción forzada" }
];

const exceptionCodes: Array<{ code: VirtualExceptionCode; label: string }> = [
  { code: 1, label: "01 · Función ilegal" },
  { code: 2, label: "02 · Dirección ilegal" },
  { code: 3, label: "03 · Valor ilegal" },
  { code: 4, label: "04 · Falla del dispositivo" }
];

const emptyState: SlaveSimulatorState = {
  running: false,
  devices: [],
  counters: { requests: 0, responses: 0, exceptions: 0, ignored: 0, crcErrors: 0, faults: 0 }
};

export function SimulatorView({ masterPort, masterConnected, onMessage }: { masterPort: string; masterConnected: boolean; onMessage: (text: string) => void }) {
  const bridge = window.jwModbus;
  const [state, setState] = useState<SlaveSimulatorState>(emptyState);
  const [ports, setPorts] = useState<SerialPortDescriptor[]>([]);
  const [settings, setSettings] = useState<SlaveSimulatorSettings>(() => loadSimulatorSettings());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [device, setDevice] = useState<VirtualDeviceSnapshot | null>(null);
  const [table, setTable] = useState<SlaveTable>("holdingRegisters");
  const [traffic, setTraffic] = useState<SlaveTrafficEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [newTemplate, setNewTemplate] = useState("generic");
  const [newId, setNewId] = useState("1");
  const [newName, setNewName] = useState("");
  const [newSize, setNewSize] = useState(String(DEFAULT_TABLE_SIZE));
  const selectedRef = useRef<number | null>(null);
  const refreshTimer = useRef<number | null>(null);

  selectedRef.current = selectedId;

  useEffect(() => {
    if (!bridge?.slave) return;
    void bridge.slave.getState().then((result) => { if (result.ok) setState(result.value); });
    void refreshPorts();

    const unsubscribe = bridge.slave.onEvent((event) => {
      if (event.type === "state") setState(event.state);
      if (event.type === "traffic") setTraffic((current) => [event.entry, ...current].slice(0, MAX_TRAFFIC_ROWS));
      if (event.type === "device" && event.unitId === selectedRef.current) scheduleDeviceRefresh();
    });
    const reloadSettings = () => setSettings(loadSimulatorSettings());
    window.addEventListener(SIMULATOR_SETTINGS_EVENT, reloadSettings);

    return () => {
      unsubscribe();
      window.removeEventListener(SIMULATOR_SETTINGS_EVENT, reloadSettings);
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    };
  }, []);

  useEffect(() => { storeSimulatorSettings(settings); }, [settings]);

  useEffect(() => {
    if (state.devices.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !state.devices.some((item) => item.unitId === selectedId)) setSelectedId(state.devices[0].unitId);
  }, [state.devices, selectedId]);

  // Reload the open table whenever the device list changes (import from a session, new faults, etc.).
  useEffect(() => {
    if (selectedId === null) {
      setDevice(null);
      return;
    }
    void loadDevice(selectedId);
  }, [selectedId, state.devices]);

  // Suggest a free unit id: the template's own id when it is free, otherwise the lowest free one.
  useEffect(() => {
    const used = new Set(state.devices.map((item) => item.unitId));
    const preferred = newTemplate === "generic" ? Number(newId) : findVirtualDeviceTemplate(newTemplate)?.unitId ?? Number(newId);
    if (Number.isInteger(preferred) && !used.has(preferred)) {
      setNewId(String(preferred));
      return;
    }
    const free = Array.from({ length: 247 }, (_, index) => index + 1).find((id) => !used.has(id));
    if (free) setNewId(String(free));
  }, [state.devices, newTemplate]);

  useEffect(() => {
    if (device && device.sizes[table] === 0) {
      const firstFilled = tables.find((item) => device.sizes[item.id] > 0);
      if (firstFilled) setTable(firstFilled.id);
    }
  }, [device?.unitId]);

  if (!bridge?.slave) {
    return <div className="simulator grid"><section className="card simConfig"><p className="note"><Info size={16} />Abre la app en Electron para usar el simulador slave.</p></section></div>;
  }

  const slave = bridge.slave;
  const masterUsesPort = masterConnected && samePort(masterPort, settings.port);
  const tableInfo = tables.find((item) => item.id === table) ?? tables[0];
  const values: Array<boolean | number> = device ? device[table] : [];
  const labels = device?.labels[table] ?? [];
  const selectedSummary = state.devices.find((item) => item.unitId === selectedId) ?? null;
  const template = findVirtualDeviceTemplate(newTemplate);
  const templateSerial = template?.serial ?? null;
  const serialDiffers = Boolean(templateSerial) && (
    templateSerial!.baudRate !== settings.baudRate ||
    templateSerial!.dataBits !== settings.dataBits ||
    templateSerial!.parity !== settings.parity ||
    templateSerial!.stopBits !== settings.stopBits
  );

  async function refreshPorts() {
    const result = await bridge!.serial.listPorts();
    if (!result.ok) return onMessage(result.error);
    setPorts(result.value);
    setSettings((current) => (current.port && result.value.some((item) => item.path === current.port) ? current : { ...current, port: firstFreePort(result.value) }));
  }

  function firstFreePort(list: SerialPortDescriptor[]) {
    return (list.find((item) => !(masterConnected && samePort(masterPort, item.path))) ?? list[0])?.path ?? "";
  }

  function scheduleDeviceRefresh() {
    if (refreshTimer.current !== null) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      if (selectedRef.current !== null) void loadDevice(selectedRef.current);
    }, 100);
  }

  async function loadDevice(unitId: number) {
    const result = await slave.getDevice(unitId);
    if (result.ok && selectedRef.current === unitId) setDevice(result.value);
  }

  async function toggleRunning() {
    setBusy(true);
    const result = state.running
      ? await slave.stop()
      : await slave.start({ path: settings.port, baudRate: settings.baudRate, dataBits: settings.dataBits, parity: settings.parity, stopBits: settings.stopBits });
    setBusy(false);
    if (!result.ok) return onMessage(result.error);
    setState(result.value);
    onMessage(result.value.running
      ? `Simulador escuchando en ${settings.port}. Responde como ${result.value.devices.length} slave(s) virtual(es).`
      : "Simulador detenido.");
  }

  async function addDevice() {
    const size = Number(newSize);
    const result = await slave.addDevice({
      unitId: Number(newId),
      name: newName,
      template: newTemplate === "generic" ? undefined : newTemplate,
      sizes: { coils: size, discreteInputs: size, holdingRegisters: size, inputRegisters: size }
    });
    if (!result.ok) return onMessage(result.error);
    setState(result.value);
    setSelectedId(Number(newId));
    setNewName("");
    onMessage(`Dispositivo virtual ID ${newId} agregado${template && newTemplate !== "generic" ? ` con la plantilla ${template.name}` : ""}.`);
  }

  async function removeDevice(unitId: number) {
    const result = await slave.removeDevice(unitId);
    if (!result.ok) return onMessage(result.error);
    setState(result.value);
    onMessage(`Dispositivo virtual ID ${unitId} eliminado.`);
  }

  async function setValue(address: number, value: boolean | number) {
    if (!device) return;
    const result = await slave.setValue({ unitId: device.unitId, table, address, value });
    if (!result.ok) return onMessage(result.error);
    setDevice(result.value);
  }

  async function setFaults(faults: Partial<VirtualDeviceFaults>) {
    if (!selectedSummary) return;
    const result = await slave.setFaults({ unitId: selectedSummary.unitId, faults });
    if (!result.ok) return onMessage(result.error);
    setState(result.value);
  }

  function applyTemplateSerial() {
    if (!templateSerial) return;
    setSettings({ ...settings, ...templateSerial });
    onMessage(`Formato serial de la plantilla aplicado: ${templateSerial.baudRate} ${templateSerial.dataBits}${templateSerial.parity === "none" ? "N" : templateSerial.parity[0].toUpperCase()}${templateSerial.stopBits}.`);
  }

  return (
    <div className="simulator grid">
      <section className="card simConfig">
        <header>
          <h2>Simulador slave</h2>
          <span className={`simBadge ${state.running ? "on" : ""}`}>{state.running ? `Escuchando en ${state.config?.path}` : "Detenido"}</span>
        </header>
        <div className="simFields">
          <label>Puerto
            <span className="simPortRow">
              <select value={settings.port} disabled={state.running} onChange={(event) => setSettings({ ...settings, port: event.target.value })}>
                {ports.length === 0 ? <option value="">Sin puertos</option> : ports.map((item) => (
                  <option key={item.path} value={item.path}>{item.displayName}{masterConnected && samePort(masterPort, item.path) ? " (master)" : ""}</option>
                ))}
              </select>
              <button className="ghost" title="Recargar puertos" disabled={state.running} onClick={() => void refreshPorts()}><RefreshCw size={15} /></button>
            </span>
          </label>
          <label>Baud rate
            <select value={settings.baudRate} disabled={state.running} onChange={(event) => setSettings({ ...settings, baudRate: Number(event.target.value) })}>
              {simulatorBaudRates.map((rate) => <option key={rate} value={rate}>{rate}</option>)}
            </select>
          </label>
          <label>Bits de datos
            <select value={settings.dataBits} disabled={state.running} onChange={(event) => setSettings({ ...settings, dataBits: event.target.value === "7" ? 7 : 8 })}>
              <option value={8}>8</option>
              <option value={7}>7</option>
            </select>
          </label>
          <label>Paridad
            <select value={settings.parity} disabled={state.running} onChange={(event) => setSettings({ ...settings, parity: event.target.value as SerialParity })}>
              <option value="none">Ninguna</option>
              <option value="even">Par</option>
              <option value="odd">Impar</option>
            </select>
          </label>
          <label>Bits de parada
            <select value={settings.stopBits} disabled={state.running} onChange={(event) => setSettings({ ...settings, stopBits: event.target.value === "2" ? 2 : 1 })}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
        </div>
        {masterUsesPort && !state.running && <p className="note simWarn"><AlertTriangle size={16} />{settings.port} está abierto como master. Elige otro puerto para el simulador.</p>}
        {state.lastError && <p className="note simWarn"><AlertTriangle size={16} />{state.lastError}</p>}
        <button className={state.running ? "simStop" : "purple"} disabled={busy || (!state.running && (!settings.port || masterUsesPort))} onClick={() => void toggleRunning()}>
          {state.running ? <><Square size={15} />Detener simulador</> : <><Play size={15} />Iniciar simulador</>}
        </button>
        {state.devices.length === 0 && <p className="note"><Info size={16} />Agrega al menos un dispositivo virtual; sin ellos el simulador no responde a ningún ID.</p>}
        <div className="simCounters">
          <Counter label="Peticiones" value={state.counters.requests} />
          <Counter label="Respondidas" value={state.counters.responses} tone="ok" />
          <Counter label="Excepciones" value={state.counters.exceptions} tone="purple" />
          <Counter label="Ignoradas" value={state.counters.ignored} />
          <Counter label="Err. CRC" value={state.counters.crcErrors} tone="bad" />
          <Counter label="Fallas" value={state.counters.faults} tone="warn" />
        </div>
      </section>

      <section className="card simDevices">
        <header><h2>Dispositivos virtuales</h2><small>{state.devices.length} en el bus</small></header>
        <div className="simDeviceList">
          {state.devices.map((item) => (
            <article key={item.unitId} className={item.unitId === selectedId ? "active" : ""} onClick={() => setSelectedId(item.unitId)}>
              <b>ID {item.unitId}</b>
              <span>{item.name}<small>{item.requests} peticiones{faultText(item) ? <em className="simFaultTag"> · {faultText(item)}</em> : null}</small></span>
              <button className="iconOnly" title={`Eliminar ID ${item.unitId}`} onClick={(event) => { event.stopPropagation(); void removeDevice(item.unitId); }}><Trash2 size={15} /></button>
            </article>
          ))}
        </div>
        {selectedSummary && <FaultsPanel device={selectedSummary} onChange={(faults) => void setFaults(faults)} />}
        <div className="simAddForm">
          <label className="simSpan">Plantilla
            <select value={newTemplate} onChange={(event) => setNewTemplate(event.target.value)}>
              {virtualDeviceTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {template && newTemplate !== "generic" && <p className="simHint simSpan">{template.description}</p>}
          <label>Unit ID<input inputMode="numeric" value={newId} onChange={(event) => setNewId(event.target.value)} /></label>
          <label>Nombre<input placeholder={template && newTemplate !== "generic" ? template.name : "Slave virtual"} value={newName} onChange={(event) => setNewName(event.target.value)} /></label>
          <label title={`Posiciones por tabla (0 a ${MAX_TABLE_SIZE})`}>Tamaño<input inputMode="numeric" disabled={newTemplate !== "generic"} value={newTemplate !== "generic" ? "—" : newSize} onChange={(event) => setNewSize(event.target.value)} /></label>
          {serialDiffers && templateSerial && (
            <p className="note simWarn simSpan"><AlertTriangle size={16} />El equipo real usa {templateSerial.baudRate} {templateSerial.dataBits}{templateSerial.parity === "none" ? "N" : templateSerial.parity[0].toUpperCase()}{templateSerial.stopBits}.
              <button className="ghost" disabled={state.running} onClick={applyTemplateSerial}>Usar ese formato</button>
            </p>
          )}
          <button className="primary simSpan" onClick={() => void addDevice()}><Plus size={15} />Agregar</button>
        </div>
      </section>

      <section className="card simMemory">
        <header>
          <h2>{device ? `Memoria · ${device.name} (ID ${device.unitId})` : "Memoria"}</h2>
          <small>{tableInfo.functions} · {tableInfo.access}</small>
        </header>
        <div className="simTabs">
          {tables.map((item) => (
            <button key={item.id} className={item.id === table ? "active" : ""} onClick={() => setTable(item.id)}>
              {item.label}<small>{device ? device.sizes[item.id] : 0} posiciones</small>
            </button>
          ))}
        </div>
        {!device ? <p className="note"><Info size={16} />Agrega o selecciona un dispositivo virtual para ver y editar su memoria.</p> : values.length === 0 ? (
          <p className="note"><Info size={16} />Este dispositivo no tiene {tableInfo.label.toLowerCase()}. El master recibirá la excepción 02 (dirección ilegal), igual que con el equipo real.</p>
        ) : (
          <div className="simValues">
            <div className="tr head simRow"><span>Dirección</span><span>Offset</span><span>Nombre</span><span>Valor</span><span>Hex</span></div>
            {values.map((value, address) => (
              <div className="tr simRow" key={address}>
                <span>{tableInfo.base + address}</span>
                <span className="muted">{address}</span>
                <span className={labels[address] ? "" : "muted"}>{labels[address] ?? "—"}</span>
                <span>{typeof value === "boolean"
                  ? <button className={`bitChip ${value ? "on" : "off"}`} onClick={() => void setValue(address, !value)}>{value ? "ON" : "OFF"}</button>
                  : <RegisterInput value={value} onCommit={(next) => void setValue(address, next)} />}</span>
                <span className="muted">{typeof value === "boolean" ? "—" : `0x${value.toString(16).toUpperCase().padStart(4, "0")}`}</span>
              </div>
            ))}
          </div>
        )}
        <p className="note"><Info size={16} />Los cambios se aplican al instante: el master leerá el valor nuevo en su próxima petición.</p>
      </section>

      <section className="card simTraffic">
        <header><h2>Tráfico del simulador</h2><button className="ghost" onClick={() => setTraffic([])}>Limpiar</button></header>
        {traffic.length === 0 ? <p className="note"><Info size={16} />Aquí aparecerá cada petición que llegue al puerto y la respuesta enviada.</p> : (
          <div className="simTrafficTable">
            <div className="tr head simTrafficRow"><span>Hora</span><span>ID</span><span>Función</span><span>Petición</span><span>Respuesta</span><span>Resultado</span><span>Falla</span></div>
            {traffic.map((entry) => (
              <div className="tr simTrafficRow" key={entry.id} title={entry.summary}>
                <span>{formatTime(entry.at)}</span>
                <span>{entry.unitId ?? "—"}</span>
                <span>{entry.functionCode === null ? "—" : `FC${entry.functionCode.toString(16).toUpperCase().padStart(2, "0")}`}</span>
                <span className="mono">{entry.request}</span>
                <span className="mono">{entry.response ?? "—"}</span>
                <span className={`simResult ${entry.result}`}>{resultLabels[entry.result]}</span>
                <span className={entry.fault ? "simFaultTag" : "muted"}>{entry.fault ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FaultsPanel({ device, onChange }: { device: VirtualDeviceSummary; onChange: (faults: Partial<VirtualDeviceFaults>) => void }) {
  const [delay, setDelay] = useState(String(device.faults.delayMs));

  useEffect(() => { setDelay(String(device.faults.delayMs)); }, [device.unitId, device.faults.delayMs]);

  function commitDelay() {
    const next = Number(delay);
    if (!Number.isInteger(next) || next < 0 || next > 60000) return setDelay(String(device.faults.delayMs));
    if (next !== device.faults.delayMs) onChange({ delayMs: next });
  }

  return (
    <div className={`simFaults ${device.faults.mode !== "none" || device.faults.delayMs > 0 ? "active" : ""}`}>
      <strong>Fallas de ID {device.unitId}</strong>
      <label>Modo
        <select value={device.faults.mode} onChange={(event) => onChange({ mode: event.target.value as VirtualFaultMode })}>
          {faultModes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      {device.faults.mode === "exception" && (
        <label>Código
          <select value={device.faults.exceptionCode} onChange={(event) => onChange({ exceptionCode: Number(event.target.value) as VirtualExceptionCode })}>
            {exceptionCodes.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
      )}
      <label title="Se suma antes de cada respuesta. Si supera el timeout del master, este verá un timeout.">Retardo (ms)
        <input inputMode="numeric" value={delay} disabled={device.faults.mode === "no-response"} onChange={(event) => setDelay(event.target.value)} onBlur={commitDelay} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      </label>
    </div>
  );
}

function RegisterInput({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);

  function commit() {
    setEditing(false);
    const next = Number(draft);
    if (!Number.isInteger(next) || next < 0 || next > 0xffff) return setDraft(String(value));
    if (next !== value) onCommit(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setDraft(String(value));
      setEditing(false);
      event.currentTarget.blur();
    }
  }

  return <input className="simRegInput" inputMode="numeric" value={draft} onFocus={() => setEditing(true)} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={onKeyDown} />;
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" | "purple" | "warn" }) {
  return <div className={`simCounter ${tone ? `tone-${tone}` : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function faultText(device: VirtualDeviceSummary) {
  const mode = faultModes.find((item) => item.id === device.faults.mode);
  const parts = device.faults.mode === "none" ? [] : [device.faults.mode === "exception" ? `Excepción ${String(device.faults.exceptionCode).padStart(2, "0")}` : mode?.label ?? ""];
  if (device.faults.delayMs > 0 && device.faults.mode !== "no-response") parts.push(`+${device.faults.delayMs} ms`);
  return parts.join(" ");
}

function samePort(left: string, right: string) {
  return Boolean(left) && left.trim().toUpperCase() === right.trim().toUpperCase();
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return `${new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date)}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}
