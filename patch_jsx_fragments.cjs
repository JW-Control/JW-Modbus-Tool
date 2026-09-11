const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

const oldValCell = `<BitPreview value={step.value} quantity={Number(step.quantity) || 1} onClick={() => setShowBitEditor("value")} />
      {showBitEditor === "value" && (
        <BitEditorModal 
          value={step.value}
          quantity={Number(step.quantity) || 1}
          startAddress={step.address}
          onClose={() => setShowBitEditor(false)}
          onApply={(val) => { onValue(val); setShowBitEditor(false); }}
        />
      )}`;

const newValCell = `<>
      <BitPreview value={step.value} quantity={Number(step.quantity) || 1} onClick={() => setShowBitEditor("value")} />
      {showBitEditor === "value" && (
        <BitEditorModal 
          value={step.value}
          quantity={Number(step.quantity) || 1}
          startAddress={step.address}
          onClose={() => setShowBitEditor(false)}
          onApply={(val) => { onValue(val); setShowBitEditor(false); }}
        />
      )}
    </>`;

c = c.replace(oldValCell, newValCell);

const oldExpCell = `<BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => setShowBitEditor("expected")} />
      {showBitEditor === "expected" && (
        <BitEditorModal 
          value={step.expected}
          quantity={Number(step.quantity) || 1}
          startAddress={step.address}
          onClose={() => setShowBitEditor(false)}
          onApply={(val) => { onPatch({ expected: val }); setShowBitEditor(false); }}
        />
      )}`;

const newExpCell = `<>
      <BitPreview value={step.expected} quantity={Number(step.quantity) || 1} onClick={() => setShowBitEditor("expected")} />
      {showBitEditor === "expected" && (
        <BitEditorModal 
          value={step.expected}
          quantity={Number(step.quantity) || 1}
          startAddress={step.address}
          onClose={() => setShowBitEditor(false)}
          onApply={(val) => { onPatch({ expected: val }); setShowBitEditor(false); }}
        />
      )}
    </>`;

c = c.replace(oldExpCell, newExpCell);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done');
