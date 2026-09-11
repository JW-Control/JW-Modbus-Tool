const fs = require('fs');

let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Append BitEditorModal and BitPreview to the file
const newComponents = `
function BitPreview({ value, quantity, onClick }: { value: string, quantity: number, onClick: () => void }) {
  let bits: boolean[] = [];
  try {
    bits = parseBoolList(value);
  } catch {
    bits = [];
  }
  const displayBits = bits.slice(0, 8);
  const hasMore = quantity > 8;
  return (
    <div className="bit-preview" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <div className="bit-preview-circles">
        {displayBits.map((b, i) => <span key={i} className={b ? 'on' : 'off'}></span>)}
        {hasMore && <span className="more-dots">...</span>}
      </div>
      <button className="tiny bit-edit-btn">▦</button>
    </div>
  );
}

function BitEditorModal({ value, quantity, startAddress, onClose, onApply }: { value: string, quantity: number, startAddress: string, onClose: () => void, onApply: (val: string) => void }) {
  const q = Math.max(1, Math.min(256, quantity));
  const [bits, setBits] = useState<boolean[]>(() => {
    try {
      const parsed = parseBoolList(value);
      return Array.from({ length: q }, (_, i) => !!parsed[i]);
    } catch {
      return Array.from({ length: q }, () => false);
    }
  });

  const baseAddress = Number(startAddress) || 0;

  const toggleAll = (state: boolean) => setBits(bits.map(() => state));
  const invertAll = () => setBits(bits.map(b => !b));

  const handleApply = () => {
    onApply(bits.map(b => b ? "1" : "0").join(" "));
  };

  let decValueStr = "0";
  let hexValueStr = "0";
  try {
    let big = 0n;
    for (let i = 0; i < bits.length; i++) {
      if (bits[i]) big |= (1n << BigInt(i));
    }
    decValueStr = big.toString();
    hexValueStr = big.toString(16).toUpperCase();
  } catch {}
  
  const binValueStr = bits.map(b => b ? "1" : "0").reverse().join("");

  return (
    <div className="bit-editor-modal-overlay" onClick={onClose}>
      <div className="bit-editor-modal" onClick={e => e.stopPropagation()}>
        <header>
          <h2>Patrón de bobinas</h2>
          <button className="tiny close-btn" onClick={onClose}>✕</button>
        </header>
        <p className="muted" style={{ marginTop: '0', marginBottom: '14px' }}>Inicio {startAddress} • {q} bobinas • Ascendente →</p>
        
        <div className="bit-grid">
          {bits.map((b, i) => (
            <div key={i} className="bit-cell" onClick={() => {
              const next = [...bits];
              next[i] = !b;
              setBits(next);
            }}>
              <small>{String(baseAddress + i).padStart(5, '0')}</small>
              <div className={\`bit-circle \${b ? 'on' : 'off'}\`}></div>
              <small className="bit-val">{b ? "1" : "0"}</small>
            </div>
          ))}
        </div>

        <div className="bit-actions">
          <button onClick={() => toggleAll(true)}>Todo ON</button>
          <button onClick={() => toggleAll(false)}>Todo OFF</button>
          <button onClick={invertAll}>Invertir</button>
        </div>

        <div className="bit-summary">
          <span><small>DEC</small> {decValueStr}</span>
          <span><small>HEX</small> 0x{hexValueStr}</span>
          <span><small>BIN</small> {binValueStr}</span>
        </div>

        <footer>
          <button className="ghost" onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={handleApply}>Aplicar</button>
        </footer>
      </div>
    </div>
  );
}
`;

c += newComponents;

// 2. Inject showBitEditor state into StepRow
c = c.replace(/function StepRow\(\{[\s\S]*?\}\) \{/, `$&
  const [showBitEditor, setShowBitEditor] = useState<"value" | "expected" | false>(false);
`);

// 3. Replace the return statement of StepRow to be wrapped in Fragment and append Modal
const oldReturnStart = /return \(\n\s*<tr/;
const newReturnStart = `return (\n    <>\n      <tr`;
c = c.replace(oldReturnStart, newReturnStart);

const oldReturnEnd = /<\/tr>\n\s*\);/;
const newReturnEnd = `</tr>
      {showBitEditor && (
        <BitEditorModal 
          value={showBitEditor === "value" ? step.value : step.expected}
          quantity={Number(step.quantity) || 1}
          startAddress={step.address}
          onClose={() => setShowBitEditor(false)}
          onApply={(val) => {
            if (showBitEditor === "value") onValue(val);
            else onPatch({ expected: val });
            setShowBitEditor(false);
          }}
        />
      )}
    </>
  );`;
c = c.replace(oldReturnEnd, newReturnEnd);

// 4. Update the cells
const oldValCell = `<td>
  {step.fn === "fc5" ? (
    <div className="fc5-toggle">
      <button className={\`toggle-btn \${step.value !== "65280" ? "off-active" : ""}\`} onClick={(e) => { e.stopPropagation(); onValue("0"); }}>OFF</button>
      <button className={\`toggle-btn \${step.value === "65280" ? "on-active" : ""}\`} onClick={(e) => { e.stopPropagation(); onValue("65280"); }}>ON</button>
    </div>
  ) : (
    <input type={isSingleWrite ? "number" : "text"} min="0" max="65535" disabled={read && step.fn !== "delay"} value={read && step.fn !== "delay" ? "-" : step.value} onChange={(event) => onValue(event.target.value)} />
  )}
</td>`;

const newValCell = `<td>
  {step.fn === "fc5" ? (
    <div className="fc5-toggle">
      <button className={\`toggle-btn \${step.value !== "65280" ? "off-active" : ""}\`} onClick={(e) => { e.stopPropagation(); onValue("0"); }}>OFF</button>
      <button className={\`toggle-btn \${step.value === "65280" ? "on-active" : ""}\`} onClick={(e) => { e.stopPropagation(); onValue("65280"); }}>ON</button>
    </div>
  ) : step.fn === "fc15" ? (
    <BitPreview value={step.value} quantity={Number(step.quantity) || 1} onClick={() => setShowBitEditor("value")} />
  ) : (
    <input type={isSingleWrite ? "number" : "text"} min="0" max="65535" disabled={read && step.fn !== "delay"} value={read && step.fn !== "delay" ? "-" : step.value} onChange={(event) => onValue(event.target.value)} />
  )}
</td>`;

c = c.replace(oldValCell, newValCell);

const oldExpCell = `<td><input disabled={expectedDisabled || step.fn === "delay"} value={step.fn === "delay" ? "-" : (expectedDisabled ? expectedAutoText(step) : step.expected)} placeholder={expectedAutoText(step)} onChange={(event) => onPatch({ expected: event.target.value })} /></td>`;

const newExpCell = `<td>
  {(!expectedDisabled && (step.fn === "fc1" || step.fn === "fc2")) ? (
    <BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => setShowBitEditor("expected")} />
  ) : (
    <input disabled={expectedDisabled || step.fn === "delay"} value={step.fn === "delay" ? "-" : (expectedDisabled ? expectedAutoText(step) : step.expected)} placeholder={expectedAutoText(step)} onChange={(event) => onPatch({ expected: event.target.value })} />
  )}
</td>`;

c = c.replace(oldExpCell, newExpCell);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
