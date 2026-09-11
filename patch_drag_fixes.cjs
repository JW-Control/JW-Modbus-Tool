const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Replace the faulty useEffect in StepRow
const oldUseEffect = `useEffect(() => {
    const clearDrag = () => setDragOver(false);
    window.addEventListener('dragend', clearDrag);
    window.addEventListener('drop', clearDrag);
    return () => {
      window.removeEventListener('dragend', clearDrag);
      window.removeEventListener('drop', clearDrag);
    };
  }, []);`;

const newUseEffect = `useEffect(() => {
    const clearDrag = () => setDragOver(false);
    window.addEventListener('clear-drag-lines', clearDrag);
    return () => window.removeEventListener('clear-drag-lines', clearDrag);
  }, []);`;

c = c.replace(oldUseEffect, newUseEffect);

// 2. Replace onDragEnd in StepRow to dispatch the custom event
c = c.replace(/onDragEnd=\{\(\) => setDragOver\(false\)\}/g, `onDragEnd={() => { setDragOver(false); window.dispatchEvent(new CustomEvent('clear-drag-lines')); }}`);

// 3. Update onDragStart to create a custom ghost image if dragging multiple rows
const oldDragStart = `onDragStart={(e) => { e.dataTransfer.setData("application/json", JSON.stringify(dragPayload)); e.dataTransfer.effectAllowed = "move"; }}`;
const newDragStart = `onDragStart={(e) => { 
  e.dataTransfer.setData("application/json", JSON.stringify(dragPayload)); 
  e.dataTransfer.effectAllowed = "move"; 
  if (dragPayload.length > 1) {
    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    ghost.style.background = '#0a8ff0';
    ghost.style.border = '1px solid #00bfff';
    ghost.style.color = 'white';
    ghost.style.padding = '8px 14px';
    ghost.style.borderRadius = '6px';
    ghost.style.fontWeight = 'bold';
    ghost.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
    ghost.style.zIndex = '9999';
    ghost.innerText = 'Moviendo ' + dragPayload.length + ' filas...';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, -10, -10);
    setTimeout(() => { if(document.body.contains(ghost)) document.body.removeChild(ghost); }, 0);
  }
}}`;

c = c.replace(oldDragStart, newDragStart);

// 4. Update TestsView's handleKeyDown for Escape to also clear drag lines just in case
c = c.replace(/if \(e\.key === 'Escape'\) \{/, `if (e.key === 'Escape') {\n        window.dispatchEvent(new CustomEvent('clear-drag-lines'));`);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
