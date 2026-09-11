const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Update BitPreview component to support onChange and clickable LEDs
const oldBitPreviewRegex = /function BitPreview\(\{ value, quantity, onClick \}: \{ value: string; quantity: number; onClick: \(\) => void \}\) \{[\s\S]*?return \([\s\S]*?<\/div>\s*\);\s*\}/;

const newBitPreview = `function BitPreview({ value, quantity, onClick, onChange }: { value: string; quantity: number; onClick: () => void; onChange?: (newValue: string) => void }) {
  let bits: boolean[] = [];
  try {
    bits = parseBoolList(value);
  } catch {
    bits = [];
  }
  const q = Math.max(1, quantity);
  const fullBits = Array.from({ length: Math.max(q, bits.length) }, (_, i) => !!bits[i]);
  const displayBits = fullBits.slice(0, 8);
  const hasMore = quantity > 8;

  const toggleBitAt = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onChange) return;
    const next = [...fullBits];
    next[i] = !next[i];
    onChange(next.slice(0, q).map(b => b ? "1" : "0").join(" "));
  };

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
      <div style={{ display: "flex", gap: "4px", alignItems: "center", overflow: "hidden" }}>
        {displayBits.length > 0 && (
          <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#fff", fontWeight: 600, marginRight: "2px", flexShrink: 0 }}>
            {(() => { let d = 0; displayBits.forEach((b, i) => { if (b) d |= (1 << i); }); return d; })()}
          </span>
        )}
        {displayBits.length === 0 ? (
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>OFF</span>
        ) : (
          displayBits.map((b, i) => (
            <span
              key={i}
              onClick={(e) => toggleBitAt(i, e)}
              title={\`Bit \${i}: \${b ? '1 (ON)' : '0 (OFF)'} - Clic para alternar\`}
              style={{
                width: "11px",
                height: "11px",
                borderRadius: "50%",
                display: "inline-block",
                background: b ? "#10b981" : "#253a4b",
                boxShadow: b ? "0 0 6px #10b981" : "none",
                border: b ? "1px solid #6ee7b7" : "1px solid #1c2e3d",
                flexShrink: 0,
                cursor: onChange ? "pointer" : "default",
                transition: "all 0.15s ease",
              }}
            />
          ))
        )}
        {hasMore && <span style={{ color: "var(--muted)", fontSize: "0.68rem", marginLeft: "2px" }}>+{quantity - 8}</span>}
      </div>
      <button
        type="button"
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
          e.preventDefault();
          onClick();
        }}
      >
        ✎
      </button>
    </div>
  );
}`;

c = c.replace(oldBitPreviewRegex, newBitPreview);

// 2. Pass onChange to BitPreview in StepRow
c = c.replace(
  '<BitPreview value={step.value} quantity={Number(step.quantity) || 1} onClick={() => onEditBits && onEditBits("value")} />',
  '<BitPreview value={step.value} quantity={Number(step.quantity) || 1} onClick={() => onEditBits && onEditBits("value")} onChange={onValue} />'
);

c = c.replace(
  '<BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => onEditBits && onEditBits("expected")} />',
  '<BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => onEditBits && onEditBits("expected")} onChange={(val) => onPatch({ expected: val })} />'
);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done wiring clickable LEDs in BitPreview!');
