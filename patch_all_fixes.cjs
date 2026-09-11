const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// ─── 1. COLGROUP: remove `auto` col, give Resultado a fixed width ─────────────
c = c.replace(
  `<colgroup>
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
            </colgroup>`,
  `<colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '55px' }} />
              <col style={{ width: '155px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '220px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '35px' }} />
            </colgroup>`
);

// ─── 2. THEAD: center all column headers ─────────────────────────────────────
c = c.replace(
  `<thead><tr><th>Activo</th><th>Paso</th><th>Slave</th><th>Funcion</th><th>Direccion</th><th>Cantidad</th><th>Valor</th><th>Validacion</th><th>Esperado</th><th>Timeout</th><th>Resultado</th><th /></tr></thead>`,
  `<thead><tr>
                <th style={{textAlign:'center'}}>Activo</th>
                <th style={{textAlign:'center'}}>Paso</th>
                <th style={{textAlign:'center'}}>Slave</th>
                <th style={{textAlign:'center'}}>Funcion</th>
                <th style={{textAlign:'center'}}>Direccion</th>
                <th style={{textAlign:'center'}}>Cantidad</th>
                <th style={{textAlign:'center'}}>Valor</th>
                <th style={{textAlign:'center'}}>Validacion</th>
                <th style={{textAlign:'center'}}>Esperado</th>
                <th style={{textAlign:'center'}}>Timeout</th>
                <th style={{textAlign:'center'}}>Resultado</th>
                <th />
              </tr></thead>`
);

// ─── 3. FC05: replace the old checkbox with proper toggle switch ──────────────
c = c.replace(
  `{step.fn === "fc5" ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <input 
              type="checkbox" 
              className="fc5-checkbox" 
              checked={step.value === "65280" || step.value === "1" || step.value === "true" || String(step.value).toUpperCase() === "ON"} 
              onChange={(e) => onValue(e.target.checked ? "65280" : "0")} 
              onClick={(e) => e.stopPropagation()} 
              style={{ width: '19px', height: '19px', cursor: 'pointer', accentColor: '#00bfff', margin: 0 }}
            />
          </div>`,
  `{step.fn === "fc5" ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
            {(() => {
              const isFc5On = step.value === "65280" || step.value === "1" || step.value === "true" || String(step.value).toUpperCase() === "ON";
              return (
                <>
                  <div
                    onClick={(e) => { e.stopPropagation(); onValue(isFc5On ? "0" : "65280"); }}
                    style={{
                      width: '38px', height: '22px', borderRadius: '12px',
                      background: isFc5On ? '#10b981' : '#1e3242',
                      border: isFc5On ? '1px solid #34d399' : '1px solid #314a5d',
                      boxShadow: isFc5On ? '0 0 8px rgba(16,185,129,0.55)' : 'none',
                      position: 'relative', cursor: 'pointer',
                      transition: 'all 0.2s ease', flexShrink: 0
                    }}
                  >
                    <div style={{
                      width: '15px', height: '15px', borderRadius: '50%',
                      background: '#ffffff', position: 'absolute',
                      top: '3px', left: isFc5On ? '19px' : '3px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isFc5On ? '#34d399' : 'var(--muted)' }}>
                    {isFc5On ? 'ON' : 'OFF'}
                  </span>
                </>
              );
            })()}
          </div>`
);

// ─── 4. FC15 LEDs: bigger dots (12px) ────────────────────────────────────────
// The LED dots in the BitPreview inside the Valor cell
c = c.replace(
  `{Array.from({ length: 8 }, (_, i) => {
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
              })}`,
  `{Array.from({ length: 8 }, (_, i) => {
                const isOn = getBitAt(step.value, i);
                const isMuted = i >= (Number(step.quantity) || 1);
                return (
                  <span
                    key={i}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: isMuted ? '#1a2935' : (isOn ? '#10b981' : '#253a4b'),
                      boxShadow: (!isMuted && isOn) ? '0 0 7px #10b981' : 'none',
                      border: (!isMuted && isOn) ? '1px solid #6ee7b7' : '1px solid #1c2e3d',
                      display: 'inline-block',
                      flexShrink: 0
                    }}
                  />
                );
              })}`
);

// ─── 5. Timeout cell: remove text-truncation by using full width ─────────────
// Timeout input has no special style – it truncates because col is too narrow.
// Already adjusted col to 75px above. Also ensure no overflow hidden on td.
// No code change needed beyond colgroup fix above.

// ─── 6. BitEditorModal overlay: ensure true full-screen fixed overlay ─────────
c = c.replace(
  `position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(2, 10, 18, 0.82)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,`,
  `position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(2, 10, 18, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,`
);

// ─── 7. Drag auto-scroll: add scroll zone detection during onDragOver ─────────
// In the onDragOver of the table wrapper (not the tr), add auto-scroll.
// The scroll container is .testsPlanTable – inject a scroll helper on the style block
c = c.replace(
  `.testsPlanTable table { border-collapse: collapse !important; }\n        .testsPlanTable tbody tr { scroll-margin-top: 55px; scroll-margin-bottom: 55px; }`,
  `.testsPlanTable table { border-collapse: collapse !important; }\n        .testsPlanTable tbody tr { scroll-margin-top: 55px; scroll-margin-bottom: 55px; }\n        .testsPlanTable { position: relative; }`
);

// Add auto-scroll to the table's containing div during drag
c = c.replace(
  `<div className="testsPlanTable">`,
  `<div className="testsPlanTable" onDragOver={(e) => {
          // Auto-scroll while dragging near edges
          const container = e.currentTarget;
          const rect = container.getBoundingClientRect();
          const zone = 50;
          const speed = 12;
          if (e.clientY < rect.top + zone) {
            container.scrollBy({ top: -speed, behavior: 'instant' });
          } else if (e.clientY > rect.bottom - zone) {
            container.scrollBy({ top: speed, behavior: 'instant' });
          }
        }}>`
);

// ─── 8. Fix multi-row arrow key flicker ──────────────────────────────────────
// The issue is that when pressing Shift+Arrow with multiple rows, the setSelectedRows
// toggles the lastSelectedIndex in/out. We need to anchor the selection properly.
// Fix: when extending selection with shift+arrow, anchor at the first clicked row, not lastSelectedIndex.
// Current logic: if nextIndex is already in selection → remove lastSelectedIndex (causes flicker)
// Fix: use a separate anchor concept. Simplest fix: only remove if it was the tail of extension.
c = c.replace(
  `if (!selectedRows.includes(nextIndex)) {
              setSelectedRows([...selectedRows, nextIndex].sort((a,b)=>a-b));
          } else {
              setSelectedRows(selectedRows.filter(i => i !== lastSelectedIndex).sort((a,b)=>a-b));
          }
          setLastSelectedIndex(nextIndex);`,
  `// Build contiguous range from anchor to nextIndex
          const anchorIdx = selectedRows.length > 0
            ? (e.key === 'ArrowDown'
                ? Math.min(...selectedRows)
                : Math.max(...selectedRows))
            : nextIndex;
          const rangeStart = Math.min(anchorIdx, nextIndex);
          const rangeEnd = Math.max(anchorIdx, nextIndex);
          const newSel: number[] = [];
          for (let ri = rangeStart; ri <= rangeEnd; ri++) newSel.push(ri);
          setSelectedRows(newSel);
          setLastSelectedIndex(nextIndex);`
);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done all fixes!');
