const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. In TestsView, add editingBits state
const testsViewStateFind = 'const [redoStack, setRedoStack] = useState<TestStep[][]>([]);';
const testsViewStateAdd = `const [redoStack, setRedoStack] = useState<TestStep[][]>([]);
  const [editingBits, setEditingBits] = useState<{ index: number; field: "value" | "expected" } | null>(null);`;
if (!c.includes('editingBits, setEditingBits')) {
  c = c.replace(testsViewStateFind, testsViewStateAdd);
}

// 2. In colgroup, adjust widths
const oldColgroup = `<colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '145px' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '35px' }} />
            </colgroup>`;

const newColgroup = `<colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '35px' }} />
            </colgroup>`;

c = c.replace(oldColgroup, newColgroup);

// 3. In TestsView, pass onEditBits to StepRow, and render BitEditorModal at the TestsView level
const stepRowMappingFind = `onDelete={() => { pushHistory(state.steps); setState((current) => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index), detailIndex: null })); setSelectedRows([]); setLastSelectedIndex(null); }} dragPayload={selectedRows.includes(index) ? selectedRows : [index]} onReorder={(payload, to) => {`;
const stepRowMappingReplace = `onEditBits={(field) => setEditingBits({ index, field })} onDelete={() => { pushHistory(state.steps); setState((current) => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index), detailIndex: null })); setSelectedRows([]); setLastSelectedIndex(null); }} dragPayload={selectedRows.includes(index) ? selectedRows : [index]} onReorder={(payload, to) => {`;
c = c.replace(stepRowMappingFind, stepRowMappingReplace);

// Render modal at bottom of TestsView (after </table></div>)
const tableCloseFind = `</table>\n        </div>\n        <p className="testsInfo">`;
const tableCloseReplace = `</table>\n        </div>
        {editingBits && state.steps[editingBits.index] && (
          <BitEditorModal 
            value={editingBits.field === "value" ? state.steps[editingBits.index].value : state.steps[editingBits.index].expected}
            quantity={Number(state.steps[editingBits.index].quantity) || 1}
            startAddress={state.steps[editingBits.index].address || "0"}
            onClose={() => setEditingBits(null)}
            onApply={(val) => {
              if (editingBits.field === "value") {
                changeValue(editingBits.index, val);
              } else {
                patchStep(editingBits.index, { expected: val });
              }
              setEditingBits(null);
            }}
          />
        )}
        <p className="testsInfo">`;
c = c.replace(tableCloseFind, tableCloseReplace);

// 4. Update StepRow signature to accept onEditBits
c = c.replace(/function StepRow\(\{ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect, dragPayload \}: \{ step: TestStep; index: number; onPatch: \(patch: Partial<TestStep>\) => void; onFn: \(fn: Fn\) => void; onValue: \(value: string\) => void; onValidation: \(mode: ValidationMode\) => void; onDelete: \(\) => void; onReorder: \(payload: string, to: number\) => void; selected\?: boolean; onSelect\?: \(e: React\.MouseEvent\) => void; dragPayload: number\[\]; \}\) \{[\s\S]*?const read = isRead\(step\.fn\);/, 
`function StepRow({ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect, dragPayload, onEditBits }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onValidation: (mode: ValidationMode) => void; onDelete: () => void; onReorder: (payload: string, to: number) => void; selected?: boolean; onSelect?: (e: React.MouseEvent) => void; dragPayload: number[]; onEditBits?: (field: "value" | "expected") => void; }) {
  const read = isRead(step.fn);`);

// 5. Update the Valor and Esperado cells in StepRow to use onEditBits and clean checkbox
const oldRowCellsRegex = /<td>\s*\{step\.fn === "fc5" \? \([\s\S]*?<\/td>\s*<td><select disabled=\{step\.fn === "delay"\}[\s\S]*?<\/td>\s*<td>\s*\{\(!expectedDisabled[\s\S]*?<\/td>/;

const newRowCells = `<td>
        {step.fn === "fc5" ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <input 
              type="checkbox" 
              className="fc5-checkbox" 
              checked={step.value === "65280" || step.value === "1" || step.value === "true" || String(step.value).toUpperCase() === "ON"} 
              onChange={(e) => onValue(e.target.checked ? "65280" : "0")} 
              onClick={(e) => e.stopPropagation()} 
              style={{ width: '19px', height: '19px', cursor: 'pointer', accentColor: '#00bfff', margin: 0 }}
            />
          </div>
        ) : step.fn === "fc15" ? (
          <BitPreview value={step.value} quantity={Number(step.quantity) || 1} onClick={() => onEditBits && onEditBits("value")} />
        ) : (
          <input type={isSingleWrite ? "number" : "text"} min="0" max="65535" disabled={read && step.fn !== "delay"} value={read && step.fn !== "delay" ? "-" : step.value} onChange={(event) => onValue(event.target.value)} />
        )}
      </td>
      <td><select disabled={step.fn === "delay"} value={step.validationMode} onChange={(event) => onValidation(event.target.value as ValidationMode)}>{modeOptions.map((mode) => <option key={mode} value={mode}>{validationLabels[mode]}</option>)}</select></td>
      <td>
        {(!expectedDisabled && (step.fn === "fc1" || step.fn === "fc2")) ? (
          <BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => onEditBits && onEditBits("expected")} />
        ) : (
          <input disabled={expectedDisabled || step.fn === "delay"} value={step.fn === "delay" ? "-" : (expectedDisabled ? expectedAutoText(step) : step.expected)} placeholder={expectedAutoText(step)} onChange={(event) => onPatch({ expected: event.target.value })} />
        )}
      </td>`;

c = c.replace(oldRowCellsRegex, newRowCells);

// 6. Replace BitPreview and BitEditorModal with the clean, perfectly styled versions
const oldBitComponentsRegex = /\/\/ HMR trigger[\s\S]*function BitPreview[\s\S]*function BitEditorModal[\s\S]*?\n\}/;

const newBitComponents = `// HMR trigger
function BitPreview({ value, quantity, onClick }: { value: string; quantity: number; onClick: () => void }) {
  let bits: boolean[] = [];
  try {
    bits = parseBoolList(value);
  } catch {
    bits = [];
  }
  const displayBits = bits.slice(0, 8);
  const hasMore = quantity > 8;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#041727",
        border: "1px solid #2d5c75",
        borderRadius: "6px",
        padding: "3px 6px",
        width: "100%",
        height: "34px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", gap: "3px", alignItems: "center", overflow: "hidden" }}>
        {displayBits.length === 0 ? (
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>OFF...</span>
        ) : (
          displayBits.map((b, i) => (
            <span
              key={i}
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                display: "inline-block",
                background: b ? "#00c8ff" : "#2f4554",
                boxShadow: b ? "0 0 5px #00c8ff" : "none",
                flexShrink: 0,
              }}
            />
          ))
        )}
        {hasMore && <span style={{ color: "var(--muted)", fontSize: "0.68rem", marginLeft: "2px" }}>+{quantity - 8}</span>}
      </div>
      <button
        type="button"
        style={{
          minHeight: "22px",
          height: "22px",
          padding: "0 7px",
          fontSize: "0.72rem",
          fontWeight: 700,
          background: "rgba(0, 191, 255, 0.12)",
          border: "1px solid rgba(0, 191, 255, 0.45)",
          color: "var(--cyan)",
          borderRadius: "4px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClick();
        }}
      >
        Editar
      </button>
    </div>
  );
}

function BitEditorModal({
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
  onApply: (val: string) => void;
}) {
  const q = Math.max(1, Math.min(64, quantity));
  const [bits, setBits] = useState<boolean[]>(() => {
    try {
      const parsed = parseBoolList(value);
      return Array.from({ length: Math.max(q, parsed.length) }, (_, i) => !!parsed[i]);
    } catch {
      return Array.from({ length: q }, () => false);
    }
  });

  const baseAddress = Number(startAddress) || 0;

  const toggleAll = (state: boolean) => setBits(bits.map(() => state));
  const invertAll = () => setBits(bits.map(b => !b));

  const handleApply = () => {
    onApply(bits.map(b => (b ? "1" : "0")).join(" "));
  };

  let decValueStr = "0";
  let hexValueStr = "0";
  try {
    let big = 0n;
    for (let i = 0; i < bits.length; i++) {
      if (bits[i]) big |= 1n << BigInt(i);
    }
    decValueStr = big.toString();
    hexValueStr = big.toString(16).toUpperCase().padStart(Math.max(2, Math.ceil(bits.length / 4)), "0");
  } catch {}

  const binValueStr = bits
    .map(b => (b ? "1" : "0"))
    .reverse()
    .join("")
    .replace(/(.{4})/g, "$1 ")
    .trim();

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(2, 10, 18, 0.78)",
        backdropFilter: "blur(4px)",
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
          background: "#071d30",
          border: "1px solid #245d82",
          borderRadius: "12px",
          padding: "18px 22px",
          width: "480px",
          maxWidth: "92vw",
          maxHeight: "88vh",
          boxShadow: "0 16px 48px rgba(0,0,0,0.95), 0 0 24px rgba(0,191,255,0.18)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          color: "#edf8ff",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1c4560", paddingBottom: "8px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--cyan)", fontWeight: 700 }}>Configuración de Bobinas</h3>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              Inicio: <strong style={{ color: "#fff" }}>{startAddress}</strong> • <strong style={{ color: "#fff" }}>{bits.length}</strong> bobina(s)
            </span>
          </div>
          <button
            type="button"
            className="tiny ghost"
            style={{ minWidth: "26px", height: "26px", padding: 0, borderRadius: "50%", fontSize: "0.85rem" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: "7px",
            maxHeight: "38vh",
            overflowY: "auto",
            padding: "4px 2px",
          }}
        >
          {bits.map((b, i) => (
            <div
              key={i}
              onClick={() => {
                const next = [...bits];
                next[i] = !b;
                setBits(next);
              }}
              style={{
                background: b ? "rgba(0, 191, 255, 0.18)" : "rgba(255, 255, 255, 0.03)",
                border: b ? "1px solid #00bfff" : "1px solid #24465d",
                borderRadius: "6px",
                padding: "6px 2px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "0.65rem", color: "var(--muted)", fontFamily: "monospace" }}>
                {String(baseAddress + i).padStart(5, "0")}
              </span>
              <div
                style={{
                  width: "15px",
                  height: "15px",
                  borderRadius: "50%",
                  background: b ? "#00e1ff" : "#223543",
                  boxShadow: b ? "0 0 7px #00e1ff" : "inset 0 1px 3px rgba(0,0,0,0.6)",
                  border: b ? "1px solid #a6f2ff" : "1px solid #1a2a35",
                }}
              />
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: b ? "#00e1ff" : "var(--muted)" }}>
                {b ? "1" : "0"}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start" }}>
          <button type="button" className="tiny ghost" style={{ height: "26px", fontSize: "0.76rem" }} onClick={() => toggleAll(true)}>
            Todo ON
          </button>
          <button type="button" className="tiny ghost" style={{ height: "26px", fontSize: "0.76rem" }} onClick={() => toggleAll(false)}>
            Todo OFF
          </button>
          <button type="button" className="tiny ghost" style={{ height: "26px", fontSize: "0.76rem" }} onClick={invertAll}>
            Invertir
          </button>
        </div>

        <div
          style={{
            background: "#041423",
            border: "1px solid #1c4560",
            borderRadius: "7px",
            padding: "8px 12px",
            fontFamily: "monospace",
            fontSize: "0.84rem",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)" }}>DEC:</span>
            <strong style={{ color: "#fff" }}>{decValueStr}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)" }}>HEX:</span>
            <strong style={{ color: "var(--cyan)" }}>0x{hexValueStr}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)" }}>BIN:</span>
            <strong style={{ color: "#74e27f", fontSize: "0.78rem" }}>{binValueStr}</strong>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "2px" }}>
          <button type="button" className="ghost" style={{ minHeight: "30px", fontSize: "0.82rem" }} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="primary" style={{ minHeight: "30px", fontSize: "0.82rem", padding: "0 16px" }} onClick={handleApply}>
            Aplicar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}`;

c = c.replace(oldBitComponentsRegex, newBitComponents);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done refactoring modal to TestsView level and inline styling!');
