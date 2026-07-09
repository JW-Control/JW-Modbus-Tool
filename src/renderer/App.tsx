import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  FileDown,
  FlaskConical,
  Network,
  Play,
  Plug,
  RadioTower,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Unplug,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  RtuMasterActionResult,
  ValidationSequenceResult
} from "../shared/modbus/masterActionTypes.js";
import type {
  SerialConnectionState,
  SerialOperationResult,
  SerialPortDescriptor
} from "../shared/serial/types.js";
import {
  genericFunctionOptions,
  isBitReadFunction,
  isGenericFunction,
  isReadFunction,
  isSingleWriteFunction,
  parseCoilValues,
  parseRegisterValue,
  parseRegisterValues,
  readQuantityMax,
  validateGenericCommand,
  type GenericFunction
} from "./genericMasterModel.js";
import {
  normalizeSerialSettings,
  serialFormatLabel,
  supportedBaudRates,
  type SerialSettings
} from "./serialSettingsModel.js";

type AppPage = "dashboard" | "jwplc" | "generic" | "monitor" | "settings";
type MasterAction = "read-inputs" | "read-feedback" | "q0-on" | "q0-off" | "pattern-55" | "all-off";

interface GenericPreset {
  id: string;
  name: string;
  functionCode: GenericFunction;
  unitId: number;
  startAddress: number;
  quantity: number;
  coilValue: boolean;
  registerValue: string;
  valuesText: string;
}

interface ConfirmationRequest {
  title: string;
  details: string;
  confirmLabel: string;
  action: () => void;
}

const genericPresetStorageKey = "jw-modbus-tool.generic-presets.v1";
const serialSettingsStorageKey = "jw-modbus-tool.serial-settings.v1";

const pages: Array<{ id: AppPage; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dispositivos", icon: Network },
  { id: "jwplc", label: "Pruebas", icon: FlaskConical },
  { id: "generic", label: "Registros", icon: Database },
  { id: "monitor", label: "Tráfico Modbus", icon: RadioTower }
];

export function App() {
  const bridge = window.jwModbus;
  const [activePage, setActivePage] = useState<AppPage>("dashboard");
  const [ports, setPorts] = useState<SerialPortDescriptor[]>([]);
  const [serialSettings, setSerialSettings] = useState<SerialSettings>(loadSerialSettings);
  const [connectionState, setConnectionState] = useState<SerialConnectionState>({ connected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [isMasterBusy, setIsMasterBusy] = useState(false);
  const [unitId, setUnitId] = useState(2);
  const [inputValues, setInputValues] = useState<boolean[]>([]);
  const [outputFeedbackValues, setOutputFeedbackValues] = useState<boolean[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationSequenceResult | null>(null);
  const [reportMessage, setReportMessage] = useState("");
  const [monitorMessage, setMonitorMessage] = useState("");
  const [masterLog, setMasterLog] = useState<RtuMasterActionResult[]>([]);
  const [genericFunction, setGenericFunction] = useState<GenericFunction>("fc3");
  const [registerStartAddress, setRegisterStartAddress] = useState(0);
  const [registerQuantity, setRegisterQuantity] = useState(4);
  const [coilValue, setCoilValue] = useState(true);
  const [registerValue, setRegisterValue] = useState("0");
  const [multipleValuesText, setMultipleValuesText] = useState("0, 0");
  const [genericPresets, setGenericPresets] = useState<GenericPreset[]>(loadGenericPresets);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [genericResult, setGenericResult] = useState<RtuMasterActionResult | null>(null);
  const [genericMessage, setGenericMessage] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [message, setMessage] = useState(
    bridge ? "Listo" : "Abre la aplicación en Electron para acceder a los puertos"
  );

  const selectedPortLabel = useMemo(
    () => ports.find((port) => port.path === serialSettings.portPath)?.displayName ?? serialSettings.portPath,
    [ports, serialSettings.portPath]
  );
  const selectedPortAvailable = ports.some((port) => port.path === serialSettings.portPath);

  const lastAction = masterLog[0];
  const issueCount = masterLog.filter((entry) => !entry.crcOk || entry.exception).length;
  const passedValidationSteps = validationResult?.steps.filter((step) => step.passed).length ?? 0;

  function updateSerialSettings(patch: Partial<SerialSettings>) {
    setSerialSettings((current) => {
      const next = normalizeSerialSettings({ ...current, ...patch });
      persistSerialSettings(next);
      return next;
    });
  }

  function acceptConfirmation() {
    const request = confirmation;
    setConfirmation(null);
    request?.action();
  }

  async function refreshPorts() {
    if (!bridge) {
      setMessage("El puente de Electron no está disponible en la vista web");
      return;
    }

    setIsLoading(true);
    const result = await bridge.serial.listPorts();

    if (result.ok) {
      setPorts(result.value);
      setSerialSettings((current) => {
        const rememberedPortExists = result.value.some((port) => port.path === current.portPath);
        const next = {
          ...current,
          portPath: rememberedPortExists ? current.portPath : result.value[0]?.path || ""
        };
        persistSerialSettings(next);
        return next;
      });
      setMessage(result.value.length > 0 ? "Puertos actualizados" : "No se detectaron puertos seriales");
    } else {
      setMessage(result.error);
    }

    setIsLoading(false);
  }

  async function connectSelectedPort() {
    if (!bridge || !serialSettings.portPath || !selectedPortAvailable) {
      return;
    }

    setIsLoading(true);
    const result = await bridge.serial.open({
      path: serialSettings.portPath,
      baudRate: serialSettings.baudRate,
      dataBits: serialSettings.dataBits,
      parity: serialSettings.parity,
      stopBits: serialSettings.stopBits
    });

    if (result.ok) {
      setConnectionState(result.value);
      setMessage(`Conectado a ${selectedPortLabel}`);
    } else {
      setMessage(result.error);
    }

    setIsLoading(false);
  }

  async function disconnectPort() {
    if (!bridge) {
      return;
    }

    setIsLoading(true);
    const result = await bridge.serial.close();

    if (result.ok) {
      setConnectionState(result.value);
      setMessage("Desconectado");
      setInputValues([]);
      setOutputFeedbackValues([]);
      setValidationResult(null);
      setReportMessage("");
      setGenericResult(null);
      setGenericMessage("");
    } else {
      setMessage(result.error);
    }

    setIsLoading(false);
  }

  async function runMasterAction(action: MasterAction) {
    if (!bridge || !connectionState.connected) {
      return;
    }

    setIsMasterBusy(true);
    const commandBase = {
      unitId,
      timeoutMs: serialSettings.timeoutMs
    };

    const result =
      action === "read-inputs"
        ? await bridge.modbus.readDiscreteInputs({
            ...commandBase,
            startAddress: 0,
            quantity: 8
          })
        : action === "read-feedback"
          ? await bridge.modbus.readCoils({
              ...commandBase,
              startAddress: 0,
              quantity: 8
            })
          : action === "q0-on" || action === "q0-off"
            ? await bridge.modbus.writeSingleCoil({
                ...commandBase,
                address: 0,
                value: action === "q0-on"
              })
            : await bridge.modbus.writeMultipleCoils({
                ...commandBase,
                startAddress: 0,
                values: action === "pattern-55" ? bitPattern(0x55, 8) : bitPattern(0x00, 8)
              });

    if (result.ok) {
      handleMasterResult(result.value, action);
    } else {
      setMessage(result.error);
    }

    setIsMasterBusy(false);
  }

  async function toggleOutput(index: number) {
    if (!bridge || !connectionState.connected) {
      return;
    }

    const nextValue = !outputFeedbackValues[index];
    setIsMasterBusy(true);
    const result = await bridge.modbus.writeSingleCoil({
      unitId,
      address: index,
      value: nextValue,
      timeoutMs: serialSettings.timeoutMs
    });

    if (result.ok) {
      handleMasterResult(result.value, "output-toggle", { index, value: nextValue });
    } else {
      setMessage(result.error);
    }

    setIsMasterBusy(false);
  }

  async function runValidationSequence() {
    if (!bridge || !connectionState.connected) {
      return;
    }

    setIsMasterBusy(true);
    setValidationResult(null);
    setReportMessage("");
    const result = await bridge.modbus.runJwplcValidation({
      unitId,
      timeoutMs: serialSettings.timeoutMs
    });

    if (result.ok) {
      setValidationResult(result.value);
      setMessage(result.value.summary);
      setMasterLog((current) => [
        ...result.value.steps.map((step) => step.action).reverse(),
        ...current
      ].slice(0, 24));

      const inputStep = result.value.steps.find((step) => step.name === "Read inputs FC2");
      const feedbackStep = [...result.value.steps].reverse().find((step) => step.action.values);

      if (inputStep?.action.values) {
        setInputValues(inputStep.action.values);
      }

      if (feedbackStep?.action.values) {
        setOutputFeedbackValues(feedbackStep.action.values);
      }
    } else {
      setMessage(result.error);
    }

    setIsMasterBusy(false);
  }

  function requestValidationSequence() {
    setConfirmation({
      title: "Ejecutar validación JWPLC",
      details:
        "La secuencia escribirá temporalmente las salidas Q0_0..Q0_7 y finalizará dejando todas en OFF.",
      confirmLabel: "Ejecutar validación",
      action: () => void runValidationSequence()
    });
  }

  async function copyValidationReport() {
    if (!bridge?.reports || !validationResult) {
      setReportMessage("El canal de reportes no está disponible");
      return;
    }

    const result = await bridge.reports.copyMarkdown(validationResult.markdown);

    if (result.ok) {
      setReportMessage(`Reporte copiado: ${result.value.characters} caracteres`);
    } else {
      setReportMessage(result.error);
    }
  }

  async function saveValidationReport() {
    if (!bridge?.reports || !validationResult) {
      setReportMessage("El canal de reportes no está disponible");
      return;
    }

    const result = await bridge.reports.saveMarkdown({
      markdown: validationResult.markdown,
      defaultFileName: makeValidationReportFileName(validationResult)
    });

    if (result.ok) {
      setReportMessage(result.value.canceled ? "Guardado cancelado" : `Guardado en ${result.value.filePath}`);
    } else {
      setReportMessage(result.error);
    }
  }

  async function runGenericAction(confirmed = false) {
    if (!bridge || !connectionState.connected) {
      setGenericMessage("Conecta primero un puerto RTU");
      return;
    }

    const validationError = validateGenericCommand({
      functionCode: genericFunction,
      unitId,
      startAddress: registerStartAddress,
      quantity: registerQuantity,
      registerValue,
      valuesText: multipleValuesText
    });

    if (validationError) {
      setGenericMessage(validationError);
      return;
    }

    if (!confirmed && !isReadFunction(genericFunction)) {
      setConfirmation({
        title: "Confirmar escritura Modbus",
        details: describeGenericWrite(
          genericFunction,
          unitId,
          registerStartAddress,
          coilValue,
          registerValue,
          multipleValuesText
        ),
        confirmLabel: "Ejecutar escritura",
        action: () => void runGenericAction(true)
      });
      return;
    }

    setIsMasterBusy(true);
    setGenericMessage("Ejecutando transacción RTU...");

    try {
      const commandBase = { unitId, timeoutMs: serialSettings.timeoutMs };
      let result: SerialOperationResult<RtuMasterActionResult>;

      switch (genericFunction) {
        case "fc1":
          result = await bridge.modbus.readCoils({
            ...commandBase,
            startAddress: registerStartAddress,
            quantity: registerQuantity
          });
          break;
        case "fc2":
          result = await bridge.modbus.readDiscreteInputs({
            ...commandBase,
            startAddress: registerStartAddress,
            quantity: registerQuantity
          });
          break;
        case "fc3":
          result = await bridge.modbus.readHoldingRegisters({
            ...commandBase,
            startAddress: registerStartAddress,
            quantity: registerQuantity
          });
          break;
        case "fc4":
          result = await bridge.modbus.readInputRegisters({
            ...commandBase,
            startAddress: registerStartAddress,
            quantity: registerQuantity
          });
          break;
        case "fc5":
          result = await bridge.modbus.writeSingleCoil({
            ...commandBase,
            address: registerStartAddress,
            value: coilValue
          });
          break;
        case "fc6":
          result = await bridge.modbus.writeSingleRegister({
            ...commandBase,
            address: registerStartAddress,
            value: parseRegisterValue(registerValue)
          });
          break;
        case "fc15":
          result = await bridge.modbus.writeMultipleCoils({
            ...commandBase,
            startAddress: registerStartAddress,
            values: parseCoilValues(multipleValuesText)
          });
          break;
        case "fc16":
          result = await bridge.modbus.writeMultipleRegisters({
            ...commandBase,
            startAddress: registerStartAddress,
            values: parseRegisterValues(multipleValuesText)
          });
          break;
      }

      if (result.ok) {
        setGenericResult(result.value);
        setGenericMessage(result.value.summary);
        setMasterLog((current) => [result.value, ...current].slice(0, 24));
      } else {
        setGenericResult(null);
        setGenericMessage(result.error);
      }
    } catch (error) {
      setGenericResult(null);
      setGenericMessage(error instanceof Error ? error.message : "Falló la transacción del Maestro RTU");
    } finally {
      setIsMasterBusy(false);
    }
  }

  function saveGenericPreset() {
    const name = presetName.trim() || `${genericFunction.toUpperCase()} at ${registerStartAddress}`;
    const preset: GenericPreset = {
      id: selectedPresetId || makePresetId(),
      name,
      functionCode: genericFunction,
      unitId,
      startAddress: registerStartAddress,
      quantity: registerQuantity,
      coilValue,
      registerValue,
      valuesText: multipleValuesText
    };
    const nextPresets = selectedPresetId
      ? genericPresets.map((item) => (item.id === selectedPresetId ? preset : item))
      : [preset, ...genericPresets].slice(0, 30);

    if (persistGenericPresets(nextPresets)) {
      setGenericPresets(nextPresets);
      setSelectedPresetId(preset.id);
      setPresetName(preset.name);
      setGenericMessage(`Preset guardado: ${preset.name}`);
    } else {
      setGenericMessage("No se pudo guardar el preset localmente");
    }
  }

  function applyGenericPreset(id: string) {
    setSelectedPresetId(id);
    const preset = genericPresets.find((item) => item.id === id);

    if (!preset) {
      setPresetName("");
      return;
    }

    setPresetName(preset.name);
    setGenericFunction(preset.functionCode);
    setUnitId(preset.unitId);
    setRegisterStartAddress(preset.startAddress);
    setRegisterQuantity(preset.quantity);
    setCoilValue(preset.coilValue);
    setRegisterValue(preset.registerValue);
    setMultipleValuesText(preset.valuesText);
    setGenericResult(null);
    setGenericMessage(`Preset cargado: ${preset.name}`);
  }

  function deleteGenericPreset() {
    if (!selectedPresetId) {
      return;
    }

    const nextPresets = genericPresets.filter((item) => item.id !== selectedPresetId);

    if (persistGenericPresets(nextPresets)) {
      setGenericPresets(nextPresets);
      setSelectedPresetId("");
      setPresetName("");
      setGenericMessage("Preset eliminado");
    } else {
      setGenericMessage("No se pudieron actualizar los presets locales");
    }
  }

  async function copyMonitorLog() {
    if (!bridge?.reports || masterLog.length === 0) {
      return;
    }

    const result = await bridge.reports.copyMarkdown(buildMonitorMarkdown(masterLog));
    setMonitorMessage(result.ok ? `Registro copiado: ${result.value.characters} caracteres` : result.error);
  }

  async function saveMonitorLog() {
    if (!bridge?.reports || masterLog.length === 0) {
      return;
    }

    const result = await bridge.reports.saveMarkdown({
      markdown: buildMonitorMarkdown(masterLog),
      defaultFileName: makeMonitorFileName()
    });

    if (result.ok) {
      setMonitorMessage(result.value.canceled ? "Guardado cancelado" : `Guardado en ${result.value.filePath}`);
    } else {
      setMonitorMessage(result.error);
    }
  }

  function handleMasterResult(
    result: RtuMasterActionResult,
    action: string,
    optimisticOutput?: { index: number; value: boolean }
  ) {
    setMasterLog((current) => [result, ...current].slice(0, 24));
    setMessage(result.summary);
    setValidationResult(null);
    setReportMessage("");

    if (action === "read-inputs" && result.values) {
      setInputValues(result.values);
    }

    if (action === "read-feedback" && result.values) {
      setOutputFeedbackValues(result.values);
    }

    if (action === "pattern-55") {
      setOutputFeedbackValues(bitPattern(0x55, 8));
    }

    if (action === "all-off") {
      setOutputFeedbackValues(bitPattern(0x00, 8));
    }

    if (optimisticOutput) {
      setOutputFeedbackValues((current) =>
        Array.from({ length: 8 }, (_, index) =>
          index === optimisticOutput.index ? optimisticOutput.value : Boolean(current[index])
        )
      );
    }
  }

  function renderSerialPanel() {
    return (
      <section className="serial-panel" aria-label="Conexión serial">
        <div className="serial-summary">
          <span className={connectionState.connected ? "connection-led is-on" : "connection-led"} />
          <div>
          <h2>Serial RTU</h2>
          <p>{connectionState.connected ? `Conectado: ${connectionState.config?.path}` : message}</p>
          </div>
        </div>
        <div className="serial-controls">
          <select
            value={serialSettings.portPath}
            onChange={(event) => updateSerialSettings({ portPath: event.target.value })}
            disabled={!bridge || isLoading || connectionState.connected}
          >
            {ports.length === 0 ? (
              <option value="">Sin puertos COM</option>
            ) : (
              ports.map((port) => (
                <option key={port.path} value={port.path}>
                  {port.displayName}
                </option>
              ))
            )}
          </select>
          <span className="serial-format">{serialFormatLabel(serialSettings)}</span>
        </div>
      </section>
    );
  }

  function renderDashboard() {
    return (
      <section className="page-section" aria-label="Dispositivos">
        <header className="section-heading">
          <div>
            <h2>Dispositivos</h2>
            <p>Estado de la conexión y actividad de la sesión RTU actual.</p>
          </div>
        </header>
        <div className="dashboard-grid">
          <article className="metric-card">
            <span>Conexión</span>
            <strong>{connectionState.connected ? "Conectado" : "Inactivo"}</strong>
            <p>
              {connectionState.config
                ? `${connectionState.config.path} · ${serialFormatLabel(connectionState.config)}`
                : "Sin sesión serial"}
            </p>
          </article>
          <article className="metric-card">
            <span>Transacciones</span>
            <strong>{masterLog.length}</strong>
            <p>{issueCount === 0 ? "CRC sin errores" : `${issueCount} incidencia(s)`}</p>
          </article>
          <article className="metric-card">
            <span>Validación</span>
            <strong>{validationResult ? (validationResult.passed ? "APROBADO" : "FALLÓ") : "Pendiente"}</strong>
            <p>
              {validationResult
                ? `${passedValidationSteps}/${validationResult.steps.length} pasos`
                : "Sin ejecución"}
            </p>
          </article>
          <article className="metric-card">
            <span>Última acción</span>
            <strong>{lastAction ? `FC${lastAction.functionCode}` : "-"}</strong>
            <p>{lastAction?.summary ?? "Sin actividad RTU"}</p>
          </article>
        </div>
        {validationResult ? renderValidationPanel() : null}
      </section>
    );
  }

  function renderJwplcPreset() {
    if (!connectionState.connected) {
      return (
        <section className="empty-panel" aria-label="Diagnóstico JWPLC Basic">
          <h2>Diagnóstico JWPLC Basic</h2>
          <p>Conecta un puerto serial RTU para habilitar las operaciones.</p>
        </section>
      );
    }

    return (
      <section className="master-panel" aria-label="Diagnóstico JWPLC Basic">
        <div className="master-header">
          <div>
            <h2>Diagnóstico JWPLC Basic</h2>
            <p>
              Unidad {unitId} · FC1/FC2/FC5/FC15 · timeout {serialSettings.timeoutMs} ms
            </p>
          </div>
          <label>
            ID de unidad
            <input
              type="number"
              min="1"
              max="247"
              value={unitId}
              onChange={(event) => setUnitId(Number(event.target.value))}
              disabled={isMasterBusy}
            />
          </label>
        </div>
        <div className="probe-actions">
          <button type="button" onClick={() => runMasterAction("read-inputs")} disabled={isMasterBusy}>
            Leer entradas
          </button>
          <button type="button" onClick={() => runMasterAction("read-feedback")} disabled={isMasterBusy}>
            Leer salidas
          </button>
          <button type="button" onClick={() => runMasterAction("q0-on")} disabled={isMasterBusy}>
            Q0_0 ON
          </button>
          <button type="button" onClick={() => runMasterAction("q0-off")} disabled={isMasterBusy}>
            Q0_0 OFF
          </button>
          <button type="button" onClick={() => runMasterAction("pattern-55")} disabled={isMasterBusy}>
            Patrón 0x55
          </button>
          <button type="button" onClick={() => runMasterAction("all-off")} disabled={isMasterBusy}>
            Todo OFF
          </button>
          <button type="button" className="primary-button" onClick={requestValidationSequence} disabled={isMasterBusy}>
            <CheckCircle2 size={16} aria-hidden="true" />
            Validar equipo
          </button>
        </div>
        {renderIoPanels()}
        {validationResult ? renderValidationPanel() : null}
      </section>
    );
  }

  function renderGenericMaster() {
    if (!connectionState.connected) {
      return (
        <section className="empty-panel" aria-label="Maestro RTU">
          <h2>Maestro RTU</h2>
          <p>Conecta un puerto serial para habilitar las funciones Modbus.</p>
        </section>
      );
    }

    const isRead = isReadFunction(genericFunction);
    const isBitRead = isBitReadFunction(genericFunction);
    const isSingleWrite = isSingleWriteFunction(genericFunction);

    return (
      <section className="master-panel" aria-label="Maestro RTU">
        <div className="master-header">
          <div>
            <h2>Maestro RTU</h2>
            <p>Operaciones directas sobre bits y registros de 16 bits.</p>
          </div>
          <label>
            ID de unidad
            <input
              type="number"
              min="1"
              max="247"
              value={unitId}
              onChange={(event) => setUnitId(Number(event.target.value))}
              disabled={isMasterBusy}
            />
          </label>
        </div>
        <div className="preset-toolbar">
          <label className="generic-field">
            Solicitud guardada
            <select
              value={selectedPresetId}
              onChange={(event) => applyGenericPreset(event.target.value)}
              disabled={isMasterBusy}
            >
              <option value="">Nueva solicitud</option>
              {genericPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <label className="generic-field">
            Nombre del preset
            <input
              type="text"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder={`${genericFunction.toUpperCase()} en ${registerStartAddress}`}
              disabled={isMasterBusy}
            />
          </label>
          <button type="button" onClick={saveGenericPreset} disabled={isMasterBusy}>
            <Save size={16} aria-hidden="true" />
            {selectedPresetId ? "Actualizar" : "Guardar"}
          </button>
          <button type="button" onClick={deleteGenericPreset} disabled={isMasterBusy || !selectedPresetId}>
            <Trash2 size={16} aria-hidden="true" />
            Eliminar
          </button>
        </div>
        <div className="generic-form">
          <label className="generic-field is-wide">
            Función
            <select
              value={genericFunction}
              onChange={(event) => {
                setGenericFunction(event.target.value as GenericFunction);
                setGenericResult(null);
                setGenericMessage("");
              }}
              disabled={isMasterBusy}
            >
              {genericFunctionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="generic-field">
            {isSingleWrite ? "Dirección" : "Dirección inicial"}
            <input
              type="number"
              min="0"
              max="65535"
              value={registerStartAddress}
              onChange={(event) => setRegisterStartAddress(Number(event.target.value))}
              disabled={isMasterBusy}
            />
          </label>
          {isRead ? (
            <label className="generic-field">
              Cantidad
              <input
                type="number"
                min="1"
                max={readQuantityMax(genericFunction)}
                value={registerQuantity}
                onChange={(event) => setRegisterQuantity(Number(event.target.value))}
                disabled={isMasterBusy}
              />
            </label>
          ) : null}
          {genericFunction === "fc5" ? (
            <label className="generic-field">
              Valor
              <select
                value={coilValue ? "on" : "off"}
                onChange={(event) => setCoilValue(event.target.value === "on")}
                disabled={isMasterBusy}
              >
                <option value="on">ON</option>
                <option value="off">OFF</option>
              </select>
            </label>
          ) : null}
          {genericFunction === "fc6" ? (
            <label className="generic-field">
              Valor
              <input
                type="text"
                value={registerValue}
                onChange={(event) => setRegisterValue(event.target.value)}
                placeholder="0 o 0x1234"
                disabled={isMasterBusy}
              />
            </label>
          ) : null}
          {genericFunction === "fc15" ? (
            <label className="generic-field is-wide">
              Valores de bobina
              <input
                type="text"
                value={multipleValuesText}
                onChange={(event) => setMultipleValuesText(event.target.value)}
                placeholder="ON, OFF, 1, 0"
                disabled={isMasterBusy}
              />
            </label>
          ) : null}
          {genericFunction === "fc16" ? (
            <label className="generic-field is-wide">
              Valores de registro
              <input
                type="text"
                value={multipleValuesText}
                onChange={(event) => setMultipleValuesText(event.target.value)}
                placeholder="10, 20, 0x1234"
                disabled={isMasterBusy}
              />
            </label>
          ) : null}
          <button
            type="button"
            className="execute-button"
            onClick={() => void runGenericAction()}
            disabled={isMasterBusy}
          >
            <Play size={16} aria-hidden="true" />
            {isMasterBusy ? "Ejecutando..." : "Ejecutar"}
          </button>
        </div>
        {genericMessage ? <p className="generic-message">{genericMessage}</p> : null}
        {genericResult ? renderGenericResult(genericResult, registerStartAddress, isBitRead) : null}
      </section>
    );
  }

  function renderGenericResult(result: RtuMasterActionResult, startAddress: number, isBitResult: boolean) {
    return (
      <section className={result.exception ? "generic-result has-error" : "generic-result"}>
        <header>
          <div>
            <h3>{result.exception ? result.exception.exceptionName : result.summary}</h3>
            <p>
              FC{result.functionCode}
              {result.exception
                ? ` - Excepción 0x${result.exception.exceptionCode.toString(16).toUpperCase().padStart(2, "0")}`
                : ""}
              {" - "}
              {result.elapsedMs} ms - CRC {result.crcOk ? "OK" : "ERROR"}
            </p>
          </div>
        </header>
        {isBitResult && result.values ? (
          <div className="generic-bit-grid">
            {result.values.map((value, index) => (
              <div className={value ? "generic-bit is-on" : "generic-bit"} key={startAddress + index}>
                <span>Dirección {startAddress + index}</span>
                <strong>{value ? "ON" : "OFF"}</strong>
              </div>
            ))}
          </div>
        ) : null}
        {result.registerValues ? (
          <div className="register-grid">
            {result.registerValues.map((value, index) => (
              <div className="register-item" key={startAddress + index}>
                <span>Registro {startAddress + index}</span>
                <strong>{value}</strong>
                <code>{formatRegisterValue(value)}</code>
              </div>
            ))}
          </div>
        ) : null}
        <div className="generic-frames">
          <code>TX {result.txHex}</code>
          <code>RX {result.rxHex}</code>
        </div>
      </section>
    );
  }

  function renderIoPanels() {
    return (
      <>
        <section className="io-section" aria-label="Entradas discretas">
          <header>
            <h3>Entradas</h3>
            <p>FC2 I0_0..I0_7</p>
          </header>
          <div className="input-grid" aria-label="Entradas discretas">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className={inputValues[index] ? "input-chip is-on" : "input-chip"}>
                <span>I0_{index}</span>
                <strong>{inputValues[index] ? "ON" : "OFF"}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="io-section" aria-label="Control de salidas">
          <header>
            <h3>Salidas</h3>
            <p>FC1 realimentación · FC5 control individual</p>
          </header>
          <div className="output-grid">
            {Array.from({ length: 8 }, (_, index) => {
              const isOn = Boolean(outputFeedbackValues[index]);

              return (
                <button
                  key={index}
                  type="button"
                  className={isOn ? "output-button is-on" : "output-button"}
                  onClick={() => toggleOutput(index)}
                  disabled={isMasterBusy}
                >
                  <span>Q0_{index}</span>
                  <strong>{isOn ? "ON" : "OFF"}</strong>
                </button>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  function renderValidationPanel() {
    if (!validationResult) {
      return null;
    }

    return (
      <section className={validationResult.passed ? "validation-panel is-pass" : "validation-panel is-fail"}>
        <header>
          <div>
            <h3>{validationResult.passed ? "APROBADO" : "FALLÓ"}</h3>
            <p>
              {validationResult.passed
                ? "Secuencia de validación JWPLC completada"
                : "La validación JWPLC encontró incidencias"}
            </p>
          </div>
          <div className="report-actions">
            <button type="button" onClick={copyValidationReport}>
              <Copy size={16} aria-hidden="true" />
              Copiar
            </button>
            <button type="button" onClick={saveValidationReport}>
              <FileDown size={16} aria-hidden="true" />
              Guardar
            </button>
          </div>
        </header>
        {reportMessage ? <p className="report-status">{reportMessage}</p> : null}
        <div className="validation-steps">
          {validationResult.steps.map((step) => (
            <div key={step.name}>
              <strong>{step.passed ? "APROBADO" : "FALLÓ"}</strong>
              <span>{translateValidationStepName(step.name)}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderMonitorPage() {
    return (
      <section className="page-section" aria-label="Monitor RTU">
        <header className="section-heading">
          <div>
            <h2>Monitor RTU</h2>
            <p>{masterLog.length} transacción(es) capturada(s)</p>
          </div>
          <div className="monitor-actions">
            <button type="button" onClick={copyMonitorLog} disabled={masterLog.length === 0}>
              <Copy size={16} aria-hidden="true" />
              Copiar
            </button>
            <button type="button" onClick={saveMonitorLog} disabled={masterLog.length === 0}>
              <FileDown size={16} aria-hidden="true" />
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setMasterLog([]);
                setMonitorMessage("");
              }}
              disabled={masterLog.length === 0}
            >
              <Trash2 size={16} aria-hidden="true" />
              Limpiar
            </button>
          </div>
        </header>
        {monitorMessage ? <p className="report-status">{monitorMessage}</p> : null}
        {renderMonitorList()}
      </section>
    );
  }

  function renderMonitorList() {
    return (
      <div className="monitor-list" aria-label="Monitor RTU">
        {masterLog.length === 0 ? (
          <p>Sin transacciones RTU</p>
        ) : (
          masterLog.map((entry) => (
            <article key={`${entry.timestamp}-${entry.txHex}`}>
              <header>
                <strong>{entry.summary}</strong>
                <span>{entry.elapsedMs} ms - CRC {entry.crcOk ? "OK" : "ERROR"}</span>
              </header>
              <code>TX {entry.txHex}</code>
              <code>RX {entry.rxHex}</code>
            </article>
          ))
        )}
      </div>
    );
  }

  function renderSettings() {
    const settingsLocked = connectionState.connected;

    return (
      <section className="page-section" aria-label="Ajustes">
        <header className="section-heading">
          <div>
            <h2>Configuración serial</h2>
            <p>
              {settingsLocked
                ? "Desconecta la sesión activa para modificar la comunicación."
                : "Los cambios se guardan y se aplican en la próxima conexión."}
            </p>
          </div>
        </header>
        <div className="serial-settings-form">
          <label className="generic-field">
            Baudrate
            <select
              value={serialSettings.baudRate}
              onChange={(event) =>
                updateSerialSettings({
                  baudRate: Number(event.target.value) as SerialSettings["baudRate"]
                })
              }
              disabled={settingsLocked}
            >
              {supportedBaudRates.map((baudRate) => (
                <option key={baudRate} value={baudRate}>
                  {baudRate}
                </option>
              ))}
            </select>
          </label>
          <label className="generic-field">
            Bits de datos
            <select
              value={serialSettings.dataBits}
              onChange={(event) =>
                updateSerialSettings({
                  dataBits: Number(event.target.value) as SerialSettings["dataBits"]
                })
              }
              disabled={settingsLocked}
            >
              <option value="8">8</option>
              <option value="7">7</option>
            </select>
          </label>
          <label className="generic-field">
            Paridad
            <select
              value={serialSettings.parity}
              onChange={(event) =>
                updateSerialSettings({ parity: event.target.value as SerialSettings["parity"] })
              }
              disabled={settingsLocked}
            >
              <option value="none">Ninguna</option>
              <option value="even">Par</option>
              <option value="odd">Impar</option>
            </select>
          </label>
          <label className="generic-field">
            Bits de parada
            <select
              value={serialSettings.stopBits}
              onChange={(event) =>
                updateSerialSettings({
                  stopBits: Number(event.target.value) as SerialSettings["stopBits"]
                })
              }
              disabled={settingsLocked}
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
          <label className="generic-field">
            Timeout de respuesta
            <select
              value={serialSettings.timeoutMs}
              onChange={(event) => updateSerialSettings({ timeoutMs: Number(event.target.value) })}
              disabled={settingsLocked}
            >
              {[50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000].map((timeout) => (
                <option key={timeout} value={timeout}>
                  {timeout} ms
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="settings-grid">
          <article className="metric-card">
            <span>Próxima conexión</span>
            <strong>{serialFormatLabel(serialSettings)}</strong>
            <p>{serialSettings.portPath || "Sin puerto recordado"}</p>
          </article>
          <article className="metric-card">
            <span>Política de respuesta</span>
            <strong>{serialSettings.timeoutMs} ms</strong>
            <p>Aplicado a todas las transacciones del Maestro RTU</p>
          </article>
          <article className="metric-card">
            <span>Entorno</span>
            <strong>Electron {bridge?.versions.electron ?? "-"}</strong>
            <p>Chromium {bridge?.versions.chrome ?? "-"} / Node {bridge?.versions.node ?? "-"}</p>
          </article>
          <article className="metric-card">
            <span>Licencia</span>
            <strong>MIT clean-room</strong>
            <p>Implementación propia sin código GPL/LGPL reutilizado</p>
          </article>
        </div>
      </section>
    );
  }

  function renderActivePage() {
    if (activePage === "dashboard") {
      return renderDashboard();
    }

    if (activePage === "monitor") {
      return renderMonitorPage();
    }

    if (activePage === "generic") {
      return renderGenericMaster();
    }

    if (activePage === "settings") {
      return renderSettings();
    }

    return renderJwplcPreset();
  }

  useEffect(() => {
    void refreshPorts();
    // Run once on startup; bridge is stable for this renderer lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!confirmation) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmation(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmation]);

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true">M</span>
          <div>
            <strong>JW Modbus Tool</strong>
            <span>JW Control</span>
          </div>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={refreshPorts} disabled={!bridge || isLoading}>
            <RefreshCw size={17} aria-hidden="true" />
            Actualizar
          </button>
          {connectionState.connected ? (
            <button
              type="button"
              className="disconnect-command"
              onClick={disconnectPort}
              disabled={!bridge || isLoading}
            >
              <Unplug size={17} aria-hidden="true" />
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              className="connect-command"
              onClick={connectSelectedPort}
              disabled={!bridge || isLoading || !selectedPortAvailable}
            >
              <Plug size={17} aria-hidden="true" />
              Conectar
            </button>
          )}
          <span className="toolbar-divider" aria-hidden="true" />
          <button
            type="button"
            className={activePage === "settings" ? "is-active" : ""}
            onClick={() => setActivePage("settings")}
          >
            <Settings2 size={17} aria-hidden="true" />
            Ajustes
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <nav className="app-nav" aria-label="Áreas de trabajo">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={activePage === page.id ? "is-active" : ""}
              onClick={() => setActivePage(page.id)}
            >
              <page.icon size={17} aria-hidden="true" />
              {page.label}
            </button>
          ))}
          </nav>
          <div className="sidebar-session">
            <span className={connectionState.connected ? "connection-led is-on" : "connection-led"} />
            <div>
              <strong>{connectionState.connected ? "Sesión activa" : "Sin conexión"}</strong>
              <span>
                {(connectionState.config?.path ?? serialSettings.portPath) || "Puerto no seleccionado"}
              </span>
            </div>
          </div>
        </aside>

        <section className="app-workspace">
          {renderSerialPanel()}
          <div className="workspace-content">{renderActivePage()}</div>
        </section>
      </div>

      <footer className="app-statusbar">
        <div>
          <span className={connectionState.connected ? "connection-led is-on" : "connection-led"} />
          <strong>{connectionState.connected ? "Conectado" : "Inactivo"}</strong>
        </div>
        <span>Puerto: {(connectionState.config?.path ?? serialSettings.portPath) || "-"}</span>
        <span>Formato: {serialFormatLabel(serialSettings)}</span>
        <span>ID: {unitId}</span>
        <span className="statusbar-spacer" />
        <span>Transacciones: {masterLog.length}</span>
        <span className={issueCount > 0 ? "has-warning" : ""}>Incidencias: {issueCount}</span>
        <span>{isMasterBusy ? "Comunicando..." : "En espera"}</span>
      </footer>

      {confirmation ? (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <header>
              <span className="dialog-icon">
                <AlertTriangle size={22} aria-hidden="true" />
              </span>
              <button
                type="button"
                className="icon-button"
                onClick={() => setConfirmation(null)}
                aria-label="Cerrar confirmación"
                title="Cerrar"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div>
              <h2 id="confirm-dialog-title">{confirmation.title}</h2>
              <p>{confirmation.details}</p>
            </div>
            <footer>
              <button type="button" onClick={() => setConfirmation(null)}>
                Cancelar
              </button>
              <button type="button" className="danger-button" onClick={acceptConfirmation} autoFocus>
                <Play size={16} aria-hidden="true" />
                {confirmation.confirmLabel}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function bitPattern(pattern: number, quantity: number): boolean[] {
  return Array.from({ length: quantity }, (_, index) => (pattern & (1 << index)) !== 0);
}

function makeValidationReportFileName(result: ValidationSequenceResult): string {
  const stamp = result.timestamp.replace(/[.:]/g, "-").replace("T", "-").replace("Z", "");
  return `jwplc-validation-${stamp}.md`;
}

function formatRegisterValue(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

function describeGenericWrite(
  functionCode: GenericFunction,
  unitId: number,
  address: number,
  coilValue: boolean,
  registerValue: string,
  valuesText: string
): string {
  switch (functionCode) {
    case "fc5":
      return `Unidad ${unitId}: escribir bobina ${address} en ${coilValue ? "ON" : "OFF"}.`;
    case "fc6":
      return `Unidad ${unitId}: escribir ${registerValue} en el registro ${address}.`;
    case "fc15":
      return `Unidad ${unitId}: escribir ${parseCoilValues(valuesText).length} bobinas desde la dirección ${address}.`;
    case "fc16":
      return `Unidad ${unitId}: escribir ${parseRegisterValues(valuesText).length} registros desde la dirección ${address}.`;
    default:
      return "Esta operación modificará valores del dispositivo.";
  }
}

function translateValidationStepName(name: string): string {
  const names: Record<string, string> = {
    "Read inputs FC2": "Leer entradas FC2",
    "Write Q0_0 ON": "Escribir Q0_0 ON",
    "Verify Q0_0 ON": "Verificar Q0_0 ON",
    "Write Q0_0 OFF": "Escribir Q0_0 OFF",
    "Write pattern 0x55": "Escribir patrón 0x55",
    "Verify pattern 0x55": "Verificar patrón 0x55",
    "Write all outputs OFF": "Apagar todas las salidas",
    "Verify all outputs OFF": "Verificar todas las salidas OFF"
  };

  return names[name] ?? name;
}

function loadSerialSettings(): SerialSettings {
  try {
    const stored = window.localStorage.getItem(serialSettingsStorageKey);
    return stored ? normalizeSerialSettings(JSON.parse(stored)) : normalizeSerialSettings(null);
  } catch {
    return normalizeSerialSettings(null);
  }
}

function persistSerialSettings(settings: SerialSettings): boolean {
  try {
    window.localStorage.setItem(serialSettingsStorageKey, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

function loadGenericPresets(): GenericPreset[] {
  try {
    const stored = window.localStorage.getItem(genericPresetStorageKey);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isGenericPreset).slice(0, 30);
  } catch {
    return [];
  }
}

function persistGenericPresets(presets: GenericPreset[]): boolean {
  try {
    window.localStorage.setItem(genericPresetStorageKey, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

function isGenericPreset(value: unknown): value is GenericPreset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GenericPreset>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    isGenericFunction(candidate.functionCode) &&
    typeof candidate.unitId === "number" &&
    typeof candidate.startAddress === "number" &&
    typeof candidate.quantity === "number" &&
    typeof candidate.coilValue === "boolean" &&
    typeof candidate.registerValue === "string" &&
    typeof candidate.valuesText === "string"
  );
}

function makePresetId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildMonitorMarkdown(entries: RtuMasterActionResult[]): string {
  const lines = [
    "# JW Modbus Bus Monitor",
    "",
    `- Exported: ${new Date().toISOString()}`,
    `- Transactions: ${entries.length}`,
    ""
  ];

  entries.forEach((entry, index) => {
    lines.push(
      `## ${index + 1}. ${entry.summary}`,
      "",
      `- Timestamp: ${entry.timestamp}`,
      `- Unit ID: ${entry.unitId}`,
      `- Function: FC${entry.functionCode}`,
      `- Elapsed: ${entry.elapsedMs} ms`,
      `- CRC: ${entry.crcOk ? "OK" : "ERROR"}`,
      `- TX: \`${entry.txHex}\``,
      `- RX: \`${entry.rxHex}\``
    );

    if (entry.registerValues) {
      lines.push(`- Registers: ${entry.registerValues.map(formatRegisterValue).join(", ")}`);
    }

    if (entry.exception) {
      lines.push(`- Exception: ${entry.exception.exceptionName} (${entry.exception.exceptionCode})`);
    }

    lines.push("");
  });

  return lines.join("\n");
}

function makeMonitorFileName(): string {
  const stamp = new Date().toISOString().replace(/[.:]/g, "-").replace("T", "-").replace("Z", "");
  return `jw-modbus-monitor-${stamp}.md`;
}
