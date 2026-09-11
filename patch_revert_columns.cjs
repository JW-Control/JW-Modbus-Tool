const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Revert colgroup to exactly 12 columns with Valor 220px and Esperado 95px
const oldColgroupRegex = /<colgroup>[\s\S]*?<\/colgroup>/;
const exact12Colgroup = `<colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '220px' }} />
              <col style={{ width: '145px' }} />
              <col style={{ width: '95px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '35px' }} />
            </colgroup>`;
c = c.replace(oldColgroupRegex, exact12Colgroup);

// 2. Revert thead to exactly original 12 column headers
const oldTheadRegex = /<thead>[\s\S]*?<\/thead>/;
const exact12Thead = `<thead><tr><th>Activo</th><th>Paso</th><th>Slave</th><th>Funcion</th><th>Direccion</th><th>Cantidad</th><th>Valor</th><th>Validacion</th><th>Esperado</th><th>Timeout</th><th>Resultado</th><th /></tr></thead>`;
c = c.replace(oldTheadRegex, exact12Thead);

// 3. Remove footnote bar under the table
const oldFootnoteRegex = /<\/table>\s*<\/div>\s*<div style=\{\{ display: 'flex', justifyContent: 'space-between',[\s\S]*?<\/div>\s*<\/div>\s*\{editingBits/;
c = c.replace(oldFootnoteRegex, `</table>\n        </div>\n        {editingBits`);

// 4. In StepRow, ensure exactly 12 cells:
// Cell 1: Checkbox
// Cell 2: ☰ {index + 1}
// Cell 3: Slave input
// Cell 4: Funcion select
// Cell 5: Direccion input (clean)
// Cell 6: Cantidad input
// Cell 7: Valor (FC05 toggle, FC15 8 LEDs + decimal + badge + pencil, others normal)
// Cell 8: Validacion select
// Cell 9: Esperado
// Cell 10: Timeout input
// Cell 11: ResultPill
// Cell 12: Delete x button
const oldStepRowRegex = /function StepRow\(\{ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect, dragPayload, onEditBits[\s\S]*?return \([\s\S]*?<\/tr>\n\s*\);/;

const exactStepRow = `function StepRow({ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect, dragPayload, onEditBits }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onValidation: (mode: ValidationMode) => void; onDelete: () => void; onReorder: (payload: string, to: number) => void; selected?: boolean; onSelect?: (e: React.MouseEvent) => void; dragPayload: number[]; onEditBits?: (field: "value" | "expected") => void; }) {
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
      <td><input type="checkbox" checked={step.enabled} onChange={(event) => onPatch({ enabled: event.target.checked })} /></td>
      <td style={{ cursor: 'grab' }} title="Arrastra para reordenar">☰ {index + 1}</td>
      <td><input type={step.fn === "delay" ? "text" : "number"} min="1" max="247" disabled={step.fn === "delay"} value={step.fn === "delay" ? "-" : step.slave} onChange={(event) => onPatch({ slave: event.target.value.replace(/\\D/g, "").slice(0, 3) })} onBlur={() => onPatch({ slave: clampSlave(step.slave, 2) })} /></td>
      <td><select value={step.fn} onChange={(event) => onFn(event.target.value as Fn)}>{functionOrder.map((fn) => <option key={fn} value={fn}>{labels[fn]}</option>)}</select></td>
      <td><input type={step.fn === "delay" ? "text" : "number"} min="0" max="65535" disabled={step.fn === "delay"} value={step.fn === "delay" ? "-" : step.address} onChange={(event) => onPatch({ address: sanitizeNumericText(event.target.value, 8) })} /></td>
      <td><input type={!read || step.fn === "delay" ? "text" : "number"} min="1" disabled={!read || step.fn === "delay"} value={step.fn === "delay" ? "-" : (read ? step.quantity : countFor(step))} onChange={(event) => onPatch({ quantity: event.target.value.replace(/\\D/g, "").slice(0, 4) })} /></td>
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
            <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#fff', fontWeight: 600, minWidth: '28px' }}>
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
                <span style={{ background: '#0b3252', border: '1px solid #00bfff66', color: 'var(--cyan)', fontSize: '0.65rem', padding: '1px 3px', borderRadius: '3px', fontWeight: 700 }}>
                  +{Math.min(8, (Number(step.quantity) || 1) - 8)}
                </span>
              )}
            </div>
            <button
              type="button"
              title="Editar bobinas"
              style={{
                minHeight: '24px',
                height: '24px',
                width: '24px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 191, 255, 0.12)',
                border: '1px solid rgba(0, 191, 255, 0.4)',
                color: 'var(--cyan)',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.85rem',
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
              style={{ minHeight: '22px', height: '22px', width: '22px', padding: 0, background: 'rgba(0, 191, 255, 0.12)', border: '1px solid rgba(0, 191, 255, 0.4)', color: 'var(--cyan)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}
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
        />
      </td>
      <td><ResultPill result={step.result} /></td>
      <td><button className="tiny" onClick={onDelete} title="Eliminar paso">x</button></td>
    </tr>
  );
}`;

c = c.replace(oldStepRowRegex, exactStepRow);

// 5. In StepRow call in TestsView, revert the props
const oldCallRegex = /<StepRow\s*key=\{step\.id\}[\s\S]*?onReorder=\{(payload, to) => \{/;
const cleanCall = `<StepRow 
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
              onDelete={() => { 
                pushHistory(state.steps); 
                setState((current) => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index), detailIndex: null })); 
                setSelectedRows([]); 
                setLastSelectedIndex(null); 
              }} 
              dragPayload={selectedRows.includes(index) ? selectedRows : [index]} 
              onReorder={(payload, to) => {`;
c = c.replace(oldCallRegex, cleanCall);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done reverting columns to exact 12 original headers while keeping Valor wide and modal accurate!');
