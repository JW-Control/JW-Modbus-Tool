const fs = require('fs');

let css = fs.readFileSync('src/renderer/simple-mode-overrides.css', 'utf8');

css += `\n
/* Bit Editor Modal */
.bit-editor-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.bit-editor-modal {
  background: #071d30;
  border: 1px solid #2d5c75;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 650px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.8);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bit-editor-modal header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bit-editor-modal header h2 {
  margin: 0;
  color: #fff;
  font-size: 1.25rem;
}

.bit-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 10px;
  margin: 10px 0;
  max-height: 40vh;
  overflow-y: auto;
  padding-right: 5px;
}

.bit-cell {
  background: #ffffff05;
  border: 1px solid #2d5c7545;
  border-radius: 8px;
  padding: 12px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.bit-cell:hover {
  background: #ffffff11;
  border-color: #00bfff66;
}

.bit-cell small {
  color: var(--muted);
  font-family: monospace;
  font-size: 0.75rem;
}

.bit-cell .bit-val {
  color: #fff;
  font-size: 0.9rem;
  font-weight: bold;
}

.bit-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
}

.bit-circle.off {
  background: #3a454d;
  border: 1px solid #2d5c75;
}

.bit-circle.on {
  background: #00bfff;
  border: 1px solid #7ce0ff;
  box-shadow: 0 0 10px rgba(0,191,255,0.6), inset 0 2px 4px rgba(255,255,255,0.3);
}

.bit-actions {
  display: flex;
  gap: 10px;
}

.bit-summary {
  display: flex;
  gap: 20px;
  background: #ffffff05;
  padding: 12px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 1.1rem;
  color: #fff;
}

.bit-summary span small {
  color: var(--cyan);
  margin-right: 6px;
}

.bit-editor-modal footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

/* Bit Preview */
.bit-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #041727;
  border: 1px solid #2d5c75;
  border-radius: 6px;
  padding: 4px 6px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.bit-preview:hover {
  border-color: #00bfff;
}

.bit-preview-circles {
  display: flex;
  gap: 4px;
  align-items: center;
}

.bit-preview-circles span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.bit-preview-circles span.off {
  background: #3a454d;
}

.bit-preview-circles span.on {
  background: #00bfff;
  box-shadow: 0 0 5px rgba(0,191,255,0.5);
}

.bit-preview-circles .more-dots {
  color: var(--muted);
  background: none;
  font-size: 10px;
  letter-spacing: 1px;
  line-height: 10px;
  width: auto;
  border-radius: 0;
}

.bit-edit-btn {
  background: transparent;
  border: none;
  color: var(--cyan);
  padding: 0 4px;
  font-size: 1.1rem;
}
`;

fs.writeFileSync('src/renderer/simple-mode-overrides.css', css);
console.log("Done");
