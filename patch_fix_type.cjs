const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');
c = c.replace('at: undefined,', 'at: "",');
fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Fixed at: ""');
