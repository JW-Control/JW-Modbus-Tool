import { useEffect, useMemo, useRef, useState } from "react";
import { INTERNAL_SIMULATOR_PATH } from "../shared/serial/types.js";
import type { SlaveSimulatorState, VirtualDeviceFaults } from "../shared/slave/types.js";

const LINK_STORAGE_KEY = "jw-modbus-tool.tests.simulator-link.v1";

// Fault that each built-in scenario applies to the virtual devices its plan targets.
const scenarioFaults: Record<string, { faults: Partial<VirtualDeviceFaults>; label: string }> = {
  normal: { faults: { mode: "none" }, label: "Sin falla" },
  timeout: { faults: { mode: "no-response" }, label: "Sin respuesta (timeout)" },
  crc: { faults: { mode: "bad-crc" }, label: "CRC corrupto" },
  exception: { faults: { mode: "exception", exceptionCode: 2 }, label: "Excepción 02 forzada" }
};

/**
 * Card in the Tests view that ties the selected scenario to the slave
 * simulator: the virtual devices the plan talks to get the scenario's fault.
 */
export function ScenarioSimulatorLink({ scenarioId, scenarioName, planSlaves, masterPort, onMessage }: {
  scenarioId: string;
  scenarioName: string;
  planSlaves: number[];
  masterPort: string;
  onMessage: (message: string) => void;
}) {
  const slave = window.jwModbus?.slave;
  const [state, setState] = useState<SlaveSimulatorState | null>(null);
  const [linked, setLinked] = useState(() => loadLinked());
  const touched = useRef(new Set<number>());

  useEffect(() => {
    if (!slave) return;
    void slave.getState().then((result) => { if (result.ok) setState(result.value); });
    return slave.onEvent((event) => { if (event.type === "state") setState(event.state); });
  }, []);

  useEffect(() => { storeLinked(linked); }, [linked]);

  const virtualIds = useMemo(() => new Set(state?.devices.map((device) => device.unitId) ?? []), [state?.devices]);
  const uniqueSlaves = useMemo(() => [...new Set(planSlaves)].sort((left, right) => left - right), [planSlaves.join(",")]);
  const targets = uniqueSlaves.filter((id) => virtualIds.has(id));
  const realSlaves = uniqueSlaves.filter((id) => !virtualIds.has(id));
  const mapping = scenarioFaults[scenarioId];

  // Keep the targeted devices' fault mode in line with the scenario, and give
  // back a clean device when it stops being targeted or the link is turned off.
  useEffect(() => {
    if (!slave || !state) return;
    const desired = new Map<number, Partial<VirtualDeviceFaults>>();

    if (linked && mapping) {
      for (const id of targets) desired.set(id, mapping.faults);
    }

    for (const id of touched.current) {
      if (!desired.has(id) && virtualIds.has(id)) desired.set(id, { mode: "none" });
    }

    for (const [id, faults] of desired) {
      const device = state.devices.find((item) => item.unitId === id);
      if (!device) continue;
      const differs = device.faults.mode !== faults.mode || (faults.exceptionCode !== undefined && device.faults.exceptionCode !== faults.exceptionCode);
      if (differs) {
        void slave.setFaults({ unitId: id, faults }).then((result) => { if (!result.ok) onMessage(result.error); });
      }
      if (faults.mode === "none") touched.current.delete(id);
      else touched.current.add(id);
    }
  }, [linked, scenarioId, targets.join(","), state]);

  if (!slave) {
    return <section className="card testsSimulatorCard"><h2>Simulador slave <small>(PC como slave)</small></h2><p className="testsInfo">Abre la app en Electron para usar el simulador.</p></section>;
  }

  const internal = masterPort === INTERNAL_SIMULATOR_PATH;
  const status = state?.running
    ? `Escuchando en ${state.config?.path}${internal ? " + interno" : ""}`
    : internal ? "Canal interno" : "Detenido";

  return (
    <section className="card testsSimulatorCard">
      <h2>Simulador slave <small>(PC como slave)</small></h2>
      <dl className="testsSimFacts">
        <dt>Estado</dt><dd className={state?.running || internal ? "oktext" : "muted"}>{status}</dd>
        <dt>Slaves virtuales</dt><dd>{state?.devices.length ? state.devices.map((device) => `ID ${device.unitId}`).join(", ") : "Ninguno"}</dd>
        <dt>El plan usa</dt><dd>{uniqueSlaves.length ? uniqueSlaves.map((id) => `ID ${id}${virtualIds.has(id) ? " (virtual)" : ""}`).join(", ") : "—"}</dd>
      </dl>
      <label className="testsSimLink">
        <input type="checkbox" checked={linked} onChange={(event) => setLinked(event.target.checked)} />
        Aplicar el escenario a los slaves virtuales
      </label>
      <p className="testsInfo">
        {!linked
          ? "Desactivado: los slaves virtuales responden según lo configurado en la vista Simulador."
          : !mapping
            ? `"${scenarioName}" no define una falla; los slaves virtuales quedan sin falla.`
            : targets.length === 0
              ? `"${scenarioName}" aplicaría: ${mapping.label}. Ningún slave del plan es virtual.`
              : `"${scenarioName}" aplica a ID ${targets.join(", ")}: ${mapping.label}.`}
        {linked && realSlaves.length > 0 && scenarioId === "timeout" && ` ID ${realSlaves.join(", ")} no existe en el simulador: el master no recibirá respuesta.`}
      </p>
      {!state?.running && !internal && <p className="testsInfo">Para que responda al plan, inicia el simulador en un puerto COM o conecta el master a «Simulador interno (sin COM)».</p>}
    </section>
  );
}

function loadLinked() {
  try {
    return localStorage.getItem(LINK_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function storeLinked(value: boolean) {
  try {
    localStorage.setItem(LINK_STORAGE_KEY, value ? "on" : "off");
  } catch {
    /* local storage can be unavailable in previews */
  }
}
