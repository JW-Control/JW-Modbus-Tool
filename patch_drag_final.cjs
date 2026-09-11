const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Remove the useState and useEffect for dragOver
c = c.replace(/const \[dragOver, setDragOver\] = useState<.*?>\(false\);/, '');
c = c.replace(/useEffect\(\(\) => \{\s*const clearDrag = \(\) => setDragOver\(false\);\s*window\.addEventListener\('clear-drag-lines', clearDrag\);\s*return \(\) => window\.removeEventListener\('clear-drag-lines', clearDrag\);\s*\}, \[\]\);/, '');

// 2. Remove className ternary
c = c.replace(/ className=\{dragOver === "top" \? "drag-over" : dragOver === "bottom" \? "drag-over-bottom" : ""\}/, '');

// 3. Update onDragOver
const oldDragOver = /onDragOver=\{\(e\) => \{ e\.preventDefault\(\); e\.dataTransfer\.dropEffect = "move"; const rect = e\.currentTarget\.getBoundingClientRect\(\); const isBottom = e\.clientY > rect\.top \+ rect\.height \/ 2; setDragOver\(isBottom \? "bottom" : "top"\); \}\}/;
c = c.replace(oldDragOver, 
`onDragOver={(e) => { 
  e.preventDefault(); 
  e.dataTransfer.dropEffect = "move"; 
  document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => {
    if (el !== e.currentTarget) el.classList.remove('drag-over', 'drag-over-bottom');
  });
  const rect = e.currentTarget.getBoundingClientRect(); 
  const isBottom = e.clientY > rect.top + rect.height / 2; 
  if (isBottom) {
    e.currentTarget.classList.add('drag-over-bottom');
    e.currentTarget.classList.remove('drag-over');
  } else {
    e.currentTarget.classList.add('drag-over');
    e.currentTarget.classList.remove('drag-over-bottom');
  }
}}`);

// 4. Update onDrop
const oldDrop = /onDrop=\{\(e\) => \{ e\.preventDefault\(\); window\.dispatchEvent\(new CustomEvent\('clear-drag-lines'\)\); const isBottom = dragOver === "bottom"; setDragOver\(false\); const payload = e\.dataTransfer\.getData\("application\/json"\) \|\| e\.dataTransfer\.getData\("text\/plain"\); let to = index; if \(isBottom\) \{ to = index \+ 1; \} onReorder\(payload, to\); \}\}/;
c = c.replace(oldDrop, 
`onDrop={(e) => { 
  e.preventDefault(); 
  const isBottom = e.currentTarget.classList.contains('drag-over-bottom');
  document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'));
  const payload = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain"); 
  let to = index; 
  if (isBottom) { to = index + 1; } 
  onReorder(payload, to); 
}}`);

// 5. Update onDragEnd and onDragLeave
const oldDragEndLeave = /onDragEnd=\{\(\) => \{ setDragOver\(false\); window\.dispatchEvent\(new CustomEvent\('clear-drag-lines'\)\); \}\} onDragLeave=\{\(e\) => \{ const rect = e\.currentTarget\.getBoundingClientRect\(\); if \(e\.clientY < rect\.top \|\| e\.clientY >= rect\.bottom \|\| e\.clientX < rect\.left \|\| e\.clientX >= rect\.right\) \{ setDragOver\(false\); \} \}\}/;
c = c.replace(oldDragEndLeave, 
`onDragEnd={() => document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'))} 
onDragLeave={(e) => { 
  const rect = e.currentTarget.getBoundingClientRect();
  if (e.clientY <= rect.top || e.clientY >= rect.bottom || e.clientX <= rect.left || e.clientX >= rect.right) {
    e.currentTarget.classList.remove('drag-over', 'drag-over-bottom');
  }
}}`);

// 6. Update ghost opacity to 0.55
c = c.replace(/ghost\.style\.opacity = '0\.85';/, "ghost.style.opacity = '0.55';");

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done');
