import { useState, type ReactNode } from "react";
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

const nav: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "devices", label: "Dispositivos", icon: Network },
  { id: "sessions", label: "Sesiones", icon: Clock3 },
  { id: "tests", label: "Pruebas", icon: FlaskConical },
  { id: "registers", label: "Registros", icon: Database },
  { id: "traffic", label: "Tráfico Modbus", icon: Activity }
];

const quickRows = [
  ["40000", "Velocidad_Ref (RPM)", "1250", "OK"],
  ["40001", "Estado_Variador", "0x006F", "OK"],
  ["40002", "Corriente_Salida (A)", "12.1", "OK"],
  ["40003", "Tensión_DC (V)", "540", "OK"],
  ["40004", "Temp_Disipador (°C)", "42.3", "OK"],
  ["40005", "Horas_Marcha (h)", "1523", "OK"]
];

const sessions = [
  ["Lavadora_S200_Prueba_RTU", "Hoy, 10:15", "3", "4/4", "0"],
  ["Variador_01_Lectura_RPM", "Ayer, 16:42", "2", "3/4", "1"],
  ["HMI_Panel_Pruebas", "08/07/2026, 18:27", "2", "2/3", "2"],
  ["Banco_Modbus_Taller", "15/05/2024, 09:08", "4", "5/5", "0"]
];

const testRows = [
  ["✓", "1", "PLC_Principal", "FC03 Read Hold.", "400000", "10", "10 regs", "1000 ms", "Aprobado"],
  ["✓", "2", "PLC_Principal", "FC06 Write Single", "400010", "1234", "OK", "1000 ms", "Aprobado"],
  ["✓", "3", "HMI_Panel", "FC04 Read Input", "100000", "8", "8 regs", "1000 ms", "Aprobado"],
  ["✓", "4", "HMI_Panel", "FC06 Write Single", "10", "1", "OK", "1000 ms", "Aprobado"],
  ["✓", "5", "Variador_01", "FC03 Read Hold.", "300000", "5", "5 regs", "1000 ms", "Aprobado"],
  ["✓", "6", "PLC_Principal", "FC01 Read Coil", "0", "8", "8 coils", "1000 ms", "Aprobado"],
  ["✓", "7", "Variador_01", "FC06 Write Single", "400011", "0", "OK", "1000 ms", "Aprobado"],
  ["✓", "8", "HMI_Panel", "FC02 Read Discr.", "0", "16", "16 coils", "1500 ms", "Error"]
];

const registers = [
  ["40000 (0x9C40)", "Velocidad_Ref", "1500", "int16", "R/W", "OK"],
  ["40001 (0x9C41)", "Estado_Variador", "3", "uint16", "R/W", "OK"],
  ["40002 (0x9C42)", "Corriente_Salida", "12.45", "int16", "R/W", "OK"],
  ["40003 (0x9C43)", "Tension_DC", "540.2", "uint16", "R/W", "OK"],
  ["40004 (0x9C44)", "Temp_Disipador", "46.3", "int16", "R/W", "OK"],
  ["40008 (0x9C48)", "Frecuencia_Salida", "50.00", "uint16", "R/W", "OK"],
  ["40009 (0x9C49)", "Estado_Alarma", "0", "uint16", "R/W", "OK"]
];

const traffic = [
  ["↑", "09/07/2026 01:02:15", "PC Master → PLC_Principal", "1", "Petición", "FC03", "OK", "Read Holding Registers (40000–40009)"],
  ["↓", "09/07/2026 01:02:15", "PLC_Principal → PC Master", "1", "Respuesta", "FC03", "OK", "10 registros"],
  ["↑", "09/07/2026 01:01:48", "PC Master → HMI_Panel", "2", "Petición", "FC03", "OK", "Read Holding Registers (0–9)"],
  ["↓", "09/07/2026 01:01:48", "HMI_Panel → PC Master", "2", "Respuesta", "FC03", "OK", "10 registros"],
  ["↑", "09/07/2026 01:01:20", "PC Master → Variador_01", "10", "Petición", "FC03", "Timeout", "Sin respuesta (timeout)"],
  ["↑", "09/07/2026 01:00:55", "PC Master → PLC_Principal", "1", "Petición", "FC06", "OK", "Write Single Register (40020)"],
  ["↓", "09/07/2026 01:00:55", "PLC_Principal → PC Master", "1", "Respuesta", "FC06", "OK", "Escritura OK"],
  ["↑", "09/07/2026 01:00:28", "PC Master → Variador_01", "10", "Petición", "FC03", "CRC Error", "Error de CRC en respuesta"],
  ["↓", "09/07/2026 01:00:28", "Variador_01 → PC Master", "10", "Respuesta", "FC03", "CRC Error", "Respuesta inválida"],
  ["↑", "09/07/2026 01:00:10", "PC Master → HMI_Panel", "2", "Petición", "FC10", "Excepción", "Excepción 02 (Dirección inválida)"]
];

export function App() {
  const [view, setView] = useState<View>("devices");
  const [connected, setConnected] = useState(true);
  const [quickFunction, setQuickFunction] = useState("FC03 Read Holding Registers");

  return (
    <main className="shell">
      <header className="toolbar">
        <div className="brand"><span>JW</span><div><strong>JW Modbus Tool</strong><em>Modo sencillo</em></div></div>
        <div className="toolbar-actions">
          <Tool icon={FileText} label="Nuevo" />
          <Tool icon={FolderOpen} label="Abrir" />
          <Tool icon={Save} label="Guardar" />
          <i />
          <Tool icon={Plug} label="Conectar" tone="ok" onClick={() => setConnected(true)} />
          <Tool icon={Unplug} label="Desconectar" tone="danger" onClick={() => setConnected(false)} />
          <i />
          <Tool icon={Search} label="Escanear" />
        </div>
        <div className="window-buttons"><span>Ayuda</span><button>—</button><button>□</button><button>×</button></div>
      </header>

      <div className="body">
        <aside className="sidebar">
          <nav>{nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><item.icon size={21} />{item.label}</button>)}</nav>
          <div className="helper"><Info size={18} /><strong>¿Cómo funciona?</strong><p>Conecta, prueba, guarda y revisa comunicaciones Modbus en modo sencillo.</p></div>
          <div className="license"><Dot />Licencia: Profesional<br /><small>Versión 1.3.0 (64-bit)</small></div>
        </aside>
        <section className="workspace">{view === "devices" && <Devices quickFunction={quickFunction} setQuickFunction={setQuickFunction} />}{view === "sessions" && <Sessions />}{view === "tests" && <Tests />}{view === "registers" && <Registers />}{view === "traffic" && <Traffic />}</section>
      </div>

      <footer className="status"><Dot /><strong>{connected ? "Conectado" : "Inactivo"}</strong><span>COM3</span><span>115200</span><span>8N1</span><span>Slave activo ID 1</span><span>Sesión activa</span></footer>
    </main>
  );
}

function Devices({ quickFunction, setQuickFunction }: { quickFunction: string; setQuickFunction: (value: string) => void }) {
  return <div className="devices grid">
    <Card title="1. Conectar" className="connect">
      <div className="radio"><label><input type="radio" checked readOnly />RTU</label><label><input type="radio" readOnly />TCP</label></div>
      {[["Puerto", "COM3"], ["Baud Rate", "115200"], ["Bits de datos", "8"], ["Paridad", "none"], ["Bits de parada", "1"]].map(([label, value]) => <Field key={label} label={label} value={value} select />)}
      <Field label="Timeout" value="1000" suffix="ms" />
      <p className="connection"><Dot />Estado de conexión <strong>Conectado</strong></p>
    </Card>
    <Card title="2. Dispositivos detectados" action={<button className="ghost"><RefreshCw size={15} />Recargar</button>} className="detected">
      <Table columns={["Dispositivo", "ID"]} rows={[[<><Dot />PLC_Principal — ID 1 <b className="pill">SLAVE ACTIVO</b></>, "1"], [<><Dot />HMI_Panel — ID 2</>, "2"], [<><Dot />Variador_01 — ID 10</>, "10"]]} />
      <p className="note"><Info size={16} />Seleccione un dispositivo para establecerlo como Slave activo.</p>
    </Card>
    <Card title="Resumen" className="summary"><p>Estado general de la comunicación.</p><div className="kpis"><Kpi icon="↗" label="Solicitudes" value="128" /><Kpi icon="✓" label="Respuestas" value="126" tone="ok" /><Kpi icon="!" label="Errores" value="2" tone="warn" /><Kpi icon="◷" label="Timeouts" value="0" tone="purple" /></div><dl><dt>Dispositivos encontrados</dt><dd>3</dd><dt>Rango de escaneo</dt><dd>1 – 10</dd><dt>Último escaneo</dt><dd><Status status="OK" /><small>09/07/2026 01:02:15</small></dd><dt>Rol</dt><dd><Monitor size={15} /> PC Master</dd></dl></Card>
    <Card title="3. Lectura rápida de registros" className="quick"><p>Slave activo: <strong className="cyan">PLC_Principal — ID 1</strong></p><div className="quickbar"><label>Función<select value={quickFunction} onChange={(e) => setQuickFunction(e.target.value)}><option>FC03 Read Holding Registers</option><option>FC04 Read Input Registers</option><option>FC01 Read Coils</option></select></label><Field label="Dirección inicial" value="40000" /><Field label="Cantidad" value="6" /><button className="primary"><Database size={15} />Leer</button></div><Table columns={["Dirección", "Nombre", "Valor", "Estado"]} rows={quickRows.map(([a, b, c, d]) => [a, b, c, <Status status={d as Status} />])} /><p className="note"><Info size={16} />Datos leídos correctamente desde 40000 (6 registros).</p></Card>
    <Card title="Actividad reciente" className="recent"><Table columns={["Fecha/hora", "Duración", "Slave ID", "Función", "Dirección / cantidad", "Resultado"]} rows={[["09/07/2026 01:02:15", "284 ms", "1", "FC03", "40000 / 6 regs", <Status status="OK" />], ["09/07/2026 01:01:48", "271 ms", "2", "FC03", "0 / 10 regs", <Status status="OK" />], ["09/07/2026 01:01:20", "256 ms", "10", "FC03", "30000 / 10 regs", <Status status="OK" />]]} /></Card>
  </div>;
}

function Sessions() {
  return <div className="sessions grid"><div className="top"><button className="primary">+ Nueva sesión</button><button><FolderOpen size={16} />Abrir sesión</button><button><Save size={16} />Guardar sesión</button></div><Card title="Sesión actual" className="current" action={<span className="oktext">● Activa</span>}><h1>Comisionamiento_Lavadora_S200 <Pencil size={15} /></h1><div className="facts"><Fact label="Rol" value="PC Master" /><Fact label="Protocolo" value="RTU" /><Fact label="Slave activo" value="PLC_Principal — ID 1" /><Fact label="Conexión" value="COM3 · 115200 · 8N1" /><Fact label="Última actividad" value="Hace 4 min" /></div><button className="primary wide"><Play size={16} />Continuar sesión</button></Card><Card title="¿Qué guarda una sesión?" className="what"><p>Una sesión guarda todo tu trabajo para que puedas continuar después desde el mismo punto.</p><ul><li>Conexiones y dispositivos detectados</li><li>Registros leídos y valores configurados</li><li>Pruebas ejecutadas y resultados</li><li>Tráfico Modbus capturado</li><li>Notas y observaciones del diagnóstico</li></ul></Card><Card title="Sesiones recientes" className="sessionlist"><div>{sessions.map((s) => <article className="sessionrow" key={s[0]}><div><strong>{s[0]}</strong><small>{s[1]}</small></div><span>Dispositivos<br /><b>{s[2]}</b></span><span>Pruebas<br /><b>{s[3]}</b></span><span>Errores<br /><b>{s[4]}</b></span><div><button>Continuar</button><button>Ver resumen</button><button>Exportar</button></div></article>)}</div></Card><Card title="Resumen de la sesión actual" className="sumsession"><div className="tiles"><Tile icon={Network} label="Dispositivos" value="3" note="Detectados" /><Tile icon={FileText} label="Registros leídos" value="120" note="En total" /><Tile icon={FlaskConical} label="Pruebas" value="4/4" note="Aprobadas" /><Tile icon={Activity} label="Tráfico capturado" value="3.2 MB" note="En total" /><Tile icon={FileText} label="Notas" value="2" note="Guardadas" /><Tile icon={AlertTriangle} label="Errores" value="0" note="Detectados" /></div></Card><Card title="Actividad reciente" className="timeline"><ol><li>01:02:15 Conexión establecida (COM3, 115200)</li><li>01:02:16 PLC_Principal (ID 1) seleccionado como slave activo</li><li>01:02:20 Escaneo iniciado (Rango 1–10, FC03)</li><li>01:02:40 10 registros leídos correctamente</li></ol></Card></div>;
}

function Tests() {
  return <div className="tests grid"><Card title="Plan de pruebas al slave" className="plan" action={<div><button className="primary"><Play size={15} />Iniciar prueba</button><button><Square size={14} />Detener</button></div>}><p>PC como Master</p><div className="tableactions"><button>+ Agregar paso</button><button><Save size={15} />Guardar plan</button></div><Table columns={["Activo", "Paso", "Slave", "Función", "Dirección", "Cantidad/Valor", "Esperado", "Timeout", "Resultado"]} rows={testRows.map((r) => [r[0], r[1], <SelectChip text={r[2]} />, <SelectChip text={r[3]} />, r[4], r[5], r[6], r[7], <Status status={r[8] as Status} />])} /><p className="note"><Info size={15} />El PC actuará como Master ejecutando esta secuencia de comandos hacia los slaves seleccionados.</p></Card><Card title="Escenarios" className="scenarios"><Scenario label="Operación normal" text="Verifica lectura y escritura correcta." ok /><Scenario label="Timeout detectado" text="Simula dispositivos no disponibles." warn /><Scenario label="Error CRC detectado" text="Introduce errores de CRC en la trama." warn /><Scenario label="Excepción Modbus" text="Forza códigos de excepción (01, 02, 03)." danger /><button className="ghost">Gestionar escenarios</button></Card><Card title="Simulador slave (PC como slave)" className="sim"><Field label="Estado" value="Detenido" /><Field label="Dirección slave" value="1" suffix="(1–247)" /><Field label="Puerto" value="COM3" select /><Field label="Baud Rate" value="115200" select /><button className="purple"><Play size={15} />Iniciar simulador slave</button><button><Settings size={15} /></button></Card><div className="testkpis"><Big label="Tasa de éxito" value="96%" note="Últimas 20 ejecuciones" /><Big label="Latencia promedio" value="42 ms" note="Últimas 20 ejecuciones" /><Big label="Errores" value="1" note="Últimas 20 ejecuciones" danger /><Big label="Pasos completados" value="15/16" note="Última ejecución" /></div><Card title="Registro de ejecución" className="exec"><Table columns={["Hora", "Paso", "Slave", "Función", "Dirección", "Cantidad/Valor", "Resultado", "Tiempo", "Detalle"]} rows={testRows.map((r, i) => [`10:42:19.${120 + i * 74}`, r[1], r[2], r[3], r[4], r[5], <Status status={r[8] as Status} />, i === 7 ? "1000 ms" : "96 ms", i === 7 ? "Timeout: no respondió en 1000 ms." : "Operación correcta."])} /></Card></div>;
}

function Registers() {
  return <div className="registers grid"><header><Dot /><h1>Slave activo: <span>PLC_Principal — ID 1</span></h1><p><Info size={15} />Los registros se muestran en formato decimal.</p></header><section className="tabs"><button>Coils (01)<small>Lectura/Escritura</small></button><button>Discrete Inputs (02)<small>Solo lectura</small></button><button>Input Registers (04)<small>Solo lectura</small></button><button className="active">Holding Registers (03)<small>Lectura/Escritura</small></button></section><section className="regcontrols"><Field label="Dirección inicial" value="40000" /><span>(0x9C40)</span><Field label="Cantidad" value="10" /><button className="primary">Leer</button><label><input type="checkbox" defaultChecked /> Autolectura</label><Field label="Intervalo" value="1 s" select /><button>Detener</button></section><Card title="Mapa de registros" className="regtable" action={<button className="ghost"><Pencil size={15} />Editar mapa</button>}><Table columns={["Dirección", "Nombre", "Valor", "Tipo", "Acceso", "Estado"]} rows={registers.map((r) => [r[0], r[1], r[2], r[3], <b className="oktext">{r[4]}</b>, <Status status={r[5] as Status} />])} /><p className="note"><Info size={15} />Nombre, Tipo, Unidad, Acceso y otros metadatos provienen del mapa de registros del slave activo y se guardan en la sesión.</p></Card><Card title="Registro seleccionado" className="selected"><h1>40002 <small>(0x9C42)</small> Corriente_Salida</h1><div className="vals"><span>Valor actual<strong>12.45</strong></span><span>Tipo<strong>int16</strong></span><span>Acceso<strong>R/W</strong></span></div><p>Tendencia (últimos 60 s)</p><div className="chart"><svg viewBox="0 0 400 120"><polyline points="0,72 25,62 50,74 75,58 100,82 125,70 150,77 175,65 200,80 225,72 250,61 275,70 300,66 325,75 350,69 375,73 400,67" /></svg></div><div className="stats"><span>Min: 10.12</span><span>Máx: 14.88</span><span>Prom: 12.41</span></div></Card><Card title="Actividad reciente" className="regactivity"><Table columns={["Inicio", "Fin", "Duración", "Slave ID", "Dispositivo", "Función", "Rango", "Cantidad", "Resultado", "Tiempo de respuesta"]} rows={[["09/07/2026 01:02:45", "09/07/2026 01:02:45", "96 ms", "1", "PLC_Principal", "FC03 Read Holding Registers", "40000–40009 (10)", "10", <Status status="OK" />, "32 ms"], ["09/07/2026 01:01:44", "09/07/2026 01:01:44", "98 ms", "1", "PLC_Principal", "FC03 Read Holding Registers", "40000–40009 (10)", "10", <Status status="OK" />, "34 ms"], ["09/07/2026 01:01:43", "09/07/2026 01:01:43", "95 ms", "1", "PLC_Principal", "FC03 Read Holding Registers", "40000–40009 (10)", "10", <Status status="OK" />, "31 ms"]]} /></Card></div>;
}

function Traffic() {
  return <div className="traffic grid"><Card title="Tráfico Modbus" className="trafficmain"><p>Visualice el historial de mensajes Modbus en tiempo real.</p><div className="filters"><Field label="Protocolo" value="RTU" select /><Field label="Dispositivo" value="Todos" select /><Field label="Slave ID" value="Todos" select /><Field label="Resultado" value="Todos" select /><button className="ghost">Limpiar filtros</button></div><Table columns={["", "Hora", "Origen → Destino", "ID esclavo", "Tipo", "Función", "Resultado", "Resumen"]} rows={traffic.map((r) => [<span className={r[0] === "↑" ? "up" : "down"}>{r[0]}</span>, r[1], r[2], r[3], r[4], r[5], <Status status={r[6] as Status} />, r[7]])} /><p className="pagination">Mostrando 1 a 10 de 25 tramas · 1 2 3</p></Card><Card title="Detalles del mensaje seleccionado" className="tdetails"><dl><dt>Dirección</dt><dd>1 (0x01)</dd><dt>Función</dt><dd>FC03 Read Holding Registers</dd><dt>Tipo</dt><dd>Petición</dd><dt>Origen</dt><dd>PC Master (Este equipo)</dd><dt>Destino</dt><dd>PLC_Principal</dd><dt>Respuesta</dt><dd>10 registros · 2 ms</dd></dl></Card><Card title="¿Qué pasó?" className="happened"><h3><CheckCircle2 />La operación fue exitosa.</h3><p>El PC Master envió una petición de lectura (FC03) al PLC_Principal (ID 1) solicitando 10 registros holding desde 40000.</p><p>El dispositivo respondió correctamente en 2 ms.</p><p className="tip"><Star size={16} />Consejo: Usa los filtros para enfocarte en lo que necesitas.</p></Card><Card title="Actividad de la sesión" className="tactivity"><Metric label="Mensajes OK" value="18" percent="72%" ok /><Metric label="Timeouts" value="4" percent="16%" warn /><Metric label="Errores CRC" value="3" percent="12%" danger /><Metric label="Excepciones" value="2" percent="8%" purple /><dl><dt>Tiempo total</dt><dd>00:02:35</dd><dt>Trama más rápida</dt><dd>1 ms</dd><dt>Trama más lenta</dt><dd>1200 ms</dd></dl></Card></div>;
}

function Card({ title, children, action, className = "" }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`card ${className}`}><header>{title ? <h2>{title}</h2> : null}{action}</header>{children}</section>;
}
function Table({ columns, rows }: { columns: ReactNode[]; rows: ReactNode[][] }) { return <div className="table"><div className="tr head" style={{ gridTemplateColumns: `repeat(${columns.length},minmax(0,1fr))` }}>{columns.map((c, i) => <span key={i}>{c}</span>)}</div>{rows.map((r, i) => <div className="tr" key={i} style={{ gridTemplateColumns: `repeat(${columns.length},minmax(0,1fr))` }}>{r.map((c, j) => <span key={j}>{c}</span>)}</div>)}</div>; }
function Field({ label, value, suffix, select }: { label: string; value: string; suffix?: string; select?: boolean }) { return <label className="field"><span>{label}</span>{select ? <select defaultValue={value}><option>{value}</option></select> : <input defaultValue={value} />}{suffix ? <small>{suffix}</small> : null}</label>; }
function Tool({ icon: Icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone?: "ok" | "danger"; onClick?: () => void }) { return <button className={tone ? tone : ""} onClick={onClick}><Icon size={18} />{label}</button>; }
function Dot() { return <span className="dot" />; }
function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: string }) { return <article className={`kpi ${tone ?? ""}`}><b>{icon}</b><span>{label}</span><strong>{value}</strong></article>; }
function Status({ status }: { status: Status }) { const cls = status === "OK" || status === "Aprobado" ? "okstatus" : status === "Excepción" ? "purpletext" : status === "Pendiente" ? "muted" : "badstatus"; return <strong className={cls}>{status === "OK" || status === "Aprobado" ? <CheckCircle2 size={14} /> : status === "Pendiente" ? null : <AlertTriangle size={14} />}{status}</strong>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Tile({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) { return <article><Icon size={20} /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function SelectChip({ text }: { text: string }) { return <span className="selectchip">{text}⌄</span>; }
function Scenario({ label, text, ok, warn, danger }: { label: string; text: string; ok?: boolean; warn?: boolean; danger?: boolean }) { return <article className={danger ? "danger" : warn ? "warn" : ok ? "ok" : ""}><CheckCircle2 size={20} /><div><strong>{label}</strong><span>{text}</span></div></article>; }
function Big({ label, value, note, danger }: { label: string; value: string; note: string; danger?: boolean }) { return <article className={danger ? "big danger" : "big"}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function Metric({ label, value, percent, ok, warn, danger, purple }: { label: string; value: string; percent: string; ok?: boolean; warn?: boolean; danger?: boolean; purple?: boolean }) { return <div className={ok ? "metric ok" : warn ? "metric warn" : danger ? "metric danger" : purple ? "metric purple" : "metric"}><span>{label}</span><strong>{value}</strong><em>{percent}</em></div>; }
