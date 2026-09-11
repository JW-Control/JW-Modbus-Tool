const fs = require('fs');
let c = fs.readFileSync('src/renderer/SimpleModeApp.tsx', 'utf8');

const newTestsView = `
function TestsView({ tests, setTests, undo, redo, canUndo, canRedo, runTests, busy }: { tests: TestRow[]; setTests: (t: TestRow[]) => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean; runTests: () => void; busy: boolean }) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      else if (e.ctrlKey && e.key === 'c' && selectedRow !== null && tests[selectedRow]) {
        e.preventDefault();
        navigator.clipboard.writeText(JSON.stringify({ __jwmodbus_test: true, data: tests[selectedRow] }));
      }
      else if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          try {
            const parsed = JSON.parse(text);
            if (parsed.__jwmodbus_test && parsed.data) {
              const newTests = [...tests];
              const insertAt = selectedRow !== null ? selectedRow + 1 : newTests.length;
              newTests.splice(insertAt, 0, { ...parsed.data, result: 'Pendiente' });
              newTests.forEach((t, i) => t.step = i + 1);
              setTests(newTests);
              setSelectedRow(insertAt);
            }
          } catch (e) {}
        }).catch(() => {});
      }
      else if (e.ctrlKey && e.key === 'd' && selectedRow !== null && tests[selectedRow]) {
        e.preventDefault();
        const newTests = [...tests];
        const insertAt = selectedRow + 1;
        newTests.splice(insertAt, 0, { ...tests[selectedRow], result: 'Pendiente' });
        newTests.forEach((t, i) => t.step = i + 1);
        setTests(newTests);
        setSelectedRow(insertAt);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tests, selectedRow, undo, redo, setTests]);

  const passed = tests.filter((item) => item.result === "Aprobado").length;
  const failed = tests.filter((item) => !["Aprobado", "Pendiente"].includes(item.result)).length;

  return <div className="tests grid"><Card title="Plan de pruebas al slave" className="plan" action={<div><button className="primary" onClick={runTests}><Play size={15} />{busy ? "Ejecutando" : "Iniciar prueba"}</button><button><Square size={14} />Detener</button></div>}><p>PC como Master</p><div className="tableactions"><button onClick={undo} disabled={!canUndo}>Deshacer</button><button onClick={redo} disabled={!canRedo}>Rehacer</button><button onClick={() => { const newTests = [...tests, { enabled: true, step: tests.length + 1, slave: 1, device: "Nuevo", fn: "fc3", label: "Holding Registers (03)", address: 0, amount: 1, expected: "", timeout: 1000, result: "Pendiente" } as TestRow]; setTests(newTests); setSelectedRow(newTests.length - 1); }}>+ Agregar paso</button><button><Save size={15} />Guardar plan</button></div><Table columns={["Activo", "Paso", "Slave", "Funcin", "Direccin", "Cantidad/Valor", "Esperado", "Timeout", "Resultado"]} rows={tests.map((item) => [item.enabled ? "o"" : "", item.step, <SelectChip text={item.device} />, <SelectChip text={item.label} />, item.address, item.amount, item.expected, \`\${item.timeout} ms\`, <Status status={item.result} />])} onRowClick={setSelectedRow} selectedRow={selectedRow ?? undefined} /><p className="note"><Info size={15} />Selecciona una fila. Usa Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y.</p></Card><Card title="Escenarios" className="scenarios"><Scenario label="Operacin normal" text="Verifica lectura y escritura correcta." ok /><Scenario label="Timeout detectado" text="Simula dispositivos no disponibles." warn /><Scenario label="Error CRC detectado" text="Introduce errores de CRC en la trama." warn /><Scenario label="Excepcin Modbus" text="Forza cdigos de excepcin (01, 02, 03)." danger /><button className="ghost">Gestionar escenarios</button></Card><Card title="Simulador slave (PC como slave)" className="sim"><Field label="Estado" value="Detenido" /><Field label="Direccin slave" value="1" suffix="(1?"247)" /><Field label="Puerto" value="COM3" select /><Field label="Baud Rate" value="115200" select /><button className="purple"><Play size={15} />Iniciar simulador slave</button><button><Settings size={15} /></button></Card><div className="testkpis"><Big label="Tasa de Ǹxito" value={tests.length ? \`\${Math.round((passed / tests.length) * 100)}%\` : "0%"} note="sltima ejecucin" /><Big label="Latencia promedio" value="?"" note="Limpia" /><Big label="Errores" value={String(failed)} note="sltima ejecucin" danger /><Big label="Pasos completados" value={\`\${passed}/\${tests.length}\`} note="sltima ejecucin" /></div><Card title="Registro de ejecucin" className="exec"><Table columns={["Hora", "Paso", "Slave", "Funcin", "Direccin", "Cantidad/Valor", "Resultado", "Tiempo", "Detalle"]} rows={tests.map((item) => ["?"", item.step, item.device, item.label, item.address, item.amount, <Status status={item.result} />, "?"", item.result === "Pendiente" ? "Pendiente de ejecucin." : "Ejecutado."])} /></Card></div>;
}
`;

c = c.replace(/function TestsView\(\{ tests, runTests, busy \}: \{ tests: TestRow\[\]; runTests: \(\) => void; busy: boolean \}\) \{[\s\S]*?(?=function RegistersView)/, newTestsView);

fs.writeFileSync('src/renderer/SimpleModeApp.tsx', c);
console.log("Done");
