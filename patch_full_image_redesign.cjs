const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Add helper functions getModbusOffset, getCoilsDecimal, getBitAt
const helpersCode = `
function getModbusOffset(address: string | number): number {
  const n = Number(address);
  if (!Number.isFinite(n)) return 0;
  if (n >= 40001) return n - 40001;
  if (n >= 30001) return n - 30001;
  if (n >= 10001) return n - 10001;
  if (n >= 1) return n - 1;
  return 0;
}

function getCoilsDecimal(value: unknown): number {
  try {
    const list = parseBoolList(value);
    let dec = 0;
    for (let i = 0; i < Math.min(16, list.length); i++) {
      if (list[i]) dec |= (1 << i);
    }
    return dec;
  } catch {
    return 0;
  }
}

function getBitAt(value: unknown, index: number): boolean {
  try {
    const list = parseBoolList(value);
    return !!list[index];
  } catch {
    return false;
  }
}
`;

if (!c.includes('function getModbusOffset')) {
  c = c.replace('function rawAddress(fn: Fn, address: number) {', helpersCode + '\nfunction rawAddress(fn: Fn, address: number) {');
}

// 2. Add runSingleStep and duplicateStep inside TestsView
const runSingleStepCode = `
  async function runSingleStep(index: number) {
    if (state.running) return;
    const step = state.steps[index];
    if (!step) return;

    const runningStep: TestStep = {
      ...step,
      result: "Ejecutando",
      elapsedMs: null,
      detail: "Ejecutando solicitud Modbus...",
      rows: [],
      values: "",
      at: new Date().toLocaleTimeString("es-PE", { hour12: false })
    };
    setState(curr => ({ ...curr, steps: curr.steps.map((s, i) => i === index ? runningStep : s) }));

    try {
      const executed = await executeStep(step);
      const historyId = crypto.randomUUID();
      const executedWithId = { ...executed, historyId };
      setState(curr => {
        const c = curr.cumulativeStats || { executed: 0, passed: 0, failed: 0, timeouts: 0, responsive: 0, elapsedMsTotal: 0 };
        const isPass = executed.result === "Aprobado";
        const isTimeout = executed.result === "Timeout";
        const hasElapsed = executed.elapsedMs != null;
        return {
          ...curr,
          steps: curr.steps.map((s, i) => i === index ? executedWithId : s),
          history: [...(curr.history || []), executedWithId].slice(-100),
          cumulativeStats: {
            executed: c.executed + 1,
            passed: c.passed + (isPass ? 1 : 0),
            failed: c.failed + (isPass ? 0 : 1),
            timeouts: c.timeouts + (isTimeout ? 1 : 0),
            responsive: c.responsive + (hasElapsed ? 1 : 0),
            elapsedMsTotal: c.elapsedMsTotal + (executed.elapsedMs || 0)
          }
        };
      });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error || "Error de comunicacion.");
      const result = classifyStepErrorResult(message);
      const historyId = crypto.randomUUID();
      const failed: TestStep = {
        ...step,
        result,
        elapsedMs: result === "Timeout" ? numeric(step.timeoutMs, 1000) : null,
        detail: message,
        rows: [],
        values: "",
        at: new Date().toLocaleTimeString("es-PE", { hour12: false }),
        historyId
      };
      setState(curr => {
        const c = curr.cumulativeStats || { executed: 0, passed: 0, failed: 0, timeouts: 0, responsive: 0, elapsedMsTotal: 0 };
        const isTimeout = result === "Timeout";
        const hasElapsed = failed.elapsedMs != null;
        return {
          ...curr,
          steps: curr.steps.map((s, i) => i === index ? failed : s),
          history: [...(curr.history || []), failed].slice(-100),
          cumulativeStats: {
            executed: c.executed + 1,
            passed: c.passed,
            failed: c.failed + 1,
            timeouts: c.timeouts + (isTimeout ? 1 : 0),
            responsive: c.responsive + (hasElapsed ? 1 : 0),
            elapsedMsTotal: c.elapsedMsTotal + (failed.elapsedMs || 0)
          }
        };
      });
    }
  }

  function duplicateStep(index: number) {
    const step = state.steps[index];
    if (!step) return;
    pushHistory(state.steps);
    const cloned: TestStep = {
      ...clone(step),
      id: createId(),
      result: "Pendiente",
      detail: "",
      elapsedMs: null,
      at: undefined,
      rows: []
    };
    setState(curr => {
      const steps = [...curr.steps];
      steps.splice(index + 1, 0, cloned);
      return { ...curr, steps, detailIndex: null };
    });
  }

  const allStepsChecked = state.steps.length > 0 && state.steps.every(s => s.enabled);
  function toggleAllSteps() {
    const next = !allStepsChecked;
    pushHistory(state.steps);
    setState(curr => ({
      ...curr,
      steps: curr.steps.map(s => ({ ...s, enabled: next }))
    }));
  }
`;

if (!c.includes('function runSingleStep')) {
  c = c.replace('async function runPlan(loop = false) {', runSingleStepCode + '\n  async function runPlan(loop = false) {');
}

// 3. Colgroup update: Valor ~215px, Esperado ~95px
const oldColgroupRegex = /<colgroup>[\s\S]*?<\/colgroup>/;
const newColgroup = `<colgroup>
              <col style={{ width: '36px' }} />
              <col style={{ width: '30px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '55px' }} />
              <col style={{ width: '155px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '68px' }} />
              <col style={{ width: '215px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '95px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '95px' }} />
            </colgroup>`;
c = c.replace(oldColgroupRegex, newColgroup);

// 4. Table Header Update (keep names, add global checkbox, grip column)
const oldTheadRegex = /<thead><tr><th>.*?<\/tr><\/thead>/;
const newThead = `<thead>
              <tr>
                <th style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0 4px' }}>
                  <input 
                    type="checkbox" 
                    checked={allStepsChecked} 
                    onChange={toggleAllSteps} 
                    style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer', margin: 0 }} 
                    title="Activar / Desactivar todos los pasos"
                  />
                </th>
                <th></th>
                <th>Paso</th>
                <th>Slave</th>
                <th>Funcion</th>
                <th>Direccion</th>
                <th>Cantidad</th>
                <th>Valor</th>
                <th>Validacion</th>
                <th>Esperado</th>
                <th>Timeout</th>
                <th>Resultado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>`;
c = c.replace(oldTheadRegex, newThead);

// 5. Update StepRow invocation in TestsView to pass onRunSingle and onDuplicate
const stepRowMappingRegex = /<StepRow key=\{step\.id\}[\s\S]*?onReorder=\{(payload, to) => \{/;
const newStepRowMapping = `<StepRow 
              key={step.id} 
              step={step} 
              index={index} 
              selected={selectedRows.includes(index)} 
              onSelect={(e) => handleRowClick(index, e)} 
              onPatch={(patch) => patchStep(index, patch)} 
              onFn={(fn) => changeFn(index, fn)} 
              onValue={(value) => changeValue(index, value)} 
              onValidation={(mode) => changeValidation(index, mode)} 
              onEditBits={(field) => setEditingBits({ index, field })} 
              onRunSingle={() => runSingleStep(index)}
              onDuplicate={() => duplicateStep(index)}
              onDelete={() => { 
                pushHistory(state.steps); 
                setState((current) => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index), detailIndex: null })); 
                setSelectedRows([]); 
                setLastSelectedIndex(null); 
              }} 
              dragPayload={selectedRows.includes(index) ? selectedRows : [index]} 
              onReorder={(payload, to) => {`;
c = c.replace(stepRowMappingRegex, newStepRowMapping);

// 6. Update table footer with footnotes
const tableFooterRegex = /<\/div>\s*\{editingBits && state\.steps\[editingBits\.index\] && \([\s\S]*?<\/p>/;
const newTableFooter = `</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px 4px 8px', fontSize: '0.8rem', color: 'var(--muted)', borderTop: '1px solid #1a3a52', marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>🛈</span>
            <span>Direcciones mostradas en formato Modbus (base 1). Entre paréntesis se muestra el offset (base 0).</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⠿ Arrastra para reordenar pasos.</span>
          </div>
        </div>
        {editingBits && state.steps[editingBits.index] && (
          <BitEditorModal 
            value={editingBits.field === "value" ? state.steps[editingBits.index].value : state.steps[editingBits.index].expected}
            quantity={Number(state.steps[editingBits.index].quantity) || 1}
            startAddress={state.steps[editingBits.index].address || "0"}
            onClose={() => setEditingBits(null)}
            onApply={(val, qty) => {
              if (editingBits.field === "value") {
                patchStep(editingBits.index, { value: val, quantity: String(qty) });
              } else {
                patchStep(editingBits.index, { expected: val, quantity: String(qty) });
              }
              setEditingBits(null);
            }}
          />
        )}
        <p className="testsInfo">Cantidad se usa en lecturas. Valor se usa en escrituras. Validacion define si basta respuesta/cantidad o si se comparan valores exactos.</p>`;
c = c.replace(tableFooterRegex, newTableFooter);

// 7. Update StepRow implementation
const oldStepRowRegex = /function StepRow\(\{ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect, dragPayload, onEditBits \}: \{[\s\S]*?return \([\s\S]*?<\/tr>\n\s*\);/;

const newStepRow = `function StepRow({ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect, dragPayload, onEditBits, onRunSingle, onDuplicate }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onValidation: (mode: ValidationMode) => void; onDelete: () => void; onReorder: (payload: string, to: number) => void; selected?: boolean; onSelect?: (e: React.MouseEvent) => void; dragPayload: number[]; onEditBits?: (field: "value" | "expected") => void; onRunSingle?: () => void; onDuplicate?: () => void; }) {
  const read = isRead(step.fn);
  const isSingleWrite = step.fn === "fc5" || step.fn === "fc6";
  const expectedDisabled = step.validationMode === "response" || step.validationMode === "count";
  const modeOptions: ValidationMode[] = isWrite(step.fn) ? ["response", "exact", "byAddress"] : ["count", "exact", "byAddress"];
  const isFc5On = step.value === "65280" || step.value === "1" || step.value === "true" || String(step.value).toUpperCase() === "ON";

  return (
    <tr onClick={onSelect} style={{ background: selected ? "#00bfff22" : undefined }} draggable onDragStart={(e) => { 
  e.dataTransfer.setData("application/json", JSON.stringify(dragPayload)); 
  e.dataTransfer.effectAllowed = "move"; 
  if (dragPayload.length > 1) {
    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.opacity = '0.55';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.background = '#071d30';
    ghost.style.borderRadius = '8px';
    ghost.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    ghost.style.border = '1px solid #00bfff';
    ghost.style.overflow = 'hidden';
    
    const table = document.createElement('table');
    table.className = 'testsPlanTable';
    table.style.borderCollapse = 'collapse';
    table.style.width = e.currentTarget.closest('table')?.offsetWidth + 'px' || '800px';
    table.style.margin = '0';
    
    const tbody = document.createElement('tbody');
    const allRows = Array.from(e.currentTarget.parentElement?.children || []);
    dragPayload.forEach(idx => {
       if (allRows[idx]) {
         const clone = allRows[idx].cloneNode(true) as HTMLElement;
         clone.style.background = '#00bfff22';
         clone.classList.remove('drag-over', 'drag-over-bottom');
         tbody.appendChild(clone);
       }
    });
    
    table.appendChild(tbody);
    ghost.appendChild(table);
    document.body.appendChild(ghost);
    
    e.dataTransfer.setDragImage(ghost, 30, 30);
    setTimeout(() => { if(document.body.contains(ghost)) document.body.removeChild(ghost); }, 0);
  }
}} onDragOver={(e) => { 
  e.preventDefault(); 
  e.dataTransfer.dropEffect = "move"; 
  document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => {
    if (el !== e.currentTarget) el.classList.remove('drag-over', 'drag-over-bottom');
  });
  const rect = e.currentTarget.getBoundingClientRect(); 
  const isBottom = e.clientY > rect.top + rect.height / 2; 
  if (isBottom) {
    e.currentTarget.classList.add('drag-over-bottom');
    e.currentTarget.classList.remove('drag-over');
  } else {
    e.currentTarget.classList.add('drag-over');
    e.currentTarget.classList.remove('drag-over-bottom');
  }
}} onDragEnd={() => document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'))} 
onDragLeave={(e) => { 
  const rect = e.currentTarget.getBoundingClientRect();
  if (e.clientY <= rect.top || e.clientY >= rect.bottom || e.clientX <= rect.left || e.clientX >= rect.right) {
    e.currentTarget.classList.remove('drag-over', 'drag-over-bottom');
  }
}} onDrop={(e) => { 
  e.preventDefault(); 
  const isBottom = e.currentTarget.classList.contains('drag-over-bottom');
  document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'));
  const payload = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain"); 
  let to = index; 
  if (isBottom) { to = index + 1; } 
  onReorder(payload, to); 
}}>
      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
        <input 
          type="checkbox" 
          checked={step.enabled} 
          onChange={(event) => onPatch({ enabled: event.target.checked })} 
          style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer', margin: 0 }}
        />
      </td>
      <td style={{ cursor: 'grab', textAlign: 'center', color: 'var(--muted)', userSelect: 'none' }} title="Arrastra para reordenar">⠿</td>
      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text)' }}>{index + 1}</td>
      <td>
        <input 
          type={step.fn === "delay" ? "text" : "number"} 
          min="1" 
          max="247" 
          disabled={step.fn === "delay"} 
          value={step.fn === "delay" ? "-" : step.slave} 
          onChange={(event) => onPatch({ slave: event.target.value.replace(/\\D/g, "").slice(0, 3) })} 
          onBlur={() => onPatch({ slave: clampSlave(step.slave, 2) })} 
          style={{ textAlign: 'center' }}
        />
      </td>
      <td>
        <select value={step.fn} onChange={(event) => onFn(event.target.value as Fn)}>
          {functionOrder.map((fn) => <option key={fn} value={fn}>{labels[fn]}</option>)}
        </select>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <input 
            type={step.fn === "delay" ? "text" : "number"} 
            min="0" 
            max="65535" 
            disabled={step.fn === "delay"} 
            value={step.fn === "delay" ? "-" : step.address} 
            onChange={(event) => onPatch({ address: sanitizeNumericText(event.target.value, 8) })} 
            style={{ textAlign: 'center' }}
          />
          {step.fn !== "delay" && (
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', lineHeight: '1' }}>
              ({getModbusOffset(step.address)})
            </span>
          )}
        </div>
      </td>
      <td>
        <input 
          type={!read || step.fn === "delay" ? "text" : "number"} 
          min="1" 
          disabled={!read || step.fn === "delay"} 
          value={step.fn === "delay" ? "-" : (read ? step.quantity : countFor(step))} 
          onChange={(event) => onPatch({ quantity: event.target.value.replace(/\\D/g, "").slice(0, 4) })} 
          style={{ textAlign: 'center' }}
        />
      </td>
      <td>
        {step.fn === "fc5" ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onValue(isFc5On ? "0" : "65280");
              }}
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '12px',
                background: isFc5On ? '#10b981' : '#1e3242',
                border: isFc5On ? '1px solid #34d399' : '1px solid #314a5d',
                boxShadow: isFc5On ? '0 0 8px rgba(16,185,129,0.55)' : 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '2px',
                  left: isFc5On ? '18px' : '3px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                }}
              />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isFc5On ? '#34d399' : 'var(--muted)' }}>
              {isFc5On ? 'ON' : 'OFF'}
            </span>
          </div>
        ) : step.fn === "fc15" ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#fff', fontWeight: 600, minWidth: '30px' }}>
              {getCoilsDecimal(step.value)}
            </span>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {Array.from({ length: 8 }, (_, i) => {
                const isOn = getBitAt(step.value, i);
                const isMuted = i >= (Number(step.quantity) || 1);
                return (
                  <span
                    key={i}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isMuted ? '#1a2935' : (isOn ? '#10b981' : '#253a4b'),
                      boxShadow: (!isMuted && isOn) ? '0 0 6px #10b981' : 'none',
                      border: (!isMuted && isOn) ? '1px solid #6ee7b7' : '1px solid #1c2e3d',
                      display: 'inline-block',
                      flexShrink: 0
                    }}
                  />
                );
              })}
              {(Number(step.quantity) || 1) > 8 && (
                <span style={{ background: '#0b3252', border: '1px solid #00bfff66', color: 'var(--cyan)', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px', fontWeight: 700 }}>
                  +{Math.min(8, (Number(step.quantity) || 1) - 8)}
                </span>
              )}
            </div>
            <button
              type="button"
              title="Editar bobinas"
              style={{
                minHeight: '26px',
                height: '26px',
                width: '26px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 191, 255, 0.12)',
                border: '1px solid rgba(0, 191, 255, 0.4)',
                color: 'var(--cyan)',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                flexShrink: 0
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onEditBits && onEditBits("value");
              }}
            >
              ✎
            </button>
          </div>
        ) : (read && step.fn !== "delay") ? (
          <span style={{ color: 'var(--muted)', paddingLeft: '8px' }}>-</span>
        ) : (
          <input 
            type={isSingleWrite ? "number" : "text"} 
            min="0" 
            max="65535" 
            disabled={read && step.fn !== "delay"} 
            value={read && step.fn !== "delay" ? "-" : step.value} 
            onChange={(event) => onValue(event.target.value)} 
          />
        )}
      </td>
      <td>
        <select disabled={step.fn === "delay"} value={step.validationMode} onChange={(event) => onValidation(event.target.value as ValidationMode)}>
          {modeOptions.map((mode) => <option key={mode} value={mode}>{validationLabels[mode]}</option>)}
        </select>
      </td>
      <td>
        {(!expectedDisabled && (step.fn === "fc1" || step.fn === "fc2")) ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {step.expected || "OK"}
            </span>
            <button
              type="button"
              title="Editar esperado"
              style={{ minHeight: '24px', height: '24px', width: '24px', padding: 0, background: 'rgba(0, 191, 255, 0.12)', border: '1px solid rgba(0, 191, 255, 0.4)', color: 'var(--cyan)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
              onClick={(e) => { e.stopPropagation(); onEditBits && onEditBits("expected"); }}
            >
              ✎
            </button>
          </div>
        ) : (
          <input 
            disabled={expectedDisabled || step.fn === "delay"} 
            value={step.fn === "delay" ? "-" : (expectedDisabled ? expectedAutoText(step) : step.expected)} 
            placeholder={expectedAutoText(step)} 
            onChange={(event) => onPatch({ expected: event.target.value })} 
          />
        )}
      </td>
      <td>
        <input 
          type={step.fn === "delay" ? "text" : "number"} 
          min="1" 
          step="100" 
          max="60000" 
          disabled={step.fn === "delay"} 
          value={step.fn === "delay" ? "-" : step.timeoutMs} 
          onChange={(event) => onPatch({ timeoutMs: event.target.value.replace(/\\D/g, "").slice(0, 5) })} 
          style={{ textAlign: 'center' }}
        />
      </td>
      <td><ResultPill result={step.result} /></td>
      <td>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
          <button
            type="button"
            title="Ejecutar este paso"
            style={{
              minHeight: '26px',
              height: '26px',
              width: '26px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#10b981',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.78rem'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onRunSingle && onRunSingle();
            }}
          >
            ▶
          </button>
          <button
            type="button"
            title="Duplicar paso"
            style={{
              minHeight: '26px',
              height: '26px',
              width: '26px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 191, 255, 0.12)',
              border: '1px solid rgba(0, 191, 255, 0.4)',
              color: 'var(--cyan)',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate && onDuplicate();
            }}
          >
            ⧉
          </button>
          <button
            type="button"
            title="Eliminar paso"
            style={{
              minHeight: '26px',
              height: '26px',
              width: '26px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            🗑
          </button>
        </div>
      </td>
    </tr>
  );
}`;

c = c.replace(oldStepRowRegex, newStepRow);

// 8. Replace BitEditorModal with the faithful replica of Image 2
const oldBitEditorModalRegex = /function BitEditorModal\(\{[\s\S]*?document\.body\s*\);\s*\}/;

const newBitEditorModal = `function BitEditorModal({
  value,
  quantity,
  startAddress,
  onClose,
  onApply
}: {
  value: string;
  quantity: number;
  startAddress: string;
  onClose: () => void;
  onApply: (val: string, qty: number) => void;
}) {
  const [localQuantity, setLocalQuantity] = useState<number>(() => {
    const q = Math.max(1, Math.min(16, quantity || 16));
    return q;
  });

  const [bits, setBits] = useState<boolean[]>(() => {
    const arr = Array.from({ length: 16 }, () => false);
    try {
      const parsed = parseBoolList(value);
      for (let i = 0; i < 16; i++) {
        if (i < quantity && i < parsed.length) {
          arr[i] = !!parsed[i];
        }
      }
    } catch {}
    return arr;
  });

  const baseAddress = Number(startAddress) || 0;

  const toggleBit = (index: number) => {
    if (index >= localQuantity) return;
    const next = [...bits];
    next[index] = !next[index];
    setBits(next);
  };

  const handleQuantityChange = (newQty: number) => {
    const clamped = Math.max(1, Math.min(16, newQty));
    setLocalQuantity(clamped);
    // When quantity decreases, turn off remaining bits
    setBits(prev => prev.map((b, i) => i < clamped ? b : false));
  };

  const setAll = (state: boolean) => {
    setBits(prev => prev.map((b, i) => i < localQuantity ? state : false));
  };

  const invert = () => {
    setBits(prev => prev.map((b, i) => i < localQuantity ? !b : false));
  };

  let decVal = 0;
  for (let i = 0; i < 16; i++) {
    if (i < localQuantity && bits[i]) {
      decVal |= (1 << i);
    }
  }

  const hexVal = "0x" + decVal.toString(16).toUpperCase().padStart(4, "0");

  let binVal = "";
  for (let i = 15; i >= 0; i--) {
    binVal += (i < localQuantity && bits[i]) ? "1" : "0";
    if (i > 0 && i % 4 === 0) binVal += " ";
  }

  const handleApply = () => {
    const valString = bits.slice(0, localQuantity).map(b => b ? "1" : "0").join(" ");
    onApply(valString, localQuantity);
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(2, 10, 18, 0.82)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#071b2d",
          border: "1px solid #1c4b6e",
          borderRadius: "14px",
          padding: "22px 26px",
          width: "640px",
          maxWidth: "94vw",
          maxHeight: "90vh",
          boxShadow: "0 20px 50px rgba(0,0,0,0.95), 0 0 25px rgba(0,191,255,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          color: "#edf8ff",
          userSelect: "none"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Image 2 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(0,191,255,0.12)", border: "1px solid rgba(0,191,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cyan)", fontSize: "1.4rem" }}>
              ➿
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fff", fontWeight: 700 }}>Editar bobinas</h2>
              <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                Define el patrón de {localQuantity} bobinas para la función FC15 (Write Multiple Coils).
              </p>
            </div>
          </div>
          <button
            type="button"
            className="tiny ghost"
            style={{ minWidth: "30px", height: "30px", padding: 0, borderRadius: "50%", fontSize: "1rem", color: "var(--muted)" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Info & Quantity bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#051625", padding: "8px 14px", borderRadius: "8px", border: "1px solid #16364d" }}>
          <span style={{ fontSize: "0.86rem", color: "#edf8ff" }}>
            Inicio: <strong>{startAddress}</strong> <span style={{ color: "var(--muted)" }}>(offset {getModbusOffset(startAddress)})</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.86rem", color: "var(--muted)" }}>Cantidad:</span>
            <input 
              type="number" 
              min={1} 
              max={16} 
              value={localQuantity} 
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              style={{ width: "58px", height: "28px", textAlign: "center", background: "#082136", border: "1px solid #235475", borderRadius: "5px", color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}
            />
          </div>
        </div>

        {/* 16 Coils Grid (8x2) matching Image 2 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#051625", padding: "14px", borderRadius: "10px", border: "1px solid #16364d" }}>
          {/* Row 1: Coils 0 to 7 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "8px" }}>
            {Array.from({ length: 8 }, (_, i) => {
              const isActive = i < localQuantity;
              const isOn = isActive ? bits[i] : false;
              const addr = baseAddress >= 40001 ? (baseAddress + i) : String(baseAddress + i).padStart(5, "0");

              return (
                <div 
                  key={i} 
                  style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: "6px",
                    opacity: isActive ? 1 : 0.3,
                    filter: isActive ? "none" : "grayscale(0.8)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span style={{ fontSize: "0.72rem", color: isActive ? "#9ec6e0" : "var(--muted)", fontFamily: "monospace", fontWeight: 600 }}>
                    {addr}
                  </span>
                  <div
                    onClick={() => toggleBit(i)}
                    style={{
                      width: "34px",
                      height: "19px",
                      borderRadius: "10px",
                      background: isOn ? "#10b981" : "#1b2f3f",
                      border: isOn ? "1px solid #34d399" : "1px solid #29475e",
                      boxShadow: isOn ? "0 0 8px rgba(16,185,129,0.6)" : "none",
                      position: "relative",
                      cursor: isActive ? "pointer" : "not-allowed",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div
                      style={{
                        width: "13px",
                        height: "13px",
                        borderRadius: "50%",
                        background: "#ffffff",
                        position: "absolute",
                        top: "2px",
                        left: isOn ? "17px" : "3px",
                        transition: "all 0.15s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.5)"
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 2: Coils 8 to 15 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "8px" }}>
            {Array.from({ length: 8 }, (_, i) => {
              const idx = i + 8;
              const isActive = idx < localQuantity;
              const isOn = isActive ? bits[idx] : false;
              const addr = baseAddress >= 40001 ? (baseAddress + idx) : String(baseAddress + idx).padStart(5, "0");

              return (
                <div 
                  key={idx} 
                  style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: "6px",
                    opacity: isActive ? 1 : 0.3,
                    filter: isActive ? "none" : "grayscale(0.8)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span style={{ fontSize: "0.72rem", color: isActive ? "#9ec6e0" : "var(--muted)", fontFamily: "monospace", fontWeight: 600 }}>
                    {addr}
                  </span>
                  <div
                    onClick={() => toggleBit(idx)}
                    style={{
                      width: "34px",
                      height: "19px",
                      borderRadius: "10px",
                      background: isOn ? "#10b981" : "#1b2f3f",
                      border: isOn ? "1px solid #34d399" : "1px solid #29475e",
                      boxShadow: isOn ? "0 0 8px rgba(16,185,129,0.6)" : "none",
                      position: "relative",
                      cursor: isActive ? "pointer" : "not-allowed",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div
                      style={{
                        width: "13px",
                        height: "13px",
                        borderRadius: "50%",
                        background: "#ffffff",
                        position: "absolute",
                        top: "2px",
                        left: isOn ? "17px" : "3px",
                        transition: "all 0.15s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.5)"
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acciones rápidas matching Image 2 */}
        <div>
          <span style={{ fontSize: "0.82rem", color: "var(--cyan)", fontWeight: 700, display: "block", marginBottom: "8px" }}>
            Acciones rápidas
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setAll(true)}
              style={{
                height: "36px",
                borderRadius: "8px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.35)",
                color: "#edf8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }}></span>
              Todo ON
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              style={{
                height: "36px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid #1f425c",
                color: "#edf8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", border: "1.5px solid var(--muted)" }}></span>
              Todo OFF
            </button>
            <button
              type="button"
              onClick={invert}
              style={{
                height: "36px",
                borderRadius: "8px",
                background: "rgba(0,191,255,0.08)",
                border: "1px solid rgba(0,191,255,0.35)",
                color: "#edf8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span style={{ color: "var(--cyan)", fontSize: "1.1rem" }}>⇄</span>
              Invertir
            </button>
          </div>
        </div>

        {/* Representación del patrón matching Image 2 */}
        <div>
          <span style={{ fontSize: "0.82rem", color: "var(--cyan)", fontWeight: 700, display: "block", marginBottom: "8px" }}>
            Representación del patrón
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.1fr 2fr", gap: "10px" }}>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>DEC (uint16)</span>
              <strong style={{ fontSize: "1.25rem", color: "#fff", fontFamily: "monospace" }}>{decVal}</strong>
            </div>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>HEX</span>
              <strong style={{ fontSize: "1.25rem", color: "var(--cyan)", fontFamily: "monospace" }}>{hexVal}</strong>
            </div>
            <div style={{ background: "#051625", border: "1px solid #16364d", borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>BIN (b15 ... b0)</span>
              <strong style={{ fontSize: "1.05rem", color: "#9ee6a5", fontFamily: "monospace", letterSpacing: "1px", lineHeight: "1.4" }}>{binVal}</strong>
            </div>
          </div>
        </div>

        {/* Footer buttons matching Image 2 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "6px" }}>
          <button
            type="button"
            className="ghost"
            style={{ minHeight: "36px", padding: "0 18px", fontSize: "0.88rem", borderRadius: "7px" }}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primary"
            style={{ minHeight: "36px", padding: "0 22px", fontSize: "0.88rem", borderRadius: "7px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 }}
            onClick={handleApply}
          >
            <span>✓</span>
            <span>Aplicar</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}`;

c = c.replace(oldBitEditorModalRegex, newBitEditorModal);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done faithfully implementing both images!');
