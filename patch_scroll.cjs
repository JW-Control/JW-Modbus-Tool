const fs = require('fs');
let css = fs.readFileSync('src/renderer/simple-mode-overrides.css', 'utf8');

css += '\n\n/* Scroll offset for sticky headers */\n';
css += '.testsPlanTable tbody tr {\n';
css += '  scroll-margin-top: 55px;\n';
css += '  scroll-margin-bottom: 55px;\n';
css += '}\n';

fs.writeFileSync('src/renderer/simple-mode-overrides.css', css);

let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');
c = c.replace(/block: 'nearest'/g, "block: 'center'");
fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);

console.log("Done");
