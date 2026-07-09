import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  FlaskConical,
  FolderOpen,
  Info,
  Monitor,
  Network,
  Pencil,
  Play,
  Plug,
  RefreshCw,
  Save,
  Search,
  Settings,
  Square,
  Star,
  Unplug
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type View = "devices" | "sessions" | "tests" | "registers" | "traffic";
type Status = "OK" | "Aprobado" | "Error" | "Timeout" | "CRC Error" | "Excepción" | "Pendiente";
type Fn = "fc1" | "fc2" | "fc3" | "fc4" | "fc6";

interface Device { id: number; name: string; named: boolean; active?: boolean }
interface PortOption { path: string; label: string; hasMetadata: boolean }
interface Stats { requests: number; responses: number; errors: number; timeouts: number }
interface ActivityRow { id: number; at: Date; ms: number; slave: number | "—"; device: string; fn: string; label: string; range: string; qty: number | "—"; values: string; status: Status }
interface TrafficRow { id: number; dir: "up" | "down"; at: Date; route: string; slave: number; type: "Petición" | "Respuesta"; fn: string; status: Status; summary: string; ms?: number }
interface RegisterRow { raw: number; address: string; name: string; value: string; type: string; access: string; status: Status }
interface TestRow { enabled: boolean; step: number; slave: number; device: string; fn: Fn; label: string; address: number; amount: number; expected: string; timeout: number; result: Status }

const nav: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "devices", label: "Dispositivos", icon: Network },
  { id: "sessions", label: "Sesiones", icon: Clock3 },
  { id: "tests", label: "Pruebas", icon: FlaskConical },
  { id: "registers", label: "Registros", icon: Database },
  { id: "traffic", label: "Tráfico Modbus", icon: Activity }
];

const fnMap: Record<Fn, { short: string; label: string }> = {
  fc1: { short: "FC01", label: "FC01 Read Coils" },
  fc2: { short: "FC02", label: "FC02 Read Discrete Inputs" },
  fc3: { short: "FC03", label: "FC03 Read Holding Registers" },
  fc4: { short: "FC04", label: "FC04 Read Input Registers" },
  fc6: { short: "FC06", label: "FC06 Write Single Register" }
};

const registerMeta: Record<number, { name: string; type: string; access: string; unit?: string }> = {
  0: { name: "Velocidad_Ref", type: "uint16", access: "R/W", unit: "RPM" },
  1: { name: "Estado_Variador", type: "uint16", access: "R/W" },
  2: { name: "Corriente_Salida", type: "uint16", access: "R/W", unit: "A" },
  3: { name: "Tension_DC", type: "uint16", access: "R/W", unit: "V" },
  4: { name: "Temp_Disipador", type: "uint16", access: "R/W", unit: "°C" },
  5: { name: "Horas_Marcha", type: "uint16", access: "R/W", unit: "h" },
  8: { name: "Frecuencia_Salida", type: "uint16", access: "R/W", unit: "Hz" },
  9: { name: "Estado_Alarma", type: "uint16", access: "R/W" }
};

let rowId = 1;

export function SimpleModeApp() {
  const bridge = window.jwModbus;
  const [view, setView] = useState<View>("devices");
  const [message, setMessage] = useState(bridge ? "Sesión limpia. Conecta y escanea para empezar." : "Abre la app en Electron para usar el backend serial.");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ports, setPorts] = useState<PortOption[]>([]);
  const [port, setPort] = useState("");
  const [baud, setBaud] = useState(115200);
  const [dataBits, setDataBits] = useState(8);
  const [parity, setParity] = useState("none");
  const [stopBits, setStopBits] = useState(1);
  const [timeout, setTimeoutMs] = useState(1000);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [qFn, setQFn] = useState<Fn>("fc3");
  const [qAddr, setQAddr] = useState(40000);
  const [qQty, setQQty] = useState(6);
  const [quick, setQuick] = useState<RegisterRow[]>([]);
  const [rFn, setRFn] = useState<Fn>("fc3");
  const [rAddr, setRAddr] = useState(40000);
  const [rQty, setRQty] = useState(10);
  const [regs, setRegs] = useState<RegisterRow[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<RegisterRow | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [traffic, setTraffic] = useState<TrafficRow[]>([]);
  const [stats, setStats] = useState<Stats>({ requests: 0, responses: 0, errors: 0, timeouts: 0 });
  const [tests, setTests] = useState<TestRow[]>(createCleanTests());

  const activeDevice = useMemo(
    () => (activeId === null ? null : devices.find((device) => device.id === activeId) ?? null),
    [activeId, devices]
  );

  useEffect(() => { void initBackend(); }, []);
  useEffect(() => { if (!selectedRegister && regs.length > 0) setSelectedRegister(regs[0]); }, [regs, selectedRegister]);
  useEffect(() => {
    setQAddr(defaultAddress(qFn));
    setQQty(qFn === "fc1" || qFn === "fc2" ? 8 : 6);
    setQuick([]);
  }, [qFn]);

  async function initBackend() {
    if (!bridge) return;
    const [portResult, stateResult] = await Promise.all([
      bridge.serial.listPorts(),
      bridge.serial.getConnectionState()
    ]);
    const state = stateResult.ok ? (stateResult.value as any) : null;
    const currentPath = state?.config?.path || "";
    if (stateResult.ok) {
      setConnected(Boolean(state?.connected));
      if (state?.config) {
        setPort(state.config.path);
        setBaud(state.config.baudRate);
        setDataBits(state.config.dataBits);
        setParity(state.config.parity);
        setStopBits(state.config.stopBits);
      }
    }
    if (portResult.ok) setVisiblePorts(portResult.value as any[], currentPath);
  }

  function setVisiblePorts(rawPorts: any[], preferred = port) {
    const normalized = normalizePorts(rawPorts);
    const withMetadata = normalized.filter((item) => item.hasMetadata);
    let visible = withMetadata.length > 0 ? withMetadata : normalized;
    if (preferred) {
      const preferredPort = normalized.find((item) => item.path === preferred);
      if (preferredPort && withMetadata.length === 0 && normalized.length > 1) visible = [preferredPort];
    }
    if (!preferred && withMetadata.length === 0 && normalized.length > 1) visible = [highestComPort(normalized)];
    setPorts(visible);
    setPort((current) => {
      if (current && visible.some((item) => item.path === current)) return current;
      return visible[0]?.path ?? "";
    });
  }

  async function refreshPorts() {
    if (!bridge) return setMessage("Backend Electron no disponible.");
    setBusy(true);
    const result = await bridge.serial.listPorts();
    setBusy(false);
    if (!result.ok) return setMessage(result.error);
    setVisiblePorts(result.value as any[], port);
    setMessage("Lista de puertos actualizada. Se muestran puertos USB/activos para evitar COM residuales.");
  }

  async function connect() {
    if (!bridge) return setMessage("Backend Electron no disponible.");
    if (!port) return setMessage("No hay puerto seleccionado. Recarga la lista de puertos.");
    setBusy(true);
    const result = await bridge.serial.open({
      path: port,
      baudRate: baud,
      dataBits: dataBits === 7 ? 7 : 8,
      parity: parity as "none" | "even" | "odd",
      stopBits: stopBits === 2 ? 2 : 1
    });
    setBusy(false);
    if (!result.ok) {
      setConnected(false);
      setMessage(result.error);
      return;
    }
    setConnected(Boolean((result.value as any).connected));
    setMessage(`Conectado a ${port}. Escanea para detectar slaves reales.`);
  }

  async function disconnect() {
    if (!bridge) return;
    setBusy(true);
    const result = await bridge.serial.close();
    setBusy(false);
    if (result.ok) {
      setConnected(false);
      setMessage("Desconectado.");
    } else setMessage(result.error);
  }

  function requireReady() {
    if (!bridge) { setMessage("Abre la app en Electron para usar el backend serial."); return false; }
    if (!connected) { setMessage("Conecta primero el puerto serial."); return false; }
    return true;
  }

  async function scanDevices() {
    if (!requireReady()) return;
    setBusy(true);
    const found: Device[] = [];
    const scanRange = Array.from({ length: 10 }, (_, index) => index + 1);
    for (const id of scanRange) {
      const started = Date.now();
      const result = await bridge!.modbus.readHoldingRegisters({ unitId: id, startAddress: 0, quantity: 1, timeoutMs: 250 });
      if (result.ok) {
        const device = createDiscoveredDevice(id);
        found.push(device);
        const action = result.value as any;
        const valueSummary = valuesPreview("fc3", 40000, (action.registerValues ?? []) as Array<number | boolean>);
        pushActivity({ ms: Date.now() - started, slave: id, device: device.name, fn: "FC03", label: "Escaneo detectó respuesta", range: "40000 / 1 reg", qty: 1, values: valueSummary, status: "OK" });
      }
    }
    setStats((current) => ({ ...current, requests: current.requests + scanRange.length, responses: current.responses + found.length }));
    setDevices(found);
    const nextActiveId = found[0]?.id ?? null;
    setActiveId(nextActiveId);
    setQuick([]);
    setLastScan(new Date());
    setBusy(false);
    setMessage(found.length > 0 ? `${found.length} dispositivo(s) detectados.` : "No se detectaron slaves en el rango 1–10.");
  }

  async function readRegisters(fn: Fn, unitId: number, displayAddress: number, quantity: number, timeoutMs = timeout) {
    if (!requireReady()) return null;
    const started = new Date();
    const rawStart = rawAddress(fn, displayAddress);
    const command = { unitId, startAddress: rawStart, quantity, timeoutMs };
    setStats((current) => ({ ...current, requests: current.requests + 1 }));
    let result;
    if (fn === "fc1") result = await bridge!.modbus.readCoils(command);
    else if (fn === "fc2") result = await bridge!.modbus.readDiscreteInputs(command);
    else if (fn === "fc4") result = await bridge!.modbus.readInputRegisters(command);
    else result = await bridge!.modbus.readHoldingRegisters(command);
    if (!result.ok) {
      const status: Status = result.error.toLowerCase().includes("timeout") ? "Timeout" : "Error";
      setStats((current) => ({ ...current, errors: current.errors + 1, timeouts: current.timeouts + (status === "Timeout" ? 1 : 0) }));
      pushTrafficError(fn, unitId, displayNameFor(unitId), result.error, started, status);
      setMessage(result.error);
      return null;
    }
    const action = result.value as any;
    const status: Status = action.exception ? "Excepción" : action.crcOk ? "OK" : "CRC Error";
    const values = (action.registerValues ?? action.values ?? []) as Array<number | boolean>;
    setStats((current) => ({ ...current, responses: current.responses + (status === "OK" ? 1 : 0), errors: current.errors + (status === "OK" ? 0 : 1) }));
    pushTrafficAction(action, fn, displayNameFor(unitId), displayAddress, quantity, status);
    pushActivity({
      ms: action.elapsedMs ?? Date.now() - started.getTime(),
      slave: unitId,
      device: displayNameFor(unitId),
      fn: fnMap[fn].short,
      label: fnMap[fn].label,
      range: `${displayAddress} / ${quantity} ${fn === "fc1" || fn === "fc2" ? "bits" : "regs"}`,
      qty: quantity,
      values: valuesPreview(fn, displayAddress, values),
      status
    });
    return { values, action };
  }

  async function quickRead() {
    if (activeId === null) return setMessage("Primero escanea y selecciona un slave activo.");
    setBusy(true);
    const result = await readRegisters(qFn, activeId, qAddr, qQty);
    setBusy(false);
    if (!result) return;
    setQuick(buildRegisterRows(qFn, qAddr, result.values));
    setMessage(`${result.values.length} valor(es) leídos desde ${qAddr}.`);
  }

  async function registerRead() {
    if (activeId === null) return setMessage("Primero escanea y selecciona un slave activo.");
    setBusy(true);
    const result = await readRegisters(rFn, activeId, rAddr, rQty);
    setBusy(false);
    if (!result) return;
    const nextRows = buildRegisterRows(rFn, rAddr, result.values);
    setRegs(nextRows);
    setSelectedRegister(nextRows[0] ?? null);
    setMessage("Mapa de registros actualizado.");
  }

  async function runTests() {
    if (activeId === null) return setMessage("Primero detecta un slave activo.");
    if (!requireReady()) return;
    setBusy(true);
    const next = [...tests];
    for (const test of next) {
      if (!test.enabled) continue;
      test.result = "Pendiente";
      setTests([...next]);
      if (test.fn === "fc6") {
        const started = new Date();
        setStats((current) => ({ ...current, requests: current.requests + 1 }));
        const result = await bridge!.modbus.writeSingleRegister({ unitId: test.slave, address: rawAddress(test.fn, test.address), value: test.amount, timeoutMs: test.timeout });
        if (result.ok) {
          const action = result.value as any;
          test.result = action.exception ? "Excepción" : "Aprobado";
          setStats((current) => ({ ...current, responses: current.responses + (test.result === "Aprobado" ? 1 : 0) }));
          pushTrafficAction(action, test.fn, test.device, test.address, test.amount, test.result);
        } else {
          test.result = result.error.toLowerCase().includes("timeout") ? "Timeout" : "Error";
          setStats((current) => ({ ...current, errors: current.errors + 1, timeouts: current.timeouts + (test.result === "Timeout" ? 1 : 0) }));
          pushTrafficError(test.fn, test.slave, test.device, result.error, started, test.result);
        }
      } else {
        const result = await readRegisters(test.fn, test.slave, test.address, test.amount, test.timeout);
        test.result = result ? "Aprobado" : "Error";
      }
      setTests([...next]);
    }
    setBusy(false);
    setMessage("Plan de pruebas ejecutado.");
  }

  function selectDevice(id: number) {
    setActiveId(id);
    setDevices((current) => current.map((device) => ({ ...device, active: device.id === id })));
    setQuick([]);
    setMessage(`Slave activo: ${displayNameFor(id)}.`);
  }
  function pushActivity(row: Omit<ActivityRow, "id" | "at">) { setActivity((current) => [{ id: rowId++, at: new Date(), ...row }, ...current].slice(0, 30)); }
  function pushTrafficAction(action: any, fn: Fn, device: string, address: number, quantity: number, status: Status) {
    const at = action.timestamp ? new Date(action.timestamp) : new Date();
    setTraffic((current) => [
      { id: rowId++, dir: "up", at, route: `PC Master → ${device}`, slave: action.unitId, type: "Petición", fn: fnMap[fn].short, status, summary: summarize(fn, address, quantity), ms: action.elapsedMs },
      { id: rowId++, dir: "down", at, route: `${device} → PC Master`, slave: action.unitId, type: "Respuesta", fn: fnMap[fn].short, status, summary: responseSummary(action), ms: action.elapsedMs },
      ...current
    ].slice(0, 80));
  }
  function pushTrafficError(fn: Fn, unitId: number, device: string, error: string, at: Date, status: Status) { setTraffic((current) => [{ id: rowId++, dir: "up", at, route: `PC Master → ${device}`, slave: unitId, type: "Petición", fn: fnMap[fn].short, status, summary: error }, ...current].slice(0, 80)); }
  function displayNameFor(id: number) { return devices.find((device) => device.id === id)?.name ?? `Slave ID ${id}`; }

  return <main className="shell"><header className="toolbar"><div className="brand"><span>JW</span><div><strong>JW Modbus Tool</strong><em>Modo sencillo</em></div></div><div className="toolbar-actions"><Tool icon={FileText} label="Nuevo" /><Tool icon={FolderOpen} label="Abrir" /><Tool icon={Save} label="Guardar" /><i /><Tool icon={Plug} label="Conectar" tone="ok" onClick={connect} /><Tool icon={Unplug} label="Desconectar" tone="danger" onClick={disconnect} /><i /><Tool icon={Search} label="Escanear" onClick={scanDevices} /></div><div className="window-buttons"><span>{busy ? "Procesando…" : "Ayuda"}</span><button>—</button><button>□</button><button>×</button></div></header><div className="body"><aside className="sidebar"><nav>{nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><item.icon size={21} />{item.label}</button>)}</nav><div className="helper"><Info size={18} /><strong>¿Cómo funciona?</strong><p>{message}</p></div><div className="license"><Dot />Licencia: Profesional<br /><small>Versión 1.3.0 (64-bit)</small></div></aside><section className="workspace">{view === "devices" && <DevicesView {...{ ports, port, setPort, refreshPorts, baud, setBaud, dataBits, setDataBits, parity, setParity, stopBits, setStopBits, timeout, setTimeoutMs, connected, devices, activeId, activeDevice, selectDevice, scanDevices, lastScan, stats, qFn, setQFn, qAddr, setQAddr, qQty, setQQty, quick, quickRead, activity }} />}{view === "sessions" && <SessionsView activity={activity} devices={devices} />}{view === "tests" && <TestsView tests={tests} runTests={runTests} busy={busy} />}{view === "registers" && <RegistersView {...{ activeDevice, rFn, setRFn, rAddr, setRAddr, rQty, setRQty, regs, selectedRegister, setSelectedRegister, registerRead, activity }} />}{view === "traffic" && <TrafficView traffic={traffic} />}</section></div><footer className="status"><Dot /><strong>{connected ? "Conectado" : "Inactivo"}</strong><span>{port || "Sin puerto"}</span><span>{baud}</span><span>{dataBits}{parity === "none" ? "N" : parity[0].toUpperCase()}{stopBits}</span><span>Slave activo ID {activeId ?? "—"}</span><span>Sesión limpia</span></footer></main>;
}

function DevicesView(props: {
  ports: PortOption[]; port: string; setPort: (value: string) => void; refreshPorts: () => void; baud: number; setBaud: (value: number) => void; dataBits: number; setDataBits: (value: number) => void; parity: string; setParity: (value: string) => void; stopBits: number; setStopBits: (value: number) => void; timeout: number; setTimeoutMs: (value: number) => void; connected: boolean; devices: Device[]; activeId: number | null; activeDevice: Device | null; selectDevice: (id: number) => void; scanDevices: () => void; lastScan: Date | null; stats: Stats; qFn: Fn; setQFn: (value: Fn) => void; qAddr: number; setQAddr: (value: number) => void; qQty: number; setQQty: (value: number) => void; quick: RegisterRow[]; quickRead: () => void; activity: ActivityRow[];
}) {
  return <div className="devices grid"><Card title="1. Conectar" className="connect"><div className="radio"><label><input type="radio" checked readOnly />RTU</label><label><input type="radio" readOnly />TCP</label></div><PortSelectRow ports={props.ports} port={props.port} setPort={props.setPort} refreshPorts={props.refreshPorts} /><SelectField label="Baud Rate" value={String(props.baud)} onChange={(value) => props.setBaud(Number(value))} options={["9600", "19200", "38400", "57600", "115200"]} /><SelectField label="Bits de datos" value={String(props.dataBits)} onChange={(value) => props.setDataBits(Number(value))} options={["8", "7"]} /><SelectField label="Paridad" value={props.parity} onChange={props.setParity} options={["none", "even", "odd"]} /><SelectField label="Bits de parada" value={String(props.stopBits)} onChange={(value) => props.setStopBits(Number(value))} options={["1", "2"]} /><NumberField label="Timeout (ms)" value={props.timeout} onChange={props.setTimeoutMs} /><p className="connection"><Dot />Estado de conexión <strong>{props.connected ? "Conectado" : "Desconectado"}</strong></p></Card><Card title="2. Dispositivos detectados" action={<button className="ghost" onClick={props.scanDevices}><RefreshCw size={15} />Recargar</button>} className="detected">{props.devices.length === 0 ? <Empty text="Sesión limpia: todavía no hay dispositivos detectados. Usa Recargar/Escanear." /> : <Table columns={["Dispositivo", "ID"]} rows={props.devices.map((device) => [<button style={rowButtonStyle} onClick={() => props.selectDevice(device.id)}><Dot />{device.name} — ID {device.id}{device.id === props.activeId && <b className="pill">SLAVE ACTIVO</b>}{!device.named && <b className="pill">NOMBRE PEND.</b>}</button>, device.id])} />}<p className="note"><Info size={16} />Los nombres personalizados se asignarán desde la sesión o desde el mapa del dispositivo.</p></Card><Card title="Resumen" className="summary"><p>Estado general de la comunicación.</p><div className="kpis"><Kpi icon="↗" label="Solicitudes" value={String(props.stats.requests)} /><Kpi icon="✓" label="Respuestas" value={String(props.stats.responses)} tone="ok" /><Kpi icon="!" label="Errores" value={String(props.stats.errors)} tone="warn" /><Kpi icon="◷" label="Timeouts" value={String(props.stats.timeouts)} tone="purple" /></div><dl><dt>Dispositivos encontrados</dt><dd>{props.devices.length}</dd><dt>Rango de escaneo</dt><dd>1 – 10</dd><dt>Último escaneo</dt><dd>{props.lastScan ? <><Status status="OK" /><small>{fmt(props.lastScan)}</small></> : "—"}</dd><dt>Rol</dt><dd><Monitor size={15} /> PC Master</dd></dl></Card><div style={{ gridColumn: "1 / 4", display: "grid", gridTemplateColumns: "0.44fr 0.56fr", gap: 14 }}><Card title="3. Lectura rápida de registros" className="quickPanel"><p>Slave activo: <strong className="cyan">{props.activeDevice ? `${props.activeDevice.name} — ID ${props.activeDevice.id}` : "Sin seleccionar"}</strong></p><div className="quickbar"><SelectField label="Función" value={props.qFn} onChange={(value) => props.setQFn(value as Fn)} options={["fc3", "fc4", "fc1", "fc2"]} labels={fnLabels()} /><NumberField label="Dirección inicial" value={props.qAddr} onChange={props.setQAddr} /><NumberField label="Cantidad" value={props.qQty} onChange={props.setQQty} /><button className="primary" onClick={props.quickRead} disabled={!props.activeDevice}><Database size={15} />Leer</button></div><p className="note"><Info size={16} />{addressHelp(props.qFn)}</p>{props.quick.length === 0 ? <Empty text="Aún no hay lecturas. La tabla se llenará al presionar Leer." /> : <Table columns={["Dirección", "Nombre", "Valor", "Estado"]} rows={props.quick.map((row) => [row.address, withUnit(row), row.value, <Status status={row.status} />])} />}<p className="note"><Info size={16} />Se leerá el slave activo real; no hay datos precargados.</p></Card><Card title="Actividad reciente" className="recentPanel">{props.activity.length === 0 ? <Empty text="Sin actividad todavía. Aquí aparecerán escaneos y lecturas reales." /> : <Table columns={["Fecha/hora", "Duración", "Slave ID", "Función", "Dirección / cantidad", "Valor leído", "Resultado"]} rows={props.activity.slice(0, 6).map((row) => [fmt(row.at), `${row.ms} ms`, row.slave, row.fn, row.range, row.values, <Status status={row.status} />])} />}</Card></div></div>;
}

function SessionsView({ activity, devices }: { activity: ActivityRow[]; devices: Device[] }) { return <div className="sessions grid"><div className="top"><button className="primary">+ Nueva sesión</button><button><FolderOpen size={16} />Abrir sesión</button><button><Save size={16} />Guardar sesión</button></div><Card title="Sesión actual" className="current" action={<span className="oktext">● Limpia</span>}><h1>Nueva_sesion_Modbus <Pencil size={15} /></h1><div className="facts"><Fact label="Rol" value="PC Master" /><Fact label="Protocolo" value="RTU" /><Fact label="Slave activo" value={devices[0] ? `${devices[0].name} — ID ${devices[0].id}` : "Sin seleccionar"} /><Fact label="Conexión" value="Según puerto activo" /><Fact label="Última actividad" value={activity[0] ? time(activity[0].at) : "—"} /></div><button className="primary wide"><Play size={16} />Continuar sesión</button></Card><Card title="¿Qué guarda una sesión?" className="what"><p>Una sesión limpia inicia sin dispositivos, lecturas ni tráfico precargado.</p><ul><li>Conexiones y dispositivos detectados</li><li>Registros leídos y valores configurados</li><li>Pruebas ejecutadas y resultados</li><li>Tráfico Modbus capturado</li><li>Notas y observaciones del diagnóstico</li></ul></Card><Card title="Sesiones recientes" className="sessionlist"><Empty text="Sin sesiones recientes cargadas en este MVP limpio." /></Card><Card title="Resumen de la sesión actual" className="sumsession"><div className="tiles"><Tile icon={Network} label="Dispositivos" value={String(devices.length)} note="Detectados" /><Tile icon={FileText} label="Registros leídos" value={String(activity.filter((item) => item.fn !== "SYS").length)} note="En total" /><Tile icon={FlaskConical} label="Pruebas" value="0/0" note="Pendientes" /><Tile icon={Activity} label="Tráfico capturado" value="0 KB" note="Limpio" /><Tile icon={FileText} label="Notas" value="0" note="Guardadas" /><Tile icon={AlertTriangle} label="Errores" value="0" note="Detectados" /></div></Card><Card title="Actividad reciente" className="timeline"><ol>{activity.length === 0 ? <li>Sin actividad todavía.</li> : activity.slice(0, 4).map((item) => <li key={item.id}>{time(item.at)} {item.label}</li>)}</ol></Card></div>; }
function TestsView({ tests, runTests, busy }: { tests: TestRow[]; runTests: () => void; busy: boolean }) { const passed = tests.filter((item) => item.result === "Aprobado").length; const failed = tests.filter((item) => !["Aprobado", "Pendiente"].includes(item.result)).length; return <div className="tests grid"><Card title="Plan de pruebas al slave" className="plan" action={<div><button className="primary" onClick={runTests}><Play size={15} />{busy ? "Ejecutando" : "Iniciar prueba"}</button><button><Square size={14} />Detener</button></div>}><p>PC como Master</p><div className="tableactions"><button>+ Agregar paso</button><button><Save size={15} />Guardar plan</button></div><Table columns={["Activo", "Paso", "Slave", "Función", "Dirección", "Cantidad/Valor", "Esperado", "Timeout", "Resultado"]} rows={tests.map((item) => [item.enabled ? "✓" : "", item.step, <SelectChip text={item.device} />, <SelectChip text={item.label} />, item.address, item.amount, item.expected, `${item.timeout} ms`, <Status status={item.result} />])} /><p className="note"><Info size={15} />El PC actuará como Master ejecutando esta secuencia de comandos hacia los slaves seleccionados.</p></Card><Card title="Escenarios" className="scenarios"><Scenario label="Operación normal" text="Verifica lectura y escritura correcta." ok /><Scenario label="Timeout detectado" text="Simula dispositivos no disponibles." warn /><Scenario label="Error CRC detectado" text="Introduce errores de CRC en la trama." warn /><Scenario label="Excepción Modbus" text="Forza códigos de excepción (01, 02, 03)." danger /><button className="ghost">Gestionar escenarios</button></Card><Card title="Simulador slave (PC como slave)" className="sim"><Field label="Estado" value="Detenido" /><Field label="Dirección slave" value="1" suffix="(1–247)" /><Field label="Puerto" value="COM3" select /><Field label="Baud Rate" value="115200" select /><button className="purple"><Play size={15} />Iniciar simulador slave</button><button><Settings size={15} /></button></Card><div className="testkpis"><Big label="Tasa de éxito" value={tests.length ? `${Math.round((passed / tests.length) * 100)}%` : "0%"} note="Última ejecución" /><Big label="Latencia promedio" value="—" note="Limpia" /><Big label="Errores" value={String(failed)} note="Última ejecución" danger /><Big label="Pasos completados" value={`${passed}/${tests.length}`} note="Última ejecución" /></div><Card title="Registro de ejecución" className="exec"><Table columns={["Hora", "Paso", "Slave", "Función", "Dirección", "Cantidad/Valor", "Resultado", "Tiempo", "Detalle"]} rows={tests.map((item) => ["—", item.step, item.device, item.label, item.address, item.amount, <Status status={item.result} />, "—", item.result === "Pendiente" ? "Pendiente de ejecución." : "Ejecutado."])} /></Card></div>; }
function RegistersView(props: { activeDevice: Device | null; rFn: Fn; setRFn: (value: Fn) => void; rAddr: number; setRAddr: (value: number) => void; rQty: number; setRQty: (value: number) => void; regs: RegisterRow[]; selectedRegister: RegisterRow | null; setSelectedRegister: (value: RegisterRow) => void; registerRead: () => void; activity: ActivityRow[] }) { const selected = props.selectedRegister; return <div className="registers grid"><header><Dot /><h1>Slave activo: <span>{props.activeDevice ? `${props.activeDevice.name} — ID ${props.activeDevice.id}` : "Sin seleccionar"}</span></h1><p><Info size={15} />Los registros se muestran en formato decimal.</p></header><section className="tabs">{["fc1", "fc2", "fc4", "fc3"].map((key) => <button key={key} className={props.rFn === key ? "active" : ""} onClick={() => props.setRFn(key as Fn)}>{key === "fc1" ? "Coils (01)" : key === "fc2" ? "Discrete Inputs (02)" : key === "fc4" ? "Input Registers (04)" : "Holding Registers (03)"}<small>{key === "fc1" || key === "fc3" ? "Lectura/Escritura" : "Solo lectura"}</small></button>)}</section><section className="regcontrols"><NumberField label="Dirección inicial" value={props.rAddr} onChange={props.setRAddr} /><span>({hex(rawAddress(props.rFn, props.rAddr))})</span><NumberField label="Cantidad" value={props.rQty} onChange={props.setRQty} /><button className="primary" onClick={props.registerRead} disabled={!props.activeDevice}>Leer</button><label><input type="checkbox" defaultChecked /> Autolectura</label><Field label="Intervalo" value="1 s" select /><button>Detener</button></section><Card title="Mapa de registros" className="regtable" action={<button className="ghost"><Pencil size={15} />Editar mapa</button>}>{props.regs.length === 0 ? <Empty text="Sin registros leídos todavía." /> : <Table columns={["Dirección", "Nombre", "Valor", "Tipo", "Acceso", "Estado"]} rows={props.regs.map((row) => [<button style={rowButtonStyle} onClick={() => props.setSelectedRegister(row)}>{row.address}</button>, row.name, row.value, row.type, <b className="oktext">{row.access}</b>, <Status status={row.status} />])} />}<p className="note"><Info size={15} />Nombre, Tipo, Unidad, Acceso y otros metadatos provienen del mapa de registros del slave activo y se guardan en la sesión.</p></Card><Card title="Registro seleccionado" className="selected"><h1>{selected ? `${selected.address} ${selected.name}` : "Sin selección"}</h1><div className="vals"><span>Valor actual<strong>{selected?.value ?? "—"}</strong></span><span>Tipo<strong>{selected?.type ?? "—"}</strong></span><span>Acceso<strong>{selected?.access ?? "—"}</strong></span></div><p>Tendencia (últimos 60 s)</p><div className="chart"><svg viewBox="0 0 400 120"><polyline points="0,72 25,62 50,74 75,58 100,82 125,70 150,77 175,65 200,80 225,72 250,61 275,70 300,66 325,75 350,69 375,73 400,67" /></svg></div><div className="stats"><span>Min: —</span><span>Máx: —</span><span>Prom: —</span></div></Card><Card title="Actividad reciente" className="regactivity"><Table columns={["Inicio", "Fin", "Duración", "Slave ID", "Dispositivo", "Función", "Rango", "Cantidad", "Resultado", "Tiempo de respuesta"]} rows={props.activity.slice(0, 3).map((item) => [fmt(item.at), fmt(item.at), `${item.ms} ms`, item.slave, item.device, item.label, item.range, item.qty, <Status status={item.status} />, item.ms ? `${item.ms} ms` : "—"])} /></Card></div>; }
function TrafficView({ traffic }: { traffic: TrafficRow[] }) { const ok = traffic.filter((item) => item.status === "OK").length; const timeout = traffic.filter((item) => item.status === "Timeout").length; const crc = traffic.filter((item) => item.status === "CRC Error").length; const exception = traffic.filter((item) => item.status === "Excepción").length; const selected = traffic[0]; return <div className="traffic grid"><Card title="Tráfico Modbus" className="trafficmain"><p>Visualice el historial de mensajes Modbus en tiempo real.</p><div className="filters"><Field label="Protocolo" value="RTU" select /><Field label="Dispositivo" value="Todos" select /><Field label="Slave ID" value="Todos" select /><Field label="Resultado" value="Todos" select /><button className="ghost">Limpiar filtros</button></div>{traffic.length === 0 ? <Empty text="Sin tráfico capturado todavía." /> : <Table columns={["", "Hora", "Origen → Destino", "ID esclavo", "Tipo", "Función", "Resultado", "Resumen"]} rows={traffic.slice(0, 10).map((item) => [<span className={item.dir === "up" ? "up" : "down"}>{item.dir === "up" ? "↑" : "↓"}</span>, fmt(item.at), item.route, item.slave, item.type, item.fn, <Status status={item.status} />, item.summary])} />}<p className="pagination">Mostrando 1 a {Math.min(10, traffic.length)} de {traffic.length} tramas</p></Card><Card title="Detalles del mensaje seleccionado" className="tdetails"><dl><dt>Dirección</dt><dd>{selected?.slave ?? "—"}</dd><dt>Función</dt><dd>{selected?.fn ?? "—"}</dd><dt>Tipo</dt><dd>{selected?.type ?? "—"}</dd><dt>Origen → Destino</dt><dd>{selected?.route ?? "—"}</dd><dt>Resumen</dt><dd>{selected?.summary ?? "—"}</dd><dt>Tiempo</dt><dd>{selected?.ms ? `${selected.ms} ms` : "—"}</dd></dl></Card><Card title="¿Qué pasó?" className="happened"><h3><CheckCircle2 />{selected?.status === "OK" ? "La operación fue exitosa." : "Esperando tráfico."}</h3><p>{selected ? `${selected.route} ejecutó ${selected.fn}: ${selected.summary}.` : "Cuando se ejecute una lectura, aquí aparecerá la explicación."}</p><p className="tip"><Star size={16} />Consejo: Usa los filtros para enfocarte en lo que necesitas.</p></Card><Card title="Actividad de la sesión" className="tactivity"><Metric label="Mensajes OK" value={String(ok)} percent={`${pct(ok, traffic.length)}%`} ok /><Metric label="Timeouts" value={String(timeout)} percent={`${pct(timeout, traffic.length)}%`} warn /><Metric label="Errores CRC" value={String(crc)} percent={`${pct(crc, traffic.length)}%`} danger /><Metric label="Excepciones" value={String(exception)} percent={`${pct(exception, traffic.length)}%`} purple /><dl><dt>Tiempo total</dt><dd>—</dd><dt>Trama más rápida</dt><dd>—</dd><dt>Trama más lenta</dt><dd>—</dd></dl></Card></div>; }

function Card({ title, children, action, className = "" }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) { return <section className={`card ${className}`}><header><h2>{title}</h2>{action}</header>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="note"><Info size={16} />{text}</p>; }
function Table({ columns, rows }: { columns: ReactNode[]; rows: ReactNode[][] }) { return <div className="table"><div className="tr head" style={{ gridTemplateColumns: `repeat(${columns.length},minmax(0,1fr))` }}>{columns.map((column, index) => <span key={index}>{column}</span>)}</div>{rows.map((row, rowIndex) => <div className="tr" key={rowIndex} style={{ gridTemplateColumns: `repeat(${columns.length},minmax(0,1fr))` }}>{row.map((cell, cellIndex) => <span key={cellIndex}>{cell}</span>)}</div>)}</div>; }
function Field({ label, value, suffix, select }: { label: string; value: string; suffix?: string; select?: boolean }) { return <label className="field"><span>{label}</span>{select ? <select defaultValue={value}><option>{value}</option></select> : <input defaultValue={value} />}{suffix ? <small>{suffix}</small> : null}</label>; }
function NumberField({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) { return <label className="field"><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />{suffix ? <small>{suffix}</small> : null}</label>; }
function SelectField({ label, value, onChange, options, labels, empty = "Sin opciones" }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string>; empty?: string }) { const choices = options.length > 0 ? options : [""]; return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{choices.map((option) => <option key={option || empty} value={option}>{option ? labels?.[option] ?? option : empty}</option>)}</select></label>; }
function PortSelectRow({ ports, port, setPort, refreshPorts }: { ports: PortOption[]; port: string; setPort: (value: string) => void; refreshPorts: () => void }) { const options = ports.length > 0 ? ports.map((item) => item.path) : [""]; return <div className="field" style={{ gridTemplateColumns: "1fr 1.15fr 38px", alignItems: "center" }}><span>Puerto</span><select value={port} onChange={(event) => setPort(event.target.value)}>{options.map((option) => <option key={option || "empty"} value={option}>{option || "Sin puertos"}</option>)}</select><button className="ghost" onClick={refreshPorts} title="Recargar puertos" style={{ minWidth: 38, height: 34, padding: 0 }}><RefreshCw size={15} /></button></div>; }
function Tool({ icon: Icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone?: "ok" | "danger"; onClick?: () => void }) { return <button className={tone ?? ""} onClick={onClick}><Icon size={18} />{label}</button>; }
function Dot() { return <span className="dot" />; }
function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: string }) { return <article className={`kpi ${tone ?? ""}`}><b>{icon}</b><span>{label}</span><strong>{value}</strong></article>; }
function Status({ status }: { status: Status }) { const ok = status === "OK" || status === "Aprobado"; return <strong className={ok ? "okstatus" : status === "Excepción" ? "purpletext" : status === "Pendiente" ? "muted" : "badstatus"}>{ok ? <CheckCircle2 size={14} /> : status === "Pendiente" ? null : <AlertTriangle size={14} />} {status}</strong>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Tile({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) { return <article><Icon size={20} /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function SelectChip({ text }: { text: string }) { return <span className="selectchip">{text}⌄</span>; }
function Scenario({ label, text, ok, warn, danger }: { label: string; text: string; ok?: boolean; warn?: boolean; danger?: boolean }) { return <article className={danger ? "danger" : warn ? "warn" : ok ? "ok" : ""}><CheckCircle2 size={20} /><div><strong>{label}</strong><span>{text}</span></div></article>; }
function Big({ label, value, note, danger }: { label: string; value: string; note: string; danger?: boolean }) { return <article className={danger ? "big danger" : "big"}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function Metric({ label, value, percent, ok, warn, danger, purple }: { label: string; value: string; percent: string; ok?: boolean; warn?: boolean; danger?: boolean; purple?: boolean }) { return <div className={ok ? "metric ok" : warn ? "metric warn" : danger ? "metric danger" : purple ? "metric purple" : "metric"}><span>{label}</span><strong>{value}</strong><em>{percent}</em></div>; }

const rowButtonStyle = { border: 0, background: "transparent", minHeight: 0, padding: 0, justifyContent: "flex-start", color: "inherit" } as const;
function normalizePorts(rawPorts: any[]): PortOption[] { const unique = new Map<string, PortOption>(); for (const raw of rawPorts) { if (!raw?.path) continue; const hasMetadata = Boolean(raw.vendorId || raw.productId || raw.manufacturer || raw.serialNumber || raw.pnpId); const label = raw.displayName || raw.friendlyName || raw.path; unique.set(raw.path, { path: raw.path, label, hasMetadata }); } return [...unique.values()].sort((left, right) => portNumber(left.path) - portNumber(right.path)); }
function highestComPort(options: PortOption[]) { return [...options].sort((left, right) => portNumber(right.path) - portNumber(left.path))[0]; }
function portNumber(path: string) { return Number(path.match(/COM(\d+)/i)?.[1] ?? 0); }
function createDiscoveredDevice(id: number): Device { return { id, name: `Slave ID ${id}`, named: false, active: true }; }
function rawAddress(fn: Fn, address: number) { if ((fn === "fc3" || fn === "fc6") && address >= 40000) return address - 40000; if (fn === "fc4" && address >= 30000) return address - 30000; if (fn === "fc2" && address >= 10000) return address - 10000; return address; }
function displayAddress(fn: Fn, raw: number) { if (fn === "fc3") return 40000 + raw; if (fn === "fc4") return 30000 + raw; if (fn === "fc2") return 10000 + raw; return raw; }
function defaultAddress(fn: Fn) { if (fn === "fc3") return 40000; if (fn === "fc4") return 30000; return 0; }
function metaFor(fn: Fn, raw: number) { if (fn === "fc1") return { name: `Q0_${raw}`, type: "bool", access: "R/W" }; if (fn === "fc2") return { name: `I0_${raw}`, type: "bool", access: "R" }; return registerMeta[raw] ?? { name: `Reg_${displayAddress(fn, raw)}`, type: "uint16", access: fn === "fc3" ? "R/W" : "R" }; }
function buildRegisterRows(fn: Fn, start: number, values: Array<number | boolean>): RegisterRow[] { const rawStart = rawAddress(fn, start); return values.map((value, index) => { const raw = rawStart + index; const meta = metaFor(fn, raw); return { raw, address: String(displayAddress(fn, raw)), name: meta.name, value: typeof value === "boolean" ? (value ? "ON" : "OFF") : String(value), type: meta.type, access: meta.access, status: "OK" }; }); }
function withUnit(row: RegisterRow) { const meta = registerMeta[row.raw]; return meta?.unit ? `${row.name} (${meta.unit})` : row.name; }
function valuesPreview(fn: Fn, start: number, values: Array<number | boolean>) { if (values.length === 0) return "—"; const rawStart = rawAddress(fn, start); return values.slice(0, 6).map((value, index) => `${displayAddress(fn, rawStart + index)}=${typeof value === "boolean" ? (value ? "ON" : "OFF") : value}`).join(", ") + (values.length > 6 ? "…" : ""); }
function addressHelp(fn: Fn) { if (fn === "fc1") return "FC01 lee coils/salidas Q0_0–Q0_7: dirección 0–7, cantidad máx. 8."; if (fn === "fc2") return "FC02 lee entradas discretas I0_0–I0_7: dirección 0–7, cantidad máx. 8."; if (fn === "fc4") return "FC04 lee inputRegisters[0..63]: usa 30000–30063; 30000=bitmap entradas, 30001=estado salidas, 30002/30003=uptime."; return "FC03 lee holdingRegisters[0..63]: usa 40000–40063; FC06/FC16 escriben sobre ese mismo rango."; }
function hex(value: number) { return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`; }
function fmt(date: Date) { return new Intl.DateTimeFormat("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date); }
function time(date: Date) { return new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date); }
function fnLabels() { return Object.fromEntries(Object.entries(fnMap).map(([key, value]) => [key, value.label])); }
function summarize(fn: Fn, address: number, quantity: number) { return fn === "fc6" ? `Write Single Register (${address})` : `${fnMap[fn].label} (${address}–${address + quantity - 1})`; }
function responseSummary(action: any) { if (action.exception) return action.exception.exceptionName ?? "Excepción Modbus"; if (action.registerValues) return `${action.registerValues.length} registros`; if (action.values) return `${action.values.length} bits`; return "Escritura OK"; }
function pct(value: number, total: number) { return total > 0 ? Math.round((value / total) * 100) : 0; }
function createCleanTests(): TestRow[] { return [[1, 2, "Slave ID 2", "fc3", 40000, 6, "6 regs", 1000], [2, 2, "Slave ID 2", "fc4", 30000, 4, "4 regs", 1000], [3, 2, "Slave ID 2", "fc1", 0, 8, "8 coils", 1000], [4, 2, "Slave ID 2", "fc2", 0, 8, "8 inputs", 1000]].map((item) => ({ enabled: true, step: item[0] as number, slave: item[1] as number, device: item[2] as string, fn: item[3] as Fn, label: fnMap[item[3] as Fn].label, address: item[4] as number, amount: item[5] as number, expected: item[6] as string, timeout: item[7] as number, result: "Pendiente" })); }
