const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

c = c.replace(/newStep.timeout = parsed.data.timeout \|\| 1000;/g, 'newStep.timeoutMs = parsed.data.timeoutMs || 1000;');
c = c.replace(/newStep.timeout = state.steps\[selectedRow\].timeout;/g, 'newStep.timeoutMs = state.steps[selectedRow].timeoutMs;');

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log("Done");
