const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

c = c.replace(/const \[dragOver, setDragOver\] = useState\(false\);/, 'const [dragOver, setDragOver] = useState<"top" | "bottom" | false>(false);');

c = c.replace(/className=\{dragOver \? "drag-over" : ""\}/, 'className={dragOver === "top" ? "drag-over" : dragOver === "bottom" ? "drag-over-bottom" : ""}');

c = c.replace(/onDragOver=\{\(e\) => \{ e\.preventDefault\(\); e\.dataTransfer\.dropEffect = "move"; setDragOver\(true\); \}\}/, 
'onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; const rect = e.currentTarget.getBoundingClientRect(); const isBottom = e.clientY > rect.top + rect.height / 2; setDragOver(isBottom ? "bottom" : "top"); }}');

c = c.replace(/onDrop=\{\(e\) => \{ e\.preventDefault\(\); setDragOver\(false\); const from = Number\(e\.dataTransfer\.getData\("text\/plain"\)\); onReorder\(from, index\); \}\}/, 
'onDrop={(e) => { e.preventDefault(); const isBottom = dragOver === "bottom"; setDragOver(false); const from = Number(e.dataTransfer.getData("text/plain")); let to = index; if (isBottom) { to = index + 1; } if (from === to || from === to - 1) return; onReorder(from, to > from ? to - 1 : to); }}');

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
