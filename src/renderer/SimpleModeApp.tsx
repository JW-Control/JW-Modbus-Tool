import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  Server,
  Settings,
  Square,
  Star,
  Unplug,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  TestsView as NativeTestsView,
  normalizeTestsRuntimeState,
  type TestsRunSummary,
  type TestsRuntimeState
} from "./simple-tests-consolidated.js";

function JwplcIcon({ size = 32, className = "", strokeWidth = 1.5 }: { size?: number, className?: string, strokeWidth?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main Body */}
      <rect x="2" y="4" width="20" height="16" rx="2" />
      
      {/* Top Terminals */}
      <path d="M6 4v-2 M10 4v-2 M14 4v-2 M18 4v-2" />

      {/* Bottom Terminals */}
      <path d="M4 20v2 M8 20v2 M12 20v2 M16 20v2 M20 20v2" />
      
      {/* Screen */}
      <rect x="4" y="7" width="9" height="5" rx="1" />
      
      {/* D-Pad (Arrows) */}
      <path d="M17 6v4 M15 8h4" />
      
      {/* Action Buttons */}
      <rect x="14.5" y="14" width="2" height="2" rx="0.5" />
      <rect x="18" y="14" width="2" height="2" rx="0.5" />
      
      {/* Logo abstract "J" */}
      <path d="M5 14v3h3v-2" />
    </svg>
  );
}

type View = "devices" | "sessions" | "tests" | "registers" | "traffic";
type Status = "OK" | "Aprobado" | "Error" | "Timeout" | "CRC Error" | "Excepción" | "Pendiente";
type Fn = "fc1" | "fc2" | "fc3" | "fc4" | "fc6";
type SessionState = "Limpia" | "Activa sin guardar" | "Guardada" | "Modificada";

interface Device { id: number; name: string; named: boolean; active?: boolean }
interface PortOption { path: string; label: string; hasMetadata: boolean }
interface Stats { requests: number; responses: number; errors: number; timeouts: number }
interface RegisterRow { raw: number; address: string; name: string; value: string; type: string; access: string; status: Status }
interface ActivityRow { id: number; at: Date; ms: number; slave: number | "—"; device: string; fn: string; fnKey: Fn; label: string; address: number; range: string; qty: number | "—"; values: string; rows: RegisterRow[]; status: Status }
interface TrafficRow { id: number; dir: "up" | "down"; at: Date; route: string; slave: number; type: "Petición" | "Respuesta"; fn: string; status: Status; summary: string; ms?: number }
interface TestRow { enabled: boolean; step: number; slave: number; device: string; fn: Fn; label: string; address: number; amount: number; expected: string; timeout: number; result: Status }
type TrafficAction = { timestamp?: string; unitId: number; elapsedMs?: number; registerValues?: unknown[]; values?: unknown[]; exception?: unknown };
interface StoredActivityRow extends Omit<ActivityRow, "at"> { at: string }
interface StoredTrafficRow extends Omit<TrafficRow, "at"> { at: string }
type TestExecutionHistoryEntry = Record<string, unknown> & {
  key?: string;
  status?: string;
  completedAt?: string;
  startedAt?: string;
};
interface SessionDocument {
  format: "jwmodbus-session";
  version: 1;
  session: { id: string; name: string; createdAt: string; updatedAt: string; status: SessionState; notes: string };
  connection: { protocol: "RTU"; port: string; baudRate: number; dataBits: number; parity: string; stopBits: number; timeoutMs: number };
  devices: Device[];
  activeSlaveId: number | null;
  stats: Stats;
  quickReads: RegisterRow[];
  registerSnapshot: RegisterRow[];
  activity: StoredActivityRow[];
  traffic: StoredTrafficRow[];
  tests: TestRow[];
  testsRuntime?: TestsRuntimeState | null;
  testsExecutionHistory?: TestExecutionHistoryEntry[];
  testsExecutionHistoryUpdatedAt?: string | null;
  registerMaps: unknown[];
  templates: unknown[];
}
interface RecentSession { id: string; name: string; savedAt: string; filePath: string; devices: number; registers: number; tests: string; errors: number; status: SessionState }

const RECENT_SESSION_STORAGE_KEY = "jw-modbus-tool.simple.recent-sessions.v1";
const LAST_SERIAL_PORT_STORAGE_KEY = "jw-modbus-tool.simple.last-serial-port.v1";
const TESTS_EXECUTION_HISTORY_STORAGE_KEY = "jw-modbus-tool.simple.tests-execution-history.v1";

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
  const [port, setPort] = useState(() => loadStoredSerialPort());
  const [baud, setBaud] = useState(9600);
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
  const [rAutoRead, setRAutoRead] = useState(false);
  const [rInterval, setRInterval] = useState(1000);
  const [regs, setRegs] = useState<RegisterRow[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<RegisterRow | null>(null);
  const registerReadInFlight = useRef(false);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [traffic, setTraffic] = useState<TrafficRow[]>([]);
  const [stats, setStats] = useState<Stats>({ requests: 0, responses: 0, errors: 0, timeouts: 0 });
  const [tests, setTests] = useState<TestRow[]>(createCleanTests());
  const [testsRuntime, setTestsRuntime] = useState<TestsRuntimeState | null>(null);
  const [testsExecutionHistory, setTestsExecutionHistory] = useState<TestExecutionHistoryEntry[]>(() => loadStoredTestsExecutionHistory());
  const [testsResetKey, setTestsResetKey] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreatedAt, setSessionCreatedAt] = useState(() => new Date().toISOString());
  const [sessionName, setSessionName] = useState("Nueva_sesion_Modbus");
  const [sessionFilePath, setSessionFilePath] = useState<string | null>(null);
  const [lastSavedSignature, setLastSavedSignature] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [notes, setNotes] = useState("");

  const activeDevice = useMemo(
    () => (activeId === null ? null : devices.find((device) => device.id === activeId) ?? null),
    [activeId, devices]
  );
  const currentSignature = useMemo(() => signatureFromState({ sessionName, port, baud, dataBits, parity, stopBits, timeout, devices, activeId, stats, quick, regs, activity, traffic, tests, testsRuntime, testsExecutionHistory, notes }), [sessionName, port, baud, dataBits, parity, stopBits, timeout, devices, activeId, stats, quick, regs, activity, traffic, tests, testsRuntime, testsExecutionHistory, notes]);
  const sessionState = useMemo<SessionState>(() => {
    const isClean = devices.length === 0 && activity.length === 0 && stats.requests === 0 && testsExecutionHistory.length === 0 && notes.trim().length === 0;
    if (isClean) return "Limpia";
    if (!sessionFilePath) return "Activa sin guardar";
    return lastSavedSignature === currentSignature ? "Guardada" : "Modificada";
  }, [activity.length, currentSignature, devices.length, lastSavedSignature, notes, sessionFilePath, stats.requests, testsExecutionHistory.length]);

  useEffect(() => { void initBackend(); }, []);
  useEffect(() => { setRecentSessions(loadStoredRecentSessions()); }, []);
  useEffect(() => {
    const syncHistory = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setTestsExecutionHistory(normalizeTestsExecutionHistory(detail));
    };

    window.addEventListener("jw-simple-tests-history-updated", syncHistory);
    return () => window.removeEventListener("jw-simple-tests-history-updated", syncHistory);
  }, []);
  useEffect(() => { storeLastSerialPort(port); }, [port]);
  useEffect(() => { if (!selectedRegister && regs.length > 0) setSelectedRegister(regs[0]); }, [regs, selectedRegister]);

  useEffect(() => {
    setQQty(qFn === "fc1" || qFn === "fc2" ? 8 : 6);
    setQuick([]);
  }, [qFn]);
  useEffect(() => {
    if (!rAutoRead || view !== "registers" || activeId === null || !connected) return;
    let cancelled = false;
    const tick = async () => {
      if (registerReadInFlight.current) return;
      registerReadInFlight.current = true;
      try {
        await registerRead(false);
      } finally {
        registerReadInFlight.current = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => { if (!cancelled) void tick(); }, Math.max(250, rInterval));
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [rAutoRead, rInterval, view, connected, activeId, rFn, rAddr, rQty, timeout]);

  async function initBackend() {
    if (!bridge) return;
    const [portResult, stateResult] = await Promise.all([bridge.serial.listPorts(), bridge.serial.getConnectionState()]);
    const state = stateResult.ok ? stateResult.value : null;
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
    if (portResult.ok) setVisiblePorts(portResult.value as unknown as Array<Record<string, unknown>>, currentPath);
  }

  function setVisiblePorts(rawPorts: Array<Record<string, unknown>>, preferred = port) {
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
      const stored = loadStoredSerialPort();
      const candidate = [preferred, current, stored].find((value) => value && visible.some((item) => item.path === value));
      return candidate || visible[0]?.path || "";
    });
  }

  async function refreshPorts() {
    if (!bridge) return setMessage("Backend Electron no disponible.");
    setBusy(true);
    const result = await bridge.serial.listPorts();
    setBusy(false);
    if (!result.ok) return setMessage(result.error);
    setVisiblePorts(result.value as unknown as Array<Record<string, unknown>>, port);
    setMessage("Lista de puertos actualizada. Se muestran puertos USB/activos para evitar COM residuales.");
  }

  async function connect() {
    if (!bridge) return setMessage("Backend Electron no disponible.");
    if (!port) return setMessage("No hay puerto seleccionado. Recarga la lista de puertos.");
    setBusy(true);
    const result = await bridge.serial.open({ path: port, baudRate: baud, dataBits: dataBits === 7 ? 7 : 8, parity: parity as "none" | "even" | "odd", stopBits: stopBits === 2 ? 2 : 1 });
    setBusy(false);
    if (!result.ok) {
      setConnected(false);
      setMessage(result.error);
      return;
    }
    setConnected(Boolean(result.value.connected));
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

  function newSession() {
    setSessionId(null);
    setSessionCreatedAt(new Date().toISOString());
    setSessionName("Nueva_sesion_Modbus");
    setSessionFilePath(null);
    setLastSavedSignature(null);
    setNotes("");
    setDevices([]);
    setActiveId(null);
    setLastScan(null);
    setQuick([]);
    setRegs([]);
    setSelectedRegister(null);
    setActivity([]);
    setTraffic([]);
    setStats({ requests: 0, responses: 0, errors: 0, timeouts: 0 });
    setTests(createCleanTests());
    setTestsRuntime(null);
    setTestsExecutionHistory(replaceStoredTestsExecutionHistory([]));
    setTestsResetKey((value) => value + 1);
    setMessage("Nueva sesión limpia creada. Conecta, escanea y lee para generar datos reales.");
  }

  async function saveSession() { await saveSessionToFile(false); }
  async function saveSessionAs() { await saveSessionToFile(true); }

  async function saveSessionToFile(forceDialog: boolean) {
    if (!bridge?.sessions) return setMessage("Backend de sesiones no disponible.");
    const id = sessionId ?? `session-${Date.now()}`;
    const document = createSessionDocument(id, sessionState);
    setBusy(true);
    const result = await bridge.sessions.saveFile({ filePath: forceDialog ? null : sessionFilePath, defaultFileName: `${document.session.name}.jwmodbus-session`, data: document });
    setBusy(false);
    if (!result.ok) return setMessage(result.error);
    if (result.value.canceled || !result.value.filePath) return setMessage("Guardado cancelado.");
    setSessionId(id);
    setSessionFilePath(result.value.filePath);
    setLastSavedSignature(currentSignature);
    upsertRecent(document, result.value.filePath, "Guardada");
    setMessage(`Sesión guardada: ${document.session.name}.`);
  }

  async function openSessionFile(filePath?: string) {
    if (!bridge?.sessions) return setMessage("Backend de sesiones no disponible.");
    setBusy(true);
    const result = await bridge.sessions.openFile(filePath ? { filePath } : undefined);
    setBusy(false);
    if (!result.ok) return setMessage(result.error);
    if (result.value.canceled || !result.value.data || !result.value.filePath) return setMessage("Apertura cancelada.");
    const document = normalizeSessionDocument(result.value.data);
    if (!document) return setMessage("El archivo seleccionado no es una sesión JW Modbus válida.");
    applySessionDocument(document, result.value.filePath);
    upsertRecent(document, result.value.filePath, "Guardada");
  }

  function createSessionDocument(id: string, status: SessionState): SessionDocument {
    const now = new Date().toISOString();
    const history = loadStoredTestsExecutionHistory();
    return {
      format: "jwmodbus-session",
      version: 1,
      session: { id, name: sessionName.trim() || "Nueva_sesion_Modbus", createdAt: sessionCreatedAt, updatedAt: now, status, notes },
      connection: { protocol: "RTU", port, baudRate: baud, dataBits, parity, stopBits, timeoutMs: timeout },
      devices,
      activeSlaveId: activeId,
      stats,
      quickReads: quick,
      registerSnapshot: regs,
      activity: activity.map((item) => ({ ...item, at: item.at.toISOString() })),
      traffic: traffic.map((item) => ({ ...item, at: item.at.toISOString() })),
      tests,
      testsRuntime,
      testsExecutionHistory: history,
      testsExecutionHistoryUpdatedAt: history.length ? now : null,
      registerMaps: [],
      templates: []
    };
  }

  function applySessionDocument(document: SessionDocument, filePath: string) {
    setSessionId(document.session.id);
    setSessionCreatedAt(document.session.createdAt);
    setSessionName(document.session.name);
    setSessionFilePath(filePath);
    setNotes(document.session.notes ?? "");
    setPort(document.connection.port);
    setBaud(document.connection.baudRate);
    setDataBits(document.connection.dataBits);
    setParity(document.connection.parity);
    setStopBits(document.connection.stopBits);
    setTimeoutMs(document.connection.timeoutMs);
    setDevices(document.devices ?? []);
    setActiveId(document.activeSlaveId ?? null);
    setStats(document.stats ?? { requests: 0, responses: 0, errors: 0, timeouts: 0 });
    setQuick(document.quickReads ?? []);
    setRegs(document.registerSnapshot ?? []);
    setSelectedRegister(document.registerSnapshot?.[0] ?? null);
    setActivity((document.activity ?? []).map((item) => ({ ...item, at: new Date(item.at) })));
    setTraffic((document.traffic ?? []).map((item) => ({ ...item, at: new Date(item.at) })));
    setTests(document.tests ?? createCleanTests());
    setTestsRuntime(normalizeTestsRuntimeState(document.testsRuntime, document.activeSlaveId ?? 2));
    const restoredHistory = replaceStoredTestsExecutionHistory(document.testsExecutionHistory ?? []);
    setTestsExecutionHistory(restoredHistory);
    setTestsResetKey((value) => value + 1);
    setLastSavedSignature(signatureFromDocument(document));
    setMessage(`Sesión abierta: ${document.session.name}.`);
    setView("sessions");
  }

  function upsertRecent(document: SessionDocument, filePath: string, status: SessionState) {
    const recent = createRecentSession(document, filePath, status);
    setRecentSessions((current) => {
      const next = [recent, ...current.filter((item) => item.filePath !== filePath)].slice(0, 12);
      storeRecentSessions(next);
      return next;
    });
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
        const action = result.value as { registerValues?: Array<number | boolean> };
        const values = action.registerValues ?? [];
        const rows = buildRegisterRows("fc3", 40000, values);
        pushActivity({ ms: Date.now() - started, slave: id, device: device.name, fn: "FC03", fnKey: "fc3", label: "Escaneo detectó respuesta", address: 40000, range: "40000 / 1 reg", qty: 1, values: valuesPreview("fc3", 40000, values), rows, status: "OK" });
      }
      
      // Añadir Turnaround Delay entre escaneos para evitar colisiones RS485
      await new Promise(r => setTimeout(r, 60));
    }
    setStats((current) => ({ ...current, requests: current.requests + scanRange.length, responses: current.responses + found.length }));
    setDevices(found.map((device, index) => ({ ...device, active: index === 0 })));
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
    const action = result.value as { exception?: unknown; crcOk?: boolean; registerValues?: Array<number | boolean>; values?: Array<number | boolean>; elapsedMs?: number; timestamp?: string; unitId: number };
    const status: Status = action.exception ? "Excepción" : action.crcOk !== false ? "OK" : "CRC Error";
    const values = action.registerValues ?? action.values ?? [];
    const rows = buildRegisterRows(fn, displayAddress, values);
    setStats((current) => ({ ...current, responses: current.responses + (status === "OK" ? 1 : 0), errors: current.errors + (status === "OK" ? 0 : 1) }));
    pushTrafficAction(action, fn, displayNameFor(unitId), displayAddress, quantity, status);
    pushActivity({ ms: action.elapsedMs ?? Date.now() - started.getTime(), slave: unitId, device: displayNameFor(unitId), fn: fnMap[fn].short, fnKey: fn, label: fnMap[fn].label, address: displayAddress, range: `${displayAddress} / ${quantity} ${fn === "fc1" || fn === "fc2" ? "bits" : "regs"}`, qty: quantity, values: valuesPreview(fn, displayAddress, values), rows, status });
    return { values, rows, action };
  }

  async function quickRead(showBusy = true) {
    if (activeId === null) {
      if (showBusy) setMessage("Primero escanea y selecciona un slave activo.");
      return;
    }
    if (showBusy) setBusy(true);
    const result = await readRegisters(qFn, activeId, qAddr, qQty);
    if (showBusy) setBusy(false);
    if (!result) return;
    setQuick(result.rows);
    if (showBusy) setMessage(`${result.values.length} valor(es) leídos desde ${qAddr}.`);
  }

  async function registerRead(showBusy = true) {
    if (activeId === null) return setMessage("Primero escanea y selecciona un slave activo.");
    if (showBusy) setBusy(true);
    const result = await readRegisters(rFn, activeId, rAddr, rQty);
    if (showBusy) setBusy(false);
    if (!result) return;
    setRegs(result.rows);
    setSelectedRegister(result.rows[0] ?? null);
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
          const action = result.value as { exception?: unknown; unitId: number; elapsedMs?: number; timestamp?: string };
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
      // Añadir un pequeño retraso entre peticiones Modbus para dar tiempo a que los esclavos
      // liberen el bus RS485 (Turnaround delay) y evitar colisiones de hardware.
      await new Promise(r => setTimeout(r, 60));
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
  function renameDevice(id: number, name: string) {
    setDevices((current) => current.map((device) => device.id === id ? { ...device, name, named: true } : device));
  }
  function pushActivity(row: Omit<ActivityRow, "id" | "at">) { setActivity((current) => [{ id: rowId++, at: new Date(), ...row }, ...current].slice(0, 30)); }
  function pushTrafficAction(action: TrafficAction, fn: Fn, device: string, address: number, quantity: number, status: Status) {
    const at = action.timestamp ? new Date(action.timestamp) : new Date();
    const request: TrafficRow = { id: rowId++, dir: "up", at, route: `PC Master → ${device}`, slave: action.unitId, type: "Petición", fn: fnMap[fn].short, status, summary: summarize(fn, address, quantity), ms: action.elapsedMs };
    const response: TrafficRow = { id: rowId++, dir: "down", at, route: `${device} → PC Master`, slave: action.unitId, type: "Respuesta", fn: fnMap[fn].short, status, summary: responseSummary(action), ms: action.elapsedMs };
    setTraffic((current) => [request, response, ...current].slice(0, 80));
  }
  function pushTrafficError(fn: Fn, unitId: number, device: string, error: string, at: Date, status: Status) {
    const request: TrafficRow = { id: rowId++, dir: "up", at, route: `PC Master → ${device}`, slave: unitId, type: "Petición", fn: fnMap[fn].short, status, summary: error };
    setTraffic((current) => [request, ...current].slice(0, 80));
  }
  function displayNameFor(id: number) { return devices.find((device) => device.id === id)?.name ?? `Slave ID ${id}`; }

  return <main className="shell"><header className="toolbar"><div className="brand"><span>JW</span><div><strong>JW Modbus Tool</strong><em>Modo sencillo</em></div></div><div className="toolbar-actions"><Tool icon={FileText} label="Nuevo" onClick={newSession} /><Tool icon={FolderOpen} label="Abrir" onClick={() => void openSessionFile()} /><Tool icon={Save} label="Guardar" onClick={saveSession} /><i /><Tool icon={Plug} label="Conectar" tone="ok" onClick={connect} /><Tool icon={Unplug} label="Desconectar" tone="danger" onClick={disconnect} /><i /><Tool icon={Search} label="Escanear" onClick={scanDevices} /></div><div className="window-buttons"><span>{busy ? "Procesando…" : "Ayuda"}</span><button>—</button><button>□</button><button>×</button></div></header><div className="body"><aside className="sidebar"><nav>{nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><item.icon size={21} />{item.label}</button>)}</nav><div className="helper"><Info size={18} /><strong>¿Cómo funciona?</strong><p>{message}</p></div><div className="license"><Dot />Licencia: Profesional<br /><small>Versión 1.3.0 (64-bit)</small></div></aside><section className="workspace">{view === "devices" && <DevicesView {...{ ports, port, setPort, refreshPorts, baud, setBaud, dataBits, setDataBits, parity, setParity, stopBits, setStopBits, timeout, setTimeoutMs, connected, devices, activeId, activeDevice, selectDevice, scanDevices, lastScan, stats, qFn, setQFn, qAddr, setQAddr, qQty, setQQty, quick, quickRead, activity, connect, disconnect, clearActivity: () => setActivity([]) }} />}{view === "sessions" && <SessionsView {...{ sessionName, setSessionName, recentSessions, onNew: newSession, onSave: saveSession, onSaveAs: saveSessionAs, onOpen: openSessionFile, activity, devices, stats, traffic, tests, testsRuntime, connected, port, baud, dataBits, parity, stopBits, activeId, sessionId, sessionFilePath, sessionState, notes, setNotes, renameDevice }} />}{view === "tests" && <NativeTestsView activeSlaveId={activeId} port={port} baud={baud} runtimeState={testsRuntime} resetKey={testsResetKey} onRuntimeStateChange={setTestsRuntime} onMessage={setMessage} />}{view === "registers" && <RegistersView {...{ activeDevice, rFn, setRFn, rAddr, setRAddr, rQty, setRQty, rAutoRead, setRAutoRead, rInterval, setRInterval, regs, selectedRegister, setSelectedRegister, registerRead, activity }} />}{view === "traffic" && <TrafficView traffic={traffic} />}</section></div><footer className="status"><Dot /><strong>{connected ? "Conectado" : "Inactivo"}</strong><span>{port || "Sin puerto"}</span><span>{baud}</span><span>{dataBits}{parity === "none" ? "N" : parity[0].toUpperCase()}{stopBits}</span><span>Slave activo ID {activeId ?? "—"}</span><span>{sessionState}</span></footer></main>;
}

function DevicesView(props: { ports: PortOption[]; port: string; setPort: (value: string) => void; refreshPorts: () => void; baud: number; setBaud: (value: number) => void; dataBits: number; setDataBits: (value: number) => void; parity: string; setParity: (value: string) => void; stopBits: number; setStopBits: (value: number) => void; timeout: number; setTimeoutMs: (value: number) => void; connected: boolean; devices: Device[]; activeId: number | null; activeDevice: Device | null; selectDevice: (id: number) => void; scanDevices: () => void; lastScan: Date | null; stats: Stats; qFn: Fn; setQFn: (value: Fn) => void; qAddr: number; setQAddr: (value: number) => void; qQty: number; setQQty: (value: number) => void; quick: RegisterRow[]; quickRead: () => void; activity: ActivityRow[]; connect: () => void; disconnect: () => void; clearActivity: () => void }) {
  const [activityDetail, setActivityDetail] = useState<ActivityRow | null>(null);

  return (
    <div className="devices grid">
      <Card title="1. Conectar" className="connect panel-fusion" action={<Info size={15} className="hint-icon" />}>
        <div className="segmented-control">
          <button className="active">RTU</button>
          <button className="disabled">TCP</button>
        </div>
        <PortSelectRow ports={props.ports} port={props.port} setPort={props.setPort} refreshPorts={props.refreshPorts} />
        <SelectField label="Baud Rate" value={String(props.baud)} onChange={(value) => props.setBaud(Number(value))} options={["9600", "19200", "38400", "57600", "115200"]} />
        <SelectField label="Bits de datos" value={String(props.dataBits)} onChange={(value) => props.setDataBits(Number(value))} options={["8", "7"]} />
        <SelectField label="Paridad" value={props.parity} onChange={props.setParity} options={["none", "even", "odd"]} />
        <SelectField label="Bits de parada" value={String(props.stopBits)} onChange={(value) => props.setStopBits(Number(value))} options={["1", "2"]} />
        <NumberField label="Timeout (ms)" value={props.timeout} onChange={props.setTimeoutMs} />
        {props.connected ? (
          <button className="primary block-btn danger-btn" style={{marginTop: '10px'}} onClick={props.disconnect}><Unplug size={18} /> Desconectar</button>
        ) : (
          <button className="primary block-btn" style={{marginTop: '10px'}} onClick={props.connect}><Plug size={18} /> Conectar</button>
        )}
      </Card>

      <Card title="2. Dispositivos detectados" action={<button className="ghost" onClick={props.scanDevices}><RefreshCw size={15} />Recargar</button>} className="detected panel-fusion">
        {props.devices.length === 0 ? <Empty text="Sesión limpia: todavía no hay dispositivos detectados. Usa Recargar/Escanear." /> : 
        <div className="fusion-device-list">
          {props.devices.map((device) => {
            const isJWPLC = device.name.toLowerCase().includes("jwplc");
            return (
              <button key={device.id} className={`fusion-device-row ${device.id === props.activeId ? 'active' : ''}`} onClick={() => props.selectDevice(device.id)}>
                <div className="fusion-device-left">
                  {isJWPLC ? (
                    <JwplcIcon size={32} className="fusion-device-icon" />
                  ) : (
                    <Server size={32} className="fusion-device-icon" strokeWidth={1.5} />
                  )}
                  <div className="fusion-device-info">
                    <div className="fusion-device-title">
                      <strong>{device.name}</strong>
                      {device.id === props.activeId && <b className="pill active-pill">SLAVE ACTIVO</b>}
                      {!device.named && <b className="pill pend-pill">NOMBRE PEND.</b>}
                    </div>
                    <span className="fusion-device-subtitle">ID: {device.id} • RTU</span>
                  </div>
                </div>
              <div className="fusion-device-right">
                <span className="dot online"></span> En línea
              </div>
            </button>
          );
        })}
        </div>}
        <p className="note" style={{marginTop: '15px'}}><Info size={16} />Los nombres personalizados se asignarán desde la sesión o desde el mapa del dispositivo.</p>
      </Card>

      <Card title="Resumen" className="summary panel-fusion" action={
        <div className={`pill ${props.connected ? "active-pill" : ""}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
          <div className="dot" style={{ width: 10, height: 10, background: props.connected ? '#22c55e' : '#ef4444', boxShadow: props.connected ? '0 0 10px #22c55e' : '0 0 10px #ef4444', margin: 0 }}></div>
          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{props.connected ? "CONECTADO" : "DESCONECTADO"}</span>
        </div>
      }>
        <p className="helper-text">Estado general de la comunicación.</p>
        <div className="kpis">
          <Kpi icon={<Network size={16} />} label="Solicitudes" value={String(props.stats.requests)} />
          <Kpi icon={<CheckCircle2 size={16} />} label="Respuestas" value={String(props.stats.responses)} tone="ok" />
          <Kpi icon={<AlertTriangle size={16} />} label="Errores" value={String(props.stats.errors)} tone="warn" />
          <Kpi icon={<Clock3 size={16} />} label="Timeouts" value={String(props.stats.timeouts)} tone="purple" />
        </div>
        <dl>
          <dt>Dispositivos encontrados</dt><dd>{props.devices.length}</dd>
          <dt>Rango de escaneo</dt><dd>1 – 10</dd>
          <dt>Último escaneo</dt><dd>{props.lastScan ? <><Status status="OK" /><small>{fmt(props.lastScan)}</small></> : "—"}</dd>
          <dt>Rol</dt><dd><Monitor size={15} /> PC Master</dd>
        </dl>
      </Card>

      <div className="devicesLower">
        <Card title="3. Lectura rápida de registros" className="quickPanel" action={
          <span style={{ fontSize: '12.5px', color: '#8b929e' }}>Slave activo: <strong className="cyan">{props.activeDevice ? `${props.activeDevice.name} — ID ${props.activeDevice.id}` : "Sin seleccionar"}</strong></span>
        }>
          <div className="quickbar">
            <SelectField label="Función" value={props.qFn} onChange={(value) => props.setQFn(value as Fn)} options={["fc3", "fc4", "fc1", "fc2"]} labels={fnLabels()} />
            <NumberField label="Dir. inicial" value={props.qAddr} onChange={props.setQAddr} />
            <NumberField label="Cantidad" value={props.qQty} onChange={props.setQQty} />
            <button className="primary" onClick={() => props.quickRead()} disabled={!props.activeDevice}><Database size={15} />Leer</button>
          </div>
          <p className="note"><Info size={16} />{addressHelp(props.qFn)}</p>
          <div className="quickScroll">
            {props.quick.length === 0 ? <Empty text="Aún no hay lecturas. La tabla se llenará al presionar Leer." /> : <Table columns={["Dirección", "Nombre", "Valor", "Estado"]} rows={props.quick.map((row) => [row.address, withUnit(row), valueCell(row), <Status status={row.status} />])} />}
          </div>
          <p className="note"><Info size={16} />Se leerá el slave activo real; no hay datos precargados.</p>
        </Card>

        <Card title="Actividad reciente" className="recentPanel">
          {activityDetail ? <ActivityDetail row={activityDetail} onClose={() => setActivityDetail(null)} /> : props.activity.length === 0 ? <Empty text="Sin actividad todavía. Aquí aparecerán escaneos y lecturas reales." /> : 
          <div className="activityScroll">
            <Table columns={["Fecha/hora", "Duración", "Slave ID", "Función", "Dirección / cantidad", "Valor leído", "Resultado", "Info"]} rows={props.activity.map((row) => [fmt(row.at), `${row.ms} ms`, row.slave, row.fn, row.range, row.values, <Status status={row.status} />, <button className="infoButton" onClick={() => setActivityDetail(row)} title="Ver detalle de la lectura"><Info size={14} /></button>])} />
          </div>}
        </Card>
      </div>
    </div>
  );
}

function ActivityDetail({ row, onClose }: { row: ActivityRow; onClose: () => void }) { return <div className="activityDetail"><div className="activityDetailHeader"><div><strong>Detalle de lectura</strong><small>{fmt(row.at)} · {row.device}</small></div><button className="infoButton" onClick={onClose} title="Cerrar detalle"><X size={15} /></button></div><div className="detailFacts"><Fact label="Función" value={row.label} /><Fact label="Slave ID" value={String(row.slave)} /><Fact label="Dirección inicial" value={String(row.address)} /><Fact label="Cantidad" value={String(row.qty)} /><Fact label="Duración" value={`${row.ms} ms`} /><Fact label="Resultado" value={row.status} /></div><div className="detailTable"><Table columns={["Dirección", "Nombre", "Valor", "Tipo", "Acceso", "Estado"]} rows={row.rows.map((item) => [item.address, withUnit(item), valueCell(item), item.type, item.access, <Status status={item.status} />])} /></div></div>; }

function SessionsView(props: { sessionName: string; setSessionName: (value: string) => void; recentSessions: RecentSession[]; onNew: () => void; onSave: () => void; onSaveAs: () => void; onOpen: (filePath?: string) => void; activity: ActivityRow[]; devices: Device[]; stats: Stats; traffic: TrafficRow[]; tests: TestRow[]; testsRuntime: TestsRuntimeState | null; connected: boolean; port: string; baud: number; dataBits: number; parity: string; stopBits: number; activeId: number | null; sessionId: string | null; sessionFilePath: string | null; sessionState: SessionState; notes: string; setNotes: (value: string) => void; renameDevice: (id: number, name: string) => void; }) {
  const registerReads = props.activity.reduce((total, item) => total + item.rows.length, 0);
  const testSummary = sessionTestSummary(props.testsRuntime, props.tests);
  const failed = testSummary.failed;
  const testsProgress = `${testSummary.passed}/${testSummary.total}`;
  const currentName = props.sessionName.trim() || "Nueva_sesion_Modbus";
  const connectionText = props.connected && props.port ? `${props.port} · ${props.baud} · ${props.dataBits}${props.parity === "none" ? "N" : props.parity[0].toUpperCase()}${props.stopBits}` : "Sin puerto activo";
  const recent = props.recentSessions.filter((session) => session.filePath !== props.sessionFilePath);
  
  const [renameId, setRenameId] = useState<number | "">(props.devices.length > 0 ? props.devices[0].id : "");
  const [renameText, setRenameText] = useState("");
  useEffect(() => { if (props.devices.length > 0 && renameId === "") setRenameId(props.devices[0].id); }, [props.devices]);

  return <div className="sessions grid">
    <div className="top">
      <button className="primary" onClick={props.onNew}>+ Nueva sesión</button>
      <button onClick={() => props.onOpen()}><FolderOpen size={16} />Abrir sesión</button>
      <button onClick={props.onSave}><Save size={16} />Guardar</button>
      <button onClick={props.onSaveAs}><Save size={16} />Guardar como</button>
    </div>
    
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", gridRow: "2 / 3" }}>
      <Card title="Sesión actual" className="current" action={<span className="oktext">● {props.sessionState}</span>}><h1><input className="sessionNameInput" value={props.sessionName} onChange={(event) => props.setSessionName(event.target.value)} aria-label="Nombre de sesión" /> <Pencil size={15} /></h1><div className="facts"><Fact label="Rol" value="PC Master" /><Fact label="Protocolo" value="RTU" /><Fact label="Slave activo" value={props.activeId ? `${displayDeviceName(props.devices, props.activeId)} — ID ${props.activeId}` : "Sin seleccionar"} /><Fact label="Conexión" value={connectionText} /><Fact label="Última actividad" value={props.activity[0] ? time(props.activity[0].at) : "—"} /></div><button className="primary wide"><Play size={16} />Continuar sesión</button></Card>
      <Card title="Sesiones recientes" className="sessionlist"><div className="sessionRows"><SessionRow name={currentName} date={props.sessionFilePath ? shortPath(props.sessionFilePath) : "Actual"} devices={props.devices.length} registers={registerReads} tests={testsProgress} errors={props.stats.errors + failed} status={props.sessionState} action="En curso" /><>{recent.length === 0 ? <Empty text="Aún no hay sesiones guardadas. Presiona Guardar sesión para conservar la actual." /> : recent.map((session) => <SessionRow key={session.filePath} name={session.name} date={fmt(new Date(session.savedAt))} devices={session.devices} registers={session.registers} tests={session.tests} errors={session.errors} status={session.status} action="Abrir" onClick={() => props.onOpen(session.filePath)} />)}</></div></Card>
    </div>
    
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", gridRow: "1 / 3" }}>
      <Card title="Dispositivos de la sesión" className="what">
      <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>
          Selecciona un dispositivo detectado para asignarle un nombre personalizado.
        </p>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#121519", padding: "12px", borderRadius: "8px", border: "1px solid #1e293b" }}>
          <Monitor size={16} color="#0ea5e9" style={{ flexShrink: 0 }} />
          
          <select 
            style={{ flex: 1, background: "#0f172a", border: "1px solid #2a303a", color: "white", padding: "8px", borderRadius: "4px", fontSize: "13px", outline: "none" }}
            value={renameId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setRenameId(id);
              const device = props.devices.find(d => d.id === id);
              setRenameText(device ? device.name : "");
            }}
          >
            <option value="" disabled>Seleccionar slave...</option>
            {props.devices.map(d => <option key={d.id} value={d.id}>ID {d.id} - {d.name || "Sin nombre"}</option>)}
          </select>
          
          <input 
            placeholder="Ej: PLC_Principal..." 
            style={{ flex: 1, background: "#0f172a", border: "1px solid #2a303a", color: "white", padding: "8px", borderRadius: "4px", fontSize: "13px", outline: "none" }}
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameId !== "" && renameText.trim()) {
                props.renameDevice(Number(renameId), renameText.trim());
                setRenameText("");
              }
            }}
          />
          
          <button 
            className="primary" 
            style={{ padding: "8px 15px", height: "auto", minHeight: "36px", display: "flex", alignItems: "center", gap: "5px" }}
            onClick={() => {
              if(renameId !== "" && renameText.trim()){
                props.renameDevice(Number(renameId), renameText.trim());
                setRenameText("");
              }
            }}
          >
            <Save size={14} />
            Guardar
          </button>
        </div>
      </div>
    </Card>
    <Card title="Resumen de la sesión actual" className="sumsession"><div className="tiles"><Tile icon={Network} label="Dispositivos" value={String(props.devices.length)} note="Detectados" /><Tile icon={FileText} label="Registros leídos" value={String(registerReads)} note="En total" /><Tile icon={FlaskConical} label="Pruebas" value={testsProgress} note={failed ? `${failed} con error` : "Plan guardable"} /><Tile icon={Activity} label="Tráfico capturado" value={`${props.traffic.length}`} note="Tramas" /><Tile icon={FileText} label="Notas" value={props.notes.trim() ? "1" : "0"} note="Guardadas" /><Tile icon={AlertTriangle} label="Errores" value={String(props.stats.errors + failed)} note="Detectados" /></div></Card>
    <Card title="Actividad reciente" className="timeline">{props.activity.length === 0 ? <Empty text="Sin actividad todavía." /> : <div className="sessionActivityScroll"><Table columns={["#", "Fecha/hora", "Función", "Descripción", "Resultado"]} rows={props.activity.slice(0, 30).map((item, index) => [index + 1, fmt(item.at), item.fn, item.label, <Status status={item.status} />])} /></div>}</Card>
    </div>
  </div>;
}

function SessionRow({ name, date, devices, registers, tests, errors, status, action, onClick }: { name: string; date: string; devices: number; registers: number; tests: string; errors: number; status: string; action: string; onClick?: () => void }) { return <article className="sessionrow"><div><strong>{name}</strong><small>{date}</small></div><span>Dispositivos<b>{devices}</b></span><span>Registros<b>{registers}</b></span><span>Pruebas<b>{tests}</b></span><span>Errores<b>{errors}</b></span><button onClick={onClick} disabled={!onClick}>{action}</button><em>{status}</em></article>; }

function TestsView({ tests, runTests, busy }: { tests: TestRow[]; runTests: () => void; busy: boolean }) { const passed = tests.filter((item) => item.result === "Aprobado").length; const failed = tests.filter((item) => !["Aprobado", "Pendiente"].includes(item.result)).length; return <div className="tests grid"><Card title="Plan de pruebas al slave" className="plan" action={<div><button className="primary" onClick={runTests}><Play size={15} />{busy ? "Ejecutando" : "Iniciar prueba"}</button><button><Square size={14} />Detener</button></div>}><p>PC como Master</p><div className="tableactions"><button>+ Agregar paso</button><button><Save size={15} />Guardar plan</button></div><Table columns={["Activo", "Paso", "Slave", "Función", "Dirección", "Cantidad/Valor", "Esperado", "Timeout", "Resultado"]} rows={tests.map((item) => [item.enabled ? "✓" : "", item.step, <SelectChip text={item.device} />, <SelectChip text={item.label} />, item.address, item.amount, item.expected, `${item.timeout} ms`, <Status status={item.result} />])} /><p className="note"><Info size={15} />El PC actuará como Master ejecutando esta secuencia de comandos hacia los slaves seleccionados.</p></Card><Card title="Escenarios" className="scenarios"><Scenario label="Operación normal" text="Verifica lectura y escritura correcta." ok /><Scenario label="Timeout detectado" text="Simula dispositivos no disponibles." warn /><Scenario label="Error CRC detectado" text="Introduce errores de CRC en la trama." warn /><Scenario label="Excepción Modbus" text="Forza códigos de excepción (01, 02, 03)." danger /><button className="ghost">Gestionar escenarios</button></Card><Card title="Simulador slave (PC como slave)" className="sim"><Field label="Estado" value="Detenido" /><Field label="Dirección slave" value="1" suffix="(1–247)" /><Field label="Puerto" value="COM3" select /><Field label="Baud Rate" value="115200" select /><button className="purple"><Play size={15} />Iniciar simulador slave</button><button><Settings size={15} /></button></Card><div className="testkpis"><Big label="Tasa de éxito" value={tests.length ? `${Math.round((passed / tests.length) * 100)}%` : "0%"} note="Última ejecución" /><Big label="Latencia promedio" value="—" note="Limpia" /><Big label="Errores" value={String(failed)} note="Última ejecución" danger /><Big label="Pasos completados" value={`${passed}/${tests.length}`} note="Última ejecución" /></div><Card title="Registro de ejecución" className="exec"><Table columns={["Hora", "Paso", "Slave", "Función", "Dirección", "Cantidad/Valor", "Resultado", "Tiempo", "Detalle"]} rows={tests.map((item) => ["—", item.step, item.device, item.label, item.address, item.amount, <Status status={item.result} />, "—", item.result === "Pendiente" ? "Pendiente de ejecución." : "Ejecutado."])} /></Card></div>; }
function RegistersView(props: {
  activeDevice: Device | null;
  rFn: Fn;
  setRFn: (value: Fn) => void;
  rAddr: number;
  setRAddr: (value: number) => void;
  rQty: number;
  setRQty: (value: number) => void;
  rAutoRead: boolean;
  setRAutoRead: (value: boolean) => void;
  rInterval: number;
  setRInterval: (value: number) => void;
  regs: RegisterRow[];
  selectedRegister: RegisterRow | null;
  setSelectedRegister: (value: RegisterRow) => void;
  registerRead: (showBusy?: boolean) => void | Promise<void>;
  activity: ActivityRow[];
}) {
  const selected = props.selectedRegister;
  const selectedStats = registerValueStats(props.regs, selected);
  return (
    <div className="registers grid">
      <header>
        <Dot />
        <h1>Slave activo: <span>{props.activeDevice ? `${props.activeDevice.name} — ID ${props.activeDevice.id}` : "Sin seleccionar"}</span></h1>
        <p><Info size={15} />Los registros se muestran en formato decimal.</p>
      </header>
      <section className="tabs">
        {["fc1", "fc2", "fc4", "fc3"].map((key) => (
          <button key={key} className={props.rFn === key ? "active" : ""} onClick={() => props.setRFn(key as Fn)}>
            {key === "fc1" ? "Coils (01)" : key === "fc2" ? "Discrete Inputs (02)" : key === "fc4" ? "Input Registers (04)" : "Holding Registers (03)"}
            <small>{key === "fc1" || key === "fc3" ? "Lectura/Escritura" : "Solo lectura"}</small>
          </button>
        ))}
      </section>
      <section className="regcontrols">
        <NumberField label="Dirección inicial" value={props.rAddr} onChange={props.setRAddr} />
        <span>({hex(rawAddress(props.rFn, props.rAddr))})</span>
        <NumberField label="Cantidad" value={props.rQty} onChange={props.setRQty} />
        <button className="primary" onClick={() => void props.registerRead()} disabled={!props.activeDevice}>Leer</button>
        <label className="inlineCheck">
          <input type="checkbox" checked={props.rAutoRead} onChange={(event) => props.setRAutoRead(event.target.checked)} disabled={!props.activeDevice} />
          Autolectura
        </label>
        <SelectField
          label="Intervalo"
          value={String(props.rInterval)}
          onChange={(value) => props.setRInterval(Number(value))}
          options={["500", "1000", "2000", "5000"]}
          labels={{ "500": "0.5 s", "1000": "1 s", "2000": "2 s", "5000": "5 s" }}
        />
        <button onClick={() => props.setRAutoRead(false)} disabled={!props.rAutoRead}>Detener</button>
      </section>
      <Card title="Mapa de registros" className="regtable" action={<button className="ghost"><Pencil size={15} />Editar mapa</button>}>
        {props.regs.length === 0 ? <Empty text="Sin registros leídos todavía." /> : (
          <Table
            columns={["Dirección", "Nombre", "Valor", "Tipo", "Acceso", "Estado"]}
            rows={props.regs.map((row) => [
              <button style={rowButtonStyle} onClick={() => props.setSelectedRegister(row)}><AddressCell row={row} /></button>,
              row.name,
              valueCell(row),
              row.type,
              <b className="oktext">{row.access}</b>,
              <Status status={row.status} />,
            ])}
          />
        )}
        <p className="note"><Info size={15} />Nombre, Tipo, Unidad, Acceso y otros metadatos provienen del mapa de registros del slave activo y se guardan en la sesión.</p>
      </Card>
      <Card title="Registro seleccionado" className="selected">
        <h1>{selected ? <><span className="selectedAddress">{selected.address} <small>({hex(Number(selected.address))})</small></span>{selected.name}</> : "Sin selección"}</h1>
        <div className="vals">
          <span>Valor actual<strong>{selected?.value ?? "—"}</strong></span>
          <span>Tipo<strong>{selected?.type ?? "—"}</strong></span>
          <span>Acceso<strong>{selected?.access ?? "—"}</strong></span>
        </div>
        <p>Tendencia (últimos 60 s)</p>
        <div className="chart"><svg viewBox="0 0 400 120"><polyline points="0,72 25,62 50,74 75,58 100,82 125,70 150,77 175,65 200,80 225,72 250,61 275,70 300,66 325,75 350,69 375,73 400,67" /></svg></div>
        <div className="stats"><span>Min: {selectedStats.min}</span><span>Máx: {selectedStats.max}</span><span>Prom: {selectedStats.avg}</span></div>
      </Card>
      <Card title="Actividad reciente" className="regactivity">
        <Table
          columns={["Inicio", "Fin", "Duración", "Slave ID", "Dispositivo", "Función", "Rango", "Cantidad", "Resultado", "Tiempo de respuesta"]}
          rows={props.activity.slice(0, 3).map((item) => [fmt(item.at), fmt(item.at), `${item.ms} ms`, item.slave, item.device, item.label, item.range, item.qty, <Status status={item.status} />, item.ms ? `${item.ms} ms` : "—"])}
        />
      </Card>
    </div>
  );
}
function TrafficView({ traffic }: { traffic: TrafficRow[] }) { const ok = traffic.filter((item) => item.status === "OK").length; const timeout = traffic.filter((item) => item.status === "Timeout").length; const crc = traffic.filter((item) => item.status === "CRC Error").length; const exception = traffic.filter((item) => item.status === "Excepción").length; const selected = traffic[0]; return <div className="traffic grid"><Card title="Tráfico Modbus" className="trafficmain"><p>Visualice el historial de mensajes Modbus en tiempo real.</p><div className="filters"><Field label="Protocolo" value="RTU" select /><Field label="Dispositivo" value="Todos" select /><Field label="Slave ID" value="Todos" select /><Field label="Resultado" value="Todos" select /><button className="ghost">Limpiar filtros</button></div>{traffic.length === 0 ? <Empty text="Sin tráfico capturado todavía." /> : <Table columns={["", "Hora", "Origen → Destino", "ID esclavo", "Tipo", "Función", "Resultado", "Resumen"]} rows={traffic.slice(0, 10).map((item) => [<span className={item.dir === "up" ? "up" : "down"}>{item.dir === "up" ? "↑" : "↓"}</span>, fmt(item.at), item.route, item.slave, item.type, item.fn, <Status status={item.status} />, item.summary])} />}<p className="pagination">Mostrando 1 a {Math.min(10, traffic.length)} de {traffic.length} tramas</p></Card><Card title="Detalles del mensaje seleccionado" className="tdetails"><dl><dt>Dirección</dt><dd>{selected?.slave ?? "—"}</dd><dt>Función</dt><dd>{selected?.fn ?? "—"}</dd><dt>Tipo</dt><dd>{selected?.type ?? "—"}</dd><dt>Origen → Destino</dt><dd>{selected?.route ?? "—"}</dd><dt>Resumen</dt><dd>{selected?.summary ?? "—"}</dd><dt>Tiempo</dt><dd>{selected?.ms ? `${selected.ms} ms` : "—"}</dd></dl></Card><Card title="¿Qué pasó?" className="happened"><h3><CheckCircle2 />{selected?.status === "OK" ? "La operación fue exitosa." : "Esperando tráfico."}</h3><p>{selected ? `${selected.route} ejecutó ${selected.fn}: ${selected.summary}.` : "Cuando se ejecute una lectura, aquí aparecerá la explicación."}</p><p className="tip"><Star size={16} />Consejo: Usa los filtros para enfocarte en lo que necesitas.</p></Card><Card title="Actividad de la sesión" className="tactivity"><Metric label="Mensajes OK" value={String(ok)} percent={`${pct(ok, traffic.length)}%`} ok /><Metric label="Timeouts" value={String(timeout)} percent={`${pct(timeout, traffic.length)}%`} warn /><Metric label="Errores CRC" value={String(crc)} percent={`${pct(crc, traffic.length)}%`} danger /><Metric label="Excepciones" value={String(exception)} percent={`${pct(exception, traffic.length)}%`} purple /><dl><dt>Tiempo total</dt><dd>—</dd><dt>Trama más rápida</dt><dd>—</dd><dt>Trama más lenta</dt><dd>—</dd></dl></Card></div>; }

function Card({ title, children, action, className = "", style }: { title: string; children: ReactNode; action?: ReactNode; className?: string; style?: React.CSSProperties }) { return <section className={`card ${className}`} style={style}><header><h2>{title}</h2>{action}</header>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="note"><Info size={16} />{text}</p>; }
function Table({ columns, rows }: { columns: ReactNode[]; rows: ReactNode[][] }) { return <div className="table"><div className="tr head" style={{ gridTemplateColumns: `repeat(${columns.length},minmax(0,1fr))` }}>{columns.map((column, index) => <span key={index}>{column}</span>)}</div>{rows.map((row, rowIndex) => <div className="tr" key={rowIndex} style={{ gridTemplateColumns: `repeat(${columns.length},minmax(0,1fr))` }}>{row.map((cell, cellIndex) => <span key={cellIndex}>{cell}</span>)}</div>)}</div>; }
function Field({ label, value, suffix, select }: { label: string; value: string; suffix?: string; select?: boolean }) { return <label className="field"><span>{label}</span>{select ? <select defaultValue={value}><option>{value}</option></select> : <input defaultValue={value} />}{suffix ? <small>{suffix}</small> : null}</label>; }
function NumberField({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) { return <label className="field"><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />{suffix ? <small>{suffix}</small> : null}</label>; }
function SelectField({ label, value, onChange, options, labels, empty = "Sin opciones" }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string>; empty?: string }) { const choices = options.length > 0 ? options : [""]; return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{choices.map((option) => <option key={option || empty} value={option}>{option ? labels?.[option] ?? option : empty}</option>)}</select></label>; }
function PortSelectRow({ ports, port, setPort, refreshPorts }: { ports: PortOption[]; port: string; setPort: (value: string) => void; refreshPorts: () => void }) { const options = ports.length > 0 ? ports.map((item) => item.path) : [""]; return <div className="field" style={{ gridTemplateColumns: "1fr 38px 1.15fr", alignItems: "center" }}><span>Puerto</span><button className="ghost" onClick={refreshPorts} title="Recargar puertos" style={{ minWidth: 38, height: 34, padding: 0 }}><RefreshCw size={15} /></button><select value={port} onChange={(event) => setPort(event.target.value)}>{options.map((option) => <option key={option || "empty"} value={option}>{option || "Sin puertos"}</option>)}</select></div>; }
function Tool({ icon: Icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone?: "ok" | "danger"; onClick?: () => void }) { return <button className={tone ?? ""} onClick={onClick}><Icon size={18} />{label}</button>; }
function Dot() { return <span className="dot" />; }
function Kpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone?: string }) { return <article className={`kpi ${tone ?? ""}`}><b>{icon}</b><span>{label}</span><strong>{value}</strong></article>; }
function Status({ status }: { status: Status }) { const ok = status === "OK" || status === "Aprobado"; return <strong className={ok ? "okstatus" : status === "Excepción" ? "purpletext" : status === "Pendiente" ? "muted" : "badstatus"}>{ok ? <CheckCircle2 size={14} /> : status === "Pendiente" ? null : <AlertTriangle size={14} />} {status}</strong>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Tile({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) { return <article><Icon size={20} /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function SelectChip({ text }: { text: string }) { return <span className="selectchip">{text}⌄</span>; }
function Scenario({ label, text, ok, warn, danger }: { label: string; text: string; ok?: boolean; warn?: boolean; danger?: boolean }) { return <article className={danger ? "danger" : warn ? "warn" : ok ? "ok" : ""}><CheckCircle2 size={20} /><div><strong>{label}</strong><span>{text}</span></div></article>; }
function Big({ label, value, note, danger }: { label: string; value: string; note: string; danger?: boolean }) { return <article className={danger ? "big danger" : "big"}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function Metric({ label, value, percent, ok, warn, danger, purple }: { label: string; value: string; percent: string; ok?: boolean; warn?: boolean; danger?: boolean; purple?: boolean }) { return <div className={ok ? "metric ok" : warn ? "metric warn" : danger ? "metric danger" : purple ? "metric purple" : "metric"}><span>{label}</span><strong>{value}</strong><em>{percent}</em></div>; }

const rowButtonStyle = { border: 0, background: "transparent", minHeight: 0, padding: 0, justifyContent: "flex-start", color: "inherit" } as const;
function normalizePorts(rawPorts: Array<Record<string, unknown>>): PortOption[] { const unique = new Map<string, PortOption>(); for (const raw of rawPorts) { const path = typeof raw.path === "string" ? raw.path : ""; if (!path) continue; const hasMetadata = Boolean(raw.vendorId || raw.productId || raw.manufacturer || raw.serialNumber || raw.pnpId); const label = String(raw.displayName || raw.friendlyName || raw.path); unique.set(path, { path, label, hasMetadata }); } return [...unique.values()].sort((left, right) => portNumber(left.path) - portNumber(right.path)); }
function highestComPort(options: PortOption[]) { return [...options].sort((left, right) => portNumber(right.path) - portNumber(left.path))[0]; }
function portNumber(path: string) { return Number(path.match(/COM(\d+)/i)?.[1] ?? 0); }
function createDiscoveredDevice(id: number): Device { return { id, name: `Slave ID ${id}`, named: false, active: true }; }
function rawAddress(fn: Fn, address: number) { if ((fn === "fc3" || fn === "fc6") && address >= 40000) return address - 40000; if (fn === "fc4" && address >= 30000) return address - 30000; if (fn === "fc2" && address >= 10000) return address - 10000; return address; }
function displayAddress(fn: Fn, raw: number) { if (fn === "fc3") return 40000 + raw; if (fn === "fc4") return 30000 + raw; if (fn === "fc2") return 10000 + raw; return raw; }
function defaultAddress(fn: Fn) { if (fn === "fc3") return 40000; if (fn === "fc4") return 30000; return 0; }
function metaFor(fn: Fn, raw: number) { if (fn === "fc1") return { name: `Q0_${raw}`, type: "bool", access: "R/W" }; if (fn === "fc2") return { name: `I0_${raw}`, type: "bool", access: "R" }; return registerMeta[raw] ?? { name: `Reg_${displayAddress(fn, raw)}`, type: "uint16", access: fn === "fc3" ? "R/W" : "R" }; }
function buildRegisterRows(fn: Fn, start: number, values: Array<number | boolean>): RegisterRow[] { const rawStart = rawAddress(fn, start); return values.map((value, index) => { const raw = rawStart + index; const meta = metaFor(fn, raw); return { raw, address: String(displayAddress(fn, raw)), name: meta.name, value: typeof value === "boolean" ? (value ? "ON" : "OFF") : String(value), type: meta.type, access: meta.access, status: "OK" }; }); }
function withUnit(row: RegisterRow) { const meta = registerMeta[row.raw]; return meta?.unit ? `${row.name} (${meta.unit})` : row.name; }
function AddressCell({ row }: { row: RegisterRow }) { const address = Number(row.address); return <span className="addrHex"><strong>{row.address}</strong><small>({Number.isFinite(address) ? hex(address) : "—"})</small></span>; }
function registerValueStats(rows: RegisterRow[], selected: RegisterRow | null) { const numeric = rows.map((row) => Number(row.value)).filter((value) => Number.isFinite(value)); if (!selected || numeric.length === 0) return { min: "—", max: "—", avg: "—" }; const min = Math.min(...numeric); const max = Math.max(...numeric); const avg = numeric.reduce((total, value) => total + value, 0) / numeric.length; return { min: statValue(min), max: statValue(max), avg: statValue(avg) }; }
function statValue(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(2); }
function valueCell(row: RegisterRow) { if (row.type === "bool" || row.value === "ON" || row.value === "OFF") return <span className={`bitChip ${row.value === "ON" ? "on" : "off"}`}>{row.value}</span>; return row.value; }
function valuesPreview(fn: Fn, start: number, values: Array<number | boolean>) { if (values.length === 0) return "—"; const rawStart = rawAddress(fn, start); return values.slice(0, 6).map((value, index) => `${displayAddress(fn, rawStart + index)}=${typeof value === "boolean" ? (value ? "ON" : "OFF") : value}`).join(", ") + (values.length > 6 ? "…" : ""); }
function addressHelp(fn: Fn) { if (fn === "fc1") return "FC01 lee coils. El rango real depende del mapa del dispositivo o del template aplicado."; if (fn === "fc2") return "FC02 lee entradas discretas. El rango real depende del mapa del dispositivo o del template aplicado."; if (fn === "fc4") return "FC04 lee input registers. El rango real depende del mapa del dispositivo o del template aplicado."; return "FC03 lee holding registers. El rango real depende del mapa del dispositivo o del template aplicado."; }
function hex(value: number) { return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`; }
function fmt(date: Date) { return new Intl.DateTimeFormat("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date); }
function time(date: Date) { return new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date); }
function fnLabels() { return Object.fromEntries(Object.entries(fnMap).map(([key, value]) => [key, value.label])); }
function summarize(fn: Fn, address: number, quantity: number) { return fn === "fc6" ? `Write Single Register (${address})` : `${fnMap[fn].label} (${address}–${address + quantity - 1})`; }
function responseSummary(action: TrafficAction) { if (action.exception) return exceptionName(action.exception); if (action.registerValues) return `${action.registerValues.length} registros`; if (action.values) return `${action.values.length} bits`; return "Escritura OK"; }
function exceptionName(exception: unknown) { return exception && typeof exception === "object" && "exceptionName" in exception && typeof exception.exceptionName === "string" ? exception.exceptionName : "Excepción Modbus"; }
function pct(value: number, total: number) { return total > 0 ? Math.round((value / total) * 100) : 0; }
function createCleanTests(): TestRow[] { return [[1, 2, "Slave ID 2", "fc3", 40000, 6, "6 regs", 1000], [2, 2, "Slave ID 2", "fc4", 30000, 4, "4 regs", 1000], [3, 2, "Slave ID 2", "fc1", 0, 8, "8 coils", 1000], [4, 2, "Slave ID 2", "fc2", 0, 8, "8 inputs", 1000]].map((item) => ({ enabled: true, step: item[0] as number, slave: item[1] as number, device: item[2] as string, fn: item[3] as Fn, label: fnMap[item[3] as Fn].label, address: item[4] as number, amount: item[5] as number, expected: item[6] as string, timeout: item[7] as number, result: "Pendiente" })); }
function sessionTestSummary(testsRuntime: TestsRuntimeState | null | undefined, tests: TestRow[]): TestsRunSummary { if (testsRuntime?.lastRun) return testsRuntime.lastRun; const total = testsRuntime?.steps.length ?? tests.length; const finalTests = tests.filter((item) => item.result !== "Pendiente"); const passed = finalTests.filter((item) => item.result === "Aprobado").length; const failed = finalTests.filter((item) => item.result !== "Aprobado").length; const timeouts = finalTests.filter((item) => item.result === "Timeout").length; return { total, executed: finalTests.length, passed, failed, timeouts, otherFailed: Math.max(0, failed - timeouts), responsive: Math.max(0, finalTests.length - timeouts), avgMs: null, lastRunAt: null }; }
function storedRegisterReads(activity: StoredActivityRow[]) { return activity.reduce((total, item) => total + item.rows.length, 0); }
function signatureFromState(input: {
  sessionName: string;
  port: string;
  baud: number;
  dataBits: number;
  parity: string;
  stopBits: number;
  timeout: number;
  devices: Device[];
  activeId: number | null;
  stats: Stats;
  quick: RegisterRow[];
  regs: RegisterRow[];
  activity: ActivityRow[];
  traffic: TrafficRow[];
  tests: TestRow[];
  testsRuntime: TestsRuntimeState | null;
  testsExecutionHistory: TestExecutionHistoryEntry[];
  notes: string;
}) {
  return JSON.stringify({
    name: input.sessionName.trim() || "Nueva_sesion_Modbus",
    connection: {
      port: input.port,
      baud: input.baud,
      dataBits: input.dataBits,
      parity: input.parity,
      stopBits: input.stopBits,
      timeout: input.timeout
    },
    devices: input.devices,
    activeId: input.activeId,
    stats: input.stats,
    quick: input.quick,
    regs: input.regs,
    activity: input.activity.map((item) => ({ ...item, at: item.at.toISOString() })),
    traffic: input.traffic.map((item) => ({ ...item, at: item.at.toISOString() })),
    tests: input.tests,
    testsRuntime: input.testsRuntime,
    testsExecutionHistory: input.testsExecutionHistory,
    notes: input.notes
  });
}
function signatureFromDocument(document: SessionDocument) {
  return JSON.stringify({
    name: document.session.name,
    connection: {
      port: document.connection.port,
      baud: document.connection.baudRate,
      dataBits: document.connection.dataBits,
      parity: document.connection.parity,
      stopBits: document.connection.stopBits,
      timeout: document.connection.timeoutMs
    },
    devices: document.devices,
    activeId: document.activeSlaveId,
    stats: document.stats,
    quick: document.quickReads,
    regs: document.registerSnapshot,
    activity: document.activity,
    traffic: document.traffic,
    tests: document.tests,
    testsRuntime: document.testsRuntime ?? null,
    testsExecutionHistory: document.testsExecutionHistory ?? [],
    notes: document.session.notes
  });
}
function normalizeSessionDocument(data: unknown): SessionDocument | null {
  if (!data || typeof data !== "object") return null;

  const doc = data as Partial<SessionDocument>;
  if (doc.format !== "jwmodbus-session" || doc.version !== 1 || !doc.session || !doc.connection) return null;

  const history = normalizeTestsExecutionHistory(doc.testsExecutionHistory);

  return {
    format: "jwmodbus-session",
    version: 1,
    session: {
      id: doc.session.id ?? `session-${Date.now()}`,
      name: doc.session.name ?? "Nueva_sesion_Modbus",
      createdAt: doc.session.createdAt ?? new Date().toISOString(),
      updatedAt: doc.session.updatedAt ?? new Date().toISOString(),
      status: doc.session.status ?? "Guardada",
      notes: doc.session.notes ?? ""
    },
    connection: {
      protocol: "RTU",
      port: doc.connection.port ?? "",
      baudRate: doc.connection.baudRate ?? 115200,
      dataBits: doc.connection.dataBits ?? 8,
      parity: doc.connection.parity ?? "none",
      stopBits: doc.connection.stopBits ?? 1,
      timeoutMs: doc.connection.timeoutMs ?? 1000
    },
    devices: doc.devices ?? [],
    activeSlaveId: doc.activeSlaveId ?? null,
    stats: doc.stats ?? { requests: 0, responses: 0, errors: 0, timeouts: 0 },
    quickReads: doc.quickReads ?? [],
    registerSnapshot: doc.registerSnapshot ?? [],
    activity: doc.activity ?? [],
    traffic: doc.traffic ?? [],
    tests: doc.tests ?? createCleanTests(),
    testsRuntime: normalizeTestsRuntimeState(doc.testsRuntime, doc.activeSlaveId ?? 2),
    testsExecutionHistory: history,
    testsExecutionHistoryUpdatedAt: doc.testsExecutionHistoryUpdatedAt ?? null,
    registerMaps: doc.registerMaps ?? [],
    templates: doc.templates ?? []
  };
}
function createRecentSession(document: SessionDocument, filePath: string, status: SessionState): RecentSession { const testSummary = sessionTestSummary(document.testsRuntime ?? null, document.tests); return { id: document.session.id, name: document.session.name, savedAt: document.session.updatedAt, filePath, devices: document.devices.length, registers: storedRegisterReads(document.activity), tests: `${testSummary.passed}/${testSummary.total}`, errors: document.stats.errors + testSummary.failed, status }; }
function normalizeTestsExecutionHistory(data: unknown): TestExecutionHistoryEntry[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item): item is TestExecutionHistoryEntry => Boolean(item) && typeof item === "object")
    .slice(0, 200);
}

function loadStoredTestsExecutionHistory(): TestExecutionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(TESTS_EXECUTION_HISTORY_STORAGE_KEY);
    return normalizeTestsExecutionHistory(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

function replaceStoredTestsExecutionHistory(data: unknown): TestExecutionHistoryEntry[] {
  const history = normalizeTestsExecutionHistory(data);

  try {
    localStorage.setItem(TESTS_EXECUTION_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage puede no estar disponible en pruebas o previsualizaciones.
  }

  window.dispatchEvent(new CustomEvent("jw-simple-tests-history-updated", { detail: history }));
  return history;
}

function loadStoredRecentSessions(): RecentSession[] { try { const raw = localStorage.getItem(RECENT_SESSION_STORAGE_KEY); if (!raw) return []; const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function storeRecentSessions(sessions: RecentSession[]) { localStorage.setItem(RECENT_SESSION_STORAGE_KEY, JSON.stringify(sessions)); }
function loadStoredSerialPort() { try { return localStorage.getItem(LAST_SERIAL_PORT_STORAGE_KEY) || ""; } catch { return ""; } }
function storeLastSerialPort(value: string) { if (!value) return; try { localStorage.setItem(LAST_SERIAL_PORT_STORAGE_KEY, value); } catch { /* local storage can be unavailable in tests/previews */ } }
function displayDeviceName(devices: Device[], id: number) { return devices.find((device) => device.id === id)?.name ?? `Slave ID ${id}`; }
function shortPath(filePath: string) { const normalized = filePath.replace(/\\/g, "/"); const parts = normalized.split("/"); return parts.slice(-2).join("/"); }
