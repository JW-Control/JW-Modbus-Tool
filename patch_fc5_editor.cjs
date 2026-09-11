const fs = require('fs');

let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

const oldValCell = `<td><input type={isSingleWrite ? "number" : "text"} min="0" max="65535" disabled={read && step.fn !== "delay"} value={read && step.fn !== "delay" ? "-" : step.value} onChange={(event) => onValue(event.target.value)} /></td>`;

const newValCell = `<td>
  {step.fn === "fc5" ? (
    <div className="fc5-toggle">
      <button className={\`toggle-btn \${step.value !== "65280" ? "off-active" : ""}\`} onClick={(e) => { e.stopPropagation(); onValue("0"); }}>OFF</button>
      <button className={\`toggle-btn \${step.value === "65280" ? "on-active" : ""}\`} onClick={(e) => { e.stopPropagation(); onValue("65280"); }}>ON</button>
    </div>
  ) : (
    <input type={isSingleWrite ? "number" : "text"} min="0" max="65535" disabled={read && step.fn !== "delay"} value={read && step.fn !== "delay" ? "-" : step.value} onChange={(event) => onValue(event.target.value)} />
  )}
</td>`;

c = c.replace(oldValCell, newValCell);
fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);

let css = fs.readFileSync('src/renderer/simple-mode-overrides.css', 'utf8');
css += `\n
/* FC05 Toggle Switch */
.fc5-toggle {
  display: inline-flex;
  border: 1px solid #2d5c75;
  border-radius: 6px;
  overflow: hidden;
  background: #071d30;
}
.fc5-toggle .toggle-btn {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 4px 12px;
  font-size: 0.8rem;
  font-weight: bold;
  color: var(--muted);
  cursor: pointer;
  min-height: 28px;
  transition: all 0.2s;
}
.fc5-toggle .toggle-btn.off-active {
  background: #3a454d;
  color: white;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
}
.fc5-toggle .toggle-btn.on-active {
  background: #00bfff22;
  color: #00bfff;
  box-shadow: inset 0 2px 4px rgba(0,191,255,0.2);
}
`;
fs.writeFileSync('src/renderer/simple-mode-overrides.css', css);

console.log("Done");
