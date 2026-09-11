const fs = require('fs');
let css = fs.readFileSync('src/renderer/simple-mode-overrides.css', 'utf8');

css += `\n
/* Reduce Esperado column width */
.testsPlanTable th:nth-child(9),
.testsPlanTable td:nth-child(9) {
  max-width: 140px;
  width: 140px;
}

/* FC05 simple checkbox styling */
.fc5-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #00bfff;
  margin: 0;
  display: block;
}
`;

fs.writeFileSync('src/renderer/simple-mode-overrides.css', css);
console.log('Done');
