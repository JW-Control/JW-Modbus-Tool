import { useEffect, useMemo, useState } from "react";
import type {
  RtuMasterActionResult,
  ValidationSequenceResult
} from "../shared/modbus/masterActionTypes.js";
import type { SerialConnectionState, SerialPortDescriptor } from "../shared/serial/types.js";

type MasterAction = "read-inputs" | "read-feedback" | "q0-on" | "q0-off" | "pattern-55" | "all-off";

export function App() {
  const bridge = window.jwModbus;
  const [ports, setPorts] = useState<SerialPortDescriptor[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [connectionState, setConnectionState] = useState<SerialConnectionState>({ connected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [isMasterBusy, setIsMasterBusy] = useState(false);
  const [unitId, setUnitId] = useState(2);
  const [inputValues, setInputValues] = useState<boolean[]>([]);
  const [outputFeedbackValues, setOutputFeedbackValues] = useState<boolean[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationSequenceResult | null>(null);
  const [masterLog, setMasterLog] = useState<RtuMasterActionResult[]>([]);
  const [message, setMessage] = useState(bridge ? "Ready" : "Open in Electron to access serial ports");

  const selectedPortLabel = useMemo(
    () => ports.find((port) => port.path === selectedPort)?.displayName ?? selectedPort,
    [ports, selectedPort]
  );

  async function refreshPorts() {
    if (!bridge) {
      setMessage("Electron bridge unavailable in browser preview");
      return;
    }

    setIsLoading(true);
    const result = await bridge.serial.listPorts();

    if (result.ok) {
      setPorts(result.value);
      setSelectedPort((current) => current || result.value[0]?.path || "");
      setMessage(result.value.length > 0 ? "Ports refreshed" : "No serial ports detected");
    } else {
      setMessage(result.error);
    }

    setIsLoading(false);
  }

  async function connectSelectedPort() {
    if (!bridge || !selectedPort) {
      return;
    }

    setIsLoading(true);
    const result = await bridge.serial.open({
      path: selectedPort,
      baudRate: 115200,
      dataBits: 8,
      parity: "none",
      stopBits: 1
    });

    if (result.ok) {
      setConnectionState(result.value);
      setMessage(`Connected to ${selectedPortLabel}`);
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
      setMessage("Disconnected");
      setInputValues([]);
      setOutputFeedbackValues([]);
      setValidationResult(null);
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
      timeoutMs: 1000
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
      timeoutMs: 1000
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
    const result = await bridge.modbus.runJwplcValidation({ unitId, timeoutMs: 1000 });

    if (result.ok) {
      setValidationResult(result.value);
      setMessage(result.value.summary);
      setMasterLog((current) => [
        ...result.value.steps.map((step) => step.action).reverse(),
        ...current
      ].slice(0, 12));

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

  function handleMasterResult(
    result: RtuMasterActionResult,
    action: string,
    optimisticOutput?: { index: number; value: boolean }
  ) {
    setMasterLog((current) => [result, ...current].slice(0, 12));
    setMessage(result.summary);
    setValidationResult(null);

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

  useEffect(() => {
    void refreshPorts();
    // Run once on startup; bridge is stable for this renderer lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="app-shell">
      <section className="intro-panel">
        <p className="eyebrow">JW Control</p>
        <h1>JW Modbus Tool</h1>
        <p>
          Project skeleton for a clean-room Modbus RTU desktop tool. This first
          stage keeps the renderer intentionally minimal while the RTU engine
          and tests are built out.
        </p>
        <div className="serial-panel" aria-label="Serial diagnostics">
          <div>
            <h2>Serial RTU</h2>
            <p>{connectionState.connected ? `Connected: ${connectionState.config?.path}` : message}</p>
          </div>
          <div className="serial-controls">
            <select
              value={selectedPort}
              onChange={(event) => setSelectedPort(event.target.value)}
              disabled={!bridge || isLoading || connectionState.connected}
            >
              {ports.length === 0 ? (
                <option value="">No COM ports</option>
              ) : (
                ports.map((port) => (
                  <option key={port.path} value={port.path}>
                    {port.displayName}
                  </option>
                ))
              )}
            </select>
            <button type="button" onClick={refreshPorts} disabled={!bridge || isLoading}>
              Refresh
            </button>
            {connectionState.connected ? (
              <button type="button" onClick={disconnectPort} disabled={!bridge || isLoading}>
                Disconnect
              </button>
            ) : (
              <button type="button" onClick={connectSelectedPort} disabled={!bridge || isLoading || !selectedPort}>
                Connect 115200 8N1
              </button>
            )}
          </div>
        </div>
        {connectionState.connected ? (
          <div className="master-panel" aria-label="Modbus RTU master probe">
            <div className="master-header">
              <div>
                <h2>JWPLC Basic Probe</h2>
                <p>Slave ID 2, FC1/FC2/FC5/FC15, timeout 1000 ms</p>
              </div>
              <label>
                Unit ID
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
                Read Inputs
              </button>
              <button type="button" onClick={() => runMasterAction("read-feedback")} disabled={isMasterBusy}>
                Read Feedback
              </button>
              <button type="button" onClick={() => runMasterAction("q0-on")} disabled={isMasterBusy}>
                Q0_0 ON
              </button>
              <button type="button" onClick={() => runMasterAction("q0-off")} disabled={isMasterBusy}>
                Q0_0 OFF
              </button>
              <button type="button" onClick={() => runMasterAction("pattern-55")} disabled={isMasterBusy}>
                Pattern 0x55
              </button>
              <button type="button" onClick={() => runMasterAction("all-off")} disabled={isMasterBusy}>
                All OFF
              </button>
              <button type="button" onClick={runValidationSequence} disabled={isMasterBusy}>
                Run Validation
              </button>
            </div>
            <section className="io-section" aria-label="Discrete input indicators">
              <header>
                <h3>Inputs</h3>
                <p>FC2 I0_0..I0_7</p>
              </header>
              <div className="input-grid" aria-label="Discrete inputs">
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className={inputValues[index] ? "input-chip is-on" : "input-chip"}>
                    <span>I0_{index}</span>
                    <strong>{inputValues[index] ? "ON" : "OFF"}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="io-section" aria-label="Output controls">
              <header>
                <h3>Outputs</h3>
                <p>FC1 feedback, FC5 individual control</p>
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
            {validationResult ? (
              <section className={validationResult.passed ? "validation-panel is-pass" : "validation-panel is-fail"}>
                <header>
                  <h3>{validationResult.passed ? "PASS" : "FAIL"}</h3>
                  <p>{validationResult.summary}</p>
                </header>
                <div className="validation-steps">
                  {validationResult.steps.map((step) => (
                    <div key={step.name}>
                      <strong>{step.passed ? "PASS" : "FAIL"}</strong>
                      <span>{step.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <div className="monitor-list" aria-label="RTU monitor">
              {masterLog.length === 0 ? (
                <p>No RTU transactions yet</p>
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
          </div>
        ) : null}
      </section>
    </main>
  );
}

function bitPattern(pattern: number, quantity: number): boolean[] {
  return Array.from({ length: quantity }, (_, index) => (pattern & (1 << index)) !== 0);
}
