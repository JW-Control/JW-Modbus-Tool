const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// ─── 1. Add shiftAnchorRef after lastSelectedIndex state ──────────────────────
c = c.replace(
  '  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);\r\n  const [undoStack',
  '  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);\n  const shiftAnchorRef = useRef<number | null>(null);\r\n  const [undoStack'
);

// ─── 2. In handleRowClick non-shift branch, also set shiftAnchorRef ───────────
// The non-shift/ctrl branch:
c = c.replace(
  '    } else {\r\n      setSelectedRows([index]);\r\n      setLastSelectedIndex(index);\r\n    }\r\n  }',
  '    } else {\r\n      setSelectedRows([index]);\r\n      setLastSelectedIndex(index);\r\n      shiftAnchorRef.current = index;\r\n    }\r\n  }'
);

// Also set shiftAnchorRef on ctrl+click branch:
c = c.replace(
  '      if (selectedRows.includes(index)) {\r\n        setSelectedRows(selectedRows.filter(r => r !== index));\r\n      } else {\r\n        setSelectedRows([...selectedRows, index]);\r\n      }\r\n      setLastSelectedIndex(index);',
  '      if (selectedRows.includes(index)) {\r\n        setSelectedRows(selectedRows.filter(r => r !== index));\r\n      } else {\r\n        setSelectedRows([...selectedRows, index]);\r\n      }\r\n      setLastSelectedIndex(index);\r\n      shiftAnchorRef.current = index;'
);

// ─── 3. Fix Shift+Arrow flickering: use shiftAnchorRef as fixed pivot ────────
const oldShiftArrow = `      if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (lastSelectedIndex === null) return;
        const nextIndex = e.key === 'ArrowDown' ? Math.min(state.steps.length - 1, lastSelectedIndex + 1) : Math.max(0, lastSelectedIndex - 1);
        
        let start = Math.min(selectedRows[0] ?? nextIndex, nextIndex);
        let end = Math.max(selectedRows[selectedRows.length - 1] ?? nextIndex, nextIndex);
        // Better logic: if expanding selection
        if (!selectedRows.includes(nextIndex)) {
            setSelectedRows([...selectedRows, nextIndex].sort((a,b)=>a-b));
        } else {
            setSelectedRows(selectedRows.filter(i => i !== lastSelectedIndex).sort((a,b)=>a-b));
        }
        setLastSelectedIndex(nextIndex);
        return;
      } else if (!e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        let nextIndex = 0;
        if (lastSelectedIndex !== null) {
          nextIndex = e.key === 'ArrowDown' ? Math.min(state.steps.length - 1, lastSelectedIndex + 1) : Math.max(0, lastSelectedIndex - 1);
        }
        setSelectedRows([nextIndex]);
        setLastSelectedIndex(nextIndex);
        return;
      }`;

const newShiftArrow = `      if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (lastSelectedIndex === null) return;
        // Ensure anchor is set before first shift+arrow
        if (shiftAnchorRef.current === null) shiftAnchorRef.current = lastSelectedIndex;
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(state.steps.length - 1, lastSelectedIndex + 1)
          : Math.max(0, lastSelectedIndex - 1);
        // Build contiguous range from fixed anchor to new cursor
        const anchor = shiftAnchorRef.current;
        const rangeStart = Math.min(anchor, nextIndex);
        const rangeEnd = Math.max(anchor, nextIndex);
        const newSel: number[] = [];
        for (let ri = rangeStart; ri <= rangeEnd; ri++) newSel.push(ri);
        setSelectedRows(newSel);
        setLastSelectedIndex(nextIndex);
        return;
      } else if (!e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        let nextIndex = 0;
        if (lastSelectedIndex !== null) {
          nextIndex = e.key === 'ArrowDown' ? Math.min(state.steps.length - 1, lastSelectedIndex + 1) : Math.max(0, lastSelectedIndex - 1);
        }
        setSelectedRows([nextIndex]);
        setLastSelectedIndex(nextIndex);
        shiftAnchorRef.current = nextIndex; // reset anchor on non-shift navigation
        return;
      }`;

c = c.replace(oldShiftArrow, newShiftArrow);

// ─── 4. Colgroup: Valor 165px, Funcion 185px, Timeout 100px ──────────────────
c = c.replace(
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
            </colgroup>`,
  `<colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '55px' }} />
              <col style={{ width: '185px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '165px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '35px' }} />
            </colgroup>`
);

// ─── 5. FC05: Replace checkbox with toggle switch (robust multi-line match) ────
const oldFc05 = `{step.fn === "fc5" ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <input 
              type="checkbox" 
              className="fc5-checkbox" 
              checked={step.value === "65280" || step.value === "1" || step.value === "true" || String(step.value).toUpperCase() === "ON"} 
              onChange={(e) => onValue(e.target.checked ? "65280" : "0")} 
              onClick={(e) => e.stopPropagation()} 
              style={{ width: '19px', height: '19px', cursor: 'pointer', accentColor: '#00bfff', margin: 0 }}
            />
          </div>`;

const newFc05 = `{step.fn === "fc5" ? (
          (() => {
            const isFc5On = step.value === "65280" || step.value === "1" || step.value === "true" || String(step.value).toUpperCase() === "ON";
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0 6px' }}>
                <div
                  onClick={(e) => { e.stopPropagation(); onValue(isFc5On ? "0" : "65280"); }}
                  style={{
                    width: '38px', height: '22px', borderRadius: '12px',
                    background: isFc5On ? '#10b981' : '#1e3242',
                    border: isFc5On ? '1px solid #34d399' : '1px solid #314a5d',
                    boxShadow: isFc5On ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
                    position: 'relative', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0
                  }}
                >
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: '#fff', position: 'absolute', top: '2px',
                    left: isFc5On ? '19px' : '2px', transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                  }} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isFc5On ? '#34d399' : 'var(--muted)', minWidth: '26px' }}>
                  {isFc5On ? 'ON' : 'OFF'}
                </span>
              </div>
            );
          })()`;

// Use a normalized match (collapse \r\n to \n for matching)
const cNorm = c.replace(/\r\n/g, '\n');
const oldFc05Norm = oldFc05.replace(/\r\n/g, '\n');
if (cNorm.includes(oldFc05Norm)) {
  const newC = cNorm.replace(oldFc05Norm, newFc05);
  // Restore \r\n where original file had them (rewrite without them is fine)
  c = newC;
  console.log('FC05 toggle replaced');
} else {
  console.log('FC05 old pattern NOT found - may already be patched');
}

// ─── 6. BitPreview: bigger LEDs (12px), pencil icon instead of "Editar" ──────
// Bigger dots
c = c.replace(
  `              style={{\n                width: \"7px\",\n                height: \"7px\",\n                borderRadius: \"50%\",\n                display: \"inline-block\",\n                background: b ? \"#00c8ff\" : \"#2f4554\",\n                boxShadow: b ? \"0 0 5px #00c8ff\" : \"none\",\n                flexShrink: 0,\n              }}`,
  `              style={{\n                width: \"11px\",\n                height: \"11px\",\n                borderRadius: \"50%\",\n                display: \"inline-block\",\n                background: b ? \"#10b981\" : \"#253a4b\",\n                boxShadow: b ? \"0 0 6px #10b981\" : \"none\",\n                border: b ? \"1px solid #6ee7b7\" : \"1px solid #1c2e3d\",\n                flexShrink: 0,\n              }}`
);

// Replace "Editar" button text with pencil icon, and make button square/compact
c = c.replace(
  `        style={{\n          minHeight: \"22px\",\n          height: \"22px\",\n          padding: \"0 7px\",\n          fontSize: \"0.72rem\",\n          fontWeight: 700,\n          background: \"rgba(0, 191, 255, 0.12)\",\n          border: \"1px solid rgba(0, 191, 255, 0.45)\",\n          color: \"var(--cyan)\",\n          borderRadius: \"4px\",\n          cursor: \"pointer\",\n          whiteSpace: \"nowrap\",\n          flexShrink: 0,\n        }}\n        onClick={(e) => {\n          e.stopPropagation();\n          e.preventDefault();\n          onClick();\n        }}\n      >\n        Editar\n      </button>`,
  `        style={{\n          minHeight: \"24px\",\n          height: \"24px\",\n          width: \"24px\",\n          padding: 0,\n          display: \"inline-flex\",\n          alignItems: \"center\",\n          justifyContent: \"center\",\n          background: \"rgba(0, 191, 255, 0.12)\",\n          border: \"1px solid rgba(0, 191, 255, 0.45)\",\n          color: \"var(--cyan)\",\n          borderRadius: \"4px\",\n          cursor: \"pointer\",\n          flexShrink: 0,\n          fontSize: \"0.9rem\",\n        }}\n        onClick={(e) => {\n          e.stopPropagation();\n          e.preventDefault();\n          onClick();\n        }}\n      >\n        ✎\n      </button>`
);

// Also remove the decimal number and update the "+N" badge in BitPreview
// (currently BitPreview doesn't show decimal inline - add it before the dots)
// Let's replace the inner container to add decimal
c = c.replace(
  '      <div style={{ display: "flex", gap: "3px", alignItems: "center", overflow: "hidden" }}>\n        {displayBits.length === 0 ? (\n          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>OFF...</span>\n        ) : (\n          displayBits.map((b, i) => (\n            <span\n              key={i}',
  '      <div style={{ display: "flex", gap: "4px", alignItems: "center", overflow: "hidden" }}>\n        {displayBits.length > 0 && (\n          <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#fff", fontWeight: 600, marginRight: "2px", flexShrink: 0 }}>\n            {(() => { let d = 0; displayBits.forEach((b, i) => { if (b) d |= (1 << i); }); return d; })()}\n          </span>\n        )}\n        {displayBits.length === 0 ? (\n          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>OFF</span>\n        ) : (\n          displayBits.map((b, i) => (\n            <span\n              key={i}'
);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done!');
