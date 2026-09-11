const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

c = c.replace(/function StepRow\(\{ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder \}: \{ step: TestStep; index: number; onPatch: \(patch: Partial<TestStep>\) => void; onFn: \(fn: Fn\) => void; onValue: \(value: string\) => void; onValidation: \(mode: ValidationMode\) => void; onDelete: \(\) => void; onReorder: \(from: number, to: number\) => void \}\) \{/, 'function StepRow({ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onValidation: (mode: ValidationMode) => void; onDelete: () => void; onReorder: (from: number, to: number) => void; selected?: boolean; onSelect?: () => void; }) {');

c = c.replace(/<tr\s+draggable/g, '<tr onClick={onSelect} style={{ background: selected ? "#00bfff22" : undefined }} draggable');

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
