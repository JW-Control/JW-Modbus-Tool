const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

const regexVal = /<BitPreview value=\{step\.value\}[\s\S]*?\{showBitEditor === "value" && \([\s\S]*?<BitEditorModal[\s\S]*?\/>\s*\)\s*\}/;
c = c.replace(regexVal, match => {
  // Strip out any broken </> I inserted
  let cleanMatch = match.replace(/<\/>/g, '');
  return '<>' + cleanMatch + '</>';
});

const regexExp = /<BitPreview value=\{step\.expected\}[\s\S]*?\{showBitEditor === "expected" && \([\s\S]*?<BitEditorModal[\s\S]*?\/>\s*\)\s*\}/;
c = c.replace(regexExp, match => {
  // Strip out any broken </> I inserted
  let cleanMatch = match.replace(/<\/>/g, '');
  return '<>' + cleanMatch + '</>';
});

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done');
