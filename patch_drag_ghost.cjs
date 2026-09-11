const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// Update onDrop to dispatch clear-drag-lines
c = c.replace(/onDrop=\{\(e\) => \{ e\.preventDefault\(\); const isBottom = dragOver === "bottom"; setDragOver\(false\);/g, 
`onDrop={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('clear-drag-lines')); const isBottom = dragOver === "bottom"; setDragOver(false);`);

// Update onDragStart to create a beautiful cloned table for multi-drag
const oldDragStart = `onDragStart={(e) => { 
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

const newDragStart = `onDragStart={(e) => { 
  e.dataTransfer.setData("application/json", JSON.stringify(dragPayload)); 
  e.dataTransfer.effectAllowed = "move"; 
  if (dragPayload.length > 1) {
    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.opacity = '0.85';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.background = '#071d30';
    ghost.style.borderRadius = '8px';
    ghost.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    ghost.style.border = '1px solid #00bfff';
    ghost.style.overflow = 'hidden';
    
    const table = document.createElement('table');
    table.className = 'testsPlanTable';
    table.style.borderCollapse = 'collapse';
    table.style.width = e.currentTarget.closest('table')?.offsetWidth + 'px' || '800px';
    table.style.margin = '0';
    
    const tbody = document.createElement('tbody');
    const allRows = Array.from(e.currentTarget.parentElement?.children || []);
    dragPayload.forEach(idx => {
       if (allRows[idx]) {
         const clone = allRows[idx].cloneNode(true);
         clone.style.background = '#00bfff22';
         // remove specific drag classes from clone if they exist
         clone.classList.remove('drag-over', 'drag-over-bottom');
         tbody.appendChild(clone);
       }
    });
    
    table.appendChild(tbody);
    ghost.appendChild(table);
    document.body.appendChild(ghost);
    
    e.dataTransfer.setDragImage(ghost, 30, 30);
    setTimeout(() => { if(document.body.contains(ghost)) document.body.removeChild(ghost); }, 0);
  }
}}`;

c = c.replace(oldDragStart, newDragStart);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
