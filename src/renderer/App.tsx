import { useEffect, useMemo, useState } from "react";
import type { SerialConnectionState, SerialPortDescriptor } from "../shared/serial/types.js";

export function App() {
  const bridge = window.jwModbus;
  const [ports, setPorts] = useState<SerialPortDescriptor[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [connectionState, setConnectionState] = useState<SerialConnectionState>({ connected: false });
  const [isLoading, setIsLoading] = useState(false);
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
    } else {
      setMessage(result.error);
    }

    setIsLoading(false);
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
      </section>
    </main>
  );
}
