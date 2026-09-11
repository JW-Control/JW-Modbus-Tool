const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Remove the modal from the end of the Fragment
c = c.replace(/\{\s*showBitEditor && \(\s*<BitEditorModal[\s\S]*?\/>\s*\)\s*\}\s*<\/>/, '</>');

// 2. Put the Modal inside the 'Valor' and 'Esperado' cells
const oldValCell = /<BitPreview value=\{step\.value\} quantity=\{Number\(step\.quantity\) \|\| 1\} onClick=\{\(\) => setShowBitEditor\("value"\)\} \/>/;
const newValCell = `<BitPreview value={step.value} quantity={Number(step.quantity) || 1} onClick={() => setShowBitEditor("value")} />
    {showBitEditor === "value" && (
      <BitEditorModal 
        value={step.value}
        quantity={Number(step.quantity) || 1}
        startAddress={step.address}
        onClose={() => setShowBitEditor(false)}
        onApply={(val) => { onValue(val); setShowBitEditor(false); }}
      />
    )}`;
c = c.replace(oldValCell, newValCell);

const oldExpCell = /<BitPreview value=\{step\.expected\} quantity=\{Number\(step\.quantity\) \|\| 1\} onClick=\{\(\) => setShowBitEditor\("expected"\)\} \/>/;
const newExpCell = `<BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => setShowBitEditor("expected")} />
    {showBitEditor === "expected" && (
      <BitEditorModal 
        value={step.expected}
        quantity={Number(step.quantity) || 1}
        startAddress={step.address}
        onClose={() => setShowBitEditor(false)}
        onApply={(val) => { onPatch({ expected: val }); setShowBitEditor(false); }}
      />
    )}`;
c = c.replace(oldExpCell, newExpCell);

// 3. For FC05, change the toggle to a standard checkbox
const oldFc5 = /<div className="fc5-toggle">[\s\S]*?<\/div>/;
const newFc5 = `<input type="checkbox" className="fc5-checkbox" checked={step.value === "65280"} onChange={(e) => onValue(e.target.checked ? "65280" : "0")} onClick={(e) => e.stopPropagation()} />`;
c = c.replace(oldFc5, newFc5);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done');
