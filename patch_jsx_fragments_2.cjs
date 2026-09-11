const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

const regexVal = /<BitPreview value=\{step\.value\}.*?\/>\s*\{showBitEditor === "value" && \([\s\S]*?\)\s*\}/;
c = c.replace(regexVal, `$&`.replace('<BitPreview', '<><BitPreview') + '</>');

const regexExp = /<BitPreview value=\{step\.expected\}.*?\/>\s*\{showBitEditor === "expected" && \([\s\S]*?\)\s*\}/;
c = c.replace(regexExp, `$&`.replace('<BitPreview', '<><BitPreview') + '</>');

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done');
