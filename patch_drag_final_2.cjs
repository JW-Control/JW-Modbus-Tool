const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

c = c.replace(/const \[dragOver, setDragOver\] = useState<.*?>\(false\);/, '');
c = c.replace(/useEffect\(\(\) => \{\s*const clearDrag = \(\) => setDragOver\(false\);\s*window\.addEventListener\('clear-drag-lines', clearDrag\);\s*return \(\) => window\.removeEventListener\('clear-drag-lines', clearDrag\);\s*\}, \[\]\);/, '');
c = c.replace(/ className=\{dragOver === "top" \? "drag-over" : dragOver === "bottom" \? "drag-over-bottom" : ""\}/, '');

const fullTrEventsRegex = /onDragOver=\{[\s\S]*?\}\} onDragEnd=\{[\s\S]*?\}\} onDragLeave=\{[\s\S]*?\}\}/;
c = c.replace(fullTrEventsRegex, 
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
}} onDragEnd={() => document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'))} 
onDragLeave={(e) => { 
  const rect = e.currentTarget.getBoundingClientRect();
  if (e.clientY <= rect.top || e.clientY >= rect.bottom || e.clientX <= rect.left || e.clientX >= rect.right) {
    e.currentTarget.classList.remove('drag-over', 'drag-over-bottom');
  }
}}`);

c = c.replace(/onDrop=\{[\s\S]*?onReorder\(payload, to\); \}\}/,
`onDrop={(e) => { 
  e.preventDefault(); 
  const isBottom = e.currentTarget.classList.contains('drag-over-bottom');
  document.querySelectorAll('.drag-over, .drag-over-bottom').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'));
  const payload = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain"); 
  let to = index; 
  if (isBottom) { to = index + 1; } 
  onReorder(payload, to); 
}}`);

c = c.replace(/ghost\.style\.opacity = '0\.85';/, "ghost.style.opacity = '0.55';");

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done');
