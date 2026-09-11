const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Inject state
const injectState = `const [state, setState] = useState<TestsState>(() => createInitialState(runtimeState, defaultSlave));
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
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

  function handleRowClick(index: number, e: React.MouseEvent) {
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const newSelection = [];
      for (let i = start; i <= end; i++) newSelection.push(i);
      setSelectedRows(newSelection);
    } else if (e.ctrlKey || e.metaKey) {
      if (selectedRows.includes(index)) {
        setSelectedRows(selectedRows.filter(r => r !== index));
      } else {
        setSelectedRows([...selectedRows, index]);
      }
      setLastSelectedIndex(index);
    } else {
      setSelectedRows([index]);
      setLastSelectedIndex(index);
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedRows(state.steps.map((_, i) => i));
        return;
      }

      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }

      // Shift + Arrows
      if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (lastSelectedIndex === null) return;
        const nextIndex = e.key === 'ArrowDown' ? Math.min(state.steps.length - 1, lastSelectedIndex + 1) : Math.max(0, lastSelectedIndex - 1);
        
        let start = Math.min(selectedRows[0] ?? nextIndex, nextIndex);
        let end = Math.max(selectedRows[selectedRows.length - 1] ?? nextIndex, nextIndex);
        // Better logic: if expanding selection
        if (!selectedRows.includes(nextIndex)) {
            setSelectedRows([...selectedRows, nextIndex].sort((a,b)=>a-b));
        } else {
            setSelectedRows(selectedRows.filter(i => i !== lastSelectedIndex).sort((a,b)=>a-b));
        }
        setLastSelectedIndex(nextIndex);
        return;
      } else if (!e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        let nextIndex = 0;
        if (lastSelectedIndex !== null) {
          nextIndex = e.key === 'ArrowDown' ? Math.min(state.steps.length - 1, lastSelectedIndex + 1) : Math.max(0, lastSelectedIndex - 1);
        }
        setSelectedRows([nextIndex]);
        setLastSelectedIndex(nextIndex);
        return;
      }

      if (e.ctrlKey && e.key === 'c' && selectedRows.length > 0) {
        e.preventDefault();
        const toCopy = selectedRows.sort((a, b) => a - b).map(idx => stripStep(state.steps[idx]));
        navigator.clipboard.writeText(JSON.stringify({ __jwmodbus_test_multi: true, data: toCopy }));
      }
      else if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          try {
            const parsed = JSON.parse(text);
            const toInsert = parsed.__jwmodbus_test_multi ? parsed.data : (parsed.__jwmodbus_test ? [parsed.data] : null);
            if (toInsert && Array.isArray(toInsert)) {
              const newSteps = toInsert.map(d => {
                const s = createStep(defaultSlave, d.fn, d.address, d.quantity, d.value, d.validationMode);
                s.expected = d.expected || "";
                s.timeoutMs = d.timeoutMs || 1000;
                return s;
              });
              const nextSteps = [...state.steps];
              const insertAt = selectedRows.length > 0 ? Math.max(...selectedRows) + 1 : nextSteps.length;
              nextSteps.splice(insertAt, 0, ...newSteps);
              pushHistory(nextSteps);
              setState(s => ({ ...s, steps: nextSteps }));
              const newSelection = newSteps.map((_, i) => insertAt + i);
              setSelectedRows(newSelection);
              setLastSelectedIndex(newSelection[newSelection.length - 1]);
            }
          } catch (e) {}
        }).catch(() => {});
      }
      else if (e.ctrlKey && e.key === 'd' && selectedRows.length > 0) {
        e.preventDefault();
        const toDuplicate = selectedRows.sort((a, b) => a - b).map(idx => state.steps[idx]);
        const newSteps = toDuplicate.map(d => {
          const s = createStep(defaultSlave, d.fn, d.address, d.quantity, d.value, d.validationMode);
          s.expected = d.expected;
          s.timeoutMs = d.timeoutMs;
          return s;
        });
        const nextSteps = [...state.steps];
        const insertAt = Math.max(...selectedRows) + 1;
        nextSteps.splice(insertAt, 0, ...newSteps);
        pushHistory(nextSteps);
        setState(s => ({ ...s, steps: nextSteps }));
        const newSelection = newSteps.map((_, i) => insertAt + i);
        setSelectedRows(newSelection);
        setLastSelectedIndex(newSelection[newSelection.length - 1]);
      }
      else if (e.key === 'Delete' && selectedRows.length > 0) {
        e.preventDefault();
        const nextSteps = state.steps.filter((_, idx) => !selectedRows.includes(idx));
        pushHistory(nextSteps);
        setState(s => ({ ...s, steps: nextSteps, detailIndex: null }));
        setSelectedRows([]);
        setLastSelectedIndex(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.steps, selectedRows, lastSelectedIndex, undoStack, redoStack]);
`;

c = c.replace('const [state, setState] = useState<TestsState>(() => createInitialState(runtimeState, defaultSlave));', injectState);

// 2. Wrap editor functions to call pushHistory BEFORE setState
c = c.replace(/function patchStep\(index: number, patch: Partial<TestStep>\) \{/g, 'function patchStep(index: number, patch: Partial<TestStep>) { pushHistory(state.steps);');
c = c.replace(/<button onClick=\{\(\) => setState\(\(current\) => \(\{ \.\.\.current, steps: \[\.\.\.current\.steps, createStep\(defaultSlave, "fc3", "40000", "1", "", "count"\)\] \}\)\)\}>/g, '<button onClick={() => { pushHistory(state.steps); setState((current) => ({ ...current, steps: [...current.steps, createStep(defaultSlave, "fc3", "40000", "1", "", "count")] })); }}>');

// 3. Reorder logic
c = c.replace(/onReorder=\{\(from, to\) => \{ if \(from === to\) return; setState\(\(current\) => \{ const steps = \[\.\.\.current\.steps\]; const \[moved\] = steps\.splice\(from, 1\); steps\.splice\(to, 0, moved\); return \{ \.\.\.current, steps, detailIndex: null \}; \}\); \}\}/g, 'onReorder={(from, to) => { if (from === to) return; pushHistory(state.steps); setState((current) => { const steps = [...current.steps]; const [moved] = steps.splice(from, 1); steps.splice(to, 0, moved); return { ...current, steps, detailIndex: null }; }); }}');

// 4. Delete logic in StepRow
c = c.replace(/onDelete=\{\(\) => setState\(\(current\) => \(\{ \.\.\.current, steps: current\.steps\.filter\(\(_, itemIndex\) => itemIndex !== index\), detailIndex: null \}\)\)\}/g, 'onDelete={() => { pushHistory(state.steps); setState((current) => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index), detailIndex: null })); setSelectedRows([]); setLastSelectedIndex(null); }}');

// 5. Apply selectedRow to StepRow
c = c.replace(/<StepRow key=\{step\.id\} step=\{step\} index=\{index\}/g, '<StepRow key={step.id} step={step} index={index} selected={selectedRows.includes(index)} onSelect={(e) => handleRowClick(index, e)}');

// 6. We must modify StepRow to accept `selected` and `onSelect` and render a selected style!
const injectStepRow = `function StepRow({ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder, selected, onSelect }: { step: TestStep; index: number; onPatch: (patch: Partial<TestStep>) => void; onFn: (fn: Fn) => void; onValue: (value: string) => void; onValidation: (mode: ValidationMode) => void; onDelete: () => void; onReorder: (from: number, to: number) => void; selected?: boolean; onSelect?: (e: React.MouseEvent) => void; }) {`;
c = c.replace(/function StepRow\(\{ step, index, onPatch, onFn, onValue, onValidation, onDelete, onReorder \}: \{ step: TestStep; index: number; onPatch: \(patch: Partial<TestStep>\) => void; onFn: \(fn: Fn\) => void; onValue: \(value: string\) => void; onValidation: \(mode: ValidationMode\) => void; onDelete: \(\) => void; onReorder: \(from: number, to: number\) => void \}\) \{/, injectStepRow);

c = c.replace(/<tr\s+draggable/g, '<tr onClick={onSelect} style={{ background: selected ? "#00bfff22" : undefined }} draggable');

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
