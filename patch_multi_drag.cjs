const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// Update StepRow signature
const stepRowSigOld = /function StepRow\(\{ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect \}: \{ step: TestStep; index: number; onPatch: \(patch: Partial<TestStep>\) => void; onFn: \(fn: Fn\) => void; onValue: \(value: string\) => void; onValidation: \(mode: ValidationMode\) => void; onDelete: \(\) => void; onReorder: \(from: number, to: number\) => void; selected\?: boolean; onSelect\?: \(e: React\.MouseEvent\) => void; \}\) \{/;
const stepRowSigNew = `function StepRow({ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect, dragPayload }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onValidation: (mode: ValidationMode) => void; onDelete: () => void; onReorder: (payload: string, to: number) => void; selected?: boolean; onSelect?: (e: React.MouseEvent) => void; dragPayload: number[]; }) {`;
c = c.replace(stepRowSigOld, stepRowSigNew);

// Update tr events
c = c.replace(/onDragStart=\{\(e\) => \{ e\.dataTransfer\.setData\("text\/plain", index\.toString\(\)\); e\.dataTransfer\.effectAllowed = "move"; \}\}/, 
`onDragStart={(e) => { e.dataTransfer.setData("application/json", JSON.stringify(dragPayload)); e.dataTransfer.effectAllowed = "move"; }}`);

c = c.replace(/onDrop=\{\(e\) => \{ e\.preventDefault\(\); const isBottom = dragOver === "bottom"; setDragOver\(false\); const from = Number\(e\.dataTransfer\.getData\("text\/plain"\)\); let to = index; if \(isBottom\) \{ to = index \+ 1; \} if \(from === to \|\| from === to - 1\) return; onReorder\(from, to > from \? to - 1 : to\); \}\}/, 
`onDrop={(e) => { e.preventDefault(); const isBottom = dragOver === "bottom"; setDragOver(false); const payload = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain"); let to = index; if (isBottom) { to = index + 1; } onReorder(payload, to); }}`);

c = c.replace(/onDragLeave=\{\(e\) => \{/, `onDragEnd={() => setDragOver(false)} onDragLeave={(e) => {`);

// Update TestsView mapping
c = c.replace(/onReorder=\{\(from, to\) => \{ if \(from === to\) return; pushHistory\(state\.steps\); setState\(\(current\) => \{ const steps = \[\.\.\.current\.steps\]; const \[moved\] = steps\.splice\(from, 1\); steps\.splice\(to, 0, moved\); return \{ \.\.\.current, steps, detailIndex: null \}; \}\); \}\}/, 
`dragPayload={selectedRows.includes(index) ? selectedRows : [index]} onReorder={(payload, to) => {
  let fromIndices = [];
  try { fromIndices = JSON.parse(payload); } catch(e) { fromIndices = [Number(payload)]; }
  if (!Array.isArray(fromIndices) || fromIndices.length === 0) return;
  fromIndices.sort((a,b)=>a-b);
  if (fromIndices.includes(to) || (fromIndices.length === 1 && (fromIndices[0] === to || fromIndices[0] === to - 1))) return;
  
  pushHistory(state.steps);
  setState((current) => {
    const steps = [...current.steps];
    const movedItems = fromIndices.map(i => steps[i]);
    for (let i = fromIndices.length - 1; i >= 0; i--) {
      steps.splice(fromIndices[i], 1);
    }
    const shift = fromIndices.filter(i => i < to).length;
    const finalTo = to - shift;
    steps.splice(finalTo, 0, ...movedItems);
    
    setTimeout(() => {
      const newSelection = movedItems.map((_, idx) => finalTo + idx);
      setSelectedRows(newSelection);
      setLastSelectedIndex(newSelection[0]);
    }, 0);

    return { ...current, steps, detailIndex: null };
  });
}}`);

// Update CSS directly inside the <style> block
c = c.replace(/border-top: 4px solid #00bfff !important; background-color: rgba\(0, 191, 255, 0.35\) !important; box-shadow: inset 0 3px 6px rgba\(0,191,255,0.5\) !important;/g, 'border-top: 2px solid #00bfff !important;');
c = c.replace(/border-bottom: 4px solid #00bfff !important; background-color: rgba\(0, 191, 255, 0.35\) !important; box-shadow: inset 0 -3px 6px rgba\(0,191,255,0.5\) !important;/g, 'border-bottom: 2px solid #00bfff !important;');

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
