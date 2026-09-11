const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Add editingRegisters state in TestsView
c = c.replace(
  'const [editingBits, setEditingBits] = useState<{ index: number; field: "value" | "expected" } | null>(null);',
  'const [editingBits, setEditingBits] = useState<{ index: number; field: "value" | "expected" } | null>(null);\n  const [editingRegisters, setEditingRegisters] = useState<{ index: number } | null>(null);'
);

// 2. Adjust colgroup: give 10px from Funcion to Esperado
c = c.replace(
  `<colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '185px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '165px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '35px' }} />
            </colgroup>`,
  `<colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '175px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '165px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '35px' }} />
            </colgroup>`
);

// 3. Pass onEditRegisters in StepRow invocation inside TestsView
c = c.replace(
  'onEditBits={(field) => setEditingBits({ index, field })}',
  'onEditBits={(field) => setEditingBits({ index, field })} onEditRegisters={() => setEditingRegisters({ index })}'
);

// 4. Render RegisterExpectedModal in TestsView
const bitModalEnd = `          />
        )}`;

const regModalRender = `          />
        )}
        {editingRegisters && state.steps[editingRegisters.index] && (
          <RegisterExpectedModal
            step={state.steps[editingRegisters.index]}
            onClose={() => setEditingRegisters(null)}
            onApply={(expectedVal, validationMode) => {
              patchStep(editingRegisters.index, { expected: expectedVal, validationMode });
              setEditingRegisters(null);
            }}
          />
        )}`;

c = c.replace(bitModalEnd, regModalRender);

// 5. Update StepRow props interface and parameter
c = c.replace(
  'dragPayload: number[]; onEditBits?: (field: "value" | "expected") => void; }) {',
  'dragPayload: number[]; onEditBits?: (field: "value" | "expected") => void; onEditRegisters?: () => void; }) {'
);

c = c.replace(
  'dragPayload, onEditBits }:',
  'dragPayload, onEditBits, onEditRegisters }:'
);

// 6. Enhance Esperado cell in StepRow for FC03 and FC04
const oldEsperadoCell = `      <td>
        {step.validationMode === "exact" && (step.fn === "fc1" || step.fn === "fc2") ? (
          <BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => onEditBits && onEditBits("expected")} onChange={(val) => onPatch({ expected: val })} emptyText="Definir" />
        ) : (
          <input disabled={expectedDisabled || step.fn === "delay"} value={step.fn === "delay" ? "-" : (expectedDisabled ? expectedAutoText(step) : step.expected)} placeholder={expectedAutoText(step)} onChange={(event) => onPatch({ expected: event.target.value })} />
        )}
      </td>`;

const newEsperadoCell = `      <td>
        {step.validationMode === "exact" && (step.fn === "fc1" || step.fn === "fc2") ? (
          <BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => onEditBits && onEditBits("expected")} onChange={(val) => onPatch({ expected: val })} emptyText="Definir" />
        ) : (step.fn === "fc3" || step.fn === "fc4") ? (
          <div style={{ display: "flex", alignItems: "center", gap: "3px", width: "100%" }}>
            <input 
              disabled={expectedDisabled || step.fn === "delay"} 
              value={step.fn === "delay" ? "-" : (expectedDisabled ? expectedAutoText(step) : step.expected)} 
              placeholder={expectedAutoText(step)} 
              onChange={(event) => onPatch({ expected: event.target.value })} 
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              title="Configurar valores esperados por registro"
              style={{
                minHeight: "22px",
                height: "22px",
                width: "22px",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 191, 255, 0.12)",
                border: "1px solid rgba(0, 191, 255, 0.45)",
                color: "var(--cyan)",
                borderRadius: "4px",
                cursor: "pointer",
                flexShrink: 0,
                fontSize: "0.82rem",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEditRegisters && onEditRegisters();
              }}
            >
              📄
            </button>
          </div>
        ) : (
          <input disabled={expectedDisabled || step.fn === "delay"} value={step.fn === "delay" ? "-" : (expectedDisabled ? expectedAutoText(step) : step.expected)} placeholder={expectedAutoText(step)} onChange={(event) => onPatch({ expected: event.target.value })} />
        )}
      </td>`;

if (c.includes(oldEsperadoCell)) {
  c = c.replace(oldEsperadoCell, newEsperadoCell);
  console.log('Updated Esperado cell');
} else {
  // Try CRLF normalization
  const cNorm = c.replace(/\r\n/g, '\n');
  const oldNorm = oldEsperadoCell.replace(/\r\n/g, '\n');
  if (cNorm.includes(oldNorm)) {
    c = cNorm.replace(oldNorm, newEsperadoCell);
    console.log('Updated Esperado cell (normalized)');
  } else {
    console.log('Esperado cell not matched');
  }
}

// 7. Append RegisterExpectedModal component
const modalComponent = `

function RegisterExpectedModal({
  step,
  onClose,
  onApply
}: {
  step: TestStep;
  onClose: () => void;
  onApply: (expected: string, validationMode: ValidationMode) => void;
}) {
  const fn = step.fn;
  const startAddress = step.address || "0";
  const qty = Math.max(1, Number(step.quantity) || 1);
  const offset = getModbusOffset(startAddress);

  const [validationMode, setValidationMode] = useState<ValidationMode>(
    step.validationMode === "exact" ? "exact" : (step.validationMode || "exact")
  );
  const [dataType, setDataType] = useState<"UInt16" | "Int16" | "Hex16">("UInt16");

  // Parse existing expected values
  const [values, setValues] = useState<number[]>(() => {
    const parts = splitValues(step.expected);
    const arr: number[] = [];
    for (let i = 0; i < qty; i++) {
      const part = parts[i];
      if (part !== undefined && part !== "") {
        const num = part.toLowerCase().startsWith("0x") ? parseInt(part, 16) : parseInt(part, 10);
        arr.push(isNaN(num) ? 0 : num);
      } else {
        arr.push(i === 0 ? 100 : (i === 1 ? 200 : 0));
      }
    }
    return arr;
  });

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const startNum = parseInt(startAddress, 10) || 0;

  const updateValue = (index: number, rawInput: string) => {
    let num = 0;
    const trimmed = rawInput.trim();
    if (trimmed.toLowerCase().startsWith("0x")) {
      num = parseInt(trimmed, 16);
    } else {
      num = parseInt(trimmed, 10);
    }
    if (isNaN(num)) num = 0;
    setValues(prev => {
      const next = [...prev];
      next[index] = num;
      return next;
    });
  };

  // Selected register representations
  const currentVal = values[selectedIndex] ?? 0;
  const u16 = ((currentVal % 65536) + 65536) % 65536;
  const s16 = u16 > 32767 ? u16 - 65536 : u16;
  const hex = "0x" + u16.toString(16).toUpperCase().padStart(4, "0");
  const bin = u16.toString(2).padStart(16, "0").replace(/(.{4})/g, "$1 ").trim();

  const handleApply = () => {
    const formatted = values.map(v => {
      const clamped = ((v % 65536) + 65536) % 65536;
      return dataType === "Hex16" 
        ? "0x" + clamped.toString(16).toUpperCase().padStart(4, "0") 
        : String(dataType === "Int16" ? (clamped > 32767 ? clamped - 65536 : clamped) : clamped);
    }).join(" ");
    onApply(formatted, validationMode);
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(2, 10, 18, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
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
          width: "520px",
          maxWidth: "94vw",
          maxHeight: "90vh",
          boxShadow: "0 20px 50px rgba(0,0,0,0.95), 0 0 25px rgba(0,191,255,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          color: "#edf8ff",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "rgba(0,191,255,0.12)",
              border: "1px solid rgba(0,191,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cyan)",
              fontSize: "1.2rem"
            }}>
              📄
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fff", fontWeight: 700 }}>Valor esperado</h2>
              <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                {fn.toUpperCase()} · {fn === "fc3" ? "Read Holding Registers" : fn === "fc4" ? "Read Input Registers" : labels[fn]}
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

        {/* Info bar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#051625",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid #16364d",
          fontSize: "0.86rem"
        }}>
          <span style={{ color: "#edf8ff" }}>
            Inicio: <strong>{startAddress}</strong> <span style={{ color: "var(--muted)" }}>(offset {offset})</span>
          </span>
          <span style={{ color: "#edf8ff" }}>
            Cantidad: <strong>{qty}</strong> {qty === 1 ? "registro" : "registros"}
          </span>
        </div>

        {/* Controls row: Tipo de dato & Validación */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
              Tipo de dato
            </label>
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value as any)}
              style={{
                width: "100%",
                background: "#051625",
                border: "1px solid #1e4b6c",
                borderRadius: "6px",
                color: "#fff",
                padding: "6px 10px",
                fontSize: "0.88rem"
              }}
            >
              <option value="UInt16">UInt16</option>
              <option value="Int16">Int16</option>
              <option value="Hex16">Hex16</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "5px" }}>
              Validación
            </label>
            <select
              value={validationMode}
              onChange={(e) => setValidationMode(e.target.value as ValidationMode)}
              style={{
                width: "100%",
                background: "#051625",
                border: "1px solid #1e4b6c",
                borderRadius: "6px",
                color: "#fff",
                padding: "6px 10px",
                fontSize: "0.88rem"
              }}
            >
              <option value="exact">Valor exacto</option>
              <option value="response">Solo respuesta OK</option>
              <option value="byAddress">Por dirección</option>
            </select>
          </div>
        </div>

        {/* Valores esperados por registro */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#00c8ff" }}>
            Valores esperados por registro
          </span>
          <div style={{
            background: "#051625",
            border: "1px solid #16364d",
            borderRadius: "8px",
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--muted)", padding: "0 4px" }}>
              <span>Registro</span>
              <span>Valor esperado</span>
            </div>
            <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", paddingRight: "4px" }}>
              {values.map((val, idx) => {
                const regAddr = startNum + idx;
                const isSelected = selectedIndex === idx;
                const displayVal = dataType === "Hex16"
                  ? "0x" + (((val % 65536) + 65536) % 65536).toString(16).toUpperCase().padStart(4, "0")
                  : dataType === "Int16"
                  ? (val > 32767 ? val - 65536 : val)
                  : (((val % 65536) + 65536) % 65536);

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedIndex(idx)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: isSelected ? "rgba(0, 191, 255, 0.1)" : "#031422",
                      border: isSelected ? "1px solid #00bfff" : "1px solid #14354c",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span style={{ fontSize: "0.86rem", fontFamily: "monospace", color: "#edf8ff" }}>
                      <strong>{regAddr}</strong> <span style={{ color: "var(--muted)", marginLeft: "6px" }}>[{idx}]</span>
                    </span>
                    <input
                      type={dataType === "Hex16" ? "text" : "number"}
                      value={displayVal}
                      onFocus={() => setSelectedIndex(idx)}
                      onChange={(e) => updateValue(idx, e.target.value)}
                      style={{
                        width: "160px",
                        height: "28px",
                        textAlign: "right",
                        padding: "2px 8px",
                        background: "#061a2b",
                        border: "1px solid #1e4b6c",
                        borderRadius: "5px",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        fontFamily: "monospace"
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Representaciones del seleccionado */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#00c8ff" }}>
            Representaciones del seleccionado
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>DEC (uint16)</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>{u16}</div>
            </div>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>DEC (int16)</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>{s16}</div>
            </div>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>HEX</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#00c8ff", fontFamily: "monospace" }}>{hex}</div>
            </div>
            <div style={{ background: "#041424", border: "1px solid #14354c", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>BIN (16 bits)</div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#10b981", fontFamily: "monospace", letterSpacing: "1px" }}>{bin}</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
          <button
            type="button"
            style={{
              background: "#0c2338",
              border: "1px solid #1e4768",
              color: "#edf8ff",
              padding: "7px 18px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 600
            }}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            style={{
              background: "#0088ff",
              border: "none",
              color: "#fff",
              padding: "7px 22px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 700,
              boxShadow: "0 0 14px rgba(0, 136, 255, 0.45)"
            }}
            onClick={handleApply}
          >
            ✓ Aplicar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
`;

c = c + modalComponent;
fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Successfully patched FC03 modal!');
