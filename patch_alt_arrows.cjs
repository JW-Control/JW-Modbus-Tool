const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

const altArrowLogic = `
      // Alt + Arrows to move items
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (selectedRows.length === 0) return;
        const sorted = [...selectedRows].sort((a,b)=>a-b);
        const direction = e.key === 'ArrowUp' ? -1 : 1;
        if (direction === -1 && sorted[0] === 0) return;
        if (direction === 1 && sorted[sorted.length - 1] === state.steps.length - 1) return;
        
        const nextSteps = [...state.steps];
        const newSelection = [];
        
        if (direction === -1) {
          for (const idx of sorted) {
            const temp = nextSteps[idx - 1];
            nextSteps[idx - 1] = nextSteps[idx];
            nextSteps[idx] = temp;
            newSelection.push(idx - 1);
          }
        } else {
          for (let i = sorted.length - 1; i >= 0; i--) {
            const idx = sorted[i];
            const temp = nextSteps[idx + 1];
            nextSteps[idx + 1] = nextSteps[idx];
            nextSteps[idx] = temp;
            newSelection.push(idx + 1);
          }
        }
        pushHistory(nextSteps);
        setState(s => ({ ...s, steps: nextSteps }));
        setSelectedRows(newSelection.sort((a,b)=>a-b));
        if (lastSelectedIndex !== null) setLastSelectedIndex(lastSelectedIndex + direction);
        return;
      }

      // Shift + Arrows
`;

c = c.replace(/\/\/ Shift \+ Arrows/, altArrowLogic);
fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);

let css = fs.readFileSync('src/renderer/simple-mode-overrides.css', 'utf8');
css = css.replace(/box-shadow: inset 0 3px 0 0 #00bfff !important;/g, 'border-top: 3px solid #00bfff !important;');
css = css.replace(/box-shadow: inset 0 -3px 0 0 #00bfff !important;/g, 'border-bottom: 3px solid #00bfff !important;');
css = css.replace(/rgba\(0, 191, 255, 0.15\)/g, 'rgba(0, 191, 255, 0.35)');
fs.writeFileSync('src/renderer/simple-mode-overrides.css', css);

console.log("Done");
