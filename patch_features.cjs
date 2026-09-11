const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Add Escape key logic in handleKeyDown
c = c.replace(/if \(e\.ctrlKey && e\.key === 'a'\) \{/, 
`      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedRows([]);
        setLastSelectedIndex(null);
        return;
      }
      if (e.ctrlKey && e.key === 'a') {`);

// 2. Add autoscroll and click outside effects
const effects = `
  useEffect(() => {
    if (lastSelectedIndex !== null) {
      const row = document.querySelector(\`.testsPlanTable tbody tr:nth-child(\${lastSelectedIndex + 1})\`);
      if (row) {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [lastSelectedIndex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const table = document.querySelector('.testsPlanTable');
      if (table && !table.contains(e.target as Node)) {
        setSelectedRows([]);
        setLastSelectedIndex(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
`;
c = c.replace(/useEffect\(\(\) => \{\n    function handleKeyDown/g, effects + '    function handleKeyDown');

// 3. Fix the onDragLeave bug in StepRow
c = c.replace(/onDragLeave=\{\(\) => setDragOver\(false\)\}/g, 
`onDragLeave={(e) => { 
  const rect = e.currentTarget.getBoundingClientRect();
  if (e.clientY < rect.top || e.clientY >= rect.bottom || e.clientX < rect.left || e.clientX >= rect.right) {
    setDragOver(false);
  }
}}`);

// 4. Also clear dragOver on drop
c = c.replace(/onDrop=\{\(e\) => \{ e\.preventDefault\(\); const isBottom = dragOver === "bottom"; setDragOver\(false\);/, 
`onDrop={(e) => { e.preventDefault(); const isBottom = dragOver === "bottom"; setDragOver(false);`);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);

// Update CSS to make drag styling more aggressive
let css = fs.readFileSync('src/renderer/simple-mode-overrides.css', 'utf8');
css = css.replace(/border-top: 3px solid #00bfff !important;/g, 'border-top: 4px solid #00bfff !important; box-shadow: inset 0 2px 5px rgba(0,191,255,0.5) !important;');
css = css.replace(/border-bottom: 3px solid #00bfff !important;/g, 'border-bottom: 4px solid #00bfff !important; box-shadow: inset 0 -2px 5px rgba(0,191,255,0.5) !important;');
fs.writeFileSync('src/renderer/simple-mode-overrides.css', css);

console.log("Done");
