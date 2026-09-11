const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Colgroup adjustments: reduce Activo from 40 to 32, Paso from 45 to 38, expand Esperado from 100 to 115
c = c.replace(
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
            </colgroup>`,
  `<colgroup>
              <col style={{ width: '32px' }} />
              <col style={{ width: '38px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '175px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '165px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '115px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '35px' }} />
            </colgroup>`
);

// 2. Update TestsView invocation of RegisterExpectedModal to also patch address and quantity
const oldModalInvoke = `        {editingRegisters && state.steps[editingRegisters.index] && (
          <RegisterExpectedModal
            step={state.steps[editingRegisters.index]}
            onClose={() => setEditingRegisters(null)}
            onApply={(expectedVal, validationMode) => {
              patchStep(editingRegisters.index, { expected: expectedVal, validationMode });
              setEditingRegisters(null);
            }}
          />
        )}`;

const newModalInvoke = `        {editingRegisters && state.steps[editingRegisters.index] && (
          <RegisterExpectedModal
            step={state.steps[editingRegisters.index]}
            onClose={() => setEditingRegisters(null)}
            onApply={(expectedVal, validationMode, newAddress, newQty) => {
              patchStep(editingRegisters.index, { 
                expected: expectedVal, 
                validationMode,
                address: newAddress,
                quantity: String(newQty)
              });
              setEditingRegisters(null);
            }}
          />
        )}`;

c = c.replace(oldModalInvoke, newModalInvoke);

// 3. Update Esperado button icon in StepRow to match FC15 (use pencil ✎ and exact style)
const oldEsperadoBtn = `            <button
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
            </button>`;

const newEsperadoBtn = `            <button
              type="button"
              title="Configurar valores esperados"
              style={{
                minHeight: "24px",
                height: "24px",
                width: "24px",
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
                fontSize: "0.9rem",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEditRegisters && onEditRegisters();
              }}
            >
              ✎
            </button>`;

if (c.includes(oldEsperadoBtn)) {
  c = c.replace(oldEsperadoBtn, newEsperadoBtn);
} else {
  // Try normalized
  const cNorm = c.replace(/\r\n/g, '\n');
  const oldNorm = oldEsperadoBtn.replace(/\r\n/g, '\n');
  if (cNorm.includes(oldNorm)) {
    c = cNorm.replace(oldNorm, newEsperadoBtn);
  }
}

// 4. Replace RegisterExpectedModal implementation with full editable Inicio and Cantidad
const oldModalRegex = /function RegisterExpectedModal\(\{[\s\S]*?return createPortal\([\s\S]*?document\.body\s*\);\s*\}/;

const newModalCode = `function RegisterExpectedModal({
  step,
  onClose,
  onApply
}: {
  step: TestStep;
  onClose: () => void;
  onApply: (expected: string, validationMode: ValidationMode, newAddress: string, newQuantity: number) => void;
}) {
  const fn = step.fn;
  const [localAddress, setLocalAddress] = useState<string>(step.address || "40000");
  const [localQuantity, setLocalQuantity] = useState<number>(() => {
    return Math.max(1, Math.min(125, Number(step.quantity) || 1));
  });

  const offset = getModbusOffset(localAddress);

  const [validationMode, setValidationMode] = useState<ValidationMode>(
    step.validationMode === "exact" ? "exact" : (step.validationMode || "exact")
  );
  const [dataType, setDataType] = useState<"UInt16" | "Int16" | "Hex16">("UInt16");

  // Parse existing expected values
  const [values, setValues] = useState<number[]>(() => {
    const parts = splitValues(step.expected);
    const arr: number[] = [];
    for (let i = 0; i < localQuantity; i++) {
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
  const startNum = parseInt(localAddress, 10) || 0;

  const handleQuantityChange = (newQty: number) => {
    const clamped = Math.max(1, Math.min(125, newQty));
    setLocalQuantity(clamped);
    setValues(prev => {
      const next: number[] = [];
      for (let i = 0; i < clamped; i++) {
        next.push(prev[i] !== undefined ? prev[i] : (i === 0 ? 100 : (i === 1 ? 200 : 0)));
      }
      return next;
    });
    if (selectedIndex >= clamped) {
      setSelectedIndex(clamped - 1);
    }
  };

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
    const formatted = values.slice(0, localQuantity).map(v => {
      const clamped = ((v % 65536) + 65536) % 65536;
      return dataType === "Hex16" 
        ? "0x" + clamped.toString(16).toUpperCase().padStart(4, "0") 
        : String(dataType === "Int16" ? (clamped > 32767 ? clamped - 65536 : clamped) : clamped);
    }).join(" ");
    onApply(formatted, validationMode, localAddress, localQuantity);
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
          width: "530px",
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
        {/* Header matching modal styling */}
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
              fontSize: "1.25rem"
            }}>
              ✎
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

        {/* Info bar with editable Inicio & Cantidad */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#051625",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid #16364d",
          fontSize: "0.86rem",
          gap: "10px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "var(--muted)" }}>Inicio:</span>
            <input
              type="text"
              value={localAddress}
              onChange={(e) => setLocalAddress(sanitizeNumericText(e.target.value, 8))}
              style={{
                width: "75px",
                height: "28px",
                textAlign: "center",
                background: "#082136",
                border: "1px solid #235475",
                borderRadius: "5px",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "0.88rem",
                fontFamily: "monospace"
              }}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>(offset {offset})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "var(--muted)" }}>Cantidad:</span>
            <input
              type="number"
              min={1}
              max={125}
              value={localQuantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              style={{
                width: "55px",
                height: "28px",
                textAlign: "center",
                background: "#082136",
                border: "1px solid #235475",
                borderRadius: "5px",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "0.88rem"
              }}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>registros</span>
          </div>
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
              {values.slice(0, localQuantity).map((val, idx) => {
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
}`;

c = c.replace(oldModalRegex, newModalCode);
fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Successfully updated FC03 modal with editable Inicio and Cantidad, column widths, and FC15-style pencil button!');
