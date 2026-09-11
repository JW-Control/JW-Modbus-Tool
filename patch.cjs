const fs = require('fs');
let c = fs.readFileSync('src/renderer/SimpleModeApp.tsx', 'utf8');

c = c.replace(/function Table\(\{ columns, rows, layout \}: \{ columns: ReactNode\[\]; rows: ReactNode\[\]\[\]; layout\?: string \}\) \{ return <div className="table"><div className="tr head" style=\{\{ gridTemplateColumns: layout \|\| `repeat\(\$\{columns\.length\},minmax\(0,1fr\)\)` \}\}>\{columns\.map\(\(column, index\) => <span key=\{index\}>\{column\}<\/span>\)\}<\/div>\{rows\.map\(\(row, rowIndex\) => <div className="tr" key=\{rowIndex\} style=\{\{ gridTemplateColumns: layout \|\| `repeat\(\$\{columns\.length\},minmax\(0,1fr\)\)` \}\}>\{row\.map\(\(cell, cellIndex\) => <span key=\{cellIndex\}>\{cell\}<\/span>\)\}<\/div>\)\}<\/div>; \}/,
`function Table({ columns, rows, layout, onRowClick, selectedRow }: { columns: ReactNode[]; rows: ReactNode[][]; layout?: string; onRowClick?: (idx: number) => void; selectedRow?: number }) { return <div className="table"><div className="tr head" style={{ gridTemplateColumns: layout || \`repeat(\${columns.length},minmax(0,1fr))\` }}>{columns.map((column, index) => <span key={index}>{column}</span>)}</div>{rows.map((row, rowIndex) => <div className="tr" key={rowIndex} onClick={() => onRowClick?.(rowIndex)} style={{ gridTemplateColumns: layout || \`repeat(\${columns.length},minmax(0,1fr))\`, cursor: onRowClick ? "pointer" : "default", background: selectedRow === rowIndex ? "#00bfff22" : undefined }}>{row.map((cell, cellIndex) => <span key={cellIndex}>{cell}</span>)}</div>)}</div>; }`
);

c = c.replace('<TestsView tests={tests} runTests={startTests} busy={testsRuntime?.running ?? false} />', '<TestsView tests={tests} setTests={setTests} undo={undoTests} redo={redoTests} canUndo={canUndoTests} canRedo={canRedoTests} runTests={startTests} busy={testsRuntime?.running ?? false} />');

fs.writeFileSync('src/renderer/SimpleModeApp.tsx', c);
console.log("Done");
