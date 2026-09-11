const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

if (!c.includes('<style>{`')) {
  c = c.replace(/<div className="testsPlanTable">/, 
    `<div className="testsPlanTable">
      <style>{\`
        .testsPlanTable table tr.drag-over td { border-top: 4px solid #00bfff !important; background-color: rgba(0, 191, 255, 0.35) !important; box-shadow: inset 0 3px 6px rgba(0,191,255,0.5) !important; }
        .testsPlanTable table tr.drag-over-bottom td { border-bottom: 4px solid #00bfff !important; background-color: rgba(0, 191, 255, 0.35) !important; box-shadow: inset 0 -3px 6px rgba(0,191,255,0.5) !important; }
        .testsPlanTable table { border-collapse: collapse !important; }
        .testsPlanTable tbody tr { scroll-margin-top: 55px; scroll-margin-bottom: 55px; }
      \`}</style>`
  );
  fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
  console.log("Done");
} else {
  console.log("Already patched");
}
