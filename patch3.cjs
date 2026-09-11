const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. We need to inject states into TestsView
// Find: const [state, setState] = useState<TestsState>(() => createInitialState(runtimeState, defaultSlave));
const injectState = `const [state, setState] = useState<TestsState>(() => createInitialState(runtimeState, defaultSlave));
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<TestStep[][]>([]);
  const [redoStack, setRedoStack] = useState<TestStep[][]>([]);

  function pushHistory(newSteps: TestStep[]) {
    setUndoStack(curr => [...curr, state.steps].slice(-50));
    setRedoStack([]);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(curr => curr.slice(0, -1));
    setRedoStack(curr => [...curr, state.steps].slice(-50));
    setState(s => ({ ...s, steps: prev }));
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(curr => curr.slice(0, -1));
    setUndoStack(curr => [...curr, state.steps].slice(-50));
    setState(s => ({ ...s, steps: next }));
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      else if (e.ctrlKey && e.key === 'c' && selectedRow !== null && state.steps[selectedRow]) {
        e.preventDefault();
        navigator.clipboard.writeText(JSON.stringify({ __jwmodbus_test: true, data: stripStep(state.steps[selectedRow]) }));
      }
      else if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          try {
            const parsed = JSON.parse(text);
            if (parsed.__jwmodbus_test && parsed.data) {
              const newStep = createStep(defaultSlave, parsed.data.fn, parsed.data.address, parsed.data.quantity, parsed.data.value, parsed.data.validationMode);
              newStep.expected = parsed.data.expected || "";
              newStep.timeout = parsed.data.timeout || 1000;
              const nextSteps = [...state.steps];
              const insertAt = selectedRow !== null ? selectedRow + 1 : nextSteps.length;
              nextSteps.splice(insertAt, 0, newStep);
              pushHistory(nextSteps);
              setState(s => ({ ...s, steps: nextSteps }));
              setSelectedRow(insertAt);
            }
          } catch (e) {}
        }).catch(() => {});
      }
      else if (e.ctrlKey && e.key === 'd' && selectedRow !== null && state.steps[selectedRow]) {
        e.preventDefault();
        const newStep = createStep(defaultSlave, state.steps[selectedRow].fn, state.steps[selectedRow].address, state.steps[selectedRow].quantity, state.steps[selectedRow].value, state.steps[selectedRow].validationMode);
        newStep.expected = state.steps[selectedRow].expected;
        newStep.timeout = state.steps[selectedRow].timeout;
        const nextSteps = [...state.steps];
        const insertAt = selectedRow + 1;
        nextSteps.splice(insertAt, 0, newStep);
        pushHistory(nextSteps);
        setState(s => ({ ...s, steps: nextSteps }));
        setSelectedRow(insertAt);
      }
      else if (e.key === 'Delete' && selectedRow !== null && state.steps[selectedRow]) {
        e.preventDefault();
        const nextSteps = state.steps.filter((_, idx) => idx !== selectedRow);
        pushHistory(nextSteps);
        setState(s => ({ ...s, steps: nextSteps, detailIndex: null }));
        setSelectedRow(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.steps, selectedRow, undoStack, redoStack]);
`;

c = c.replace('const [state, setState] = useState<TestsState>(() => createInitialState(runtimeState, defaultSlave));', injectState);

// 2. Wrap editor functions to call pushHistory BEFORE setState
c = c.replace(/function patchStep\(index: number, patch: Partial<TestStep>\) \{/g, 'function patchStep(index: number, patch: Partial<TestStep>) { pushHistory(state.steps);');
c = c.replace(/<button onClick=\{\(\) => setState\(\(current\) => \(\{ \.\.\.current, steps: \[\.\.\.current\.steps, createStep\(defaultSlave, "fc3", "40000", "1", "", "count"\)\] \}\)\)\}>/g, '<button onClick={() => { pushHistory(state.steps); setState((current) => ({ ...current, steps: [...current.steps, createStep(defaultSlave, "fc3", "40000", "1", "", "count")] })); }}>');

// 3. Reorder logic
c = c.replace(/onReorder=\{\(from, to\) => \{ if \(from === to\) return; setState\(\(current\) => \{ const steps = \[\.\.\.current\.steps\]; const \[moved\] = steps\.splice\(from, 1\); steps\.splice\(to, 0, moved\); return \{ \.\.\.current, steps, detailIndex: null \}; \}\); \}\}/g, 'onReorder={(from, to) => { if (from === to) return; pushHistory(state.steps); setState((current) => { const steps = [...current.steps]; const [moved] = steps.splice(from, 1); steps.splice(to, 0, moved); return { ...current, steps, detailIndex: null }; }); }}');

// 4. Delete logic in StepRow
c = c.replace(/onDelete=\{\(\) => setState\(\(current\) => \(\{ \.\.\.current, steps: current\.steps\.filter\(\(_, itemIndex\) => itemIndex !== index\), detailIndex: null \}\)\)\}/g, 'onDelete={() => { pushHistory(state.steps); setState((current) => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index), detailIndex: null })); setSelectedRow(null); }}');

// 5. Apply selectedRow to StepRow
c = c.replace(/<StepRow key=\{step\.id\} step=\{step\} index=\{index\}/g, '<StepRow key={step.id} step={step} index={index} selected={selectedRow === index} onSelect={() => setSelectedRow(index)}');

// 6. We must modify StepRow to accept `selected` and `onSelect` and render a selected style!
// Find StepRow definition
const injectStepRow = `function StepRow({ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onValidation: (mode: ValidationMode) => void; onDelete: () => void; onReorder: (from: number, to: number) => void; selected?: boolean; onSelect?: () => void; }) {
  return <tr className={selected ? "selected-step-row" : ""} onClick={onSelect} style={{ background: selected ? "#00bfff22" : undefined }}`;
c = c.replace(/function StepRow\(\{ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder \}: \{ step: TestStep; index: number; onPatch: \(patch: Partial<TestStep>\) => void; onFn: \(fn: Fn\) => void; onValue: \(value: string\) => void; onValidation: \(mode: ValidationMode\) => void; onDelete: \(\) => void; onReorder: \(from: number, to: number\) => void \}\) \{\s*return <tr/, injectStepRow);


fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
