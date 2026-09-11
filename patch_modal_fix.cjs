const fs = require('fs');
let c = fs.readFileSync('src/renderer/simple-tests-consolidated.tsx', 'utf8');

// 1. Add createPortal import
if (!c.includes('createPortal')) {
  c = c.replace(/import \{.*?\} from "react";/, `$& import { createPortal } from 'react-dom';`);
}

// 2. Fix the corrupted button inside BitPreview
c = c.replace(/<button className="tiny bit-edit-btn">.*?<\/button>/g, '<button className="tiny bit-edit-btn">⚙ Editar</button>');

// 3. Wrap the overlay inside BitEditorModal with createPortal
const oldModalReturn = /return \(\n\s*<div className="bit-editor-modal-overlay"[\s\S]*?<\/div>\n\s*\);/;

const newModalReturn = `return createPortal(
    <div className="bit-editor-modal-overlay" onClick={onClose}>
      <div className="bit-editor-modal" onClick={e => e.stopPropagation()}>
        <header>
          <h2>Patrón de bobinas</h2>
          <button className="tiny close-btn" onClick={onClose}>✕</button>
        </header>
        <p className="muted" style={{ marginTop: '0', marginBottom: '14px' }}>Inicio {startAddress} • {q} bobinas • Ascendente →</p>
        
        <div className="bit-grid">
          {bits.map((b, i) => (
            <div key={i} className="bit-cell" onClick={() => {
              const next = [...bits];
              next[i] = !b;
              setBits(next);
            }}>
              <small>{String(baseAddress + i).padStart(5, '0')}</small>
              <div className={\`bit-circle \${b ? 'on' : 'off'}\`}></div>
              <small className="bit-val">{b ? "1" : "0"}</small>
            </div>
          ))}
        </div>

        <div className="bit-actions">
          <button onClick={() => toggleAll(true)}>Todo ON</button>
          <button onClick={() => toggleAll(false)}>Todo OFF</button>
          <button onClick={invertAll}>Invertir</button>
        </div>

        <div className="bit-summary">
          <span><small>DEC</small> {decValueStr}</span>
          <span><small>HEX</small> 0x{hexValueStr}</span>
          <span><small>BIN</small> {binValueStr}</span>
        </div>

        <footer>
          <button className="ghost" onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={handleApply}>Aplicar</button>
        </footer>
      </div>
    </div>,
    document.body
  );`;

c = c.replace(oldModalReturn, newModalReturn);

fs.writeFileSync('src/renderer/simple-tests-consolidated.tsx', c);
console.log('Done');
